import { ClipJob, ClipJobResult } from './types.js';
import { generateClipVideo } from './replicate.js';
import { uploadToR2 } from './r2.js';
import { updateClipStatus } from './clips.js';
import { nanoid } from 'nanoid';

export async function processClipJob(job: ClipJob): Promise<ClipJobResult> {
  const { clipId, photoStorageKey, resolution, userId } = job;

  // 1. Mark clip as processing
  await updateClipStatus(clipId, 'processing');

  try {
    // 2. Get signed URL for the photo in R2
    const { getSignedDownloadUrl } = await import('./r2.js');
    const photoUrl = await getSignedDownloadUrl(photoStorageKey, 1800);

    // 3. Call Replicate to generate the video
    const { videoUrl } = await generateClipVideo(
      photoUrl,
      job.motionStyle,
      job.customPrompt,
      resolution
    );

    // 4. Download the generated video
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download generated video: ${videoResponse.status}`);
    }
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    // 5. Upload to R2
    const clipStorageKey = `clip/${userId}/${nanoid()}.mp4`;
    const publicUrl = await uploadToR2(clipStorageKey, videoBuffer, 'video/mp4');

    // 6. Mark clip as done
    await updateClipStatus(clipId, 'done', { publicUrl, storageKey: clipStorageKey });

    return { clipId, status: 'done', publicUrl, storageKey: clipStorageKey };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await updateClipStatus(clipId, 'error', { errorMessage });
    return { clipId, status: 'error', errorMessage };
  }
}
