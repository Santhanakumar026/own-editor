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
 * Helper to render an individual image into an ultrafast standardized video clip segment.
 * If user provided a brand logo, the logo is directly attached to the image at the watermark spot
 * BEFORE any motion is computed. This guarantees that when the camera zooms in, zooms out, or pans,
 * the logo travels WITH the image and permanently covers the watermark at all times with ZERO cropping!
 */
function renderClipSegment({
  imagePath,
  logoPath = null,
  logoPosition = 'bottom-right',
  logoWidth = 180,
  filterString,
  outputPath,
}) {
  const inputs = ['-i', imagePath];
  let filterPrefix = '';
  let sourceStream = '0:v';

  if (logoPath) {
    inputs.push('-i', logoPath);
    let overlayCoord = 'W-w-24:H-h-24';
    if (logoPosition === 'bottom-left') overlayCoord = '24:H-h-24';
    else if (logoPosition === 'top-right') overlayCoord = 'W-w-24:24';
    else if (logoPosition === 'top-left') overlayCoord = '24:24';
    else if (logoPosition === 'center') overlayCoord = '(W-w)/2:(H-h)/2';

    const safeW = Math.max(60, Math.min(600, parseInt(logoWidth, 10) || 180));
    filterPrefix = `[1:v]scale=${safeW}:-1[logo];[0:v][logo]overlay=${overlayCoord}[branded];`;
    sourceStream = 'branded';
  }

  const fullFilter = `${filterPrefix}[${sourceStream}]${filterString}[v]`;

  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', [
      '-y',
      ...inputs,
      '-filter_complex',
      fullFilter,
      '-map',
      '[v]',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      outputPath,
    ]);

    let errOutput = '';
    p.stderr.on('data', (d) => (errOutput += d.toString()));
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Clip render failed (code ${code}): ${errOutput.slice(-600)}`));
    });
    p.on('error', reject);
  });
}

/**
 * Runs the final assembly process with real-time progress calculation.
 */
function runFinalAssembly(ffmpegArgs, totalDuration, onProgress) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ffmpegArgs);
    let stderrAccumulator = '';

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderrAccumulator += text;

      if (stderrAccumulator.length > 50000) {
        stderrAccumulator = stderrAccumulator.slice(-25000);
      }

      if (onProgress && typeof onProgress === 'function') {
        const progress = parseProgressLine(text, totalDuration);
        if (progress) {
          // Scale from 45% to 99%
          const scaledPercent = Math.min(99, 45 + Math.round(progress.percent * 0.54));
          onProgress({
            ...progress,
            percent: scaledPercent,
          });
        }
      }
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else {
        reject(
          new Error(
            `FFmpeg final assembly exited with error code ${code}.\nLast stderr:\n${stderrAccumulator.slice(
              -1200
            )}`
          )
        );
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start FFmpeg assembly process: ${err.message}`));
    });
  });
}

/**
 * Robust Two-Stage Video Rendering Engine:
 * Stage 1: Individual clip motion rendering (flat ~40MB RAM, zero vibration, ultrafast).
 * Stage 2: Clean assembly with transitions, audio sync, and fixed logo overlay.
 *
 * @param {Object} options
 * @param {Array<Object>} options.clips - Normalized clips array with filePath, duration, motion, transition
 * @param {string} [options.audioFilePath] - Path to audio voiceover
 * @param {string} options.outputFilePath - Target output MP4 path
 * @param {number} options.totalDuration - Total duration in seconds
 * @param {string} [options.aspectRatio='16:9'] - '16:9' | '9:16' | '1:1'
 * @param {string} [options.backgroundMode='blur'] - 'blur' | 'black'
 * @param {boolean} [options.removeWatermark=false] - Auto remove Google Flow watermark
 * @param {string} [options.watermarkMode='crop'] - 'crop' (smart clean zoom) or 'delogo'
 * @param {string} [options.logoFilePath=null] - User uploaded brand logo to cover watermark
 * @param {string} [options.logoPosition='bottom-right'] - Default for Google Flow
 * @param {number} [options.logoWidth=160] - Logo width in pixels
 * @param {number} [options.transitionDuration=0.5] - Transition duration in seconds
 * @param {Function} [options.onProgress] - Callback for real-time progress
 * @returns {Promise<Object>} - Render results
 */
async function renderVideo({
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
  logoFilePath = null,
  logoPosition = 'bottom-right',
  logoWidth = 160,
  transitionDuration = 0.5,
  onProgress,
}) {
  const startTime = Date.now();
  let width = 1920;
  let height = 1080;

  if (aspectRatio === '9:16') {
    width = 1080;
    height = 1920;
  } else if (aspectRatio === '1:1') {
    width = 1080;
    height = 1080;
  }

  const transDur = Math.max(0.2, Math.min(0.8, Number(transitionDuration) || 0.5));
  const hasAnyTransition = clips && clips.some((c) => c.transition && c.transition !== 'none');

  // Create isolated temporary directory for segment outputs
  const tempDir = path.join(
    path.dirname(outputFilePath),
    `render_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  );
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    // ==============================================================
    // STAGE 1: INDIVIDUAL CLIP MOTION RENDERING (ZERO MEMORY BLOAT)
    // ==============================================================
    const segmentPaths = [];

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const segPath = path.join(tempDir, `seg_${i}.mp4`);
      segmentPaths.push(segPath);

      const hasPrevTrans =
        hasAnyTransition && i > 0 && clips[i - 1].transition && clips[i - 1].transition !== 'none';
      const effectiveDur = (hasPrevTrans ? transDur : 0) + clip.duration;
      const totalFrames = Math.max(15, Math.round(effectiveDur * 30));

      let motionFilter = '';
      const motion = clip.motion || 'none';

      if (motion === 'zoomin') {
        motionFilter = `scale=2880:2880:force_original_aspect_ratio=increase:flags=bicubic,zoompan=z='1.0+0.18*(on/${totalFrames})':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=30`;
      } else if (motion === 'zoomout') {
        motionFilter = `scale=2880:2880:force_original_aspect_ratio=increase:flags=bicubic,zoompan=z='1.18-0.18*(on/${totalFrames})':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=30`;
      } else if (motion === 'panleft') {
        motionFilter = `scale=2880:2880:force_original_aspect_ratio=increase:flags=bicubic,zoompan=z=1.15:d=${totalFrames}:x='(iw-iw/zoom)*(1-on/${totalFrames})':y='(ih-ih/zoom)/2':s=${width}x${height}:fps=30`;
      } else if (motion === 'panright') {
        motionFilter = `scale=2880:2880:force_original_aspect_ratio=increase:flags=bicubic,zoompan=z=1.15:d=${totalFrames}:x='(iw-iw/zoom)*(on/${totalFrames})':y='(ih-ih/zoom)/2':s=${width}x${height}:fps=30`;
      } else {
        if (backgroundMode === 'blur') {
          motionFilter = `split=2[main][bg];[bg]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=25:5[bl];[main]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg];[bl][fg]overlay=(${width}-w)/2:(${height}-h)/2,setsar=1,fps=30`;
        } else {
          motionFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30`;
        }
      }

      // Watermark filter only if NO logo is uploaded (zero cropping when logo is uploaded)
      let wmFilter = '';
      if (!logoFilePath && removeWatermark) {
        if (watermarkMode === 'delogo') {
          wmFilter = `delogo=x=W-170:y=H-70:w=160:h=60:band=1,`;
        } else {
          wmFilter = `scale=1.045*iw:1.045*ih,crop=iw/1.045:ih/1.045:(iw-ow)/2:(ih-oh)/2,`;
        }
      }

      // Render clip segment with logo attached directly on the image BEFORE motion
      // Logo moves WITH the image during zoom/pan, stays 100% locked on watermark, 0% image crop!
      await renderClipSegment({
        imagePath: clip.filePath,
        logoPath: logoFilePath,
        logoPosition,
        logoWidth,
        filterString: `${wmFilter}${motionFilter},format=yuv420p`,
        outputPath: segPath,
      });

      if (onProgress) {
        const pct = Math.min(45, Math.round(((i + 1) / clips.length) * 45));
        onProgress({
          percent: pct,
          currentSeconds: Number(((totalDuration * pct) / 100).toFixed(2)),
          totalDuration,
        });
      }
    }

    // ==============================================================
    // STAGE 2: ASSEMBLE WITH TRANSITIONS & AUDIO
    // (Logo is already baked onto each segment image with zero cropping)
    // ==============================================================
    if (!hasAnyTransition) {
      // SUB-CASE 2A: INSTANT CONCAT DEMUXER (ZERO RE-ENCODING DELAY)
      const concatListPath = path.join(tempDir, 'concat_list.txt');
      const lines = segmentPaths.map((sp) => `file '${sp.replace(/\\/g, '/')}'`).join('\n');
      fs.writeFileSync(concatListPath, lines, 'utf8');

      const inputs = ['-f', 'concat', '-safe', '0', '-i', concatListPath];
      let inputCount = 1;

      const audioIndex = inputCount;
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
      inputCount++;

      const ffmpegArgs = [
        '-y',
        ...inputs,
        '-map',
        '0:v',
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
        '-shortest',
        outputFilePath,
      ];

      await runFinalAssembly(ffmpegArgs, totalDuration, onProgress);
    } else {
      // SUB-CASE 2B: CAPCUT XFADE TRANSITIONS BETWEEN PRE-RENDERED SEGMENTS
      const inputs = [];
      let inputCount = 0;

      segmentPaths.forEach((sp) => {
        inputs.push('-i', sp);
        inputCount++;
      });

      const audioIndex = inputCount;
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
      inputCount++;

      const filterParts = [];
      let lastStream = '0:v';
      let currentCutTime = 0;

      for (let i = 0; i < clips.length - 1; i++) {
        const rawTrans = clips[i].transition || 'fade';
        const isCut = rawTrans === 'none';
        const trans = CAPCUT_TRANSITIONS.includes(rawTrans) ? rawTrans : 'fade';
        const curDur = isCut ? 0.05 : transDur;

        currentCutTime += clips[i].duration;
        const offset = Math.max(0.1, Number((currentCutTime - transDur).toFixed(3)));

        const nextStream = `${i + 1}:v`;
        const outStream = i === clips.length - 2 ? 'transv' : `xf${i}`;
        filterParts.push(
          `[${lastStream}][${nextStream}]xfade=transition=${trans}:duration=${curDur}:offset=${offset}[${outStream}]`
        );
        lastStream = outStream;
      }

      let finalVideoStream = clips.length > 1 ? 'transv' : '0:v';

      const scriptPath = path.join(tempDir, 'filter_graph.txt');
      fs.writeFileSync(scriptPath, filterParts.join(';\n'), 'utf8');

      const ffmpegArgs = [
        '-y',
        ...inputs,
        '-/filter_complex',
        scriptPath,
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

      await runFinalAssembly(ffmpegArgs, totalDuration, onProgress);
    }

    const renderDurationMs = Date.now() - startTime;
    if (onProgress) {
      onProgress({
        percent: 100,
        currentSeconds: totalDuration,
        totalDuration,
        renderDurationMs,
      });
    }

    const stats = fs.existsSync(outputFilePath) ? fs.statSync(outputFilePath) : null;
    return {
      success: true,
      outputFilePath,
      fileSize: stats ? stats.size : 0,
      renderDurationMs,
      width,
      height,
      aspectRatio,
    };
  } finally {
    // Always clean up the temporary directory and segment files
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (_) {}
  }
}

module.exports = {
  probeAudioDuration,
  renderVideo,
  CAPCUT_TRANSITIONS,
};
