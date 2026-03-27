import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, createPasswordResetToken } from '@/lib/db/auth';
import { sendPasswordResetEmail } from '@/lib/email';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    // Rate limit check
    const rateLimitResult = await rateLimit({
      identifier: `login:ip:${ip}`,
      limit: 3,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimitResult.success) {
      logger.rateLimit.warn('Forgot password rate limited', { ip, email: normalizedEmail });
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfter: rateLimitResult.retryAfter },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitResult.retryAfter || 300) / 1000)),
            'X-RateLimit-Limit': '3',
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const user = await getUserByEmail(normalizedEmail);

    // Always return success to prevent email enumeration
    if (!user) {
      logger.auth.warn('Forgot password for unknown email', { email: normalizedEmail });
      return NextResponse.json({ success: true, message: 'If an account exists, a reset email has been sent.' });
    }

    // Limit per email too
    const emailLimitResult = await rateLimit({
      identifier: `forgot:email:${normalizedEmail}`,
      limit: 2,
      windowMs: 15 * 60 * 1000,
    });

    if (!emailLimitResult.success) {
      logger.rateLimit.warn('Forgot password email rate limited', { email: normalizedEmail });
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': '300' },
        }
      );
    }

    const { token, lookupKey } = await createPasswordResetToken(user.id);
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password?lookup=${lookupKey}&token=${token}`;

    try {
      await sendPasswordResetEmail(normalizedEmail, resetUrl);
    } catch (emailError) {
      logger.email.error('Failed to send password reset email', emailError as Error, { email: normalizedEmail });
      // Still return success to prevent enumeration — email will be retried or admin notified
    }

    logger.auth.info('Password reset email sent', { email: normalizedEmail, userId: user.id });

    return NextResponse.json({ success: true, message: 'Reset email sent' });
  } catch (error) {
    logger.auth.error('Forgot password error', error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
