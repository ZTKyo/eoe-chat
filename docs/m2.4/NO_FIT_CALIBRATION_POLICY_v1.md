# noFit Calibration Policy v1

`noFit` controls only English Overlay. It never reduces the answer, changes the task, or substitutes for Task Completeness.

Decision source is recorded as one of: `scheduler_no_fit`, `selector_no_candidate`, `provider_phrase_rejected`, `high_stakes_no_fit`, `explicit_chinese_no_fit`, `short_turn_no_fit`, or `contextual_no_fit`.

The reason must reflect the actual decision, including technical complexity or absence of a safe candidate. `conversation_too_short` must not be used for a substantive technical question. Users who naturally use English receive a genuine reuse evaluation, but reuse is never forced and does not increase the fixed level.

There is no target English rate and no maximum noFit ratio. Calibration is judged by missed obvious opportunities and forced awkward insertions.
