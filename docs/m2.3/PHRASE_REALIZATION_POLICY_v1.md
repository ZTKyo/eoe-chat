# Phrase Realization Policy v1

Status: **Normative for M2.3**  
Policy version: `eoe.realization.v1`

## Purpose

Phrase realization metadata tells the Candidate Selector, Directive Builder, and deterministic Template Validator where a selected Registry phrase may be used safely in a Chinese-dominant response. It is eligibility metadata, not a fixed sentence assembler.

The Provider decides whether a natural template exists and where to place the single placeholder within allowed positions. The Engine owns the selected Phrase and substitutes it only after validation.

## Profile

```ts
type PhraseRealizationProfile = {
  phraseId: string;
  bilingualSafety: "high" | "medium" | "low";
  grammaticalRole:
    | "discourse_marker"
    | "stance_marker"
    | "adverbial"
    | "predicate_complement"
    | "clause_frame"
    | "other";
  allowedPositions: Array<"sentence_start" | "sentence_middle" | "sentence_end">;
  forbiddenBeforePunctuation: string[];
  forbiddenAfterPunctuation: string[];
  requiresChineseConnectorBefore: boolean;
  requiresChineseConnectorAfter: boolean;
  canBeWholeClause: boolean;
  labelLikeRisk: "low" | "medium" | "high";
  translationRisk: "low" | "medium" | "high";
  liveSafe: boolean;
};
```

Every live-safe profile has at least two allowed positions. Allowed position does not mean every response must use both positions; the template still has to pass deterministic boundary and naturalness checks.

## Live-safe set

M2.3 derives a deliberately small set from the existing active Registry. It does not activate disabled phrases merely to reach a count. A phrase is live-safe only when:

- it is active at the fixed/effective level;
- its bilingual boundary behavior can be described deterministically;
- it has sufficiently low label, translation, and teacher-mode risk;
- it supports the current Conversation Function;
- its profile permits at least two structurally plausible positions;
- it still passes the ordinary Candidate Selector and cooldown rules.

The default live-probe path selects candidates only from this set. Benchmark code may explicitly test non-live-safe phrases as negative cases, but production M2.3 does not use them by default.

## Eligibility order

1. Active Registry and level eligibility.
2. Conversation Function compatibility.
3. Tone, sensitivity, and semantic suitability.
4. Cooldown and reuse preference.
5. Live-safe realization profile eligibility.
6. Allowed positions and boundary requirements.
7. Label-like and translation-risk gate.
8. Naturalness ranking.

All candidates may be rejected. `noFit` remains a successful outcome.

## Boundary rules

- The placeholder must participate in a complete, user-facing sentence.
- Chinese punctuation next to the placeholder must match the profile's forbidden-before/after lists.
- Required Chinese connectors must exist on the relevant side.
- A phrase with `canBeWholeClause: false` cannot be the entire response or a detached list item.
- Heading, glossary, teaching, translation, parenthetical definition, and colon-label patterns are invalid.
- Sentence-start, middle, and end are computed from visible text boundaries, not trusted Provider metadata.
- Phrase content is never used as a substitute for the user's answer.

## Content ownership

The selected surface form comes from the Registry and remains Engine-owned. The Provider sees the selected phrase only as generation context and must emit the placeholder rather than the phrase text. The mapper replaces the exact placeholder with the Engine-owned content and assigns the Engine-owned Phrase ID.

## Versioning

Profiles are reviewed and versioned independently from phrase activation. A profile change must update this policy version or the concrete profile version used by diagnostics. Exposure Events record the effective policy and Registry versions already owned by the Engine.
