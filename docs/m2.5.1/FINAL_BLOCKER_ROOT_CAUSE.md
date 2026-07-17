# M2.5.1 Final Blocker Root Cause

## Scope and evidence boundary

This diagnosis is limited to:

- `core-advice-choice`
- `core-technical-typescript`
- `opportunity-advice-daily`
- `multi-ambiguity`

The primary evidence is the frozen M2.5 result and budget ledger:

- `artifacts/benchmarks/m2.5-text-corpus-results.json`
- `artifacts/benchmarks/m2.5-text-corpus-budget.json`

The M2.5 result preserves the user input and history, normalized analysis, obligations, candidate pool, selected Phrase, final text, task-completeness result, aggregate violation codes, attempts, usage, latency, and Natural Fallback state. The budget ledger preserves each HTTP attempt, request ID, Provider/model, usage, latency, and per-attempt violation codes.

M2.5 did **not** persist `providerOutputPreview`, the original Template DTO, per-stage pipeline status, or the Attempt 2 Directive. Therefore the exact M2.5 Attempt 1/2 Template strings cannot be reconstructed and are not fabricated here. This is an evidence-retention defect, not permission to reinterpret a failure. The diagnosis also uses the pipeline implementation and older raw captures for the same Core scenarios only as comparative evidence:

- `artifacts/regressions/m2-final-live-captures/*advice-choice*`
- `artifacts/regressions/m2-final-live-captures/*technical-typescript*`
- `artifacts/regressions/m2.3.2-deepseek-boundary/live-captures/*advice-choice*`
- `artifacts/regressions/m2.3.2-deepseek-boundary/live-captures/*technical-typescript*`

M2.5.1 evidence must retain every new Attempt preview so that this gap does not recur.

## `core-advice-choice`

### Frozen facts

- User: `两个方案拿不定主意，我该怎么做选择？`
- History: one user turn.
- Conversation Function: `advise`.
- Obligations: `answer_question`, `compare_options`.
- Candidate pool: `p-for-now`, `p-it-depends`, `p-at-the-same-time`, `p-in-the-long-run`.
- Selected Phrase: `p-for-now`.
- Attempts: 2.
- Both attempts reached task completeness and were rejected. Aggregate codes: `task_incomplete`, `response_obligation_missing`, `comparison_not_actionable`, `overlay_replaced_core_answer`.
- Missing evidence after the final fallback review: `comparison_missing_recording`, `comparison_missing_tradeoff`.
- Natural Fallback: `关于“两个方案拿不定主意，我该怎么做选择？”，可以先明确最重要的目标，再选一个成本低、可逆、今天就能开始的小步骤。把具体限制告诉我后，我可以继续替你细化。`
- Natural Fallback was correctly recorded as failure, not PASS.

The task-completeness path is only reached after Template parsing, Template validation, mapping, domain schema validation, and deterministic domain validation succeed. Naturalness validation is not reached when task completeness fails.

The previous comparison checker required all of dimensions, recording, trade-off, reversible trial, and next action for every comparison. That contract was not proportional and did not explicitly require the user's priority. Attempt 2 received generic task-rewrite instructions plus the same five-part checklist, but no exact `missing_*` evidence. Older raw captures show that the Provider tends to produce a short slogan or a Phrase-led answer; those captures do not substitute for the missing M2.5 Template strings.

### Root-cause classification

- `obligation_definition_error`
- `provider_task_realization_failure`
- `retry_correction_insufficient`
- `genuine_incomplete_answer`

This is not classified as a confirmed Validator false positive. The accepted product contract still requires useful decision support; it is being made proportional and explicit.

## `core-technical-typescript`

### Frozen facts

- User: `解释 TypeScript 里 unknown 和 any 的区别`
- History: one user turn.
- Conversation Function: `explain`; sensitivity: `technical`.
- Obligations: `answer_question`, `explain_concept`, `provide_reasons`.
- Candidate pool: `p-at-the-same-time`, `p-for-example`.
- Selected Phrase: `p-at-the-same-time`.
- Attempts: 2.
- Each attempt recorded `task_incomplete`, `response_obligation_missing`, and `overlay_replaced_core_answer`.
- Natural Fallback: `关于“解释 TypeScript 里 unknown 和 any 的区别”，先抓住核心关系：确认现象、找出直接原因，再区分触发条件和长期因素。你把具体例子或报错补充出来，我可以继续给出针对性的解释。`
- The fallback passes the existing shallow generic explanation regex, but does not actually explain `unknown` versus `any`. This exposes an additional completeness precision gap; it does not make the two rejected Provider attempts valid.

No M2.5 code records `teacher_mode`, `automatic_gloss`, `duplicated_translation`, Template parse failure, Phrase boundary failure, Phrase position failure, or domain-validator failure for this case. The failure is therefore at response-obligation/task-realization, not a demonstrated language-teaching false positive.

Older raw captures for the same question contain a correct, Chinese-first explanation with code identifiers such as `unknown`, `any`, and `typeof`, `usePhrase=false`, and no teaching-language rejection. That comparative evidence confirms that technical identifiers can be valid domain content. It does not prove what the unavailable M2.5 Templates said.

The current Directive says “Do not explain English” without explicitly excluding technical identifiers and API/type names. With a selected optional Phrase, this can make a technical answer less stable. Attempt 2 has only generic task-completeness corrections; `overlay_replaced_core_answer` has no dedicated correction.

### Root-cause classification

- `provider_task_realization_failure`
- `retry_correction_insufficient`
- `genuine_incomplete_answer`
- `other`: technical semantic-role instructions were underspecified

`validator_false_positive` is not supported by the preserved M2.5 violation codes and is not asserted. M2.5.1 adds a narrow semantic classification and a topic-specific completeness check without bypassing the Validator.

## `opportunity-advice-daily`

### Frozen facts

- User: `周末只想真正放松一下，你建议怎么安排？`
- History: one user turn.
- Conversation Function: `advise`.
- Obligations: `answer_question`, `provide_plan`.
- Candidate pool: `p-for-now`, `p-at-the-same-time`, `p-in-the-long-run`, `p-it-depends`.
- Selected Phrase: `p-for-now`.
- Attempts: 2.
- Both attempts reached task completeness. Aggregate codes: `task_incomplete`, `response_obligation_missing`, `plan_not_actionable`, `missing_task_assignment`, `overlay_replaced_core_answer`.
- Natural Fallback is the same generic advice fallback used for the comparison scenario and contains no concrete relaxing activity.

The analyzer treated the word `安排` as a full plan request. `PlanRequirements` then required task assignment using a narrow work/study verb list. This is disproportionate for lightweight leisure advice and also rejects ordinary relaxation actions. Attempt 2 was told to add “tasks to periods or stages,” which reinforced the wrong contract.

### Root-cause classification

- `obligation_definition_error`
- `provider_task_realization_failure`
- `retry_correction_insufficient`
- `genuine_incomplete_answer`

The fix is a general `DailyAdviceRequirements` contract, not a scenario answer or a relaxation keyword exception in the final response.

## `multi-ambiguity`

### Frozen facts

- History contains two real semantic English segments:
  - `p-it-depends`: `It depends，要看目标。`
  - `p-for-now`: `For now，先收集数据。`
- User: `刚才那个什么意思？`
- Conversation Function: `clarify`.
- Obligations: `answer_question`, `clarify_prior_phrase`, `continue_context`.
- Candidate pool: empty; selected Phrase: none.
- Context: assistance active, unresolved, with more than one Phrase ID.
- Attempts: 2.
- Both attempts reached task completeness. Aggregate codes: `task_incomplete`, `response_obligation_missing`, `phrase_clarification_context_error`.
- Final issue: `phrase_clarification_ambiguity_not_resolved`.
- Natural Fallback generically asks what part is confusing; it does not list the known candidates and is correctly a failure.

The Engine already deterministically found multiple Phrase IDs but still delegated the choice and clarification wording to the ordinary Provider. The Provider was given internal IDs rather than an Engine-owned, user-facing candidate resolution object. Retry retained the same ownership mistake.

### Root-cause classification

- `ambiguity_resolution_ownership_error`
- `retry_correction_insufficient`
- `provider_task_realization_failure`

This is not `context_resolution_error`: the Engine correctly detected multiple historical candidates. The error is that it failed to own the next deterministic disambiguation action.

## Cross-cutting conclusion

The four failures do not justify weakening the deterministic Validator, bypassing task completeness, forcing `noFit`, changing Provider routing, or hard-coding scenario IDs. The smallest general closure is:

1. proportional comparison and daily-advice contracts with precise evidence codes;
2. Engine-owned Phrase reference resolution and ambiguous clarification;
3. explicit technical semantic roles plus a narrow TypeScript distinction requirement;
4. precise retry corrections that regenerate the complete answer;
5. new live evidence that retains the actual Attempt previews.

## M2.5.1 Live update

The first real four-case Targeted run produced 3/4:

- `core-advice-choice`: PASS after one precise retry; the accepted complete response used `usePhrase=false`.
- `opportunity-advice-daily`: PASS on Attempt 1.
- `multi-ambiguity`: PASS with zero Provider requests through Engine-owned clarification.
- `core-technical-typescript`: FAIL after two attempts and Natural Fallback.

The initial TypeScript Attempt 2 was a substantively correct technical answer. It explicitly said that `any` disables type checking and that `unknown` requires a type guard, assertion, or validation before use. The deterministic technical-distinction matcher rejected the valid `unknown` evidence because it encoded a narrower word order. This adds `validator_false_positive` to the confirmed M2.5.1 live root cause.

The one permitted minimal retry broadened only the two observed safe word orders and added exact Provider-output regression tests. The isolated retry still failed:

- Retry Attempt 1 said `any` bypasses type checking and `unknown` forces narrowing, but did not explicitly connect narrowing to use.
- Retry Attempt 2 was again substantively correct: `any` “完全禁用了类型检查”; `unknown` requires narrowing/guards/assertion and only then permits operations.
- The matcher did not recognize `禁用` as an `any` behavior synonym and its bounded distance for the longer `unknown` sentence remained too narrow.

The final confirmed TypeScript classification is therefore:

- `validator_false_positive`
- `retry_correction_insufficient`
- `other`: deterministic semantic evidence was modeled with brittle lexical windows

No Teacher Mode, automatic gloss, translation duplication, Template parse, Phrase boundary, Phrase position, domain schema, or hard domain-validator failure occurred. Both attempts reached task completeness. Per the one-retry stop rule, no further product change or M2.5.x phase is permitted.
