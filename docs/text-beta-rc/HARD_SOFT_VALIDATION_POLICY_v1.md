# Hard and Soft Validation Policy v1

Version: `text-beta-rc.validation.v1`

## Hard Validation

A Hard failure prevents display. Hard checks cover:

- invalid or unparseable Provider Template/Schema;
- missing, altered, unselected, or ineligible Phrase;
- explicit Chinese request violation;
- empty response, task replacement, clear core-answer omission, context reset, or false history denial;
- unsupported precise quantitative claims stated as fact;
- automatic teaching, translation, prompt leak, unsafe Overlay budget, or other deterministic safety violation;
- repeated Provider failure or unusable output.

Natural Fallback is allowed only after Provider failure or repeated Hard failure.

## Soft Quality Review

```ts
type SoftQualityReview = {
  acceptable: boolean;
  warnings: string[];
  confidence: number;
  retryRecommended: boolean;
};
```

Soft warnings include:

- technical wording order or use of a valid synonym;
- potentially insufficient depth, plan detail, comparison detail, or relationship coverage;
- template-like style;
- mildly mechanical Phrase flow;
- deterministic naturalness heuristics that cannot prove a Hard violation.

## Attempt policy

1. Attempt 1 Hard-fails: regenerate if retryable.
2. Attempt 1 is Hard-valid and Soft-acceptable: display it.
3. Attempt 1 is Hard-valid with Soft warnings: retain it and regenerate once.
4. Attempt 2 is Hard-valid: compare the two Hard-valid answers by fulfilled obligations, Soft confidence, warning count, and useful response substance.
5. If the selected answer still has warnings, display it with local diagnostic `displayedWithSoftQualityWarning=true`.
6. A Soft warning alone never produces Natural Fallback.

Warnings are hidden from the ordinary chat UI and visible only in Developer diagnostics.

