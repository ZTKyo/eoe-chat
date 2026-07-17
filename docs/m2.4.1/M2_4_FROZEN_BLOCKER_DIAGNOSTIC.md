# Frozen M2.4 Blocker Diagnostic

Source commit: `1ffd8be`; run: `m2-4-2026-07-17T01-41-31-965Z`.

The frozen M2.4 artifacts retained final texts, per-case attempt counts, usage, missing obligations, and final fallback state. They did not retain each Provider attempt's raw response Template. Those missing historical strings cannot be reconstructed and are not invented here.

## Image Chinese-only Probe

- Fixture facts: visible title `Control Panel`, a `Start` button, a disabled-looking `Stop` button, and a partly obscured `Status: ready?` line.
- Both Provider attempts failed `image_analysis_missing_visible_evidence`; the preserved final text was the generic Natural Fallback and contained none of those fixture facts.
- Because raw attempt texts were not retained, frozen evidence cannot distinguish “no observation” from “observation paraphrased beyond the old fixed-keyword detector”. This uncertainty is the reason M2.4.1 adds a validated Observation Envelope rather than relaxing the old Validator.
- The old retry code asked for visible evidence but supplied no Engine-owned grounding facts.

## Plan Probe

- Both attempts failed `plan_missing_time_or_stage`.
- The preserved final Natural Fallback had only a generic first step; it had no weekly timeline, stages, task allocation, or feedback loop.
- The original request explicitly required time, tasks, priority, and review. M2.4.1 therefore derives exact proportional PlanRequirements and exact retry codes.

## Assistance and reuse

- Assistance resolved the source Phrase in Engine diagnostics but both generated answers omitted source sentence/pronunciation/topic continuation and entered ordinary Natural Fallback.
- `I think` was selected and diagnosed as a reuse opportunity, but two invalid generated Templates ended in Natural Fallback. M2.4.1 separates exact detection from optional realization and accepts a justified noFit without an empty candidate pool.
