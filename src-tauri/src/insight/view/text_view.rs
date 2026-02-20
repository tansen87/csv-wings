use std::{
  fs,
  path::PathBuf,
  sync::{Arc, atomic::AtomicBool, mpsc::sync_channel},
};

use large_text_core::search_engine::{SearchEngine, SearchMessage, SearchType};

use crate::view::text_view_utils::{
  self, AppState, FileInfo, GetLinesParams, MAX_LINES_PER_REQUEST, OpenFileParams, ReplaceParams,
  SearchMatch, SearchParams, SearchResult,
};

/// 打开文件
#[tauri::command]
pub async fn open_file(
  state: tauri::State<'_, AppState>,
  params: OpenFileParams,
) -> Result<FileInfo, String> {
  let path = &params.path;
  let encoding = &params.encoding;
  // 强制重建:先删缓存
  {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    sessions.remove(&params.path);
  }

  let session = text_view_utils::create_session_for_path(&path, encoding.as_deref())?;

  // 存入缓存
  {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    sessions.insert(path.clone(), session.clone());
  }

  Ok(FileInfo {
    path: path.to_string(),
    size: session.reader.len() as u64,
    encoding: session.reader.encoding().name().to_string(),
    line_count: session.indexer.lock().unwrap().total_lines(),
  })
}

/// 获取文件内容(指定行范围)
#[tauri::command]
pub async fn get_file_content(
  state: tauri::State<'_, AppState>,
  params: GetLinesParams,
) -> Result<Vec<String>, String> {
  let session =
    text_view_utils::get_or_create_session(&state, &params.path, params.encoding.as_deref())?;
  let reader = &session.reader;
  let indexer = session.indexer.lock().map_err(|e| e.to_string())?;

  let actual_end = std::cmp::min(params.end_line, params.start_line + MAX_LINES_PER_REQUEST);
  let mut lines = Vec::new();

  for line_num in params.start_line..actual_end {
    if let Some((start, end)) = indexer.get_line_with_reader(line_num, reader) {
      lines.push(reader.get_chunk(start, end));
    } else {
      break;
    }
  }

  Ok(lines)
}

/// 搜索文件
#[tauri::command]
pub async fn search_file(
  state: tauri::State<'_, AppState>,
  params: SearchParams,
) -> Result<SearchResult, String> {
  let session = text_view_utils::get_or_create_session(&state, &params.path, None)?;
  let reader = session.reader;
  let indexer = session.indexer;

  // 创建搜索引擎
  let mut engine = SearchEngine::new();
  engine.set_query(
    params.query.clone(),
    params.use_regex,
    params.case_sensitive,
  );

  // 创建通道
  let (tx, rx) = sync_channel::<SearchMessage>(100);
  let cancel_token = Arc::new(AtomicBool::new(false));

  // 先统计总数
  engine.count_matches(reader.clone(), tx.clone(), cancel_token.clone());

  // 等待计数完成
  let mut total_matches = 0;
  for msg in rx.iter() {
    match msg {
      SearchMessage::CountResult(count) => total_matches += count,
      SearchMessage::Done(SearchType::Count) => break,
      SearchMessage::Error(e) => return Err(e),
      _ => {}
    }
  }

  // 如果总数为 0,直接返回
  if total_matches == 0 {
    return Ok(SearchResult {
      total_matches: 0,
      matches: Vec::new(),
      page: params.page,
      page_size: params.page_size,
    });
  }

  // 获取分页结果
  let (tx2, rx2) = sync_channel::<SearchMessage>(100);
  let start_offset = (params.page - 1) * params.page_size;

  engine.fetch_matches(
    reader.clone(),
    tx2.clone(),
    start_offset,
    params.page_size,
    cancel_token.clone(),
  );

  // 收集匹配结果
  let mut matches = Vec::new();

  for msg in rx2.iter() {
    match msg {
      SearchMessage::ChunkResult(chunk) => {
        for result in chunk.matches {
          // 扫描文件确定真实行边界
          let (line_start, line_end) =
            text_view_utils::scan_line_from_offset(&reader, result.byte_offset);

          // 2精确计算行号(从采样点开始计数换行符)
          let line_num = text_view_utils::count_lines_accurate(&indexer, &reader, line_start);

          let line_content = reader.get_chunk(line_start, line_end);
          let match_start = result.byte_offset.saturating_sub(line_start);

          matches.push(SearchMatch {
            line_number: line_num + 1, // 1-based
            line_content,
            match_start,
            match_length: result.match_len,
            byte_offset: result.byte_offset,
          });
        }
      }
      SearchMessage::Done(SearchType::Fetch) => break,
      SearchMessage::Error(e) => return Err(e),
      _ => {}
    }
  }

  Ok(SearchResult {
    total_matches,
    matches,
    page: params.page,
    page_size: params.page_size,
  })
}

/// 替换文本
#[tauri::command]
pub async fn replace_text(
  state: tauri::State<'_, AppState>,
  params: ReplaceParams,
) -> Result<u32, String> {
  let path = PathBuf::from(&params.path);
  if !path.exists() {
    return Err("文件不存在".to_string());
  }

  // 释放mmap资源
  {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    sessions.remove(&params.path);
  }

  // 确定编码
  let encoding_name = params.encoding.as_deref().unwrap_or("UTF-8");
  let encoding = text_view_utils::get_encoding(Some(encoding_name));

  // 创建临时文件
  let temp_path = path.with_extension(format!(
    "{}.tmp_replace",
    path.file_name().unwrap().to_string_lossy()
  ));

  // 执行流式替换
  let count = text_view_utils::perform_streaming_replace(
    &path,
    &temp_path,
    &params.search_query,
    &params.replace_text,
    params.replace_all,
    params.case_sensitive,
    encoding,
  )
  .map_err(|e| format!("replace_text falied: {}", e))?;

  // 原子性替换(先备份原文件,再重命名)
  let backup_path = path.with_extension(format!(
    "{}.bak",
    path.file_name().unwrap().to_string_lossy()
  ));
  fs::rename(&path, &backup_path).map_err(|e| format!("无法备份原文件: {}", e))?;

  fs::rename(&temp_path, &path).map_err(|e| {
    // 如果失败,尝试恢复原文件
    let _ = fs::rename(&backup_path, &path);
    format!("无法完成替换: {}", e)
  })?;

  // 删除备份
  let _ = fs::remove_file(backup_path);

  Ok(count)
}

/// 关闭文件(清理缓存)
#[tauri::command]
pub fn close_file(state: tauri::State<'_, AppState>, path: String) -> Result<(), String> {
  let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
  // 显式获取并 drop Session
  if let Some(session) = sessions.remove(&path) {
    // 显式 drop,确保资源立即释放
    drop(session);
    Ok(())
  } else {
    Err(format!("File not open: {}", path))
  }
}

// 清理所有 Session
#[tauri::command]
pub fn cleanup_sessions(state: tauri::State<AppState>) -> Result<usize, String> {
  let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;

  let count = sessions.len();
  sessions.clear();

  Ok(count)
}
