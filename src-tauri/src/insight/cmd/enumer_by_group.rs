use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Instant;

use anyhow::Result;
use tauri::AppHandle;
use tokio::sync::oneshot;

use crate::io::csv::config::CsvConfigBuilder;
use crate::io::csv::options::CsvOptions;
use crate::io::csv::selection::Selection;
use crate::utils::EventEmitter;

async fn enumerate_by_group<E, P>(
  path: P,
  progress: bool,
  quoting: bool,
  skiprows: usize,
  flexible: bool,
  index_column_name: String,
  group_by_column: String,
  emitter: E,
) -> Result<()>
where
  E: EventEmitter + Send + Sync + 'static,
  P: AsRef<Path> + Send + Sync,
{
  let mut opts = CsvOptions::new(&path);
  opts.set_skiprows(skiprows);
  let (sep, reader) = opts.skiprows_and_delimiter()?;
  let output_path = opts.output_path(Some("group_enum"), None)?;

  let total_rows = if progress {
    opts.count_lines()? - skiprows
  } else {
    0
  };
  emitter.emit_total_rows(total_rows).await?;

  let config = CsvConfigBuilder::new()
    .flexible(flexible)
    .delimiter(sep)
    .quoting(quoting)
    .build();

  let mut rdr = config.build_reader(reader);
  let mut wtr = config.build_writer(&output_path)?;

  let headers = rdr.byte_headers()?;
  let sel = Selection::from_headers(headers, &[group_by_column.as_str()][..])?;
  let group_col_idx = sel.first_indices()?;

  let mut new_headers = vec![index_column_name];
  new_headers.extend(
    headers
      .iter()
      .map(|s| String::from_utf8_lossy(s).into_owned()),
  );
  wtr.write_record(&new_headers)?;

  let rows_done = Arc::new(AtomicUsize::new(0));
  let (stop_tx, mut stop_rx) = oneshot::channel::<()>();
  let (done_tx, mut done_rx) = oneshot::channel::<usize>();

  let progress_task = if progress {
    let rows = Arc::clone(&rows_done);
    Some(tokio::spawn(async move {
      let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(500));
      loop {
        tokio::select! {
            _ = interval.tick() => {
                let n = rows.load(Ordering::Relaxed);
                let _ = emitter.emit_update_rows(n).await;
            }
            Ok(final_n) = (&mut done_rx) => {
                let _ = emitter.emit_update_rows(final_n).await;
                break;
            }
            _ = &mut stop_rx => break,
        }
      }
    }))
  } else {
    None
  };

  let process_task = tokio::task::spawn_blocking(move || {
    let mut record = csv::ByteRecord::new();
    let mut group_counter = HashMap::<String, usize>::new();

    while rdr.read_byte_record(&mut record)? {
      let group_key = String::from_utf8_lossy(&record[group_col_idx]).to_string();
      let count = group_counter.entry(group_key).or_insert(0);
      *count += 1;

      let mut out_record = vec![count.to_string()];
      out_record.extend(
        record
          .iter()
          .map(|f| String::from_utf8_lossy(f).into_owned()),
      );
      wtr.write_record(&out_record)?;
      rows_done.fetch_add(1, Ordering::Relaxed);
    }

    let final_count = rows_done.load(Ordering::Relaxed);
    let _ = done_tx.send(final_count);
    wtr.flush()?;
    Ok::<_, anyhow::Error>(())
  });

  process_task.await??;
  let _ = stop_tx.send(());
  if let Some(task) = progress_task {
    task.await?;
  }

  Ok(())
}

async fn enumerate_by_group_sorted<P>(
  path: P,
  quoting: bool,
  skiprows: usize,
  flexible: bool,
  index_column_name: String,
  group_by_column: String,
) -> Result<()>
where
  P: AsRef<Path> + Send + Sync,
{
  let mut opts = CsvOptions::new(&path);
  opts.set_skiprows(skiprows);
  let (sep, reader) = opts.skiprows_and_delimiter()?;
  let output_path = opts.output_path(Some("group_enum"), None)?;

  let config = CsvConfigBuilder::new()
    .flexible(flexible)
    .delimiter(sep)
    .quoting(quoting)
    .build();

  let mut rdr = config.build_reader(reader);
  let mut wtr = config.build_writer(&output_path)?;

  let headers = rdr.byte_headers()?;
  let sel = Selection::from_headers(headers, &[group_by_column.as_str()][..])?;
  let group_col_idx = sel.first_indices()?;

  let mut new_headers = vec![index_column_name];
  new_headers.extend(
    headers
      .iter()
      .map(|h| String::from_utf8_lossy(h).to_string()),
  );
  wtr.write_record(&new_headers)?;

  let mut record = csv::ByteRecord::new();
  let mut current_group: Option<Vec<u8>> = None;
  let mut current_count = 0;

  while rdr.read_byte_record(&mut record)? {
    let group_key = &record[group_col_idx];

    match &current_group {
      Some(prev) if prev == group_key => {
        current_count += 1;
      }
      _ => {
        // 新组开始
        current_group = Some(group_key.to_vec());
        current_count = 1;
      }
    }

    let mut out_record = csv::ByteRecord::new();
    out_record.push_field(current_count.to_string().as_bytes());
    for field in record.iter() {
      out_record.push_field(field);
    }
    wtr.write_byte_record(&out_record)?;
  }

  wtr.flush()?;
  Ok(())
}

#[tauri::command]
pub async fn enumer_by_group(
  path: String,
  progress: bool,
  quoting: bool,
  skiprows: usize,
  flexible: bool,
  index_column_name: String,
  group_by_column: String,
  sorted: bool,
  app_handle: AppHandle,
) -> Result<String, String> {
  let start_time = Instant::now();

  let result = {
    if sorted {
      enumerate_by_group_sorted(
        path,
        quoting,
        skiprows,
        flexible,
        index_column_name,
        group_by_column,
      )
      .await
    } else {
      enumerate_by_group(
        path,
        progress,
        quoting,
        skiprows,
        flexible,
        index_column_name,
        group_by_column,
        app_handle,
      )
      .await
    }
  };

  match result {
    Ok(_) => {
      let end_time = Instant::now();
      let elapsed_time = end_time.duration_since(start_time).as_secs_f64();
      Ok(format!("{elapsed_time:.0}"))
    }
    Err(err) => Err(format!("{err}")),
  }
}
