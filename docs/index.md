# Documentation index

## Start here

| Path | Status | Read when |
| --- | --- | --- |
| `README.md` | active | Setting up the Next.js application and existing Supabase/Vercel workflow. |
| `AGENTS.md` | active | Changing code or running the repository quality gates. |

## Requirements and plans

| Path | Status | Read when |
| --- | --- | --- |
| [`docs/plans/completed/PLAN-20261008-training-experience.md`](plans/completed/PLAN-20261008-training-experience.md) | completed | Reviewing local acceptance of Dashboard continuation, Knowledge search and readable code answers; production acceptance remains separate. |
| [`docs/plans/active/PLAN-20261007-speech-stability.md`](plans/active/PLAN-20261007-speech-stability.md) | completed | Reviewing the verified removal of built-in recording/transcription and the system dictation workflow. |
| [`docs/plans/active/PLAN-20261008-knowledge-understanding-coach.md`](plans/active/PLAN-20261008-knowledge-understanding-coach.md) | active | Implementing the on-demand explanation flow for Knowledge answers the user still does not understand. |

## Architecture and specifications

| Path | Status | Read when |
| --- | --- | --- |
| [`docs/architecture/ADR-20261007-asr-service-boundary.md`](architecture/ADR-20261007-asr-service-boundary.md) | legacy | Historical ASR decision, superseded on 2026-10-08 by system dictation. |
| [`docs/specs/SPEC-20261007-asr-http.md`](specs/SPEC-20261007-asr-http.md) | archived | Retired ASR HTTP contract; the transcription route and service were removed. |

## Operations

| Path | Status | Read when |
| --- | --- | --- |
| [`docs/operations/RUN-20261007-funasr.md`](operations/RUN-20261007-funasr.md) | archived | Historical FunASR runbook; this service is no longer required or shipped. |

## Evaluations

| Path | Status | Read when |
| --- | --- | --- |
| [`docs/evals/EVAL-20261008-recall-baseline.md`](evals/EVAL-20261008-recall-baseline.md) | completed | Reviewing actual-runtime paraphrase matching evidence and the gated core-question improvement criteria. |

## Document discipline

New durable documents belong in a type directory, use a date or issue identifier, and are linked here in the same change. Keep secrets, tokens, raw audio, and production records out of documentation.
