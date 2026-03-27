import { z } from 'zod';

export const SKY_STYLES = ['blue-sky', 'golden-hour', 'twilight', 'custom'] as const;
export type SkyStyle = typeof SKY_STYLES[number];

export const SkyReplaceJobSchema = z.object({
  photoId: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  photoStorageKey: z.string(),
  skyStyle: z.enum(SKY_STYLES),
  customSkyUrl: z.string().url().optional(),
});

export type SkyReplaceJob = z.infer<typeof SkyReplaceJobSchema>;