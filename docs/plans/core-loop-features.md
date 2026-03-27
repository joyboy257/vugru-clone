# Feature Spec: Core Loop Features — CogVideoX Verification, Batch Generation, Resolution UI

**Date:** 2026-03-27
**Status:** Implementing
**Priority:** P1
**Feature:** Batch clip generation, CogVideoX verification, resolution selector UI
**Spec驱动:** Yes

---

## What It Is

Three related improvements to PropFrame's core video generation loop:
1. **CogVideoX verification** — document the actual video provider architecture (Runway Gen-3 + SVD, not Replicate/CogVideoX), create a test script
2. **Batch clip generation** — `POST /api/projects/[id]/clips/batch-generate` to generate clips for all (or selected) photos at once
3. **Resolution selector UI** — expose resolution/credit cost selection in the "Generate All Clips" flow

---

## Architecture Notes (Important Discovery)

The codebase has two video generation paths:

1. **Active (Runway Gen-3 / SVD):** `gpu-worker/src/clipProcessor.ts` → `providers/index.ts` → `runway.ts` or `svd.ts`
2. **Legacy (Replicate/CogVideoX):** `gpu-worker/src/replicate.ts` — exists but is **NOT wired** into `clipProcessor.ts`

The `providers/index.ts` only exports `{ runway, svd }`. The CogVideoX code in `replicate.ts` is dead code.

**Model IDs:**
- Runway: `gen3a_turbo` (or `gen3a`) — confirmed in `runway.ts` line 65
- SVD: `stabilityai/stable-video-diffusion-img2vid` — confirmed in `svd.ts` line 13
- CogVideoX (unused): `zsxkib/cogvideo-5b-filtered:4e39e939b89eec4af5e6c6cd9a5a3c20e3cfb9a6c0d3ee5fd71da5e58a63c0f4`

---

## API Design

### `POST /api/projects/[id]/clips/batch-generate`

**Request:**
```json
{
  "photoIds": ["photo_1", "photo_2"],  // optional; if omitted, all photos without clips
  "resolution": "720p" | "1080p" | "4k",
  "motionStyle": "push-in" | "zoom-out" | "pan-left" | "pan-right" | "custom"
}
```

**Response (202):**
```json
{
  "jobId": "batch_abc123",
  "estimatedCredits": 8,
  "count": 4
}
```

**Behavior:**
- Returns immediately (202 Accepted) — jobs queued, not blocking
- Deducts credits upfront for all jobs
- Creates clip records with `status: 'queued'` for each photo
- Enqueues one BullMQ job per photo
- Errors: 402 (insufficient credits), 404 (project not found)

---

## User Flow

### Batch Generate All Clips

1. User goes to Clips tab in project editor
2. Clicks "Generate All Clips" button
3. Modal shows:
   - Number of photos that need clips
   - Resolution selector (720p/1080p/4K)
   - Credit cost breakdown
   - Confirm / Cancel buttons
4. On confirm → API call → 202 → toast "Generating N clips..."
5. Clips appear in grid as "queued" and transition to "done" via polling

---

## Data Model

No schema changes required. Existing `clips` table has all needed columns:
- `status: 'queued' | 'processing' | 'done' | 'error'`
- `resolution: '720p' | '1080p' | '4k'`
- `motionStyle: string`
- `cost: number`

Batch operation uses existing BullMQ infrastructure — no new queue needed.

---

## Files to Create / Modify

- `app/api/projects/[id]/clips/batch-generate/route.ts` — **CREATE**
- `scripts/test-clip-generation.ts` — **CREATE** (test script, not production)
- `app/(app)/project/[id]/ProjectEditorClient.tsx` — **MODIFY** (add batch button + modal)
- `docs/roadmap/v1.md` — **UPDATE** (mark items done, clarify provider architecture)
- `docs/logs/2026-03-27-sprint-2.md` — **UPDATE** (log progress)
- `gpu-worker/src/replicate.ts` — **MODIFY** (mark as legacy/deprecated, add note)

---

## Implementation Checklist

- [x] Spec written (this document)
- [x] Architecture clarified (Runway/SVD active, CogVideoX is legacy)
- [x] Test script created (`scripts/test-clip-generation.ts`)
- [ ] `POST /api/projects/[id]/clips/batch-generate` implemented
- [ ] Batch button + modal added to `ProjectEditorClient.tsx`
- [ ] Resolution selector in batch modal
- [ ] `docs/roadmap/v1.md` updated
- [ ] `docs/logs/2026-03-27-sprint-2.md` updated

---

## Blockers

- None identified — all infrastructure exists

---

## Notes

- Credit cost is already documented in `lib/credits.ts` (720p=1, 1080p=2, 4K=4)
- Resolution selector already exists in `ClipGrid.tsx` for per-clip generation
- Need to add batch "Generate All" flow on top of existing per-clip flow
- The CogVideoX model ID in the roadmap is incorrect — Runway Gen-3 is the active provider
