import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { t, getDefaultLang, Lang } from "./i18n";
import "./App.css";

interface VideoInfo {
  duration_secs: number;
  width: number;
  height: number;
  file_size: number;
  file_name: string;
}

interface CompressProgress {
  percent: number;
  speed: string;
  time_elapsed: number;
}

interface CompressResult {
  original_size: number;
  compressed_size: number;
  output_path: string;
}

type AppState = "idle" | "file_selected" | "compressing" | "done" | "error";

interface QualityPreset {
  id: string;
  crf: number;
  preset: string;
  audioBitrate: string;
  labelKey: "qualityLight" | "qualityRecommended" | "qualityHigh" | "qualityMax";
  descKey: "qualityLightDesc" | "qualityRecommendedDesc" | "qualityHighDesc" | "qualityMaxDesc";
  recommended: boolean;
}

const QUALITY_PRESETS: QualityPreset[] = [
  { id: "light", crf: 20, preset: "fast", audioBitrate: "192k", labelKey: "qualityLight", descKey: "qualityLightDesc", recommended: false },
  { id: "recommended", crf: 26, preset: "fast", audioBitrate: "128k", labelKey: "qualityRecommended", descKey: "qualityRecommendedDesc", recommended: true },
  { id: "high", crf: 30, preset: "medium", audioBitrate: "96k", labelKey: "qualityHigh", descKey: "qualityHighDesc", recommended: false },
  { id: "max", crf: 36, preset: "slow", audioBitrate: "64k", labelKey: "qualityMax", descKey: "qualityMaxDesc", recommended: false },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function App() {
  const [lang, setLang] = useState<Lang>(getDefaultLang);
  const [state, setState] = useState<AppState>("idle");
  const [filePath, setFilePath] = useState<string>("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [progress, setProgress] = useState<CompressProgress>({ percent: 0, speed: "", time_elapsed: 0 });
  const [result, setResult] = useState<CompressResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("recommended");

  const handleFile = useCallback(async (path: string) => {
    try {
      setFilePath(path);
      setState("file_selected");
      const info = await invoke<VideoInfo>("get_video_info", { path });
      setVideoInfo(info);
    } catch (e) {
      setState("error");
      setErrorMsg(String(e));
    }
  }, []);

  useEffect(() => {
    const unlistenProgress = listen<CompressProgress>("compress-progress", (event) => {
      setProgress(event.payload);
    });

    const unlistenDragDrop = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        setIsDragOver(true);
      } else if (event.payload.type === "leave") {
        setIsDragOver(false);
      } else if (event.payload.type === "drop") {
        setIsDragOver(false);
        const paths = event.payload.paths;
        if (paths.length > 0) {
          handleFile(paths[0]);
        }
      }
    });

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenDragDrop.then((fn) => fn());
    };
  }, [handleFile]);

  const handleSelectFile = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        filters: [
          {
            name: "Video",
            extensions: ["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm", "m4v", "ts", "mts"],
          },
        ],
        multiple: false,
      });
      if (selected) {
        handleFile(selected as string);
      }
    } catch (e) {
      setState("error");
      setErrorMsg(String(e));
    }
  };

  const handleCompress = async () => {
    if (!filePath) return;
    const preset = QUALITY_PRESETS.find((p) => p.id === selectedPreset) ?? QUALITY_PRESETS[1];
    try {
      setState("compressing");
      setProgress({ percent: 0, speed: "", time_elapsed: 0 });
      const res = await invoke<CompressResult>("compress_video", {
        inputPath: filePath,
        crf: preset.crf,
        preset: preset.preset,
        audioBitrate: preset.audioBitrate,
      });
      setResult(res);
      setState("done");
    } catch (e) {
      setState("error");
      setErrorMsg(String(e));
    }
  };

  const handleOpenFolder = async () => {
    if (!result) return;
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(result.output_path);
    } catch {
      // fallback - ignore
    }
  };

  const handleReset = () => {
    setState("idle");
    setFilePath("");
    setVideoInfo(null);
    setProgress({ percent: 0, speed: "", time_elapsed: 0 });
    setResult(null);
    setErrorMsg("");
  };

  const toggleLang = () => setLang((l) => (l === "ko" ? "en" : "ko"));

  return (
    <main className="container">
      <div className="header">
        <h1 className="title">{t(lang, "title")}</h1>
        <button className="lang-toggle" onClick={toggleLang}>
          {lang === "ko" ? "EN" : "KO"}
        </button>
      </div>

      {state === "idle" && (
        <div
          className={`drop-zone ${isDragOver ? "drag-over" : ""}`}
          onClick={handleSelectFile}
        >
          <div className="drop-icon">🎬</div>
          <p className="drop-text">{t(lang, "dropText")}</p>
          <p className="drop-hint">{t(lang, "dropHint")}</p>
        </div>
      )}

      {state === "file_selected" && videoInfo && (
        <div className="info-card">
          <h2 className="file-name">{videoInfo.file_name}</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">{t(lang, "size")}</span>
              <span className="info-value">{formatBytes(videoInfo.file_size)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">{t(lang, "resolution")}</span>
              <span className="info-value">{videoInfo.width} x {videoInfo.height}</span>
            </div>
            <div className="info-item">
              <span className="info-label">{t(lang, "duration")}</span>
              <span className="info-value">{formatDuration(videoInfo.duration_secs)}</span>
            </div>
          </div>

          <div className="quality-section">
            <h3 className="quality-title">{t(lang, "quality")}</h3>
            <div className="quality-grid">
              {QUALITY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={`quality-option ${selectedPreset === preset.id ? "selected" : ""}`}
                  onClick={() => setSelectedPreset(preset.id)}
                >
                  <div className="quality-option-header">
                    <span className="quality-option-label">{t(lang, preset.labelKey)}</span>
                    {preset.recommended && (
                      <span className="quality-badge">{t(lang, "recommended")}</span>
                    )}
                  </div>
                  <span className="quality-option-desc">{t(lang, preset.descKey)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="actions">
            <button className="btn btn-primary" onClick={handleCompress}>{t(lang, "startCompress")}</button>
            <button className="btn btn-secondary" onClick={handleReset}>{t(lang, "cancel")}</button>
          </div>
        </div>
      )}

      {state === "compressing" && (
        <div className="progress-card">
          <h2>{t(lang, "compressing")}</h2>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="progress-info">
            <span>{progress.percent.toFixed(1)}%</span>
            {progress.speed && <span>{progress.speed}</span>}
          </div>
        </div>
      )}

      {state === "done" && result && (
        <div className="result-card">
          <h2>{t(lang, "done")}</h2>
          <div className="size-compare">
            <div className="size-item">
              <span className="size-label">{t(lang, "original")}</span>
              <span className="size-value">{formatBytes(result.original_size)}</span>
            </div>
            <div className="size-arrow">→</div>
            <div className="size-item">
              <span className="size-label">{t(lang, "compressed")}</span>
              <span className="size-value">{formatBytes(result.compressed_size)}</span>
            </div>
          </div>
          <div className="savings">
            {((1 - result.compressed_size / result.original_size) * 100).toFixed(1)}% {t(lang, "savings")}
          </div>
          <div className="actions">
            <button className="btn btn-primary" onClick={handleOpenFolder}>{t(lang, "openFolder")}</button>
            <button className="btn btn-secondary" onClick={handleReset}>{t(lang, "anotherFile")}</button>
          </div>
        </div>
      )}

      {state === "error" && (
        <div className="error-card">
          <h2>{t(lang, "error")}</h2>
          <p className="error-msg">{errorMsg}</p>
          <button className="btn btn-secondary" onClick={handleReset}>{t(lang, "retry")}</button>
        </div>
      )}
    </main>
  );
}

export default App;
