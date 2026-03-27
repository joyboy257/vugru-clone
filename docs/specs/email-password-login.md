# Feature Spec: Email + Password Login

**Date:** 2026-03-27
**Status:** Complete
**Priority:** P1
**Feature:** Email + Password Authentication
**Spec驱动:** Yes

---

## What It Is

Adds traditional email+password authentication alongside magic link. Users can sign up with an optional password, and can log in with either their password or a magic link. Passwords are bcrypt-hashed (12 rounds) before storage.

---

## User Flow

**Signup with password:**
1. User goes to /auth/signup
2. Enters email, name, and password (min 8 chars)
3. Account created with password hash stored
4. Session created, redirected to /dashboard

**Login with password:**
1. User goes to /auth/login
2. Enters email and password
3. Server verifies password against stored hash
4. Session created, redirected to /dashboard

**Adding password to existing account:**
- If user signed up via magic link (no password), they can set one via /settings

---

## API Design

### `POST /api/auth/login` (updated)

Now supports both magic link and password login. The presence of a `password` field in the request body determines which flow is used.

**Request (magic link):**
```json
{ "email": "user@example.com" }
```

**Request (password):**
```json
{ "email": "user@example.com", "password": "mypassword" }
```

**Response (password login, 200):**
```json
{
  "success": true,
  "user": { "id": "xxx", "email": "user@example.com", "name": "John", "credits": 1000 }
}
```

**Errors:**
- `400` — Email required
- `400` — Password required when attempting password login
- `401` — Invalid email or password
- `401` — Account has no password set (use magic link instead)
- `429` — Too many requests

---

### `POST /api/auth/signup` (updated)

Now accepts an optional `password` field. If provided, stores the bcrypt hash.

**Request:**
```json
{ "email": "user@example.com", "name": "John", "password": "mypassword" }
```

**Response (201):**
```json
{
  "success": true,
  "user": { "id": "xxx", "email": "user@example.com", "name": "John", "credits": 1000 }
}
```

**Errors:**
- `400` — Email required
- `400` — Password must be at least 8 characters
- `409` — Account already exists (if using same email)

---

### `PATCH /api/auth/password` (new)

Allows a logged-in user to set or change their password.

**Request:**
```json
{ "currentPassword": "oldpass", "newPassword": "newpass" }
```

**Response (200):**
```json
{ "success": true, "message": "Password updated" }
```

**Errors:**
- `400` — New password must be at least 8 characters
- `401` — Current password incorrect
- `401` — Not authenticated

---

## Data Model

No new tables. Uses existing `users.passwordHash` column.

---

## Files to Create / Modify

- `docs/specs/email-password-login.md` (this spec)
- `app/api/auth/login/route.ts` — updated to handle password field
- `app/api/auth/signup/route.ts` — updated to accept and hash password
- `app/api/auth/password/route.ts` — new, PATCH for changing password
- `lib/db/auth.ts` — already has `hashPassword`, `verifyPassword`; no changes needed
- `lib/logger.ts` — structured logging

---

## Implementation Checklist

- [x] Spec written (this document)
- [ ] API routes updated
- [ ] Login with password flow added
- [ ] Signup with password flow added
- [ ] Password change endpoint added
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

- Passwords are never logged, never returned in API responses
- `passwordHash` column in DB is NULL for magic-link-only users — they must use magic link
- On login, if `passwordHash` is NULL, return a friendly error suggesting magic link
- All existing auth functions in `lib/db/auth.ts` are reused
