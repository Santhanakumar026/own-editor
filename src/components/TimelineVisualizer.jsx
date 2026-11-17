import React from 'react';

const PALETTE = [
  '#6366f1',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#3b82f6',
  '#14b8a6',
];

export default function TimelineVisualizer({ clips, audioDuration, images }) {
  if (!clips || clips.length === 0) {
    return null;
  }

  const maxTimelineTime = Math.max(
    audioDuration > 0 ? audioDuration : 0,
    clips[clips.length - 1]?.end || 1
  );

  return (
    <div className="timeline-bar-container" style={{ marginTop: '20px' }}>
      <div className="timeline-bar-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📊 Timeline Synchronization Map</span>
          <span style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>
            (Duration: {maxTimelineTime.toFixed(1)}s)
          </span>
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {clips.length} cuts scheduled
        </span>
      </div>

      {/* Main visual timeline bar */}
      <div className="timeline-track" style={{ height: '42px', position: 'relative' }}>
        {clips.map((clip, idx) => {
          const leftPercent = (clip.start / maxTimelineTime) * 100;
          const widthPercent = ((clip.end - clip.start) / maxTimelineTime) * 100;
          const color = PALETTE[idx % PALETTE.length];

          const imgLabel =
            clip.imageName ||
            (typeof clip.imageIndex === 'number' && images[clip.imageIndex]?.name) ||
            `Slide #${idx + 1}`;

          const motionIcon =
            clip.motion === 'zoomin'
              ? '🔍'
              : clip.motion === 'zoomout'
              ? '🔎'
              : clip.motion === 'panleft' || clip.motion === 'panright'
              ? '↔️'
              : '';

          return (
            <div
              key={idx}
              className="timeline-block"
              style={{
                left: `${leftPercent}%`,
                width: `${Math.max(widthPercent, 1.2)}%`,
                backgroundColor: color,
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: '600',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                padding: '0 4px',
              }}
              title={`${imgLabel} (${clip.start}s - ${clip.end}s, Motion: ${clip.motion || 'none'}, Next Transition: ${clip.transition || 'none'})`}
            >
              {motionIcon && <span style={{ marginRight: '3px' }}>{motionIcon}</span>}
              {widthPercent > 6 ? `${imgLabel}` : ''}
            </div>
          );
        })}
      </div>

      {/* Transitions Flow Bar underneath */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          marginTop: '10px',
          alignItems: 'center',
          fontSize: '11.5px',
        }}
      >
        <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>🎬 FX Flow:</span>
        {clips.map((clip, idx) => {
          const motionLabel =
            clip.motion === 'zoomin'
              ? 'Zoom In'
              : clip.motion === 'zoomout'
              ? 'Zoom Out'
              : clip.motion === 'panleft'
              ? 'Pan L'
              : clip.motion === 'panright'
              ? 'Pan R'
              : null;

          const transLabel = clip.transition && clip.transition !== 'none' ? clip.transition : null;

          return (
            <React.Fragment key={idx}>
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: '5px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#e2e8f0',
                  fontFamily: 'JetBrains Mono',
                  fontSize: '11px',
                }}
              >
                #{idx + 1} {motionLabel && <span style={{ color: '#c084fc' }}>({motionLabel})</span>}
              </span>

              {idx < clips.length - 1 && (
                <span
                  style={{
                    color: transLabel ? '#38bdf8' : 'rgba(255,255,255,0.3)',
                    fontWeight: '700',
                    fontSize: '11px',
                  }}
                  title={transLabel ? `Transition: ${transLabel}` : 'Hard Cut'}
                >
                  {transLabel ? `➔ [${transLabel}] ➔` : '➔'}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
