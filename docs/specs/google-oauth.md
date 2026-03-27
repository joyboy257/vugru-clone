# Feature Spec: Google OAuth

**Date:** 2026-03-27
**Status:** Complete
**Priority:** P1
**Feature:** Google OAuth Login
**Spec驱动:** Yes

---

## What It Is

Allows users to sign up or log in using their Google account. Google handles identity verification; PropFrame creates/links a local account. Works alongside existing magic link and email+password auth.

---

## User Flow

1. User clicks "Continue with Google" on /auth/login or /auth/signup
2. Frontend redirects to `/api/auth/google`
3. Server generates Google OAuth authorization URL with correct scopes
4. User is redirected to Google's consent screen
5. User grants permission → Google redirects to `/api/auth/google/callback?code=xxx`
6. Server exchanges code for tokens, fetches user info from Google
7. Server creates or retrieves PropFrame user by Google email
8. Server creates a PropFrame session (JWT cookie)
9. User is redirected to /dashboard

---

## API Design

### `GET /api/auth/google`

Initiates Google OAuth flow. Generates state token for CSRF protection, stores in cookie, redirects to Google.

**Response:** 302 redirect to Google Authorization URL

**Errors:**
- `400` — Missing GOOGLE_CLIENT_ID env var

---

### `GET /api/auth/google/callback`

Handles the OAuth callback from Google.

**Query params:** `code`, `state`

**Response:** 302 redirect to /dashboard (success) or /auth/login?error=... (failure)

**Errors:**
- `400` — Missing code or state
- `401` — Invalid state cookie or expired code
- `409` — Google email already registered with password (prompt to link account)

---

## Data Model

### Schema changes

Add to `users` table:
| Column | Type | Notes |
|--------|------|-------|
| `google_id` | `varchar(255)` | NULL until linked |
| `google_email` | `varchar(255)` | NULL until linked |

Add `google_id` unique index.

---

## Files to Create / Modify

- `docs/specs/google-oauth.md` (this spec)
- `app/api/auth/google/route.ts` — new, initiates OAuth
- `app/api/auth/google/callback/route.ts` — new, handles callback
- `lib/db/schema.ts` — add `googleId` column to users
- `lib/db/auth.ts` — add `getUserByGoogleId`, `createUserFromGoogle`, `linkGoogleAccount`
- `lib/logger.ts` — create with structured logging

---

## Environment Variables Needed

```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

---

## Implementation Checklist

- [x] Spec written (this document)
- [ ] Schema migrated
- [ ] API routes implemented
- [ ] Google token exchange implemented
- [ ] Account creation / linking implemented
- [ ] Error paths handled
- [ ] Structured logging added
- [ ] Tested manually (requires real Google OAuth app)
- [ ] `docs/roadmap/v1.md` updated
- [ ] This spec marked `Complete`

---

## Blockers

- Requires real Google OAuth credentials (not available in dev)

---

## Notes

- Scopes: `openid email profile`
- CSRF protection via `state` parameter (random nonce stored in httpOnly cookie)
- If Google email matches existing PropFrame account with password → return 409, user must choose to link manually
- If Google email matches existing account without password → auto-link
- If Google email is new → create new PropFrame account (same as magic-link signup)
