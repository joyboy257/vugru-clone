import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'PropFrame <noreply@propframe.ai>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

export async function sendClipCompleteEmail(
  to: string,
  projectName: string,
  projectUrl: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[clip-complete-email] RESEND_API_KEY not set, skipping email to ${to}`);
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0F172A; color: #F8FAFC; padding: 40px; }
          .container { max-width: 480px; margin: 0 auto; background: #1E293B; border-radius: 8px; padding: 32px; text-align: center; }
          h1 { font-size: 28px; margin-bottom: 8px; }
          p { color: #94A3B8; line-height: 1.6; margin-bottom: 24px; }
          a { display: inline-block; background: #3B82F6; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px; }
          a:hover { background: #2563EB; }
          .footer { margin-top: 32px; font-size: 12px; color: #64748B; }
          .emoji { font-size: 48px; margin-bottom: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="emoji">🎬</div>
          <h1>Your clip is ready!</h1>
          <p>Your video clip for <strong>${projectName}</strong> has been generated and is ready to view.</p>
          <a href="${projectUrl}">View Project</a>
          <div class="footer">PropFrame — AI-powered real estate video</div>
        </div>
      </body>
    </html>
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Your clip is ready! 🎬',
      html,
    });

    if (error) {
      console.error(`[clip-complete-email] Failed to send to ${to}:`, error.message);
      throw new Error('Failed to send email');
    }

    console.log(`[clip-complete-email] Sent to ${to}`);
  } catch (err) {
    console.error(`[clip-complete-email] Error sending to ${to}:`, err);
    throw err;
  }
}
