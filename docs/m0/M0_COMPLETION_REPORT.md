# M0 Completion Report

- Completed: 2026-07-16
- Status: Complete; M1 authorized to start immediately

## Files frozen

1. `PRODUCT_CONTRACT.md`
2. `PROGRESSION_POLICY_v1.md`
3. `CONVERSATION_FUNCTIONS_v1.md`
4. `STRUCTURED_RESPONSE_SCHEMA_v1.md`
5. `VALIDATION_POLICY_v1.md`
6. `PROVIDER_CAPABILITY_MATRIX.md`
7. `DATA_MODEL_v1.md`
8. `M1_ACCEPTANCE_CRITERIA.md`

## Key decisions

- EOE remains a conversation-first, local-first, single-user MVP.
- Naturalness is a hard gate; `noFit` is a successful outcome.
- Seven internal levels are retained.
- Understandable English Coverage is a ceiling/range, never a quota.
- Long-term Progression Level is separated from rapidly adjustable Effective Level.
- Promotion requires repeated evidence across turns, sessions, contexts, and Conversation Functions.
- Exposure, elapsed time, and silence do not equal mastery.
- Semantic Segments are the storage and rendering source of truth.
- Validator runs before display and allows only two generation attempts.
- Provider secrets stay server-side; IndexedDB stores local conversations and evidence.
- GLM-4.7, GLM-4.6V, and DeepSeek V4 Flash identifiers were checked against official documentation on 2026-07-16.

## Consistency check

The frozen documents were checked against all three EOE v1.0 documents. Where the source documents were high-level, decisions followed conversation-first, comprehension-first, naturalness hard gate, simple/reversible, local-first, external state, semantic segments, replaceable providers, and validator-before-display.

No conflict blocks M1. The complete Overlay Engine remains intentionally outside M1.

## Non-blocking runtime dependencies

- Live GLM and DeepSeek verification requires user-supplied keys in `.env.local`.
- Account-specific rate limits cannot be verified without the relevant provider accounts.
- Browser support and Playwright execution will be verified during M1.
