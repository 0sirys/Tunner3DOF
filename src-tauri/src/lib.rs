mod telemetry;

use std::io::{Read, Write};
use std::sync::Mutex;
use std::time::Duration;
use tauri::State;

struct PortState(Mutex<Option<serial2::SerialPort>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PortState(Mutex::new(None)))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            serial_names,
            serial_open,
            read_serial_data,
            write_serial_data,
            deserialize_serial_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

#[tauri::command]
fn serial_names() -> Result<Vec<String>, String> {
    let ports = serial2::SerialPort::available_ports()
        .map_err(|e| format!("Error al listar puertos: {e}"))?;
    let port_names: Vec<String> = ports
        .into_iter()
        .filter_map(|p| p.to_str().map(|s| s.to_string()))
        .collect();
    Ok(port_names)
}

#[tauri::command]
fn serial_open(state: State<PortState>, port_name: String, baud_rate: u32) -> Result<u8, String> {
    let mut port = serial2::SerialPort::open(port_name.clone(), baud_rate)
        .map_err(|e| format!("Error al abrir puerto {port_name}: {e}"))?;

    // port.set_read_timeout(Duration::from_millis(500))
    //     .map_err(|e| format!("{e}"))?;
    // port.write_all(&[telemetry::MAGIC_HEADER, telemetry::CMD_SET_HOME])
    //     .map_err(|e| e.to_string())?;
    // let mut ack = [0u8; 4];
    // port.read_exact(&mut ack)
    //     .map_err(|e| format!("sin ACK:{e}"))?;

    *state
        .0
        .lock()
        .map_err(|e| format!("Mutex envenenado: {e}"))? = Some(port);
    Ok(0)
}

#[tauri::command]
fn read_serial_data(state: State<PortState>) -> Result<Vec<u8>, String> {
    let mut guard = state
        .0
        .lock()
        .map_err(|e| format!("Mutex envenenado: {e}"))?;
    let port = guard.as_mut().ok_or("puerto no abierto")?;
    let mut buffer = [0u8; 1024];
    let n = port
        .read(&mut buffer)
        .map_err(|e| format!("Error al leer datos del puerto: {e}"))?;
    Ok(buffer[..n].to_vec())
}

#[tauri::command]
fn write_serial_data(state: State<PortState>, cmd: u8, payload: Vec<u8>) -> Result<u8, String> {
    let mut guard = state
        .0
        .lock()
        .map_err(|e| format!("Mutex envenenado: {e}"))?;
    let port = guard.as_mut().ok_or("puerto no abierto")?;
    let len = payload.len() as u8;
    let chk = payload.iter().fold(cmd ^ len, |a, b| a ^ b);
    let mut frame = vec![telemetry::MAGIC_HEADER, cmd, len];
    frame.extend_from_slice(&payload);
    frame.push(chk);
    port.write_all(&frame)
        .map_err(|e| format!("Error al escribir datos en el puerto: {e}"))?;
    let mut ack = [0u8; 4];
    port.read_exact(&mut ack)
        .map_err(|e| format!("sin ACK:{e}"))?;
    if ack[0] != 0x55 || ack[1] != cmd {
        return Err("ACK no corresponde".into());
    }
    telemetry::ack_ok(ack[1], ack[2], ack[3])?;
    Ok(ack[2])
}

#[tauri::command]
fn deserialize_serial_data(data: Vec<u8>) -> Result<(), String> {
    if data.len() < 4 {
        return Err("trama muy corta".into());
    }
    let magic: u8 = data[0];
    let cmd = data[1];
    let len = data[2] as usize;
    if magic != telemetry::MAGIC_HEADER {
        return Err("MAGIC inválido".into());
    }
    if data.len() < 3 + len + 1 {
        return Err("LEN no coincide".into());
    }
    let payload = &data[3..3 + len];
    let chk_rx = data[3 + len];
    let chk = payload.iter().fold(cmd ^ len as u8, |a, b| a ^ b);
    if chk != chk_rx {
        return Err("CHK inválido".into());
    }
    Ok(())
}
