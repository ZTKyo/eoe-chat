# M2.4.2 Live Execution Isolation v1

## Goal

Real Provider transport is fail-closed. A key in `.env.local` or `USE_MOCK_PROVIDER=false` is never sufficient authorization.

## Execution modes

| Mode | Real Provider permitted | Provider selected by standard factory |
|---|---:|---|
| `unit` | No | MockProvider |
| `mock_e2e` | No | MockProvider |
| `structure_benchmark` | No | MockProvider |
| `replay` | No | MockProvider |
| `live_probe` | Only with all Live guards | GLM / GLM Vision / DeepSeek |
| `live_corpus` | Only with all Live guards | GLM / GLM Vision / DeepSeek |
| `production` | No in M2.4.2 verification commands | MockProvider |

Live authorization additionally requires:

- `EOE_ALLOW_LIVE_PROVIDER=true`;
- a non-empty `EOE_LIVE_RUN_ID`;
- a non-empty absolute `EOE_LIVE_LEDGER_PATH`;
- both Provider keys;
- a Ledger whose Run ID and mode match the process.

Failure uses `LIVE_PROVIDER_BLOCKED_BY_EXECUTION_GUARD`; it never silently becomes a Mock Live pass.

## Mock E2E

`npm run test:e2e` owns port 3100 and explicitly sets, after inherited environment values:

- `EOE_EXECUTION_MODE=mock_e2e`;
- `USE_MOCK_PROVIDER=true`;
- `EOE_ALLOW_LIVE_PROVIDER=false`.

Server startup validation, runtime identity validation, Provider factory routing, and the native transport guard independently enforce the boundary. The client checks mode, Run ID, port, Provider mode, and zero live-request count before each test. Unknown listeners are not reused.

## Live processes

- Focused Probe owns port 3200.
- Live Corpus would own port 3201.
- A process writes only safe temporary identity data: mode, Run ID, PID, port, Provider mode, and start timestamp.
- Keys are never written.
- The launcher verifies identity before starting the Vitest client, closes its owned server, and confirms port release.

## Verification

Twenty-five no-quota isolation tests cover the twenty required cases, including key-present Mock isolation, authorization failures, factory selection, Adapter bypass prevention, Ledger lifecycle, identity mismatch, unknown port refusal, shutdown, inherited environment override, and Replay isolation.

The final Mock E2E result was 22/22 across Desktop and 390×844 Mobile, with:

```text
EOE_EXECUTION_MODE=mock_e2e
Provider=MockProvider
Live requests=0
```
