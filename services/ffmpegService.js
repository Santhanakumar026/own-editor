const { spawn } = require('child_process');
const fs = require('fs');

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
 * Executes FFmpeg to render the synchronized video with custom aspect ratio and background styling.
 *
 * @param {Object} options
 * @param {string} options.concatFilePath - Path to concat.txt
 * @param {string} options.audioFilePath - Path to audio voiceover
 * @param {string} options.outputFilePath - Target output MP4 path
 * @param {number} options.totalDuration - Total duration in seconds
 * @param {string} [options.aspectRatio='16:9'] - '16:9' | '9:16' | '1:1'
 * @param {string} [options.backgroundMode='blur'] - 'blur' | 'black'
 * @param {Function} options.onProgress - Callback for real-time progress
 * @returns {Promise<Object>} - Render results
 */
function renderVideo({
  concatFilePath,
  audioFilePath,
  outputFilePath,
  totalDuration,
  aspectRatio = '16:9',
  backgroundMode = 'blur',
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
      : ['-f', 'lavfi', '-t', String(totalDuration), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'];

    const ffmpegArgs = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFilePath,
      ...audioInputs,
      ...filterArgs,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '20',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-shortest',
      outputFilePath,
    ];

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
            `FFmpeg exited with error code ${code}.\nLast stderr output:\n${stderrAccumulator.slice(-1500)}`
          )
        );
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start FFmpeg process: ${err.message}`));
    });
  });
}

module.exports = {
  probeAudioDuration,
  renderVideo,
};
