import type { AutoEditRenderJob } from './types.js';
import { getAutoEditById, getClipsByIds, updateAutoEditDone, updateAutoEditError, refundCredits } from './db.js';
import { downloadFromR2, uploadToR2 } from './r2.js';
import { concatClips, overlayTitle, mixMusic, getVideoDuration } from './ffmpeg.js';
import { getMusicTrack } from './music.js';

const log = (data: Record<string, unknown>) => {
  console.log(JSON.stringify({ job: 'auto-edit-render', ...data }));
};

export async function processRenderJob(job: AutoEditRenderJob): Promise<void> {
  const { autoEditId, projectId, userId, clipIds, titleText, musicKey } = job;

  log({ status: 'started', autoEditId, projectId, userId, clipCount: clipIds.length });

  try {
    // 1. Fetch auto-edit record
    const autoEdit = await getAutoEditById(autoEditId);
    if (!autoEdit) {
      throw new Error(`Auto-edit ${autoEditId} not found`);
    }

    log({ step: 'fetched-auto-edit', autoEditId, status: autoEdit.status });

    // 2. Fetch all clips from DB
    const clips = await getClipsByIds(clipIds);
    log({ step: 'fetched-clips', autoEditId, clipCount: clips.length });

    // Verify all clips are done
    const notDoneClips = clips.filter(c => c.status !== 'done');
    if (notDoneClips.length > 0) {
      const ids = notDoneClips.map(c => c.id).join(', ');
      throw new Error(`Clips not ready: ${ids}. Statuses: ${notDoneClips.map(c => `${c.id}=${c.status}`).join(', ')}`);
    }

    // Ensure clips are in the same order as clipIds
    const sortedClips = clipIds.map(id => clips.find(c => c.id === id)).filter(Boolean) as typeof clips;

    // 3. Download each clip MP4 from R2
    log({ step: 'downloading-clips', autoEditId });
    const clipBuffers: Buffer[] = [];
    for (const clip of sortedClips) {
      const storageKey = clip.storageKey;
      if (!storageKey) {
        throw new Error(`Clip ${clip.id} has no storageKey`);
      }
      const buffer = await downloadFromR2(storageKey);
      clipBuffers.push(buffer);
      log({ step: 'downloaded-clip', autoEditId, clipId: clip.id, sizeBytes: buffer.length });
    }

    // 4. Concatenate clips in order using FFmpeg concat demuxer
    log({ step: 'concatenating-clips', autoEditId });
    const concatenatedBuffer = await concatClips(clipBuffers);
    log({ step: 'concatenated-clips', autoEditId, sizeBytes: concatenatedBuffer.length });

    // 5. Overlay title text on first 3 seconds
    log({ step: 'adding-title', autoEditId, titleText });
    let videoBuffer = concatenatedBuffer;
    if (titleText) {
      videoBuffer = await overlayTitle(videoBuffer, titleText, 3);
      log({ step: 'title-added', autoEditId });
    }

    // 6. Download music track
    const track = getMusicTrack(musicKey);
    log({ step: 'downloading-music', autoEditId, musicKey, trackUrl: track.url });
    const musicResponse = await fetch(track.url);
    if (!musicResponse.ok) {
      throw new Error(`Failed to download music track: ${musicResponse.statusText}`);
    }
    const musicBuffer = Buffer.from(await musicResponse.arrayBuffer());
    log({ step: 'music-downloaded', autoEditId, musicSizeBytes: musicBuffer.length });

    // 7. Mix music with video (music plays throughout, video audio preserved)
    log({ step: 'mixing-music', autoEditId });
    const finalBuffer = await mixMusic(videoBuffer, musicBuffer);
    log({ step: 'music-mixed', autoEditId, finalSizeBytes: finalBuffer.length });

    // 8. Get final video duration
    const duration = await getVideoDuration(finalBuffer);
    log({ step: 'got-duration', autoEditId, duration });

    // 9. Upload final MP4 to R2
    const timestamp = Date.now();
    const storageKey = `auto-edit/${userId}/${autoEditId}/${timestamp}.mp4`;
    log({ step: 'uploading-final', autoEditId, storageKey });
    const publicUrl = await uploadToR2(storageKey, finalBuffer, 'video/mp4');
    log({ step: 'uploaded-final', autoEditId, publicUrl });

    // 10. Update DB: status='done', publicUrl, duration
    await updateAutoEditDone(autoEditId, storageKey, publicUrl, duration);
    log({ status: 'done', autoEditId, publicUrl, duration });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ status: 'error', autoEditId, error: message });

    // On error: set status='error', refund 1 credit
    try {
      await updateAutoEditError(autoEditId);
      await refundCredits(userId, 1, autoEditId);
      log({ step: 'error-handled', autoEditId, creditsRefunded: 1 });
    } catch (dbErr) {
      log({ step: 'error-handling-failed', autoEditId, dbError: String(dbErr) });
    }

    throw err;
  }
}
