import React from 'react';

export default function VideoPreview({
  isRendering,
  progress,
  renderError,
  videoResult,
  onGenerate,
  canGenerate,
  hasAudio,
  imageCount,
  onReset,
}) {
  const handleClick = () => {
    if (imageCount === 0) {
      alert('📁 Please upload at least one image in Step 2!');
      return;
    }
    onGenerate();
  };

  return (
    <div style={{ marginTop: '24px' }}>
      {!isRendering && !videoResult && (
        <div>
          {!hasAudio && imageCount > 0 && (
            <div
              style={{
                marginBottom: '14px',
                padding: '12px 18px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#93c5fd',
                fontSize: '13.5px',
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              💡 <strong>Voiceover audio optional:</strong> Audio voiceover sync venumna Step 1-la MP3/WAV file podunga. Illana direct-ah ippove <strong>Generate Video</strong> click panni image cuts mattum video-va render pannikkalam!
            </div>
          )}

          {hasAudio && imageCount === 0 && (
            <div
              style={{
                marginBottom: '14px',
                padding: '12px 18px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: '#fcd34d',
                fontSize: '13.5px',
                textAlign: 'center',
                fontWeight: '600',
              }}
            >
              📁 Images missing: Please upload your images in Step 2 to generate video!
            </div>
          )}

          <button
            className="btn btn-primary btn-cta"
            onClick={handleClick}
            style={{
              opacity: imageCount > 0 ? 1 : 0.6,
              cursor: imageCount > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            <span>🎬</span>
            <span>
              {imageCount === 0
                ? 'Step 2: Upload Images to Begin'
                : hasAudio
                ? `Generate Synchronized 1080p Video (${imageCount} Images + Voiceover)`
                : `Generate 1080p Video (${imageCount} Images • Timestamp Cuts)`}
            </span>
          </button>
        </div>
      )}

      {/* Progress Box */}
      {isRendering && (
        <div className="progress-card">
          <div className="progress-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="status-dot"></span>
              <strong style={{ fontSize: '15px' }}>FFmpeg Rendering Pipeline Active</strong>
            </div>
            <span
              style={{
                fontFamily: 'JetBrains Mono',
                fontWeight: '700',
                fontSize: '16px',
                color: 'var(--accent-cyan)',
              }}
            >
              {progress.percent}%
            </span>
          </div>

          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress.percent}%` }}></div>
          </div>

          <div className="progress-stats-row">
            {progress.currentSeconds !== undefined && progress.totalDuration !== undefined && (
              <span className="stat-chip">
                Timeline: {progress.currentSeconds}s / {progress.totalDuration}s
              </span>
            )}
            {progress.speed && <span className="stat-chip">Speed: {progress.speed}</span>}
            {progress.fps && <span className="stat-chip">FPS: {progress.fps}</span>}
            <span className="stat-chip">Target: 1080p (1920x1080 @ 30fps)</span>
          </div>
        </div>
      )}

      {/* Render Error */}
      {renderError && (
        <div
          style={{
            marginTop: '16px',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fecdd3',
            fontSize: '13px',
          }}
        >
          <strong>⚠️ Rendering Error:</strong> {renderError}
        </div>
      )}

      {/* Video Completed Player */}
      {videoResult && (
        <div className="video-preview-wrapper card">
          <div className="card-header">
            <div className="card-title">
              <span style={{ fontSize: '20px' }}>🎉</span>
              <span>1080p Master Render Complete</span>
            </div>
            <span className="status-indicator">
              <span className="status-dot"></span>
              Ready to Download
            </span>
          </div>

          <div className="video-container">
            <video
              src={videoResult.videoUrl}
              controls
              autoPlay
              playsInline
            />
          </div>

          <div className="progress-stats-row" style={{ marginTop: '16px' }}>
            <span className="stat-chip">Resolution: 1920 x 1080 (Full HD)</span>
            <span className="stat-chip">Frame Rate: 30.00 FPS</span>
            <span className="stat-chip">Codec: H.264 / AAC</span>
            {videoResult.fileSize && (
              <span className="stat-chip">
                File Size: {(videoResult.fileSize / (1024 * 1024)).toFixed(2)} MB
              </span>
            )}
            {videoResult.renderDurationMs && (
              <span className="stat-chip">
                Render Time: {(videoResult.renderDurationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          <div className="action-bar">
            <a
              href={videoResult.downloadUrl}
              download
              className="btn btn-primary"
              style={{ flex: 1, padding: '14px', fontSize: '15px' }}
            >
              <span>📥</span>
              <span>Download Rendered MP4</span>
            </a>
            <button
              className="btn btn-secondary"
              onClick={onReset}
              style={{ padding: '14px 20px' }}
            >
              🔄 Start New Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
