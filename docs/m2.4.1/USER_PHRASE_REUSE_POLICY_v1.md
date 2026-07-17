# User Phrase Reuse Policy v1

The Engine detects only exact Registry canonical surfaces and normalized variants, with case, apostrophe, whitespace, and common punctuation normalization. It does not infer arbitrary English semantics.

A match records Phrase ID, matched text, confidence, and `exact|normalized_variant`. A compatible Live-Safe match is ranked before ordinary candidates and bypasses cooldown, but never bypasses high-risk context, explicit Chinese-only scope, grammar compatibility, Task Completeness, or naturalness validation.

Natural reuse is optional. The Provider may return an accurate noFit when repetition would be awkward. User English never triggers correction, automatic explanation, a second new Phrase, increased density, or an all-English response.
