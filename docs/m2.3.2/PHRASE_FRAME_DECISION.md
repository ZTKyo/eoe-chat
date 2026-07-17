# M2.3.2 Phrase Frame Decision

Status: **DIRECTION_A_SELECTED**

## Decision

Use **Direction A — safe Phrase realization**.

`p-in-the-long-run` is semantically appropriate in a long analysis and can be naturally realized at sentence start or as a punctuation-delimited middle adverbial. The two fixtures do not justify globally disabling the Phrase or removing `sentence_middle`.

## Minimal general repair

1. Replace the single narrow/whitespace-dependent bilingual pattern with concise reusable frames that put explicit compatible punctuation after the Phrase.
2. Make the generic boundary retry correction require the Provider to preserve the placeholder-adjacent punctuation/space from a selected safe frame.
3. If a fresh natural answer cannot preserve that boundary, require the Provider itself to return a complete strict `usePhrase=false` Template with `noFitReason=grammar_mismatch`.
4. Do not change Candidate selection, Parser, Mapper, Domain schema, Template Validator, Domain Validator, or Naturalness thresholds.

The valid Provider noFit path is a permitted retry outcome, not a post-validation conversion. The Engine will not rewrite a failed response.

## Live confirmation

The authorized M2.3.2 run confirmed the repair path without weakening the gate. DeepSeek Attempt 1 still produced `template_boundary_invalid`; Attempt 2 followed the violation-specific instruction, regenerated the whole Template, and produced a punctuation-delimited `in the long run` segment that passed Template Validator, Mapper, Domain Schema, Domain Validator, and live Naturalness review. The affected case therefore passed without Natural Fallback, and the original DeepSeek Corpus reached 9/9.

## Rejected alternatives

- Direction B as the primary policy: rejected because the Phrase is not inherently incompatible with the topic or allowed position.
- Removing `sentence_middle`: rejected because punctuation-delimited middle use is grammatical.
- Automatic punctuation insertion: prohibited and unnecessary.
- Validator relaxation: contradicted by the visible invalid projection.
