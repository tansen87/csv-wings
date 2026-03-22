use std::{
  fs::File,
  io::{BufRead, BufReader, BufWriter, Write},
  path::Path,
  time::Instant,
};

use anyhow::{Result, anyhow};

use crate::{
  io::csv::options::CsvOptions,
  utils::{self, RDR_BUFFER_SIZE, WTR_BUFFER_SIZE},
};

pub async fn skip_csv<P>(path: P, skiprows: usize) -> Result<()>
where
  P: AsRef<Path> + Send + Sync,
{
  if skiprows < 1 {
    return Err(anyhow!("The skip rows must be greater than or equal to 1"));
  }

  let rdr = BufReader::with_capacity(RDR_BUFFER_SIZE, File::open(&path)?);

  let opts = CsvOptions::new(&path);
  let output_path = opts.output_path(Some("skip"), None)?;
  let mut wtr = BufWriter::with_capacity(WTR_BUFFER_SIZE, File::create(output_path)?);

  let mut lines = rdr.lines();

  for _ in 0..skiprows {
    let _ = lines.next();
  }

  for line in lines {
    writeln!(wtr, "{}", line?)?;
  }

  Ok(wtr.flush()?)
}

#[tauri::command]
pub async fn skip(path: String, skiprows: String) -> Result<String, String> {
  let start_time = Instant::now();

  let skiprows = utils::parse_usize(&skiprows, "skiprows")?;

  match skip_csv(path, skiprows).await {
    Ok(_) => {
      let end_time = Instant::now();
      let elapsed_time = end_time.duration_since(start_time).as_secs_f64();
      Ok(format!("{:.2}", elapsed_time))
    }
    Err(err) => Err(format!("{err}")),
  }
}
