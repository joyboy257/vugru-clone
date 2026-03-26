import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { photos, projects } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { eq, and } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get('session_token')?.value || req.cookies.get('dev_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = params.id;

  // Verify project ownership
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project || project.userId !== payload.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.delete(photos).where(eq(photos.projectId, projectId));

  return NextResponse.json({ success: true });
}
