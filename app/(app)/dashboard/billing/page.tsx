import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, getUserById } from '@/lib/db/auth';
import { BillingClient } from './BillingClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ success?: string; credits?: string }>;
}

export default async function BillingPage({ searchParams }: PageProps) {
  const cookieStore = cookies();
  const token = cookieStore.get('session_token')?.value || cookieStore.get('dev_token')?.value;
  if (!token) redirect('/auth/login');

  const payload = verifyToken(token);
  if (!payload) redirect('/auth/login');

  const user = await getUserById(payload.userId);
  if (!user) redirect('/auth/login');

  // Fetch transactions and usage in parallel
  const [transactionsRes, usageRes] = await Promise.all([
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/billing/history`, {
      credentials: 'include',
    }),
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/billing/usage`, {
      credentials: 'include',
    }),
  ]);

  const { transactions } = await transactionsRes.json();
  const usage = await usageRes.json();

  const resolvedSearchParams = await searchParams;
  const successCredits = resolvedSearchParams.success === 'true' && resolvedSearchParams.credits
    ? parseInt(resolvedSearchParams.credits, 10)
    : null;

  return (
    <BillingClient
      transactions={transactions || []}
      usage={usage}
      userCredits={user.credits}
      successCredits={successCredits}
    />
  );
}
