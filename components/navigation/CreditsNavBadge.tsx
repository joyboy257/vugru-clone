'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Coins } from 'lucide-react';
import { BuyCreditsModal } from '@/components/billing/BuyCreditsModal';

interface CreditsNavBadgeProps {
  credits: number;
}

export function CreditsNavBadge({ credits }: CreditsNavBadgeProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-full hover:border-slate-600 transition-colors"
        title="Buy credits"
      >
        <Coins className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-xs font-mono text-emerald-400">
          {credits.toLocaleString()}
        </span>
      </button>
      {open && <BuyCreditsModal onClose={() => setOpen(false)} />}
    </>
  );
}
