# Feature Spec: Email Notification When Clip Is Done

**Date:** 2026-03-27
**Status:** Complete
**Priority:** P2
**Feature:** Send email notification when a clip's status transitions to 'done'
**Spec驱动:** Yes

---

## What It Is

When a clip finishes processing (status → 'done'), the user receives an email notification with a link to view the project.

---

## User Flow

1. GPU worker completes clip processing, sets status to `'done'`, uploads to R2
2. Worker fetches user email via clips → projects → users join
3. Worker calls `sendClipCompleteEmail(userEmail, projectName, projectUrl)`
4. Email sent via Resend; failures are logged but don't retry the job

---

## API Design

No new API routes. Worker integration.

### `sendClipCompleteEmail(to, projectName, projectUrl)`

Email template: "Your clip is ready! 🎬" with project link.

---

## Data Model

No schema changes.

---

## Files to Create / Modify

- `lib/email.ts` — add `sendClipCompleteEmail` function
- `gpu-worker/src/clipProcessor.ts` — call email helper when clip done
- `lib/logger.ts` — add `clip.complete.email_sent`, `clip.complete.email_failed`
- `workers/video-render/src/clipProcessor.ts` (if separate) — same changes

---

## Environment Variables

- `CLIP_COMPLETE_EMAIL_ENABLED=true` (default: true) — feature flag

---

## Implementation Checklist

- [x] Spec written (this document)
- [ ] `sendClipCompleteEmail` added to `lib/email.ts`
- [ ] Email template implemented ("Your clip is ready! 🎬")
- [ ] `gpu-worker/src/clipProcessor.ts` calls email helper on 'done' status
- [ ] Feature flag `CLIP_COMPLETE_EMAIL_ENABLED` checked before sending
- [ ] Email failures logged but don't fail/retry the job
- [ ] Logging: `clip.complete.email_sent`, `clip.complete.email_failed`
- [ ] `docs/roadmap/v1.md` updated
- [ ] `docs/logs/2026-03-27-sprint-2.md` updated
- [ ] Spec marked `Complete`

---

## Blockers

-

---

## Notes

- Only send when status transitions TO 'done' (not every time we check)
- Don't retry email failures — the clip is already done
- Use `NEXT_PUBLIC_APP_URL` for the project link URL
