# Phrase Registry Design

- Registry version: `eoe.phrases.v1`
- Initial scope: 50 curated reusable Semantic Chunks

Each record contains stable identity, canonical text, variants, level/difficulty, frequency and reuse scores, compatible Conversation Functions and tones, semantic/context hints, cooldown, status, and registry version.

Naturalness is enforced before ranking: disabled phrases, phrases above Effective Level, phrases incompatible with the Conversation Function/tone, and phrases without a plausible contextual role never enter the candidate pool. The initial registry favors everyday connective and stance chunks rather than advanced-looking expressions.

The registry is source-controlled and deterministic. Provider prompts receive only the current 3–5 candidates and selected phrase, never the complete registry. Phrase IDs are engine-owned; Provider output can only reference the engine-selected ID.

Initial categories include stance, reaction, explanation, advice/action, qualification, time/sequence, comparison/contrast, caution, and planning. M2 records exposure but does not infer mastery.
