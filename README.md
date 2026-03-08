# Video Compressor

FFmpeg 기반 데스크톱 영상 압축 애플리케이션입니다.
드래그 앤 드롭으로 간편하게 영상을 압축할 수 있습니다.

## 주요 기능

- 드래그 앤 드롭 또는 클릭으로 영상 파일 선택
- 4단계 압축 품질 프리셋 (가벼운 압축 ~ 최대 압축)
- 실시간 압축 진행률 표시
- 압축 전후 용량 비교
- 한국어 / English 지원

## 지원 포맷

MP4, AVI, MKV, MOV, WMV, FLV, WebM, M4V, TS, MTS

## 기술 스택

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Tauri 2 (Rust)
- **영상 처리**: FFmpeg / ffprobe (sidecar)

## 개발 환경 설정

### 사전 요구사항

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10+
- [Rust](https://www.rust-lang.org/tools/install) (stable)

### 설치 및 실행

```bash
# 의존성 설치
pnpm install

# FFmpeg 바이너리 다운로드
bash scripts/download-ffmpeg.sh

# 개발 서버 실행
pnpm tauri dev
```

### 빌드

```bash
pnpm tauri build
```

## 릴리스

`v*` 태그를 푸시하면 GitHub Actions가 macOS (ARM64, x86_64), Windows (x86_64) 설치 파일을 빌드하여 Draft Release로 생성합니다.

```bash
git tag v0.1.0
git push origin v0.1.0
```

## 라이선스

MIT
