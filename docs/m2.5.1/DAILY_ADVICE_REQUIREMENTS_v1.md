# Daily Advice Requirements v1

## Contract

```ts
type DailyAdviceRequirements = {
  needsConcreteAction: boolean;
  minimumActionCount: number;
  needsSequence: boolean;
  needsTimeAnchor: boolean;
  needsAdjustmentOption: boolean;
};
```

Daily advice is distinct from a structured plan. The analyzer uses request horizon and intent, not only the word `安排`.

A lightweight leisure or daily-life request normally requires:

- one or two concrete actions;
- a natural start condition or time anchor when the user asks how to arrange it;
- a light alternative or adjustment when constraints are implicit.

It does not automatically require a multi-stage schedule, full timeline, priority matrix, or feedback loop.

## Deterministic evidence

Missing evidence uses:

- `missing_concrete_action`
- `missing_action_assignment`
- `missing_start_condition`
- `missing_adjustment_option`

`missing_action_assignment` means actions were named but not connected to a usable moment, condition, or sequence when that connection is required.

Empty advice remains invalid. Phrases equivalent to “慢慢来”, “先做最小的一步”, or “可以试试看” do not satisfy concrete action evidence by themselves.

The retry Directive receives the active requirements and exact missing codes, then regenerates the full response. Optional English must not replace the advice.
