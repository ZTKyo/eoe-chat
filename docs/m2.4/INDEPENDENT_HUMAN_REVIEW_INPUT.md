# Independent Human Review Input

Status: authoritative M2.4 product input
Source: `M2_INDEPENDENT_HUMAN_REVIEW_RESULT.md` and `REVIEW_CHECKLIST_COMPLETED.md` supplied by the independent reviewer

Automated tests, MockProvider output, deterministic Validator results, and Codex-generated naturalness scores do not override the findings below.

## Fixed findings

1. Technical structure passing is not product-naturalness passing.
2. The 20-case Live Corpus displayed 5 English Chunks and returned Provider `noFit` in 15 cases.
3. Of the displayed chunks, `p-in-the-long-run` was broadly acceptable but had capitalization and position-metadata defects.
4. `p-maybe` in “这里 maybe 还缺一个前提” was unnatural and disconnected from the answer's main logic.
5. Both `p-step-by-step` realizations were unacceptable: “按 step by step 的节奏” was unnatural, and sentence-initial `step by step` behaved like a label.
6. `p-take-a-closer-look` replaced rather than introduced image analysis; the response did not analyze visible image content.
7. Major task-completeness failures included: no real weekly study plan, no usable comparison method, no image-content analysis, and an unsupported denial that no earlier English phrase existed.
8. `noFit` was clearly over-conservative for weekend relaxation, remote-work opinion, household budgeting, and the user's natural use of “I think”.
9. `noFit` was broadly appropriate for emotional, medical, legal, and explicit Chinese-only scenarios.
10. The Mock “Naturalness Benchmark” was only a structural regression baseline: repeated generic responses, unnatural text still marked `natural=true`, and repeated confidence `0.96` cannot establish product naturalness.
11. Only one of the five English Chunks was clearly acceptable; one had a minor defect; three were unacceptable or replaced the task.
12. Aggregate independent review: 14/20 cases were acceptable without a major failure; 6/20 had major failures.
13. Multi-turn Vocabulary Assistance, clarification, and phrase reuse require real message history and cannot be represented as single-turn prompts.
14. M3 and Adaptive Progression remain blocked.

## Required refinements

- Rebuild Live-Safe v2 around simpler high-frequency candidates such as `I think`, `it depends`, `that makes sense`, `for example`, `a little`, `kind of`, and `for now`; reduce reliance on `step by step`.
- Prohibit the observed unsafe `maybe` and `step by step` frames. `take a closer look` may introduce but never replace analysis. Correct sentence-start capitalization and position metadata for `in the long run`.
- Add an Engine-owned Task Completeness layer independent of Overlay/noFit.
- Require actual plan structure, actionable comparison, visible image evidence, and history-grounded phrase clarification.
- Rename/downgrade the Mock benchmark to structural evidence and exclude it from human naturalness, phrase activation, comprehension, and progression evidence.
- Add true multi-turn vocabulary, pronunciation, clarification, reuse, difficulty, Chinese-only scope, resume, and ambiguity scenarios.

## Exit constraint

Codex may prepare technical evidence but may not declare independent human naturalness success. The highest successful M2.4 technical state is `M2_4_READY_FOR_INDEPENDENT_HUMAN_REVIEW`.
