import { Pool } from 'pg';
import type { AutoEditRecord, ClipRecord } from './types.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function query<T>(text: string, params: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  await pool.end();
}

export async function getAutoEditById(id: string): Promise<AutoEditRecord | null> {
  const rows = await query<AutoEditRecord>(
    `SELECT id, project_id, storage_key, public_url, clip_ids, title_text,
            music_key, duration, status, cost, share_token, share_expires_at, created_at
     FROM auto_edits WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    id: row.id,
    projectId: (row as any).project_id,
    storageKey: (row as any).storage_key,
    publicUrl: (row as any).public_url,
    clipIds: (row as any).clip_ids,
    titleText: (row as any).title_text,
    musicKey: (row as any).music_key,
    duration: row.duration,
    status: row.status,
    cost: row.cost,
    shareToken: (row as any).share_token,
    shareExpiresAt: (row as any).share_expires_at,
    createdAt: (row as any).created_at,
  };
}

export async function getClipsByIds(ids: string[]): Promise<ClipRecord[]> {
  if (!ids.length) return [];
  const rows = await query<ClipRecord>(
    `SELECT id, project_id, photo_id, storage_key, public_url, motion_style,
            custom_prompt, resolution, duration, status, error_message, cost, job_id
     FROM clips WHERE id = ANY($1)`,
    [ids]
  );
  return rows.map(row => ({
    id: row.id,
    projectId: (row as any).project_id,
    photoId: (row as any).photo_id,
    storageKey: (row as any).storage_key,
    publicUrl: (row as any).public_url,
    motionStyle: row.motionStyle,
    customPrompt: (row as any).custom_prompt,
    resolution: row.resolution,
    duration: row.duration,
    status: row.status,
    errorMessage: (row as any).error_message,
    cost: row.cost,
    jobId: (row as any).job_id,
  }));
}

export async function updateAutoEditDone(
  id: string,
  storageKey: string,
  publicUrl: string,
  duration: number
): Promise<void> {
  await query(
    `UPDATE auto_edits
     SET status = 'done', storage_key = $2, public_url = $3, duration = $4
     WHERE id = $1`,
    [id, storageKey, publicUrl, duration]
  );
}

export async function updateAutoEditError(id: string): Promise<void> {
  await query(
    `UPDATE auto_edits SET status = 'error' WHERE id = $1`,
    [id]
  );
}

export async function refundCredits(userId: string, amount: number, referenceId: string): Promise<void> {
  // Refund: add credits back and create a credit transaction record
  await query(
    `UPDATE users SET credits = credits + $2 WHERE id = $1`,
    [userId, amount]
  );
  await query(
    `INSERT INTO credit_transactions (id, user_id, amount, type, reference_id, description)
     VALUES (gen_random_uuid(), $1, $2, 'refund', $3, 'Auto-edit render refund')`,
    [userId, amount, referenceId]
  );
}
