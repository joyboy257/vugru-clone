# Feature Spec: Auto-Edit Render Pipeline

**Date:** 2026-03-26
**Status:** Spec
**Priority:** P0
**Feature:** Auto-edit assembly — concatenate clips + title overlay + music → final MP4

---

## What It Is

Users select multiple clips, add a title, pick music, and generate a complete walkthrough video. The system assembles the final MP4 using a background worker.

**Pricing:** 1 credit per auto-edit (matches `CREDIT_COSTS.auto_edit` in `lib/credits.ts`)

---

## User Flow

1. User has 2+ generated clips in a project
2. User opens Auto-Edit UI → selects clips → enters title text → picks music track
3. User clicks "Generate Video" → 1 credit deducted → job queued
4. Polling shows status: `rendering` → `done`
5. User can preview, download, or share the final video

---

## API Design

### `POST /api/auto-edits/[id]/render`

**Request:**
```json
{
  "titleText": "123 Oak Street",
  "musicKey": "upbeat-1"
}
```

**Response (202):**
```json
{
  "autoEdit": {
    "id": "uuid",
    "status": "rendering",
    "estimatedDuration": 25.5
  }
}
```

**Errors:**
- `401` — Unauthorized
- `404` — Auto-edit not found
- `400` — Fewer than 2 clips selected
- `402` — Insufficient credits
- `409` — Already rendering or done (re-render not allowed)

### `GET /api/auto-edits/[id]`

Returns current auto-edit including `status`, `publicUrl` (when done), and `duration`.

---

## Music Tracks (MVP)

Pre-built tracks stored as constants:

| Key | Name | Mood |
|-----|------|------|
| `upbeat-1` | Morning Drive | Upbeat, optimistic |
| `warm-1` | Golden Hour | Warm, relaxed |
| `modern-1` | Clean Lines | Modern, minimal |
| `cinematic-1` | Wide Open | Cinematic, dramatic |
| `acoustic-1` | Sunday Light | Acoustic, peaceful |

All tracks are copyright-free ambient music. For MVP, hardcode URLs to sample tracks. Full implementation swaps in HeartMuLa or Suno API.

---

## Implementation Plan

### Task 1: Auto-Edit Render API Route

**Files to create/modify:**
- `app/api/auto-edits/[id]/render/route.ts` — new route

**Behavior:**
1. Authenticate user
2. Fetch auto-edit record, verify ownership
3. Check status is `draft` (not already rendering or done)
4. Read `titleText` and `musicKey` from body
5. Deduct 1 credit (`type: 'auto_edit'`)
6. Enqueue render job with clipIds, titleText, musicKey, autoEditId
7. Update auto-edit status to `rendering`
8. Return 202 with updated auto-edit

### Task 2: Render Worker (`workers/auto-edit-render/`)

**Files to create:**
- `workers/auto-edit-render/src/index.ts` — BullMQ worker entry
- `workers/auto-edit-render/src/processor.ts` — Main render logic
- `workers/auto-edit-render/src/queue.ts` — Job queue setup
- `workers/auto-edit-render/src/types.ts` — Job types
- `workers/auto-edit-render/src/r2.ts` — R2 helpers
- `workers/auto-edit-render/src/db.ts` — DB helpers
- `workers/auto-edit-render/src/ffmpeg.ts` — FFmpeg assembly logic
- `workers/auto-edit-render/package.json`
- `workers/auto-edit-render/tsconfig.json`

**Render Pipeline (per job):**

1. **Fetch clips:** Get all clip records from DB, verify they are `done`
2. **Download clips:** Fetch MP4 files from R2
3. **Build FFmpeg command:**
   - Concat clips in order (use concat demuxer)
   - Overlay title text using `drawtext` filter
   - Mix in music track with `amix` filter (duck music under narration if any)
4. **Execute FFmpeg:** Generate final MP4
5. **Upload result:** Upload to R2 at `auto-edit/{userId}/{autoEditId}/{timestamp}.mp4`
6. **Update DB:** Set `status: 'done'`, `publicUrl`, `duration`
7. **Error path:** On failure, set `status: 'error'`, restore credits

**FFmpeg concat filter:**
```
ffmpeg -f concat -safe 0 -i filelist.txt -i music.mp3 -filter_complex "[0:a][1:a]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]" output.mp4
```

**Title overlay:**
```
drawtext=text='{titleText}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h-100:borderw=2:bordercolor=black
```

### Task 3: Music Track Constants

**Files to create:**
- `lib/music.ts` — Music track definitions with R2 URLs

```typescript
export const MUSIC_TRACKS = {
  'upbeat-1': { name: 'Morning Drive', url: '...', duration: 60 },
  'warm-1': { name: 'Golden Hour', url: '...', duration: 60 },
  // ...
} as const;
```

### Task 4: Frontend — Render Button + Status

**Files to modify:**
- `app/(app)/project/[id]/ProjectEditorClient.tsx` — Add render button, status polling

**UI behavior:**
1. "Generate Video" button appears when 2+ clips selected
2. Shows credit cost (1 credit)
3. On click → calls `POST /api/auto-edits/[id]/render`
4. Shows progress: "Rendering..." with spinner
5. Polls `GET /api/auto-edits/[id]` every 3s
6. When `status === 'done'` → shows video player + download button

---

## Dependencies

- FFmpeg installed on worker (include in Dockerfile)
- Music track files in R2 or public URLs
- Existing clip MP4 files in R2

---

## Acceptance Criteria

- [ ] `POST /api/auto-edits/[id]/render` deducts 1 credit and returns 202
- [ ] Worker processes job and concatenates clips in order
- [ ] Title text overlaid on video
- [ ] Music mixed in with clips
- [ ] Final MP4 uploaded to R2 and URL saved to DB
- [ ] `status` transitions: `draft` → `rendering` → `done` (or `error`)
- [ ] On error: credits refunded, status set to `error`
- [ ] Polling returns updated status + publicUrl when done
- [ ] Duplicate render requests (while rendering) return 409
- [ ] All logged with structured logging
