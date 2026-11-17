import React, { useRef } from 'react';

const CAPCUT_TRANSITION_LIST = [
  // Fades & Dissolves
  'fade',
  'fadewhite',
  'fadeblack',
  'dissolve',
  'hblur',
  // Dynamic & Depth
  'zoomin',
  'distance',
  // Butter-Smooth Glides (Eased)
  'smoothleft',
  'smoothright',
  'smoothup',
  'smoothdown',
  // Modern Slides
  'slideleft',
  'slideright',
  'slideup',
  'slidedown',
  // Directional Wipes
  'wipeleft',
  'wiperight',
  'wipeup',
  'wipedown',
  // Diagonal Wipes
  'wipetl',
  'wipetr',
  'wipebl',
  'wipebr',
  // Covers & Reveals
  'coverleft',
  'coverright',
  'coverup',
  'coverdown',
  'revealleft',
  'revealright',
  // Atmospheric Wind Sweeps
  'hlwind',
  'hrwind',
];

const MOTION_LIST = ['zoomin', 'zoomout', 'panleft', 'panright'];

export default function CapCutEffectsSuite({
  clips = [],
  onUpdateClips,
  removeWatermark,
  onToggleRemoveWatermark,
  watermarkMode,
  onChangeWatermarkMode,
  logoFile,
  logoPreviewUrl,
  onLogoChange,
  logoPosition = 'bottom-right',
  onChangeLogoPosition,
  logoWidth = 160,
  onChangeLogoWidth,
  transitionDuration = 0.8,
  onChangeTransitionDuration,
}) {
  const fileInputRef = useRef(null);

  /**
   * 1-Click CapCut Magic:
   * Randomly assigns Zoom In / Zoom Out / Pan to every image,
   * randomly assigns CapCut transitions between every clip,
   * and turns ON Google Flow watermark removal!
   */
  const handleApplyCapCutMagic = () => {
    if (!clips || clips.length === 0) return;

    const updated = clips.map((clip, idx) => {
      // Pick random motion
      const randomMotion = MOTION_LIST[Math.floor(Math.random() * MOTION_LIST.length)];
      // Pick random transition for cuts
      const randomTransition =
        idx < clips.length - 1
          ? CAPCUT_TRANSITION_LIST[Math.floor(Math.random() * CAPCUT_TRANSITION_LIST.length)]
          : 'none';

      return {
        ...clip,
        motion: randomMotion,
        transition: randomTransition,
      };
    });

    onUpdateClips(updated);
  };

  /**
   * Apply specific motion to ALL clips in 1 click
   */
  const handleApplyMotionToAll = (motionType) => {
    if (!clips || clips.length === 0) return;
    const updated = clips.map((clip) => {
      let chosen = motionType;
      if (motionType === 'random') {
        chosen = MOTION_LIST[Math.floor(Math.random() * MOTION_LIST.length)];
      }
      return { ...clip, motion: chosen };
    });
    onUpdateClips(updated);
  };

  /**
   * Apply specific transition to ALL cuts in 1 click
   */
  const handleApplyTransitionToAll = (transType) => {
    if (!clips || clips.length === 0) return;

    const dissolves = ['fade', 'dissolve', 'hblur', 'fadewhite', 'fadeblack'];
    const smoothGlides = ['smoothleft', 'smoothright', 'smoothup', 'smoothdown'];
    const slides = ['slideleft', 'slideright', 'slideup', 'slidedown'];
    const dynamicZoom = ['zoomin', 'distance'];
    const wipes = ['wipeleft', 'wiperight', 'wipeup', 'wipedown', 'wipetl', 'wipetr', 'hlwind', 'hrwind'];
    const covers = ['coverleft', 'coverright', 'coverup', 'coverdown', 'revealleft', 'revealright'];

    const updated = clips.map((clip, idx) => {
      if (idx === clips.length - 1) return { ...clip, transition: 'none' };
      let chosen = transType;
      if (transType === 'random') {
        chosen = CAPCUT_TRANSITION_LIST[Math.floor(Math.random() * CAPCUT_TRANSITION_LIST.length)];
      } else if (transType === 'dissolve') {
        chosen = dissolves[Math.floor(Math.random() * dissolves.length)];
      } else if (transType === 'smooth') {
        chosen = smoothGlides[Math.floor(Math.random() * smoothGlides.length)];
      } else if (transType === 'slide') {
        chosen = slides[Math.floor(Math.random() * slides.length)];
      } else if (transType === 'zoomin') {
        chosen = dynamicZoom[Math.floor(Math.random() * dynamicZoom.length)];
      } else if (transType === 'wipe') {
        chosen = wipes[Math.floor(Math.random() * wipes.length)];
      } else if (transType === 'cover') {
        chosen = covers[Math.floor(Math.random() * covers.length)];
      } else if (transType === 'fadewhite') {
        chosen = 'fadewhite';
      }
      return { ...clip, transition: chosen };
    });
    onUpdateClips(updated);
  };

  const hasMotion = clips.some((c) => c.motion && c.motion !== 'none');
  const hasTransitions = clips.some((c) => c.transition && c.transition !== 'none');

  return (
    <div
      className="card"
      style={{
        marginTop: '20px',
        border: '1px solid rgba(139, 92, 246, 0.35)',
        background: 'linear-gradient(145deg, rgba(23, 23, 35, 0.85), rgba(30, 20, 48, 0.9))',
        boxShadow: '0 8px 32px rgba(139, 92, 246, 0.15)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: '20px',
              padding: '6px 10px',
              borderRadius: '8px',
              background: 'rgba(168, 85, 247, 0.2)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
            }}
          >
            ✨
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', fontWeight: '700' }}>
              4 CapCut Effects & Watermark / Logo Suite
            </h3>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              1-Click dynamic camera motion, randomized transitions & brand logo watermark cover
            </p>
          </div>
        </div>

        {/* 1-Click Master Button */}
        <button
          type="button"
          onClick={handleApplyCapCutMagic}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)',
            color: '#fff',
            fontWeight: '700',
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(168, 85, 247, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'transform 0.15s ease',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <span>🎲</span>
          <span>1-Click CapCut Magic (Apply to All Clips)</span>
        </button>
      </div>

      {/* Grid of 3 controls: Logo/Watermark, Motion, Transitions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
          marginTop: '12px',
        }}
      >
        {/* CONTROL 1: Brand Logo & Watermark Cover */}
        <div
          style={{
            padding: '14px',
            borderRadius: '10px',
            background: logoFile
              ? 'rgba(16, 185, 129, 0.12)'
              : removeWatermark
              ? 'rgba(16, 185, 129, 0.08)'
              : 'rgba(255, 255, 255, 0.03)',
            border: logoFile || removeWatermark
              ? '1px solid rgba(16, 185, 129, 0.4)'
              : '1px solid var(--border-color)',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '13.5px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🏷️</span> Logo / Watermark Cover
            </strong>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                background: logoFile ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                color: logoFile ? '#34d399' : 'var(--text-secondary)',
                fontWeight: '600',
              }}
            >
              {logoFile ? '✓ Logo Covering Watermark' : 'Cover Options'}
            </span>
          </div>

          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '8px 0 10px' }}>
            Place your channel logo fixed over the Google Flow watermark across the entire video.
          </p>

          {/* Logo Uploader / Preview Box */}
          {logoFile ? (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px dashed #10b981',
                borderRadius: '8px',
                padding: '10px',
                marginBottom: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {logoPreviewUrl && (
                    <img
                      src={logoPreviewUrl}
                      alt="Brand Logo"
                      style={{
                        height: '36px',
                        maxWidth: '90px',
                        objectFit: 'contain',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '2px',
                      }}
                    />
                  )}
                  <div>
                    <div style={{ fontSize: '12px', color: '#fff', fontWeight: '600', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {logoFile.name}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#34d399' }}>
                      Fixed over watermark location
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onLogoChange(null)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                  title="Remove logo"
                >
                  ✕ Remove
                </button>
              </div>

              {/* Position & Size Adjusters */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                <div>
                  <label style={{ fontSize: '10.5px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                    Position
                  </label>
                  <select
                    value={logoPosition}
                    onChange={(e) => onChangeLogoPosition(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#0f172a',
                      color: '#fff',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '11px',
                    }}
                  >
                    <option value="bottom-right">Bottom-Right (Google Flow)</option>
                    <option value="bottom-left">Bottom-Left</option>
                    <option value="top-right">Top-Right</option>
                    <option value="top-left">Top-Left</option>
                    <option value="center">Center</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '10.5px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                    Logo Size
                  </label>
                  <select
                    value={logoWidth}
                    onChange={(e) => onChangeLogoWidth(parseInt(e.target.value, 10))}
                    style={{
                      width: '100%',
                      background: '#0f172a',
                      color: '#fff',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '11px',
                    }}
                  >
                    <option value={130}>Compact (130px)</option>
                    <option value={160}>Watermark Size (160px)</option>
                    <option value={200}>Prominent (200px)</option>
                    <option value={250}>Large (250px)</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    onLogoChange(e.target.files[0]);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px dashed #10b981',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#34d399',
                  fontWeight: '600',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginBottom: '8px',
                }}
              >
                <span>➕</span>
                <span>Upload Logo to Cover Watermark</span>
              </button>

              {/* Fallback Watermark Mode if No Logo */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Or use Auto Watermark Filter:
                </span>
                <button
                  type="button"
                  onClick={() => onToggleRemoveWatermark(!removeWatermark)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '10.5px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    background: removeWatermark ? '#10b981' : '#475569',
                    color: '#fff',
                  }}
                >
                  {removeWatermark ? 'ON' : 'OFF'}
                </button>
              </div>

              {removeWatermark && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className={`tab-btn ${watermarkMode === 'crop' ? 'active' : ''}`}
                    style={{ fontSize: '10.5px', padding: '4px 6px', flex: 1 }}
                    onClick={() => onChangeWatermarkMode('crop')}
                  >
                    ✨ Clean Re-Frame
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${watermarkMode === 'delogo' ? 'active' : ''}`}
                    style={{ fontSize: '10.5px', padding: '4px 6px', flex: 1 }}
                    onClick={() => onChangeWatermarkMode('delogo')}
                  >
                    🌫️ Inpaint Delogo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CONTROL 2: Dynamic Image Motion (Zoom In/Out/Pan) */}
        <div
          style={{
            padding: '14px',
            borderRadius: '10px',
            background: hasMotion ? 'rgba(168, 85, 247, 0.08)' : 'rgba(255, 255, 255, 0.03)',
            border: hasMotion
              ? '1px solid rgba(168, 85, 247, 0.35)'
              : '1px solid var(--border-color)',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '13.5px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🔍</span> Smooth Motion (Keyframes)
            </strong>
            <span
              style={{
                fontSize: '11px',
                color: hasMotion ? '#c084fc' : 'var(--text-secondary)',
                fontWeight: '600',
              }}
            >
              {hasMotion ? '✓ Smooth FX Active' : 'Static'}
            </span>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '8px 0 10px' }}>
            Silky-smooth Ken Burns zoom & pan. Upscaled to eliminate all vibration / micro-jitter.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyMotionToAll('random')}
            >
              🎲 Random Mix
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyMotionToAll('zoomin')}
            >
              🔍 Smooth Zoom In
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyMotionToAll('zoomout')}
            >
              🔎 Smooth Zoom Out
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyMotionToAll('panleft')}
            >
              ↔️ Smooth Pan
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px', color: '#ef4444' }}
              onClick={() => handleApplyMotionToAll('none')}
            >
              Static
            </button>
          </div>
        </div>

        {/* CONTROL 3: CapCut Transitions */}
        <div
          style={{
            padding: '14px',
            borderRadius: '10px',
            background: hasTransitions ? 'rgba(6, 182, 212, 0.08)' : 'rgba(255, 255, 255, 0.03)',
            border: hasTransitions
              ? '1px solid rgba(6, 182, 212, 0.35)'
              : '1px solid var(--border-color)',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '13.5px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🎬</span> CapCut Transitions
            </strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Speed:</span>
              <select
                value={transitionDuration}
                onChange={(e) => onChangeTransitionDuration(parseFloat(e.target.value))}
                style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid var(--border-color)',
                  color: '#fff',
                  borderRadius: '4px',
                  padding: '2px 4px',
                  fontSize: '11px',
                }}
              >
                <option value={0.5}>0.5s (Standard)</option>
                <option value={0.8}>0.8s (Smooth)</option>
                <option value={1.0}>1.0s (Ultra Smooth)</option>
                <option value={1.2}>1.2s (Cinematic Slow)</option>
              </select>
            </div>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '8px 0 10px' }}>
            Ultra-smooth cinema transitions (Blur Dissolve, Dynamic Zoom, Smooth Glides, Flash, Wipes, Covers) locked frame-accurately to audio timestamps.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyTransitionToAll('random')}
              title="Apply varied cinematic transitions across all cuts (zero circles)"
            >
              🎲 Random All
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyTransitionToAll('dissolve')}
              title="Dissolve, Motion Blur Dissolve & Film Fades"
            >
              ✨ Dissolves & Blur
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyTransitionToAll('smooth')}
              title="Butter-smooth eased directional glides"
            >
              🎬 Smooth Glides
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyTransitionToAll('zoomin')}
              title="Dynamic push in & warp depth"
            >
              🚀 Zoom Push
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyTransitionToAll('slide')}
              title="Modern slide left/right/up/down"
            >
              📱 Slide
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyTransitionToAll('wipe')}
              title="Directional & diagonal film wipes and wind breeze"
            >
              🌊 Wipes & Wind
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyTransitionToAll('cover')}
              title="Page covers and film reveals"
            >
              📑 Covers & Reveals
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyTransitionToAll('fadewhite')}
              title="Flash white glow effect"
            >
              ⚡ Flash White
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px', color: '#ef4444' }}
              onClick={() => handleApplyTransitionToAll('none')}
            >
              Hard Cut
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
