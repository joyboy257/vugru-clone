import { NextRequest, NextResponse } from 'next/server';
import { verifyPasswordResetToken, markPasswordResetTokenUsed, hashPassword, deleteAllUserSessions, getUserById } from '@/lib/db/auth';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { lookupKey, token, password } = await req.json();

    if (!lookupKey || typeof lookupKey !== 'string') {
      return NextResponse.json({ error: 'Invalid reset link' }, { status: 400 });
    }

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invalid reset link' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    // Rate limit the reset endpoint
    const rateLimitResult = await rateLimit({
      identifier: `reset:ip:${ip}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimitResult.success) {
      logger.rateLimit.warn('Password reset rate limited', { ip });
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const result = await verifyPasswordResetToken(lookupKey, token);

    if (!result.valid) {
      logger.auth.warn('Password reset token invalid', { reason: result.reason, ip });
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 401 });
    }

    // Hash new password and update user
    const passwordHash = await hashPassword(password);

    // We need to update the user's password - need a helper for this
    const { db } = await import('@/lib/db');
    const { users } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, result.userId));

    // Invalidate all existing sessions
    await deleteAllUserSessions(result.userId);

    // Mark token as used
    await markPasswordResetTokenUsed(lookupKey);

    const user = await getUserById(result.userId);
    logger.auth.info('Password reset successful', { userId: result.userId, email: user?.email });

    return NextResponse.json({ success: true, message: 'Password updated' });
  } catch (error) {
    logger.auth.error('Password reset error', error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
