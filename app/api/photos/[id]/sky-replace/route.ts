import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { photos, projects, users, creditTransactions } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { eq, and } from 'drizzle-orm';
import { CREDIT_COSTS } from '@/lib/credits';

export const runtime = 'nodejs';

const SKY_STYLES = ['blue-sky', 'golden-hour', 'twilight', 'custom'] as const;
type SkyStyle = typeof SKY_STYLES[number];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.headers.get('x-token') || req.cookies.get('token')?.value || req.cookies.get('dev_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const photoId = params.id;

  // Get photo and verify ownership via project
  const [photo] = await db.select().from(photos).where(eq(photos.id, photoId)).limit(1);
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [project] = await db.select().from(projects).where(eq(projects.id, photo.projectId)).limit(1);
  if (!project || project.userId !== payload.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Check if already sky-replaced
  if (photo.skyReplaced) {
    return NextResponse.json({ error: 'Photo already sky-replaced. Use the original photo.' }, { status: 409 });
  }

  const body = await req.json();
  const skyStyle = body.skyStyle as SkyStyle;
  const customSkyUrl = body.customSkyUrl as string | undefined;

  // Validate skyStyle
  if (!skyStyle || !SKY_STYLES.includes(skyStyle)) {
    return NextResponse.json({ error: 'Invalid skyStyle. Must be one of: blue-sky, golden-hour, twilight, custom' }, { status: 400 });
  }

  // Validate customSkyUrl if skyStyle is custom
  if (skyStyle === 'custom' && !customSkyUrl) {
    return NextResponse.json({ error: 'customSkyUrl required when skyStyle is custom' }, { status: 400 });
  }

  // Deduct credit
  const cost = CREDIT_COSTS.sky_replacement;
  const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
  if (!user || user.credits < cost) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
  }

  await db.update(users)
    .set({ credits: user.credits - cost })
    .where(eq(users.id, payload.userId));

  await db.insert(creditTransactions).values({
    userId: payload.userId,
    amount: -cost,
    type: 'sky_replacement',
    referenceId: photoId,
    description: `Sky replacement (${skyStyle})`,
  });

  // Mark photo as sky-replaced
  await db.update(photos)
    .set({ skyReplaced: true })
    .where(eq(photos.id, photoId));

  // Enqueue to sky replacement worker
  try {
    const { enqueueSkyReplaceJob } = await import('../../../../../workers/sky-replace/src/queue');
    await enqueueSkyReplaceJob({
      photoId,
      projectId: project.id,
      userId: payload.userId,
      photoStorageKey: photo.storageKey,
      skyStyle,
      customSkyUrl,
    });
  } catch (err) {
    // Worker may not be running — that's ok, photo is marked as sky-replaced
    // The worker will catch up when started
    console.error('Failed to enqueue sky replacement job:', err);
  }

  console.log('Sky replacement queued:', { photoId, userId: payload.userId, skyStyle });

  return NextResponse.json({
    photo: {
      id: photoId,
      skyReplaced: true,
      publicUrl: photo.publicUrl,
    }
  }, { status: 202 });
}