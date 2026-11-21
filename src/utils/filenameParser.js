/**
 * Helper to convert MM:SS or MM-SS or HH:MM:SS or pure seconds string to total seconds (float).
 */
export function toSeconds(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const cleaned = String(str).trim();
  // Check MM:SS or MM-SS or HH:MM:SS
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
 * Intelligently extracts timestamps from image filenames.
 *
 * Supported Patterns:
 * 1. Explicit range: "[00:00 - 00:03].png", "[00-00 to 00-21].jpg", "0.0-3.5s.png"
 * 2. Underscored or bracketed clock: "_0-00_", "_0-06_", "[00-21]", "[00:24]", "_1-05_", "_9-36_"
 * 3. Seconds format: "[21s]", "21s", "_21s", "3.5s"
 * 4. Standalone clock anywhere in filename: "00:03", "00-21", "2-19"
 *
 * @param {string} filename
 * @returns {Object|null} - { type: 'point'|'range', time, start, end }
 */
export function extractTimestampFromFilename(filename) {
  if (!filename) return null;

  const name = filename.replace(/\.[^/.]+$/, '').trim();

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

  // Pattern 2: Underscored or bracketed Windows-safe MM-SS or MM:SS clock: _0-00_, _0-06_, [00-21], [00:03], _1-05_, _9-36_
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

  // Pattern 3: Pure seconds format: 21s, [21s], _21s, 3.5s
  const secMatch = name.match(/(?:^|[\[\(_\s])(\d+(?:\.\d+)?)\s*s(?:[\]\)_s\s]|$)/i);
  if (secMatch) {
    const sec = parseFloat(secMatch[1]);
    if (!isNaN(sec)) {
      return { type: 'point', time: Number(sec.toFixed(2)) };
    }
  }

  // Pattern 4: Fallback clock time anywhere in filename: "image_00:03.jpg" or "00:03_photo.png" or "00-21_scene.png"
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
 * Natural numerical sort for filenames so img1, img2, ..., img10 are ordered properly.
 */
export function naturalSortFiles(filesArray) {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return [...filesArray].sort((a, b) => collator.compare(a.name, b.name));
}

/**
 * Automatically builds frame-accurate timeline cuts from uploaded images and audio duration.
 * Guaranteed to prevent 0-duration clips, timing drift, and desync across any video length.
 *
 * @param {Array<Object>} images - Uploaded image objects
 * @param {number} audioDuration - Duration of audio in seconds
 * @returns {Object} { clips, autoSyncStatus }
 */
export function buildTimelineFromImages(images, audioDuration) {
  if (!images || images.length === 0) {
    return { clips: [], autoSyncStatus: null };
  }

  const parsedItems = images.map((img, idx) => ({
    name: img.name,
    file: img,
    originalIndex: idx,
    parsed: extractTimestampFromFilename(img.name),
  }));

  const withTimestamps = parsedItems.filter((item) => item.parsed !== null);

  // If at least 35% of images have timestamps, use timestamp-based timeline
  if (withTimestamps.length >= Math.max(1, Math.ceil(images.length * 0.35))) {
    // Check if explicit ranges are used
    const hasRanges = withTimestamps.some((item) => item.parsed?.type === 'range');

    if (hasRanges) {
      const sortedByStart = [...withTimestamps].sort((a, b) => {
        const sa = a.parsed?.start ?? 0;
        const sb = b.parsed?.start ?? 0;
        return sa - sb;
      });

      let cursor = 0;
      const clips = sortedByStart.map((item, idx) => {
        const start = item.parsed?.start ?? cursor;
        let end = item.parsed?.end ?? (start + 3.0);
        if (idx === sortedByStart.length - 1 && audioDuration > end) {
          end = audioDuration;
        }
        cursor = end;
        return {
          imageIndex: item.originalIndex,
          imageName: item.name,
          start: Number(start.toFixed(2)),
          end: Number(end.toFixed(2)),
          motion: 'none',
          transition: 'none',
        };
      });

      return {
        clips,
        autoSyncStatus: {
          type: 'filename_exact',
          message: `🎯 Exact Match: Extracted explicit start & end timestamps from ${withTimestamps.length} images!`,
        },
      };
    }

    // Sort items chronologically by timestamp, then naturally by original filename
    const sorted = [...withTimestamps].sort((a, b) => {
      const ta = a.parsed ? (a.parsed.type === 'range' ? a.parsed.start : a.parsed.time) : 0;
      const tb = b.parsed ? (b.parsed.type === 'range' ? b.parsed.start : b.parsed.time) : 0;
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

    const firstTime = sorted[0].parsed ? sorted[0].parsed.time : 0;
    const clips = [];

    if (firstTime > 0) {
      // Timestamps represent END transitions (e.g. first image ends at 0:06)
      let cursor = 0;
      let i = 0;
      while (i < sorted.length) {
        const curTime = sorted[i].parsed ? sorted[i].parsed.time : 0;
        let j = i;
        while (j < sorted.length && (sorted[j].parsed ? sorted[j].parsed.time : 0) === curTime) {
          j++;
        }
        const count = j - i;
        const startT = cursor;
        let endT = curTime;
        if (j === sorted.length && audioDuration > endT) {
          endT = audioDuration;
        }
        const interval = Math.max(count * 0.5, endT - startT);
        const step = interval / count;
        for (let k = 0; k < count; k++) {
          clips.push({
            imageIndex: sorted[i + k].originalIndex,
            imageName: sorted[i + k].name,
            start: Number((startT + k * step).toFixed(2)),
            end: Number((startT + (k + 1) * step).toFixed(2)),
            motion: 'none',
            transition: 'none',
          });
        }
        cursor = endT;
        i = j;
      }
    } else {
      // firstTime === 0 (first image starts at 0:00, timestamps represent START markers)
      let i = 0;
      while (i < sorted.length) {
        const curTime = sorted[i].parsed ? sorted[i].parsed.time : 0;
        let j = i;
        while (j < sorted.length && (sorted[j].parsed ? sorted[j].parsed.time : 0) === curTime) {
          j++;
        }
        const count = j - i;
        const startT = curTime;
        let nextT;
        if (j < sorted.length) {
          nextT = sorted[j].parsed ? sorted[j].parsed.time : 0;
        } else {
          nextT = audioDuration > startT ? audioDuration : startT + 3.5 * count;
        }
        const interval = Math.max(count * 0.5, nextT - startT);
        const step = interval / count;
        for (let k = 0; k < count; k++) {
          clips.push({
            imageIndex: sorted[i + k].originalIndex,
            imageName: sorted[i + k].name,
            start: Number((startT + k * step).toFixed(2)),
            end: Number((startT + (k + 1) * step).toFixed(2)),
            motion: 'none',
            transition: 'none',
          });
        }
        i = j;
      }
    }

    // Ensure final image perfectly spans to audioDuration if audio is longer
    if (audioDuration > 0 && clips.length > 0) {
      const last = clips[clips.length - 1];
      if (last.end < audioDuration) {
        last.end = Number(audioDuration.toFixed(2));
      }
    }

    return {
      clips,
      autoSyncStatus: {
        type: 'filename_exact',
        message: `🎯 Exact Match: Detected ${withTimestamps.length} timestamp cuts locked to audio voiceover!`,
      },
    };
  }

  // CASE 2: Normal filenames without timestamps -> distribute evenly across audio duration
  const totalDur = audioDuration > 0 ? audioDuration : images.length * 3.5;
  const count = images.length;
  const step = totalDur / count;

  const clips = images.map((img, idx) => {
    const start = Number((idx * step).toFixed(2));
    const end =
      idx === count - 1 ? Number(totalDur.toFixed(2)) : Number(((idx + 1) * step).toFixed(2));
    return {
      imageIndex: idx,
      imageName: img.name,
      start,
      end,
      motion: 'none',
      transition: 'none',
    };
  });

  return {
    clips,
    autoSyncStatus:
      audioDuration > 0
        ? {
            type: 'audio_auto',
            message: `🎯 Even Sync: ${count} images evenly locked across ${audioDuration.toFixed(
              1
            )}s voiceover (~${(totalDur / count).toFixed(2)}s per slide).`,
          }
        : {
            type: 'pending_audio',
            message: `📁 ${count} images ready. Upload audio to lock timeline cuts!`,
          },
  };
}
