mod telemetry;

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};

struct PortState(Mutex<Option<serial2::SerialPort>>);
struct AckState(Mutex<HashMap<u8, u8>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PortState(Mutex::new(None)))
        .manage(AckState(Mutex::new(HashMap::new())))
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
fn serial_open(
    state: State<PortState>,
    app: AppHandle,
    port_name: String,
    baud_rate: u32,
) -> Result<u8, String> {
    let mut port = serial2::SerialPort::open(port_name.clone(), baud_rate)
        .map_err(|e| format!("Error al abrir puerto {port_name}: {e}"))?;
    port.set_read_timeout(Duration::from_millis(50))
        .map_err(|e| e.to_string())?;
    *state
        .0
        .lock()
        .map_err(|e| format!("Mutex envenenado: {e}"))? = Some(port);

    std::thread::spawn(move || {
        loop {
            let state = app.state::<PortState>();
            let mut guard = match state.0.lock() {
                Ok(g) => g,
                Err(_) => break,
            };
            let port = match guard.as_mut() {
                Some(p) => p,
                None => break,
            };
            let mut b = [0u8; 1];
            match port.read(&mut b) {
                Ok(0) => {
                    drop(guard);
                    std::thread::sleep(Duration::from_millis(5));
                    continue;
                }
                Ok(_) => {
                    if b[0] != 0x55 {
                        continue;
                    }
                    let mut hl = [0u8; 2];
                    if port.read_exact(&mut hl).is_err() {
                        continue;
                    }
                    let (cmd, sb) = (hl[0], hl[1]);
                    if cmd == telemetry::CMD_TELEM {
                        let len = sb as usize;
                        let mut payload = vec![0u8; len];
                        if port.read_exact(&mut payload).is_err() {
                            continue;
                        }
                        let mut chk = [0u8; 1];
                        if port.read_exact(&mut chk).is_err() {
                            continue;
                        }
                        drop(guard);
                        let calc = payload.iter().fold(cmd ^ sb, |a, b| a ^ b);
                        if calc != chk[0] {
                            continue;
                        }
                        let _ = app.emit("telemetry", payload);
                    } else {
                        // ACK de 4 bytes: [55][CMD][STATUS][CMD^STATUS]
                        let status = sb;
                        let mut chk = [0u8; 1];
                        if port.read_exact(&mut chk).is_err() {
                            continue;
                        }
                        drop(guard);
                        if chk[0] != (cmd ^ status) {
                            continue;
                        }
                        if let Ok(acks) = app.state::<AckState>().0.lock().as_deref_mut() {
                            acks.insert(cmd, status);
                        }
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::TimedOut => continue,
                Err(_) => break,
            }
        }
    });
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
fn write_serial_data(
    state: State<PortState>,
    acks: State<AckState>,
    cmd: u8,
    payload: Vec<u8>,
) -> Result<u8, String> {
    {
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
        // Limpia un ACK viejo del mismo comando antes de enviar
        if let Ok(m) = acks.0.lock().as_deref_mut() {
            m.remove(&cmd);
        }
        port.write_all(&frame)
            .map_err(|e| format!("Error al escribir datos en el puerto: {e}"))?;
    }
    // Espera el ACK que deposita el hilo lector (timeout 500 ms)
    let start = Instant::now();
    loop {
        if let Ok(m) = acks.0.lock().as_deref_mut() {
            if let Some(status) = m.remove(&cmd) {
                telemetry::ack_ok(cmd, status, cmd ^ status)?;
                return Ok(status);
            }
        }
        if start.elapsed() > Duration::from_millis(500) {
            return Err("sin ACK".into());
        }
        std::thread::sleep(Duration::from_millis(5));
    }
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
