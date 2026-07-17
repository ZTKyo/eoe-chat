# M2.4 Acceptance Criteria

Final status: `M2_4_STOPPED_WITH_BLOCKERS`

Status is synchronized only from real evidence. Independent human gates remain unchecked until an independent reviewer completes them. Local automation never overrides the supplied human verdict.

## Product and architecture

- [x] Product Constitution is enforced and tested.
- [x] Task Completeness is independent of Overlay/noFit.
- [x] Provider cannot own Response Obligations or Phrase/control state.
- [x] Fixed Progression Level remains unchanged; Adaptive Progression is off.

Evidence: Constitution, domain-schema, directive, task-completeness, Engine, and Provider Template tests passed in the final 290-test local suite. No Adaptive Progression code or state transition was added.

## Behaviour

- [ ] Plans, comparisons, image analysis, technical explanation, and clarification meet their minimum obligations.
- [x] Phrase v2 metadata and unsafe-pattern regressions pass.
- [ ] noFit decision source and reason are accurate.
- [ ] Vocabulary Assistance uses real source context and returns to the topic.
- [ ] Eight true multi-turn scenarios pass.

Evidence: Phrase v2 schema/realization regressions passed locally. The real Probe failed plan, image, and multi-turn Assistance cases; expected-English cases also produced excessive/fallback noFit. Therefore the broader product-behaviour items remain unchecked despite local Mock/E2E passes.

## Evidence

- [ ] All no-quota commands exit 0.
- [ ] Eight-case real Provider Probe passes without Natural Fallback.
- [ ] Core20, Opportunity12, and Multi-Turn8 execute within budget.
- [ ] Four privacy-free image fixtures provide actual pixel evidence.
- [x] Desktop and 390×844 mobile regression pass.
- [ ] Security and secret scans pass; `.env.local` remains ignored/untracked.

Evidence: quality-gate commands passed, including 22/22 E2E, but `npm audit` exited 1 with two moderate no-fix PostCSS advisories. Secret/privacy scans themselves found zero leaks. The Probe passed only 3/8 with four Natural Fallbacks and intentionally stopped before the full corpora and remaining image cases.

## Independent review

- [ ] Independent reviewer finds zero major task-completeness failures.
- [ ] Independent reviewer accepts at least 80% of displayed English Chunks.
- [ ] Independent reviewer finds zero task replacement, label overlay, or duplicate translation.
- [ ] Independent reviewer confirms over-conservative noFit is materially reduced without forced Overlay.

No M2.4 review package was generated because the technical Live Probe did not pass. Codex has not checked or self-approved any independent-review item.
