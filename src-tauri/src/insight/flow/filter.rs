use std::{collections::HashSet, sync::Arc};

use anyhow::{Result, anyhow};
use csv::StringRecord;

pub fn equal(
  column: Arc<str>,
  value: Arc<str>,
  _headers: Arc<Vec<String>>,
) -> Result<Box<dyn Fn(&StringRecord, &Vec<String>) -> bool + Send + Sync>> {
  if value.contains('|') {
    let values: Vec<Arc<str>> = value
      .split('|')
      .map(|s| s.trim())
      .filter(|s| !s.is_empty())
      .collect::<HashSet<_>>()
      .into_iter()
      .map(Arc::from)
      .collect();

    let col = column.clone();
    Ok(Box::new(
      move |record: &StringRecord, headers: &Vec<String>| {
        let idx = match headers.iter().position(|h| h == col.as_ref()) {
          Some(i) => i,
          None => return false,
        };
        record
          .get(idx)
          .map(|f| values.iter().any(|val| f == val.as_ref()))
          .unwrap_or(false)
      },
    ))
  } else {
    let col = column.clone();
    let val = value.to_string();
    Ok(Box::new(
      move |record: &StringRecord, headers: &Vec<String>| {
        let idx = match headers.iter().position(|h| h == col.as_ref()) {
          Some(i) => i,
          None => return false,
        };
        record.get(idx).map_or(false, |f| f == val)
      },
    ))
  }
}

pub fn not_equal(
  column: Arc<str>,
  value: Arc<str>,
  _headers: Arc<Vec<String>>,
) -> Result<Box<dyn Fn(&StringRecord, &Vec<String>) -> bool + Send + Sync>> {
  if value.contains('|') {
    let values: Vec<Arc<str>> = value
      .split('|')
      .map(|s| s.trim())
      .filter(|s| !s.is_empty())
      .collect::<HashSet<_>>()
      .into_iter()
      .map(Arc::from)
      .collect();

    let col = column.clone();
    Ok(Box::new(
      move |record: &StringRecord, headers: &Vec<String>| {
        let idx = match headers.iter().position(|h| h == col.as_ref()) {
          Some(i) => i,
          None => return true,
        };
        record
          .get(idx)
          .map_or(true, |f| values.iter().all(|val| f != val.as_ref()))
      },
    ))
  } else {
    let col = column.clone();
    let val = value.to_string();
    Ok(Box::new(
      move |record: &StringRecord, headers: &Vec<String>| {
        let idx = match headers.iter().position(|h| h == col.as_ref()) {
          Some(i) => i,
          None => return true,
        };
        record.get(idx).map_or(true, |f| f != val)
      },
    ))
  }
}

pub fn contains(
  column: Arc<str>,
  value: Arc<str>,
  _headers: Arc<Vec<String>>,
) -> Result<Box<dyn Fn(&StringRecord, &Vec<String>) -> bool + Send + Sync>> {
  if value.contains('|') {
    let values: Vec<Arc<str>> = value
      .split('|')
      .map(|s| s.trim())
      .filter(|s| !s.is_empty())
      .collect::<HashSet<_>>()
      .into_iter()
      .map(Arc::from)
      .collect();

    let col = column.clone();
    Ok(Box::new(
      move |record: &StringRecord, headers: &Vec<String>| {
        let idx = match headers.iter().position(|h| h == col.as_ref()) {
          Some(i) => i,
          None => return false,
        };
        record
          .get(idx)
          .map(|f| values.iter().any(|val| f.contains(val.as_ref())))
          .unwrap_or(false)
      },
    ))
  } else {
    let col = column.clone();
    let val = value.to_string();
    Ok(Box::new(
      move |record: &StringRecord, headers: &Vec<String>| {
        let idx = match headers.iter().position(|h| h == col.as_ref()) {
          Some(i) => i,
          None => return false,
        };
        record.get(idx).map(|f| f.contains(&val)).unwrap_or(false)
      },
    ))
  }
}

pub fn not_contains(
  column: Arc<str>,
  value: Arc<str>,
  _headers: Arc<Vec<String>>,
) -> Result<Box<dyn Fn(&StringRecord, &Vec<String>) -> bool + Send + Sync>> {
  if value.contains('|') {
    let values: Vec<Arc<str>> = value
      .split('|')
      .map(|s| s.trim())
      .filter(|s| !s.is_empty())
      .collect::<HashSet<_>>()
      .into_iter()
      .map(Arc::from)
      .collect();

    let col = column.clone();
    Ok(Box::new(
      move |record: &StringRecord, headers: &Vec<String>| {
        let idx = match headers.iter().position(|h| h == col.as_ref()) {
          Some(i) => i,
          None => return true,
        };
        record
          .get(idx)
          .map(|f| !values.iter().any(|val| f.contains(val.as_ref())))
          .unwrap_or(true)
      },
    ))
  } else {
    let col = column.clone();
    let val = value.to_string();
    Ok(Box::new(
      move |record: &StringRecord, headers: &Vec<String>| {
        let idx = match headers.iter().position(|h| h == col.as_ref()) {
          Some(i) => i,
          None => return true,
        };
        record.get(idx).map(|f| !f.contains(&val)).unwrap_or(true)
      },
    ))
  }
}

pub fn starts_with(
  column: Arc<str>,
  value: Arc<str>,
  _headers: Arc<Vec<String>>,
) -> Result<Box<dyn Fn(&StringRecord, &Vec<String>) -> bool + Send + Sync>> {
  if value.contains('|') {
    let values: Vec<Arc<str>> = value
      .split('|')
      .map(|s| s.trim())
      .filter(|s| !s.is_empty())
      .collect::<HashSet<_>>()
      .into_iter()
      .map(Arc::from)
      .collect();

    let col = column.clone();
    Ok(Box::new(
      move |record: &StringRecord, headers: &Vec<String>| {
        let idx = match headers.iter().position(|h| h == col.as_ref()) {
          Some(i) => i,
          None => return false,
        };
        record
          .get(idx)
          .map(|f| values.iter().any(|val| f.starts_with(val.as_ref())))
          .unwrap_or(false)
      },
    ))
  } else {
    let col = column.clone();
    let val = value.to_string();
    Ok(Box::new(
      move |record: &StringRecord, headers: &Vec<String>| {
        let idx = match headers.iter().position(|h| h == col.as_ref()) {
          Some(i) => i,
          None => return false,
        };
        record
          .get(idx)
          .map(|f| f.starts_with(&val))
          .unwrap_or(false)
      },
    ))
  }
}

pub fn not_starts_with(
  column: Arc<str>,
  value: Arc<str>,
  _headers: Arc<Vec<String>>,
) -> Result<Box<dyn Fn(&StringRecord, &Vec<String>) -> bool + Send + Sync>> {
  if value.contains('|') {
    let values: Vec<Arc<str>> = value
      .split('|')
      .map(|s| s.trim())
      .filter(|s| !s.is_empty())
      .collect::<HashSet<_>>()
      .into_iter()
      .map(Arc::from)
      .collect();

    let col = column.clone();
    Ok(Box::new(
      move |record: &StringRecord, headers: &Vec<String>| {
        let idx = match headers.iter().position(|h| h == col.as_ref()) {
          Some(i) => i,
          None => return true,
        };
        record
          .get(idx)
          .map(|f| values.iter().all(|val| !f.starts_with(val.as_ref())))
          .unwrap_or(true)
      },
    ))
  } else {
    let col = column.clone();
    let val = value.to_string();
    Ok(Box::new(
      move |record: &StringRecord, headers: &Vec<String>| {
        let idx = match headers.iter().position(|h| h == col.as_ref()) {
          Some(i) => i,
          None => return true,
        };
        record
          .get(idx)
          .map(|f| !f.starts_with(&val))
          .unwrap_or(true)
      },
    ))
  }
}

pub fn ends_with(
  column: Arc<str>,
  value: Arc<str>,
  _headers: Arc<Vec<String>>,
) -> Result<Box<dyn Fn(&StringRecord, &Vec<String>) -> bool + Send + Sync>> {
  if value.contains('|') {
    let values: Vec<Arc<str>> = value
      .split('|')
      .map(|s| s.trim())
      .filter(|s| !s.is_empty())
      .collect::<HashSet<_>>()
      .into_iter()
      .map(Arc::from)
      .collect();

    let col = column.clone();
    Ok(Box::new(
      move |record: &StringRecord, headers: &Vec<String>| {
        let idx = match headers.iter().position(|h| h == col.as_ref()) {
          Some(i) => i,
          None => return false,
        };
        record
          .get(idx)
          .map(|f| values.iter().any(|val| f.ends_with(val.as_ref())))
          .unwrap_or(false)
      },
    ))
  } else {
    let col = column.clone();
    let val = value.to_string();
    Ok(Box::new(
      move |record: &StringRecord, headers: &Vec<String>| {
        let idx = match headers.iter().position(|h| h == col.as_ref()) {
          Some(i) => i,
          None => return false,
        };
        record.get(idx).map(|f| f.ends_with(&val)).unwrap_or(false)
      },
    ))
  }
}

pub fn not_ends_with(
  column: Arc<str>,
  value: Arc<str>,
  _headers: Arc<Vec<String>>,
) -> Result<Box<dyn Fn(&StringRecord, &Vec<String>) -> bool + Send + Sync>> {
  if value.contains('|') {
    let values: Vec<Arc<str>> = value
      .split('|')
      .map(|s| s.trim())
      .filter(|s| !s.is_empty())
      .collect::<HashSet<_>>()
      .into_iter()
      .map(Arc::from)
      .collect();

    let col = column.clone();
    Ok(Box::new(
      move |record: &StringRecord, headers: &Vec<String>| {
        let idx = match headers.iter().position(|h| h == col.as_ref()) {
          Some(i) => i,
          None => return true,
        };
        record
          .get(idx)
          .map(|f| values.iter().all(|val| !f.ends_with(val.as_ref())))
          .unwrap_or(true)
      },
    ))
  } else {
    let col = column.clone();
    let val = value.to_string();
    Ok(Box::new(
      move |record: &StringRecord, headers: &Vec<String>| {
        let idx = match headers.iter().position(|h| h == col.as_ref()) {
          Some(i) => i,
          None => return true,
        };
        record.get(idx).map(|f| !f.ends_with(&val)).unwrap_or(true)
      },
    ))
  }
}

pub fn is_null(
  column: Arc<str>,
  _headers: Arc<Vec<String>>,
) -> Result<Box<dyn Fn(&StringRecord, &Vec<String>) -> bool + Send + Sync>> {
  let col = column.clone();
  Ok(Box::new(
    move |record: &StringRecord, headers: &Vec<String>| {
      let idx = match headers.iter().position(|h| h == col.as_ref()) {
        Some(i) => i,
        None => return true,
      };
      record.get(idx).map_or(true, |f| f.trim().is_empty())
    },
  ))
}

pub fn is_not_null(
  column: Arc<str>,
  _headers: Arc<Vec<String>>,
) -> Result<Box<dyn Fn(&StringRecord, &Vec<String>) -> bool + Send + Sync>> {
  let col = column.clone();
  Ok(Box::new(
    move |record: &StringRecord, headers: &Vec<String>| {
      let idx = match headers.iter().position(|h| h == col.as_ref()) {
        Some(i) => i,
        None => return false,
      };
      record.get(idx).map_or(false, |f| !f.trim().is_empty())
    },
  ))
}

pub fn gt(
  column: Arc<str>,
  value: Arc<str>,
  _headers: Arc<Vec<String>>,
) -> Result<Box<dyn Fn(&StringRecord, &Vec<String>) -> bool + Send + Sync>> {
  let col = column.clone();
  let val = value
    .parse::<f64>()
    .map_err(|e| anyhow!("filter value is invalid number: {}", e))?;
  Ok(Box::new(
    move |record: &StringRecord, headers: &Vec<String>| {
      let idx = match headers.iter().position(|h| h == col.as_ref()) {
        Some(i) => i,
        None => return false,
      };
      record
        .get(idx)
        .and_then(|f| f.parse::<f64>().ok())
        .map(|f| f > val)
        .unwrap_or(false)
    },
  ))
}

pub fn ge(
  column: Arc<str>,
  value: Arc<str>,
  _headers: Arc<Vec<String>>,
) -> Result<Box<dyn Fn(&StringRecord, &Vec<String>) -> bool + Send + Sync>> {
  let col = column.clone();
  let val = value
    .parse::<f64>()
    .map_err(|e| anyhow!("filter value is invalid number: {}", e))?;
  Ok(Box::new(
    move |record: &StringRecord, headers: &Vec<String>| {
      let idx = match headers.iter().position(|h| h == col.as_ref()) {
        Some(i) => i,
        None => return false,
      };
      record
        .get(idx)
        .and_then(|f| f.parse::<f64>().ok())
        .map(|f| f >= val)
        .unwrap_or(false)
    },
  ))
}

pub fn lt(
  column: Arc<str>,
  value: Arc<str>,
  _headers: Arc<Vec<String>>,
) -> Result<Box<dyn Fn(&StringRecord, &Vec<String>) -> bool + Send + Sync>> {
  let col = column.clone();
  let val = value
    .parse::<f64>()
    .map_err(|e| anyhow!("filter value is invalid number: {}", e))?;
  Ok(Box::new(
    move |record: &StringRecord, headers: &Vec<String>| {
      let idx = match headers.iter().position(|h| h == col.as_ref()) {
        Some(i) => i,
        None => return false,
      };
      record
        .get(idx)
        .and_then(|f| f.parse::<f64>().ok())
        .map(|f| f < val)
        .unwrap_or(false)
    },
  ))
}

pub fn le(
  column: Arc<str>,
  value: Arc<str>,
  _headers: Arc<Vec<String>>,
) -> Result<Box<dyn Fn(&StringRecord, &Vec<String>) -> bool + Send + Sync>> {
  let col = column.clone();
  let val = value
    .parse::<f64>()
    .map_err(|e| anyhow!("filter value is invalid number: {}", e))?;
  Ok(Box::new(
    move |record: &StringRecord, headers: &Vec<String>| {
      let idx = match headers.iter().position(|h| h == col.as_ref()) {
        Some(i) => i,
        None => return false,
      };
      record
        .get(idx)
        .and_then(|f| f.parse::<f64>().ok())
        .map(|f| f <= val)
        .unwrap_or(false)
    },
  ))
}

pub fn between(
  column: Arc<str>,
  value: Arc<str>,
  _headers: Arc<Vec<String>>,
) -> Result<Box<dyn Fn(&StringRecord, &Vec<String>) -> bool + Send + Sync>> {
  let values: Vec<Arc<str>> = value
    .split('|')
    .map(|s| s.trim())
    .filter(|s| !s.is_empty())
    .collect::<HashSet<_>>()
    .into_iter()
    .map(Arc::from)
    .collect();
  if values.len() != 2 {
    return Err(anyhow!(
      "Between value must have two values separated by vertical line"
    ));
  }

  let col = column.clone();
  let min = values[0].clone();
  let max = values[1].clone();
  Ok(Box::new(
    move |record: &StringRecord, headers: &Vec<String>| {
      let idx = match headers.iter().position(|h| h == col.as_ref()) {
        Some(i) => i,
        None => return false,
      };
      record
        .get(idx)
        .map_or(false, |f| f >= min.as_ref() && f <= max.as_ref())
    },
  ))
}
