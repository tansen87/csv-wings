use csv::StringRecord;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Operation {
  pub op: String,
  pub mode: Option<String>,
  pub logic: Option<String>,
  pub column: Option<String>,
  pub value: Option<String>,
  pub comparand: Option<String>,
  pub replacement: Option<String>,
  pub newcol: Option<String>,
}

#[derive(Clone)]
pub struct StrOperation {
  pub column: String,
  pub mode: String,
  pub comparand: Option<String>,
  pub replacement: Option<String>,
  pub newcol: Option<String>,
}

impl StrOperation {
  pub fn produces_new_column(&self) -> bool {
    match self.mode.as_str() {
      // In-place modifications — do NOT produce new column
      "fill" | "f_fill" | "lower" | "upper" | "trim" | "ltrim" | "rtrim" | "squeeze" | "strip"
      | "replace" | "regex_replace" | "round" | "reverse" | "abs" | "neg" | "normalize" => false,
      // All others produce a new column
      _ => true,
    }
  }
}

pub struct Filter {
  pub filter: Box<dyn Fn(&StringRecord, &Vec<String>) -> bool + Send + Sync>,
  pub logic: FilterLogic,
}

#[derive(Debug, Deserialize)]
pub enum FilterLogic {
  And,
  Or,
}

impl From<&str> for FilterLogic {
  fn from(s: &str) -> Self {
    match s.to_lowercase().as_str() {
      "and" => FilterLogic::And,
      "or" => FilterLogic::Or,
      _ => FilterLogic::Or,
    }
  }
}

#[derive(Clone)]
pub enum ColumnSource {
  Original(usize),
  Dynamic(usize),
}

pub struct ProcessContext {
  pub select_columns: Option<Vec<String>>,
  pub filters: Vec<Filter>,
  pub str_ops: Vec<StrOperation>,
  pub output_column_sources: Option<Vec<ColumnSource>>,
  pub rename_columns: Vec<(String, String)>,
}

impl ProcessContext {
  pub fn new() -> Self {
    ProcessContext {
      select_columns: None,
      filters: Vec::new(),
      str_ops: Vec::new(),
      output_column_sources: None,
      rename_columns: Vec::new(),
    }
  }

  pub fn add_select(&mut self, columns: &[&str]) {
    self.select_columns = Some(columns.iter().map(|s| s.to_string()).collect());
  }

  pub fn add_filter<F>(&mut self, filter: F, logic: FilterLogic)
  where
    F: Fn(&StringRecord, &Vec<String>) -> bool + Send + Sync + 'static,
  {
    self.filters.push(Filter {
      filter: Box::new(filter),
      logic,
    });
  }

  pub fn add_str(
    &mut self,
    column: &str,
    mode: &str,
    comparand: Option<&str>,
    replacement: Option<&str>,
    newcol: Option<&str>,
  ) {
    self.str_ops.push(StrOperation {
      column: column.to_string(),
      mode: mode.to_string(),
      comparand: comparand.map(|s| s.to_string()),
      replacement: replacement.map(|s| s.to_string()),
      newcol: newcol.map(|s| s.to_string()),
    });
  }

  pub fn add_rename(&mut self, column: &str, value: &str) {
    self
      .rename_columns
      .push((column.to_string(), value.to_string()));
  }

  pub fn is_valid(&self, record: &StringRecord, headers: &Vec<String>) -> bool {
    // 没有 filter，直接通过
    if self.filters.is_empty() {
      return true;
    }

    // 分离 And 和 Or filter
    let and_filters: Vec<_> = self
      .filters
      .iter()
      .filter(|f| matches!(f.logic, FilterLogic::And))
      .collect();

    let or_filters: Vec<_> = self
      .filters
      .iter()
      .filter(|f| matches!(f.logic, FilterLogic::Or))
      .collect();

    // And: 所有 And filter 必须通过
    let and_passed = and_filters.iter().all(|f| (f.filter)(record, headers));

    if !and_passed {
      return false;
    }

    // Or: 至少一个 Or filter 通过(如果没有 Or filter,视为通过)
    let or_passed = or_filters.is_empty() || or_filters.iter().any(|f| (f.filter)(record, headers));

    and_passed && or_passed
  }
}
