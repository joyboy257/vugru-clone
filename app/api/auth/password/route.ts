import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authenticate, verifyPassword, hashPassword } from '@/lib/db/auth';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await authenticate(token);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    // If user has a password, verify current
    if (user.passwordHash) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password required' }, { status: 400 });
      }
      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) {
        logger.auth.warn('Password change failed - wrong current password', { userId: user.id });
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
      }
    }

    const passwordHash = await hashPassword(newPassword);

    const { db } = await import('@/lib/db');
    const { users } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));

    logger.auth.info('Password changed successfully', { userId: user.id });

    return NextResponse.json({ success: true, message: 'Password updated' });
  } catch (error) {
    logger.auth.error('Password change error', error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
