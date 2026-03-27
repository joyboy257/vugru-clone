import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSession, getUserByGoogleId, createUserFromGoogle, getUserByEmail, linkGoogleAccount } from '@/lib/db/auth';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

async function getGoogleTokens(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: GOOGLE_REDIRECT_URI!,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status}`);
  }

  return res.json();
}

async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google user info failed: ${res.status}`);
  }

  return res.json();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    logger.googleOAuth.warn('Google OAuth error', { error });
    return NextResponse.redirect(`${APP_URL}/auth/login?error=oauth_failed`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/auth/login?error=invalid_callback`);
  }

  // Verify state cookie
  const cookieStore = await cookies();
  const storedState = cookieStore.get('google_oauth_state')?.value;

  if (!storedState || storedState !== state) {
    logger.googleOAuth.warn('Google OAuth state mismatch');
    return NextResponse.redirect(`${APP_URL}/auth/login?error=invalid_state`);
  }

  try {
    // Exchange code for tokens
    const tokens = await getGoogleTokens(code);
    const googleUser = await getGoogleUserInfo(tokens.access_token);

    logger.googleOAuth.info('Google OAuth success', { googleId: googleUser.id, email: googleUser.email });

    // Find or create user
    let user = await getUserByGoogleId(googleUser.id);

    if (!user) {
      // Check if email already exists
      const existingByEmail = await getUserByEmail(googleUser.email);

      if (existingByEmail && existingByEmail.passwordHash) {
        // Email taken with password — can't auto-link
        logger.googleOAuth.warn('Google email already registered with password', { email: googleUser.email });
        return NextResponse.redirect(
          `${APP_URL}/auth/login?error=google_email_taken&email=${encodeURIComponent(googleUser.email)}`
        );
      }

      if (existingByEmail && !existingByEmail.passwordHash) {
        // Magic link user — auto-link Google
        await linkGoogleAccount(existingByEmail.id, googleUser.id, googleUser.email);
        user = existingByEmail;
        logger.googleOAuth.info('Google account linked to existing user', { userId: user.id, email: googleUser.email });
      } else {
        // New user
        user = await createUserFromGoogle(googleUser.id, googleUser.email, googleUser.name);
        logger.googleOAuth.info('New user created via Google OAuth', { userId: user.id, email: googleUser.email });
      }
    }

    // Create session
    const { token, expiresAt } = await createSession(user.id);

    const response = NextResponse.redirect(`${APP_URL}/dashboard`);
    response.cookies.set('google_oauth_state', '', { maxAge: 0, path: '/' });
    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return response;
  } catch (err) {
    logger.googleOAuth.error('Google OAuth callback error', err as Error);
    return NextResponse.redirect(`${APP_URL}/auth/login?error=oauth_failed`);
  }
}
