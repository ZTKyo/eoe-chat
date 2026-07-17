# Scheduler Policy v1

- Policy version: `eoe.scheduler.v1`

The scheduler runs after Conversation Analysis and before Candidate Selection.

## Defaults

- Fixed Level: environment-configured, default 2
- Maximum new focus: 1
- Maximum English segments: 1
- Reuse preferred: true
- Ordinary substantive responses: `preferred`
- Disabled engine, unsuitable context, or extremely short response: `skip`

## Effective Level reductions

- emotional: reduce by one level and lower suitability
- high-stakes: reduce to Level 1 and prefer clarity
- technical/complex long answer: reduce by one level when needed
- image analysis: reduce by one level when the visual request is complex
- user signals non-understanding or explicitly asks for Chinese: reduce to Level 1 and normally skip
- short reply or no natural insertion position: skip

The decision is deterministic for the same normalized input and configuration. It never changes the fixed long-term level. Candidate count is filled after selection for diagnostics; the scheduling decision itself precedes selection.
