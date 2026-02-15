use std::{fs::File, io::BufReader, path::Path};

use anyhow::{Result, anyhow};
use calamine::{Data, HeaderRow, Range, Reader};

pub struct ExcelReader {
  workbook: calamine::Sheets<BufReader<File>>,
}

impl ExcelReader {
  /// Opens a workbook and define the file type at runtime.
  pub fn from_path<P: AsRef<Path>>(path: P) -> Result<Self> {
    let workbook = calamine::open_workbook_auto(path)?;
    Ok(ExcelReader { workbook })
  }

  /// Get the nth worksheet. Shortcut for getting the nth
  /// sheet_name, then the corresponding worksheet.
  pub fn worksheet_range_at(&mut self, n: usize, skip_rows: u32) -> Result<Range<Data>> {
    match self
      .workbook
      .with_header_row(HeaderRow::Row(skip_rows))
      .worksheet_range_at(n)
    {
      Some(Ok(sheet_range)) => Ok(sheet_range),
      Some(Err(e)) => Err(e.into()),
      None => Err(anyhow!("Worksheet index out of bounds")),
    }
  }

  /// Get the worksheet's column names
  /// NOTICE: It will load the entire worksheet into memory
  pub fn get_column_names(&mut self, n: usize, skip_rows: u32) -> Result<Vec<String>> {
    let column_names: Vec<String> = self
      .worksheet_range_at(n, skip_rows)?
      .rows()
      .next()
      .ok_or(anyhow!("No data"))?
      .iter()
      .map(|cell| cell.to_string())
      .collect();

    Ok(column_names)
  }
}

pub struct FastExcelReader {
  fast_workbook: xl::Workbook,
}

impl FastExcelReader {
  pub fn from_path(path: &str) -> Result<Self> {
    let fast_workbook = match xl::Workbook::new(path) {
      Ok(wb) => wb,
      Err(e) => {
        return Err(anyhow!("failed to open xlsx: {e}"));
      }
    };
    Ok(FastExcelReader { fast_workbook })
  }

  /// Get the first n rows of xlsx
  /// It's very fast
  pub fn n_rows(&mut self, n: usize) -> Result<Vec<String>> {
    let worksheets = self.fast_workbook.sheets();
    let first_sheet_name = match worksheets.by_name().get(0) {
      Some(sheet) => *sheet,
      None => "Sheet1",
    };
    let sheet = if let Some(s) = worksheets.get(first_sheet_name) {
      s
    } else {
      return Err(anyhow!("worksheet is empty"));
    };
    let nrows: Vec<String> = sheet
      .rows(&mut self.fast_workbook)
      .take(n + 1)
      .map(|row| row.to_string().replace(",", "|").replace("\"", ""))
      .collect();

    Ok(nrows)
  }
}
