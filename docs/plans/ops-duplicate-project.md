# Feature Spec: Duplicate Project

**Date:** 2026-03-27
**Status:** Complete
**Priority:** P2
**Feature:** Duplicate project with all photos, clips, and auto-edits
**Spec驱动:** Yes

---

## What It Is

Allows a user to duplicate an existing project, creating a full deep-copy with new R2 storage keys. The copy includes all photos, clips (reset to draft), and auto-edits (reset to draft).

---

## User Flow

1. User clicks "Duplicate" on an existing project
2. API creates a copy with name `"Original Name (Copy)"`
3. All photos are downloaded from R2 and re-uploaded to new keys
4. All clips are copied with status reset to `'draft'` and new R2 keys
5. All auto-edits are copied with status reset to `'draft'`
6. New project returned to client

---

## API Design

### `POST /api/projects/[id]/duplicate`

**Response (201):**
```json
{ "project": { ...newProject } }
```

**Errors:**
- `401` — Not authenticated
- `403` — Not owner
- `404` — Project not found
- `500` — R2 copy failed (new project deleted, error returned)

---

## Data Model

No schema changes required.

---

## Files to Create / Modify

- `app/api/projects/[id]/duplicate/route.ts` — new route
- `lib/logger.ts` — add `project.duplicate.started`, `project.duplicate.completed`, `project.duplicate.failed`

---

## Implementation Checklist

- [x] Spec written (this document)
- [ ] API route implemented with auth + ownership check
- [ ] Deep copy photos (download → re-upload → new DB records)
- [ ] Deep copy clips (status=draft, new R2 keys)
- [ ] Deep copy auto-edits (status=draft)
- [ ] R2 failure → delete new project, return 500
- [ ] Structured logging (project.duplicate.started, completed, failed)
- [ ] `docs/roadmap/v1.md` updated
- [ ] `docs/logs/2026-03-27-sprint-2.md` updated
- [ ] Spec marked `Complete`

---

## Blockers

-

---

## Notes

- R2 copy is done by downloading to buffer then re-uploading (no direct R2-to-R2 copy)
- Clip status always reset to `'draft'` since the video files are new
- Auto-edit status always reset to `'draft'`
