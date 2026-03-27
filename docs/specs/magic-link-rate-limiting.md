# Feature Spec: Magic Link Rate Limiting

**Date:** 2026-03-27
**Status:** Complete
**Priority:** P1
**Feature:** Magic Link Rate Limiting
**Spec驱动:** Yes

---

## What It Is

Protects the magic link auth flow from brute-force abuse and email spam. Uses Redis (via BullMQ's IORedis connection) to track per-IP and per-email request counts with sliding window expiry. Limits are applied to both the `/api/auth/forgot-password` (password reset) and `/api/auth/login` (magic link) endpoints.

---

## Rate Limit Rules

| Endpoint | Identifier | Window | Limit |
|----------|-----------|--------|-------|
| `POST /api/auth/login` | IP address | 15 minutes | 5 requests |
| `POST /api/auth/login` | Email | 15 minutes | 3 requests |
| `POST /api/auth/forgot-password` | IP address | 15 minutes | 3 requests |
| `POST /api/auth/forgot-password` | Email | 15 minutes | 2 requests |

When a limit is exceeded, the server responds with `429 Too Many Requests` and a `Retry-After` header.

---

## API Design

### `POST /api/auth/login`

**(Updated with rate limiting — same request/response as email-password-login spec)**

Rate limited: 5 per IP per 15min, 3 per email per 15min.

**Response (rate limited):**
```json
{ "error": "Too many requests. Please try again later." }
```
**Headers:** `Retry-After: 300` (seconds)

---

### `POST /api/auth/forgot-password`

**(Same request/response as password-reset spec)**

Rate limited: 3 per IP per 15min, 2 per email per 15min.

---

## Implementation Approach

Uses `rate-limiter-flexible` with the existing BullMQ Redis connection (`REDIS_URL` env var). If Redis is unavailable, falls back to an in-memory store (with a warning log).

### Rate limit counters

Key format: `ratelimit:<endpoint>:<type>:<identifier>`
Example: `ratelimit:login:ip:192.168.1.1`
TTL: 900 seconds (15 minutes)

---

## Files to Create / Modify

- `docs/specs/magic-link-rate-limiting.md` (this spec)
- `lib/rate-limit.ts` — new, rate limiter setup and helpers
- `app/api/auth/login/route.ts` — updated with rate limit check
- `app/api/auth/forgot-password/route.ts` — updated with rate limit check
- `app/api/auth/reset-password/route.ts` — updated with rate limit check
- `lib/logger.ts` — create with structured logging

---

## Environment Variables

```
REDIS_URL=redis://localhost:6379  # for rate limiting (uses BullMQ Redis if set)
```

---

## Implementation Checklist

- [x] Spec written (this document)
- [ ] Rate limiter library added to package.json
- [ ] `lib/rate-limit.ts` created
- [ ] Login endpoint rate limited
- [ ] Forgot password endpoint rate limited
- [ ] Reset password endpoint rate limited
- [ ] Error paths handled (Redis unavailable)
- [ ] Structured logging added
- [ ] Tested manually
- [ ] `docs/roadmap/v1.md` updated
- [ ] This spec marked `Complete`

---

## Blockers

-

---

## Notes

- Rate limit headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`
- All blocked requests are logged with IP, email (if available), and endpoint
- In-memory fallback should only be used in development without Redis
