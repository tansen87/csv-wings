use std::{
  fs,
  path::PathBuf,
  sync::{Arc, atomic::AtomicBool, mpsc::sync_channel},
};

use tauri::Manager;

use crate::view::text_view_utils::{
  self, AppState, FileInfo, GetLinesParams, MAX_LINES_PER_REQUEST, OpenFileParams, ReplaceParams,
  SearchMatch, SearchParams, SearchResult,
};
use large_text_core::encoding_utils::is_utf16_newline;
use large_text_core::search_engine::{SearchEngine, SearchMessage, SearchType};

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

/// 设置窗口标题
#[tauri::command]
pub async fn set_window_title(
  app: tauri::AppHandle,
  path: Option<String>,
) -> Result<(), String> {
  if let Some(window) = app.get_webview_window("main") {
    let title = match &path {
      Some(p) => format!("{} - Peek", p),
      None => "Peek".to_string(),
    };
    window.set_title(&title).map_err(|e| e.to_string())?;
  }
  Ok(())
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
  let count = actual_end - params.start_line;

  // 如果请求数量为 0,直接返回空
  if count == 0 {
    return Ok(vec![]);
  }

  // 获取起始行的字节偏移,并做安全校验
  // 转换为0-based索引
  let line_index = if params.start_line > 0 {
    params.start_line - 1
  } else {
    0
  };

  let start_offset = match indexer.get_line_with_reader(line_index, reader) {
    Some((start, _)) => {
      // 如果起始偏移超出文件范围,说明行号已超限
      if start >= reader.len() {
        return Ok(vec![String::new(); count]);
      }
      start
    }
    None => {
      // 无法定位起始行,返回空行占位
      return Ok(vec![String::new(); count]);
    }
  };

  // 从start_offset开始顺序读取count行
  let mut lines = Vec::with_capacity(count);
  let mut current_offset = start_offset;
  let mut lines_read = 0;

  // 对于UTF-16编码,确保起始位置是偶数
  let encoding = reader.encoding();
  let is_utf16 = encoding.name() == "UTF-16LE" || encoding.name() == "UTF-16BE";
  if is_utf16 && current_offset % 2 != 0 {
    current_offset -= 1;
  }

  while lines_read < count && current_offset < reader.len() {
    // 读取足够的内容来找到下一个换行符
    let chunk_size = 10000; // 每次读取10KB
    let chunk_end = std::cmp::min(current_offset + chunk_size, reader.len());

    if is_utf16 {
      // UTF-16 编码的换行符处理
      let mut found_newline = false;
      let is_utf16le = encoding.name() == "UTF-16LE";
      let mut i = if current_offset % 2 != 0 { 1 } else { 0 };
      let chunk = reader.get_bytes(current_offset, chunk_end);

      while i + 1 < chunk.len() {
        let byte1 = chunk[i];
        let byte2 = chunk[i + 1];

        if is_utf16_newline(byte1, byte2, is_utf16le) {
          // 计算实际的字节偏移
          let line_end = current_offset + i + 2; // 整个换行符占用2字节

          // 提取行内容
          let line_content = reader.get_chunk(current_offset, line_end);
          // 去除换行符
          let line_content = line_content.trim_end_matches('\n').trim_end_matches('\r');
          lines.push(line_content.to_string());
          lines_read += 1;

          // 移动到下一行的开始
          current_offset = line_end;
          found_newline = true;
          break;
        }
        i += 2;
      }

      if !found_newline {
        // 没有找到换行符,读取剩余内容
        let line_content = reader.get_chunk(current_offset, chunk_end);
        lines.push(line_content);
        lines_read += 1;
        current_offset = chunk_end;
      }
    } else {
      // 使用get_bytes直接操作字节数据查找换行符
      let chunk = reader.get_bytes(current_offset, chunk_end);

      // 找到换行符的位置
      let newline_pos = chunk.iter().position(|&b| b == b'\n');

      match newline_pos {
        Some(pos) => {
          // 计算实际的字节偏移
          let line_end = current_offset + pos + 1;

          // 提取行内容
          let line_content = reader.get_chunk(current_offset, line_end);
          // 去除换行符
          let line_content = line_content.trim_end_matches('\n').trim_end_matches('\r');
          lines.push(line_content.to_string());
          lines_read += 1;

          // 移动到下一行的开始
          current_offset = line_end;
        }
        None => {
          // 没有找到换行符,读取剩余内容
          let line_content = reader.get_chunk(current_offset, chunk_end);
          lines.push(line_content);
          lines_read += 1;
          current_offset = chunk_end;
        }
      }
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
  sessions.remove(&path);
  Ok(())
}

// 清理所有 Session
#[tauri::command]
pub fn cleanup_sessions(state: tauri::State<AppState>) -> Result<usize, String> {
  let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;

  let count = sessions.len();
  sessions.clear();

  Ok(count)
}

#[tauri::command]
pub fn get_pending_file_path(state: tauri::State<AppState>) -> Option<String> {
  // 从 AppState 中获取待打开的文件路径
  match state.pending_file_path.lock() {
    Ok(guard) => guard.clone(),
    Err(_) => {
      log::error!("Mutex poisoned in get_pending_file_path");
      None
    }
  }
}
