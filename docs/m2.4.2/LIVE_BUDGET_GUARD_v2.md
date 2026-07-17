# M2.4.2 Live Budget Guard v2

## Transport boundary

Every native HTTP request made by `OpenAICompatibleProvider` requires one shared `LiveBudgetGuard`. An Adapter without the Guard throws before native `fetch`. Explicitly injected transports exist only for deterministic unit contract tests and do not use native Provider transport.

## Request lifecycle

1. Revalidate mode, authorization, keys, Run ID, and Ledger path.
2. Load and identity-check the Ledger.
3. Stop before transport if request, token, or runtime budget is exhausted.
4. Atomically pre-register the Attempt and increment request count.
5. Send the HTTP request.
6. Record HTTP status, normalized outcome, actual Usage, and latency.
7. Attach pipeline outcome, violations, Provider fallback, Natural Fallback, and security-stop state.
8. Atomically replace the Ledger file.

Timeout and cancellation are terminal audited outcomes. Provider fallback and Validator retry remain distinct attempts.

## Ledger schema

`eoe.live-budget.v2` records:

- Run identity: `runId`, `executionMode`, `startedAt`, `completedAt`;
- limits: request, token, and Provider-runtime budgets;
- totals: request count, token count, Provider runtime;
- per Attempt: internal ID, request ID, Provider, model, scenario, conversation turn, attempt number, timestamps, HTTP status, Usage, latency, transport outcome, pipeline outcome, violations, fallback flags, Natural Fallback, and security stop.

Pipeline annotations apply only to previously unannotated attempts. This prevents a targeted retry of the same scenario from rewriting the first cycle's outcome.

## M2.4.2 Focused Ledger

- Run ID: `m2-4-2-focused-2026-07-17T03-09-04-609Z`
- Budget: 30 requests / 40,000 tokens / 1,800,000 ms
- Actual: 14 requests / 14,368 tokens / 128,099 ms
- HTTP outcomes: 13 success, 1 timeout
- The first cycle and targeted retry share the same non-reset Ledger.
- A metadata-annotation overwrite bug discovered after the retry was reconciled from the preserved cycle-one report. Request, token, latency, HTTP, and Usage values were never changed.

The Corpus Ledger was not created because the Focused gate did not pass.
