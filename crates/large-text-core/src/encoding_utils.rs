pub fn is_utf16_newline(byte1: u8, byte2: u8, is_le: bool) -> bool {
    let newline = b'\n';
    if is_le {
        byte1 == newline && byte2 == 0
    } else {
        byte1 == 0 && byte2 == newline
    }
}

pub fn is_utf16_crlf(byte1: u8, byte2: u8, is_le: bool) -> bool {
    let carriage_return = b'\r';
    if is_le {
        byte1 == carriage_return && byte2 == 0
    } else {
        byte1 == 0 && byte2 == carriage_return
    }
}

pub fn get_utf16_char_size(is_utf16: bool) -> usize {
    if is_utf16 { 2 } else { 1 }
}