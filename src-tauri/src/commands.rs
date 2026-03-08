use crate::ffmpeg;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

#[tauri::command]
pub async fn get_video_info(
    app: AppHandle,
    path: String,
) -> Result<ffmpeg::VideoInfo, String> {
    ffmpeg::get_video_info(&app, &path).await
}

#[tauri::command]
pub async fn compress_video(
    app: AppHandle,
    input_path: String,
    crf: u32,
    preset: String,
    audio_bitrate: String,
) -> Result<ffmpeg::CompressResult, String> {
    let input = Path::new(&input_path);
    let stem = input
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let parent = input.parent().unwrap_or_else(|| Path::new("."));
    let output_path: PathBuf = parent.join(format!("{}_compressed.mp4", stem));
    let output_str = output_path.to_string_lossy().to_string();

    let info = ffmpeg::get_video_info(&app, &input_path).await?;

    let options = ffmpeg::CompressOptions {
        crf,
        preset,
        audio_bitrate,
    };

    ffmpeg::compress_video(&app, &input_path, &output_str, info.duration_secs, &options).await
}
