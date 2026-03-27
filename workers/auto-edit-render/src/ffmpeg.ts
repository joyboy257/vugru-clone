import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Set FFmpeg path if specified
if (process.env.FULL_FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FULL_FFMPEG_PATH);
}

/**
 * Concatenate multiple MP4 clip buffers in order using the FFmpeg concat demuxer.
 * Returns the concatenated video buffer.
 */
export async function concatClips(clipBuffers: Buffer[]): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const inputFiles: string[] = [];
  const fileListPath = path.join(tmpDir, `filelist_${Date.now()}.txt`);

  try {
    for (let i = 0; i < clipBuffers.length; i++) {
      const inputPath = path.join(tmpDir, `clip_${Date.now()}_${i}.mp4`);
      fs.writeFileSync(inputPath, clipBuffers[i]);
      inputFiles.push(inputPath);
    }

    const fileListContent = inputFiles
      .map(f => `file '${f}'`)
      .join('\n');
    fs.writeFileSync(fileListPath, fileListContent, 'utf-8');

    const outputPath = path.join(tmpDir, `concat_${Date.now()}.mp4`);

    return await new Promise<Buffer>((resolve, reject) => {
      ffmpeg()
        .input(fileListPath)
        .inputOptions(['-f concat', '-safe 0'])
        .output(outputPath)
        .outputOptions(['-c copy'])
        .on('end', () => {
          const result = fs.readFileSync(outputPath);
          fs.unlinkSync(outputPath);
          resolve(result);
        })
        .on('error', (err) => reject(err))
        .run();
    });
  } finally {
    for (const f of inputFiles) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
    try { fs.unlinkSync(fileListPath); } catch { /* ignore */ }
  }
}

/**
 * Overlay title text on the first N seconds of the video using drawtext filter.
 * Uses a system DejaVu font; set FONT_PATH env var to override.
 */
export async function overlayTitle(
  videoBuffer: Buffer,
  titleText: string,
  durationSeconds = 3
): Promise<Buffer> {
  const fontPath = process.env.FONT_PATH || '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `input_${Date.now()}.mp4`);
  const outputPath = path.join(tmpDir, `titled_${Date.now()}.mp4`);

  try {
    fs.writeFileSync(inputPath, videoBuffer);

    const escapedTitle = titleText.replace(/'/g, "'\\''");

    return await new Promise<Buffer>((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(
          `drawtext=text='${escapedTitle}':fontsize=48:fontcolor=white:fontfile=${fontPath}:x=(w-text_w)/2:y=h-100:borderw=2:bordercolor=black:enable='between(t,0,${durationSeconds})'`
        )
        .output(outputPath)
        .on('end', () => {
          const result = fs.readFileSync(outputPath);
          fs.unlinkSync(outputPath);
          resolve(result);
        })
        .on('error', (err) => reject(err))
        .run();
    });
  } finally {
    try { fs.unlinkSync(inputPath); } catch { /* ignore */ }
  }
}

/**
 * Mix a music track with the video (video audio + music mixed together).
 * Music plays throughout the video duration. Uses amix filter.
 */
export async function mixMusic(
  videoBuffer: Buffer,
  musicBuffer: Buffer,
  _musicDuration?: number
): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const videoPath = path.join(tmpDir, `video_${Date.now()}.mp4`);
  const musicPath = path.join(tmpDir, `music_${Date.now()}.mp3`);
  const outputPath = path.join(tmpDir, `final_${Date.now()}.mp4`);

  try {
    fs.writeFileSync(videoPath, videoBuffer);
    fs.writeFileSync(musicPath, musicBuffer);

    return await new Promise<Buffer>((resolve, reject) => {
      (ffmpeg as any)
        .input(videoPath)
        .input(musicPath)
        .complexFilter('[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[aout]')
        .outputOptions(['-map 0:v', '-map "[aout]"'])
        .output(outputPath)
        .on('end', () => {
          const result = fs.readFileSync(outputPath);
          fs.unlinkSync(outputPath);
          resolve(result);
        })
        .on('error', (err) => reject(err))
        .run();
    });
  } finally {
    try { fs.unlinkSync(videoPath); } catch { /* ignore */ }
    try { fs.unlinkSync(musicPath); } catch { /* ignore */ }
  }
}

/**
 * Get video duration in seconds using FFmpeg.
 */
export async function getVideoDuration(videoBuffer: Buffer): Promise<number> {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `probe_${Date.now()}.mp4`);

  try {
    fs.writeFileSync(inputPath, videoBuffer);

    return await new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, data) => {
        if (err) {
          reject(err);
        } else {
          const duration = data?.format?.duration ?? 0;
          resolve(duration);
        }
      });
    });
  } finally {
    try { fs.unlinkSync(inputPath); } catch { /* ignore */ }
  }
}
