# Feature Spec: Sky Replacement

**Date:** 2026-03-26
**Status:** Spec
**Priority:** P0
**Feature:** Sky replacement for exterior photos

---

## What It Is

Users click "Sky Replacement" on exterior photos. The system detects the sky region using AI segmentation, replaces it with a selected sky preset, and saves the result back to R2.

**Pricing:** 1 credit per photo (matches `CREDIT_COSTS.sky_replacement` in `lib/credits.ts`)

---

## User Flow

1. User uploads an exterior photo
2. In the editor photo grid, sky-compatible photos show a "Sky" button
3. User clicks "Sky" → modal opens with sky style picker
4. User selects: Blue Sky | Golden Hour | Twilight | Custom Upload
5. User clicks "Apply" → credits deducted, job queued
6. Photo updates in place with replaced sky (or error toast)

---

## Sky Presets

| Key | Description |
|-----|-------------|
| `blue-sky` | Clear blue sky, default |
| `golden-hour` | Warm golden hour lighting |
| `twilight` | Deep blue-purple dusk |
| `custom` | User uploads their own sky image |

---

## API Design

### `POST /api/photos/[id]/sky-replace`

**Request:**
```json
{
  "skyStyle": "blue-sky" | "golden-hour" | "twilight" | "custom",
  "customSkyUrl": "https://..." // required only if skyStyle === "custom"
}
```

**Response (202):**
```json
{
  "photo": {
    "id": "uuid",
    "skyReplaced": true,
    "publicUrl": "https://..."
  }
}
```

**Errors:**
- `401` — Unauthorized
- `404` — Photo not found
- `402` — Insufficient credits
- `409` — Photo already sky-replaced (must use original)
- `400` — Invalid skyStyle or missing customSkyUrl

---

## Implementation Plan

### Task 1: API Route — `POST /api/photos/[id]/sky-replace`

**Files to create/modify:**
- `app/api/photos/[id]/sky-replace/route.ts` — new route

**Behavior:**
1. Extract user from JWT cookie
2. Verify photo ownership via project
3. Check photo hasn't already been sky-replaced (only original photos can be sky-replaced)
4. Check user has >= 1 credit
5. Deduct 1 credit (type: `sky_replacement`)
6. Read skyStyle + customSkyUrl from body
7. Enqueue job to sky-replacement worker
8. Return 202 with photo updated (status: `sky_replaced: true`, publicUrl unchanged until worker done)

**Logging:** Log job enqueue with photoId, userId, skyStyle

### Task 2: Worker — Sky Replacement (`workers/sky-replace/`)

**Files to create:**
- `workers/sky-replace/src/index.ts` — BullMQ worker entry point
- `workers/sky-replace/src/processor.ts` — Main processing logic
- `workers/sky-replace/src/queue.ts` — Job queue setup
- `workers/sky-replace/src/types.ts` — Job types
- `workers/sky-replace/src/r2.ts` — R2 helpers
- `workers/sky-replace/src/db.ts` — DB helpers (reuse from virtual-stage if possible)
- `workers/sky-replace/package.json`
- `workers/sky-replace/tsconfig.json`

**Implementation:**

1. Worker listens on `sky-replace` queue
2. For each job:
   - Download original photo from R2
   - Download sky image (preset URL or customSkyUrl)
   - Use AI model for sky replacement:
     - Primary: Use a segmentation model to create a mask of the sky region
     - Composite the new sky onto the masked area
     - Use `black-forest-labs/flux-dev` with an inpainting approach, OR
     - Use `lucataco/remove-background` style segmentation + image compositing with `zomalab/softedge` for blending
   - Upload result to R2: `photo/{userId}/{photoId}/sky-{timestamp}.jpg`
   - Update photo record: `skyReplaced: true`, `publicUrl` → new URL
   - Update photo status to `done`

**Segmentation approach:**
Use `briaai/RMBG-1.4` (via Replicate) to isolate the sky mask, then composite with the new sky using sharp or a similar image processing library.

**Error handling:**
- If AI fails: mark photo status as `error`, restore original `skyReplaced: false`, refund credits

### Task 3: DB Schema Update

**Files to modify:**
- `lib/db/schema.ts` — Add `skyStyle` column to photos table

```typescript
skyStyle: varchar('sky_style', { length: 50 }), // 'blue-sky' | 'golden-hour' | 'twilight' | 'custom'
skyReplacedAt: timestamp('sky_replaced_at'),
```

### Task 4: Worker Queue Registration

**Files to modify:**
- `workers/video-render/src/index.ts` or a new entrypoint that starts both workers
- Update `package.json` scripts to start sky-replace worker

### Task 5: Credit Refund on Failure

**Files to modify:**
- `workers/sky-replace/src/processor.ts`
- If job fails after credit deduction: call refund logic

---

## Dependencies

- `REPLICATE_API_TOKEN` — for AI segmentation model
- R2 credentials — same as existing
- `CREDIT_COSTS.sky_replacement = 1` — already defined in `lib/credits.ts`

---

## Sky Preset Image URLs

Store as constants in the worker:

```typescript
const SKY_PRESETS = {
  'blue-sky': 'https://propframe-assets.example.com/sky/blue-sky.jpg',
  'golden-hour': 'https://propframe-assets.example.com/sky/golden-hour.jpg',
  'twilight': 'https://propframe-assets.example.com/sky/twilight.jpg',
};
```

For MVP: Use publicly available sky images or generate them.

---

## Acceptance Criteria

- [ ] `POST /api/photos/[id]/sky-replace` returns 202 and deducts 1 credit
- [ ] Worker picks up job and processes it
- [ ] Photo `publicUrl` updated to sky-replaced version
- [ ] Photo `skyReplaced` flag set to `true`
- [ ] Error state handled: credits refunded if worker fails
- [ ] Duplicate sky-replace requests return 409
- [ ] Custom sky URL works
- [ ] All logged with structured logging
