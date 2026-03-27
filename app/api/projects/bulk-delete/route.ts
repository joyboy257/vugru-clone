import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, photos, clips, autoEdits } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { eq, inArray } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

export const runtime = 'nodejs';

function getUserId(req: NextRequest): string | null {
  const token = req.cookies.get('session_token')?.value || req.cookies.get('dev_token')?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.dev`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function deleteR2Key(key: string): Promise<void> {
  try {
    const client = getR2Client();
    const command = new DeleteObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_R2_BUCKET || 'vugru-media',
      Key: key,
    });
    await client.send(command);
  } catch {
    // Ignore R2 delete errors (file may not exist)
  }
}

// POST /api/projects/bulk-delete
export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { projectIds } = await req.json();

  if (!Array.isArray(projectIds) || projectIds.length === 0) {
    return NextResponse.json({ error: 'projectIds must be a non-empty array' }, { status: 400 });
  }

  if (projectIds.length > 50) {
    return NextResponse.json({ error: 'Maximum 50 projects per bulk delete' }, { status: 400 });
  }

  logger.info('projects.bulk_delete.started', { userId, count: projectIds.length });

  // Verify all-or-nothing: check all projects belong to user
  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(inArray(projects.id, projectIds));

  const foundIds = new Set(existing.map(r => r.id));
  const notFound = projectIds.filter(id => !foundIds.has(id));

  if (notFound.length > 0) {
    return NextResponse.json({ error: `Projects not found: ${notFound.join(', ')}` }, { status: 404 });
  }

  const ownershipCheck = existing.every(p => true); // already filtered by inArray
  // Re-check user ownership explicitly
  const userProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.userId, userId));

  const userProjectIds = new Set(userProjects.map(p => p.id));
  const notOwned = projectIds.filter(id => !userProjectIds.has(id));

  if (notOwned.length > 0) {
    return NextResponse.json({ error: `Not authorized for projects: ${notOwned.join(', ')}` }, { status: 403 });
  }

  // DB transaction: delete all related records then projects
  try {
    // Fetch all photos, clips, autoEdits for these projects (to get R2 keys)
    const projectPhotos = await db.select().from(photos).where(inArray(photos.projectId, projectIds));
    const projectClips = await db.select().from(clips).where(inArray(clips.projectId, projectIds));
    const projectAutoEdits = await db.select().from(autoEdits).where(inArray(autoEdits.projectId, projectIds));

    // Delete R2 files (fire and forget, don't fail the transaction)
    const r2KeysToDelete: string[] = [
      ...projectPhotos.map(p => p.storageKey),
      ...projectPhotos.map(p => p.skyStorageKey).filter(Boolean) as string[],
      ...projectClips.map(c => c.storageKey).filter(Boolean) as string[],
      ...projectAutoEdits.map(a => a.storageKey).filter(Boolean) as string[],
    ];

    await Promise.all(r2KeysToDelete.map(k => deleteR2Key(k)));

    // Delete in correct order (respecting foreign keys): photos, clips, autoEdits, then projects
    await db.delete(photos).where(inArray(photos.projectId, projectIds));
    await db.delete(clips).where(inArray(clips.projectId, projectIds));
    await db.delete(autoEdits).where(inArray(autoEdits.projectId, projectIds));
    await db.delete(projects).where(inArray(projects.id, projectIds));

    logger.info('projects.bulk_delete.completed', { userId, deleted: projectIds.length });

    return NextResponse.json({ deleted: projectIds.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('projects.bulk_delete.failed', { userId, error: msg });
    return NextResponse.json({ error: 'Bulk delete failed: ' + msg }, { status: 500 });
  }
}
