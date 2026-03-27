import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, photos, clips, autoEdits } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { eq, asc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { logger } from '@/lib/logger';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export const runtime = 'nodejs';

function getUserId(req: NextRequest): string | null {
  const token = req.cookies.get('session_token')?.value || req.cookies.get('dev_token')?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

// R2 helpers (same pattern as gpu-worker/src/r2.ts)
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

async function downloadFromR2(key: string): Promise<Buffer> {
  const client = getR2Client();
  const command = new GetObjectCommand({ Bucket: process.env.NEXT_PUBLIC_R2_BUCKET || 'vugru-media', Key: key });
  const response = await client.send(command);
  const body = response.Body;
  if (!body || !(body instanceof Readable)) throw new Error(`Unexpected R2 response for: ${key}`);
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<void> {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: process.env.NEXT_PUBLIC_R2_BUCKET || 'vugru-media',
    Key: key,
    ContentType: contentType,
    Body: body,
  });
  await client.send(command);
}

// POST /api/projects/[id]/duplicate
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  logger.project.info('project.duplicate.started', { originalProjectId: params.id, userId });

  // 1. Fetch original project and verify ownership
  const [original] = await db.select().from(projects).where(eq(projects.id, params.id)).limit(1);
  if (!original || original.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const newProjectId = uuid();

  try {
    // 2. Create new project
    const [newProject] = await db.insert(projects).values({
      id: newProjectId,
      userId: original.userId,
      name: `${original.name} (Copy)`,
      status: 'active',
    }).returning();

    // 3. Copy all photos
    const originalPhotos = await db
      .select()
      .from(photos)
      .where(eq(photos.projectId, original.id))
      .orderBy(asc(photos.order));

    const photoIdMap = new Map<string, string>(); // oldId → newId

    for (const photo of originalPhotos) {
      const newPhotoId = uuid();
      photoIdMap.set(photo.id, newPhotoId);

      let newStorageKey = photo.storageKey;
      let newSkyStorageKey = photo.skyStorageKey ?? null;
      let newPublicUrl = photo.publicUrl ?? null;

      // Re-upload photo to new R2 key
      const newPhotoKey = `photo/${newProjectId}/${newPhotoId}-${photo.filename}`;
      try {
        const buffer = await downloadFromR2(photo.storageKey);
        await uploadToR2(newPhotoKey, buffer, 'image/jpeg');
        newStorageKey = newPhotoKey;
        newPublicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''}/${newPhotoKey}`.replace(/^undefined\//, '');
      } catch {
        // If R2 not configured, keep original storage key
      }

      // Re-upload sky-replaced version if exists
      if (photo.skyStorageKey) {
        const newSkyKey = `photo/${newProjectId}/${newPhotoId}-sky-${photo.filename}`;
        try {
          const skyBuffer = await downloadFromR2(photo.skyStorageKey);
          await uploadToR2(newSkyKey, skyBuffer, 'image/jpeg');
          newSkyStorageKey = newSkyKey;
        } catch {
          newSkyStorageKey = photo.skyStorageKey;
        }
      }

      await db.insert(photos).values({
        id: newPhotoId,
        projectId: newProjectId,
        storageKey: newStorageKey,
        filename: photo.filename,
        width: photo.width,
        height: photo.height,
        order: photo.order,
        virtualStaged: photo.virtualStaged,
        skyReplaced: photo.skyReplaced,
        skyStyle: photo.skyStyle,
        skyReplacedAt: photo.skyReplacedAt,
        skyStorageKey: newSkyStorageKey,
        publicUrl: newPublicUrl,
      });
    }

    // 4. Copy all clips (status reset to draft)
    const originalClips = await db
      .select()
      .from(clips)
      .where(eq(clips.projectId, original.id));

    for (const clip of originalClips) {
      const newClipId = uuid();
      const newClipKey = `clip/${newProjectId}/${newClipId}.mp4`;

      let newStorageKey: string | null = clip.storageKey;
      let newPublicUrl: string | null = clip.publicUrl;

      if (clip.storageKey) {
        try {
          const buffer = await downloadFromR2(clip.storageKey);
          await uploadToR2(newClipKey, buffer, 'video/mp4');
          newStorageKey = newClipKey;
          newPublicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''}/${newClipKey}`.replace(/^undefined\//, '');
        } catch {
          // R2 copy failed, keep original
        }
      }

      const newPhotoId = photoIdMap.get(clip.photoId);

      await db.insert(clips).values({
        id: newClipId,
        projectId: newProjectId,
        photoId: newPhotoId ?? clip.photoId,
        storageKey: newStorageKey,
        publicUrl: newPublicUrl,
        motionStyle: clip.motionStyle,
        customPrompt: clip.customPrompt,
        resolution: clip.resolution,
        duration: clip.duration,
        status: 'draft', // reset to draft for copied clips
        errorMessage: null,
        cost: clip.cost,
        jobId: null,
      });
    }

    // 5. Copy all auto-edits (status reset to draft)
    const originalAutoEdits = await db
      .select()
      .from(autoEdits)
      .where(eq(autoEdits.projectId, original.id));

    for (const autoEdit of originalAutoEdits) {
      const newAutoEditId = uuid();

      let newStorageKey: string | null = autoEdit.storageKey;
      let newPublicUrl: string | null = autoEdit.publicUrl;

      if (autoEdit.storageKey) {
        const newAEKey = `auto-edit/${newProjectId}/${newAutoEditId}.mp4`;
        try {
          const buffer = await downloadFromR2(autoEdit.storageKey);
          await uploadToR2(newAEKey, buffer, 'video/mp4');
          newStorageKey = newAEKey;
          newPublicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''}/${newAEKey}`.replace(/^undefined\//, '');
        } catch {
          // R2 copy failed, keep original
        }
      }

      await db.insert(autoEdits).values({
        id: newAutoEditId,
        projectId: newProjectId,
        storageKey: newStorageKey,
        publicUrl: newPublicUrl,
        clipIds: autoEdit.clipIds,
        titleText: autoEdit.titleText,
        musicKey: autoEdit.musicKey,
        duration: autoEdit.duration,
        status: 'draft', // reset to draft
        cost: autoEdit.cost,
        shareToken: null,
        shareExpiresAt: null,
      });
    }

    logger.project.info('project.duplicate.completed', { newProjectId, originalProjectId: params.id });

    return NextResponse.json({ project: newProject }, { status: 201 });

  } catch (err) {
    // R2 copy failed — delete the new project and return 500
    await db.delete(projects).where(eq(projects.id, newProjectId));
    const msg = err instanceof Error ? err.message : String(err);
    logger.project.info('project.duplicate.failed', { originalProjectId: params.id, error: msg });
    return NextResponse.json({ error: 'Duplicate failed: ' + msg }, { status: 500 });
  }
}
