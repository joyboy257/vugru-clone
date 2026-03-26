'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Play, Clock, AlertCircle, CheckCircle } from 'lucide-react';

interface AutoEdit {
  id: string;
  titleText?: string | null;
  musicKey?: string | null;
  publicUrl?: string | null;
  storageKey?: string | null;
  status: string;
  clipIds: string[];
  createdAt: string;
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const [autoEdit, setAutoEdit] = useState<AutoEdit | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(res => {
        if (!res.ok) {
          if (res.status === 410) return { error: 'Link expired' };
          if (res.status === 404) return { error: 'Not found' };
          throw new Error('Failed to load');
        }
        return res.json();
      })
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setAutoEdit(data.autoEdit);
          setProjectName(data.projectName);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load. Please try again.');
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-4">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h1 className="text-xl font-semibold text-white mb-2">
          {error === 'Link expired' ? 'Link Expired' : 'Not Found'}
        </h1>
        <p className="text-slate-400 text-sm">
          {error === 'Link expired'
            ? 'This share link has expired. Please request a new one from the video owner.'
            : 'This video could not be found.'}
        </p>
      </div>
    );
  }

  const isReady = autoEdit?.status === 'done' && autoEdit?.publicUrl;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-semibold text-lg">{projectName ?? 'Property Video'}</h1>
            {autoEdit?.titleText && (
              <p className="text-slate-400 text-sm">{autoEdit.titleText}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {autoEdit?.status === 'done' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/30 text-emerald-400">
                <CheckCircle className="w-3 h-3" />
                Ready
              </span>
            )}
            {autoEdit?.status === 'rendering' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-900/30 text-amber-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Rendering
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Video Player */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-3xl">
          {isReady ? (
            <div className="space-y-4">
              <video
                key={autoEdit!.publicUrl}
                src={autoEdit!.publicUrl!}
                controls
                autoPlay={false}
                className="w-full rounded-xl bg-black shadow-2xl"
              />
              {/* Social share buttons */}
              <div className="flex items-center gap-3 pt-2">
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Share
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this property video!')}&url=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  Post
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  LinkedIn
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              {autoEdit?.status === 'rendering' ? (
                <>
                  <Loader2 className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-spin" />
                  <h2 className="text-xl font-semibold text-white mb-2">Still Rendering</h2>
                  <p className="text-slate-400 text-sm">This video is being prepared. Please check back in a few minutes.</p>
                </>
              ) : (
                <>
                  <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-white mb-2">Video Not Available</h2>
                  <p className="text-slate-400 text-sm">This video is not ready yet. Check back soon.</p>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-4 text-center">
        <p className="text-xs text-slate-600">
          Powered by PropFrame · Link expires in 7 days
        </p>
      </footer>
    </div>
  );
}
