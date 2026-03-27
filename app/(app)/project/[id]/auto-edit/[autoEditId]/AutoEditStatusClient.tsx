'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Share2, Check, Copy, Loader2, AlertCircle, Film, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

interface AutoEdit {
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
  errorMessage?: string | null;
}

interface AutoEditStatusClientProps {
  projectId: string;
  projectName: string;
  autoEdit: AutoEdit;
}

const RENDER_STEPS = [
  { key: 'assembling', label: 'Assembling', description: 'Preparing video clips' },
  { key: 'rendering', label: 'Rendering', description: 'Processing video frames' },
  { key: 'finalizing', label: 'Finalizing', description: 'Adding music and title' },
  { key: 'done', label: 'Done', description: 'Video ready' },
];

function getStepIndex(status: AutoEdit['status']): number {
  if (status === 'error') return -1;
  if (status === 'draft') return 0;
  if (status === 'rendering') return 2; // Shows "Rendering" step but assembly is done
  if (status === 'done') return 3;
  return 0;
}

export function AutoEditStatusClient({ projectId, projectName, autoEdit: initialAutoEdit }: AutoEditStatusClientProps) {
  const [autoEdit, setAutoEdit] = useState(initialAutoEdit);
  const [copied, setCopied] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const pollingRef = typeof window !== 'undefined' ? { current: null as NodeJS.Timeout | null } : null;

  // Poll for status updates
  useEffect(() => {
    if (autoEdit.status === 'done' || autoEdit.status === 'error') return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/auto-edits/${autoEdit.id}`, { credentials: 'include' });
        if (!res.ok) return;
        const { autoEdit: updated } = await res.json();
        setAutoEdit(updated);
        if (updated.status === 'done' || updated.status === 'error') {
          if (pollingRef?.current) clearInterval(pollingRef.current);
        }
      } catch { /* silent */ }
    };

    pollingRef!.current = setInterval(poll, 3000);
    return () => { if (pollingRef?.current) clearInterval(pollingRef.current); };
  }, [autoEdit.id, autoEdit.status, pollingRef]);

  const handleShare = async () => {
    try {
      const res = await fetch(`/api/auto-edits/${autoEdit.id}/share`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const url = window.location.origin + data.shareUrl;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to share');
    }
  };

  const handleCopyCaption = async () => {
    if (!shareUrl) await handleShare();
    const url = shareUrl || window.location.origin;
    const caption = autoEdit.titleText
      ? `Check out this property video: ${autoEdit.titleText} ${url}`
      : `Check out this property video! ${url}`;
    await navigator.clipboard.writeText(caption);
    setCopiedCaption(true);
    toast.success('Caption copied!');
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const stepIndex = getStepIndex(autoEdit.status);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/project/${projectId}`} className="text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">{autoEdit.titleText || projectName}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Auto-edit status</p>
        </div>
      </div>

      {/* Status badge */}
      <div className="mb-8">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
          autoEdit.status === 'done' ? 'bg-emerald-900/30 text-emerald-400' :
          autoEdit.status === 'rendering' ? 'bg-amber-900/30 text-amber-400' :
          autoEdit.status === 'error' ? 'bg-red-900/30 text-red-400' :
          'bg-slate-800 text-slate-400'
        }`}>
          {autoEdit.status === 'rendering' && <Loader2 className="w-4 h-4 animate-spin" />}
          {autoEdit.status === 'done' && <Check className="w-4 h-4" />}
          {autoEdit.status === 'error' && <AlertCircle className="w-4 h-4" />}
          {autoEdit.status.charAt(0).toUpperCase() + autoEdit.status.slice(1)}
        </span>
      </div>

      {/* Step indicator */}
      {autoEdit.status !== 'error' && (
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {RENDER_STEPS.map((step, idx) => {
              const isComplete = idx < stepIndex;
              const isCurrent = idx === stepIndex - 1 || (autoEdit.status === 'rendering' && idx === 1);
              const isPending = idx > stepIndex;
              return (
                <div key={step.key} className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isComplete ? 'bg-emerald-600 text-white' :
                    isCurrent ? 'bg-amber-500 text-white animate-pulse' :
                    'bg-slate-800 text-slate-500'
                  }`}>
                    {isComplete ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`text-xs mt-2 text-center ${isCurrent ? 'text-slate-300' : 'text-slate-600'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${((stepIndex) / (RENDER_STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {autoEdit.status === 'error' && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-300">Rendering failed</p>
              <p className="text-xs text-red-400/70 mt-1">{autoEdit.errorMessage || 'An error occurred during rendering.'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Video preview + download */}
      {autoEdit.status === 'done' && autoEdit.publicUrl && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <video
              src={autoEdit.publicUrl}
              controls
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-3">
            <a href={autoEdit.publicUrl} download target="_blank" rel="noopener noreferrer">
              <Button className="gap-2">
                <Download className="w-4 h-4" />
                Download MP4
              </Button>
            </a>
            <Button variant="secondary" onClick={handleShare} className="gap-2">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Share Link'}
            </Button>
            <Button variant="secondary" onClick={handleCopyCaption} className="gap-1.5">
              {copiedCaption ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copiedCaption ? 'Copied!' : 'Copy Caption'}
            </Button>
          </div>
        </div>
      )}

      {/* Back link */}
      <div className="mt-8">
        <Link href={`/project/${projectId}`} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
          ← Back to project
        </Link>
      </div>
    </div>
  );
}
