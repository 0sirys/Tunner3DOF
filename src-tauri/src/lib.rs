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
            serial_close,
            write_serial_data,
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
    _acks: State<AckState>,
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
        log::info!("hilo vivo");
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
                    log::info!("MAGIC no llego {}", b[0]);
                    drop(guard);
                    std::thread::sleep(Duration::from_millis(5));
                    continue;
                }
                Ok(_) => {
                    if b[0] != telemetry::MAGIC_ACK && b[0] != telemetry::MAGIC_TELEM {
                        continue;
                    }
                    log::info!("MAGIC {}", b[0]);
                    let magic = b[0];
                    let mut hl = [0u8; 2];
                    if port.read_exact(&mut hl).is_err() {
                        continue;
                    }
                    let (cmd, len) = (hl[0], hl[1]);
                    if magic == telemetry::MAGIC_TELEM {
                        let mut payload = vec![0u8; len as usize];
                        if port.read_exact(&mut payload).is_err() {
                            continue;
                        }
                        let mut chk = [0u8; 1];
                        if port.read_exact(&mut chk).is_err() {
                            continue;
                        }
                        drop(guard);
                        let calc = payload.iter().fold(cmd ^ len, |a, b| a ^ b);
                        if calc != chk[0] {
                            continue;
                        }
                        match telemetry::deserialize(magic, cmd, &payload) {
                            Ok(telemetry::FrameData::Telem(t)) => {
                                let _ = app.emit("telemetry", t);
                            }
                            Ok(_) => {}
                            Err(_) => continue,
                        }
                    } else if magic == telemetry::MAGIC_ACK {
                        // ACK con LEN: [56][CMD][LEN][STATUS][CHK=CMD^LEN^STATUS], LEN=1
                        let mut payload = vec![0u8; len as usize];
                        if port.read_exact(&mut payload).is_err() {
                            continue;
                        }
                        let mut chk = [0u8; 1];
                        if port.read_exact(&mut chk).is_err() {
                            continue;
                        }
                        drop(guard);
                        let calc = payload.iter().fold(cmd ^ len, |a, b| a ^ b);
                        if calc != chk[0] {
                            continue;
                        }
                        match telemetry::deserialize(magic, cmd, &payload) {
                            Ok(telemetry::FrameData::Ack { cmd, status }) => {
                                if let Ok(acks) = app.state::<AckState>().0.lock().as_deref_mut() {
                                    acks.insert(cmd, status);
                                }
                            }
                            _ => continue,
                        }
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::TimedOut => {
                    continue;
                }
                Err(e) => {
                    log::error!("serial read err : {} ", e);
                    break;
                }
            }
        }
    });
    // Pide arranque de telemetría sin esperar ACK (temporal):
    // [55][CMD_TELEM][00][CHK=CMD_TELEM]
    {
        let mut guard = state
            .0
            .lock()
            .map_err(|e| format!("Mutex envenenado: {e}"))?;
        let port = guard.as_mut().ok_or("puerto no abierto")?;
        let cmd = telemetry::CMD_TELEM;
        port.write_all(&[telemetry::MAGIC_CMD, cmd, 0, cmd])
            .map_err(|e| format!("Error al pedir telemetría: {e}"))?;
    }
    Ok(0)
}

#[tauri::command]
fn serial_close(state: State<PortState>) -> Result<(), String> {
    *state
        .0
        .lock()
        .map_err(|e| format!("Mutex envenenado: {e}"))? = None;
    Ok(())
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
        let mut frame = vec![telemetry::MAGIC_CMD, cmd, len];
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
                telemetry::ack_ok(cmd, 1, status, cmd ^ 1 ^ status)?;
                return Ok(status);
            }
        }
        if start.elapsed() > Duration::from_millis(500) {
            return Err("sin ACK".into());
        }
        std::thread::sleep(Duration::from_millis(5));
    }
}
