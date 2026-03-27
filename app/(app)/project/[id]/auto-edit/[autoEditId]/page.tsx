import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, getUserById } from '@/lib/db/auth';
import { db } from '@/lib/db';
import { autoEdits, projects } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { AutoEditStatusClient } from './AutoEditStatusClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string; autoEditId: string }>;
}

export default async function AutoEditStatusPage({ params }: PageProps) {
  const { id: projectId, autoEditId } = await params;

  const cookieStore = cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('dev_token')?.value;
  if (!token) redirect('/auth/login');

  const payload = verifyToken(token);
  if (!payload) redirect('/auth/login');

  const user = await getUserById(payload.userId);
  if (!user) redirect('/auth/login');

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .limit(1);

  if (!project) redirect('/dashboard');

  // Fetch auto-edit
  const [autoEdit] = await db
    .select()
    .from(autoEdits)
    .where(and(eq(autoEdits.id, autoEditId), eq(autoEdits.projectId, projectId)))
    .limit(1);

  if (!autoEdit) redirect(`/project/${projectId}`);

  return (
    <AutoEditStatusClient
      projectId={projectId}
      projectName={project.name}
      autoEdit={autoEdit}
    />
  );
}
