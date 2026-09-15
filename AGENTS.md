<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## OfferPilot development workflow

Before changing implementation code, read `PLAN.md` and work only inside its current roadmap priority. After every code change, update `PLAN.md` in the same turn with checklist progress, validation results, the next task, and the change log. A roadmap item is complete only after its acceptance criteria and all four quality commands pass. The project requires Node.js `>=22.13.0`; verify `node --version` before quality commands and use the installed portable Node 24 runtime when the system PATH still resolves to Node 20.

## Current product baseline

- Phase 8 and V1 production acceptance are complete. The stable Vercel deployment passed anonymous boundaries, registration/authentication, logout/re-login, Dashboard refresh, Algorithm and Knowledge training, AI analysis, and persistence checks.
- Supabase migrations, repeatable seed, exact catalog counts, two-user RLS isolation, Auth redirects, and production persistence have been verified. Server-side Supabase clients already use bounded retries for transient `408/429/502/503/504` and network failures; do not add duplicate route-level retry loops.
- Algorithm training already includes the Hot 100 static statement and Java starter snapshot, completed-problem import, in-page Java drafts, cancel/complete flows, deterministic mastery/review scheduling, and AI code analysis persisted on the corresponding Attempt.
- Knowledge training contains the full 904-question catalog with a 120-question six-week core, deterministic key-point coverage, and optional AI semantic review. The AI Knowledge review is currently component state only and is not stored on `KnowledgeAttemptPayload`; this is the persistence gap addressed by priority 3.
- Dashboard catch-up status derives missed training days and cumulative new-learning gaps from the plan calendar even when a past day has no generated task rows; keep these separate from exact-timestamp overdue reviews and already-generated leftover tasks.
- AI calls already have bounded timeouts, structured-output validation, server-only secrets, and client-side duplicate-click guards. Priority 6 should preserve these controls and add only the missing per-user quota, input-size policy, log redaction, and observable fallback behavior.
- Latest verified working tree: based on `main` at `7310822`, bundled Node 24 quality gate green with 30 test files, 271 tests, and 238 generated pages.

## Next optimization roadmap

Do not add new product modules until the existing daily training loop is reliable. Execute these priorities in order and reflect each task in `PLAN.md` before implementation:

1. **Completed — production acceptance.** The stable-domain Smoke Test and the transient Supabase gateway retry fix were accepted on 2026-09-14. Preserve the Smoke script as a release gate; do not repeat this item unless production regresses.
2. **Active — improve Knowledge recall accuracy.** Start with the 120 six-week core questions. Split long reference sentences into atomic key points; add abbreviations, synonyms, and common spoken equivalents; and build a small regression set for expected matches and false positives. Keep deterministic coverage and AI semantic coverage visible separately, and never let AI directly change mastery.
3. **Persist and compare AI Knowledge recall history.** Attach each AI analysis to its Recall attempt, retain it after refresh, show previous versus current omissions, and produce one focused next-review hint. Reuse the existing Knowledge Attempt record and add the smallest compatible JSON field and migration instead of creating a parallel history model.
4. **Shorten the daily workflow.** Add a direct next-task action, one-click continuation from Dashboard, an estimated daily workload, and a concise end-of-day summary covering completed work, omissions, backlog, and upcoming reviews.
5. **Calibrate the review strategy with evidence.** Keep the current deterministic mastery-bucket intervals while collecting real review outcomes. Record enough evidence to evaluate scheduled interval, actual delay, recall/result quality, hints or independence, and lapses. Do not adopt FSRS, SM-2, or a custom forgetting-curve model merely by name; change the scheduler only after replaying real history shows a measurable retention or workload improvement. Algorithm and Knowledge may require different calibration, and past Attempts must remain immutable.
6. **Complete AI safeguards.** Preserve the existing timeout, structured validation, server-only secrets, and duplicate-click protection. Add per-user daily request limits, explicit input-size limits, user-visible graceful fallback, and log redaction. API keys must never use a `NEXT_PUBLIC_` prefix.
7. **Harden data safety and operations.** Add user-visible JSON export before any destructive migration, document restore and rollback steps, surface actionable production errors without exposing secrets, and verify database indexes and request logs using real usage evidence rather than speculative optimization.

Default execution order now starts at priority 2: core Knowledge matching quality → persistent AI Knowledge recall history → shorter daily flow → review-strategy calibration → remaining AI safeguards → data and operational hardening. Do not start a later priority until the preceding acceptance checks pass or `PLAN.md` records a concrete blocker.
