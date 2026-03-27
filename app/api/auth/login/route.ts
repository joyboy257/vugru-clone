import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, createUser, createSession, verifyPassword } from '@/lib/db/auth';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    // Rate limit by IP
    const ipLimit = await rateLimit({
      identifier: `login:ip:${ip}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!ipLimit.success) {
      logger.rateLimit.warn('Login rate limited (IP)', { ip });
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((ipLimit.retryAfter || 300) / 1000)),
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    // Rate limit by email
    const emailLimit = await rateLimit({
      identifier: `login:email:${normalizedEmail}`,
      limit: 3,
      windowMs: 15 * 60 * 1000,
    });

    if (!emailLimit.success) {
      logger.rateLimit.warn('Login rate limited (email)', { email: normalizedEmail });
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '300' } }
      );
    }

    const user = await getUserByEmail(normalizedEmail);

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Password login
    if (password) {
      if (!user.passwordHash) {
        return NextResponse.json(
          { error: 'No password set for this account. Use magic link to sign in.' },
          { status: 401 }
        );
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        logger.auth.warn('Failed password login', { email: normalizedEmail, userId: user.id, ip });
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }

      logger.auth.info('Password login success', { email: normalizedEmail, userId: user.id });
    } else {
      // Magic link flow
      logger.auth.info('Magic link login', { email: normalizedEmail, userId: user.id });
    }

    const { token, expiresAt } = await createSession(user.id);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        credits: user.credits,
      },
    });

    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return response;
  } catch (error) {
    logger.auth.error('Login error', error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
