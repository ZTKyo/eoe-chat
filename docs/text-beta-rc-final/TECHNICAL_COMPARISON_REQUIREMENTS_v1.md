# Technical Concept Comparison Requirements v1

Status: Text Beta RC final contract

## Purpose

A technical comparison must explain the named concepts and their meaningful
differences. Validation is semantic and order-independent; it does not depend
on a Case ID, a fixed sentence, fixed keyword order, or character-distance
windows.

## Domain model

```ts
type TechnicalConceptComparisonRequirements = {
  concepts: string[];
  needsCoreDifference: boolean;
  needsSafetyDifference: boolean;
  needsUsagePrecondition: boolean;
  needsPracticalRecommendation: boolean;
  needsExample?: boolean;
};
```

The requirements are attached to the existing `explain_concept` Response
Obligation when the user asks to compare at least two technical concepts.
Language or framework context, such as TypeScript, is retained in the request
but excluded from the pair of subject concepts when appropriate.

## Required comparison dimensions

A complete comparison covers:

1. each named concept;
2. the core behavioral difference;
3. the safety or risk difference;
4. any precondition before use;
5. practical guidance about when to choose each concept.

For `unknown` and `any`, equivalent expressions are accepted:

- narrowing or 类型收窄;
- type guard or 类型守卫;
- `typeof` or `instanceof` checks;
- explicit assertion or 明确断言;
- validating before use.

The required semantics are:

- `any` bypasses or effectively disables useful type checking for that value;
- `unknown` cannot be used directly;
- `unknown` requires validation, narrowing, a type guard, or an explicit
  assertion before use;
- `unknown` is generally safer than `any`;
- prefer `unknown` for external data of uncertain type;
- consider `any` only when loss of type safety is explicitly accepted.

## Hard and Soft separation

Hard issues:

- a named concept is missing;
- `any` behavior is not explained;
- `unknown` behavior is not explained;
- the core difference is missing;
- the concepts are incorrectly equated;
- the ordinary structured response, task, or safety gate fails.

Soft warnings:

- the narrowing or usage precondition could be more explicit;
- the safety conclusion could be clearer;
- practical selection guidance is incomplete;
- an optional example is absent;
- the response is correct but comparatively brief.

Attempt 1 may be regenerated once for Soft warnings. If Attempt 2 remains
Hard-valid, the best substantive Hard-valid candidate is displayed and
`displayedWithSoftQualityWarning=true` is recorded. Soft incompleteness alone
must not discard a useful answer in favor of Natural Fallback.

