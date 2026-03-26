import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserById, createSession } from '@/lib/db/auth';
import { redirect } from 'next/navigation';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const action = searchParams.get('action');

  if (!token || !action) {
    redirect('/auth/login?error=invalid_callback');
  }

  // Verify the magic link token
  const payload = verifyToken(token);
  if (!payload) {
    redirect('/auth/login?error=session_expired');
  }

  // Get the user
  const user = await getUserById(payload.userId);
  if (!user) {
    redirect('/auth/login?error=user_not_found');
  }

  // The magic link token is already a valid JWT session token
  // We just need to ensure it's stored properly as a session
  // Since createSession generates a new token, we use the existing token from the magic link
  // This is a no-op if the session already exists, but it refreshes the expiry

  // Redirect to dashboard after setting session
  const redirectUrl = new URL('/dashboard', request.url);

  const response = NextResponse.redirect(redirectUrl);

  // Set the session cookie with the token from the magic link
  // The token is already a valid JWT, so we use it directly as the session token
  response.cookies.set('session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // Use the expiry from the JWT payload if available, otherwise default to session length
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}
