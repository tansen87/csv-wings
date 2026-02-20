use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use encoding_rs::Encoding;
use encoding_rs_io::DecodeReaderBytesBuilder;
use serde::{Deserialize, Serialize};

use large_text_core::file_reader::FileReader;
use large_text_core::line_indexer::LineIndexer;

pub const MAX_LINES_PER_REQUEST: usize = 1000;

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

pub(crate) fn get_encoding(encoding_label: Option<&str>) -> &'static Encoding {
  match encoding_label {
    Some(label) => Encoding::for_label(label.as_bytes()).unwrap_or(encoding_rs::UTF_8),
    None => encoding_rs::UTF_8,
  }
}

pub(crate) fn create_session(path: &str, encoding: Option<&str>) -> Result<FileSession, String> {
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

pub(crate) fn get_or_create_session(
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

pub(crate) fn create_session_for_path(
  path: &str,
  user_encoding: Option<&str>,
) -> Result<FileSession, String> {
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

pub(crate) fn scan_line_from_offset(reader: &Arc<FileReader>, offset: usize) -> (usize, usize) {
  // 向前找行首
  let mut start = offset;
  while start > 0 {
    let c = reader.get_chunk(start - 1, start);
    if c.is_empty() {
      break;
    }
    if c.as_bytes().get(0) == Some(&b'\n') {
      // start 已经是 \n 之后的位置，不需要 += 1
      break;
    }
    start -= 1;
  }

  // 处理 \r\n
  if start > 0 {
    let prev = reader.get_chunk(start - 1, start);
    if prev.as_bytes().get(0) == Some(&b'\r') {
      start -= 1;
    }
  }

  // 向后找行尾
  let mut end = offset;
  while end < offset + 10000 {
    let c = reader.get_chunk(end, end + 1);
    if c.is_empty() {
      break;
    }
    if c.as_bytes().get(0) == Some(&b'\n') {
      end += 1;
      break;
    }
    end += 1;
  }

  (start, end)
}

// 从采样点开始精确计数行数
pub(crate) fn count_lines_accurate(
  indexer: &Arc<Mutex<LineIndexer>>,
  reader: &Arc<FileReader>,
  offset: usize,
) -> usize {
  // 用 Indexer 找到一个参考点
  let estimated = indexer.lock().unwrap().find_line_at_offset(offset);

  // 获取参考点的行起始位置(可能不精确,但接近)
  let (est_start, _) = indexer
    .lock()
    .unwrap()
    .get_line_with_reader(estimated, reader)
    .unwrap_or((offset, offset + 1000));

  // 计算参考点和真实位置的差距
  if est_start <= offset {
    // 真实位置在参考点之后,从参考点向后计数换行符
    let chunk = reader.get_chunk(est_start, offset);
    let lines_between = chunk.matches('\n').count();
    estimated + lines_between
  } else {
    // 真实位置在参考点之前,从参考点向前计数换行符
    // 向前找,需要减去换行符数量
    let mut line_num = estimated;
    let mut pos = est_start;

    while pos > offset && line_num > 0 {
      pos -= 1;
      let c = reader.get_chunk(pos, pos + 1);
      if c.as_bytes().get(0) == Some(&b'\n') {
        line_num -= 1;
      }
    }

    line_num
  }
}

pub(crate) fn perform_streaming_replace(
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

pub(crate) fn replace_in_line(
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
