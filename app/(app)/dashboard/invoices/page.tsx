import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, getUserById } from '@/lib/db/auth';
import { InvoicesClient } from './InvoicesClient';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('dev_token')?.value;
  if (!token) redirect('/auth/login');

  const payload = verifyToken(token);
  if (!payload) redirect('/auth/login');

  const user = await getUserById(payload.userId);
  if (!user) redirect('/auth/login');

  // Fetch invoices from Stripe billing history
  const historyRes = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/billing/history`,
    { credentials: 'include' }
  );

  const { transactions } = await historyRes.json();

  // Surface transactions as invoice entries (last 20)
  const invoices = (transactions || []).map((tx: {
    id: string;
    amount: number;
    type: string;
    description: string | null;
    createdAt: string;
  }) => ({
    id: tx.id,
    date: tx.createdAt,
    amount: Math.abs(tx.amount),
    description: tx.description || tx.type.replace(/_/g, ' '),
    stripeInvoiceId: tx.description?.startsWith('inv_') ? tx.description : null,
  }));

  return <InvoicesClient invoices={invoices} />;
}
