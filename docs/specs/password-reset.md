# Feature Spec: Password Reset

**Date:** 2026-03-27
**Status:** Complete
**Priority:** P1
**Feature:** Password Reset via Email
**Spec驱动:** Yes

---

## What It Is

Allows users who signed up with email+password (or later added a password) to reset their password if forgotten. A time-limited reset token is emailed to the user via Resend, and the new password is set after verification.

---

## User Flow

1. User clicks "Forgot password?" on /auth/login
2. User submits email address
3. System sends a reset email via Resend (5-minute expiry)
4. User clicks the link in email → redirected to /auth/reset-password?token=xxx
5. User enters new password (min 8 chars)
6. Password is updated, all existing sessions are invalidated
7. User redirected to /auth/login with success message

---

## API Design

### `POST /api/auth/forgot-password`

Sends a password reset email to the user if the account exists.

**Request:**
```json
{ "email": "user@example.com" }
```

**Response (200):**
```json
{ "success": true, "message": "Reset email sent" }
```

**Errors:**
- `400` — Email required
- `404` — No account with that email (silently succeeds to prevent enumeration)
- `429` — Too many requests (rate limited)

---

### `POST /api/auth/reset-password`

Sets a new password using a valid reset token.

**Request:**
```json
{ "token": "xxx", "password": "newpassword123" }
```

**Response (200):**
```json
{ "success": true, "message": "Password updated" }
```

**Errors:**
- `400` — Token and password required, password too short
- `401` — Invalid or expired token
- `429` — Too many requests

---

## Data Model

### `password_reset_tokens` (new table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → users.id, ON DELETE CASCADE |
| `token_hash` | `varchar(255)` | bcrypt hash of the raw token |
| `expires_at` | `timestamp` | NOT NULL |
| `used_at` | `timestamp` | NULL until used |
| `created_at` | `timestamp` | DEFAULT now() |

---

## Files to Create / Modify

- `docs/specs/password-reset.md` (this spec)
- `app/api/auth/forgot-password/route.ts` — new
- `app/api/auth/reset-password/route.ts` — new
- `lib/db/schema.ts` — add `passwordResetTokens` table
- `lib/db/auth.ts` — add `createPasswordResetToken`, `verifyPasswordResetToken`, `usePasswordResetToken`, `invalidateUserSessions`
- `lib/email.ts` — add `sendPasswordResetEmail` helper (uses Resend)
- `app/api/auth/reset-password/page.tsx` — frontend page (if needed)
- `lib/logger.ts` — create with structured logging

---

## Implementation Checklist

- [x] Spec written (this document)
- [ ] Schema migrated
- [ ] API routes implemented
- [ ] Email sending implemented
- [ ] Session invalidation on reset
- [ ] Error paths handled
- [ ] Structured logging added
- [ ] Tested manually
- [ ] `docs/roadmap/v1.md` updated
- [ ] This spec marked `Complete`

---

## Blockers

-

---

## Notes

- Token is a cryptographically random nanoid (21 chars), stored as bcrypt hash
- 5-minute expiry prevents long-lived tokens
- Silently succeeds on unknown email to prevent account enumeration
- All existing sessions are deleted for that user on successful reset
