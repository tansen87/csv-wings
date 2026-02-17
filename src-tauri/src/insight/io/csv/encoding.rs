use std::fs::File;
use std::io::Read;

use anyhow::Result;
use chardetng::EncodingDetector;
use encoding_rs::{Encoding, GBK, UTF_8, UTF_16BE, UTF_16LE};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct EncodingResult {
  pub encoding: String,
  pub confidence: f32,
  pub has_bom: bool,
}

impl EncodingResult {
  fn new(encoding: &'static Encoding, confidence: f32, has_bom: bool) -> Self {
    Self {
      encoding: encoding.name().to_string(),
      confidence,
      has_bom,
    }
  }
}

pub fn detect_encoding(path: &str, check_bom: bool) -> Result<EncodingResult> {
  let mut sample = Vec::new();
  let file = File::open(path)?;

  // 小文件读取全部,大文件读取 512KB
  let file_size = file.metadata()?.len();
  let read_size = if file_size < 1024 * 1024 {
    file_size as u64
  } else {
    512 * 1024
  };

  file.take(read_size).read_to_end(&mut sample)?;

  if sample.is_empty() {
    return Ok(EncodingResult::new(UTF_8, 0.5, false));
  }

  // BOM检测(最高优先级)
  if check_bom && sample.len() >= 2 {
    match sample.as_slice() {
      [0xEF, 0xBB, 0xBF, ..] => return Ok(EncodingResult::new(UTF_8, 1.0, true)),
      [0xFF, 0xFE, ..] => return Ok(EncodingResult::new(UTF_16LE, 1.0, true)),
      [0xFE, 0xFF, ..] => return Ok(EncodingResult::new(UTF_16BE, 1.0, true)),
      _ => {}
    }
  }

  // UTF-16检测
  if let Some((encoding, confidence)) = detect_utf16_by_nulls(&sample) {
    return Ok(EncodingResult::new(encoding, confidence, false));
  }

  // UTF-8有效性验证
  let is_valid_utf8 = std::str::from_utf8(&sample).is_ok();

  // 分析字节模式
  let gbk_pattern = count_gbk_pattern(&sample);
  let utf8_pattern = count_utf8_chinese_pattern(&sample);

  // 综合判断逻辑
  let encoding = if is_valid_utf8 {
    // 能通过 UTF-8 验证
    if utf8_pattern > 0 && gbk_pattern.count == 0 {
      // 有 UTF-8 中文特征，无 GBK 特征 → UTF-8
      UTF_8
    } else if gbk_pattern.count > 0 && !gbk_pattern.is_valid_utf8_sequence {
      // 有 GBK 特征，且不是有效的 UTF-8 序列 → GBK
      GBK
    } else if gbk_pattern.count >= 2 && gbk_pattern.count > utf8_pattern {
      // GBK 特征明显多于 UTF-8 特征 → GBK
      GBK
    } else {
      // 默认 UTF-8
      UTF_8
    }
  } else {
    // 不能通过 UTF-8 验证
    if gbk_pattern.count >= 2 {
      GBK
    } else {
      // 使用 chardetng 辅助判断
      let mut detector = EncodingDetector::new();
      detector.feed(&sample, true);
      let detected = detector.guess(None, true);

      if detected == GBK || detected == UTF_8 {
        detected
      } else {
        GBK // 中文环境 fallback
      }
    }
  };

  let confidence = calculate_confidence(
    &sample,
    encoding,
    is_valid_utf8,
    gbk_pattern.count,
    utf8_pattern,
  );
  Ok(EncodingResult::new(encoding, confidence, false))
}

/// GBK模式检测结果
struct GbkPattern {
  count: usize,
  is_valid_utf8_sequence: bool, // 这些字节是否也是有效的 UTF-8 序列
}

/// 统计GBK特征字节对(2字节中文)
fn count_gbk_pattern(sample: &[u8]) -> GbkPattern {
  let mut gbk_count = 0;
  let mut i = 0;
  let valid_utf8_seq = true;

  while i < sample.len().saturating_sub(1) {
    let b1 = sample[i];
    let b2 = sample[i + 1];

    // GBK 首字节：0x81-0xFE
    if b1 >= 0x81 && b1 <= 0xFE {
      // GBK 尾字节：0x40-0x7E 或 0x80-0xFE
      if (b2 >= 0x40 && b2 <= 0x7E) || (b2 >= 0x80 && b2 <= 0xFE) {
        // 检查这是否也是有效的 UTF-8 序列
        // UTF-8 中文应该是 3 字节：1110xxxx 10xxxxxx 10xxxxxx
        if b1 >= 0xE0 && b1 <= 0xE9 {
          // 可能是 UTF-8 首字节，检查后续字节
          if i + 2 < sample.len() {
            let b3 = sample[i + 2];
            if b2 >= 0x80 && b2 <= 0xBF && b3 >= 0x80 && b3 <= 0xBF {
              // 这是有效的 UTF-8 3 字节序列，不是 GBK
              i += 3;
              continue;
            }
          }
        }

        gbk_count += 1;
        i += 2;
        continue;
      }
    }
    i += 1;
  }

  GbkPattern {
    count: gbk_count,
    is_valid_utf8_sequence: valid_utf8_seq,
  }
}

/// 统计 UTF-8 中文特征（3 字节）
fn count_utf8_chinese_pattern(sample: &[u8]) -> usize {
  let mut utf8_count = 0;
  let mut i = 0;

  while i < sample.len() {
    let b1 = sample[i];

    // UTF-8 3 字节中文：1110xxxx 10xxxxxx 10xxxxxx
    if b1 >= 0xE0 && b1 <= 0xE9 {
      if i + 2 < sample.len() {
        let b2 = sample[i + 1];
        let b3 = sample[i + 2];

        if b2 >= 0x80 && b2 <= 0xBF && b3 >= 0x80 && b3 <= 0xBF {
          utf8_count += 1;
          i += 3;
          continue;
        }
      }
    }
    i += 1;
  }

  utf8_count
}

fn detect_utf16_by_nulls(sample: &[u8]) -> Option<(&'static Encoding, f32)> {
  if sample.len() < 4 || sample.len() % 2 != 0 {
    return None;
  }

  let total_pairs = sample.len() / 2;
  let threshold = total_pairs * 7 / 10;

  let nulls_le = sample
    .iter()
    .skip(1)
    .step_by(2)
    .filter(|&&b| b == 0)
    .count();

  let nulls_be = sample.iter().step_by(2).filter(|&&b| b == 0).count();

  if nulls_le > threshold {
    let confidence = nulls_le as f32 / total_pairs as f32;
    return Some((UTF_16LE, confidence));
  }
  if nulls_be > threshold {
    let confidence = nulls_be as f32 / total_pairs as f32;
    return Some((UTF_16BE, confidence));
  }

  None
}

fn calculate_confidence(
  sample: &[u8],
  encoding: &'static Encoding,
  is_valid_utf8: bool,
  gbk_count: usize,
  utf8_count: usize,
) -> f32 {
  let mut confidence = 0.7;

  // 样本大小因子
  let size_factor = (sample.len() as f32 / 1024.0 / 1024.0).min(1.0);
  confidence += size_factor * 0.15;

  // 根据编码类型和特征调整
  match () {
    _ if encoding == UTF_8 => {
      if is_valid_utf8 {
        confidence += 0.15;
      }
      if utf8_count > 0 && gbk_count == 0 {
        confidence += 0.1;
      }
    }
    _ if encoding == GBK => {
      if !is_valid_utf8 && gbk_count >= 2 {
        confidence += 0.2;
      } else if gbk_count > utf8_count {
        confidence += 0.1;
      } else {
        confidence -= 0.1; // 特征不明显
      }
    }
    _ if encoding == UTF_16LE || encoding == UTF_16BE => {
      confidence += 0.2;
    }
    _ => {}
  }

  confidence.clamp(0.3, 0.99)
}

/// 编码名称转 &'static Encoding
pub fn encoding_from_name(name: &str) -> Option<&'static Encoding> {
  match name {
    "UTF-8" => Some(UTF_8),
    "GBK" | "GB18030" => Some(GBK),
    "UTF-16LE" => Some(UTF_16LE),
    "UTF-16BE" => Some(UTF_16BE),
    _ => Encoding::for_label(name.as_bytes()),
  }
}
