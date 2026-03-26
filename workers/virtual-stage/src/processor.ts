import type { VirtualStageJob } from './types.js';
import { getSignedDownloadUrl, uploadToR2 } from './r2.js';
import { stageRoom } from './staging.js';
import { markPhotoVirtualStaged } from './db.js';

export async function processStageJob(job: VirtualStageJob): Promise<void> {
  const { photoId, photoStorageKey, style, userId } = job;

  // 1. Get signed download URL for the original photo
  const photoUrl = await getSignedDownloadUrl(photoStorageKey, 1800);

  // 2. Call the AI staging model
  const { resultUrl } = await stageRoom(photoUrl, style);

  // 3. Download the staged result
  const stagedResponse = await fetch(resultUrl);
  const stagedBuffer = Buffer.from(await stagedResponse.arrayBuffer());

  // 4. Upload to R2
  const stagedStorageKey = `staged/${userId}/${photoId}-${style}.jpg`;
  const stagedPublicUrl = await uploadToR2(stagedStorageKey, stagedBuffer, 'image/jpeg');

  // 5. Mark photo as virtual staged in DB
  await markPhotoVirtualStaged(photoId, stagedStorageKey, stagedPublicUrl);
}
