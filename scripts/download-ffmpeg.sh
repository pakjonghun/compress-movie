#!/bin/bash
set -euo pipefail

# Download static ffmpeg/ffprobe binaries for the current platform
# Usage: ./scripts/download-ffmpeg.sh [target-triple]

BINARIES_DIR="src-tauri/binaries"
mkdir -p "$BINARIES_DIR"

# Detect or use provided target triple
if [ -n "${1:-}" ]; then
    TARGET="$1"
else
    OS=$(uname -s)
    ARCH=$(uname -m)

    case "$OS" in
        Darwin)
            case "$ARCH" in
                arm64) TARGET="aarch64-apple-darwin" ;;
                x86_64) TARGET="x86_64-apple-darwin" ;;
                *) echo "Unsupported arch: $ARCH"; exit 1 ;;
            esac
            ;;
        Linux)
            case "$ARCH" in
                x86_64) TARGET="x86_64-unknown-linux-gnu" ;;
                aarch64) TARGET="aarch64-unknown-linux-gnu" ;;
                *) echo "Unsupported arch: $ARCH"; exit 1 ;;
            esac
            ;;
        MINGW*|MSYS*|CYGWIN*)
            TARGET="x86_64-pc-windows-msvc"
            ;;
        *)
            echo "Unsupported OS: $OS"
            exit 1
            ;;
    esac
fi

echo "Target: $TARGET"

FFMPEG_BIN="$BINARIES_DIR/ffmpeg-$TARGET"
FFPROBE_BIN="$BINARIES_DIR/ffprobe-$TARGET"

# Add .exe extension for Windows
case "$TARGET" in
    *windows*)
        FFMPEG_BIN="$FFMPEG_BIN.exe"
        FFPROBE_BIN="$FFPROBE_BIN.exe"
        ;;
esac

# Skip if already downloaded
if [ -f "$FFMPEG_BIN" ] && [ -f "$FFPROBE_BIN" ]; then
    echo "ffmpeg binaries already exist for $TARGET"
    exit 0
fi

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

case "$TARGET" in
    aarch64-apple-darwin|x86_64-apple-darwin)
        echo "Downloading ffmpeg for macOS ($TARGET)..."
        # Use BtbN builds for macOS
        FFMPEG_URL="https://evermeet.cx/ffmpeg/getrelease/zip"
        FFPROBE_URL="https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip"

        curl -L "$FFMPEG_URL" -o "$TMPDIR/ffmpeg.zip"
        curl -L "$FFPROBE_URL" -o "$TMPDIR/ffprobe.zip"

        unzip -o "$TMPDIR/ffmpeg.zip" -d "$TMPDIR"
        unzip -o "$TMPDIR/ffprobe.zip" -d "$TMPDIR"

        cp "$TMPDIR/ffmpeg" "$FFMPEG_BIN"
        cp "$TMPDIR/ffprobe" "$FFPROBE_BIN"
        chmod +x "$FFMPEG_BIN" "$FFPROBE_BIN"
        ;;

    x86_64-pc-windows-msvc)
        echo "Downloading ffmpeg for Windows..."
        RELEASE_URL="https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip"
        curl -L "$RELEASE_URL" -o "$TMPDIR/ffmpeg.zip"
        unzip -o "$TMPDIR/ffmpeg.zip" -d "$TMPDIR"

        FFMPEG_DIR=$(find "$TMPDIR" -name "ffmpeg-*-win64-gpl" -type d | head -1)
        cp "$FFMPEG_DIR/bin/ffmpeg.exe" "$FFMPEG_BIN"
        cp "$FFMPEG_DIR/bin/ffprobe.exe" "$FFPROBE_BIN"
        ;;

    x86_64-unknown-linux-gnu|aarch64-unknown-linux-gnu)
        echo "Downloading ffmpeg for Linux ($TARGET)..."
        if [ "$TARGET" = "aarch64-unknown-linux-gnu" ]; then
            RELEASE_URL="https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-linuxarm64-gpl.tar.xz"
        else
            RELEASE_URL="https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-linux64-gpl.tar.xz"
        fi
        curl -L "$RELEASE_URL" -o "$TMPDIR/ffmpeg.tar.xz"
        tar -xf "$TMPDIR/ffmpeg.tar.xz" -C "$TMPDIR"

        FFMPEG_DIR=$(find "$TMPDIR" -name "ffmpeg-*-gpl" -type d | head -1)
        cp "$FFMPEG_DIR/bin/ffmpeg" "$FFMPEG_BIN"
        cp "$FFMPEG_DIR/bin/ffprobe" "$FFPROBE_BIN"
        chmod +x "$FFMPEG_BIN" "$FFPROBE_BIN"
        ;;

    *)
        echo "Unsupported target: $TARGET"
        exit 1
        ;;
esac

echo "Downloaded ffmpeg binaries to $BINARIES_DIR:"
ls -lh "$FFMPEG_BIN" "$FFPROBE_BIN"
