# Conversation Functions v1

- Taxonomy version: `eoe.conversation-functions.v1`
- Status: Frozen for M1; implemented in M2

## 1. Decision order

For every user turn, the engine must:

1. determine what the user is actually trying to accomplish;
2. select the primary Conversation Function;
3. determine tone, response length, and content requirements;
4. only then decide whether an English Overlay fits.

The assistant must respond to the user. It must not translate, restate, or imitate the user's message as a substitute for a real response unless translation was explicitly requested.

## 2. Initial taxonomy

| Function | Purpose | Default tone/length | Overlay budget multiplier | noFit guidance |
|---|---|---|---:|---|
| `answer` | Give a direct answer to a question | Direct; proportional to question | 1.0 | Allowed whenever clarity would suffer |
| `react` | Respond naturally to news, opinions, or casual sharing | Brief and conversational | 0.5 | Common for very short reactions |
| `empathize` | Acknowledge emotion and provide human support | Warm, restrained, not clinical | 0.25 | Strongly preferred when English would feel distancing |
| `advise` | Offer actionable recommendations | Supportive and structured | 0.75 | Allowed for sensitive or complex advice |
| `explain` | Make a concept understandable | Clear, layered, context-aware | 0.75 | Allowed when terminology is already difficult |
| `clarify` | Resolve ambiguity or request essential details | Short and precise | 0.5 | Common if overlay adds ambiguity |
| `ask_follow_up` | Continue the conversation with a useful question | Usually one focused question | 0.5 | Allowed for intimate or delicate questions |
| `summarize` | Condense supplied content faithfully | Neutral and concise | 0.75 | Allowed when source fidelity is primary |
| `analyze_image` | Answer using uploaded visual content | Evidence-based; mention uncertainty | 0.75 | Allowed when visual details are complex |
| `complete_task` | Produce the requested artifact, transformation, or action result | Format dictated by task | 0.5 | Preferred when overlay could corrupt required output |

The multiplier scales the current Progression Policy budget; it does not create a minimum amount of English.

## 3. Selection rules

- Select one primary function for policy and telemetry.
- Secondary conversational qualities may be recorded internally, but they must not complicate the initial taxonomy.
- Explicit task verbs and requested output formats take precedence over conversational style.
- `analyze_image` requires at least one valid image attachment routed to a vision-capable provider.
- `complete_task` protects required output formats such as code, data, names, quotations, and exact transformations from overlay modification.

## 4. Naturalness rules

- Emotional, comforting, serious, urgent, and safety-sensitive topics must remain natural even if that means `noFit`.
- Candidate selection must account for function, tone, response length, and context.
- An English insertion must not change the selected Conversation Function.
- The engine must not turn `answer` into translation, `empathize` into a lesson, or `complete_task` into commentary about vocabulary.

## 5. Translation boundary

Translation is a user-requested task behavior, not a default Conversation Function. When the user explicitly asks for translation, the primary function is normally `complete_task` or `explain`, and the translated content is task output rather than an EOE learning overlay.

## 6. Versioning

Adding, removing, splitting, or changing the behavioral meaning of a function requires a new taxonomy version and corresponding policy/validator compatibility review.
