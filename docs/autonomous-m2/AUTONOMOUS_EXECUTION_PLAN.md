# Autonomous M2 Technical Closeout Plan

Status: **COMPLETE — M2_AUTONOMOUS_STOPPED_WITH_BLOCKERS**
Authorized scope: M2.3.1 and at most three controlled M2 repair cycles  
Forbidden: M3, Adaptive Progression, push, remote creation, deployment, global Git configuration, Validator relaxation, `npm audit fix --force`

## Terminal states

Only one terminal state may be selected:

- `M2_TECHNICAL_PASS_HUMAN_REVIEW_PENDING`
- `M2_AUTONOMOUS_STOPPED_WITH_BLOCKERS`
- `M2_AUTONOMOUS_STOPPED_FOR_SECURITY`

Independent Human Review always remains pending during this task.

The plan terminated after all three authorized Repair Cycles. The final capability gate and fallback gate passed, but the 20-case Corpus left DeepSeek at 8/9 valid final responses (88.9%), below the per-Provider 90% threshold. No fourth cycle or additional real request is authorized.

## Starting checkpoint

- Commit: `8a9820e`
- Message: `M2.3 checkpoint: preserve live template probe failure`
- Preserved live result: `LIVE_TEMPLATE_PROBE_FAIL`, 5/9
- Preserved stop behavior: fallback probe and 20-case Corpus not executed

## Real-call budget

Hard ceilings for the entire autonomous task:

- Requests: 60
- Tokens: 150,000
- Real Provider test runtime: 90 minutes

Starting usage for this autonomous task is zero. The earlier M2.3 9-probe run is historical evidence and is reported separately; it is not silently charged again to the new autonomous budget.

Every new real attempt records Provider, model, case, attempt, latency, token usage, terminal stage, violation codes, and Natural Fallback state. Testing stops as soon as evidence is sufficient.

## Execution order

1. Add M2.3.1 redacted per-attempt capture and replay infrastructure.
2. Preserve the fact that historical M2.3 raw Template text was not retained; do not reconstruct it.
3. Remove forced sentence-position controls from production and live-probe state.
4. Audit Live-Safe Phrase metadata and require Provider-selected natural position within the allowed set.
5. Add regression tests for position neutrality and stage-specific diagnostics.
6. Run the complete no-quota gate.
7. Run six Provider Capability Probes: one noFit and one English Chunk per Provider.
8. Only after 6/6, run the separate fallback probe.
9. Only after both gates pass, run the 20-case Live Corpus.
10. If a gate fails, use captured raw Template plus Engine context for offline replay before changing code.

## Repair-cycle rules

Each cycle records evidence, exact stage/codes, root cause, minimal change, regression test, full local gate, minimal live gate, request/token delta, and success-rate delta. A repeated failure without new evidence, two cycles without improvement, a core-principle conflict, security risk, or budget ceiling ends autonomous work.

## No-quota gate

- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run benchmark:eoe`
- `npm run benchmark:naturalness`
- `npm run replay:m2.3-live-failures`
- `npm run build`
- `npm run test:e2e`

Skipped Live suites never count as passed Live evidence.
