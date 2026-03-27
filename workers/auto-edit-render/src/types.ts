export interface AutoEditRenderJob {
  autoEditId: string;
  projectId: string;
  userId: string;
  clipIds: string[];
  titleText: string;
  musicKey: string;
}

export interface AutoEditRecord {
  id: string;
  projectId: string;
  storageKey: string | null;
  publicUrl: string | null;
  clipIds: string[];
  titleText: string | null;
  musicKey: string | null;
  duration: string;
  status: string;
  cost: number;
  shareToken: string | null;
  shareExpiresAt: Date | null;
  createdAt: Date;
}

export interface ClipRecord {
  id: string;
  projectId: string;
  photoId: string;
  storageKey: string | null;
  publicUrl: string | null;
  motionStyle: string;
  customPrompt: string | null;
  resolution: string;
  duration: string;
  status: string;
  errorMessage: string | null;
  cost: number;
  jobId: string | null;
}
