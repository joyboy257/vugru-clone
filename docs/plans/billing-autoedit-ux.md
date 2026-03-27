# Feature Spec: Billing + Auto-Edit UX

**Date:** 2026-03-27
**Status:** Implementing
**Priority:** P1
**Feature:** Invoice history, credit toast, AI title generation, AI music recommendation, auto-edit status page
**Spec驱动:** Yes

---

## What It Is

Five UX improvements for PropFrame's billing and auto-edit flows: (1) invoice history page, (2) credit purchase confirmation toast with URL param cleanup, (3) AI-generated cinematic title for auto-edit videos, (4) AI-recommended music track matching project mood, and (5) a dedicated auto-edit render status page.

---

## User Flow

### Item 1 — Invoice History Page
1. User navigates to `/dashboard/invoices`
2. Page fetches `GET /api/billing/history` (last 20 paid invoices)
3. For each invoice: date, amount, status badge (paid), "View Invoice" link to Stripe hosted page
4. Empty state shown if no invoices

### Item 2 — Credit Purchase Confirmation Toast
1. User completes Stripe checkout and is redirected to `/dashboard/billing?credits_added=N`
2. Page detects `credits_added` query param
3. Shows success toast: "N credits added to your account"
4. Uses `window.history.replaceState` to strip the query param from URL (no page reload)
5. Existing banner + toast already in `BillingClient.tsx` — add URL cleanup

### Item 3 — AI Title Text Generation
1. User opens Generate Video modal in project editor
2. Clicks "Generate with AI" button next to title input
3. API `POST /api/auto-edits/[id]/generate-title` called with project name + first photo URL
4. Cohere Vision describes the first photo → Groq generates cinematic title (max 6 words, no punctuation)
5. Title field populated + "AI Generated" badge shown
6. Badge clears if user manually edits the title

### Item 4 — AI Music Recommendation
1. User opens Generate Video modal
2. API `POST /api/auto-edits/[id]/recommend-music` called with project name
3. Groq analyzes project name → selects best matching preset from `lib/music.ts`
4. "AI Recommended" badge appears on matched track
5. Track auto-selected in music picker

### Item 5 — Auto-Edit Render Status Page
1. User clicks "View Status" in auto-edit modal or AutoEditTab
2. Navigates to `/project/[id]/auto-edit/[autoEditId]/page.tsx`
3. Page shows: status badge, step indicator (Assembling → Rendering → Finalizing → Done)
4. Error message displayed if failed
5. When done: video preview player + download button
6. Polls `/api/auto-edits/[autoEditId]` for status updates

---

## API Design

### `POST /api/auto-edits/[id]/generate-title`

**Request:**
```json
{
  "projectName": "Luxury Penthouse in Tribeca",
  "photoUrl": "https://r2.example.com/photos/abc.jpg"
}
```

**Response (200):**
```json
{
  "title": "Luxury Penthouse in Tribeca"
}
```

**Errors:**
- `400` — missing projectName or photoUrl
- `401` — unauthorized
- `404` — auto-edit not found

---

### `POST /api/auto-edits/[id]/recommend-music`

**Request:**
```json
{
  "projectName": "Oceanfront Villa with Sunset Views"
}
```

**Response (200):**
```json
{
  "musicKey": "warm-1",
  "reason": "The project name suggests a warm, relaxed mood befitting a coastal sunset property"
}
```

**Errors:**
- `400` — missing projectName
- `401` — unauthorized
- `404` — auto-edit not found

---

## Data Model

No schema changes — all fields already exist on `auto_edits` table (`titleText`, `musicKey`, `status`, `publicUrl`, `storageKey`).

---

## Files to Create / Modify

### New files
- `app/(app)/dashboard/invoices/page.tsx` — Invoice history page
- `app/api/auto-edits/[id]/generate-title/route.ts` — AI title generation
- `app/api/auto-edits/[id]/recommend-music/route.ts` — AI music recommendation
- `app/(app)/project/[id]/auto-edit/[autoEditId]/page.tsx` — Auto-edit status page

### Modified files
- `app/(app)/dashboard/billing/BillingClient.tsx` — Add `window.history.replaceState` to strip `credits_added` param + strip param after toast
- `app/(app)/project/[id]/ProjectEditorClient.tsx` — Add "Generate with AI" button to render modal title input
- `docs/roadmap/v1.md` — Mark items complete
- `docs/logs/2026-03-27-sprint-2.md` — Log each item completion

---

## Implementation Checklist

- [ ] Item 1: Invoice history page created
- [ ] Item 2: Credit purchase toast with URL param cleanup added
- [ ] Item 3: `POST /api/auto-edits/[id]/generate-title` implemented
- [ ] Item 3: "Generate with AI" button + "AI Generated" badge in render modal
- [ ] Item 4: `POST /api/auto-edits/[id]/recommend-music` implemented
- [ ] Item 4: "AI Recommended" badge + auto-select in music picker
- [ ] Item 5: Auto-edit status page created
- [ ] All routes use `lib/logger.ts` for structured logging
- [ ] `docs/roadmap/v1.md` updated
- [ ] `docs/logs/2026-03-27-sprint-2.md` updated

---

## Blockers

-

## Notes

- Cohere Vision API: `COHERE_API_KEY` env var — use `cohere` npm package
- Groq: `GROQ_API_KEY` env var — use `groq` npm package with `llama-3.3-70b`
- Music track matching uses Groq with enumerated track list for deterministic output
