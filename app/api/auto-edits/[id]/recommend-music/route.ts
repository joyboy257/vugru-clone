import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { autoEdits, projects } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { MUSIC_TRACKS } from '@/lib/music';

export const runtime = 'nodejs';

function getUserId(req: NextRequest): string | null {
  const token = req.cookies.get('auth_token')?.value || req.cookies.get('dev_token')?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

async function getAutoEditWithAuth(req: NextRequest, id: string) {
  const userId = getUserId(req);
  if (!userId) return { error: 'Unauthorized', status: 401 };

  const [autoEdit] = await db
    .select()
    .from(autoEdits)
    .where(eq(autoEdits.id, id))
    .limit(1);

  if (!autoEdit) {
    return { error: 'Not found', status: 404 };
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, autoEdit.projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) {
    return { error: 'Not found', status: 404 };
  }

  return { userId, autoEdit, project };
}

// POST /api/auto-edits/[id]/recommend-music
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await getAutoEditWithAuth(req, params.id);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { project } = result;
  const body = await req.json();
  const { projectName } = body;

  if (!projectName) {
    return NextResponse.json({ error: 'projectName is required' }, { status: 400 });
  }

  logger.info('recommend-music request', { projectId: project.id, projectName });

  try {
    // Use Groq to analyze project name and select best matching music track
    const trackList = Object.entries(MUSIC_TRACKS)
      .map(([key, track]) => `- ${key}: ${track.name} — ${track.mood}`)
      .join('\n');

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a music recommendation assistant for real estate video walkthroughs.
Analyze the project name and select the best matching music track from this list:
${trackList}

Output a JSON object with exactly this structure:
{
  "musicKey": "the-key-from-the-list",
  "reason": "2-3 sentence explanation of why this track matches the property"
}

Choose based on mood alignment: upscale/luxury → cinematic, modern/minimal → modern, warm/cozy → warm, outdoor/nature → acoustic, energetic/urban → upbeat.`,
          },
          {
            role: 'user',
            content: `Project name: ${projectName}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 150,
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      logger.error('Groq API failed', { status: groqResponse.status, error: errText });
      return NextResponse.json({ error: 'Failed to recommend music' }, { status: 500 });
    }

    const groqData = await groqResponse.json();
    const rawContent = groqData.choices?.[0]?.message?.content?.trim() || '{}';

    // Parse JSON from response (handle markdown code blocks)
    let parsed: { musicKey?: string; reason?: string } = {};
    try {
      const jsonMatch = rawContent.match(/```json\n?([\s\S]*?)\n?```/) || rawContent.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        parsed = JSON.parse(rawContent);
      }
    } catch {
      logger.warn('Failed to parse Groq music response', { rawContent });
      // Fallback to upbeat-1
      parsed = { musicKey: 'upbeat-1', reason: 'Default recommendation based on project characteristics.' };
    }

    const musicKey = parsed.musicKey || 'upbeat-1';
    const reason = parsed.reason || 'Recommended based on project characteristics.';

    // Validate musicKey exists
    if (!MUSIC_TRACKS[musicKey as keyof typeof MUSIC_TRACKS]) {
      logger.warn('Invalid musicKey from Groq, using default', { musicKey });
    }

    logger.info('Music recommendation', { projectId: project.id, musicKey, reason });

    return NextResponse.json({ musicKey, reason });
  } catch (err) {
    logger.error('recommend-music error', { error: String(err), projectId: project.id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
