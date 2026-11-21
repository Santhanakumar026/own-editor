const path = require('path');
const fs = require('fs');

/**
 * Helper to convert MM:SS or MM-SS or HH:MM:SS or pure seconds string to total seconds (float).
 */
function toSeconds(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const cleaned = String(str).trim();
  const match = cleaned.match(/^(\d{1,2})[-:](\d{2}(?:\.\d+)?)$/);
  if (match) {
    return parseFloat(match[1]) * 60 + parseFloat(match[2]);
  }
  const matchHms = cleaned.match(/^(\d{1,2})[-:](\d{2})[-:](\d{2}(?:\.\d+)?)$/);
  if (matchHms) {
    return (
      parseFloat(matchHms[1]) * 3600 +
      parseFloat(matchHms[2]) * 60 +
      parseFloat(matchHms[3])
    );
  }
  return parseFloat(cleaned);
}

/**
 * Extracts timestamps from image filenames (e.g. "_0-00_", "_0-06_", "[00-21]_Create_one_16.png", "[00:03] image.png", "[00:00 - 00:03].jpg").
 */
function extractTimestampFromFilename(filename) {
  if (!filename) return null;
  const name = path.parse(filename).name.trim();

  // Pattern 1: Explicit Range (TWO timestamps separated by "to" or " - " or "_to_")
  const explicitRangeMatch = name.match(
    /(?:\[|\()?\s*(\d{1,2}[-:]\d{2}(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:\s+-\s+|\s+to\s+|_to_)\s*(\d{1,2}[-:]\d{2}(?:\.\d+)?|\d+(?:\.\d+)?)\s*s?\s*(?:\]|\))?/i
  );
  if (explicitRangeMatch) {
    const s = toSeconds(explicitRangeMatch[1]);
    const e = toSeconds(explicitRangeMatch[2]);
    if (!isNaN(s) && !isNaN(e) && e > s) {
      return { type: 'range', start: Number(s.toFixed(2)), end: Number(e.toFixed(2)) };
    }
  }

  // Pattern 2: XmYs format: 1m30s, 0m05s, 2m10s
  const mSecMatch = name.match(/(?:^|[\[\(_\s])(\d+)\s*m\s*(\d+(?:\.\d+)?)\s*s?(?:[\]\)_s\s]|$)/i);
  if (mSecMatch) {
    const mins = parseFloat(mSecMatch[1]);
    const secs = parseFloat(mSecMatch[2]);
    if (!isNaN(mins) && !isNaN(secs)) {
      return { type: 'point', time: Number((mins * 60 + secs).toFixed(2)) };
    }
  }

  // Pattern 3: Underscored or bracketed Windows-safe MM-SS or MM:SS clock: _0-00_, _0-06_, [00-21], [00:03], _1-05_, _9-36_
  const bracketClockMatch = name.match(
    /(?:^|[\[\(_\s])(\d{1,2})[-:_](\d{2}(?:\.\d+)?)(?:[\]\)_s\s]|$)/i
  );
  if (bracketClockMatch) {
    const mins = parseFloat(bracketClockMatch[1]);
    const secs = parseFloat(bracketClockMatch[2]);
    if (!isNaN(mins) && !isNaN(secs)) {
      const totalSec = mins * 60 + secs;
      return { type: 'point', time: Number(totalSec.toFixed(2)) };
    }
  }

  // Pattern 4: Pure seconds format: 21s, [21s], _21s, 3.5s
  const secMatch = name.match(/(?:^|[\[\(_\s])(\d+(?:\.\d+)?)\s*s(?:[\]\)_s\s]|$)/i);
  if (secMatch) {
    const sec = parseFloat(secMatch[1]);
    if (!isNaN(sec)) {
      return { type: 'point', time: Number(sec.toFixed(2)) };
    }
  }

  // Pattern 5: Fallback clock anywhere in filename: "image_00:03.jpg" or "00:03_photo.png" or "00-21_scene.png"
  const clockMatch = name.match(/(?:^|[^\d])(\d{1,2})[-:](\d{2}(?:\.\d+)?)(?:[^\d]|$)/);
  if (clockMatch) {
    const mins = parseFloat(clockMatch[1]);
    const secs = parseFloat(clockMatch[2]);
    if (!isNaN(mins) && !isNaN(secs)) {
      return { type: 'point', time: Number((mins * 60 + secs).toFixed(2)) };
    }
  }

  return null;
}

/**
 * Validates and normalizes timestamp data against uploaded files and audio duration.
 *
 * @param {Array<Object>} uploadedImages - Multer files array for images
 * @param {string|Array<Object>} rawTimeline - User-provided JSON or array
 * @param {number} audioDuration - Duration in seconds from ffprobe
 * @param {string} projectDir - Directory where concat.txt will be saved
 * @returns {Object} { clips, concatFilePath, warnings, summary }
 */
function parseAndGenerateTimeline(uploadedImages, rawTimeline, audioDuration, projectDir) {
  if (!uploadedImages || uploadedImages.length === 0) {
    throw new Error('No images uploaded. At least one image is required.');
  }

  let entries = [];
  if (typeof rawTimeline === 'string') {
    try {
      entries = JSON.parse(rawTimeline);
    } catch (err) {
      entries = [];
    }
  } else if (Array.isArray(rawTimeline)) {
    entries = rawTimeline;
  }

  const warnings = [];

  // Build lookup maps for images:
  // Apply natural numerical sorting so Multer multipart stream ordering never scrambles index resolution
  uploadedImages.sort((a, b) =>
    a.originalname.localeCompare(b.originalname, undefined, { numeric: true })
  );
  const imageByIndex = [...uploadedImages];
  const imageByName = new Map();

  uploadedImages.forEach((img, idx) => {
    imageByName.set(img.originalname, img);
    imageByName.set(img.originalname.toLowerCase(), img);
    if (img.filename) {
      imageByName.set(img.filename, img);
      imageByName.set(img.filename.toLowerCase(), img);
    }
    const parsedBase = path.parse(img.originalname).name.toLowerCase();
    if (!imageByName.has(parsedBase)) {
      imageByName.set(parsedBase, img);
    }
  });

  // If entries is empty, build entries directly from uploaded images
  if (entries.length === 0) {
    // Check if filenames have timestamps
    const withTimestamps = uploadedImages
      .map((img, idx) => ({ img, idx, parsed: extractTimestampFromFilename(img.originalname) }))
      .filter((x) => x.parsed !== null);

    if (withTimestamps.length >= Math.max(1, Math.ceil(uploadedImages.length * 0.35))) {
      // Sort chronologically by timestamp, then naturally by original filename
      withTimestamps.sort((a, b) => {
        const ta = a.parsed.type === 'range' ? a.parsed.start : a.parsed.time;
        const tb = b.parsed.type === 'range' ? b.parsed.start : b.parsed.time;
        if (ta !== tb) return ta - tb;
        return a.img.originalname.localeCompare(b.img.originalname, undefined, { numeric: true });
      });

      // Check if timestamps are completely beyond audio duration
      if (audioDuration > 0) {
        const inRangeCount = withTimestamps.filter((s) => (s.parsed?.time || 0) < audioDuration).length;
        if (inRangeCount === 0) {
          // Fall back to evenly distributing across audio length
          const totalDur = audioDuration;
          const step = totalDur / uploadedImages.length;
          entries = uploadedImages.map((img, idx) => ({
            imageIndex: idx,
            imageName: img.originalname,
            start: Number((idx * step).toFixed(2)),
            end:
              idx === uploadedImages.length - 1
                ? Number(totalDur.toFixed(2))
                : Number(((idx + 1) * step).toFixed(2)),
          }));
        }
      }

      if (entries.length === 0) {
        const firstTime =
          withTimestamps[0]?.parsed?.type === 'range'
            ? withTimestamps[0].parsed.start
            : withTimestamps[0].parsed.time;

        if (firstTime > 0) {
          // Timestamps represent END transitions (e.g. first image ends at 0:06)
          let cursor = 0;
          let i = 0;
          while (i < withTimestamps.length) {
            const curTime =
              withTimestamps[i].parsed.type === 'range'
                ? withTimestamps[i].parsed.start
                : withTimestamps[i].parsed.time;
            let j = i;
            while (
              j < withTimestamps.length &&
              (withTimestamps[j].parsed.type === 'range'
                ? withTimestamps[j].parsed.start
                : withTimestamps[j].parsed.time) === curTime
            ) {
              j++;
            }
            const count = j - i;
            const startT = cursor;
            let endT = curTime;

            if (audioDuration > 0 && startT >= audioDuration - 0.05) {
              break; // Stop: image starts past audio duration
            }

            if (j === withTimestamps.length && audioDuration > endT) {
              endT = audioDuration;
            }

            if (audioDuration > 0 && endT > audioDuration) {
              endT = audioDuration;
            }

            const interval = Math.max(count * 0.3, endT - startT);
            const step = interval / count;
            for (let k = 0; k < count; k++) {
              const clipStart = Number((startT + k * step).toFixed(2));
              let clipEnd = Number((startT + (k + 1) * step).toFixed(2));
              if (audioDuration > 0 && clipEnd > audioDuration) {
                clipEnd = Number(audioDuration.toFixed(2));
              }
              if (audioDuration > 0 && clipStart >= audioDuration - 0.05) {
                break;
              }
              entries.push({
                imageIndex: withTimestamps[i + k].idx,
                imageName: withTimestamps[i + k].img.originalname,
                start: clipStart,
                end: clipEnd,
              });
            }
            cursor = endT;
            if (audioDuration > 0 && cursor >= audioDuration - 0.05) {
              break;
            }
            i = j;
          }
        } else {
          // firstTime === 0 (first image starts at 0:00, timestamps represent START markers)
          let i = 0;
          while (i < withTimestamps.length) {
            const curTime =
              withTimestamps[i].parsed.type === 'range'
                ? withTimestamps[i].parsed.start
                : withTimestamps[i].parsed.time;
            let j = i;
            while (
              j < withTimestamps.length &&
              (withTimestamps[j].parsed.type === 'range'
                ? withTimestamps[j].parsed.start
                : withTimestamps[j].parsed.time) === curTime
            ) {
              j++;
            }
            const count = j - i;
            const startT = curTime;

            if (audioDuration > 0 && startT >= audioDuration - 0.05) {
              break; // Stop: image starts past audio duration
            }

            let nextT;
            if (j < withTimestamps.length) {
              nextT =
                withTimestamps[j].parsed.type === 'range'
                  ? withTimestamps[j].parsed.start
                  : withTimestamps[j].parsed.time;
            } else {
              nextT = audioDuration > startT ? audioDuration : startT + 3.5 * count;
            }

            if (audioDuration > 0 && nextT > audioDuration) {
              nextT = audioDuration;
            }

            const interval = Math.max(count * 0.3, nextT - startT);
            const step = interval / count;
            for (let k = 0; k < count; k++) {
              const clipStart = Number((startT + k * step).toFixed(2));
              let clipEnd = Number((startT + (k + 1) * step).toFixed(2));
              if (audioDuration > 0 && clipEnd > audioDuration) {
                clipEnd = Number(audioDuration.toFixed(2));
              }
              if (audioDuration > 0 && clipStart >= audioDuration - 0.05) {
                break;
              }
              entries.push({
                imageIndex: withTimestamps[i + k].idx,
                imageName: withTimestamps[i + k].img.originalname,
                start: clipStart,
                end: clipEnd,
              });
            }
            i = j;
            if (audioDuration > 0 && nextT >= audioDuration - 0.05) {
              break;
            }
          }
        }

        // Clamp / extend last entry to audioDuration if audio is longer
        if (audioDuration > 0 && entries.length > 0) {
          const last = entries[entries.length - 1];
          if (last.end < audioDuration) {
            last.end = Number(audioDuration.toFixed(2));
          }
        }
      }
    } else {
      // Divide evenly across audio length
      const totalDur = audioDuration > 0 ? audioDuration : uploadedImages.length * 3.5;
      const count = uploadedImages.length;
      let usableCount = count;
      if (audioDuration > 0 && audioDuration / count < 1.0) {
        usableCount = Math.max(1, Math.floor(audioDuration / 1.0));
      }
      const step = totalDur / usableCount;
      entries = uploadedImages.slice(0, usableCount).map((img, idx) => ({
        imageIndex: idx,
        imageName: img.originalname,
        start: Number((idx * step).toFixed(2)),
        end:
          idx === usableCount - 1
            ? Number(totalDur.toFixed(2))
            : Number(((idx + 1) * step).toFixed(2)),
      }));
    }
  }

  function resolveImage(entry, entryIdx) {
    // 1. MATCH BY NAME FIRST (Deterministic, immune to Multer multipart ordering)
    const nameCandidate = entry.imageName || entry.image || entry.file || entry.name;
    if (nameCandidate) {
      const strVal = String(nameCandidate).trim();
      if (imageByName.has(strVal)) return imageByName.get(strVal);
      if (imageByName.has(strVal.toLowerCase())) return imageByName.get(strVal.toLowerCase());
      const baseOnly = path.parse(strVal).name.toLowerCase();
      if (imageByName.has(baseOnly)) return imageByName.get(baseOnly);

      // Timestamp matching fallback (e.g. "_0-06_" matching "_0-06__Image_Prompt-_STRI-...")
      const ts = extractTimestampFromFilename(strVal);
      if (ts) {
        const targetTime = ts.type === 'range' ? ts.start : ts.time;
        for (const img of uploadedImages) {
          const imgTs = extractTimestampFromFilename(img.originalname);
          if (imgTs && (imgTs.type === 'range' ? imgTs.start : imgTs.time) === targetTime) {
            const matchSuffix = strVal.match(/_(\d+)(?:\.[^.]+)?$/);
            const imgSuffix = img.originalname.match(/_(\d+)(?:\.[^.]+)?$/);
            if (!matchSuffix || !imgSuffix || matchSuffix[1] === imgSuffix[1]) {
              return img;
            }
          }
        }
      }
    }

    // 2. Fallback to imageIndex only if name is missing or unresolved
    if (typeof entry.imageIndex === 'number' && imageByIndex[entry.imageIndex]) {
      return imageByIndex[entry.imageIndex];
    }
    return imageByIndex[entryIdx] || null;
  }

  // Parse and calculate raw segments
  const parsedClips = [];
  let runningStart = 0;

  for (let i = 0; i < entries.length; i++) {
    const raw = entries[i];
    const matchedFile = resolveImage(raw, i);

    if (!matchedFile) {
      const availableNames = uploadedImages.map((img) => img.originalname).join(', ');
      throw new Error(
        `Clip #${i + 1} could not be matched to an uploaded image. Entry: ${JSON.stringify(
          raw
        )}. Available: [${availableNames}]`
      );
    }

    let start = null;
    let end = null;
    let duration = null;

    if (raw.start !== undefined || raw.startTime !== undefined || raw.from !== undefined) {
      const s = raw.start ?? raw.startTime ?? raw.from;
      start = parseFloat(s);
    }

    if (raw.end !== undefined || raw.endTime !== undefined || raw.to !== undefined) {
      const e = raw.end ?? raw.endTime ?? raw.to;
      end = parseFloat(e);
    }

    if (raw.duration !== undefined || raw.length !== undefined) {
      const d = raw.duration ?? raw.length;
      duration = parseFloat(d);
    }

    // Try extracting from filename if end not provided
    if (end === null && duration === null) {
      const fnParsed = extractTimestampFromFilename(matchedFile.originalname);
      if (fnParsed) {
        if (fnParsed.type === 'range') {
          start = fnParsed.start;
          end = fnParsed.end;
        } else if (fnParsed.type === 'point') {
          end = fnParsed.time;
        }
      }
    }

    if (start === null || isNaN(start)) {
      start = runningStart;
    }

    if (end !== null && !isNaN(end)) {
      if (end <= start) {
        throw new Error(
          `Clip #${i + 1} (${matchedFile.originalname}): 'end' (${end}s) must be greater than 'start' (${start}s).`
        );
      }
      duration = end - start;
    } else if (duration !== null && !isNaN(duration)) {
      if (duration <= 0) {
        throw new Error(
          `Clip #${i + 1} (${matchedFile.originalname}): 'duration' (${duration}s) must be positive.`
        );
      }
      end = start + duration;
    } else {
      duration = 3.0;
      end = start + 3.0;
    }

    runningStart = end;

    parsedClips.push({
      originalIndex: i,
      imageFile: matchedFile,
      imageName: matchedFile.originalname,
      filePath: matchedFile.path,
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
      duration: Number(duration.toFixed(3)),
      motion: raw.motion || 'none',
      transition: raw.transition || 'none',
    });
  }

  // Sort chronologically by start time
  parsedClips.sort((a, b) => a.start - b.start);

  // Normalize gaps and align with audio voiceover
  const normalizedClips = [];
  let currentTime = 0;

  for (let i = 0; i < parsedClips.length; i++) {
    const clip = parsedClips[i];

    // Gap before this clip?
    if (clip.start > currentTime + 0.001) {
      const gapDuration = Number((clip.start - currentTime).toFixed(3));
      warnings.push(
        `Timeline gap detected: ${currentTime}s to ${clip.start}s (${gapDuration}s). Bridging to preserve sync.`
      );
      if (normalizedClips.length === 0) {
        clip.start = 0;
        clip.duration = Number((clip.end - 0).toFixed(3));
      } else {
        const prev = normalizedClips[normalizedClips.length - 1];
        prev.end = clip.start;
        prev.duration = Number((clip.start - prev.start).toFixed(3));
      }
      currentTime = clip.start;
    }

    normalizedClips.push({
      imageName: clip.imageName,
      filePath: clip.filePath,
      start: currentTime,
      end: Number((currentTime + clip.duration).toFixed(3)),
      duration: clip.duration,
      motion: clip.motion || 'none',
      transition: clip.transition || 'none',
    });
    currentTime = Number((currentTime + clip.duration).toFixed(3));
  }

  // Check audio duration alignment and strictly trim any extra clips beyond audio
  const safeAudioDuration = typeof audioDuration === 'number' && audioDuration > 0 ? audioDuration : currentTime;
  const audioRounded = Number(safeAudioDuration.toFixed(3));

  if (safeAudioDuration > 0) {
    const fittingClips = [];
    for (const clip of normalizedClips) {
      if (clip.start >= safeAudioDuration - 0.05) {
        warnings.push(
          `Clip ${clip.imageName} starts at ${clip.start}s (exceeds audio length ${safeAudioDuration}s). Automatically trimmed and removed.`
        );
        continue;
      }
      if (clip.end > safeAudioDuration) {
        clip.end = safeAudioDuration;
        clip.duration = Number((clip.end - clip.start).toFixed(3));
      }
      fittingClips.push(clip);
    }
    normalizedClips.length = 0;
    normalizedClips.push(...fittingClips);
    currentTime = normalizedClips.length > 0 ? normalizedClips[normalizedClips.length - 1].end : 0;
  }

  if (currentTime < audioRounded - 0.05 && normalizedClips.length > 0) {
    const remainingTime = Number((audioRounded - currentTime).toFixed(3));
    const lastClip = normalizedClips[normalizedClips.length - 1];
    warnings.push(
      `Images timeline (${currentTime}s) is shorter than audio (${audioRounded}s). Extending last image (${lastClip.imageName}) by ${remainingTime}s.`
    );
    lastClip.duration = Number((lastClip.duration + remainingTime).toFixed(3));
    lastClip.end = audioRounded;
    currentTime = audioRounded;
  }

  // Generate ffconcat format file
  const concatFilePath = path.join(projectDir, 'concat.txt');
  const lines = ['ffconcat version 1.0'];

  normalizedClips.forEach((clip) => {
    const normalizedPath = clip.filePath.split(path.sep).join('/');
    const safePath = normalizedPath.replace(/'/g, "'\\''");
    lines.push(`file '${safePath}'`);
    lines.push(`duration ${clip.duration.toFixed(3)}`);
  });

  if (normalizedClips.length > 0) {
    const lastPath = normalizedClips[normalizedClips.length - 1].filePath.split(path.sep).join('/').replace(/'/g, "'\\''");
    lines.push(`file '${lastPath}'`);
  }

  fs.writeFileSync(concatFilePath, lines.join('\n'), 'utf8');

  return {
    clips: normalizedClips,
    concatFilePath,
    totalVisualDuration: currentTime,
    audioDuration: audioRounded,
    warnings,
    summary: {
      clipCount: normalizedClips.length,
      visualDurationSec: currentTime,
      audioDurationSec: audioRounded,
    },
  };
}

module.exports = {
  parseAndGenerateTimeline,
  extractTimestampFromFilename,
};
