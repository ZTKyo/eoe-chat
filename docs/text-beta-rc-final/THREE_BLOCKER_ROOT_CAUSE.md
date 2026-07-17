# Text Beta RC Final — Three Blocker Root Cause

Evidence status: frozen before implementation

- Starting HEAD: `15f97c9`
- Final-checkpoint commit: `8b126d3`
- Frozen Release Corpus status: `M2_TEXT_BETA_RC_STOPPED_WITH_BLOCKERS`
- Frozen result: 15/18, 8 Soft warnings, final Natural Fallback 0
- Evidence sources:
  - `artifacts/benchmarks/text-beta-rc-release-corpus-results.json`
  - `artifacts/benchmarks/text-beta-rc-release-corpus-report.md`
  - `artifacts/benchmarks/text-beta-rc-live-budget.json`

The prior Release Corpus serializer retained final text, summarized diagnostics,
attempt metadata, request usage, and latency. It did not retain the raw
Provider JSON Template bodies or the full per-turn Directive. This document
does not invent those missing raw fields. A final Template projection is shown
only where it can be derived exactly from the displayed semantic segments and
schema.

## 1. `typescript-unknown-any`

### Frozen input and history

```json
[
  {
    "role": "user",
    "content": "解释 TypeScript 里 unknown 和 any 的区别"
  }
]
```

### Analysis and obligations

- Conversation Function: `explain`
- Sensitivity: `technical`
- Response length: `medium`
- Obligations:
  - `answer_question`
  - `explain_concept`, with technical terms `TypeScript`, `unknown`, and `any`
  - `provide_reasons`
- Explicit User Premises: none; the two named concepts are technical subjects,
  not factual premises to rewrite.

### Candidate state

Deterministically recomputed at the frozen checkpoint with the same input,
fixed level, Registry, Scheduler, and no recent exposures:

1. `p-at-the-same-time`, score 82.85
2. `p-for-example`, score 78.05

Selected Phrase: `p-at-the-same-time`

Final `noFit`: false

### Final Provider attempts

| Attempt | Provider / model | Request ID | HTTP | Tokens | Runtime | Recorded codes |
|---:|---|---|---:|---:|---:|---|
| 1 | GLM / `glm-4.7` | `req_17a4ef6f-4dca-4558-a0d3-99504ef3827e` | 200 | 1,483 | 5,466 ms | `explanation_missing_cause_or_mechanism`, `technical_unknown_safety_missing`, `technical_usage_advice_missing`, `reasons_missing`, `technical_unknown_narrowing_missing` |
| 2 | GLM / `glm-4.7` | `req_e5f8beeb-1f3d-47d4-b144-f5783aad30ec` | 200 | 1,585 | 5,992 ms | same five codes |

Total: 2 Provider requests, 3,068 tokens, 11,458 ms.

Raw Provider JSON Templates were not persisted by the frozen harness. The exact
final mapped Template projection is:

```json
{
  "schemaVersion": "eoe.provider-template.v1",
  "usePhrase": true,
  "responseTemplate": "在TypeScript中，`any`完全关闭了类型检查，你可以对它进行任意操作，这虽然方便但会牺牲安全性。相比之下，`unknown`是所有类型的顶层类型，它强制你在使用变量前进行类型检查。{{EOE_PHRASE}}，这种机制确保了代码逻辑更加健壮，能够防止许多运行时错误。"
}
```

### Validation and final text

- Hard Validation: valid; the answer was displayable.
- Soft Quality Review:
  - `technical_unknown_narrowing_missing`
  - `technical_unknown_safety_missing`
  - `technical_usage_advice_missing`
  - `reasons_missing`
- Task Completeness: incomplete under the frozen technical comparison review.
- `displayedWithSoftQualityWarning`: true
- Natural Fallback: false
- Harness: FAIL

Final displayed text:

> 在TypeScript中，`any`完全关闭了类型检查，你可以对它进行任意操作，这虽然方便但会牺牲安全性。相比之下，`unknown`是所有类型的顶层类型，它强制你在使用变量前进行类型检查。At the same time，这种机制确保了代码逻辑更加健壮，能够防止许多运行时错误。

Root cause:

- The user received a substantive comparison rather than a generic Fallback.
- It still did not state a sufficiently explicit narrowing, type-guard, or
  assertion precondition.
- It did not explicitly conclude that `unknown` is normally safer.
- It did not give practical guidance about when to choose `unknown` or `any`.
- The correction must be a semantic Technical Concept Comparison contract. It
  must not return to fixed keyword ordering, fixed distance windows, or a
  Case-ID branch.

## 2. `conditional-tradeoff`

### Frozen input and history

```json
[
  {
    "role": "user",
    "content": "一个方案租金更高，但每天能省一小时通勤，我该怎么权衡？"
  }
]
```

### Analysis, obligations, and premises

- Conversation Function: `answer`
- Response length: `medium`
- Frozen obligations:
  - `answer_question`
- Explicit User Premises:
  - `premise-cost-rent-higher`
    - source: `租金更高`
    - kind: `cost`
    - must preserve: true
  - `premise-time-commute-one-hour-daily`
    - source: `每天能省一小时通勤`
    - kind: `time`
    - normalized value: `1 hour/day`
    - must preserve: true
  - `premise-comparison-tradeoff`
    - source: `我该怎么权衡`
    - kind: `comparison`
    - must preserve: true

### Candidate state

Deterministically recomputed at the frozen checkpoint:

1. `p-for-now`, score 84.15
2. `p-sounds-good`, score 83.75
3. `p-at-the-same-time`, score 82.85
4. `p-in-the-long-run`, score 80.65
5. `p-that-makes-sense`, score 79.45

Selected Phrase: `p-for-now`

Final `noFit`: true, reason `phrase_not_natural`

### Final Provider attempt

| Attempt | Provider / model | Request ID | HTTP | Tokens | Runtime | Recorded codes |
|---:|---|---|---:|---:|---:|---|
| 1 | DeepSeek / `deepseek-v4-flash` | `req_8083a840-f573-4920-ad20-95f1b0a209c8` | 200 | 1,404 | 1,413 ms | none |

Raw Provider JSON was not persisted. The exact final mapped Template projection
is:

```json
{
  "schemaVersion": "eoe.provider-template.v1",
  "usePhrase": false,
  "responseTemplate": "可以把时间成本量化来比较。假设你时薪50元，每月工作22天，省下的22小时价值1100元。如果月租金差价低于1100元，高租金方案就更划算。",
  "noFitReason": "phrase_not_natural"
}
```

### Validation and final text

- Template, Schema, and existing Hard Validation: valid
- Existing Task Completeness: complete
- Soft warnings: none
- Natural Fallback: false
- Harness: FAIL with two `required_content_missing` results

Final displayed text:

> 可以把时间成本量化来比较。假设你时薪50元，每月工作22天，省下的22小时价值1100元。如果月租金差价低于1100元，高租金方案就更划算。

Root cause:

- The user explicitly said the rent is higher.
- The user explicitly said the option saves one hour of commuting every day.
- The Provider replaced those concrete premises with a new hourly wage, a new
  count of working days, a new monthly-hour total, and a new monetary
  threshold.
- The new values were marked hypothetical, so this was not the existing
  unsupported-number violation. It was a Premise Preservation failure.
- The Engine had no first-class premise envelope, no premise-aware Directive,
  and no deterministic post-generation preservation review.

## 3. `context-ack-oh`

### Frozen input and full history

```json
[
  {
    "role": "user",
    "content": "我想先比较两个通勤方案的时间和成本。"
  },
  {
    "role": "assistant",
    "content": "可以先记录一周的实际通勤时间和费用。"
  },
  {
    "role": "user",
    "content": "哦"
  }
]
```

### Analysis and obligations

- Conversation Function: `react`
- Response length: `short`
- Overlay suitability: `none`
- Obligations:
  - `contextual_acknowledgement`
  - `continue_context`
- Candidate pool: empty
- Selected Phrase: none
- `noFit`: true, reason `conversation_too_short`

### Execution, validation, and final text

- Execution source: Engine-owned contextual acknowledgement
- Provider attempts: 0
- Provider requests: 0
- Tokens: 0
- Runtime: 0 ms
- Template: not applicable; no Provider generation occurred
- Hard Validation: valid
- Soft warnings: none
- Task Completeness: complete
- Natural Fallback: false
- English Chunks: 0
- Harness: FAIL only because of `invalid_attempt_count:0`

Final displayed text:

> 明白了，先按刚才这一步做；需要继续时，我们再处理“比较两个通勤方案的时间和成本”。

Root cause:

- The product reply retained the real commuting topic.
- It did not greet again, ask what the user wanted, insert a Phrase, invoke a
  Provider, or use Natural Fallback.
- Zero Provider attempts are the correct execution behavior for this
  Engine-owned acknowledgement.
- The Release Corpus harness applied the provider-generated rule
  `attemptCount >= 1` to every response source. This is an accounting defect,
  not a product-response defect.

## Frozen three-case totals

- Provider requests: 3
- Provider tokens: 4,472
- Provider runtime: 12,871 ms
- Natural Fallback: 0
- Product-valid Engine-owned acknowledgement: 1
- Release Harness PASS: 0/3 before final closure

No code was changed before this evidence document was created.
