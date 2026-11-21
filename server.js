const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { probeAudioDuration, renderVideo } = require('./services/ffmpegService');
const { parseAndGenerateTimeline } = require('./services/timelineParser');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Base directories
const BASE_UPLOADS_DIR = path.join(__dirname, 'uploads');
const BASE_OUTPUTS_DIR = path.join(__dirname, 'outputs');

if (!fs.existsSync(BASE_UPLOADS_DIR)) fs.mkdirSync(BASE_UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(BASE_OUTPUTS_DIR)) fs.mkdirSync(BASE_OUTPUTS_DIR, { recursive: true });

// Active jobs tracker
const jobs = new Map();
// SSE listeners per job
const sseClients = new Map();

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req.jobId) req.jobId = uuidv4();
    const jobUploadDir = path.join(BASE_UPLOADS_DIR, req.jobId);
    if (!fs.existsSync(jobUploadDir)) fs.mkdirSync(jobUploadDir, { recursive: true });
    cb(null, jobUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const sanitized = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e4);
    cb(null, `${sanitized}-${uniqueSuffix}${ext}`);
  },
});

// Use upload.any() to accept bulk uploads (up to 1000 files) without field name errors
const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB per file
    files: 1000,                  // up to 1000 images in bulk
  },
});

// Periodic garbage collection: prune uploads/outputs older than 2 hours
function pruneOldFiles() {
  const now = Date.now();
  const maxAgeMs = 2 * 60 * 60 * 1000;

  try {
    if (fs.existsSync(BASE_UPLOADS_DIR)) {
      const dirs = fs.readdirSync(BASE_UPLOADS_DIR);
      dirs.forEach((dir) => {
        if (dir === '.gitkeep') return;
        const fullPath = path.join(BASE_UPLOADS_DIR, dir);
        try {
          const stats = fs.statSync(fullPath);
          if (now - stats.mtimeMs > maxAgeMs) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          }
        } catch (_) {}
      });
    }

    if (fs.existsSync(BASE_OUTPUTS_DIR)) {
      const files = fs.readdirSync(BASE_OUTPUTS_DIR);
      files.forEach((file) => {
        if (file === '.gitkeep') return;
        const fullPath = path.join(BASE_OUTPUTS_DIR, file);
        try {
          const stats = fs.statSync(fullPath);
          // If it's a temporary render_* folder older than 15 mins, clean it aggressively
          if (file.startsWith('render_') && now - stats.mtimeMs > 15 * 60 * 1000) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } else if (now - stats.mtimeMs > maxAgeMs) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          }
        } catch (_) {}
      });
    }
  } catch (cleanErr) {
    console.warn('Garbage collection warning:', cleanErr.message);
  }
}

// Run immediately on boot, then every 15 minutes
pruneOldFiles();
setInterval(pruneOldFiles, 15 * 60 * 1000);

function broadcastJobProgress(jobId, data) {
  const clients = sseClients.get(jobId);
  if (clients && clients.length > 0) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    clients.forEach((client) => {
      try {
        client.write(payload);
      } catch (err) {}
    });
  }
}

// -------------------------------------------------------------
// ROUTES
// -------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * POST /api/render
 * Handles bulk images and audio voiceover.
 */
app.post('/api/render', upload.any(), async (req, res, next) => {
  const jobId = req.jobId || uuidv4();

  try {
    const allFiles = req.files || [];

    // Separate audio, logo, and images automatically by fieldname, mimetype, or extension
    const audioFiles = allFiles.filter(
      (f) =>
        f.fieldname === 'audio' ||
        f.mimetype.startsWith('audio/') ||
        /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(f.originalname)
    );

    const logoFiles = allFiles.filter(
      (f) => f.fieldname === 'logo' || f.fieldname === 'logoFile'
    );
    const logoFile = logoFiles.length > 0 ? logoFiles[0] : null;

    const imageFiles = allFiles.filter(
      (f) =>
        f.fieldname !== 'logo' &&
        f.fieldname !== 'logoFile' &&
        f.fieldname !== 'audio' &&
        (f.fieldname === 'images' ||
          f.mimetype.startsWith('image/') ||
          /\.(png|jpe?g|webp|bmp|gif|tiff)$/i.test(f.originalname))
    );

    let rawTimeline = req.body?.timeline;
    const aspectRatio = req.body?.aspectRatio || '16:9';
    const backgroundMode = req.body?.backgroundMode || 'blur';
    const removeWatermark = req.body?.removeWatermark === 'true' || req.body?.removeWatermark === true;
    const watermarkMode = req.body?.watermarkMode || 'crop';
    const logoPosition = req.body?.logoPosition || 'bottom-right';
    const logoWidth = parseInt(req.body?.logoWidth, 10) || 160;
    const transitionDuration = parseFloat(req.body?.transitionDuration) || 0.5;

    if (!imageFiles || imageFiles.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one image is required.' });
    }

    const hasAudio = audioFiles && audioFiles.length > 0;
    const audioFile = hasAudio ? audioFiles[0] : null;
    const jobDir = path.join(BASE_UPLOADS_DIR, jobId);
    const outputFilename = `video_${jobId}.mp4`;
    const outputFilePath = path.join(BASE_OUTPUTS_DIR, outputFilename);

    // Probe audio duration if audio file exists
    let audioDuration = 0;
    if (audioFile) {
      try {
        audioDuration = await probeAudioDuration(audioFile.path);
      } catch (probeErr) {
        console.warn('Audio probe warning:', probeErr.message);
      }
    }

    // If timeline is empty string or empty array string, set to null so timelineParser auto-detects timestamps from filenames
    if (!rawTimeline || rawTimeline === '[]' || rawTimeline === 'null') {
      rawTimeline = null;
    }

    // Parse and build ffconcat timeline
    const timelineResult = parseAndGenerateTimeline(
      imageFiles,
      rawTimeline,
      audioDuration,
      jobDir
    );

    const totalVideoDuration =
      hasAudio && audioDuration > 0 ? audioDuration : timelineResult.totalVisualDuration;

    const jobRecord = {
      id: jobId,
      status: 'processing',
      progress: 0,
      currentSeconds: 0,
      totalDuration: totalVideoDuration,
      aspectRatio,
      backgroundMode,
      removeWatermark,
      watermarkMode,
      transitionDuration,
      warnings: timelineResult.warnings,
      summary: timelineResult.summary,
      outputFilePath,
      outputFilename,
      videoUrl: `/api/jobs/${jobId}/video`,
      downloadUrl: `/api/jobs/${jobId}/download`,
      createdAt: new Date().toISOString(),
    };

    jobs.set(jobId, jobRecord);

    res.status(202).json({
      success: true,
      jobId,
      message: 'Rendering started successfully.',
      audioDuration: totalVideoDuration,
      clipCount: timelineResult.clips.length,
      warnings: timelineResult.warnings,
    });

    // Execute render in background
    renderVideo({
      concatFilePath: timelineResult.concatFilePath,
      clips: timelineResult.clips,
      audioFilePath: audioFile ? audioFile.path : null,
      outputFilePath,
      totalDuration: totalVideoDuration,
      aspectRatio,
      backgroundMode,
      removeWatermark,
      watermarkMode,
      logoFilePath: logoFile ? logoFile.path : null,
      logoPosition,
      logoWidth,
      transitionDuration,
      onProgress: (progressInfo) => {
        const currentJob = jobs.get(jobId);
        if (currentJob) {
          currentJob.progress = progressInfo.percent;
          currentJob.currentSeconds = progressInfo.currentSeconds;
          currentJob.fps = progressInfo.fps;
          currentJob.speed = progressInfo.speed;
        }
        broadcastJobProgress(jobId, {
          status: 'processing',
          ...progressInfo,
        });
      },
    })
      .then((result) => {
        const currentJob = jobs.get(jobId);
        if (currentJob) {
          currentJob.status = 'completed';
          currentJob.progress = 100;
          currentJob.fileSize = result.fileSize;
          currentJob.renderDurationMs = result.renderDurationMs;
          currentJob.width = result.width;
          currentJob.height = result.height;
          currentJob.completedAt = new Date().toISOString();
        }

        broadcastJobProgress(jobId, {
          status: 'completed',
          progress: 100,
          videoUrl: `/api/jobs/${jobId}/video`,
          downloadUrl: `/api/jobs/${jobId}/download`,
          fileSize: result.fileSize,
          renderDurationMs: result.renderDurationMs,
          width: result.width,
          height: result.height,
        });
      })
      .catch((renderErr) => {
        console.error(`Render failed for job ${jobId}:`, renderErr.message);
        const currentJob = jobs.get(jobId);
        if (currentJob) {
          currentJob.status = 'failed';
          currentJob.error = renderErr.message;
        }

        broadcastJobProgress(jobId, {
          status: 'failed',
          error: renderErr.message,
        });
      });
  } catch (err) {
    console.error(`Error initiating job ${jobId}:`, err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.get('/api/jobs/:jobId/status', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found.' });
  }

  res.json({
    success: true,
    job,
  });
});

app.get('/api/jobs/:jobId/events', (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!sseClients.has(jobId)) {
    sseClients.set(jobId, []);
  }
  const clientList = sseClients.get(jobId);
  clientList.push(res);

  const existingJob = jobs.get(jobId);
  if (existingJob) {
    res.write(`data: ${JSON.stringify(existingJob)}\n\n`);
  }

  req.on('close', () => {
    const list = sseClients.get(jobId) || [];
    const index = list.indexOf(res);
    if (index !== -1) {
      list.splice(index, 1);
    }
    if (list.length === 0) {
      sseClients.delete(jobId);
    }
  });
});

app.get('/api/jobs/:jobId/video', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  const videoPath = job ? job.outputFilePath : path.join(BASE_OUTPUTS_DIR, `video_${jobId}.mp4`);

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ success: false, error: 'Video file not found or still rendering.' });
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
      return;
    }

    const chunkSize = end - start + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

app.get('/api/jobs/:jobId/download', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  const videoPath = job ? job.outputFilePath : path.join(BASE_OUTPUTS_DIR, `video_${jobId}.mp4`);

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ success: false, error: 'Video file not found or still rendering.' });
  }

  const stat = fs.statSync(videoPath);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `attachment; filename="synced_video_${jobId}.mp4"`);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-cache');

  // Disable request/response timeout for large (1GB+) file transfers
  if (req.setTimeout) req.setTimeout(0);
  if (res.setTimeout) res.setTimeout(0);

  const stream = fs.createReadStream(videoPath);
  stream.on('error', (err) => {
    console.error('Download stream error:', err.message);
    if (!res.headersSent) res.status(500).send('Error streaming video file.');
  });
  stream.pipe(res);
});

// Serve frontend static build if available (Unified production deployment)
const FRONTEND_DIST = path.join(__dirname, 'dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// Top-level error handler: Guarantees ALWAYS JSON response, never HTML!
app.use((err, req, res, next) => {
  console.error('Express uncaught error handler:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'An unexpected server error occurred.',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`Video Processing Engine running on http://0.0.0.0:${PORT}`);
  console.log(`FFmpeg & ffprobe ready for high-precision timeline sync`);
  console.log(`====================================================`);
});
