use std::path::Path;

use anyhow::Result;

use crate::{
  cmd::search::generic::{generic_multi_search, generic_multi_search_unique},
  utils::EventEmitter,
};

pub async fn equal_multi<E, P>(
  path: P,
  column: String,
  conditions: Vec<String>,
  skiprows: usize,
  quoting: bool,
  progress: bool,
  unique: bool,
  emitter: E,
) -> Result<String>
where
  E: EventEmitter + Send + Sync + 'static,
  P: AsRef<Path> + Send + Sync + 'static,
{
  let match_fn = |value: &str, condition: &String| value == condition;
  if unique {
    generic_multi_search_unique(path, column, skiprows, quoting, progress, match_fn, emitter).await
  } else {
    generic_multi_search(
      path, column, conditions, skiprows, quoting, progress, match_fn, emitter,
    )
    .await
  }
}

pub async fn contains_multi<E, P>(
  path: P,
  column: String,
  conditions: Vec<String>,
  skiprows: usize,
  quoting: bool,
  progress: bool,
  unique: bool,
  emitter: E,
) -> Result<String>
where
  E: EventEmitter + Send + Sync + 'static,
  P: AsRef<Path> + Send + Sync + 'static,
{
  let match_fn = |value: &str, condition: &String| value.contains(condition);
  if unique {
    generic_multi_search_unique(path, column, skiprows, quoting, progress, match_fn, emitter).await
  } else {
    generic_multi_search(
      path, column, conditions, skiprows, quoting, progress, match_fn, emitter,
    )
    .await
  }
}

pub async fn starts_with_multi<E, P>(
  path: P,
  column: String,
  conditions: Vec<String>,
  skiprows: usize,
  quoting: bool,
  progress: bool,
  unique: bool,
  emitter: E,
) -> Result<String>
where
  E: EventEmitter + Send + Sync + 'static,
  P: AsRef<Path> + Send + Sync + 'static,
{
  let match_fn = |value: &str, condition: &String| value.starts_with(condition);
  if unique {
    generic_multi_search_unique(path, column, skiprows, quoting, progress, match_fn, emitter).await
  } else {
    generic_multi_search(
      path, column, conditions, skiprows, quoting, progress, match_fn, emitter,
    )
    .await
  }
}

pub async fn ends_with_multi<E, P>(
  path: P,
  column: String,
  conditions: Vec<String>,
  skiprows: usize,
  quoting: bool,
  progress: bool,
  unique: bool,
  emitter: E,
) -> Result<String>
where
  E: EventEmitter + Send + Sync + 'static,
  P: AsRef<Path> + Send + Sync + 'static,
{
  let match_fn = |value: &str, conds: &String| value.ends_with(conds);
  if unique {
    generic_multi_search_unique(path, column, skiprows, quoting, progress, match_fn, emitter).await
  } else {
    generic_multi_search(
      path, column, conditions, skiprows, quoting, progress, match_fn, emitter,
    )
    .await
  }
}
