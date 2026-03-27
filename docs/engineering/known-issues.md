# Known Issues & Gaps

This document tracks identified technical issues, security concerns, and architectural gaps in the PropFrame codebase. Items are prioritized by severity.

---

## Critical / Security

### 1. Hardcoded JWT Fallback Secret
**File**: `lib/db/auth.ts:8`
```typescript
const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'dev-secret-change-in-production';
```
**Risk**: Production deployments may accidentally use the default fallback secret if `JWT_SECRET` is not set. The `.env.local.example` does not include `JWT_SECRET`, making it easy to miss during setup.
**Fix**: Require `JWT_SECRET` in environment — throw an error at startup if not set in production. Remove the fallback entirely.

---

### 2. Credit System Inconsistency
**Files**: `lib/db/auth.ts:33`, `lib/credits.ts`, `SPEC.md`
**Issue**: New users receive 1000 signup credits (`lib/db/auth.ts`), but `SPEC.md` states users should receive $10 free credit on signup. At the stated rate of 125 credits/$ that would be 1250 credits, not 1000.
**Fix**: Align signup credit amount with SPEC. Update `SPEC.md` if the 1000 credit figure is correct.

---

### 3. No Rate Limiting on Auth Endpoints
**Files**: `app/api/auth/login/route.ts`, `app/api/auth/signup/route.ts`
**Risk**: Brute-force attacks against login and signup endpoints are unmitigated.
**Fix**: Add rate limiting middleware (e.g., `@upstash/ratelimit` or Vercel Edge Config) for auth routes.

---

### 4. No Idempotency on Clip Generation
**File**: `app/api/clips/generate/route.ts`
**Risk**: Calling `POST /api/clips/generate` twice with the same photo (e.g., network retry) creates two clips and deducts credits twice.
**Fix**: Add idempotency key support, or check for existing pending/completed clip for the same photo before creating a new one and deducting credits.

---

## High / Architecture

### 5. Two Separate GPU Worker Systems
**Files**: `gpu-worker/src/index.ts` (polling), `workers/video-render/src/index.ts` (BullMQ + Redis)
**Issue**: The codebase has two independent GPU worker implementations with different job queue strategies. If both run simultaneously, duplicate clip processing can occur. It is unclear which is the production approach.
**Fix**: Choose one approach (BullMQ is more robust for production). Consolidate and remove the polling approach.

---

### 6. Missing Redis in Environment Example
**File**: `.env.local.example`
**Issue**: The BullMQ worker requires Redis, but `.env.local.example` does not include `REDIS_URL`.
**Fix**: Add `REDIS_URL` to `.env.local.example` alongside the other infrastructure variables.

---

### 7. Inconsistent Worker Configuration
**Files**: `gpu-worker/src/index.ts` (uses `POLL_INTERVAL_MS`), `workers/video-render/` (uses `WORKER_CONCURRENCY`, `WORKER_RATE_LIMIT`)
**Issue**: Different workers use different configuration conventions, making operational complexity higher than necessary.
**Fix**: Standardize on a single worker configuration approach with consistent env var naming.

---

### 8. No Cleanup of Orphaned R2 Files
**Files**: Project/photo/clip deletion routes
**Issue**: When a project, photo, or clip is deleted, the corresponding R2 objects are not deleted. Over time this leads to orphaned storage costs.
**Fix**: Delete R2 objects in the same transaction or as a follow-up job when database records are deleted.

---

### 9. Missing Health Check Endpoint
**File**: `app/api/health/route.ts` (does not exist)
**Issue**: Deployment documentation references `/api/health` but the endpoint does not exist. Load balancers and uptime monitors cannot function without it.
**Fix**: Create `app/api/health/route.ts` returning `{ status: 'ok' }`.

---

## Medium / Code Quality

### 10. No TypeScript Environment Variable Typing
**Issue**: Environment variables are accessed via string keys throughout the codebase (e.g., `process.env.JWT_SECRET`). Typos are not caught at compile time.
**Fix**: Create `env.d.ts` or use `zod` to validate and type all environment variables at startup.

---

### 11. Inconsistent API Error Responses
**Issue**: API routes manually parse and validate JSON bodies with no standard error response format. Some return `{ error: string }`, others return `{ message: string }`.
**Fix**: Create a shared `apiResponse.ts` helper with consistent error and success response shapes.

---

### 12. `lib/middleware.ts` Is Not Next.js Middleware
**File**: `lib/middleware.ts`
**Issue**: The file exports `authMiddleware` — a manual helper used per-route. It is not the Next.js middleware pattern (which runs on all requests via `middleware.ts` at the app root). The naming is misleading.
**Fix**: Rename to `lib/auth-helpers.ts` or `lib/api-auth.ts` to avoid confusion with Next.js 14 middleware.

---

### 13. No Credit Expiry
**File**: `lib/db/schema.ts` (CreditTransaction table)
**Issue**: The `CreditTransaction` table has no `expires_at` field. Credits never expire, which may conflict with promotional campaigns or subscription logic in the future.
**Fix**: Add `expires_at` nullable timestamp to `CreditTransaction`. Handle expiry in credit deduction logic.

---

### 14. Deployment Docs Reference Wrong Platform
**File**: `docs/engineering/deployment.md`
**Issue**: The deployment doc references Railway deployment, but `SPEC.md` and the actual project structure target Vercel.
**Fix**: Update `deployment.md` to reflect Vercel deployment or clarify which platform is used.

---

## Low / TODO Items in Code

### 15. Runway API Endpoint Not Confirmed
**File**: `gpu-worker/src/providers/runway.ts:49`
**Text**: `// TODO: confirm exact endpoint from Runway console`
**Status**: AI video generation via Runway is not fully integrated until this is resolved.

### 16. SVD Background Dispatch Not Implemented
**File**: `gpu-worker/src/providers/svd_modal_app.py:110`
**Text**: `// TODO: dispatch to background - for now runs synchronously`
**Status**: SVD fallback provider runs synchronously, blocking the worker.

### 17. SVD Job Status Tracking Not Implemented
**File**: `gpu-worker/src/providers/svd_modal_app.py:152`
**Text**: `// TODO: implement job status tracking with Redis or Modal Volume`
**Status**: No way to poll job completion for SVD.

### 18. SVD Video Return Not Implemented
**File**: `gpu-worker/src/providers/svd_modal_app.py:163`
**Text**: `// TODO: implement - return video bytes or redirect to R2/signed URL`
**Status**: SVD video output handling is incomplete.

---

## Informational

### 19. SPEC.md References "VuGru Clone"
**File**: `SPEC.md`
**Issue**: The product specification describes PropFrame as a "VuGru Clone". This may have IP implications if the design/functionality was directly copied from VuGru.
**Fix**: Review and ensure all original creative work is properly attributed or differentiated.

### 20. Credit Package Math Inconsistency
**File**: `lib/credits.ts`
**Issue**: `CREDIT_PACKAGES` defines 25000 credits for $20 (1250/$) and 62500 credits for $50 (1250/$ with a stated "bonus: 12500" which does not appear in the actual credit amount).
**Fix**: Audit and correct credit package definitions and labels.

---

*Last reviewed: 2026-03-27*
