# M2.4.1 Execution Incident

Status: `LIVE_BUDGET_INTEGRITY_LOST`

During no-quota E2E verification on Windows, an externally managed Next.js server was started without explicitly setting `USE_MOCK_PROVIDER=true`. The server therefore inherited real-provider mode from `.env.local`. The E2E command was stopped after completion, but no M2.4.1 budget wrapper was active, so request count, token usage, and Provider runtime cannot be reconstructed reliably.

- No API key or Authorization header was printed.
- No `.env.local` content was copied into artifacts or Git.
- The server was terminated and a later explicit-Mock E2E run passed 22/22.
- The formal M2.4.1 Focused Probe was not started.
- No Targeted Retry or full live corpus was run.
- Final state must remain `M2_4_1_STOPPED_WITH_BLOCKERS`.

This document preserves the execution fact; it must not be reinterpreted as a Focused Probe result or a certified budget total.
