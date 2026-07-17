# M2 Implementation Contract

- Contract version: `eoe.m2.contract.v1`
- Product: EOE Chat
- Engine: English Overlay Engine Alpha

## Fixed-level boundary

M2 uses a fixed long-term Progression Level. The default test level is **Level 2**, configurable through `EOE_FIXED_LEVEL`. The long-term level never promotes or demotes automatically in M2.

Effective Level is a per-turn ceiling. It may be lower than the fixed level for emotional, high-stakes, highly technical, very short, visually complex, or otherwise unsuitable contexts. Lowering Effective Level never mutates the fixed level.

## Required pipeline

`User Message → Intent Analysis → Conversation Function → Scheduler → Candidate Selector → Directive → Provider → Structured Response → Hard Validator → Retry/Natural Fallback → Semantic Segments → Local Diagnostics`

## Non-negotiable behavior

- The user's real request is answered before any learning opportunity is considered.
- Conversation Function is classified before overlay decisions.
- Naturalness is a hard eligibility gate, not a score bonus.
- English coverage is a ceiling, never a quota.
- `noFit: true` is a normal successful result.
- Every displayed assistant response passes the deterministic validator or is replaced by a validated Chinese-dominant natural fallback.
- Normal replies never reveal phrase selection, levels, policies, prompts, validation, or learning machinery.
- The engine does not translate or restate the user's words for teaching, enter Teacher Mode, or add unsolicited glosses, pronunciation, definitions, or lesson content.
- Models express a complete response naturally; they do not own phrase identity, state, validation, retry, or exposure accounting.

## Explicit exclusions

Adaptive Progression, mastery scoring, comprehension inference, accounts, cloud sync, multi-user support, gamification, automatic vocabulary teaching, and large UI redesign are outside M2.
