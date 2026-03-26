import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, getUserById } from '@/lib/db/auth';
import { SettingsClient } from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('session_token')?.value || cookieStore.get('dev_token')?.value;

  if (!token) {
    redirect('/auth/login');
  }

  const payload = verifyToken(token);
  if (!payload) {
    redirect('/auth/login');
  }

  const user = await getUserById(payload.userId);
  if (!user) {
    redirect('/auth/login');
  }

  return (
    <SettingsClient
      user={{
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan ?? 'starter',
        credits: user.credits,
        stripeCustomerId: user.stripeCustomerId,
        createdAt: user.createdAt.toISOString(),
      }}
    />
  );
}
