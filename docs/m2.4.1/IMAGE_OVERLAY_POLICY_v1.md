# Image Overlay Policy v1

For M2.4.1 and early M3, automatic English Overlay is disabled on image turns.

- Scheduler mode is `disabled_for_image`.
- Conversation analysis and Task Completeness still run.
- Vision Observation grounding and the final answer are persisted.
- Candidate selection is not run and no automatic English Chunk is generated.
- noFit source and reason are `image_overlay_deferred` unless an explicit Chinese request requires `explicit_chinese_request`.
- `image_overlay_deferred` is a policy result, not a naturalness failure.
- Image answers must cite visible evidence, answer the image question, separate observation from inference, and state uncertainty without invention.
- An explicit user request for an English image answer controls the task language; it is not automatic Overlay.

Image Overlay is a later optional extension and is not an M3 entry requirement.
