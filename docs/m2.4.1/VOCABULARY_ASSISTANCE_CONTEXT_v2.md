# Vocabulary Assistance Context v2

The Engine owns `sourceMessageId`, source segment index, Phrase ID and canonical surface, full source sentence, Registry pronunciation, previous user message, topic summary, and assistance type.

The Provider returns only `eoe.assistance-content.v2`: contextual meaning, optional short example, and topic continuation. It may not rewrite the source sentence or Phrase, invent pronunciation, deny resolved history, create exercises, or enter Teacher Mode.

The Engine deterministically assembles semantic segments in this order: full source sentence; Phrase and pronunciation; contextual meaning; optional example; topic continuation.

After two invalid Provider attempts, an Engine-owned Assistance fallback uses Registry pronunciation, base Chinese meaning, optional example, and topic context. It records `assistanceContentFallback=true`, remains usable, and does not count as a Provider Assistance Probe pass.
