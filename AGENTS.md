<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## OfferPilot development workflow

Before changing implementation code, read `PLAN.md` and work only inside its current phase. After every code change, update `PLAN.md` in the same turn with checklist progress, validation results, the next task, and the change log. A phase is complete only after its acceptance criteria and all four quality commands pass.

## Next optimization roadmap

Do not add new product modules until the existing daily training loop is reliable. Execute these priorities in order and reflect each task in `PLAN.md` before implementation:

1. **Finish production acceptance.** On the stable Vercel domain, verify registration, login, logout, Dashboard refresh, Algorithm start/cancel/complete, Java draft recovery, AI code review, Knowledge Learn/Recall/AI review, and persistence after refresh and re-login. Fix only blockers found by this Smoke Test before adding features.
2. **Improve Knowledge recall accuracy.** Start with the 120 six-week core questions. Split long reference sentences into atomic key points; add abbreviations, synonyms, and common spoken equivalents; and build a small regression set for expected matches and false positives. Keep deterministic coverage and AI semantic coverage visible separately, and never let AI directly change mastery.
3. **Persist and compare AI recall history.** Attach each AI analysis to its Recall attempt, retain it after refresh, show the previous versus current omissions, and produce one focused next-review hint. Reuse the existing Attempt record instead of creating a parallel history model.
4. **Shorten the daily workflow.** Add a direct next-task action, one-click continuation from Dashboard, an estimated daily workload, and a concise end-of-day summary covering completed work, omissions, backlog, and upcoming reviews.
5. **Calibrate the review strategy with evidence.** Keep the current deterministic mastery-bucket intervals while collecting real review outcomes. Record enough evidence to evaluate scheduled interval, actual delay, recall/result quality, hints or independence, and lapses. Do not adopt FSRS, SM-2, or a custom forgetting-curve model merely by name; change the scheduler only after replaying real history shows a measurable retention or workload improvement. Algorithm and Knowledge may require different calibration, and past Attempts must remain immutable.
6. **Protect AI cost, latency, and secrets.** Add per-user daily request limits, timeout and duplicate-click protection, input-size limits, graceful fallback, and log redaction. API keys must remain server-only and must never use a `NEXT_PUBLIC_` prefix.
7. **Harden data safety and operations.** Add user-visible JSON export before any destructive migration, document restore and rollback steps, surface actionable production errors without exposing secrets, and verify database indexes and request logs using real usage evidence rather than speculative optimization.

Default execution order: production Smoke Test → core Knowledge matching quality → persistent AI recall history → shorter daily flow → review-strategy calibration → AI safeguards → data and operational hardening. Do not start a later priority until the preceding acceptance checks pass or `PLAN.md` records a concrete blocker.
