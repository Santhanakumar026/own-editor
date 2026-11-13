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
  if (!audioDuration || audioDuration <= 0 || !clips || clips.length === 0) {
    return null;
  }

  // Calculate gaps or overlaps
  let warnings = [];
  for (let i = 0; i < clips.length; i++) {
    if (i === 0 && clips[i].start > 0.05) {
      warnings.push(`Initial delay: 0.0s to ${clips[i].start}s`);
    }
    if (i > 0) {
      const prevEnd = clips[i - 1].end;
      const currStart = clips[i].start;
      if (currStart > prevEnd + 0.05) {
        warnings.push(`Gap detected: ${prevEnd}s to ${currStart}s`);
      } else if (currStart < prevEnd - 0.05) {
        warnings.push(`Overlap detected: clip #${i} starts before clip #${i - 1} ends`);
      }
    }
  }

  const maxTimelineTime = Math.max(
    audioDuration,
    clips[clips.length - 1]?.end || audioDuration
  );

  return (
    <div className="timeline-bar-container">
      <div className="timeline-bar-header">
        <span>Timeline Synchronization Map (Total: {audioDuration.toFixed(2)}s)</span>
        <span>{clips.length} cuts scheduled</span>
      </div>

      <div className="timeline-track">
        {clips.map((clip, idx) => {
          const leftPercent = (clip.start / maxTimelineTime) * 100;
          const widthPercent = ((clip.end - clip.start) / maxTimelineTime) * 100;
          const color = PALETTE[idx % PALETTE.length];

          const imgLabel =
            clip.imageName ||
            (typeof clip.imageIndex === 'number' && images[clip.imageIndex]?.name) ||
            `Slide #${idx}`;

          return (
            <div
              key={idx}
              className="timeline-block"
              style={{
                left: `${leftPercent}%`,
                width: `${Math.max(widthPercent, 1)}%`,
                backgroundColor: color,
                position: 'absolute',
              }}
              title={`${imgLabel} (${clip.start}s - ${clip.end}s, dur: ${(clip.end - clip.start).toFixed(2)}s)`}
            >
              {widthPercent > 5 ? `${imgLabel}` : ''}
            </div>
          );
        })}
      </div>

      {warnings.length > 0 && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--accent-amber)' }}>
          ⚠️ Notice: {warnings.join(' • ')} (FFmpeg will auto-fill/hold to prevent audio desync)
        </div>
      )}
    </div>
  );
}

