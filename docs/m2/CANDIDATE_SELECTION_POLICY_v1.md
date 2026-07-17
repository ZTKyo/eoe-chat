# Candidate Selection Policy v1

- Selector version: `eoe.selector.v1`

## Deterministic pipeline

1. Filter active phrases at or below Effective Level.
2. Require Conversation Function compatibility.
3. Require compatible tone and plausible semantic/context role.
4. Remove phrases still in cooldown.
5. Prefer recently exposed phrases when natural reuse is valuable.
6. Score frequency, reuse value, difficulty fit, function fit, semantic fit, and reuse.
7. Sort deterministically and return up to five natural candidates.
8. Select the highest ranked eligible phrase for the Directive.
9. Allow the pool to be empty and return `noFit: true`.

Keyword overlap is only a small semantic signal; it cannot bypass function, tone, level, cooldown, or naturalness gates. The Provider never receives authority to invent or choose a Phrase ID.
