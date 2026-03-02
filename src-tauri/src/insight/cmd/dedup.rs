use std::{collections::HashMap, time::Instant};

use anyhow::Result;
use csv::{ByteRecord, Reader, Writer};

use crate::io::csv::{config::CsvConfigBuilder, options::CsvOptions, selection::Selection};

#[derive(Debug, Clone, Copy)]
pub enum DedupMode {
  KeepFirst,
  KeepLast,
  KeepDuplicates,
}

pub fn dedup_csv_rows<R: std::io::Read, W: std::io::Write>(
  rdr: &mut Reader<R>,
  wtr: &mut Writer<W>,
  selection: &Selection,
  mode: DedupMode,
  sorted: bool,
) -> Result<usize> {
  let headers = rdr.byte_headers()?.clone();
  wtr.write_byte_record(&headers)?;

  let mut output_rows = 0;

  match (sorted, mode) {
    (true, DedupMode::KeepFirst) => {
      let mut current_key: Option<Vec<u8>> = None;
      for result in rdr.byte_records() {
        let record = result?;
        let key = selection.get_composite_key(&record);
        if current_key.as_ref() != Some(&key) {
          wtr.write_byte_record(&record)?;
          output_rows += 1;
          current_key = Some(key);
        }
      }
    }

    (true, DedupMode::KeepLast) => {
      let mut current_key: Option<Vec<u8>> = None;
      let mut current_record: Option<ByteRecord> = None;

      for result in rdr.byte_records() {
        let record = result?;
        let key = selection.get_composite_key(&record);

        if let Some(ref ck) = current_key {
          if ck != &key {
            if let Some(r) = current_record.take() {
              wtr.write_byte_record(&r)?;
              output_rows += 1;
            }
          }
        }

        current_key = Some(key);
        current_record = Some(record);
      }

      if let Some(r) = current_record {
        wtr.write_byte_record(&r)?;
        output_rows += 1;
      }
    }

    (true, DedupMode::KeepDuplicates) => {
      let mut prev_key: Option<Vec<u8>> = None;
      let mut prev_record: Option<ByteRecord> = None;
      let mut prev_emitted = false;

      for result in rdr.byte_records() {
        let record = result?;
        let key = selection.get_composite_key(&record);

        if let Some(ref pk) = prev_key {
          if pk == &key {
            if !prev_emitted {
              if let Some(ref r) = prev_record {
                wtr.write_byte_record(r)?;
                output_rows += 1;
              }
              prev_emitted = true;
            }
            wtr.write_byte_record(&record)?;
            output_rows += 1;
          } else {
            prev_emitted = false;
          }
        }

        prev_key = Some(key);
        prev_record = Some(record);
      }
    }

    (false, DedupMode::KeepFirst) => {
      let mut seen = std::collections::HashSet::new();
      for result in rdr.byte_records() {
        let record = result?;
        let key = selection.get_composite_key(&record);
        if seen.insert(key) {
          wtr.write_byte_record(&record)?;
          output_rows += 1;
        }
      }
    }

    (false, DedupMode::KeepLast) => {
      let mut map: HashMap<Vec<u8>, ByteRecord> = HashMap::new();
      for result in rdr.byte_records() {
        let record = result?;
        let key = selection.get_composite_key(&record);
        map.insert(key, record);
      }
      for record in map.into_values() {
        wtr.write_byte_record(&record)?;
        output_rows += 1;
      }
    }

    (false, DedupMode::KeepDuplicates) => {
      let mut key_count: HashMap<Vec<u8>, usize> = HashMap::new();
      let mut all_records: Vec<ByteRecord> = Vec::new();
      let mut all_keys: Vec<Vec<u8>> = Vec::new();

      for result in rdr.byte_records() {
        let record = result?;
        let key = selection.get_composite_key(&record);
        *key_count.entry(key.clone()).or_insert(0) += 1;
        all_keys.push(key);
        all_records.push(record);
      }

      for (record, key) in all_records.into_iter().zip(all_keys) {
        if key_count[&key] > 1 {
          wtr.write_byte_record(&record)?;
          output_rows += 1;
        }
      }
    }
  }

  wtr.flush()?;
  Ok(output_rows)
}

#[derive(serde::Serialize)]
struct DedupResult {
  output_rows: usize,
  elapsed_seconds: f64,
  mode: String,
}

#[tauri::command]
pub async fn dedup(
  path: String,
  columns: Vec<String>,
  mode: String,
  skiprows: usize,
  sorted: bool,
  flexible: bool,
  quoting: bool,
) -> Result<String, String> {
  let start_time = Instant::now();

  let mut opts = CsvOptions::new(&path);
  opts.set_skiprows(skiprows);
  let (sep, reader) = opts.skiprows_and_delimiter().map_err(|e| e.to_string())?;
  let output_path = opts
    .output_path(Some("dedup"), None)
    .map_err(|e| e.to_string())?;

  let config = CsvConfigBuilder::new()
    .flexible(flexible)
    .delimiter(sep)
    .quoting(quoting)
    .build();

  let mut rdr = config.build_reader(reader);
  let mut wtr = config
    .build_writer(&output_path)
    .map_err(|e| e.to_string())?;

  let headers = rdr.byte_headers().map_err(|e| e.to_string())?.clone();

  let column_strs: Vec<&str> = columns.iter().map(|s| s.as_str()).collect();
  let selection = Selection::from_headers(&headers, &column_strs).map_err(|e| e.to_string())?;

  let dedup_mode = match mode.as_str() {
    "keep_first" => DedupMode::KeepFirst,
    "keep_last" => DedupMode::KeepLast,
    "keep_duplicates" => DedupMode::KeepDuplicates,
    _ => return Err("Invalid dedup mode".into()),
  };

  let output_rows = dedup_csv_rows(&mut rdr, &mut wtr, &selection, dedup_mode, sorted)
    .map_err(|e| e.to_string())?;

  let elapsed = Instant::now().duration_since(start_time).as_secs_f64();

  let result = DedupResult {
    output_rows,
    elapsed_seconds: elapsed,
    mode: mode.clone(),
  };

  serde_json::to_string(&result).map_err(|e| format!("{}", e))
}
