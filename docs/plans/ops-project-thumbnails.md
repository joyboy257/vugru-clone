# Feature Spec: Project Thumbnails

**Date:** 2026-03-27
**Status:** Complete
**Priority:** P2
**Feature:** Auto-set project thumbnail from first photo
**Spec驱动:** Yes

---

## What It Is

Projects automatically display a thumbnail image sourced from the first photo in the project. The thumbnail updates automatically as photos are added or removed.

---

## User Flow

1. User uploads first photo to an empty project → `project.thumbnailUrl` is set to `photo.publicUrl`
2. User deletes the photo that is the thumbnail → `project.thumbnailUrl` updates to the next available photo's `publicUrl`
3. User deletes all photos → `project.thumbnailUrl` = `null`

---

## API Design

No new API routes. Logic integrated into:
- `POST /api/upload/confirm` — when first photo is added to empty project
- `DELETE /api/photos/[id]` — when thumbnail photo is deleted

---

## Data Model

`projects` table (already has `thumbnailUrl`):
| Column | Type | Notes |
|--------|------|-------|
| `thumbnail_url` | `text` | nullable, R2 public URL of project's cover photo |

---

## Files to Create / Modify

- `lib/db/schema.ts` — already has `thumbnailUrl` column
- `app/api/upload/confirm/route.ts` — set thumbnailUrl when first photo added
- `app/api/photos/[id]/route.ts` — update thumbnailUrl when thumbnail photo deleted
- `app/api/projects/[id]/duplicate/route.ts` — copy thumbnailUrl (new project will set it on first photo add)

---

## Implementation Checklist

- [x] Spec written (this document)
- [x] Schema confirmed: `thumbnailUrl` column exists on `projects`
- [ ] Set thumbnailUrl when first photo is uploaded to empty project
- [ ] Update thumbnailUrl when the current thumbnail photo is deleted
- [ ] Set thumbnailUrl=null when project has no photos
- [ ] Duplicate route copies thumbnailUrl to new project
- [ ] `docs/roadmap/v1.md` updated
- [ ] `docs/logs/2026-03-27-sprint-2.md` updated
- [ ] Spec marked `Complete`

---

## Blockers

-

---

## Notes

- `thumbnailUrl` stores the `publicUrl` of the photo, not the storage key
- Ordering: thumbnail uses photo with lowest `order` value
- Must handle case where `publicUrl` is null (use `storageKey` to construct URL)
