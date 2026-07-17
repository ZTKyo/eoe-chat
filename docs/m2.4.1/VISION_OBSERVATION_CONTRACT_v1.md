# Vision Observation Contract v1

`VisionObservationEnvelopeV1` has schema version `eoe.vision-observation.v1`, one or more observations with `high|medium|low` confidence, visible text, and uncertainties.

The Vision Provider may not emit Phrase state, Conversation Function, or Domain Segments. The Engine validates and persists the observation before final answer generation. The final answer receives only the user's request, validated observation data, uncertainty, and Response Obligations, and must visibly ground at least one claim in that data.

M2.4.1 uses at most two Provider calls for an image turn: one GLM-4.6V observation call and one grounded final-answer call. Observation data remains developer-only and never appears as an internal DTO in the ordinary UI.
