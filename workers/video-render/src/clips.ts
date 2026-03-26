import { query } from './db.js';
import { ClipJob } from './types.js';

export async function updateClipStatus(
  clipId: string,
  status: 'queued' | 'processing' | 'done' | 'error',
  opts: { publicUrl?: string; storageKey?: string; errorMessage?: string } = {}
): Promise<void> {
  if (status === 'done') {
    await query(
      `UPDATE clips SET status = $1, storage_key = $2, public_url = $3, updated_at = NOW()
       WHERE id = $4`,
      [status, opts.storageKey ?? null, opts.publicUrl ?? null, clipId]
    );
  } else if (status === 'error') {
    await query(
      `UPDATE clips SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3`,
      [status, opts.errorMessage ?? 'Unknown error', clipId]
    );
  } else {
    await query(
      `UPDATE clips SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, clipId]
    );
  }
}
