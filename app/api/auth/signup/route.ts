import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, createUser, createSession, hashPassword } from '@/lib/db/auth';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { email, name, password } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (password && typeof password === 'string' && password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await getUserByEmail(normalizedEmail);
    if (existing) {
      return NextResponse.json({ error: 'Account already exists' }, { status: 409 });
    }

    const user = await createUser(normalizedEmail, name || null, password || undefined);

    logger.auth.info('New account created', {
      email: normalizedEmail,
      userId: user.id,
      hasPassword: !!password,
    });

    const { token, expiresAt } = await createSession(user.id);

    const response = NextResponse.json(
      {
        success: true,
        user: { id: user.id, email: user.email, name: user.name, credits: user.credits },
      },
      { status: 201 }
    );

    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return response;
  } catch (error) {
    logger.auth.error('Signup error', error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
