# Task Completeness Contract v1

Task Completeness is independent of English Overlay. `usePhrase=false` or `noFit=true` never excuses an incomplete answer.

## Engine-owned obligations

For every turn, the Engine derives a small set of immutable `ResponseObligation` records from the user's request, attachments, Conversation Function, and real message history. Supported kinds are: `answer_question`, `provide_reasons`, `provide_steps`, `provide_plan`, `compare_options`, `analyze_image`, `explain_concept`, `acknowledge_emotion`, `respect_language_request`, `clarify_prior_phrase`, `continue_context`, and `other`.

The Provider receives these obligations as answer requirements but cannot return, rename, or redefine them. It must complete the task first and may realize the Engine-selected Phrase only if doing so does not weaken the task.

## Minimum evidence

- Plans: time or stages, task allocation, priorities, a minimum action, and an adjustment or feedback loop.
- Comparisons: comparison dimensions, a recording method, trade-off method, reversible trial, and next action.
- Image analysis: at least one verifiable visible observation, with observations separated from inference and uncertainty.
- Technical explanations: an actual cause or mechanism, not only generic advice.
- Phrase clarification: an actual prior English Chunk or a short ambiguity question grounded in history.

## Review

`TaskCompletenessReview` returns only `accept` or `regenerate`. It never returns `use_no_fit`. Deterministic checks run for all turns; a soft review may be requested only for image analysis, explicit plans/comparisons/long analysis, Vocabulary Assistance, multi-turn clarification, uncertain deterministic results, or benchmark/developer mode. A soft review cannot rewrite the answer.

Task-incomplete output is retried as a complete response. Natural Fallback is failure evidence, not proof of task completion.
