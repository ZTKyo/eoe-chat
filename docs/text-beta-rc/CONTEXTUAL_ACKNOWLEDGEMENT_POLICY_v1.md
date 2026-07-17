# Contextual Acknowledgement Policy v1

Version: `text-beta-rc.context-ack.v1`

When an existing conversation’s latest user turn is exactly `好`, `好的`, `嗯`, `哦`, `明白了`, or `可以` (with optional terminal punctuation), the Engine records a contextual acknowledgement.

Rules:

1. Preserve the latest real user topic.
2. Reply briefly.
3. Advance only when the prior task naturally requires a next step.
4. Skip automatic English Overlay.
5. Do not greet, ask what the user wants to discuss, or otherwise reset the conversation.

An identical token with no prior history remains an ordinary first-turn input and is not forced into this policy.

`context_reset_after_acknowledgement` is a Hard violation. Corpus IDs are never used in product logic.

