import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { autoEdits, projects } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

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

// POST /api/auto-edits/[id]/generate-title
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await getAutoEditWithAuth(req, params.id);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { project } = result;
  const body = await req.json();
  const { projectName, photoUrl } = body;

  if (!projectName || !photoUrl) {
    return NextResponse.json({ error: 'projectName and photoUrl are required' }, { status: 400 });
  }

  logger.info('generate-title request', { projectId: project.id, projectName, photoUrl });

  try {
    // Step 1: Use Cohere Vision to describe the first photo
    const cohereResponse = await fetch('https://api.cohere.ai/v1/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'command-a-plus-03-2025',
        message: `Describe this real estate photo in 1-2 sentences. Focus on architectural style, mood, and key visual features: ${photoUrl}`,
      }),
    });

    if (!cohereResponse.ok) {
      const errText = await cohereResponse.text();
      logger.error('Cohere Vision API failed', { status: cohereResponse.status, error: errText });
      return NextResponse.json({ error: 'Failed to analyze photo' }, { status: 500 });
    }

    const cohereData = await cohereResponse.json();
    const photoDescription = cohereData.message?.content?.[0]?.text || '';

    logger.info('Cohere Vision result', { projectId: project.id, photoDescription });

    // Step 2: Use Groq to generate cinematic title from project name + photo description
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
            content: `Generate a short, cinematic title for a real estate video walkthrough.
Max 6 words, no punctuation, no quotes.
Examples: Modern Loft in Chelsea, Golden Hour on Oak Street, Coastal Retreat with Ocean Views, Luxury Penthouse Downtown

Based on the project name and photo description, create an evocative title that captures the property's essence.`,
          },
          {
            role: 'user',
            content: `Project name: ${projectName}\nPhoto description: ${photoDescription}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 30,
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      logger.error('Groq API failed', { status: groqResponse.status, error: errText });
      return NextResponse.json({ error: 'Failed to generate title' }, { status: 500 });
    }

    const groqData = await groqResponse.json();
    let title = groqData.choices?.[0]?.message?.content?.trim() || projectName;

    // Clean up title: remove quotes, limit to 6 words
    title = title.replace(/['"]/g, '').trim();
    const words = title.split(/\s+/);
    if (words.length > 6) {
      title = words.slice(0, 6).join(' ');
    }

    logger.info('Generated title', { projectId: project.id, title });

    return NextResponse.json({ title });
  } catch (err) {
    logger.error('generate-title error', { error: String(err), projectId: project.id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
