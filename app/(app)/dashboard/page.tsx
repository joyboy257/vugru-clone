import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyToken, getUserById } from '@/lib/db/auth';
import { db } from '@/lib/db';
import { projects, clips, photos, creditTransactions, users } from '@/lib/db/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { Button } from '@/components/ui/Button';
import { UsageBadge } from '@/components/UsageBadge';
import { ProjectCard } from '@/components/ProjectCard';
import { Plus, Film } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('session_token')?.value || cookieStore.get('dev_token')?.value;
  if (!token) redirect('/auth/login');

  const payload = verifyToken(token);
  if (!payload) redirect('/auth/login');

  const user = await getUserById(payload.userId);
  if (!user) redirect('/auth/login');

  const allProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, payload.userId))
    .orderBy(desc(projects.updatedAt))
    .limit(50);

  // Stats
  const totalClips = allProjects.reduce((sum, p) => sum + p.clipCount, 0);

  // Usage this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const plan = user.plan ?? 'starter';
  const PLAN_LIMITS: Record<string, number> = { starter: 20, pro: 100, scale: 500 };
  const limit = PLAN_LIMITS[plan] ?? 20;
  const usageResult = await db
    .select({ total: sql<number>`COALESCE(SUM(ABS(${creditTransactions.amount})), 0)` })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, payload.userId),
        eq(creditTransactions.type, 'clip_generation'),
        gte(creditTransactions.createdAt, monthStart),
      )
    );
  const usageThisMonth = Number(usageResult[0]?.total ?? 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">
            {allProjects.length} project{allProjects.length !== 1 ? 's' : ''} &middot; {totalClips} total clips
          </p>
        </div>
        <Link href="/project/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-white font-mono">{allProjects.length}</div>
          <div className="text-sm text-slate-500">Projects</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-white font-mono">{totalClips}</div>
          <div className="text-sm text-slate-500">Clips Generated</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-emerald-400 font-mono">${(user.credits / 100).toFixed(2)}</div>
          <div className="text-sm text-slate-500">Credit Balance</div>
        </div>
        <UsageBadge used={usageThisMonth} limit={limit} plan={plan} />
      </div>

      {/* Project grid */}
      {allProjects.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/50 border border-slate-800 rounded-xl">
          <Film className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-300 mb-2">No projects yet</h2>
          <p className="text-sm text-slate-500 mb-6">Upload your first listing photos to get started.</p>
          <Link href="/project/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create your first project
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
