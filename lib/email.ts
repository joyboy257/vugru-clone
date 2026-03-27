import { Resend } from 'resend';
import { logger } from './logger';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'PropFrame <noreply@propframe.ai>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    logger.email.warn('RESEND_API_KEY not set, skipping email send', { to, subject });
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      logger.email.error('Failed to send email', new Error(error.message), { to, subject });
      throw new Error('Failed to send email');
    }

    logger.email.info('Email sent', { to, subject });
  } catch (err) {
    logger.email.error('Email send error', err as Error, { to, subject });
    throw err;
  }
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0F172A; color: #F8FAFC; padding: 40px; }
          .container { max-width: 480px; margin: 0 auto; background: #1E293B; border-radius: 8px; padding: 32px; }
          h1 { font-size: 24px; margin-bottom: 16px; color: #F8FAFC; }
          p { color: #94A3B8; line-height: 1.6; margin-bottom: 24px; }
          a { display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; }
          a:hover { background: #2563EB; }
          .footer { margin-top: 32px; font-size: 12px; color: #64748B; }
          .warning { font-size: 12px; color: #F59E0B; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Reset your password</h1>
          <p>You requested a password reset for your PropFrame account. Click the button below to set a new password. This link expires in 5 minutes.</p>
          <a href="${resetUrl}">Reset Password</a>
          <p class="warning">If you didn't request this, you can safely ignore this email.</p>
          <div class="footer">PropFrame — AI-powered real estate video</div>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: 'Reset your PropFrame password',
    html,
  });
}

export async function sendMagicLinkEmail(to: string, magicLink: string): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0F172A; color: #F8FAFC; padding: 40px; }
          .container { max-width: 480px; margin: 0 auto; background: #1E293B; border-radius: 8px; padding: 32px; }
          h1 { font-size: 24px; margin-bottom: 16px; color: #F8FAFC; }
          p { color: #94A3B8; line-height: 1.6; margin-bottom: 24px; }
          a { display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; }
          a:hover { background: #2563EB; }
          .footer { margin-top: 32px; font-size: 12px; color: #64748B; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Sign in to PropFrame</h1>
          <p>Click the button below to sign in to your PropFrame account. This link expires in 7 days.</p>
          <a href="${magicLink}">Sign In</a>
          <div class="footer">PropFrame — AI-powered real estate video</div>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: 'Sign in to PropFrame',
    html,
  });
}
