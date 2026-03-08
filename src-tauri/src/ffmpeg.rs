use regex::Regex;
use serde::Serialize;
use std::path::Path;
use tauri::AppHandle;
use tauri::Emitter;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Serialize, Clone)]
pub struct VideoInfo {
    pub duration_secs: f64,
    pub width: u32,
    pub height: u32,
    pub file_size: u64,
    pub file_name: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct CompressProgress {
    pub percent: f64,
    pub speed: String,
    pub time_elapsed: f64,
}

#[derive(Debug, Serialize, Clone)]
pub struct CompressResult {
    pub original_size: u64,
    pub compressed_size: u64,
    pub output_path: String,
}

pub struct CompressOptions {
    pub crf: u32,
    pub preset: String,
    pub audio_bitrate: String,
}

pub async fn get_video_info(app: &AppHandle, input_path: &str) -> Result<VideoInfo, String> {
    let file_size = std::fs::metadata(input_path)
        .map_err(|e| format!("Cannot find file: {}", e))?
        .len();

    let file_name = Path::new(input_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let output = app
        .shell()
        .sidecar("ffprobe")
        .map_err(|e| format!("ffprobe sidecar error: {}", e))?
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,duration",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0:s=x",
            input_path,
        ])
        .output()
        .await
        .map_err(|e| format!("ffprobe execution failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        return Err(format!("ffprobe error: {}", stderr));
    }

    let lines: Vec<&str> = stdout.trim().lines().collect();
    let mut width: u32 = 0;
    let mut height: u32 = 0;
    let mut duration_secs: f64 = 0.0;

    for line in &lines {
        let parts: Vec<&str> = line.split('x').collect();
        match parts.len() {
            3 => {
                width = parts[0].trim().parse().unwrap_or(0);
                height = parts[1].trim().parse().unwrap_or(0);
                let dur = parts[2].trim().parse::<f64>().unwrap_or(0.0);
                if dur > 0.0 {
                    duration_secs = dur;
                }
            }
            1 => {
                let dur = parts[0].trim().parse::<f64>().unwrap_or(0.0);
                if dur > 0.0 {
                    duration_secs = dur;
                }
            }
            _ => {}
        }
    }

    if width == 0 || height == 0 {
        return Err("Cannot parse video info".to_string());
    }

    Ok(VideoInfo {
        duration_secs,
        width,
        height,
        file_size,
        file_name,
    })
}

pub async fn compress_video(
    app: &AppHandle,
    input_path: &str,
    output_path: &str,
    total_duration: f64,
    options: &CompressOptions,
) -> Result<CompressResult, String> {
    let original_size = std::fs::metadata(input_path)
        .map_err(|e| format!("Cannot find file: {}", e))?
        .len();

    let crf_str = options.crf.to_string();

    let sidecar_command = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("ffmpeg sidecar error: {}", e))?
        .args([
            "-i",
            input_path,
            "-c:v",
            "libx264",
            "-crf",
            &crf_str,
            "-preset",
            &options.preset,
            "-c:a",
            "aac",
            "-b:a",
            &options.audio_bitrate,
            "-y",
            "-progress",
            "pipe:1",
            output_path,
        ]);

    let (mut rx, _child) = sidecar_command
        .spawn()
        .map_err(|e| format!("ffmpeg execution failed: {}", e))?;

    let time_re = Regex::new(r"out_time_ms=(\d+)").unwrap();
    let speed_re = Regex::new(r"speed=\s*([\d.]+)x").unwrap();
    let progress_re = Regex::new(r"progress=(\w+)").unwrap();
    let app_clone = app.clone();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);

                if let Some(caps) = time_re.captures(&line) {
                    if let Ok(time_us) = caps[1].parse::<f64>() {
                        let time_secs = time_us / 1_000_000.0;
                        let percent = if total_duration > 0.0 {
                            (time_secs / total_duration * 100.0).min(100.0)
                        } else {
                            0.0
                        };

                        let mut speed = String::new();
                        if let Some(s_caps) = speed_re.captures(&line) {
                            speed = format!("{}x", &s_caps[1]);
                        }

                        let _ = app_clone.emit(
                            "compress-progress",
                            CompressProgress {
                                percent,
                                speed,
                                time_elapsed: time_secs,
                            },
                        );
                    }
                }

                if let Some(caps) = progress_re.captures(&line) {
                    if &caps[1] == "end" {
                        let _ = app_clone.emit(
                            "compress-progress",
                            CompressProgress {
                                percent: 100.0,
                                speed: String::new(),
                                time_elapsed: total_duration,
                            },
                        );
                    }
                }
            }
            CommandEvent::Stderr(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                if let Some(caps) = time_re.captures(&line) {
                    if let Ok(time_us) = caps[1].parse::<f64>() {
                        let time_secs = time_us / 1_000_000.0;
                        let percent = if total_duration > 0.0 {
                            (time_secs / total_duration * 100.0).min(100.0)
                        } else {
                            0.0
                        };
                        let _ = app_clone.emit(
                            "compress-progress",
                            CompressProgress {
                                percent,
                                speed: String::new(),
                                time_elapsed: time_secs,
                            },
                        );
                    }
                }
                eprintln!("ffmpeg stderr: {}", line);
            }
            CommandEvent::Error(err) => {
                return Err(format!("ffmpeg error: {}", err));
            }
            CommandEvent::Terminated(status) => {
                if status.code.unwrap_or(-1) != 0 {
                    if !Path::new(output_path).exists() {
                        return Err(format!(
                            "ffmpeg terminated abnormally (code: {:?})",
                            status.code
                        ));
                    }
                }
            }
            _ => {}
        }
    }

    let compressed_size = std::fs::metadata(output_path)
        .map_err(|e| format!("Cannot verify output file: {}", e))?
        .len();

    Ok(CompressResult {
        original_size,
        compressed_size,
        output_path: output_path.to_string(),
    })
}
