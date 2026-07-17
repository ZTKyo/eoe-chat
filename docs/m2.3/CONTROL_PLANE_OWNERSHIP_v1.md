# M2.3 Control Plane Ownership v1

Status: **Normative for M2.3**  
Product: **EOE Chat**  
Core engine: **English Overlay Engine**

## Purpose

M2.3 repairs the control-plane ownership failure confirmed by the M2.2 live probes. The model remains responsible for natural wording, while all durable state, identifiers, policy decisions, semantic segments, validation, retries, fallback, and exposure records remain owned by the Engine.

M2.3 does not introduce Adaptive Progression. The configured Progression Level remains fixed; Effective Level may only be lowered for the current turn.

## Ownership matrix

| Concern | Engine | Provider |
| --- | --- | --- |
| Conversation Function | Classifies and owns the authoritative value | Does not return or override it |
| Fixed / Effective Level | Owns | Does not return it |
| Overlay scheduling | Owns mode, budget, reasons, versions | Does not return it |
| Candidate selection | Owns candidates and selected Phrase ID | Does not select an unoffered Phrase |
| Phrase content | Owns the selected Registry surface form | Receives it as context but does not echo it as a control field |
| Phrase realization | Defines allowed positions and safety metadata | Chooses a natural template position or returns `noFit` |
| Provider output | Parses a strict Provider Template DTO | Produces only the strict Provider Template DTO |
| Semantic segments | Builds Domain segments from the validated template | Does not emit segment types, language tags, Phrase IDs, or HTML |
| Domain schema | Owns and validates | Has no authority over it |
| Policy / Registry versions | Owns | Does not return them |
| Retry and fallback | Owns attempt limit, correction directive, and fallback | Performs a requested generation attempt only |
| Exposure events | Writes only after final validated display | Never writes or declares exposure |
| Diagnostics | Owns redacted attempt and validation evidence | Supplies normalized response metadata only |

## Provider output allowlist

The only accepted provider-owned fields are:

- `schemaVersion`
- `usePhrase`
- `responseTemplate`
- `noFitReason` when `usePhrase` is `false`

The provider must not return:

- `conversationFunction`;
- `phraseId`, phrase content, candidate IDs, or `usedPhraseIds`;
- semantic segments, segment types, or language tags;
- `isNew`, assistance flags, or exposure state;
- fixed/effective levels;
- policy, selector, Registry, or Domain schema versions;
- `intentPreserved` or self-reported naturalness confidence.

Unexpected properties are rejected. They are not silently discarded.

## Authoritative processing order

1. Engine classifies the Conversation Function.
2. Engine computes Fixed Level and Effective Level.
3. Engine schedules the overlay.
4. Engine selects candidates and, at most, one selected Phrase.
5. Engine builds a compact per-turn directive containing only necessary state.
6. Provider returns a strict Provider Template.
7. Engine parses and validates the template before phrase insertion.
8. Engine inserts the selected Registry phrase and builds semantic segments.
9. Engine runs the existing Domain hard validator and deterministic naturalness checks.
10. On failure, Engine may request one complete regeneration with violation-specific guidance.
11. After two failed attempts, Engine returns a Chinese-dominant natural fallback with `noFit: true`.
12. Only the final displayed English Chunk creates an Exposure Event.

## Deprecated M2.2 envelope

`eoe.provider-envelope.v1 — deprecated after M2.2`

The parser, schema, mapper, fixtures, and historical reports for this envelope remain available for migration and regression evidence. The M2.3 live path must not import, request, parse, map, or depend on the deprecated envelope.

## Non-goals

- Adaptive Progression or automatic promotion/demotion;
- Provider-owned Domain state;
- validator relaxation to make live probes pass;
- string-replacement repair of invalid provider output;
- M3 vocabulary assistance or a broader teaching UI.
