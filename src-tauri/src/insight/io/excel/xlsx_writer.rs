use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};

use anyhow::Result;
use csv::{Reader, StringRecord};
use rust_xlsxwriter::Workbook;

pub struct XlsxWriter {
  workbook: Workbook,
}

impl XlsxWriter {
  pub fn new() -> Self {
    Self {
      workbook: Workbook::new(),
    }
  }

  /// write csv to xlsx
  pub fn write_xlsx<P: AsRef<Path>>(
    &mut self,
    mut rdr: Reader<BufReader<Box<dyn Read + Send>>>,
    chunk_size: usize,
    output: P,
  ) -> Result<()> {
    let headers = rdr.headers()?.clone();

    let mut chunk: Vec<csv::StringRecord> = Vec::with_capacity(chunk_size);

    for result in rdr.records() {
      let record = result?;
      chunk.push(record);

      if chunk.len() >= chunk_size {
        Self::write_chunk(&mut chunk, &headers, &mut self.workbook)?;

        chunk.clear();
      }
    }

    if !chunk.is_empty() {
      Self::write_chunk(&mut chunk, &headers, &mut self.workbook)?;
    }

    Ok(self.workbook.save(output)?)
  }

  fn write_chunk<'a>(
    chunk: &mut Vec<StringRecord>,
    headers: &StringRecord,
    workbook: &mut Workbook,
  ) -> Result<()> {
    let worksheet = workbook.add_worksheet();

    for (col, col_name) in headers.iter().enumerate() {
      worksheet.write_string(0, col.try_into()?, col_name.to_string())?;
    }
    for (row, row_value) in chunk.iter().enumerate() {
      for (col, col_value) in row_value.iter().enumerate() {
        worksheet.write_string(
          (row + 1).try_into()?,
          col.try_into()?,
          col_value.to_string(),
        )?;
      }
    }

    chunk.clear();
    Ok(())
  }

  /// Splits CSV into multiple XLSX files, each with up to `chunk_size` rows.
  pub fn write_xlsx_split<P: AsRef<Path>>(
    &mut self,
    mut rdr: Reader<BufReader<Box<dyn Read + Send>>>,
    chunk_size: usize,
    output: P,
  ) -> Result<()> {
    let headers = rdr.headers()?.clone();
    let output = output.as_ref();

    let mut chunk: Vec<StringRecord> = Vec::with_capacity(chunk_size);
    let mut file_index = 0;

    for result in rdr.records() {
      let record = result?;
      chunk.push(record);

      if chunk.len() >= chunk_size {
        // Build output path like "output_0.xlsx"
        let parent = output.parent().unwrap_or(Path::new("."));
        let stem = output.file_stem().unwrap_or_default();
        let filename = format!("{}_{}.xlsx", stem.to_string_lossy(), file_index);
        let output_path = parent.join(filename);

        Self::write_chunk_to_file(&chunk, &headers, output_path)?;

        chunk.clear();
        file_index += 1;
      }
    }

    if !chunk.is_empty() {
      let parent = output.parent().unwrap_or(Path::new("."));
      let stem = output.file_stem().unwrap_or_default();
      let filename = format!("{}_{}.xlsx", stem.to_string_lossy(), file_index);
      let output_path = parent.join(filename);

      Self::write_chunk_to_file(&chunk, &headers, output_path)?;
    }

    Ok(())
  }

  /// Helper to write one chunk to a single XLSX file (kept minimal)
  fn write_chunk_to_file(
    chunk: &[StringRecord],
    headers: &StringRecord,
    output_path: PathBuf,
  ) -> Result<()> {
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    for (col, col_name) in headers.iter().enumerate() {
      worksheet.write_string(0, col.try_into()?, col_name.to_string())?;
    }

    for (row, row_value) in chunk.iter().enumerate() {
      for (col, col_value) in row_value.iter().enumerate() {
        worksheet.write_string(
          (row + 1).try_into()?,
          col.try_into()?,
          col_value.to_string(),
        )?;
      }
    }

    Ok(workbook.save(output_path)?)
  }
}
