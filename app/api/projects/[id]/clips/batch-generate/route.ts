import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clips, photos, projects, users } from '@/lib/db/schema';
import { verifyToken, deductCredits } from '@/lib/db/auth';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getClipCost } from '@/lib/credits';
import { enqueueClipJob } from '../../../../../workers/video-render/src/queue';
import { logger } from '../../../../../lib/logger';

export const runtime = 'nodejs';

function getUserId(req: NextRequest): string | null {
  const token = req.cookies.get('auth_token')?.value || req.cookies.get('dev_token')?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

// POST /api/projects/[id]/clips/batch-generate
// Request: { photoIds?: string[], resolution?: string, motionStyle?: string }
// Response 202: { jobId, estimatedCredits, count, errors? }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;
  const { photoIds, resolution = '720p', motionStyle = 'push-in' } = await req.json();

  // Validate resolution
  const validResolutions = ['720p', '1080p', '4k'];
  if (!validResolutions.includes(resolution)) {
    return NextResponse.json(
      { error: `Invalid resolution. Must be one of: ${validResolutions.join(', ')}` },
      { status: 400 }
    );
  }

  // Validate motion style
  const validMotionStyles = ['push-in', 'zoom-out', 'pan-left', 'pan-right', 'custom'];
  if (!validMotionStyles.includes(motionStyle)) {
    return NextResponse.json(
      { error: `Invalid motionStyle. Must be one of: ${validMotionStyles.join(', ')}` },
      { status: 400 }
    );
  }

  // Verify project belongs to user
  const [project] = await db.select().from(projects).where(
    and(eq(projects.id, projectId), eq(projects.userId, userId))
  ).limit(1);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Get all project photos
  const allProjectPhotos = await db.select().from(photos).where(eq(photos.projectId, projectId));

  // Get photos that already have clips
  const existingClips = await db.select({ photoId: clips.photoId }).from(clips).where(
    eq(clips.projectId, projectId)
  );
  const existingClipPhotoIds = new Set(existingClips.map(c => c.photoId));

  // Determine target photos
  let targetPhotos;
  if (photoIds && photoIds.length > 0) {
    targetPhotos = allProjectPhotos.filter(p => photoIds.includes(p.id) && !existingClipPhotoIds.has(p.id));
  } else {
    targetPhotos = allProjectPhotos.filter(p => !existingClipPhotoIds.has(p.id));
  }

  if (targetPhotos.length === 0) {
    return NextResponse.json(
      { error: 'No photos available for clip generation (all may already have clips)' },
      { status: 400 }
    );
  }

  // Calculate total credit cost
  const costPerClip = getClipCost(resolution as '720p' | '1080p' | '4k');
  const totalCredits = targetPhotos.length * costPerClip;

  // Check user credits
  const [user] = await db.select({ credits: users.credits }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.credits < totalCredits) {
    return NextResponse.json(
      { error: 'Insufficient credits', required: totalCredits, available: user?.credits ?? 0 },
      { status: 402 }
    );
  }

  const batchJobId = `batch_${nanoid(10)}`;

  logger.info(`[batch-generate] user=${userId} project=${projectId} batch=${batchJobId} count=${targetPhotos.length} totalCredits=${totalCredits}`);

  // Create clip records and enqueue jobs
  const createdClips = [];
  const enqueueErrors = [];

  for (const photo of targetPhotos) {
    let clipId: string | null = null;
    try {
      const [clip] = await db.insert(clips).values({
        projectId,
        photoId: photo.id,
        motionStyle,
        resolution: resolution as '720p' | '1080p' | '4k',
        status: 'queued',
        cost: costPerClip,
        jobId: nanoid(),
      }).returning();

      clipId = clip.id;
      createdClips.push(clip);

      // Deduct credits for this clip
      await deductCredits(userId, costPerClip, 'clip_generation', clip.id);

      // Enqueue to GPU worker
      await enqueueClipJob({
        clipId: clip.id,
        projectId,
        photoId: photo.id,
        photoStorageKey: photo.storageKey,
        motionStyle: motionStyle as 'push-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'custom',
        customPrompt: undefined,
        resolution: resolution as '720p' | '1080p' | '4k',
        userId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[batch-generate] failed to create clip for photo=${photo.id}: ${msg}`);
      enqueueErrors.push({ photoId: photo.id, clipId, error: msg });

      // If we created the clip but failed to enqueue, mark it as error
      if (clipId) {
        await db.update(clips).set({ status: 'error', errorMessage: `Failed to enqueue: ${msg}` })
          .where(eq(clips.id, clipId));
      }
    }
  }

  // Update project clip count
  if (createdClips.length > 0) {
    await db
      .update(projects)
      .set({ clipCount: project.clipCount + createdClips.length, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  }

  const response: Record<string, unknown> = {
    jobId: batchJobId,
    estimatedCredits: createdClips.length * costPerClip,
    count: createdClips.length,
  };

  if (enqueueErrors.length > 0) {
    response.errors = enqueueErrors;
  }

  return NextResponse.json(response, { status: 202 });
}

// GET /api/projects/[id]/clips/batch-generate
// Returns estimated cost without creating anything
// Query params: ?resolution=720p&photoIds=id1,id2
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;
  const { searchParams } = new URL(req.url);
  const resolution = searchParams.get('resolution') ?? '720p';
  const photoIdsParam = searchParams.get('photoIds');
  const photoIds = photoIdsParam ? photoIdsParam.split(',') : null;

  // Verify project belongs to user
  const [project] = await db.select().from(projects).where(
    and(eq(projects.id, projectId), eq(projects.userId, userId))
  ).limit(1);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Get all project photos
  const allProjectPhotos = await db.select().from(photos).where(eq(photos.projectId, projectId));

  // Get photos that already have clips
  const existingClips = await db.select({ photoId: clips.photoId }).from(clips).where(
    eq(clips.projectId, projectId)
  );
  const existingClipPhotoIds = new Set(existingClips.map(c => c.photoId));

  // Determine target photos
  let targetPhotos;
  if (photoIds && photoIds.length > 0) {
    targetPhotos = allProjectPhotos.filter(p => photoIds.includes(p.id) && !existingClipPhotoIds.has(p.id));
  } else {
    targetPhotos = allProjectPhotos.filter(p => !existingClipPhotoIds.has(p.id));
  }

  const costPerClip = getClipCost(resolution as '720p' | '1080p' | '4k');
  const totalCredits = targetPhotos.length * costPerClip;

  return NextResponse.json({
    photoCount: targetPhotos.length,
    resolution,
    costPerClip,
    estimatedCredits: totalCredits,
  });
}
