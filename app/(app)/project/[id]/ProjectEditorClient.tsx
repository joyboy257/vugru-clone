'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { PhotoUploader } from '@/components/editor/PhotoUploader';
import { ClipGrid, type Clip } from '@/components/editor/ClipGrid';
import { AutoEditTab } from '@/components/editor/AutoEditTab';
import { Button } from '@/components/ui/Button';
import { InlineEdit } from '@/components/InlineEdit';
import { SortablePhotoGrid } from '@/components/editor/SortablePhotoGrid';
import { VirtualStageModal } from '@/components/editor/VirtualStageModal';
import { ArrowLeft, Wand2, Sparkles, Film, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Photo {
  id: string;
  storageKey: string;
  filename: string;
  publicUrl: string | null;
  width?: number | null;
  height?: number | null;
  order: number;
}

interface Project {
  id: string;
  name: string;
  status: string;
  clipCount: number;
  thumbnailUrl?: string | null;
}

export interface AutoEdit {
  id: string;
  projectId: string;
  clipIds: string[];
  titleText?: string | null;
  musicKey?: string | null;
  status: 'draft' | 'rendering' | 'done' | 'error';
  publicUrl?: string | null;
  storageKey?: string | null;
  shareToken?: string | null;
  shareExpiresAt?: string | Date | null;
  cost: number;
  createdAt: string | Date;
}

export default function ProjectEditorClient({
  project: initialProject,
  photos: initialPhotos,
  clips: initialClips,
  autoEdits: initialAutoEdits,
  onProjectUpdated,
}: {
  project: Project;
  photos: Photo[];
  clips: Clip[];
  autoEdits: AutoEdit[];
  onProjectUpdated?: (project: Project) => void;
}) {
  const [project, setProject] = useState(initialProject);
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [clips, setClips] = useState<Clip[]>(initialClips);
  const [autoEdits, setAutoEdits] = useState<AutoEdit[]>(initialAutoEdits);
  const [generatingCount, setGeneratingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'photos' | 'clips' | 'edit'>('photos');
  const [stagingPhoto, setStagingPhoto] = useState<Photo | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.project) setProject(data.project);
      if (data.photos) setPhotos(data.photos);
      if (data.clips) setClips(data.clips);
    } catch { /* silent */ }
  }, [project.id]);

  // Poll clip statuses when there are in-flight clips
  useEffect(() => {
    const inFlight = clips.some(c => c.status === 'queued' || c.status === 'processing');
    if (!inFlight) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    if (pollingRef.current) return; // already polling

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${project.id}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const { clips: updated } = await res.json();

        // Merge: replace local clips with server state
        setClips(prev => {
          if (updated.length === 0) return prev;
          // Only replace statuses/URLs — don't reorder
          const merged = prev.map(local => {
            const server = updated.find((s: Clip) => s.id === local.id);
            return server ? { ...local, ...server } : local;
          });
          // Add any new clips the server has that we don't
          const localIds = new Set(prev.map(c => c.id));
          const newOnServer = updated.filter((s: Clip) => !localIds.has(s.id));
          return [...merged, ...newOnServer];
        });
      } catch {
        // silent fail — will retry on next interval
      }
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [clips, project.id]);

  const handlePhotoUploaded = useCallback((photo: Photo) => {
    setPhotos(prev => [...prev, photo]);
    if (photos.length === 0) {
      setProject(prev => prev ? { ...prev, thumbnailUrl: photo.publicUrl } : prev);
    }
  }, [photos.length]);

  const handlePhotoDeleted = useCallback((photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  }, []);

  const handlePhotosReordered = useCallback((newOrder: string[]) => {
    setPhotos(prev => {
      const sorted = newOrder
        .map(id => prev.find(p => p.id === id))
        .filter(Boolean) as Photo[];
      // Fill in any missing photos that weren't in the order
      const orderedIds = new Set(newOrder);
      const extras = prev.filter(p => !orderedIds.has(p.id));
      return [...sorted, ...extras];
    });
  }, []);

  const handleGenerateClip = useCallback(async (photoId: string, motionStyle: string, resolution: string) => {
    if (generatingCount >= 5) {
      toast.error('Maximum 5 clips can be generating at once.');
      return;
    }

    setGeneratingCount(prev => prev + 1);
    const tempId = `temp-${Date.now()}`;
    setClips(prev => [...prev, {
      id: tempId,
      photoId,
      status: 'queued',
      motionStyle,
      resolution,
      cost: resolution === '4k' ? 4 : resolution === '1080p' ? 2 : 1,
    }]);

    try {
      const res = await fetch('/api/clips/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ photoId, motionStyle, resolution }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to generate clip');
        setClips(prev => prev.filter(c => c.id !== tempId));
        return;
      }

      const { clip } = await res.json();
      setClips(prev => prev.map(c => c.id === tempId ? clip : c));
      toast.success('Clip queued for generation.');
    } catch {
      toast.error('Network error. Please try again.');
      setClips(prev => prev.filter(c => c.id !== tempId));
    } finally {
      setGeneratingCount(prev => Math.max(0, prev - 1));
    }
  }, [generatingCount]);

  const handleRetryClip = useCallback(async (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    await handleGenerateClip(clip.photoId, clip.motionStyle, clip.resolution);
  }, [clips, handleGenerateClip]);

  const handleAutoEditCreated = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}`, { credentials: 'include' });
      if (!res.ok) return;
      const { autoEdits: updatedAutoEdits } = await res.json();
      setAutoEdits(updatedAutoEdits);
    } catch {
      // silent
    }
  }, [project.id]);

  const handleRename = useCallback(async (newName: string) => {
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: newName }),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || 'Failed to rename project');
      throw new Error(err.error);
    }

    const { project: updated } = await res.json();
    setProject(updated);
    onProjectUpdated?.(updated);
    toast.success('Project renamed');
  }, [project.id, onProjectUpdated]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-4 shrink-0">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <InlineEdit
            value={project.name}
            onSave={handleRename}
            textClassName="font-semibold text-slate-200 truncate"
            className="w-full"
            inputClassName="w-full min-w-0"
            iconSize={16}
          />
        </div>

        {/* Tab nav */}
        <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1">
          {([
            { key: 'photos', label: 'Photos', icon: Film },
            { key: 'clips', label: 'Clips', icon: Wand2 },
            { key: 'edit', label: 'Auto-Edit', icon: Sparkles },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                activeTab === tab.key
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.key === 'clips' && clips.length > 0 && (
                <span className="text-xs text-slate-600">({clips.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'photos' && (
          <div className="max-w-4xl">
            <PhotoUploader
              projectId={project.id}
              onPhotoUploaded={handlePhotoUploaded}
            />

            {photos.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-slate-400">
                    {photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded
                  </h2>
                  <button
                    onClick={() => {
                      if (!confirm('Remove all photos from this project?')) return;
                      fetch(`/api/projects/${project.id}/photos`, { method: 'DELETE', credentials: 'include' })
                        .then(res => { if (!res.ok) throw new Error(); setPhotos([]); })
                        .catch(() => toast.error('Failed to clear photos'));
                    }}
                    className="text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear all
                  </button>
                </div>
                <SortablePhotoGrid
                  photos={photos}
                  projectId={project.id}
                  onDeleted={handlePhotoDeleted}
                  onReordered={handlePhotosReordered}
                  onStageClick={setStagingPhoto}
                />

                {stagingPhoto && (
                  <VirtualStageModal
                    photo={stagingPhoto}
                    projectId={project.id}
                    onClose={() => setStagingPhoto(null)}
                    onStaged={() => { fetchProject(); setStagingPhoto(null); }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'clips' && (
          <div className="max-w-4xl">
            <ClipGrid
              clips={clips}
              projectId={project.id}
              onGenerateClip={handleGenerateClip}
              onRetryClip={handleRetryClip}
              generatingCount={generatingCount}
              isGeneratingLocked={generatingCount >= 5}
            />
          </div>
        )}

        {activeTab === 'edit' && (
          <AutoEditTab
            projectId={project.id}
            clips={clips}
            autoEdits={autoEdits}
            onAutoEditCreated={handleAutoEditCreated}
          />
        )}
      </div>
    </div>
  );
}
