/**
 * Test script for clip generation pipeline.
 * 
 * Usage:
 *   npx ts-node scripts/test-clip-generation.ts <photo-r2-url>
 * 
 * Example:
 *   npx ts-node scripts/test-clip-generation.ts https://example.r2.dev/photos/abc123.jpg
 * 
 * IMPORTANT: This script does NOT call the actual Replicate/Runway/SVD API.
 * It validates the pipeline configuration and logs what would be called.
 * 
 * To run with real credentials:
 *   1. Set REPLICATE_API_TOKEN, RUNWAY_API_KEY, or MODAL_SVD_ENDPOINT in .env
 *   2. Set DRY_RUN=false
 */

import { parseArgs } from 'util';

// ── Configuration ──────────────────────────────────────────────────────────────

const CONFIG = {
  /** Set to false to actually call the video provider API (costs money) */
  DRY_RUN: true,
  
  /** Video provider to use: 'runway', 'svd', 'replicate', or 'none' (ffmpeg only) */
  VIDEO_PROVIDER: process.env.VIDEO_PROVIDER ?? 'none',
  
  /** Replicate CogVideoX model ID */
  COGVIDEO_MODEL_ID: 'zsxkib/cogvideo-5b-filtered:4e39e939b89eec4af5e6c6cd9a5a3c20e3cfb9a6c0d3ee5fd71da5e58a63c0f4',
  
  /** Runway Gen-3 model */
  RUNWAY_MODEL: 'gen3a_turbo',
  
  /** SVD model */
  SVD_MODEL: 'stabilityai/stable-video-diffusion-img2vid',
  
  /** Default motion style */
  MOTION_STYLE: 'push-in',
  
  /** Default resolution */
  RESOLUTION: '720p' as const,
  
  /** Default duration in seconds */
  DURATION: 5,
};

// ── Argument parsing ───────────────────────────────────────────────────────────

function parseArguments() {
  const { values } = parseArgs({
    options: {
      'photo-url': { type: 'string', short: 'p' },
      'dry-run': { type: 'boolean', default: true },
      'provider': { type: 'string', short: 'v' },
      'resolution': { type: 'string', short: 'r' },
      'motion-style': { type: 'string', short: 'm' },
      'help': { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  const photoUrl = values['photo-url'];
  if (!photoUrl) {
    console.error('Error: --photo-url is required');
    printUsage();
    process.exit(1);
  }

  return {
    photoUrl,
    dryRun: values['dry-run'] ?? CONFIG.DRY_RUN,
    provider: values.provider ?? CONFIG.VIDEO_PROVIDER,
    resolution: (values.resolution ?? CONFIG.RESOLUTION) as '720p' | '1080p' | '4k',
    motionStyle: values['motion-style'] ?? CONFIG.MOTION_STYLE,
  };
}

function printUsage() {
  console.log(`
Test Clip Generation Pipeline

Usage:
  npx ts-node scripts/test-clip-generation.ts --photo-url <url> [options]

Options:
  --photo-url, -p <url>    R2 URL of the photo to test (required)
  --dry-run                Don't call external APIs (default: true)
  --provider, -v <name>     Video provider: runway, svd, replicate, none (default: none)
  --resolution, -r <res>   Resolution: 720p, 1080p, 4k (default: 720p)
  --motion-style, -m <s>   Motion style (default: push-in)
  --help, -h               Show this help message

Examples:
  # Dry run with no provider (FFmpeg Ken Burns only)
  npx ts-node scripts/test-clip-generation.ts -p https://example.r2.dev/photo.jpg

  # Dry run with Runway
  VIDEO_PROVIDER=runway npx ts-node scripts/test-clip-generation.ts -p https://example.r2.dev/photo.jpg

  # Actual Runway call (costs money!)
  VIDEO_PROVIDER=runway DRY_RUN=false npx ts-node scripts/test-clip-generation.ts -p https://example.r2.dev/photo.jpg

Providers:
  runway     Runway Gen-3 Alpha Turbo (recommended — fast, good quality)
  svd        Stable Video Diffusion on Modal.com (self-hosted)
  replicate  CogVideoX-5B on Replicate (LEGACY — not wired into clipProcessor)
  none       FFmpeg Ken Burns only (no AI generation)

Credit costs (from lib/credits.ts):
  720p: 1 credit | 1080p: 2 credits | 4k: 4 credits
`);
}

// ── Credit calculation ─────────────────────────────────────────────────────────

function getClipCost(resolution: '720p' | '1080p' | '4k'): number {
  switch (resolution) {
    case '720p': return 1;
    case '1080p': return 2;
    case '4k': return 4;
  }
}

function getResolutionFrames(resolution: '720p' | '1080p' | '4k'): number {
  switch (resolution) {
    case '720p': return 49;
    case '1080p': return 49;
    case '4k': return 73;
  }
}

// ── Motion prompt builder (mirrors gpu-worker/src/clipProcessor.ts) ───────────

function buildMotionPrompt(style: string, customPrompt?: string): string {
  const styleDescriptions: Record<string, string> = {
    'push-in':    'slow dolly push-in towards the room',
    'pan-left':   'slow pan left revealing the space',
    'pan-right':  'slow pan right revealing the space',
    'pan-up':     'slow pan up through the room',
    'pan-down':   'slow pan down through the room',
    'zoom-in':    'slow zoom in highlighting details',
    'zoom-out':   'slow zoom out showing context',
    'slow-zoom':  'cinematic slow zoom in',
  };

  const base = styleDescriptions[style] ?? 'slow cinematic camera movement through the space';

  if (customPrompt?.trim()) {
    return `${customPrompt.trim()}. ${base}.`;
  }

  return `Real estate photography. ${base}. Professional, high-end property showcase.`;
}

// ── Provider validation ────────────────────────────────────────────────────────

interface ProviderInfo {
  name: string;
  modelId: string;
  isActive: boolean;
  notes: string;
}

function getProviderInfo(providerName: string): ProviderInfo {
  const providers: Record<string, ProviderInfo> = {
    runway: {
      name: 'Runway Gen-3 Alpha Turbo',
      modelId: 'gen3a_turbo',
      isActive: true,
      notes: 'Primary production provider. Fast (10-30s), good quality. Costs ~$0.05/clip.',
    },
    svd: {
      name: 'Stable Video Diffusion (Modal)',
      modelId: 'stabilityai/stable-video-diffusion-img2vid',
      isActive: true,
      notes: 'Self-hosted on Modal.com. Requires MODAL_SVD_ENDPOINT + MODAL_SVD_API_TOKEN.',
    },
    replicate: {
      name: 'CogVideoX-5B (Replicate)',
      modelId: 'zsxkib/cogvideo-5b-filtered:4e39e939b89eec4af5e6c6cd9a5a3c20e3cfb9a6c0d3ee5fd71da5e58a63c0f4',
      isActive: false, // LEGACY — not wired into clipProcessor.ts
      notes: '⚠️  LEGACY: This provider exists in replicate.ts but is NOT wired into clipProcessor.ts. The active providers are Runway and SVD.',
    },
    none: {
      name: 'FFmpeg Ken Burns (no AI)',
      modelId: 'N/A',
      isActive: true,
      notes: 'Pure FFmpeg Ken Burns effect. No API cost, no AI quality.',
    },
  };

  return providers[providerName] ?? {
    name: providerName,
    modelId: 'unknown',
    isActive: false,
    notes: 'Unknown provider',
  };
}

// ── Main test function ─────────────────────────────────────────────────────────

async function runTest(opts: Awaited<ReturnType<typeof parseArguments>>) {
  console.log('\n🎬 PropFrame Clip Generation Test\n');
  console.log('═'.repeat(60));
  
  // 1. Validate photo URL
  console.log('\n📋 Step 1: Validate photo URL');
  console.log(`  Photo URL: ${opts.photoUrl}`);
  
  try {
    const url = new URL(opts.photoUrl);
    console.log(`  ✅ Valid URL format (${url.protocol})`);
  } catch {
    console.log(`  ⚠️  Warning: URL may not be valid`);
  }

  // 2. Check provider configuration
  console.log('\n📋 Step 2: Provider configuration');
  console.log(`  Requested provider: ${opts.provider}`);
  
  const provider = getProviderInfo(opts.provider);
  console.log(`  Provider name: ${provider.name}`);
  console.log(`  Model ID: ${provider.modelId}`);
  console.log(`  Active: ${provider.isActive ? '✅ Yes' : '❌ No (LEGACY)'}`);
  console.log(`  Notes: ${provider.notes}`);

  if (!provider.isActive) {
    console.log('\n  ⚠️  WARNING: This provider is not wired into the active pipeline!');
    console.log('  The active providers are: runway, svd');
    console.log('  To use CogVideoX, you would need to wire it into providers/index.ts');
  }

  // 3. Credit cost
  console.log('\n📋 Step 3: Credit cost calculation');
  const cost = getClipCost(opts.resolution);
  console.log(`  Resolution: ${opts.resolution}`);
  console.log(`  Credit cost: ${cost} credit(s)`);
  console.log(`  At $0.008/credit (base rate): ~$${(cost * 0.008).toFixed(3)}`);

  // 4. Motion prompt
  console.log('\n📋 Step 4: Motion prompt');
  const motionPrompt = buildMotionPrompt(opts.motionStyle);
  console.log(`  Motion style: ${opts.motionStyle}`);
  console.log(`  Generated prompt: "${motionPrompt}"`);

  // 5. Frame calculation
  console.log('\n📋 Step 5: Frame configuration');
  const frames = getResolutionFrames(opts.resolution);
  console.log(`  Frames: ${frames}`);
  console.log(`  Duration: ${CONFIG.DURATION}s`);
  console.log(`  FPS: 25`);

  // 6. Dry run summary
  console.log('\n📋 Step 6: API call simulation');
  
  if (opts.dryRun) {
    console.log('  🚫 DRY RUN — No actual API calls will be made');
    console.log('\n  To run with real credentials:');
    console.log('    1. Set appropriate API key in .env.local');
    console.log('    2. Set DRY_RUN=false');
    console.log('    3. Run this script again');
    
    console.log('\n  Sample API call that would be made:');
    
    if (opts.provider === 'runway') {
      console.log(`
  POST https://api.runwayml.com/v1/image_to_video
  {
    "image_url": "${opts.photoUrl}",
    "prompt": "${motionPrompt}",
    "duration": ${Math.min(CONFIG.DURATION, 10)},
    "model": "gen3a_turbo"
  }`);
    } else if (opts.provider === 'svd') {
      console.log(`
  POST <MODAL_SVD_ENDPOINT>/generate
  {
    "image_url": "${opts.photoUrl}",
    "prompt": "${motionPrompt}",
    "num_frames": ${frames},
    "fps": 24,
    "motion_bucket_id": 127
  }`);
    } else if (opts.provider === 'replicate') {
      console.log(`
  Replicate.run("zsxkib/cogvideo-5b-filtered:...")
  {
    "input": {
      "prompt": "${motionPrompt}",
      "input_image": "${opts.photoUrl}",
      "num_frames": ${frames},
      "guidance_scale": 3.5,
      "num_inference_steps": 25
    }
  }`);
    } else {
      console.log(`
  ffmpeg -loop 1 -i <photo> -vf "zoompan=..." -t ${CONFIG.DURATION} output.mp4
  
  No external API — pure FFmpeg Ken Burns effect`);
    }
  } else {
    console.log('  🔴 LIVE RUN — Calling actual API (costs money!)');
    console.log('  Press Ctrl+C to abort, or wait 5 seconds to continue...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Actual API call would go here
    // For safety, we don't implement this in the dry-run script
    console.log('\n  ❌ Not implemented — add actual API call here');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Test complete\n');
}

// ── Entry point ─────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArguments();
  await runTest(opts);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
