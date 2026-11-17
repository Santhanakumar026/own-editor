import React from 'react';

const CAPCUT_TRANSITION_LIST = [
  'slideleft',
  'slideright',
  'slideup',
  'slidedown',
  'wipeleft',
  'wiperight',
  'circlecrop',
  'rectcrop',
  'fade',
  'fadewhite',
  'smoothleft',
  'smoothright',
];

const MOTION_LIST = ['zoomin', 'zoomout', 'panleft', 'panright'];

export default function CapCutEffectsSuite({
  clips = [],
  onUpdateClips,
  removeWatermark,
  onToggleRemoveWatermark,
  watermarkMode,
  onChangeWatermarkMode,
  transitionDuration,
  onChangeTransitionDuration,
}) {
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
    if (!removeWatermark) {
      onToggleRemoveWatermark(true);
    }
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
    const updated = clips.map((clip, idx) => {
      if (idx === clips.length - 1) return { ...clip, transition: 'none' };
      let chosen = transType;
      if (transType === 'random') {
        chosen = CAPCUT_TRANSITION_LIST[Math.floor(Math.random() * CAPCUT_TRANSITION_LIST.length)];
      } else if (transType === 'slide') {
        const slides = ['slideleft', 'slideright', 'slideup', 'slidedown'];
        chosen = slides[Math.floor(Math.random() * slides.length)];
      } else if (transType === 'wipe') {
        const wipes = ['wipeleft', 'wiperight'];
        chosen = wipes[Math.floor(Math.random() * wipes.length)];
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
        background: 'linear-gradient(145deg, rgba(23, 23, 35, 0.8), rgba(30, 20, 48, 0.85))',
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
              4 CapCut Effects & Google Flow Suite
            </h3>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              1-Click dynamic camera motion, randomized transitions & instant watermark removal
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

      {/* Grid of 3 controls: Watermark, Motion, Transitions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          marginTop: '12px',
        }}
      >
        {/* CONTROL 1: Google Flow Watermark Remover */}
        <div
          style={{
            padding: '14px',
            borderRadius: '10px',
            background: removeWatermark
              ? 'rgba(16, 185, 129, 0.08)'
              : 'rgba(255, 255, 255, 0.03)',
            border: removeWatermark
              ? '1px solid rgba(16, 185, 129, 0.35)'
              : '1px solid var(--border-color)',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '13.5px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🛡️</span> Google Flow Watermark
            </strong>
            <button
              type="button"
              onClick={() => onToggleRemoveWatermark(!removeWatermark)}
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                background: removeWatermark ? '#10b981' : '#475569',
                color: '#fff',
              }}
            >
              {removeWatermark ? '✓ REMOVER ON' : 'OFF'}
            </button>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '8px 0 10px' }}>
            Removes the Google Flow watermark from the exact corner across all images.
          </p>

          {removeWatermark && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`tab-btn ${watermarkMode === 'crop' ? 'active' : ''}`}
                style={{ fontSize: '11px', padding: '5px 10px', flex: 1 }}
                onClick={() => onChangeWatermarkMode('crop')}
              >
                ✨ Clean Re-Frame (100% Invisible)
              </button>
              <button
                type="button"
                className={`tab-btn ${watermarkMode === 'delogo' ? 'active' : ''}`}
                style={{ fontSize: '11px', padding: '5px 10px', flex: 1 }}
                onClick={() => onChangeWatermarkMode('delogo')}
              >
                🌫️ Inpaint Delogo
              </button>
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
              <span>🔍</span> Image Motion (Keyframes)
            </strong>
            <span
              style={{
                fontSize: '11px',
                color: hasMotion ? '#c084fc' : 'var(--text-secondary)',
                fontWeight: '600',
              }}
            >
              {hasMotion ? '✓ Motion Active' : 'Static'}
            </span>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '8px 0 10px' }}>
            Applies smooth Ken Burns camera zooms & pans to prevent flat static slides.
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
              🔍 Zoom In
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyMotionToAll('zoomout')}
            >
              🔎 Zoom Out
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyMotionToAll('panleft')}
            >
              ↔️ Pan
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px', color: '#ef4444' }}
              onClick={() => handleApplyMotionToAll('none')}
            >
              None
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
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Duration:</span>
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
                <option value={0.3}>0.3s (Fast)</option>
                <option value={0.5}>0.5s (Std)</option>
                <option value={0.8}>0.8s (Smooth)</option>
              </select>
            </div>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '8px 0 10px' }}>
            Randomizes or applies slide, wipe, circle crop, or flash transitions between cuts.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyTransitionToAll('random')}
            >
              🎲 Random All
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyTransitionToAll('slide')}
            >
              🎬 Slide
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyTransitionToAll('wipe')}
            >
              🌊 Wipe
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleApplyTransitionToAll('circlecrop')}
            >
              ⭕ Circle
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
