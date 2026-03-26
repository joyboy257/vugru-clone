// Credit costs for each operation
export const CREDIT_COSTS = {
  clip_720p: 1,
  clip_1080p: 2,
  clip_4k: 4,
  auto_edit: 1,
  virtual_staging: 1,  // per photo
  sky_replacement: 1,  // per photo
  music_generation: 2,
} as const;

export type CreditOperation = keyof typeof CREDIT_COSTS;

export function getClipCost(resolution: '720p' | '1080p' | '4k'): number {
  switch (resolution) {
    case '720p': return CREDIT_COSTS.clip_720p;
    case '1080p': return CREDIT_COSTS.clip_1080p;
    case '4k': return CREDIT_COSTS.clip_4k;
  }
}

export function formatCredits(credits: number): string {
  if (credits >= 1000) {
    return `$${(credits / 100).toFixed(2)}`;
  }
  return `${credits} credits`;
}

export function parseCreditsToDollars(credits: number): number {
  return credits / 100;
}

export function dollarsToCredits(dollars: number): number {
  return Math.round(dollars * 1250); // 1 dollar = 1250 credits
}

export const CREDIT_PACKAGES = [
  { credits: 25000,  dollars: 20,  label: '$20',  bonus: 0     },
  { credits: 62500,  dollars: 50,  label: '$50',  bonus: 12500 },  // extra 12,500 over base rate
  { credits: 130000, dollars: 100, label: '$100', bonus: 30000 },  // extra 30,000 over base rate
] as const;

export function getCreditsForDollars(dollars: number): number {
  // Base rate: 1 dollar = 1250 credits
  // Bonus credits are added on top of the base rate
  const base = dollars * 1250;
  const pkg = CREDIT_PACKAGES.find(p => p.dollars === dollars);
  return pkg ? pkg.credits : base;
}
