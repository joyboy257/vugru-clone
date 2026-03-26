import { writeFile, readFile } from 'fs/promises';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { logger } from './logger.js';

const FFMPEG_PATH = process.env.FFMPEG_PATH ?? 'ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH ?? 'ffprobe';
const VIDEO_MODEL_API_URL = process.env.VIDEO_MODEL_API_URL ?? '';
const VIDEO_MODEL_API_KEY = process.env.VIDEO_MODEL_API_KEY ?? '';

export interface ClipJobInput {
  clipId: string;
  photoBuffer: Buffer;
  photoFilename: string;
  motionStyle: string;
  resolution: string;
  duration: number;
  customPrompt?: string;
}

// ── Ken Burns presets ───────────────────────────────────────────────
const KEN_BURNS_PRESETS: Record<string, { zoom: string; pan: string }> = {
  'push-in':     { zoom: '1.0,1.25',   pan: '0:0' },
  'pan-left':    { zoom: '1.0,1.2',    pan: 'w:0' },
  'pan-right':   { zoom: '1.0,1.2',    pan: '-w:0' },
  'pan-up':      { zoom: '1.0,1.2',    pan: '0:-h' },
  'pan-down':    { zoom: '1.0,1.2',    pan: '0:h' },
  'zoom-in':     { zoom: '1.0,1.4',    pan: '0:0' },
  'zoom-out':    { zoom: '1.4,1.0',    pan: '0:0' },
  'slow-zoom':   { zoom: '1.0,1.15',  pan: '0:0' },
};

// ── Resolution dimensions ───────────────────────────────────────────
const RESOLUTION_MAP: Record<string, string> = {
  '720p':  '1280:720',
  '1080p': '1920:1080',
  '4k':    '3840:2160',
};

const DEFAULT_RES = '1280:720';

// ── Main entry point ─────────────────────────────────────────────────
export async function processClipJob(input: ClipJobInput): Promise<Buffer> {
  const { clipId, photoBuffer, motionStyle, resolution, duration, customPrompt } = input;

  const preset = KEN_BURNS_PRESETS[motionStyle] ?? KEN_BURNS_PRESETS['push-in'];
  const scale = RESOLUTION_MAP[resolution] ?? DEFAULT_RES;

  // Write photo to a temp file (ffmpeg requires a file path, not stdin for images)
  const tmpDir = tmpdir();
  const inputPath = join(tmpDir, `input-${clipId}.jpg`);
  const outputPath = join(tmpDir, `output-${clipId}.mp4`);

  await writeFile(inputPath, photoBuffer);

  logger.info(`[clip ${clipId}] Running Ken Burns — style=${motionStyle} res=${resolution} duration=${duration}s`);

  try {
    // Attempt AI upscaling/enhancement first if API is configured
    if (VIDEO_MODEL_API_URL && VIDEO_MODEL_API_KEY) {
      try {
        await enhanceWithAI(inputPath, input.photoFilename, customPrompt);
        logger.info(`[clip ${clipId}] AI enhancement applied`);
      } catch (err) {
        logger.warn(`[clip ${clipId}] AI enhancement skipped, falling back to ffmpeg`, err);
      }
    }

    // Run Ken Burns effect via ffmpeg
    runKenBurns(inputPath, outputPath, preset, scale, duration);

    const result = await readFile(outputPath);
    return result;
  } finally {
    // Clean up temp files
    try {
      const { unlink } = await import('fs/promises');
      await unlink(inputPath);
      await unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ── Ken Burns via ffmpeg ─────────────────────────────────────────────
// zoompan filter: zoom in from 1.0→1.25 over the clip duration,
//                 with optional pan to add lateral movement.
function runKenBurns(
  inputPath: string,
  outputPath: string,
  preset: { zoom: string; pan: string },
  scale: string,
  duration: number
): void {
  const [zoomStart, zoomEnd] = preset.zoom.split(',').map(Number);
  const frames = Math.round(duration * 25); // 25 fps

  // Build zoom/pan expression
  // interpolate zoom linearly between zoomStart and zoomEnd
  const zoomExpr = (
    `min(zoom+${((zoomEnd - zoomStart) / frames).toFixed(4)},${zoomEnd})`
  );

  const filterComplex = [
    `scale=${scale}`,                              // resize to target resolution
    `zoompan=z='${zoomExpr}':x=${preset.pan.split(':')[0]}:y=${preset.pan.split(':')[1]}:d=${frames}:s=${scale}`, // motion zoom
    `fps=25`,                                      // fixed 25 fps output
    `settb=1/25`,                                  // time base
  ].join(',');

  const args = [
    '-hide_banner',
    '-loglevel', 'warning',
    '-y',                       // overwrite output
    '-loop', '1',              // loop the input image
    '-i', inputPath,           // input photo
    '-filter_complex', filterComplex,
    '-t', String(duration),   // clip duration
    '-c:v', 'libx264',         // H.264 codec
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',     // ensure compatibility
    outputPath,
  ];

  logger.debug(`[ffmpeg] ${FFMPEG_PATH} ${args.join(' ')}`);

  try {
    execFileSync(FFMPEG_PATH, args, { stdio: 'pipe' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`ffmpeg Ken Burns failed: ${msg}`);
  }
}

// ── AI enhancement hook ───────────────────────────────────────────────
// Placeholder for AI upscale / img2video API integration.
// Replace the body of this function with your model's inference call.
// Expected: an img2img or text2video API that returns an MP4 buffer.
async function enhanceWithAI(
  _inputPath: string,
  _filename: string,
  _prompt?: string
): Promise<void> {
  // TODO: integrate your video model here
  // Example structure:
  //
  // const form = new FormData();
  // form.append('image', await readFile(inputPath));
  // form.append('prompt', prompt ?? 'cinematic real estate photography');
  // form.append('model', 'your-model-id');
  //
  // const response = await fetch(VIDEO_MODEL_API_URL, {
  //   method: 'POST',
  //   headers: { Authorization: `Bearer ${VIDEO_MODEL_API_KEY}` },
  //   body: form,
  // });
  //
  // if (!response.ok) {
  //   throw new Error(`AI model returned ${response.status}`);
  // }
  //
  // // Write AI output over the input path so ffmpeg uses the enhanced version
  // const buffer = Buffer.from(await response.arrayBuffer());
  // await writeFile(inputPath, buffer);

  // Stub: no-op for now
  logger.debug('[AI] Enhancement hook called but not implemented yet');
}
