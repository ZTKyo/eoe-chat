# Technical Segment Classification v1

## Semantic roles

- `code_identifier`: identifiers, type names, keywords, property names, CLI flags, and code spans such as `unknown`, `any`, `typeof`, `Promise<T>`, or `response.status`.
- `technical_term`: product, protocol, language, API, framework, and technical-domain names such as TypeScript or HTTP.
- `english_overlay`: an Engine-selected Registry Phrase represented by `english_chunk`.
- `vocabulary_assistance`: user-requested help tied to a resolved Registry Phrase.
- `unsolicited_teaching`: unrequested gloss, pronunciation drill, vocabulary definition, quiz, or Teacher Mode.

## Validator scope

Phrase ID, Phrase boundary, Phrase position, Overlay budget, direct-translation, and Overlay naturalness rules apply to semantic `english_chunk` segments. Vocabulary Assistance rules apply only to explicit Assistance segments and context. Teaching-language rules apply to `unsolicited_teaching`.

They do not apply merely because a Chinese technical explanation contains Latin-script identifiers or technical terms in a normal text segment.

Technical content remains subject to:

- structured response parsing;
- conversation-function preservation;
- task completeness;
- internal prompt leak;
- HTML and schema restrictions;
- ordinary safety and correctness.

The distinction does not exempt an actual selected English Overlay from Overlay validation, and it does not permit unsolicited teaching around a technical word.

## TypeScript distinction requirement

When the user explicitly asks for the difference between TypeScript `unknown` and `any`, a complete answer must contain substantive evidence that:

- `any` permits use without normal type checking; and
- `unknown` requires narrowing, a guard, assertion, or equivalent validation before use.

This is a domain-specific correctness check derived from the user's named concepts, not a hard-coded corpus ID or fixed answer.
