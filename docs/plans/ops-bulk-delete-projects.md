# Feature Spec: Bulk Delete Projects

**Date:** 2026-03-27
**Status:** Complete
**Priority:** P2
**Feature:** Delete multiple projects in a single atomic operation
**Spec驱动:** Yes

---

## What It Is

Allows a user to delete multiple projects at once. All-or-nothing semantics: if the user doesn't own ALL specified projects, no deletion occurs. All photos, clips, and auto-edits are deleted from DB and R2 within a single transaction.

---

## User Flow

1. User selects multiple projects in dashboard and clicks "Delete selected"
2. API verifies ownership of ALL projects (all-or-nothing)
3. For each project: delete all photos/clips/auto-edits from DB (cascade), delete all R2 files
4. Delete all projects from DB
5. Return `{ deleted: N }`

---

## API Design

### `POST /api/projects/bulk-delete`

**Request:**
```json
{ "projectIds": ["uuid", "uuid", ...] }
```

**Response (200):**
```json
{ "deleted": 3 }
```

**Errors:**
- `400` — projectIds must be a non-empty array
- `401` — Not authenticated
- `403` — Any project not owned by user (no deletion occurs)
- `404` — Any project not found

---

## Data Model

No schema changes required.

---

## Files to Create / Modify

- `app/api/projects/bulk-delete/route.ts` — new route
- `lib/logger.ts` — add `projects.bulk_delete.started`, `projects.bulk_delete.completed`

---

## Implementation Checklist

- [x] Spec written (this document)
- [ ] API route implemented with auth
- [ ] Ownership verification (all-or-nothing)
- [ ] DB transaction wrapping all operations
- [ ] R2 file deletion per project
- [ ] Return `{ deleted: N }`
- [ ] Structured logging (projects.bulk_delete.started, completed with count)
- [ ] `docs/roadmap/v1.md` updated
- [ ] `docs/logs/2026-03-27-sprint-2.md` updated
- [ ] Spec marked `Complete`

---

## Blockers

-

---

## Notes

- Transaction: verify all belong to user first, then delete all within one transaction
- R2 files must be deleted even if DB cascade would handle it (to free storage)
- Max array size should be validated (e.g., 50 items max)
