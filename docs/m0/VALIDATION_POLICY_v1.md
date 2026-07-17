# EOE Validation Policy v1

- Policy version: `eoe.validation.v1`
- Status: Frozen for M1; implemented in M2
- Generation-attempt limit: 2 total attempts

## 1. Validation order

Every generated response must pass validation before display:

1. deterministic hard validation;
2. optional model-based soft validation only when deterministic rules cannot judge naturalness or semantic fit;
3. one corrective regeneration after a retryable failure;
4. if the second attempt fails, return a natural, safe, Chinese-first fallback response and record diagnostics locally.

Validation errors must never be shown directly to an ordinary user. Do not repair complex natural language with string replacement.

## 2. Severity and action

| Severity | Meaning | Action |
|---|---|---|
| `fatal` | Unsafe or contract-invalid output that cannot be displayed | Reject; corrective regeneration if attempt remains, otherwise fallback response |
| `error` | Product-policy violation | Reject; corrective regeneration if attempt remains, otherwise fallback response |
| `warning` | Non-blocking diagnostic or quality concern | Display only if all hard gates pass; record locally |

## 3. Violation codes

| Code | Default severity | Meaning |
|---|---|---|
| `teacher_mode` | error | Unrequested lesson, quiz, correction, or instructional framing |
| `automatic_gloss` | error | Automatic Chinese gloss/translation attached to an English chunk |
| `translation_mode` | error | User message translated/restated instead of answered without an explicit request |
| `full_english_takeover_before_ready` | error | Effective Level does not allow the English coverage used |
| `excessive_new_content` | error | New learning focuses exceed the current policy |
| `invalid_phrase_id` | fatal | English segment references an unknown or unselected Phrase |
| `broken_structured_output` | fatal | Schema invalid, missing fields, empty segments, or invariant mismatch |
| `internal_prompt_leak` | fatal | Internal prompts, policies, hidden state, or validator instructions are exposed |
| `unsolicited_pronunciation` | error | Unrequested phonetics or pronunciation instruction |
| `unsolicited_definition` | error | Unrequested dictionary-style definition or vocabulary teaching |
| `conversation_function_changed` | error | Response no longer performs the selected function |
| `unnatural_overlay` | error | English insertion makes the response unnatural or contextually inappropriate |
| `overlay_budget_exceeded` | error | English coverage/frequency exceeds the Effective Level and function budget |
| `invalid_no_fit` | error | `noFit` conflicts with segments or a clearly invalid scheduling state |
| `unselected_phrase_used` | fatal | English overlay uses a phrase not approved by the candidate selector |
| `unsafe_content` | fatal | Provider or application safety policy blocks the response |

## 4. Deterministic hard validation

Hard validation checks:

- the Zod schema and schema version;
- non-empty ordered Semantic Segments;
- valid Phrase IDs and exact `usedPhraseIds` correspondence;
- selected Phrase membership;
- overlay budget and new-focus count;
- cooldown and Effective Level constraints;
- `noFit` invariants;
- automatic Chinese gloss patterns tied to English chunks;
- unsolicited pronunciation/phonetic content;
- obvious Teacher Mode markers;
- premature full-English takeover;
- internal prompt or policy leakage markers;
- Conversation Function equality with the request directive;
- provider fallback response shape.

Hard validation must be deterministic for the same input, policy version, phrase registry, and generated response.

## 5. Optional model-based soft validation

Use soft validation only when needed to judge:

- whether the English insertion is natural;
- whether the reply genuinely responds to the user;
- whether tone fits the current context;
- whether an implicit translation pattern exists;
- whether subtle Teacher Mode behavior escaped hard rules.

The soft validator receives no API keys and returns only normalized findings. It is not the sole authority for schema, IDs, budgets, or progression.

## 6. Retry policy

- Attempt 1: normal generation.
- On retryable validation failure: Attempt 2 receives the violation codes and a corrective directive; it regenerates the complete response.
- No third generation attempt is allowed by `eoe.validation.v1`.
- Transport retries that did not reach provider inference may follow the Provider Policy, but the user-visible generation-attempt count remains bounded and recorded.

## 7. Final fallback response

After the second failed generation:

- return a natural, safe, Chinese-first response that addresses the user's intent;
- use no English overlay and no instructional explanation;
- do not disclose validation details;
- mark the `GenerationAttempt` as failed/fallback locally;
- record violations, provider, latency, retry, and fallback status in Developer Telemetry.

Provider fallback and response fallback are distinct: a fallback provider may still produce a fully validated response, while a fallback response is used only after accepted generation fails.

## 8. Versioning

Violation meanings, severity, attempt limits, fallback behavior, and hard/soft classification are policy-controlled. Any behavioral change requires a new validation policy version.
