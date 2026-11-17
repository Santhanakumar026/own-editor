import React, { useState, useEffect } from 'react';
import AudioUploader from './components/AudioUploader';
import ImageUploader from './components/ImageUploader';
import TimestampEditor from './components/TimestampEditor';
import TimelineVisualizer from './components/TimelineVisualizer';
import CapCutEffectsSuite from './components/CapCutEffectsSuite';
import VideoPreview from './components/VideoPreview';
import { buildTimelineFromImages, naturalSortFiles } from './utils/filenameParser';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export default function App() {
  const [audioFile, setAudioFile] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);

  const [images, setImages] = useState([]);
  const [clips, setClips] = useState([]);
  const [jsonText, setJsonText] = useState('[]');

  // Mode and notice
  const [autoSyncStatus, setAutoSyncStatus] = useState(null);
  const [showManualEditor, setShowManualEditor] = useState(false);

  // Video Settings
  const [aspectRatio, setAspectRatio] = useState('16:9'); // '16:9' | '9:16' | '1:1'
  const [backgroundMode, setBackgroundMode] = useState('blur'); // 'blur' | 'black'

  // CapCut Effects & Watermark Settings (Default OFF as per user preference)
  const [removeWatermark, setRemoveWatermark] = useState(false);
  const [watermarkMode, setWatermarkMode] = useState('crop');
  const [transitionDuration, setTransitionDuration] = useState(0.8);

  // Custom Brand Logo / Watermark Cover
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null);
  const [logoPosition, setLogoPosition] = useState('bottom-right');
  const [logoWidth, setLogoWidth] = useState(160);

  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState({ percent: 0 });
  const [renderError, setRenderError] = useState(null);
  const [videoResult, setVideoResult] = useState(null);
  const [backendOnline, setBackendOnline] = useState(true);

  // Check backend health on mount
  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((res) => res.json())
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  }, []);

  const handleUpdateClips = (newClips) => {
    setClips(newClips);
    setJsonText(JSON.stringify(newClips, null, 2));
  };

  const handleLogoChange = (file) => {
    if (!file) {
      setLogoFile(null);
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      setLogoPreviewUrl(null);
      return;
    }
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreviewUrl(url);
  };

  /**
   * AUTOMATIC SYNCHRONIZATION ENGINE
   * Evaluates uploaded images and audio duration.
   * 1. Detects exact timestamp markers like [00:03], [00:07] in filenames.
   * 2. Trims each image at the exact audio timing specified.
   * 3. If no timestamps, auto-distributes cuts evenly across the audio voiceover duration.
   */
  const autoSynchronize = (currentImages, currentAudioDur) => {
    const { clips: calculatedClips, autoSyncStatus: calculatedStatus } = buildTimelineFromImages(
      currentImages,
      currentAudioDur
    );
    setClips((prevClips) => {
      const merged = calculatedClips.map((c, i) => ({
        ...c,
        motion: prevClips[i]?.motion || c.motion || 'none',
        transition: prevClips[i]?.transition || c.transition || 'none',
      }));
      setJsonText(JSON.stringify(merged, null, 2));
      return merged;
    });
    setAutoSyncStatus(calculatedStatus);
  };

  // Handle Audio Upload
  const handleAudioChange = (file, objectUrl, duration) => {
    setAudioFile(file);
    setAudioDuration(duration);
    autoSynchronize(images, duration);
  };

  const handleClearAudio = () => {
    setAudioFile(null);
    setAudioDuration(0);
    autoSynchronize(images, 0);
  };

  // Handle Bulk Images Upload
  const handleAddImages = (newImages) => {
    const combined = [...images, ...newImages];
    const sorted = naturalSortFiles(combined);
    setImages(sorted);
    autoSynchronize(sorted, audioDuration);
  };

  const handleClearAllImages = () => {
    setImages([]);
    setClips([]);
    setJsonText('[]');
    setAutoSyncStatus(null);
  };

  const handleRemoveImage = (removeIdx) => {
    const updated = images.filter((_, idx) => idx !== removeIdx);
    setImages(updated);
    autoSynchronize(updated, audioDuration);
  };

  // Generate Video
  const handleGenerate = async () => {
    if (images.length === 0) {
      alert('Please upload your images first.');
      return;
    }

    let activeClips = clips;
    if (!activeClips || activeClips.length === 0) {
      const synched = buildTimelineFromImages(images, audioDuration);
      activeClips = synched.clips;
      setClips(activeClips);
      setJsonText(JSON.stringify(activeClips, null, 2));
      setAutoSyncStatus(synched.autoSyncStatus);
    }

    const estimatedDuration =
      audioDuration > 0
        ? audioDuration
        : activeClips[activeClips.length - 1]?.end || images.length * 3.5;

    setIsRendering(true);
    setProgress({ percent: 0, currentSeconds: 0, totalDuration: estimatedDuration });
    setRenderError(null);
    setVideoResult(null);

    const formData = new FormData();
    if (audioFile) {
      formData.append('audio', audioFile);
    }
    images.forEach((imgObj) => {
      formData.append('images', imgObj.file);
    });

    const payloadTimeline = activeClips.map((c) => ({
      imageIndex: c.imageIndex,
      imageName: c.imageName,
      start: c.start,
      end: c.end,
      motion: c.motion || 'none',
      transition: c.transition || 'none',
    }));
    formData.append('timeline', JSON.stringify(payloadTimeline));
    formData.append('aspectRatio', aspectRatio);
    formData.append('backgroundMode', backgroundMode);
    formData.append('removeWatermark', String(removeWatermark));
    formData.append('watermarkMode', watermarkMode);
    formData.append('transitionDuration', String(transitionDuration));

    if (logoFile) {
      formData.append('logo', logoFile);
      formData.append('logoPosition', logoPosition);
      formData.append('logoWidth', String(logoWidth));
    }

    try {
      const response = await fetch(`${API_BASE}/render`, {
        method: 'POST',
        body: formData,
      });

      let data;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(
          `Server returned non-JSON response (${response.status}): ${text.slice(0, 150)}`
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to start render');
      }

      const { jobId } = data;

      let sse = null;
      let isCompleted = false;

      try {
        sse = new EventSource(`${API_BASE}/jobs/${jobId}/events`);
        sse.onmessage = (event) => {
          try {
            const update = JSON.parse(event.data);
            if (update.status === 'processing') {
              setProgress((prev) => ({
                ...prev,
                ...update,
                percent: update.percent ?? prev.percent,
              }));
            } else if (update.status === 'completed') {
              isCompleted = true;
              setProgress({ percent: 100 });
              setIsRendering(false);
              setVideoResult({
                videoUrl: `${API_BASE}/jobs/${jobId}/video`,
                downloadUrl: `${API_BASE}/jobs/${jobId}/download`,
                fileSize: update.fileSize,
                renderDurationMs: update.renderDurationMs,
                aspectRatio,
              });
              sse.close();
            } else if (update.status === 'failed') {
              isCompleted = true;
              setIsRendering(false);
              setRenderError(update.error || 'Render failed in FFmpeg pipeline');
              sse.close();
            }
          } catch (parseErr) {
            console.error('Error parsing SSE event:', parseErr);
          }
        };

        sse.onerror = () => {
          if (sse) sse.close();
        };
      } catch (err) {
        console.warn('SSE fallback to polling:', err);
      }

      const pollInterval = setInterval(async () => {
        if (isCompleted) {
          clearInterval(pollInterval);
          return;
        }

        try {
          const statusRes = await fetch(`${API_BASE}/jobs/${jobId}/status`);
          if (!statusRes.ok) return;
          const statusData = await statusRes.json();
          const job = statusData.job;

          if (job) {
            if (job.status === 'processing') {
              setProgress((prev) => ({
                ...prev,
                percent: job.progress ?? prev.percent,
                currentSeconds: job.currentSeconds ?? prev.currentSeconds,
                totalDuration: job.totalDuration ?? prev.totalDuration,
                fps: job.fps,
                speed: job.speed,
              }));
            } else if (job.status === 'completed') {
              isCompleted = true;
              clearInterval(pollInterval);
              if (sse) sse.close();
              setIsRendering(false);
              setProgress({ percent: 100 });
              setVideoResult({
                videoUrl: `${API_BASE}/jobs/${jobId}/video`,
                downloadUrl: `${API_BASE}/jobs/${jobId}/download`,
                fileSize: job.fileSize,
                renderDurationMs: job.renderDurationMs,
                aspectRatio,
              });
            } else if (job.status === 'failed') {
              isCompleted = true;
              clearInterval(pollInterval);
              if (sse) sse.close();
              setIsRendering(false);
              setRenderError(job.error || 'Video rendering failed');
            }
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 750);
    } catch (err) {
      setIsRendering(false);
      setRenderError(err.message || 'Network error occurred while submitting render');
    }
  };

  const handleReset = () => {
    setVideoResult(null);
    setProgress({ percent: 0 });
    setRenderError(null);
  };

  const canGenerate = images.length > 0 && !isRendering;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-group">
          <div className="logo-badge">⚡</div>
          <div>
            <h1 className="app-title">VideoSync Studio</h1>
            <p className="app-subtitle">
              100% Automated Image & Audio Video Editing Engine
            </p>
          </div>
        </div>

        <div className="status-indicator">
          <span
            className="status-dot"
            style={{
              backgroundColor: backendOnline ? 'var(--accent-emerald)' : 'var(--accent-rose)',
              boxShadow: backendOnline
                ? '0 0 10px var(--accent-emerald)'
                : '0 0 10px var(--accent-rose)',
            }}
          ></span>
          <span>{backendOnline ? 'Engine Online' : 'Connecting to Server...'}</span>
        </div>
      </header>

      {/* Auto-Sync Status Alert Banner */}
      {autoSyncStatus && (
        <div
          style={{
            marginBottom: '24px',
            padding: '14px 20px',
            background:
              autoSyncStatus.type === 'filename'
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(99, 102, 241, 0.15)',
            border: `1px solid ${
              autoSyncStatus.type === 'filename'
                ? 'rgba(16, 185, 129, 0.3)'
                : 'rgba(99, 102, 241, 0.3)'
            }`,
            borderRadius: '12px',
            color: autoSyncStatus.type === 'filename' ? '#34d399' : '#818cf8',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
          }}
        >
          <span>{autoSyncStatus.message}</span>
          <span style={{ fontSize: '12px', opacity: 0.8, color: '#fff' }}>
            ✓ Ready to Render
          </span>
        </div>
      )}

      {/* Grid: 1. Audio + 2. Bulk Images */}
      <div className="workflow-grid">
        <AudioUploader
          audioFile={audioFile}
          audioDuration={audioDuration}
          onAudioChange={handleAudioChange}
          onClearAudio={handleClearAudio}
        />

        <ImageUploader
          images={images}
          onAddImages={handleAddImages}
          onClearAllImages={handleClearAllImages}
          onRemoveImage={handleRemoveImage}
          audioDuration={audioDuration}
        />
      </div>

      {/* Format & Aspect Ratio Controls */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header" style={{ marginBottom: '14px' }}>
          <div className="card-title">
            <span className="step-pill">3</span>
            <span>Video Format & Styling Preset</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '8px',
              }}
            >
              Aspect Ratio Preset
            </label>
            <div className="tabs-nav">
              <button
                className={`tab-btn ${aspectRatio === '16:9' ? 'active' : ''}`}
                onClick={() => setAspectRatio('16:9')}
              >
                📺 16:9 YouTube / Web
              </button>
              <button
                className={`tab-btn ${aspectRatio === '9:16' ? 'active' : ''}`}
                onClick={() => setAspectRatio('9:16')}
              >
                📱 9:16 Shorts / Reels / TikTok
              </button>
              <button
                className={`tab-btn ${aspectRatio === '1:1' ? 'active' : ''}`}
                onClick={() => setAspectRatio('1:1')}
              >
                ⏹️ 1:1 Square Feed
              </button>
            </div>
          </div>

          <div>
            <label
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '8px',
              }}
            >
              Background Fit Styling
            </label>
            <div className="tabs-nav">
              <button
                className={`tab-btn ${backgroundMode === 'blur' ? 'active' : ''}`}
                onClick={() => setBackgroundMode('blur')}
              >
                ✨ Cinematic Mirror Blur
              </button>
              <button
                className={`tab-btn ${backgroundMode === 'black' ? 'active' : ''}`}
                onClick={() => setBackgroundMode('black')}
              >
                ⬛ Matte Black Bars
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CapCut Effects Suite: 1-Click Transitions, Motion Keyframes & Watermark Remover */}
      {images.length > 0 && (
        <CapCutEffectsSuite
          clips={clips}
          onUpdateClips={handleUpdateClips}
          removeWatermark={removeWatermark}
          onToggleRemoveWatermark={setRemoveWatermark}
          watermarkMode={watermarkMode}
          onChangeWatermarkMode={setWatermarkMode}
          logoFile={logoFile}
          logoPreviewUrl={logoPreviewUrl}
          onLogoChange={handleLogoChange}
          logoPosition={logoPosition}
          onChangeLogoPosition={setLogoPosition}
          logoWidth={logoWidth}
          onChangeLogoWidth={setLogoWidth}
          transitionDuration={transitionDuration}
          onChangeTransitionDuration={setTransitionDuration}
        />
      )}

      {/* Visual Timeline Track */}
      {clips.length > 0 && (
        <TimelineVisualizer
          clips={clips}
          audioDuration={audioDuration}
          images={images}
        />
      )}

      {/* Optional: Collapsed Manual Timestamp Editor for Advanced Users */}
      {images.length > 0 && (
        <div style={{ margin: '18px 0 6px', textAlign: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '6px 14px' }}
            onClick={() => setShowManualEditor(!showManualEditor)}
          >
            {showManualEditor ? '▲ Hide Advanced Manual Timestamp Editor' : '⚙️ Advanced: View / Fine-Tune Individual Timestamp Cuts'}
          </button>
        </div>
      )}

      {showManualEditor && (
        <div style={{ marginTop: '12px' }}>
          <TimestampEditor
            clips={clips}
            images={images}
            audioDuration={audioDuration}
            onClipsChange={handleUpdateClips}
            jsonText={jsonText}
            onJsonTextChange={setJsonText}
          />
        </div>
      )}

      {/* One-Click Video Generation & Export */}
      <VideoPreview
        isRendering={isRendering}
        progress={progress}
        renderError={renderError}
        videoResult={videoResult}
        onGenerate={handleGenerate}
        canGenerate={canGenerate}
        hasAudio={Boolean(audioFile)}
        imageCount={images.length}
        onReset={handleReset}
      />
    </div>
  );
}
