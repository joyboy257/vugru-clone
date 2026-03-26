import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { autoEdits, projects } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const runtime = 'nodejs';

// GET /api/share/[token] — public endpoint, no auth required
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const [autoEdit] = await db
    .select()
    .from(autoEdits)
    .where(eq(autoEdits.shareToken, params.token))
    .limit(1);

  if (!autoEdit) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Check expiry
  if (!autoEdit.shareExpiresAt || autoEdit.shareExpiresAt < new Date()) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 });
  }

  // Get project info for the share page
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, autoEdit.projectId))
    .limit(1);

  return NextResponse.json({
    autoEdit,
    projectName: project?.name ?? null,
  });
}
