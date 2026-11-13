export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(503).json({
    success: false,
    error: '⚠️ Vercel is a static frontend host and cannot run native FFmpeg 1080p video rendering (10s execution timeout & 4.5MB upload limit). Please deploy on Render.com using Docker (100% Free) or run locally via START-APP.bat!',
  });
}

