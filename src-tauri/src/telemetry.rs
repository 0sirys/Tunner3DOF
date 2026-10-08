pub const MAGIC_HEADER: u8 = 0x55;
pub const CMD_SET_PID: u8 = 0x01;
pub const CMD_SET_LIM: u8 = 0x02;
pub const CMD_SET_DIR: u8 = 0x03;
pub const CMD_TGT: u8 = 0x04;
pub const CMD_SET_HOME: u8 = 0x05;
pub const CMD_RD: u8 = 0x06;
pub const CMD_SAVE: u8 = 0x07;
pub const CMD_TELEM: u8 = 0x08;

pub fn ack_ok(cmd: u8, status: u8, chk_rx: u8) -> Result<u8, String> {
    if chk_rx != (cmd ^ status) {
        return Err("CHK ACK malo".into());
    }
    match status {
        0 => Ok(0),
        1 => Err("argumento inválido".into()),
        2 => Err("comando desconocido".into()),
        _ => Err("STATUS desconocido".into()),
    }
}
