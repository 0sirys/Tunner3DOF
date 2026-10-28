pub const MAGIC_CMD: u8 = 0x55;
pub const MAGIC_ACK: u8 = 0x56;
pub const MAGIC_TELEM: u8 = 0x57;
pub const CMD_SET_PID: u8 = 0x01;
pub const CMD_SET_LIM: u8 = 0x02;
pub const CMD_SET_DIR: u8 = 0x03;
pub const CMD_TGT: u8 = 0x04;
pub const CMD_SET_HOME: u8 = 0x05;
pub const CMD_RD: u8 = 0x06;
pub const CMD_SAVE: u8 = 0x07;
pub const CMD_TELEM: u8 = 0x08;
pub const CMD_WAVE: u8 = 0x09;
pub const CMD_PING: u8 = 0x0a;
pub const CMD_SET_PWM: u8 = 0x0b; // [j][min u16BE][max u16BE] décimas de %; último CMD válido

#[derive(serde::Serialize, Clone)]
pub struct Telem {
    pub pos: [u16; 3],
    pub tgt: [u16; 3],
}

pub enum FrameData {
    Telem(Telem),
    Ack { cmd: u8, status: u8 },
    Raw { cmd: u8, payload: Vec<u8> },
}

fn u16be(b: &[u8], o: usize) -> u16 {
    ((b[o] as u16) << 8) | b[o + 1] as u16
}

pub fn parse_telem(payload: &[u8]) -> Result<Telem, String> {
    if payload.len() != 12 {
        return Err("TELEM con LEN != 12".into());
    }
    Ok(Telem {
        pos: [u16be(payload, 0), u16be(payload, 4), u16be(payload, 8)],
        tgt: [u16be(payload, 2), u16be(payload, 6), u16be(payload, 10)],
    })
}

pub fn parse_ack(payload: &[u8]) -> Result<u8, String> {
    if payload.len() != 1 {
        return Err("ACK con LEN != 1".into());
    }
    Ok(payload[0])
}

/// Deserializa el payload según [MAGIC][CMD][LEN][payload], con CHK ya validado
pub fn deserialize(magic: u8, cmd: u8, payload: &[u8]) -> Result<FrameData, String> {
    match (magic, cmd) {
        (MAGIC_TELEM, CMD_TELEM) => Ok(FrameData::Telem(parse_telem(payload)?)),
        (MAGIC_ACK, _) => Ok(FrameData::Ack {
            cmd,
            status: parse_ack(payload)?,
        }),
        _ => Ok(FrameData::Raw {
            cmd,
            payload: payload.to_vec(),
        }),
    }
}

pub fn ack_ok(cmd: u8, len: u8, status: u8, chk_rx: u8) -> Result<u8, String> {
    if chk_rx != (MAGIC_ACK ^ cmd ^ len ^ status) {
        return Err("CHK ACK malo".into());
    }
    match status {
        0 => Ok(0),
        1 => Err("argumento inválido".into()),
        2 => Err("comando desconocido".into()),
        _ => Err("STATUS desconocido".into()),
    }
}
