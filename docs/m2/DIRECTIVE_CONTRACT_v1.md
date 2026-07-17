# Per-turn Directive Contract v1

- Directive version: `eoe.directive.v1`

Each generation attempt receives a compact directive containing the standardized Conversation Analysis, fixed/effective levels, scheduler decision, selected phrase plus current candidates, recent exposure IDs, forbidden behavior, and the `eoe.response.v2` output shape.

The Directive requires the Provider to:

- answer the user's actual request naturally first;
- keep Chinese as the main carrier at the current level;
- use only the engine-selected phrase, and only when it fits naturally;
- return `noFit: true` when it does not fit;
- never translate the user, explain the English, add pronunciation/definitions, enter Teacher Mode, or expose internal rules;
- return JSON only, without HTML or Markdown fences.

Attempt 2 also carries the exact violation codes from Attempt 1 and requests a complete regeneration. The Directive never contains the full Phrase Registry.
