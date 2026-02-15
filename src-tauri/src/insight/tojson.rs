use anyhow::Result;
use csv::ReaderBuilder;
use serde_json::{Value, json};

use crate::io::{csv::options::CsvOptions, excel::excel_reader::FastExcelReader};

pub fn csv_to_json(path: String, skiprows: usize) -> Result<String> {
  let n_rows = 20 + skiprows;
  let mut opts = CsvOptions::new(&path);
  opts.set_skiprows(skiprows);
  let (sep, reader) = opts.skiprows_and_delimiter()?;

  let mut rdr = ReaderBuilder::new().delimiter(sep).from_reader(reader);

  let headers = rdr.headers()?.clone();

  let mut json_records: Vec<Value> = Vec::with_capacity(n_rows);

  for result in rdr.records().take(n_rows) {
    let record = result?;

    let mut json_obj = serde_json::map::Map::new();

    for (header, value) in headers.iter().zip(record.iter()) {
      json_obj.insert(header.to_string(), json!(value));
    }

    json_records.push(json_obj.into());
  }

  let json_output = serde_json::to_string_pretty(&json_records)?;

  Ok(json_output)
}

pub fn excel_to_json(path: String, sheet_name: String, nrows: usize) -> Result<String> {
  let preview_lines = FastExcelReader::from_path(&path)?.preview_sheet(Some(&sheet_name), nrows)?;
  if preview_lines.is_empty() {
    return Ok("[]".to_string());
  }

  let mut lines = preview_lines.into_iter();
  let header_line = lines.next().unwrap(); // safety because !is_empty()
  let headers: Vec<&str> = header_line.split('|').collect();

  let mut json_records: Vec<Value> = Vec::new();

  for line in lines {
    let values: Vec<&str> = line.split('|').collect();

    // 处理列数不匹配的情况(防止panic)
    let min_len = std::cmp::min(headers.len(), values.len());
    let mut json_obj = serde_json::Map::new();

    for i in 0..min_len {
      json_obj.insert(
        headers[i].trim().to_string(),
        Value::String(values[i].trim().to_string()),
      );
    }

    // 如果 header 比 value 多，剩余字段设为空字符串
    for i in min_len..headers.len() {
      json_obj.insert(headers[i].trim().to_string(), Value::String("".to_string()));
    }

    json_records.push(Value::Object(json_obj));
  }

  let json_output = serde_json::to_string_pretty(&json_records)?;
  Ok(json_output)
}
