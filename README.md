# VideoSync Studio 🎬⚡
### Frame-Accurate Automated Video Editing: Image-to-Audio Timeline Synchronization

An end-to-end full-stack web application that automates video editing by syncing multiple visual slides/images to a single voiceover audio track based on precise second-by-second timestamps.

---

## 🏗️ Architecture Overview

```
Own Editing Software/
├── backend/
│   ├── package.json
│   ├── server.js                      # Express server with REST API, SSE & Video streaming
│   ├── services/
│   │   ├── ffmpegService.js           # FFmpeg 1080p pipeline, ffprobe duration, progress parser
│   │   └── timelineParser.js          # Timestamp mapper, gap-filler, sync-lock validator
│   ├── uploads/                       # Temporary isolated storage per render job (UUID)
│   └── outputs/                       # Rendered 1080p MP4 exports
├── frontend/
│   ├── package.json
│   ├── vite.config.js                 # Proxy config forwarding /api to Express (port 5000)
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                    # Core state machine (SSE listener, polling fallback)
│       ├── index.css                  # Modern dark glassmorphic design system
│       └── components/
│           ├── AudioUploader.jsx      # Voiceover uploader with live audio player & duration badge
│           ├── ImageUploader.jsx      # Multi-image gallery with indices and auto-distribute
│           ├── TimestampEditor.jsx    # Dual-mode (Visual Table + JSON Code Editor)
│           ├── TimelineVisualizer.jsx # Proportional colored timeline track with cut boundaries
│           └── VideoPreview.jsx       # Real-time progress bar + HTML5 1080p player + MP4 download
└── package.json                       # Root script orchestrator
```

---

## ⚡ How Precise Synchronization is Guaranteed (Zero Drift)

Audio and video drift occurs when video frame counts fail to match audio sample clock rates or when variable framerate images are glued together haphazardly. This engine prevents drift via a multi-tier pipeline:

1. **Audio Probing via `ffprobe`**: The exact audio stream duration is probed down to microsecond precision (`format=duration -of default=noprint_wrappers=1:nokey=1`).
2. **Timeline Normalization (`timelineParser.js`)**:
   - Calculates duration for each cut: $\Delta t = \text{endTime} - \text{startTime}$.
   - Detects timeline gaps or initial delays and applies intelligent hold frames so the audio track never leads or lags the visuals.
   - Auto-stretches the final slide to match total voiceover duration if image timestamps end before speech ends.
3. **FFmpeg Concat Demuxer Engine**:
   - Generates an `ffconcat version 1.0` manifest with explicit `duration X.XXX` for each visual segment.
   - Employs a complex video filter:
     ```bash
     -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p"
     ```
     - **`force_original_aspect_ratio=decrease,pad=1920:1080...`**: Elegantly scales portrait, square, or wide images into full 1080p with cinematic black pillarboxing/letterboxing (no stretching or distortion).
     - **`setsar=1`**: Fixes sample aspect ratio to 1:1 square pixels.
     - **`fps=30`**: Enforces strict Constant Frame Rate (CFR) rendering.
     - **`format=yuv420p`**: Standardizes color space for 100% universal browser and mobile compatibility.
   - Pairs with `-c:v libx264 -preset fast -crf 20 -c:a aac -b:a 192k -movflags +faststart -shortest`.
   - **`-movflags +faststart`**: Relocates the `moov` atom to the head of the MP4 container, enabling instant browser streaming and seeking before the download completes.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18+ (Node v20 or v24 recommended)
- **FFmpeg & ffprobe**: Installed and available in system `PATH`. Verify via:
  ```bash
  ffmpeg -version
  ffprobe -version
  ```

### Step 1: Install Dependencies
From the project root:
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

### Step 2: Start Backend Server
In Terminal 1:
```bash
cd backend
npm run dev
# Or from root: npm run dev:backend
```
*Backend runs on `http://localhost:5000`.*

### Step 3: Start Frontend Dev Server
In Terminal 2:
```bash
cd frontend
npm run dev
# Or from root: npm run dev:frontend
```
*Frontend runs on `http://localhost:3000`.*

Open your browser at **`http://localhost:3000`**.

---

## 📋 Timestamp Data Format

The application accepts both **Visual Table edits** and **Raw JSON**. You can format timestamps in two intuitive ways:

### Format A: By Image Filename
```json
[
  { "imageName": "intro_slide.png", "start": 0.0, "end": 3.5 },
  { "imageName": "chart_breakdown.jpg", "start": 3.5, "end": 7.2 },
  { "imageName": "conclusion.png", "start": 7.2, "end": 12.0 }
]
```

### Format B: By Image Index (0-based)
```json
[
  { "imageIndex": 0, "start": 0.0, "end": 3.5 },
  { "imageIndex": 1, "start": 3.5, "end": 7.2 },
  { "imageIndex": 2, "start": 7.2, "end": 12.0 }
]
```

---

## 🔌 REST API Specification

### 1. `POST /api/render`
Initiates the video rendering job.
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `audio`: Audio file (`.mp3`, `.wav`, `.aac`, etc.)
  - `images`: One or more image files (`.png`, `.jpg`, `.jpeg`, `.webp`)
  - `timeline`: Stringified JSON timestamp array
- **Response** `202 Accepted`:
  ```json
  {
    "success": true,
    "jobId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "message": "Rendering started successfully.",
    "audioDuration": 12.0,
    "clipCount": 3,
    "warnings": []
  }
  ```

### 2. `GET /api/jobs/:jobId/events`
Server-Sent Events (SSE) stream for live progress updates:
```json
{
  "status": "processing",
  "percent": 45,
  "currentSeconds": 5.4,
  "totalDuration": 12.0,
  "fps": "85.2",
  "speed": "2.8x"
}
```

### 3. `GET /api/jobs/:jobId/status`
Polling status endpoint returning job details, warnings, and URLs.

### 4. `GET /api/jobs/:jobId/video`
Streams the rendered MP4 with full **HTTP 206 Partial Content** range seeking for HTML5 `<video>` scrubbing.

### 5. `GET /api/jobs/:jobId/download`
Direct download link with `Content-Disposition: attachment; filename="synced_video_<jobId>.mp4"`.

