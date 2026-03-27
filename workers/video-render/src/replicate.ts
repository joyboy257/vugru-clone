import Replicate from 'replicate';
import type { MotionStyle, Resolution } from './types.js';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || '',
});

// Map PropFrame motion styles to Replicate model prompts
function buildPrompt(motionStyle: MotionStyle, customPrompt: string | null): string {
  const stylePrompts: Record<MotionStyle, string> = {
    'push-in': 'smooth push-in towards subject, cinematic, 8 seconds',
    'zoom-out': 'slow zoom out revealing room, cinematic, 8 seconds',
    'pan-left': 'slow pan left revealing space, cinematic, 8 seconds',
    'pan-right': 'slow pan right revealing space, cinematic, 8 seconds',
    'custom': '',
  };

  const base = customPrompt
    ? customPrompt.trim()
    : stylePrompts[motionStyle];

  return `${base}, high quality, smooth motion, real estate photography`;
}

export interface VideoGenResult {
  videoUrl: string; // URL of the generated video from Replicate
}

// DEPRECATED: This module contains CogVideoX-5B via Replicate.
// CogVideoX is NOT wired into gpu-worker/src/clipProcessor.ts.
// Active pipeline: Runway Gen-3 Alpha Turbo (providers/runway.ts) + SVD (providers/svd.ts).
// This file is kept for reference but should not be used in production.

// Generate video from image using CogVideoX on Replicate
// CogVideoX-5B is fast (30-60s) and produces good Ken Burns style motion
export async function generateClipVideo(
  imageUrl: string,
  motionStyle: MotionStyle,
  customPrompt: string | null,
  resolution: Resolution
): Promise<VideoGenResult> {
  const prompt = buildPrompt(motionStyle, customPrompt);
  const model = 'zsxkib/cogvideo-5b-filtered:4e39e939b89eec4af5e6c6cd9a5a3c20e3cfb9a6c0d3ee5fd71da5e58a63c0f4';

  // Duration: 5 seconds for clip-style output
  const numFrames = resolution === '720p' ? 49 : resolution === '1080p' ? 49 : 73;

  const output = await replicate.run(model, {
    input: {
      prompt,
      input_image: imageUrl,
      num_frames: numFrames,
      guidance_scale: 3.5,
      num_inference_steps: 25,
    },
  }) as unknown as { video: string } | string;

  // Replicate returns different structures depending on version
  const videoUrl = typeof output === 'string' ? output : (output as { video: string }).video;

  if (!videoUrl) {
    throw new Error('Replicate returned no video URL');
  }

  return { videoUrl };
}

// Poll a Replicate prediction until it completes
export async function pollReplicatePrediction(
  predictionId: string,
  maxWaitMs = 300000 // 5 minutes
): Promise<{ status: string; output?: unknown }> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const prediction = await replicate.predictions.get(predictionId);

    if (prediction.status === 'succeeded') {
      return { status: 'succeeded', output: prediction.output };
    }
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      return { status: prediction.status };
    }

    // Wait 5 seconds between polls
    await sleep(5000);
  }

  return { status: 'timeout' };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
