import React, { useRef, useState, useEffect } from 'react';

export default function AudioUploader({
  audioFile,
  audioDuration,
  onAudioChange,
  onClearAudio,
  onMarkCutAtTime,
}) {
  const fileInputRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const tempAudio = new Audio(objectUrl);
    tempAudio.addEventListener('loadedmetadata', () => {
      const dur = tempAudio.duration;
      onAudioChange(file, objectUrl, dur);
    });
  };

  useEffect(() => {
    const player = audioPlayerRef.current;
    if (!player) return;

    const handleTimeUpdate = () => {
      setCurrentTime(player.currentTime);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    player.addEventListener('timeupdate', handleTimeUpdate);
    player.addEventListener('play', handlePlay);
    player.addEventListener('pause', handlePause);

    return () => {
      player.removeEventListener('timeupdate', handleTimeUpdate);
      player.removeEventListener('play', handlePlay);
      player.removeEventListener('pause', handlePause);
    };
  }, [audioFile]);

  // Keyboard shortcut: Press 'm' or 'M' to mark cut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        (e.key === 'm' || e.key === 'M') &&
        audioFile &&
        !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
      ) {
        e.preventDefault();
        if (onMarkCutAtTime && audioPlayerRef.current) {
          onMarkCutAtTime(Number(audioPlayerRef.current.currentTime.toFixed(2)));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [audioFile, onMarkCutAtTime]);

  const handleMarkCut = () => {
    if (onMarkCutAtTime && audioPlayerRef.current) {
      onMarkCutAtTime(Number(audioPlayerRef.current.currentTime.toFixed(2)));
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span className="step-pill">1</span>
          <span>Voiceover Audio Track</span>
        </div>
        {audioDuration > 0 && (
          <span className="badge-duration">
            Duration: {audioDuration.toFixed(2)}s
          </span>
        )}
      </div>

      {!audioFile ? (
        <div
          className="dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) {
              fileInputRef.current.files = e.dataTransfer.files;
              handleFile({ target: { files: e.dataTransfer.files } });
            }
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept="audio/mp3,audio/wav,audio/m4a,audio/aac,audio/ogg"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
          <div className="dropzone-icon">🎙️</div>
          <div className="dropzone-text">Click or drag & drop audio voiceover</div>
          <div className="dropzone-subtext">Supports MP3, WAV, AAC, M4A, OGG (Up to 150MB)</div>
        </div>
      ) : (
        <div className="audio-player-widget">
          <div className="audio-info-row">
            <span className="audio-file-name">
              <span>🎵</span>
              <strong>{audioFile.name}</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                ({(audioFile.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            </span>
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--accent-rose)' }}
              onClick={onClearAudio}
            >
              Replace Audio
            </button>
          </div>

          <audio
            ref={audioPlayerRef}
            src={URL.createObjectURL(audioFile)}
            controls
          />

          {/* Live Tap-to-Cut Button */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '4px',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Current Position:{' '}
              <strong style={{ color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono' }}>
                {currentTime.toFixed(2)}s
              </strong>
            </div>

            <button
              className="btn btn-secondary"
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                background: isPlaying ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                color: isPlaying ? '#f87171' : 'var(--text-primary)',
                borderColor: isPlaying ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-subtle)',
              }}
              onClick={handleMarkCut}
              title="Split timeline at this exact second (Shortcut: key [M])"
            >
              <span>🔴</span>
              <span>Mark Cut at {currentTime.toFixed(2)}s</span>
              <kbd style={{ marginLeft: '4px', fontSize: '10px', background: '#334155', padding: '2px 5px', borderRadius: '4px' }}>M</kbd>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
