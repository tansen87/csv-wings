use std::{
  fs::File,
  path::{Path, PathBuf},
};

use anyhow::Result;

use crate::{cmd::idx::create_index, index::Indexed, io::csv::options::CsvOptions};

pub async fn ensure_indexed_csv_open<P: AsRef<Path>>(
  path: P,
  flexible: bool,
) -> Result<Indexed<File, File>> {
  let path = path.as_ref();
  let opts = CsvOptions::new(path);
  let file_name = opts.file_name()?;
  let parent = opts.parent_path()?;

  let idx_path = PathBuf::from(parent).join(format!("{}.idx", file_name));

  // 索引文件不存在则创建
  if !idx_path.exists() {
    create_index(path, true, flexible, 0).await?;
  }

  // 打开带索引的CSV
  opts
    .indexed()
    .map_err(|e| anyhow::anyhow!("No indexed file: {e}"))?
    .ok_or(anyhow::anyhow!("Failed to open indexed file."))
}

pub async fn csv_slice_to_json(
  path: String,
  flexible: bool,
  start: usize,
  end: usize,
) -> Result<String> {
  if start < 1 {
    return Err(anyhow::anyhow!("start must be at least 1"));
  }

  let mut indexed_file = ensure_indexed_csv_open(path, flexible).await?;

  let headers: Vec<String> = indexed_file
    .byte_headers()?
    .into_iter()
    .map(|field| String::from_utf8_lossy(field).to_string())
    .collect();

  // 跳转到指定记录(start是1-based数据行)
  indexed_file.seek((start - 1) as u64)?;

  let num_rows = end - start + 1;
  let mut json_records = Vec::with_capacity(num_rows);

  for r in indexed_file.byte_records().take(num_rows) {
    let record = r?;
    let mut map = serde_json::Map::new();

    for (i, field) in record.into_iter().enumerate() {
      if i < headers.len() {
        map.insert(
          headers[i].clone(),
          serde_json::Value::String(String::from_utf8_lossy(field).to_string()),
        );
      } else if flexible {
        // 处理多余字段
        map.insert(
          format!("Unnamed: {}", i),
          serde_json::Value::String(String::from_utf8_lossy(field).to_string()),
        );
      } else {
        break;
      }
    }

    json_records.push(serde_json::Value::Object(map));
  }

  let result = serde_json::json!({
      "headers": headers,
      "data": json_records,
      "rows": indexed_file.count()
  });

  Ok(serde_json::to_string(&result)?)
}

#[tauri::command]
pub async fn table_view(
  path: String,
  flexible: bool,
  start: usize,
  end: usize,
) -> Result<String, String> {
  match csv_slice_to_json(path, flexible, start, end).await {
    Ok(result) => Ok(result),
    Err(err) => Err(format!("{err}")),
  }
}
