const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Retrieves the exact duration of an audio file in seconds using ffprobe.
 *
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<number>} - Duration in seconds
 */
function probeAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      audioPath,
    ]);

    let output = '';
    let errorOutput = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        return reject(
          new Error(`ffprobe failed with exit code ${code}: ${errorOutput || 'Unknown error'}`)
        );
      }
      const duration = parseFloat(output.trim());
      if (isNaN(duration) || duration <= 0) {
        return reject(
          new Error(`Could not determine audio duration from ffprobe output: "${output.trim()}"`)
        );
      }
      resolve(duration);
    });

    ffprobe.on('error', (err) => {
      reject(new Error(`Failed to execute ffprobe. Ensure FFmpeg is installed and in PATH: ${err.message}`));
    });
  });
}

/**
 * Parses FFmpeg stderr output to extract timestamp and rendering progress.
 *
 * @param {string} line - Output string from ffmpeg stderr
 * @param {number} totalDuration - Total audio/video duration in seconds
 * @returns {Object|null} - Progress info or null if no timestamp matched
 */
function parseProgressLine(line, totalDuration) {
  const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2,3})/);
  if (!timeMatch) return null;

  const hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);
  const seconds = parseInt(timeMatch[3], 10);
  const ms = parseFloat('0.' + timeMatch[4]);

  const currentSeconds = hours * 3600 + minutes * 60 + seconds + ms;
  let percent = 0;
  if (totalDuration > 0) {
    percent = Math.min(99, Math.round((currentSeconds / totalDuration) * 100));
  }

  const fpsMatch = line.match(/fps=\s*([\d.]+)/);
  const speedMatch = line.match(/speed=\s*([\d.]+x)/);

  return {
    currentSeconds: Number(currentSeconds.toFixed(2)),
    totalDuration: Number(totalDuration.toFixed(2)),
    percent,
    fps: fpsMatch ? fpsMatch[1] : null,
    speed: speedMatch ? speedMatch[1] : null,
  };
}

/**
 * Valid CapCut transitions supported by FFmpeg xfade
 */
const CAPCUT_TRANSITIONS = [
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
  'fadeblack',
  'smoothleft',
  'smoothright',
  'distance',
];

/**
 * Executes FFmpeg to render the synchronized video with custom aspect ratio,
 * dynamic CapCut transitions, keyframe motion (Zoom In/Out/Pan), and Google Flow watermark removal.
 *
 * @param {Object} options
 * @param {string} [options.concatFilePath] - Path to concat.txt (fallback for pure hard-cuts)
 * @param {Array<Object>} [options.clips] - Normalized clips array with filePath, duration, motion, transition
 * @param {string} [options.audioFilePath] - Path to audio voiceover
 * @param {string} options.outputFilePath - Target output MP4 path
 * @param {number} options.totalDuration - Total duration in seconds
 * @param {string} [options.aspectRatio='16:9'] - '16:9' | '9:16' | '1:1'
 * @param {string} [options.backgroundMode='blur'] - 'blur' | 'black'
 * @param {boolean} [options.removeWatermark=false] - Auto remove Google Flow watermark
 * @param {string} [options.watermarkMode='crop'] - 'crop' (smart clean zoom) or 'delogo'
 * @param {string} [options.watermarkPosition='bottom-right'] - Default for Google Flow
 * @param {number} [options.transitionDuration=0.5] - Transition duration in seconds
 * @param {Function} [options.onProgress] - Callback for real-time progress
 * @returns {Promise<Object>} - Render results
 */
function renderVideo({
  concatFilePath,
  clips = [],
  audioFilePath,
  outputFilePath,
  totalDuration,
  aspectRatio = '16:9',
  backgroundMode = 'blur',
  removeWatermark = false,
  watermarkMode = 'crop',
  watermarkPosition = 'bottom-right',
  transitionDuration = 0.5,
  onProgress,
}) {
  return new Promise((resolve, reject) => {
    let width = 1920;
    let height = 1080;

    if (aspectRatio === '9:16') {
      width = 1080;
      height = 1920;
    } else if (aspectRatio === '1:1') {
      width = 1080;
      height = 1080;
    }

    // Check if motion keyframes, transitions, or watermark removal are active
    const hasEffects =
      Boolean(removeWatermark) ||
      (clips &&
        clips.length > 0 &&
        clips.some(
          (c) =>
            (c.motion && c.motion !== 'none') ||
            (c.transition && c.transition !== 'none')
        ));

    let ffmpegArgs = [];
    let filterGraphPath = null;

    // ==============================================================
    // PIPELINE 1: ADVANCED CAPCUT MOTION + XFADE + WATERMARK REMOVAL
    // ==============================================================
    if (hasEffects && clips && clips.length > 0) {
      const inputs = [];
      const filterParts = [];
      const transDur = Math.max(0.2, Math.min(0.8, Number(transitionDuration) || 0.5));

      // 1. Add all clip image inputs (0 to clips.length - 1)
      clips.forEach((clip) => {
        inputs.push('-i', clip.filePath);
      });

      // 2. Add audio input as input #${clips.length}
      const audioIndex = clips.length;
      if (audioFilePath) {
        inputs.push('-i', audioFilePath);
      } else {
        inputs.push(
          '-f',
          'lavfi',
          '-t',
          String(totalDuration),
          '-i',
          'anullsrc=channel_layout=stereo:sample_rate=44100'
        );
      }

      // Watermark filter prefix:
      // In Google Flow, watermark is at bottom-right corner.
      // Scaling up by 4.5% gently trims the outer watermark margin cleanly with ZERO blur artifacts.
      let wmFilter = '';
      if (removeWatermark) {
        if (watermarkMode === 'delogo') {
          // Blur the bottom-right corner box
          wmFilter = `delogo=x=W-170:y=H-70:w=160:h=60:band=1,`;
        } else {
          // Smart clean re-frame: crops 4.5% edge
          wmFilter = `scale=1.045*iw:1.045*ih,crop=iw/1.045:ih/1.045:(iw-ow)/2:(ih-oh)/2,`;
        }
      }

      let currentCutTime = 0;
      const xfadeOffsets = [];

      // 3. Build per-clip motion filter
      clips.forEach((clip, idx) => {
        const hasPrevTrans = idx > 0 && clips[idx - 1].transition && clips[idx - 1].transition !== 'none';
        const effectiveDur = (hasPrevTrans ? transDur : 0) + clip.duration;
        const totalFrames = Math.max(15, Math.round(effectiveDur * 30));

        let motionFilter = '';
        const motion = clip.motion || 'none';

        if (motion === 'zoomin') {
          motionFilter = `zoompan=z='min(zoom+0.0018,1.22)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=30`;
        } else if (motion === 'zoomout') {
          motionFilter = `zoompan=z='if(lte(zoom,1.0),1.22,max(1.001,zoom-0.0018))':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=30`;
        } else if (motion === 'panleft') {
          motionFilter = `zoompan=z=1.12:d=${totalFrames}:x='if(lte(on,1),(iw-iw/zoom)/2,x+1)':y='(ih-ih/zoom)/2':s=${width}x${height}:fps=30`;
        } else if (motion === 'panright') {
          motionFilter = `zoompan=z=1.12:d=${totalFrames}:x='if(lte(on,1),(iw-iw/zoom)/2,x-1)':y='(ih-ih/zoom)/2':s=${width}x${height}:fps=30`;
        } else {
          // Static fit with aspect ratio
          if (backgroundMode === 'blur') {
            motionFilter = `split=2[main${idx}][bg${idx}];[bg${idx}]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=25:5[bl${idx}];[main${idx}]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg${idx}];[bl${idx}][fg${idx}]overlay=(${width}-w)/2:(${height}-h)/2,setsar=1,fps=30`;
          } else {
            motionFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30`;
          }
        }

        filterParts.push(`[${idx}:v]${wmFilter}${motionFilter},settb=AVTB,format=yuv420p[v${idx}]`);

        if (idx < clips.length - 1) {
          currentCutTime += clip.duration;
          const safeOffset = Math.max(0.1, Number((currentCutTime - transDur).toFixed(3)));
          xfadeOffsets.push(safeOffset);
        }
      });

      // 4. Connect streams: xfade transitions or concat
      const hasAnyTransition = clips.some(
        (c) => c.transition && c.transition !== 'none'
      );

      let finalVideoStream = 'v0';
      if (clips.length > 1) {
        if (!hasAnyTransition) {
          // Pure hard cuts with motion keyframes: use concat filter for zero drift
          const streamList = clips.map((_, i) => `[v${i}]`).join('');
          filterParts.push(`${streamList}concat=n=${clips.length}:v=1:a=0[finalv]`);
          finalVideoStream = 'finalv';
        } else {
          // Chain xfade transitions between clips
          let lastStream = 'v0';
          for (let i = 0; i < clips.length - 1; i++) {
            const rawTrans = clips[i].transition || 'fade';
            const isCut = rawTrans === 'none';
            const trans = CAPCUT_TRANSITIONS.includes(rawTrans) ? rawTrans : 'fade';
            const curDur = isCut ? 0.05 : transDur;
            const nextStream = `v${i + 1}`;
            const outStream = i === clips.length - 2 ? 'finalv' : `xf${i}`;
            filterParts.push(
              `[${lastStream}][${nextStream}]xfade=transition=${trans}:duration=${curDur}:offset=${xfadeOffsets[i]}[${outStream}]`
            );
            lastStream = outStream;
          }
          finalVideoStream = 'finalv';
        }
      }

      const filterComplexString = filterParts.join(';\n');

      // Write complex filtergraph to file using FFmpeg's native '-/filter_complex' syntax
      // This completely avoids Windows' 32,767 character command-line limit (spawn ENAMETOOLONG)
      filterGraphPath = path.join(
        path.dirname(outputFilePath),
        `filter_graph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.txt`
      );
      fs.writeFileSync(filterGraphPath, filterComplexString, 'utf8');

      ffmpegArgs = [
        '-y',
        ...inputs,
        '-/filter_complex',
        filterGraphPath,
        '-map',
        `[${finalVideoStream}]`,
        '-map',
        `${audioIndex}:a`,
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '20',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-shortest',
        outputFilePath,
      ];
    } else {
      // ==============================================================
      // PIPELINE 2: LIGHTNING-FAST CONCAT DEMUXER (HARD CUTS)
      // ==============================================================
      let filterArgs = [];

      if (backgroundMode === 'blur') {
        const filterString = `[0:v]split=2[main][bg];[bg]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=25:5[blurred];[main]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg];[blurred][fg]overlay=(${width}-w)/2:(${height}-h)/2,setsar=1,fps=30,format=yuv420p[v]`;
        filterArgs = ['-filter_complex', filterString, '-map', '[v]', '-map', '1:a'];
      } else {
        const filterString = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p`;
        filterArgs = ['-filter_complex', `[0:v]${filterString}[v]`, '-map', '[v]', '-map', '1:a'];
      }

      const audioInputs = audioFilePath
        ? ['-i', audioFilePath]
        : [
            '-f',
            'lavfi',
            '-t',
            String(totalDuration),
            '-i',
            'anullsrc=channel_layout=stereo:sample_rate=44100',
          ];

      ffmpegArgs = [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        concatFilePath,
        ...audioInputs,
        ...filterArgs,
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '20',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-shortest',
        outputFilePath,
      ];
    }

    const child = spawn('ffmpeg', ffmpegArgs);
    let stderrAccumulator = '';
    const startTime = Date.now();

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderrAccumulator += text;

      if (stderrAccumulator.length > 50000) {
        stderrAccumulator = stderrAccumulator.slice(-25000);
      }

      if (onProgress && typeof onProgress === 'function') {
        const progress = parseProgressLine(text, totalDuration);
        if (progress) {
          onProgress(progress);
        }
      }
    });

    child.on('close', (code) => {
      // Clean up temporary filter script file
      if (filterGraphPath && fs.existsSync(filterGraphPath)) {
        try {
          fs.unlinkSync(filterGraphPath);
        } catch (_) {}
      }

      const renderDurationMs = Date.now() - startTime;
      if (code === 0) {
        if (onProgress) {
          onProgress({
            percent: 100,
            currentSeconds: totalDuration,
            totalDuration,
            renderDurationMs,
          });
        }

        const stats = fs.existsSync(outputFilePath) ? fs.statSync(outputFilePath) : null;
        resolve({
          success: true,
          outputFilePath,
          fileSize: stats ? stats.size : 0,
          renderDurationMs,
          width,
          height,
          aspectRatio,
        });
      } else {
        reject(
          new Error(
            `FFmpeg exited with error code ${code}.\nLast stderr output:\n${stderrAccumulator.slice(
              -1500
            )}`
          )
        );
      }
    });

    child.on('error', (err) => {
      if (filterGraphPath && fs.existsSync(filterGraphPath)) {
        try {
          fs.unlinkSync(filterGraphPath);
        } catch (_) {}
      }
      reject(new Error(`Failed to start FFmpeg process: ${err.message}`));
    });
  });
}

module.exports = {
  probeAudioDuration,
  renderVideo,
  CAPCUT_TRANSITIONS,
};
