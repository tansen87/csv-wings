use std::collections::HashMap;
use std::fs::{self, File};
use std::path::Path;

use anyhow::Result;
use serde::Deserialize;

use crate::io::csv::options::CsvOptions;

#[derive(Deserialize)]
pub struct Edit {
  pub line: u32, // 1-based logical line number
  pub data: HashMap<String, String>,
}

async fn csv_edit(path: String, new_headers: Vec<String>, edits: Vec<Edit>) -> Result<()> {
  let path = Path::new(&path);
  if !path.exists() {
    return Err(anyhow::anyhow!("File not found"));
  }

  let opts = CsvOptions::new(path);
  let sep = opts.get_delimiter()?;
  let mut indexed_file = opts
    .indexed()?
    .ok_or(anyhow::anyhow!("Failed to open indexed file."))?;

  let total_rows = indexed_file.count() as usize;
  let original_headers = indexed_file.byte_headers()?;

  // 验证header数量一致
  if new_headers.len() != original_headers.len() {
    return Err(anyhow::anyhow!(
      "Header count mismatch: original={}, new={}",
      original_headers.len(),
      new_headers.len()
    ));
  }

  // 构建edit_map: line -> data
  let mut edit_map: HashMap<u32, &HashMap<String, String>> = HashMap::new();
  for edit in &edits {
    if edit.line < 1 || (edit.line as usize) > total_rows {
      return Err(anyhow::anyhow!(
        "Line {} out of range [1, {}]",
        edit.line,
        total_rows
      ));
    }
    edit_map.insert(edit.line, &edit.data);
  }

  // 创建临时文件
  let temp_path = path.with_extension("csv.tmp");
  let mut wtr = csv::WriterBuilder::new()
    .delimiter(sep)
    .from_writer(File::create(&temp_path)?);

  // 写入new headers(顺序不变,仅值变)
  wtr.write_record(&new_headers)?;

  // 流式处理每一行
  let mut current_line = 1u32;
  let mut record_iter = indexed_file.byte_records();

  while current_line <= total_rows as u32 {
    match record_iter.next() {
      Some(Ok(byte_record)) => {
        if let Some(edited_data) = edit_map.get(&current_line) {
          // 重建这一行
          let original_fields: Vec<String> = byte_record
            .iter()
            .map(|f| String::from_utf8_lossy(f).to_string())
            .collect();

          let mut new_row = Vec::with_capacity(new_headers.len());
          for i in 0..new_headers.len() {
            let header_name = &new_headers[i];
            let original_value = original_fields.get(i).cloned().unwrap_or_default();

            // 如果该列被编辑,用新值;否则保留原值
            let new_value = edited_data
              .get(header_name)
              .cloned()
              .unwrap_or(original_value);

            new_row.push(new_value);
          }

          wtr.write_record(&new_row)?;
        } else {
          // 未修改:直接按原字段顺序输出(header名变了,但数据位置不变)
          let original_fields: Vec<String> = byte_record
            .iter()
            .map(|f| String::from_utf8_lossy(f).to_string())
            .collect();
          wtr.write_record(&original_fields)?;
        }
        current_line += 1;
      }
      Some(Err(e)) => {
        return Err(anyhow::anyhow!(
          "CSV read error at line {}: {}",
          current_line,
          e
        ));
      }
      None => break,
    }
  }

  wtr.flush()?;
  drop(wtr);
  fs::rename(&temp_path, path)?;

  Ok(())
}

#[tauri::command]
pub async fn table_edit(
  path: String,
  new_headers: Vec<String>,
  edits: Vec<Edit>,
) -> Result<(), String> {
  match csv_edit(path, new_headers, edits).await {
    Ok(_) => Ok(()),
    Err(err) => Err(format!("{err}")),
  }
}
