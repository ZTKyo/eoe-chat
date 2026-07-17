# M2.3.2 DeepSeek Boundary Root Cause

Status: **EVIDENCE_COMPLETE**

Authoritative fixtures:

- `m2-3-1-2026-07-16T22-59-28-579Z--corpus-long-analysis--attempt-1.json`
- `m2-3-1-2026-07-16T22-59-28-579Z--corpus-long-analysis--attempt-2.json`

Both fixtures replay exactly through the M2.3.1 offline pipeline. The full replay suite passed 51/51 before any M2.3.2 implementation change.

## Shared Engine context

- Synthetic user-input summary: analyze how user need, competition, delivery cost, and long-term maintenance interact, then identify the most overlooked constraint.
- Conversation Function: `answer`.
- Selected Phrase ID: `p-in-the-long-run`.
- Canonical: `in the long run`.
- Registry bilingualPatterns: `这次先解决最急的问题，{phrase} 还要减少重复维护成本。`
- Allowed positions: `sentence_start`, `sentence_middle`.
- Existing retry correction: never attach the placeholder directly to Chinese/Latin/digits; follow the selected safe bilingual frame while writing a fresh answer.

## Attempt 1

- Provider Template: `{"schemaVersion":"eoe.provider-template.v1","usePhrase":true,"responseTemplate":"新产品从用户问题出发，竞争环境决定了差异化空间，交付成本影响短期决策，{{EOE_PHRASE}}最容易被忽略的是维护成本与架构可扩展性之间的约束。"}`
- `usePhrase`: `true`.
- Placeholder position: `sentence_middle`, index 35.
- Previous 30 characters: `户问题出发，竞争环境决定了差异化空间，交付成本影响短期决策，`
- Next 30 characters: `最容易被忽略的是维护成本与架构可扩展性之间的约束。`
- Plain Text Projection: `新产品从用户问题出发，竞争环境决定了差异化空间，交付成本影响短期决策，in the long run最容易被忽略的是维护成本与架构可扩展性之间的约束。`
- Validator violation: `template_boundary_invalid`.
- Boundary fact: the left side has a legal Chinese comma; the right side has no punctuation or whitespace and directly joins `run` to `最`.
- Provider frame use: it did not preserve the Registry pattern's space after the placeholder.

## Attempt 2

- Provider Template: `{"schemaVersion":"eoe.provider-template.v1","usePhrase":true,"responseTemplate":"新产品从用户问题出发，竞争环境决定差异化，交付成本影响初期可行性，但{{EOE_PHRASE}}最容易被忽略的是长期维护的成本累积和技术债务。"}`
- `usePhrase`: `true`.
- Placeholder position: `sentence_middle`, index 34.
- Previous 30 characters: `用户问题出发，竞争环境决定差异化，交付成本影响初期可行性，但`
- Next 30 characters: `最容易被忽略的是长期维护的成本累积和技术债务。`
- Plain Text Projection: `新产品从用户问题出发，竞争环境决定差异化，交付成本影响初期可行性，但in the long run最容易被忽略的是长期维护的成本累积和技术债务。`
- Validator violation: `template_boundary_invalid`.
- Boundary fact: both `但` -> `in` and `run` -> `最` are directly joined without punctuation or whitespace.
- Repetition: yes. Attempt 2 repeated the same unsafe right boundary and introduced a second unsafe left boundary.
- Provider frame use: no. It did not preserve either adjacent separator from the passed safe frame.

## Retry and Natural Fallback path

Attempt 1 passed strict Template parsing, failed Template Validator, and did not reach Mapper. Attempt 2 received the normalized violation plus the existing safe frame, passed parsing, repeated the violation, and again did not reach Mapper. The Engine then created the Chinese-dominant Natural Fallback. That fallback passed Domain validation but was correctly excluded from Structured Response success.

## Required determinations

1. Direct Chinese-character attachment: **yes**; right side in both attempts and both sides in Attempt 2.
2. Missing boundary structure: **yes**; Attempt 1 lacks a right separator, Attempt 2 lacks separators on both sides.
3. Provider used bilingualPatterns: **no**; it did not preserve their placeholder-adjacent whitespace.
4. Pattern suitability: the Phrase is semantically suitable, but the single pattern is lexically narrow and its whitespace-only right boundary is less robust than explicit punctuation for a long analytical transition.
5. Incorrect allowed position: **no**; `sentence_middle` is valid for this adverbial. The issue is the realized boundary, not position eligibility.
6. Retry correction sufficient: **no, empirically**; it identifies the rule but does not require exact preservation of adjacent separators or explicitly direct Provider noFit when it cannot do so naturally.
7. Provider should return noFit: only if it cannot produce a safe frame on retry. The Phrase itself is not inherently incompatible with the topic.
8. Validator false positive: **no**. Both projections visibly form an invalid Chinese-English token boundary.
9. Root category: Provider realization plus insufficiently robust Phrase frame/retry precision. It is not Parser, Mapper, Domain schema, Candidate position, or Validator behavior.

## M2.3.2 Live confirmation

The new Live run preserved the strict boundary behavior:

- Attempt 1: `template_boundary_invalid`; the Phrase still directly touched the following Chinese character.
- Attempt 2: valid punctuation on both sides of the placeholder; all structured stages passed.
- Final result: valid English Chunk Structured Response, no Natural Fallback, 2 attempts, 3,722 ms aggregate latency, 2,277 total tokens.

This confirms that the original Validator result was not a false positive and that a precise retry can safely close the Provider realization failure.
