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

// #[tauri::command]
// fn serial_open(port_name: &'str, baud_rate: u32) -> Result<&mut serial2::SerialPort, String> {
//     let port = serial2::SerialPort::open(&port_name,baud_rate).map_err(|e| format!("Error al abrir puerto {port_name}: {e}"))?;
//     Ok(port)
// }

// #[tauri::command]
// fn read_serial_data(port: &mut serial2::SerialPort) -> Result<Vec<u8>, String> {
//     let mut buffer = [0u8; 1024];
//     let bytes_read = port.read(&mut buffer).map_err(|e| format!("Error al leer datos del puerto: {e}"))?;
//     Ok(buffer[..bytes_read].to_vec())
// }

// #[tauri::command]
// fn write_serial_data(port: &mut serial2::SerialPort, data: &[u8]) -> Result<(), String> {
//     port.write_all(data).map_err(|e| format!("Error al escribir datos en el puerto: {e}"))?;
//     Ok(())
// }

// #[tauri::command]
// fn deserialize_serial_data(data: &[u8]) -> Result<YourDataType, String> {
//     // Implement your deserialization logic here
//     // For example, if you're using JSON:
//     serde_json::from_slice(data).map_err(|e| format!("Error al deserializar datos: {e}"))
// }

// #[tauri::command]
// fn serialize_serial_data(data: &YourDataType) -> Result<Vec<u8>, String> {
//     // Implement your serialization logic here
//     // For example, if you're using JSON:
//     serde_json::to_vec(data).map_err(|e| format!("Error al serializar datos: {e}"))
// }