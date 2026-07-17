# M2 Validator Rules v1

- Validator version: `eoe.validator.v1`

The deterministic Hard Validator runs before display and checks:

- `broken_structured_output`
- `invalid_phrase_id`
- `phrase_not_selected`
- `excessive_new_content`
- `overlay_budget_exceeded`
- `full_english_takeover_before_ready`
- `automatic_gloss`
- `unsolicited_pronunciation`
- `unsolicited_definition`
- `teacher_mode`
- `translation_mode`
- `internal_prompt_leak`
- `conversation_function_changed`
- `empty_response`
- `duplicate_segment`
- `invalid_language_tag`
- `low_naturalness_confidence`

Errors block display. Warnings are recorded but do not bypass an error. A failure is retryable only while the two-attempt budget remains. Attempt 2 regenerates the full response; no string replacement is used to repair Provider output.

If both attempts fail, the engine emits a separately constructed, schema-valid, Chinese-dominant natural fallback with `noFit: true`, validates it, and records both failed attempts. Provider fallback and Validator retry remain separate diagnostic concepts.

A Soft Validator interface is reserved but disabled by default. It may later be invoked only for low naturalness confidence, uncertain function classification, ambiguous hidden Teacher Mode, or benchmark development.
