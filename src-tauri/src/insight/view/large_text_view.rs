use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::{Arc, atomic::AtomicBool, mpsc::sync_channel};

use encoding_rs::Encoding;
use encoding_rs_io::DecodeReaderBytesBuilder;
use serde::{Deserialize, Serialize};
use tauri::State;

use large_text_core::file_reader::{FileReader, available_encodings};
use large_text_core::line_indexer::LineIndexer;
use large_text_core::search_engine::{SearchEngine, SearchMessage, SearchType};

const MAX_LINES_PER_REQUEST: usize = 1000;

#[derive(Serialize, Deserialize, Clone)]
pub struct FileInfo {
  pub path: String,
  pub size: u64,
  pub encoding: String,
  pub line_count: usize,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SearchMatch {
  pub line_number: usize,
  pub line_content: String,
  pub match_start: usize,
  pub match_length: usize,
  pub byte_offset: usize,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SearchResult {
  pub total_matches: usize,
  pub matches: Vec<SearchMatch>,
  pub page: usize,
  pub page_size: usize,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct EncodingOption {
  pub label: String,
  pub name: String,
}

#[derive(Deserialize)]
pub struct OpenFileParams {
  pub path: String,
  pub encoding: Option<String>,
}

#[derive(Deserialize)]
pub struct GetLinesParams {
  pub path: String,
  pub start_line: usize,
  pub end_line: usize,
  pub encoding: Option<String>,
}

#[derive(Deserialize)]
pub struct SearchParams {
  pub path: String,
  pub query: String,
  pub case_sensitive: bool,
  pub use_regex: bool,
  pub page: usize,
  pub page_size: usize,
}

#[derive(Deserialize)]
pub struct ReplaceParams {
  pub path: String,
  pub search_query: String,
  pub replace_text: String,
  pub replace_all: bool,
  pub case_sensitive: bool,
  #[serde(default)]
  pub encoding: Option<String>,
}

#[derive(Clone)]
pub struct FileSession {
  pub reader: Arc<FileReader>,
  pub indexer: Arc<Mutex<LineIndexer>>,
}

pub struct AppState {
  pub sessions: Mutex<HashMap<String, FileSession>>,
}

impl Default for AppState {
  fn default() -> Self {
    Self {
      sessions: Mutex::new(HashMap::new()),
    }
  }
}

fn get_encoding(encoding_label: Option<&str>) -> &'static Encoding {
  match encoding_label {
    Some(label) => Encoding::for_label(label.as_bytes()).unwrap_or(encoding_rs::UTF_8),
    None => encoding_rs::UTF_8,
  }
}

fn create_session(path: &str, encoding: Option<&str>) -> Result<FileSession, String> {
  let path_buf = PathBuf::from(path);
  let enc = get_encoding(encoding);

  let reader = FileReader::new(path_buf, enc).map_err(|e| format!("打开文件失败：{}", e))?;

  let mut indexer = LineIndexer::new();
  indexer.index_file(&reader); // 大文件走 sparse 模式

  Ok(FileSession {
    reader: Arc::new(reader),
    indexer: Arc::new(Mutex::new(indexer)),
  })
}

fn get_or_create_session(
  state: &tauri::State<AppState>,
  path: &str,
  encoding: Option<&str>,
) -> Result<FileSession, String> {
  // 先尝试从缓存获取
  {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(session) = sessions.get(path) {
      return Ok(FileSession {
        reader: session.reader.clone(),
        indexer: session.indexer.clone(),
      });
    }
  }

  // 创建新会话
  let session = create_session(path, encoding)?;

  // 存入缓存
  {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    sessions.insert(
      path.to_string(),
      FileSession {
        reader: session.reader.clone(),
        indexer: session.indexer.clone(),
      },
    );
  }

  Ok(session)
}

/// 获取可用编码列表
#[tauri::command]
pub fn get_available_encodings() -> Vec<EncodingOption> {
  available_encodings()
    .iter()
    .map(|(label, enc)| EncodingOption {
      label: label.to_string(),
      name: enc.name().to_string(),
    })
    .collect()
}

fn create_session_for_path(path: &str, user_encoding: Option<&str>) -> Result<FileSession, String> {
  let encoding = get_encoding(user_encoding); // None → UTF-8
  let reader =
    FileReader::new(PathBuf::from(path), encoding).map_err(|e| format!("无法打开文件: {}", e))?;

  let mut indexer = LineIndexer::new();
  indexer.index_file(&reader);

  Ok(FileSession {
    reader: Arc::new(reader),
    indexer: Arc::new(Mutex::new(indexer)),
  })
}

/// 打开文件
#[tauri::command]
pub async fn open_file(
  state: tauri::State<'_, AppState>,
  params: OpenFileParams,
) -> Result<FileInfo, String> {
  let path = &params.path;
  let encoding = &params.encoding;
  // 强制重建：先删缓存
  {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    sessions.remove(&params.path);
  }

  let session = create_session_for_path(&path, encoding.as_deref())?;

  // 存入缓存(现在 reader 是 Arc,clone 很 cheap)
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
  let session = get_or_create_session(&state, &params.path, params.encoding.as_deref())?;
  let reader = &session.reader;
  let indexer = session.indexer.lock().map_err(|e| e.to_string())?;

  let actual_end = std::cmp::min(params.end_line, params.start_line + MAX_LINES_PER_REQUEST);
  let mut lines = Vec::new();

  for line_num in params.start_line..actual_end {
    if let Some((start, end)) = indexer.get_line_with_reader(line_num, reader) {
      lines.push(reader.get_chunk(start, end));
    } else {
      break; // 文件结束
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
  let session = get_or_create_session(&state, &params.path, None)?;
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
  let indexer_lock = indexer.lock().map_err(|e| e.to_string())?;

  for msg in rx2.iter() {
    match msg {
      SearchMessage::ChunkResult(chunk) => {
        for result in chunk.matches {
          // 根据字节偏移量计算行号
          let line_num = indexer_lock.find_line_at_offset(result.byte_offset);

          // 获取行内容
          let (line_start, line_end) = indexer_lock
            .get_line_with_reader(line_num, &reader)
            .unwrap_or((result.byte_offset, result.byte_offset + result.match_len));

          let line_content = reader.get_chunk(line_start, line_end);

          // 计算行内匹配位置
          let match_start = result.byte_offset.saturating_sub(line_start);

          matches.push(SearchMatch {
            line_number: line_num + 1, // 行号从 1 开始
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
  state: State<'_, AppState>,
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
  let encoding = get_encoding(Some(encoding_name));

  // 创建临时文件
  let temp_path = path.with_extension(format!(
    "{}.tmp_replace",
    path.file_name().unwrap().to_string_lossy()
  ));

  // 执行流式替换
  let count = perform_streaming_replace(
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

fn perform_streaming_replace(
  input_path: &Path,
  output_path: &Path,
  search: &str,
  replace: &str,
  replace_all: bool,
  case_sensitive: bool,
  encoding: &'static Encoding,
) -> std::io::Result<u32> {
  if search.is_empty() {
    // 无搜索内容,直接复制文件
    fs::copy(input_path, output_path)?;
    return Ok(0);
  }

  let input_file = File::open(input_path)?;
  let decoder = DecodeReaderBytesBuilder::new()
    .encoding(Some(encoding))
    .build(input_file);

  let reader = BufReader::new(decoder);
  let output_file = File::create(output_path)?;
  let mut writer = BufWriter::new(output_file);

  let mut count = 0u32;
  let mut replaced_first = false;

  for line_result in reader.lines() {
    let line = line_result?;
    let new_line = if !replaced_first || replace_all {
      let (processed, did_replace) = replace_in_line(
        &line,
        search,
        replace,
        replace_all,
        case_sensitive,
        &mut replaced_first,
      );
      if did_replace {
        count += 1;
      }
      processed
    } else {
      line
    };
    writeln!(writer, "{}", new_line)?;
  }

  writer.flush()?;
  Ok(count)
}

fn replace_in_line(
  line: &str,
  search: &str,
  replace: &str,
  replace_all: bool,
  case_sensitive: bool,
  replaced_first: &mut bool,
) -> (String, bool) {
  if replace_all {
    if case_sensitive {
      let count = line.matches(search).count();
      let new_line = line.replace(search, replace);
      (new_line, count > 0)
    } else {
      // 大小写不敏感：逐段匹配
      let mut new_line = String::with_capacity(line.len());
      let mut last_end = 0;
      let mut found = false;
      let line_lower = line.to_lowercase();
      let search_lower = search.to_lowercase();

      for (start, _) in line_lower.match_indices(&search_lower) {
        new_line.push_str(&line[last_end..start]);
        new_line.push_str(replace);
        last_end = start + search.len();
        found = true;
      }
      new_line.push_str(&line[last_end..]);
      (new_line, found)
    }
  } else {
    // 仅替换第一个
    if *replaced_first {
      return (line.to_string(), false);
    }

    let pos = if case_sensitive {
      line.find(search)
    } else {
      let line_lower = line.to_lowercase();
      let search_lower = search.to_lowercase();
      line_lower.find(&search_lower)
    };

    if let Some(start) = pos {
      *replaced_first = true;
      let end = start + search.len();
      let new_line = [&line[..start], replace, &line[end..]].concat();
      (new_line, true)
    } else {
      (line.to_string(), false)
    }
  }
}

/// 关闭文件(清理缓存)
#[tauri::command]
pub fn close_file(state: tauri::State<'_, AppState>, path: String) -> Result<(), String> {
  let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
  sessions.remove(&path);
  Ok(())
}

/// 获取行内容(单行)
#[tauri::command]
pub async fn get_line(
  state: tauri::State<'_, AppState>,
  path: String,
  line_number: usize,
) -> Result<String, String> {
  let session = get_or_create_session(&state, &path, None)?;
  let reader = session.reader;
  let indexer = session.indexer.lock().map_err(|e| e.to_string())?;

  // 行号从 1 开始,转换为 0 基索引
  let line_idx = line_number.saturating_sub(1);

  if let Some((start, end)) = indexer.get_line_range(line_idx) {
    Ok(reader.get_chunk(start, end))
  } else {
    Err(format!("行号 {} 超出范围", line_number))
  }
}

/// 获取文件统计信息
#[tauri::command]
pub async fn get_file_stats(
  state: tauri::State<'_, AppState>,
  path: String,
) -> Result<FileInfo, String> {
  let session = get_or_create_session(&state, &path, None)?;
  let reader = session.reader;
  let indexer = session.indexer.lock().map_err(|e| e.to_string())?;

  Ok(FileInfo {
    path,
    size: reader.len() as u64,
    encoding: reader.encoding().name().to_string(),
    line_count: indexer.total_lines(),
  })
}
