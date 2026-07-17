# Template Validation Policy v1

Status: **Normative for M2.3**  
Policy version: `eoe.template-validator.v1`

## Validation layers

M2.3 keeps the validator strict. Passing one layer does not bypass later layers.

1. **Raw parse:** strict JSON object, exact schema version, known enum values, no additional properties.
2. **Template contract:** placeholder/usePhrase/noFit invariants.
3. **Template safety:** markdown, HTML, label, translation, teaching, and prompt-leak checks.
4. **Realization boundary:** allowed position, punctuation, connectors, and isolated-placeholder checks.
5. **Engine mapping:** deterministic substitution and semantic segment construction.
6. **Domain hard validation:** budgets, selected Phrase provenance, Chinese-dominant response, duplicate segments, internal state, and other M2/M2.1 safeguards.
7. **Deterministic naturalness review:** existing naturalness gate over the mapped Domain response.

The Provider does not self-report `intentPreserved` or naturalness confidence. Such self-reports cannot satisfy any validation layer.

## Required violation codes

- `provider_template_parse_failed`
- `missing_placeholder`
- `duplicate_placeholder`
- `unexpected_placeholder`
- `use_phrase_conflict`
- `missing_no_fit_reason`
- `unexpected_no_fit_reason`
- `empty_response_template`
- `markdown_wrapped_template`
- `html_in_template`
- `template_label_like_overlay`
- `template_isolated_placeholder`
- `template_colon_explanation`
- `template_translation_duplication`
- `template_position_violation`
- `template_punctuation_violation`
- `template_boundary_invalid`
- `template_full_english_takeover`
- `template_teacher_mode`
- `template_internal_prompt_leak`

Parsers may add narrower diagnostics, but externally reported M2.3 failures map to the codes above.

## Deterministic rules

### Parse and structure

- Reject malformed JSON, arrays, `null`, primitive values, and prose around JSON.
- Reject markdown-fenced JSON.
- Reject missing required properties and all additional properties.
- Reject any schema version other than `eoe.provider-template.v1`.
- Reject empty or whitespace-only `responseTemplate`.

### Phrase-use invariants

- `usePhrase: true`: exactly one exact placeholder and no `noFitReason`.
- `usePhrase: false`: zero placeholders and a supported `noFitReason`.
- Any brace token resembling an EOE placeholder but not exactly matching is `unexpected_placeholder`.
- Literal output of the selected phrase in addition to the placeholder is a translation/duplication risk and is rejected.

### Safety

- Reject HTML tags and markdown wrappers.
- Reject glossary, pronunciation, definition, “英文表达/英语表达/意思是/读作” and comparable teacher-mode patterns around the placeholder.
- Reject disclosure of prompts, policy, candidates, Phrase IDs, schema mechanics, or internal instructions.
- Reject a response that is English-dominant before the configured level permits it.

### Natural boundaries

- Reject a placeholder that is the entire response, heading, block quote, list item, parenthetical aside, or detached label value.
- Reject `标签：{{EOE_PHRASE}}` and `{{EOE_PHRASE}}：解释` patterns.
- Compute sentence position from non-whitespace text before/after the placeholder and compare it with the selected Phrase's profile.
- Enforce the profile's punctuation and Chinese-connector restrictions.
- Require visible natural-language content beyond the placeholder unless `canBeWholeClause` explicitly permits a whole clause and Domain validation also passes.

## Retry

Template violations are returned to the Engine as normalized codes. Attempt 2 contains only the relevant correction guidance and requests a full regeneration. The Engine never patches the raw template or switches Provider solely because validation failed. A second failure produces the existing Chinese-dominant Natural Fallback with `noFit: true`.

## Valid boundary examples

- Start: `{{EOE_PHRASE}}，我们先核对最关键的前提。`
- Middle: `这个方向 {{EOE_PHRASE}}，接下来只要确认时间安排。`
- End: `我们先完成可逆的步骤，再观察结果，{{EOE_PHRASE}}。` only when the selected profile permits sentence end and the surrounding grammar is valid.

## Invalid boundary examples

- Isolated: `{{EOE_PHRASE}}`
- Label: `推荐表达：{{EOE_PHRASE}}`
- Colon explanation: `{{EOE_PHRASE}}：这是今天要学的短语。`
- Automatic gloss: `{{EOE_PHRASE}}（意思是先这样）`
- Duplicate translation: `{{EOE_PHRASE}}，也就是“暂时”。`
- Bad punctuation: `我们可以，{{EOE_PHRASE}}。` when the profile forbids a comma immediately before it.
- Wrong position: a sentence-end placeholder for a start/middle-only profile.
