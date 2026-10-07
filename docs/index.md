# Documentation index

## Start here

| Path | Status | Read when |
| --- | --- | --- |
| `README.md` | active | Setting up the Next.js application and existing Supabase/Vercel workflow. |
| `AGENTS.md` | active | Changing code or running the repository quality gates. |

## Active requirements and plans

| Path | Status | Read when |
| --- | --- | --- |
| [`docs/plans/active/PLAN-20261007-speech-stability.md`](plans/active/PLAN-20261007-speech-stability.md) | active | Implementing or accepting the FunASR-backed transcription path. |

## Architecture and specifications

| Path | Status | Read when |
| --- | --- | --- |
| [`docs/architecture/ADR-20261007-asr-service-boundary.md`](architecture/ADR-20261007-asr-service-boundary.md) | active | Reconsidering where speech inference runs or how fallback works. |
| [`docs/specs/SPEC-20261007-asr-http.md`](specs/SPEC-20261007-asr-http.md) | active | Implementing or integrating the ASR HTTP contract. |

## Operations

| Path | Status | Read when |
| --- | --- | --- |
| [`docs/operations/RUN-20261007-funasr.md`](operations/RUN-20261007-funasr.md) | active | Deploying, checking, rolling back, or diagnosing the FunASR service. |

## Document discipline

New durable documents belong in a type directory, use a date or issue identifier, and are linked here in the same change. Keep secrets, tokens, raw audio, and production records out of documentation.
