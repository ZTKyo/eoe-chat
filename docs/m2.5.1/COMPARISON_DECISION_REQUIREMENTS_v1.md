# Comparison Decision Requirements v1

## Contract

```ts
type ComparisonDecisionRequirements = {
  needsComparisonDimensions: boolean;
  minimumDimensionCount: number;
  needsUserPriority: boolean;
  needsTradeOff: boolean;
  needsRecordingMethod: boolean;
  needsReversibleTest: boolean;
  needsNextAction: boolean;
};
```

The analyzer derives requirements from the user's request. It does not require headings, a fixed table, a fixed answer, or a long essay.

For an undecided two-option choice, the default is:

- at least two useful dimensions;
- identify or ask the user to weight the condition that matters most;
- name the main trade-off;
- give a lightweight recording or scoring method;
- give one executable next action.

A reversible test is required only when the request or decision shape makes a trial useful; it is not a universal comparison quota.

## Deterministic evidence

Evidence is accepted by meaning-bearing patterns and counts, not exact sentences. Missing evidence uses:

- `missing_comparison_dimensions`
- `missing_user_priority`
- `missing_trade_off`
- `missing_recording_method`
- `missing_reversible_test`
- `missing_next_action`

The retry Directive receives only the requirements active for this turn and the exact missing codes. It must regenerate the full answer. English Overlay remains optional and cannot substitute for decision support.

## Non-goals

- no scenario-ID branches;
- no mandatory Markdown table;
- no mandatory label sequence;
- no minimum English content;
- no acceptance of slogans such as “it depends” without concrete comparison guidance.
