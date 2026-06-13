use std::{collections::HashMap, ops::Neg, path::Path, time::Instant};

use anyhow::{Result, anyhow};
use cpc::{eval, units::Unit};
use dynfmt::Format;
use regex::Regex;
use smallvec::SmallVec;

use crate::io::csv::{config::CsvConfigBuilder, options::CsvOptions};

#[macro_export]
macro_rules! regex_oncelock {
  ($re:literal $(,)?) => {{
    static RE: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    #[allow(clippy::regex_creation_in_loops)] // false positive as we use oncelock
    RE.get_or_init(|| regex::Regex::new($re).expect("Invalid regex"))
  }};
}

#[derive(Clone, PartialEq)]
enum Operations {
  Copy,
  Len,
  Lower,
  Upper,
  Trim,
  Ltrim,
  Rtrim,
  Replace,
  Round,
  Squeeze,
  Strip,
  Reverse,
  Abs,
  Neg,
  Normalize,
}

impl Operations {
  fn from_str(op: &str) -> Result<Self> {
    match op.to_lowercase().as_str() {
      "copy" => Ok(Operations::Copy),
      "len" => Ok(Operations::Len),
      "lower" => Ok(Operations::Lower),
      "upper" => Ok(Operations::Upper),
      "trim" => Ok(Operations::Trim),
      "ltrim" => Ok(Operations::Ltrim),
      "rtrim" => Ok(Operations::Rtrim),
      "replace" => Ok(Operations::Replace),
      "round" => Ok(Operations::Round),
      "squeeze" => Ok(Operations::Squeeze),
      "strip" => Ok(Operations::Strip),
      "reverse" => Ok(Operations::Reverse),
      "abs" => Ok(Operations::Abs),
      "neg" => Ok(Operations::Neg),
      "normalize" => Ok(Operations::Normalize),
      _ => Ok(Operations::Copy),
    }
  }
}

#[derive(PartialEq)]
enum ApplyCmd {
  Operations,
  CalcConv,
  Cat,
}

fn trim_bytes(s: &[u8]) -> &[u8] {
  let start = s
    .iter()
    .position(|&c| !c.is_ascii_whitespace())
    .unwrap_or(s.len());
  let end = s
    .iter()
    .rposition(|&c| !c.is_ascii_whitespace())
    .map_or(0, |i| i + 1);
  &s[start..end]
}

fn trim_start_bytes(s: &[u8]) -> &[u8] {
  let start = s
    .iter()
    .position(|&c| !c.is_ascii_whitespace())
    .unwrap_or(s.len());
  &s[start..]
}

fn trim_end_bytes(s: &[u8]) -> &[u8] {
  let end = s
    .iter()
    .rposition(|&c| !c.is_ascii_whitespace())
    .map_or(0, |i| i + 1);
  &s[..end]
}

fn strip_newlines_bytes(s: &[u8]) -> Vec<u8> {
  s.iter()
    .filter(|&&c| c != b'\r' && c != b'\n')
    .cloned()
    .collect()
}

fn squeeze_bytes(s: &[u8]) -> Vec<u8> {
  let trimmed = trim_bytes(s);
  if trimmed.is_empty() {
    return Vec::new();
  }

  let mut result = Vec::with_capacity(trimmed.len());
  let mut in_whitespace = false;

  for &c in trimmed {
    if c.is_ascii_whitespace() {
      if !in_whitespace {
        result.push(b' ');
        in_whitespace = true;
      }
    } else {
      result.push(c);
      in_whitespace = false;
    }
  }

  result
}

fn reverse_bytes(s: &[u8]) -> Vec<u8> {
  let mut result = s.to_vec();
  result.reverse();
  result
}

fn round_num(dec_f64: f64, places: u32) -> String {
  use rust_decimal::{Decimal, RoundingStrategy};

  if places == 9999 {
    return ryu::Buffer::new().format(dec_f64).to_owned();
  }

  let Some(dec_num) = Decimal::from_f64_retain(dec_f64) else {
    return String::new();
  };

  dec_num
    .round_dp_with_strategy(places, RoundingStrategy::MidpointNearestEven)
    .normalize()
    .to_string()
}

fn validate_operations(
  operations: &[&str],
  comparand: &str,
  new_column: Option<&String>,
  formatstr: &str,
) -> Result<(SmallVec<[Operations; 4]>, Option<u32>)> {
  let mut ops_vec = SmallVec::with_capacity(operations.len());
  let mut round_places = None;

  for op in operations {
    let operation = Operations::from_str(op)?;
    match operation {
      Operations::Copy | Operations::Len | Operations::Reverse => {
        if new_column.is_none() {
          return Err(anyhow!("new_column is required for {} operation.", op));
        }
      }
      Operations::Replace => {
        if comparand.is_empty() {
          return Err(anyhow!("comparand is required for replace operation."));
        }
      }
      Operations::Round => {
        round_places = Some(formatstr.parse::<u32>().unwrap_or(2));
      }
      _ => {}
    }
    ops_vec.push(operation);
  }

  Ok((ops_vec, round_places))
}

fn apply_operations_bytes(
  ops_vec: &SmallVec<[Operations; 4]>,
  cell: &[u8],
  comparand: &[u8],
  replacement: &[u8],
  round_places: Option<u32>,
) -> Vec<u8> {
  let ops_count = ops_vec.len();

  if ops_count == 1 {
    return match ops_vec[0] {
      Operations::Trim => trim_bytes(cell).to_vec(),
      Operations::Ltrim => trim_start_bytes(cell).to_vec(),
      Operations::Rtrim => trim_end_bytes(cell).to_vec(),
      Operations::Strip => strip_newlines_bytes(cell),
      Operations::Squeeze => squeeze_bytes(cell),
      Operations::Lower => {
        if let Ok(s) = std::str::from_utf8(cell) {
          s.to_lowercase().as_bytes().to_vec()
        } else {
          cell.to_vec()
        }
      }
      Operations::Upper => {
        if let Ok(s) = std::str::from_utf8(cell) {
          s.to_uppercase().as_bytes().to_vec()
        } else {
          cell.to_vec()
        }
      }
      Operations::Len => itoa::Buffer::new().format(cell.len()).as_bytes().to_vec(),
      Operations::Reverse => reverse_bytes(cell),
      Operations::Abs
      | Operations::Neg
      | Operations::Round
      | Operations::Normalize
      | Operations::Replace
      | Operations::Copy => cell.to_vec(),
    };
  }

  let mut result = cell.to_vec();

  for op in ops_vec {
    result = match op {
      Operations::Len => itoa::Buffer::new().format(result.len()).as_bytes().to_vec(),
      Operations::Lower => {
        if let Ok(s) = std::str::from_utf8(&result) {
          s.to_lowercase().as_bytes().to_vec()
        } else {
          result
        }
      }
      Operations::Upper => {
        if let Ok(s) = std::str::from_utf8(&result) {
          s.to_uppercase().as_bytes().to_vec()
        } else {
          result
        }
      }
      Operations::Trim => trim_bytes(&result).to_vec(),
      Operations::Ltrim => trim_start_bytes(&result).to_vec(),
      Operations::Rtrim => trim_end_bytes(&result).to_vec(),
      Operations::Replace => {
        if let Ok(s) = std::str::from_utf8(&result) {
          if let Ok(c) = std::str::from_utf8(comparand) {
            if let Ok(r) = std::str::from_utf8(replacement) {
              s.replace(c, r).as_bytes().to_vec()
            } else {
              result
            }
          } else {
            result
          }
        } else {
          result
        }
      }
      Operations::Round => {
        if let Ok(s) = std::str::from_utf8(&result) {
          if let Ok(num) = s.parse::<f64>() {
            round_num(num, round_places.unwrap_or(2))
              .as_bytes()
              .to_vec()
          } else {
            result
          }
        } else {
          result
        }
      }
      Operations::Squeeze => squeeze_bytes(&result),
      Operations::Strip => strip_newlines_bytes(&result),
      Operations::Normalize => {
        if let Ok(s) = std::str::from_utf8(&result) {
          let normalizer: &'static Regex = regex_oncelock!(r"^(\d+(?:\.\d+)?)([+-])$");
          if let Some(caps) = normalizer.captures(s) {
            let number = &caps[1];
            let sign = &caps[2];
            match sign {
              "-" => format!("-{number}").as_bytes().to_vec(),
              _ => number.as_bytes().to_vec(),
            }
          } else {
            result
          }
        } else {
          result
        }
      }
      Operations::Reverse => reverse_bytes(&result),
      Operations::Abs => {
        if let Ok(s) = std::str::from_utf8(&result) {
          if let Ok(num) = s.parse::<f64>() {
            num.abs().to_string().as_bytes().to_vec()
          } else {
            result
          }
        } else {
          result
        }
      }
      Operations::Neg => {
        if let Ok(s) = std::str::from_utf8(&result) {
          if let Ok(num) = s.parse::<f64>() {
            num.neg().to_string().as_bytes().to_vec()
          } else {
            result
          }
        } else {
          result
        }
      }
      Operations::Copy => result,
    };
  }

  result
}

async fn apply_perform<P: AsRef<Path> + Send + Sync>(
  path: P,
  columns: String,
  mode: String,
  operations: &str,
  comparand: String,
  replacement: String,
  formatstr: String,
  new_column_flag: bool,
  quoting: bool,
  skiprows: usize,
  flexible: bool,
) -> Result<()> {
  let columns: Vec<&str> = columns.split('|').collect();
  if columns.is_empty() {
    return Err(anyhow!("At least one column must be specified."));
  }

  let mut opts = CsvOptions::new(&path);
  opts.set_skiprows(skiprows);
  let (sep, reader) = opts.skiprows_and_delimiter()?;
  let sep_char = sep as char;
  let output_path = opts.output_path(Some("apply"), None)?;

  let force_new_column = mode == "dynfmt" || mode == "calcconv";
  let effective_new_column = new_column_flag || force_new_column;

  let new_column: Option<String> = if effective_new_column {
    let suffix = if mode == "dynfmt" {
      "_dynfmt"
    } else if mode == "calcconv" {
      "_calcconv"
    } else {
      "_new"
    };

    Some(
      columns
        .iter()
        .map(|col| format!("{}{}", col, suffix))
        .collect::<Vec<_>>()
        .join(&sep_char.to_string()),
    )
  } else {
    None
  };

  let config = CsvConfigBuilder::new()
    .flexible(flexible)
    .delimiter(sep)
    .quoting(quoting)
    .build();

  let mut rdr = config.build_reader(reader);
  let mut wtr = config.build_writer(&output_path)?;

  let headers = rdr.byte_headers()?;

  let header_map: HashMap<_, _> = headers
    .iter()
    .enumerate()
    .map(|(i, field)| (field.to_vec(), i))
    .collect();
  let select_column_bytes: Vec<_> = columns.iter().map(|&col| col.as_bytes().to_vec()).collect();
  let column_index = select_column_bytes
    .iter()
    .map(|col_bytes| {
      header_map
        .get(col_bytes)
        .ok_or_else(|| {
          format!(
            "The column for {:?} was not found in the headers.",
            String::from_utf8_lossy(col_bytes)
          )
        })
        .map(|&idx| idx)
    })
    .collect::<Result<Vec<usize>, _>>()
    .map_err(|err| anyhow!(err))?;
  let column_index_next = *column_index.iter().next().unwrap();

  let mut headers = rdr.headers()?.clone();

  if let Some(ref new_column) = new_column {
    for col in new_column.split(sep_char) {
      headers.push_field(col);
    }
  }
  wtr.write_record(&headers)?;

  let dynfmt_template = if (mode == "calcconv") || (mode == "dynfmt") {
    let mut dynfmt_template_wrk = formatstr.clone();
    let mut dynfmt_fields = Vec::new();

    let formatstr_re: &'static Regex = crate::regex_oncelock!(r"\{(?P<key>\w+)?\}");
    for format_fields in formatstr_re.captures_iter(&formatstr) {
      dynfmt_fields.push(format_fields.name("key").unwrap().as_str());
    }
    dynfmt_fields.sort_unstable();

    for (i, field) in headers.iter().enumerate() {
      if dynfmt_fields.binary_search(&field).is_ok() {
        let field_with_curly = format!("{{{field}}}");
        let field_index = format!("{{{i}}}");
        dynfmt_template_wrk = dynfmt_template_wrk.replace(&field_with_curly, &field_index);
      }
    }

    dynfmt_template_wrk.to_string()
  } else {
    String::new()
  };

  let (mut ops_vec, mut round_places) = (SmallVec::new(), None);

  let apply_cmd = if mode == "operations" {
    let ops_list: Vec<&str> = operations.split('|').collect();
    match validate_operations(&ops_list, &comparand, new_column.as_ref(), &formatstr) {
      Ok((validated_ops, validated_places)) => {
        ops_vec = validated_ops;
        round_places = validated_places;
      }
      Err(e) => return Err(e),
    }
    ApplyCmd::Operations
  } else if mode == "calcconv" {
    ApplyCmd::CalcConv
  } else {
    ApplyCmd::Cat
  };

  let comparand_bytes = comparand.as_bytes();
  let replacement_bytes = replacement.as_bytes();

  let mut record = csv::ByteRecord::new();

  while rdr.read_byte_record(&mut record)? {
    match apply_cmd {
      ApplyCmd::Operations => {
        if new_column.is_some() {
          for &col_idx in &column_index {
            if col_idx < record.len() {
              let cell = record.get(col_idx).unwrap_or(&[]);
              let result = apply_operations_bytes(
                &ops_vec,
                cell,
                comparand_bytes,
                replacement_bytes,
                round_places,
              );
              record.push_field(&result);
            }
          }
        } else {
          let mut new_record = csv::ByteRecord::new();
          for (i, field) in record.iter().enumerate() {
            if column_index.contains(&i) {
              let result = apply_operations_bytes(
                &ops_vec,
                field,
                comparand_bytes,
                replacement_bytes,
                round_places,
              );
              new_record.push_field(&result);
            } else {
              new_record.push_field(field);
            }
          }
          record = new_record;
        }
      }
      ApplyCmd::CalcConv => {
        let result = if column_index_next >= record.len() || record[column_index_next].is_empty() {
          Vec::new()
        } else {
          let cell = String::from_utf8_lossy(&record[column_index_next]);
          let record_vec: Vec<String> = record
            .iter()
            .map(|f| String::from_utf8_lossy(f).to_string())
            .collect();

          let mut formatted = cell.to_string();
          if let Ok(f) = dynfmt::SimpleCurlyFormat.format(&dynfmt_template, &record_vec) {
            formatted = f.to_string();
          }

          let mut append_unit = false;
          let cell_for_eval = if formatted.ends_with("<UNIT>") {
            append_unit = true;
            formatted.trim_end_matches("<UNIT>")
          } else {
            &formatted
          };

          match eval(cell_for_eval, true, Unit::Celsius, false) {
            Ok(answer) => {
              if append_unit {
                format!("{} {:?}", answer.value, answer.unit).into_bytes()
              } else {
                answer.value.to_string().into_bytes()
              }
            }
            Err(e) => format!("ERROR: {e}").into_bytes(),
          }
        };
        record.push_field(&result);
      }
      ApplyCmd::Cat => {
        let cell = if column_index_next >= record.len() || record[column_index_next].is_empty() {
          Vec::new()
        } else {
          let record_vec: Vec<String> = record
            .iter()
            .map(|f| String::from_utf8_lossy(f).to_string())
            .collect();

          if let Ok(formatted) = dynfmt::SimpleCurlyFormat.format(&dynfmt_template, &record_vec) {
            formatted.to_string().into_bytes()
          } else {
            record[column_index_next].to_vec()
          }
        };
        record.push_field(&cell);
      }
    }

    wtr.write_record(&record)?;
  }

  Ok(wtr.flush()?)
}

#[tauri::command]
pub async fn apply(
  path: String,
  columns: String,
  mode: String,
  operations: String,
  comparand: String,
  replacement: String,
  formatstr: String,
  new_column: bool,
  quoting: bool,
  skiprows: usize,
  flexible: bool,
) -> Result<String, String> {
  let start_time = Instant::now();

  match apply_perform(
    path,
    columns,
    mode,
    &operations,
    comparand,
    replacement,
    formatstr,
    new_column,
    quoting,
    skiprows,
    flexible,
  )
  .await
  {
    Ok(_) => {
      let end_time = Instant::now();
      let elapsed_time = end_time.duration_since(start_time).as_secs_f64();
      Ok(format!("{elapsed_time:.2}"))
    }
    Err(err) => Err(format!("{err}")),
  }
}
