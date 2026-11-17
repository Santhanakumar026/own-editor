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
 * 1. Windows Hyphenated Clock: "[00-21]_Create_one_16.png", "[00-24]", "[01-15]"
 * 2. Standard Colon Clock: "[00:21]", "[00:03.50]", "[01:15]"
 * 3. Range marker: "[00:00 - 00:03].png", "[00-00 to 00-21].jpg", "0.0-3.5s.png"
 * 4. Seconds format: "[21s]", "[3.5s]"
 *
 * @param {string} filename
 * @returns {Object|null} - { type: 'point'|'range', time, start, end }
 */
export function extractTimestampFromFilename(filename) {
  if (!filename) return null;

  const name = filename.replace(/\.[^/.]+$/, '').trim();

  // Pattern 1: Explicit Range (TWO timestamps separated by "to" or " - " or "_to_")
  // e.g. [00:00 - 00:03], [00-00 to 00-21], [0.0 - 3.5]
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

  // Pattern 2: Bracketed Windows-safe MM-SS or MM:SS clock: [00-21], [00-24], [00:03], [01-15]
  const bracketClockMatch = name.match(
    /(?:\[|\()\s*(\d{1,2})[-:_](\d{2}(?:\.\d+)?)\s*(?:\]|\))/
  );
  if (bracketClockMatch) {
    const mins = parseFloat(bracketClockMatch[1]);
    const secs = parseFloat(bracketClockMatch[2]);
    if (!isNaN(mins) && !isNaN(secs)) {
      const totalSec = mins * 60 + secs;
      return { type: 'point', time: Number(totalSec.toFixed(2)) };
    }
  }

  // Pattern 3: Bracketed pure seconds: [21s], [3.5s], [3.5], [21]
  const bracketSecMatch = name.match(/(?:\[|\()\s*(\d+(?:\.\d+)?)\s*s?\s*(?:\]|\))/i);
  if (bracketSecMatch) {
    const sec = parseFloat(bracketSecMatch[1]);
    if (!isNaN(sec)) {
      return { type: 'point', time: Number(sec.toFixed(2)) };
    }
  }

  // Pattern 4: Standalone clock time: "image_00:03.jpg" or "00:03_photo.png" or "00-21_scene.png"
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
    image: img,
    index: idx,
    name: img.name,
    parsed: extractTimestampFromFilename(img.name),
  }));

  const imagesWithTimestamps = parsedItems.filter((item) => item.parsed !== null);

  // CASE 1: All or majority of images have timestamp filenames (like [00-21], [00-24])
  if (imagesWithTimestamps.length >= Math.ceil(images.length * 0.5)) {
    const hasRanges = parsedItems.some((item) => item.parsed?.type === 'range');

    if (hasRanges) {
      const sortedByStart = [...parsedItems].sort((a, b) => {
        const sa = a.parsed?.start ?? 0;
        const sb = b.parsed?.start ?? 0;
        return sa - sb;
      });

      const clips = sortedByStart.map((item, idx) => {
        const start = item.parsed?.start ?? (idx > 0 ? sortedByStart[idx - 1].parsed?.end : 0);
        const end = item.parsed?.end ?? (start + 3.0);
        return {
          imageIndex: item.index,
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
          message: `🎯 Exact Match: Extracted explicit start & end timestamps from ${imagesWithTimestamps.length} images!`,
        },
      };
    } else {
      // Single marker points: e.g. [00-21], [00-24], [00-26]
      const sortedByTime = [...parsedItems].sort((a, b) => {
        const ta = a.parsed?.time ?? 0;
        const tb = b.parsed?.time ?? 0;
        return ta - tb;
      });

      const firstIsZero = sortedByTime[0]?.parsed?.time === 0;
      let clips = [];

      if (firstIsZero) {
        // [00-00], [00-21], [00-24]
        clips = sortedByTime.map((item, idx) => {
          const start = item.parsed?.time ?? 0;
          let end;
          if (idx < sortedByTime.length - 1) {
            end = sortedByTime[idx + 1].parsed?.time ?? (start + 3.0);
          } else {
            end = audioDuration > start ? audioDuration : start + 3.0;
          }
          return {
            imageIndex: item.index,
            imageName: item.name,
            start: Number(start.toFixed(2)),
            end: Number(end.toFixed(2)),
            motion: 'none',
            transition: 'none',
          };
        });
      } else {
        // First image is [00-21], second is [00-24], third is [00-26]
        // Image 0: 00:00 -> 00:21 (trimmed at exact 00:21 audio timing!)
        // Image 1: 00:21 -> 00:24 (trimmed at exact 00:24 audio timing!)
        // Image 2: 00:24 -> 00:26 (trimmed at exact 00:26 audio timing!)
        let cursor = 0;
        clips = sortedByTime.map((item, idx) => {
          const start = cursor;
          let end = item.parsed?.time ?? (start + 3.0);

          if (idx === sortedByTime.length - 1 && audioDuration > end) {
            end = audioDuration;
          }

          cursor = end;
          return {
            imageIndex: item.index,
            imageName: item.name,
            start: Number(start.toFixed(2)),
            end: Number(end.toFixed(2)),
            motion: 'none',
            transition: 'none',
          };
        });
      }

      return {
        clips,
        autoSyncStatus: {
          type: 'filename_exact',
          message: `🎯 Exact Match: Detected ${imagesWithTimestamps.length} timestamp cuts (e.g. [00-21], [00-24]) locked to audio!`,
        },
      };
    }
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
