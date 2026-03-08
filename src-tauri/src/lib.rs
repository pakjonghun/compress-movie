mod commands;
mod ffmpeg;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_video_info,
            commands::compress_video,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
