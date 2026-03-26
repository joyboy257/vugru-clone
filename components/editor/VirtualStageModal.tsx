'use client';
import { useState } from 'react';
import { X, Wand2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface Photo {
  id: string;
  publicUrl: string | null;
  filename: string;
}

interface VirtualStageModalProps {
  photo: Photo;
  projectId: string;
  onClose: () => void;
  onStaged: (stagedPublicUrl: string, style: string) => void;
}

const STYLE_PRESETS = [
  { key: 'modern', label: 'Modern', desc: 'Contemporary furniture, neutral tones' },
  { key: 'scandinavian', label: 'Scandinavian', desc: 'Light wood, cozy textiles' },
  { key: 'industrial', label: 'Industrial', desc: 'Exposed brick, vintage fixtures' },
  { key: 'warm', label: 'Warm', desc: 'Rich colors, ambient lighting' },
];

export function VirtualStageModal({ photo, projectId, onClose, onStaged }: VirtualStageModalProps) {
  const [selectedStyle, setSelectedStyle] = useState<string>('modern');
  const [loading, setLoading] = useState(false);

  async function handleStage() {
    setLoading(true);
    try {
      const res = await fetch(`/api/photos/${photo.id}/virtual-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ style: selectedStyle }),
      });
      if (!res.ok) {
        const err = await res.json();
        if (err.alreadyStaged) {
          toast.error('This photo is already staged');
        } else {
          toast.error(err.error || 'Failed to stage room');
        }
        return;
      }
      toast.success('Room staged! Check back in a moment.');
      onStaged(photo.publicUrl || '', selectedStyle);
      onClose();
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Virtual Staging</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Before image */}
        <div className="relative rounded-xl overflow-hidden">
          <img src={photo.publicUrl || ''} alt="Original" className="w-full aspect-video object-cover" />
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">Before</div>
        </div>

        {/* Style picker */}
        <div className="grid grid-cols-2 gap-2">
          {STYLE_PRESETS.map(preset => (
            <button
              key={preset.key}
              onClick={() => setSelectedStyle(preset.key)}
              className={cn(
                'p-3 rounded-xl border text-left transition-colors',
                selectedStyle === preset.key
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-700 bg-slate-800 hover:border-slate-600'
              )}
            >
              <div className="text-sm font-medium text-white">{preset.label}</div>
              <div className="text-xs text-slate-400 mt-0.5">{preset.desc}</div>
            </button>
          ))}
        </div>

        {/* Cost */}
        <div className="text-xs text-slate-500">1 credit will be deducted</div>

        {/* CTA */}
        <Button onClick={handleStage} loading={loading} className="w-full gap-2">
          <Wand2 className="w-4 h-4" />
          {loading ? 'Staging room...' : 'Stage Room'}
        </Button>
      </div>
    </div>
  );
}
