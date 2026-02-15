use std::{fs::File, io::BufWriter, time::Instant};

use anyhow::{Result, anyhow};
use csv::{ByteRecord, ReaderBuilder, WriterBuilder};
use indexmap::IndexSet;

use crate::{io::csv::options::CsvOptions, utils::WTR_BUFFER_SIZE};

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

#[tauri::command]
pub async fn concat(
  path: String,
  output_path: String,
  quoting: bool,
  skiprows: usize,
) -> Result<String, String> {
  let start_time = Instant::now();

  match cat_with_csv(path, output_path, quoting, skiprows).await {
    Ok(()) => {
      let end_time = Instant::now();
      let elapsed_time = end_time.duration_since(start_time).as_secs_f64();
      Ok(format!("{elapsed_time:.0}"))
    }
    Err(err) => Err(format!("{err}")),
  }
}
