import { z } from 'zod';

export const CLIP_QUEUE_NAME = 'propframe:clips';

export const MotionStyleSchema = z.enum([
  'push-in',
  'zoom-out',
  'pan-left',
  'pan-right',
  'custom',
]);

export const ResolutionSchema = z.enum(['720p', '1080p', '4k']);

export const ClipJobSchema = z.object({
  clipId: z.string().uuid(),
  projectId: z.string().uuid(),
  photoId: z.string().uuid(),
  photoStorageKey: z.string(),
  motionStyle: MotionStyleSchema,
  customPrompt: z.string().nullable(),
  resolution: ResolutionSchema,
  userId: z.string().uuid(),
});

export type ClipJob = z.infer<typeof ClipJobSchema>;
export type MotionStyle = z.infer<typeof MotionStyleSchema>;
export type Resolution = z.infer<typeof ResolutionSchema>;

export interface ClipJobResult {
  clipId: string;
  status: 'done' | 'error';
  publicUrl?: string;
  storageKey?: string;
  errorMessage?: string;
}
