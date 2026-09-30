#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        .invoke_handler(tauri::generate_handler![serial_names])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

#[tauri::command]
fn serial_names() -> Result<Vec<String>,String> {
    let ports = serial2::SerialPort::available_ports().map_err(|e| format!("Error al listar puertos: {e}"))?;
    let port_names: Vec<String> = ports.into_iter().filter_map(|p| p.to_str().map(|s| s.to_string())).collect();
    Ok(port_names)
}
