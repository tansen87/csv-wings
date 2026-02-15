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

  /// Preview the first `n` rows of a specified sheet (or the first sheet if none given)
  pub fn preview_sheet(&mut self, sheet_name: Option<&str>, n: usize) -> Result<Vec<String>> {
    let worksheets = self.fast_workbook.sheets();
    let sheet_names = worksheets.by_name();

    // Step 1: Determine which sheet to use
    let target_sheet_name = match sheet_name {
      Some(name) => {
        // Check if the requested sheet exists
        if !sheet_names.contains(&name) {
          return Err(anyhow!(
            "Sheet '{}' not found. Available sheets: {:?}",
            name,
            sheet_names.iter().map(|s| *s).collect::<Vec<_>>()
          ));
        }
        name
      }
      None => sheet_names
        .get(0)
        .copied()
        .ok_or_else(|| anyhow!("No worksheets found in the Excel file"))?,
    };

    let sheet = worksheets
      .get(target_sheet_name)
      .ok_or_else(|| anyhow!("Failed to load sheet: {}", target_sheet_name))?;

    let nrows: Vec<String> = sheet
      .rows(&mut self.fast_workbook)
      .take(n + 1) // +1: include header as first row
      .map(|row| {
        // Optional: improve formatting (e.g., handle commas/quotes safely)
        row
          .to_string()
          .replace("|", "-")
          .replace(",", "|") // replace delimiter
          .replace("\"", "") // remove double quotes
      })
      .collect();

    Ok(nrows)
  }
}
