<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## OfferPilot development workflow

Before changing implementation code, read `PLAN.md` and work only inside its current phase. After every code change, update `PLAN.md` in the same turn with checklist progress, validation results, the next task, and the change log. A phase is complete only after its acceptance criteria and all four quality commands pass.

## Next optimization roadmap

Do not add new product modules until the existing daily training loop is reliable. Execute these priorities in order and reflect each task in `PLAN.md` before implementation:

1. **Close the production loop.** Commit and push the current AI recall work, configure the three server-only AI environment variables in Vercel, then verify automatic deployment, registration, login, logout, Algorithm training, Knowledge recall, and persistent data with a production Smoke Test.
2. **Improve Knowledge recall matching.** Start with the 120 six-week core questions. Split long reference sentences into atomic key points and add abbreviations, synonyms, and common spoken equivalents. Keep deterministic coverage and AI semantic coverage visible separately; AI must not directly change mastery.
3. **Persist AI recall history.** Attach AI analysis to the corresponding Recall attempt so users can compare previous and current omissions, receive a focused next-review hint, and retain the result after refresh.
4. **Shorten the daily workflow.** Add a direct next-task action, one-click continuation from Dashboard, an estimated daily training duration, and a concise end-of-day summary of completed work, omissions, and upcoming reviews.
5. **Protect AI cost and secrets.** Add per-user daily request limits, timeout and duplicate-click protection, input limits, and log redaction. API keys must remain server-only and must never use a `NEXT_PUBLIC_` prefix.

Default execution order: production deployment of the current AI recall feature → key-point and alias improvement for the 120 core questions → persistent AI recall history. Defer later priorities until the preceding acceptance checks pass.
