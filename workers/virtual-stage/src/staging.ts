import Replicate from 'replicate';
import type { StylePreset } from './types.js';

const STYLE_PROMPTS: Record<StylePreset, string> = {
  modern: 'Tastefully furnished modern living room with contemporary furniture, neutral tones, minimalist design, professional interior photography',
  scandinavian: 'Scandinavian style room with light wood furniture, cozy textiles, minimalist decor, bright and airy atmosphere',
  industrial: 'Industrial loft style room with exposed brick, metal fixtures, reclaimed wood, vintage furniture',
  warm: 'Warm and cozy furnished room with rich colors, comfortable furniture, ambient lighting, inviting atmosphere',
};

export async function stageRoom(
  photoUrl: string,
  style: StylePreset
): Promise<{ resultUrl: string }> {
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN || '' });
  const prompt = STYLE_PROMPTS[style];

  // Using Flux Fill Dev for inpainting - full image as context
  const model = 'black-forest-labs/flux-fill-dev:3b44b63638d5c9e7b7cb6c1ee0a0c3f3a8a7e23e8e1b4b0c9e8f7a6b5c4d3e2f';

  const output = await replicate.run(model, {
    input: {
      prompt,
      image: photoUrl,
      mask: undefined,
      guidance_scale: 7.5,
      num_inference_steps: 50,
    },
  }) as unknown as { image: string } | string;

  const resultUrl = typeof output === 'string' ? output : (output as { image: string }).image;
  return { resultUrl };
}
