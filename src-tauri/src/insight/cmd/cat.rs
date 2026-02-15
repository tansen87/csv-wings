use std::{collections::{HashMap, HashSet}, fs::File, io::BufWriter, path::Path, time::Instant};

use anyhow::{Result, anyhow};
use csv::{ByteRecord, ReaderBuilder, WriterBuilder};
use indexmap::IndexSet;

use crate::{
  cmd::convert::excel_to_csv::{self, get_sheetname_by_filename},
  io::csv::options::CsvOptions,
  utils::WTR_BUFFER_SIZE,
};

pub async fn cat_with_csv(
  path: String,
  output_path: String,
  quoting: bool,
  skiprows: usize,
) -> Result<()> {
  let mut all_columns: IndexSet<Box<[u8]>> = IndexSet::with_capacity(16);
  let mut first_sep = None;
  let paths: Vec<&str> = path.split('|').collect();

  for (i, p) in paths.iter().enumerate() {
    let mut opts = CsvOptions::new(p);
    opts.set_skiprows(skiprows);
    let (sep, reader) = opts.skiprows_and_delimiter()?;

    if i == 0 {
      first_sep = Some(sep);
    }

    let mut rdr = ReaderBuilder::new()
      .delimiter(sep)
      .quoting(quoting)
      .from_reader(reader);

    for field in rdr.byte_headers()? {
      let fi = field.to_vec().into_boxed_slice();
      all_columns.insert(fi);
    }
  }

  let buf_wtr = BufWriter::with_capacity(WTR_BUFFER_SIZE, File::create(output_path)?);
  let mut wtr = WriterBuilder::new()
    .delimiter(first_sep.unwrap_or(b'|'))
    .from_writer(buf_wtr);

  for c in &all_columns {
    wtr.write_field(c)?;
  }
  wtr.write_byte_record(&ByteRecord::new())?;

  for p in paths.iter() {
    let mut opts = CsvOptions::new(p);
    opts.set_skiprows(skiprows);
    let (sep, reader) = opts.skiprows_and_delimiter()?;
    let mut rdr = ReaderBuilder::new()
      .delimiter(sep)
      .quoting(quoting)
      .from_reader(reader);

    let h = rdr.byte_headers()?;

    let mut columns_of_this_file =
      rustc_hash::FxHashMap::with_capacity_and_hasher(all_columns.len(), Default::default());

    for (n, field) in h.into_iter().enumerate() {
      let fi = field.to_vec().into_boxed_slice();
      if columns_of_this_file.contains_key(&fi) {
        return Err(anyhow!(
          "dulplicate column `{}` in file `{:?}`.",
          String::from_utf8_lossy(&*fi),
          p,
        ));
      }
      columns_of_this_file.insert(fi, n);
    }

    for row in rdr.byte_records() {
      let row = row?;
      for c in &all_columns {
        if let Some(idx) = columns_of_this_file.get(c) {
          if let Some(d) = row.get(*idx) {
            wtr.write_field(d)?;
          } else {
            wtr.write_field(b"")?;
          }
        } else {
          wtr.write_field(b"")?;
        }
      }
      wtr.write_byte_record(&ByteRecord::new())?;
    }
  }

  Ok(wtr.flush()?)
}

fn sanitize_name(s: &str) -> String {
  s.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\0'], "_")
    .replace(|c: char| c.is_control(), "_")
    .chars()
    .take(50)
    .collect::<String>()
    .trim_matches(|c| c == '.' || c == ' ')
    .to_string()
}

pub async fn cat_with_excel(
  path: String,
  output_path: String,
  skiprows: usize,
  quoting: bool,
  sheet_mapping: Vec<HashMap<String, String>>,
  all_sheets: bool,
) -> Result<()> {
  let temp_dir = tempfile::TempDir::new()?;
  let mut csv_paths = Vec::new();
  let paths: Vec<&str> = path.split('|').filter(|s| !s.is_empty()).collect();

  for (file_idx, &file_path) in paths.iter().enumerate() {
    let filename = Path::new(file_path)
      .file_name()
      .and_then(|n| n.to_str())
      .unwrap_or("");

    let base_name = Path::new(file_path)
      .file_stem()
      .and_then(|s| s.to_str())
      .unwrap_or("unknown");
    let clean_base = sanitize_name(base_name);

    if all_sheets {
      let sheet_names: HashSet<String> = excel_to_csv::get_all_sheetnames(file_path).await;
      let sheet_vec: Vec<String> = sheet_names.into_iter().collect();

      if sheet_vec.is_empty() {
        eprintln!("Warning: No sheets found in {}", file_path);
        continue;
      }

      for (sheet_idx, sheet_name) in sheet_vec.iter().enumerate() {
        let clean_sheet = sanitize_name(sheet_name);
        let temp_csv = temp_dir.path().join(format!(
          "{}_{}_{}_{}.csv",
          clean_base, clean_sheet, file_idx, sheet_idx
        ));

        excel_to_csv::excel_to_csv(
          file_path,
          skiprows,
          Some(sheet_name.as_str().to_string()),
          &temp_csv,
          1,
        )
        .await?;

        csv_paths.push(temp_csv);
      }
    } else {
      let sheet_name = get_sheetname_by_filename(&sheet_mapping, filename);

      let clean_sheet = sheet_name
        .as_ref()
        .map(|s| sanitize_name(s))
        .unwrap_or_else(|| "default".to_string());

      let temp_csv = temp_dir
        .path()
        .join(format!("{}_{}_{}.csv", clean_base, clean_sheet, file_idx));

      excel_to_csv::excel_to_csv(file_path, skiprows, sheet_name, &temp_csv, 1).await?;

      csv_paths.push(temp_csv);
    }
  }

  if csv_paths.is_empty() {
    return Err(anyhow::anyhow!("No CSV files generated from Excel inputs"));
  }

  let csv_path_str = csv_paths
    .iter()
    .map(|p| p.to_str().unwrap())
    .collect::<Vec<_>>()
    .join("|");

  // excel_to_csv已处理skiprows
  cat_with_csv(csv_path_str, output_path, quoting, 0).await?;

  Ok(())
}

#[tauri::command]
pub async fn cat_csv(
  path: String,
  output_path: String,
  quoting: bool,
  skiprows: usize,
) -> Result<String, String> {
  let start_time = Instant::now();
  match cat_with_csv(path, output_path, quoting, skiprows).await {
    Ok(()) => {
      let elapsed = Instant::now().duration_since(start_time).as_secs_f64();
      Ok(format!("{elapsed:.0}"))
    }
    Err(err) => Err(format!("{err}")),
  }
}

#[tauri::command]
pub async fn cat_excel(
  path: String,
  output_path: String,
  quoting: bool,
  skiprows: usize,
  sheet_mapping: Vec<HashMap<String, String>>,
  all_sheets: bool,
) -> Result<String, String> {
  let start_time = Instant::now();
  match cat_with_excel(
    path,
    output_path,
    skiprows,
    quoting,
    sheet_mapping,
    all_sheets,
  )
  .await
  {
    Ok(()) => {
      let elapsed = Instant::now().duration_since(start_time).as_secs_f64();
      Ok(format!("{elapsed:.0}"))
    }
    Err(err) => Err(format!("{err}")),
  }
}
