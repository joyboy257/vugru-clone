import { z } from 'zod';

export const STYLE_PRESETS = ['modern', 'scandinavian', 'industrial', 'warm'] as const;
export type StylePreset = typeof STYLE_PRESETS[number];

export const VirtualStageJobSchema = z.object({
  photoId: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  photoStorageKey: z.string(),
  style: z.enum(STYLE_PRESETS),
});

export type VirtualStageJob = z.infer<typeof VirtualStageJobSchema>;
