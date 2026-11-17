import React, { useState, useEffect } from 'react';

export default function TimestampEditor({
  clips,
  images,
  audioDuration,
  onClipsChange,
  jsonText,
  onJsonTextChange,
}) {
  const [activeTab, setActiveTab] = useState('visual'); // 'visual' | 'json'
  const [jsonError, setJsonError] = useState(null);

  // When clips change in visual mode, keep jsonText in sync
  const updateFromVisual = (newClips) => {
    onClipsChange(newClips);
    onJsonTextChange(JSON.stringify(newClips, null, 2));
    setJsonError(null);
  };

  // When user edits JSON in raw mode
  const handleJsonChange = (e) => {
    const val = e.target.value;
    onJsonTextChange(val);

    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        onClipsChange(parsed);
        setJsonError(null);
      } else {
        setJsonError('JSON must be an array of cut objects.');
      }
    } catch (err) {
      setJsonError(err.message);
    }
  };

  // Clip field updates in visual table
  const updateClipField = (idx, field, value) => {
    const next = [...clips];
    const item = { ...next[idx] };

    if (field === 'start' || field === 'end') {
      const num = parseFloat(value);
      item[field] = isNaN(num) ? 0 : num;
    } else if (field === 'imageIndex') {
      item.imageIndex = parseInt(value, 10);
      if (images[item.imageIndex]) {
        item.imageName = images[item.imageIndex].name;
      }
    }

    next[idx] = item;
    updateFromVisual(next);
  };

  // Add new clip row
  const addClip = () => {
    const lastClip = clips[clips.length - 1];
    const start = lastClip ? lastClip.end : 0;
    const end = Number((start + 3.0).toFixed(2));
    const nextIndex = clips.length % (images.length || 1);
    const imageName = images[nextIndex] ? images[nextIndex].name : `Slide #${clips.length}`;

    const newClip = {
      imageIndex: nextIndex,
      imageName,
      start,
      end,
    };

    updateFromVisual([...clips, newClip]);
  };

  // Remove clip row
  const removeClip = (idx) => {
    const next = clips.filter((_, i) => i !== idx);
    updateFromVisual(next);
  };

  // Snap all clips end-to-end
  const snapEndToEnd = () => {
    let cursor = 0;
    const next = clips.map((clip) => {
      const dur = Math.max(0.5, clip.end - clip.start);
      const start = Number(cursor.toFixed(2));
      const end = Number((cursor + dur).toFixed(2));
      cursor = end;
      return { ...clip, start, end };
    });
    updateFromVisual(next);
  };

  // Load sample template into JSON
  const loadSampleJson = () => {
    const sample = images.length >= 2
      ? [
          { imageName: images[0].name, start: 0.0, end: 3.5 },
          { imageName: images[1].name, start: 3.5, end: 7.0 },
        ]
      : [
          { imageIndex: 0, start: 0.0, end: 3.5 },
          { imageIndex: 1, start: 3.5, end: 7.0 },
        ];
    updateFromVisual(sample);
  };

  return (
    <div className="card" style={{ gridColumn: 'span 2' }}>
      <div className="card-header">
        <div className="card-title">
          <span className="step-pill">3</span>
          <span>Timeline & Timestamp Mapping</span>
        </div>

        <div className="tabs-nav" style={{ width: '320px' }}>
          <button
            className={`tab-btn ${activeTab === 'visual' ? 'active' : ''}`}
            onClick={() => setActiveTab('visual')}
          >
            📋 Visual Cut List
          </button>
          <button
            className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`}
            onClick={() => setActiveTab('json')}
          >
            {'{ }'} JSON Editor
          </button>
        </div>
      </div>

      {activeTab === 'visual' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Specify the start and end timestamp (in seconds) for each image cut.
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '11px' }}
                onClick={snapEndToEnd}
                title="Remove all gaps by aligning clips sequentially"
              >
                🧲 Snap End-to-End
              </button>
              <button
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: '11px' }}
                onClick={addClip}
              >
                ➕ Add Clip
              </button>
            </div>
          </div>

          <div className="timeline-table-wrapper">
            <table className="timeline-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>Clip</th>
                  <th>Image Asset</th>
                  <th style={{ width: '100px' }}>Start (s)</th>
                  <th style={{ width: '100px' }}>End (s)</th>
                  <th style={{ width: '80px' }}>Duration</th>
                  <th style={{ width: '120px' }}>Motion (FX)</th>
                  <th style={{ width: '130px' }}>Transition</th>
                  <th style={{ width: '50px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {clips.map((clip, idx) => {
                  const duration = (clip.end - clip.start).toFixed(2);
                  const isInvalid = clip.end <= clip.start;

                  return (
                    <tr key={idx}>
                      <td style={{ fontWeight: '700', color: 'var(--text-muted)' }}>
                        #{idx + 1}
                      </td>
                      <td>
                        {images.length > 0 ? (
                          <select
                            value={
                              clip.imageIndex !== undefined
                                ? clip.imageIndex
                                : images.findIndex((img) => img.name === clip.imageName)
                            }
                            onChange={(e) => updateClipField(idx, 'imageIndex', e.target.value)}
                            style={{
                              background: '#0f172a',
                              color: '#fff',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              fontSize: '12px',
                              width: '100%',
                              maxWidth: '220px',
                            }}
                          >
                            {images.map((img, imgIdx) => (
                              <option key={imgIdx} value={imgIdx}>
                                #{imgIdx + 1}: {img.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={clip.imageName || `Image #${clip.imageIndex ?? idx}`}
                            onChange={(e) => {
                              const next = [...clips];
                              next[idx].imageName = e.target.value;
                              updateFromVisual(next);
                            }}
                            className="input-time"
                            style={{ width: '100%', maxWidth: '200px', textAlign: 'left' }}
                            placeholder="e.g. intro.png"
                          />
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={clip.start}
                          onChange={(e) => updateClipField(idx, 'start', e.target.value)}
                          className="input-time"
                          style={{ width: '80px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={clip.end}
                          onChange={(e) => updateClipField(idx, 'end', e.target.value)}
                          className="input-time"
                          style={{
                            width: '80px',
                            borderColor: isInvalid ? 'var(--accent-rose)' : 'var(--border-subtle)',
                          }}
                        />
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '12px',
                            fontFamily: 'JetBrains Mono',
                            color: isInvalid ? 'var(--accent-rose)' : 'var(--accent-cyan)',
                            fontWeight: '600',
                          }}
                        >
                          {isInvalid ? 'Invalid' : `${duration}s`}
                        </span>
                      </td>
                      <td>
                        <select
                          value={clip.motion || 'none'}
                          onChange={(e) => {
                            const next = [...clips];
                            next[idx] = { ...next[idx], motion: e.target.value };
                            updateFromVisual(next);
                          }}
                          style={{
                            background: '#0f172a',
                            color: clip.motion && clip.motion !== 'none' ? '#c084fc' : '#94a3b8',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '6px',
                            padding: '4px 6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            width: '110px',
                          }}
                        >
                          <option value="none">None (Static)</option>
                          <option value="zoomin">Zoom In 🔍</option>
                          <option value="zoomout">Zoom Out 🔎</option>
                          <option value="panleft">Pan Left ↔️</option>
                          <option value="panright">Pan Right ↔️</option>
                        </select>
                      </td>
                      <td>
                        {idx < clips.length - 1 ? (
                          <select
                            value={clip.transition || 'none'}
                            onChange={(e) => {
                              const next = [...clips];
                              next[idx] = { ...next[idx], transition: e.target.value };
                              updateFromVisual(next);
                            }}
                            style={{
                              background: '#0f172a',
                              color: clip.transition && clip.transition !== 'none' ? '#38bdf8' : '#94a3b8',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '6px',
                              padding: '4px 6px',
                              fontSize: '11px',
                              fontWeight: '600',
                              width: '120px',
                            }}
                          >
                            <option value="none">None (Cut)</option>
                            <option value="slideleft">Slide Left 🎬</option>
                            <option value="slideright">Slide Right 🎬</option>
                            <option value="circlecrop">Circle Crop ⭕</option>
                            <option value="wipeleft">Wipe Left 🌊</option>
                            <option value="smoothleft">Smooth Left ✨</option>
                            <option value="fadewhite">Flash White ⚡</option>
                            <option value="fade">Dissolve Fade 🌫️</option>
                          </select>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>End</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            color: 'var(--accent-rose)',
                          }}
                          onClick={() => removeClip(idx)}
                          title="Delete clip"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Paste or edit raw JSON. Supports <code>imageName</code>, <code>imageIndex</code>, <code>start</code>, and <code>end</code>.
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '11px' }}
                onClick={loadSampleJson}
              >
                📝 Load Sample JSON
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '11px' }}
                onClick={() => {
                  try {
                    const obj = JSON.parse(jsonText);
                    onJsonTextChange(JSON.stringify(obj, null, 2));
                    setJsonError(null);
                  } catch (e) {
                    setJsonError(e.message);
                  }
                }}
              >
                ✨ Format JSON
              </button>
            </div>
          </div>

          <textarea
            className="json-editor-area"
            value={jsonText}
            onChange={handleJsonChange}
            placeholder={`[\n  { "imageName": "slide1.png", "start": 0.0, "end": 3.5 },\n  { "imageName": "slide2.jpg", "start": 3.5, "end": 7.0 }\n]`}
          />

          {jsonError ? (
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--accent-rose)' }}>
              ❌ JSON Syntax Error: {jsonError}
            </div>
          ) : (
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--accent-emerald)' }}>
              ✓ Valid JSON array ({clips.length} cuts parsed)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

