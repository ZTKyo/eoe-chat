# Text Beta RC Authoritative Human Review Input

## Authority and provenance

These two completed independent-review files are the authoritative product-quality input for Text Beta RC:

1. `M2_TEXT_BETA_INDEPENDENT_MANUAL_REVIEW_RESULT.md`
   - Source: user-provided file in Downloads
   - SHA-256: `aef797f113d65f719d63b3949803e3d5da5c6910463a3b64bf6ec94c44b00f40`
2. `M2_TEXT_BETA_INDEPENDENT_REVIEW_CHECKLIST_COMPLETED.md`
   - Source: user-provided file in Downloads
   - SHA-256: `3ec14073fa9e669b00d3ff8eefbb8bc5ad4df0804306db4a48e3f94c4447ac16`

Both files were read completely before implementation. They remain unmodified. Their product-quality conclusions take precedence over MockProvider, automatic naturalness scores, and historical Validator PASS results.

## Authoritative verdict

`M2_TEXT_BETA_HUMAN_REVIEW_FAIL`

This verdict does not rewrite the frozen technical history:

- Technical status: `M2_TEXT_BETA_STOPPED_WITH_BLOCKERS`
- Frozen complete Corpus: 35/39
- M2.5.1 Targeted Gate: 3/4
- M3: `BLOCKED`
- Adaptive Progression: `DISABLED`
- Image: `DEFERRED_EXPERIMENTAL_FEATURE`
- Everyday personal Beta: not approved
- Deployment: not approved
- Permitted use before recalibration: internal preview only

## Authoritative English Overlay findings

The reviewer assessed all 21 displayed English Chunk cases:

- Broadly acceptable or acceptable with a minor note: 11/21
- Unacceptable or clearly awkward: 10/21

The dominant systemic failure is automatic `a little` insertion into Chinese adjective, comparative, or predicate slots:

- `心情 a little 更舒畅`
- `灵活度 a little 更高`
- `比预期 a little 繁琐`
- `进度 a little 慢`
- `实现得 a little 更顺利`

Other rejected patterns include:

- `下周的学习计划，for now，建议……`
- a broken conditional use of `a little`
- redundant `for example` after Chinese has already introduced an example
- English that reads as a label rather than a sentence-level discourse element

The completed checklist did not approve Phrase naturalness, label-free insertion, uninterrupted thought, level fit, or noFit as sufficient protection.

## Authoritative ordinary-assistant failures

### TypeScript fallback

The rejected Provider answer correctly explained `unknown` and `any`, but the displayed generic fallback did not answer the user. The false positive is therefore a real user-facing failure, not merely an invisible test limitation.

### Detailed analysis

`core-long-analysis` did not meaningfully explain relationships among user problem, competition, delivery cost, and long-term maintenance. Length alone was not sufficient.

### English difficulty

After `英语有点难`, the response became disconnected from the preceding topic. The correct behavior is to reduce Overlay density and continue the real conversation.

### Unsupported quantitative claims

`multi-chinese-scope` asserted unsupported cost proportions of 55%, 25%, and 20%, plus an unsupported claim about steel price impact. This is a serious reliability failure.

### Context reset

Minimal acknowledgements such as `好` and `哦` reset the conversation with a fresh greeting instead of preserving context.

### Weak comparison and condition answers

The conditional-choice response was grammatically broken and did not cover the user’s real trade-offs. The simple-comparison response was shallow and included a questionable unsupported claim.

## Authoritative noFit findings

Most noFit decisions were appropriate for emotional, medical, legal, explicit-Chinese, minimal-turn, and technical-deployment contexts. noFit policy is not the primary blocker. Surface answer quality remains the blocker.

## Authoritative Vocabulary Assistance findings

Strengths:

- Correct source-sentence resolution
- Correct Phrase resolution
- Registry-backed IPA
- Explicit assistance triggers
- Engine-owned ambiguity resolution before Assistance

Required calibration:

- Reduce rigid `原句 / 短语 / 在这里 / 继续原来的话题` presentation
- Pronunciation-only requests should not automatically receive long meanings and examples
- Replace `Let's wait for now.` with an idiomatic example such as `For now, let's wait.`
- Topic continuation must be specific to the real preceding conversation

## Authoritative UI evidence boundary

Functional evidence was strong:

- Desktop and 390×844 E2E: 22/22
- Mock Live Requests: 0
- Image entry hidden
- Developer Panel hidden
- PWA and build paths passed

The prior submitted ZIP did not embed the referenced screenshots, so the independent reviewer did not approve visual styling or English Chunk subtlety.

## Required focused closure

The authoritative review requires a bounded release-quality calibration:

1. Remove `p-a-little` from automatic Live-Safe use while preserving user reuse and Assistance.
2. Constrain automatic Phrase use to safe bilingual sentence frames.
3. Separate Hard Validation from Soft Quality Review.
4. Never replace a substantively complete Hard-Valid technical answer with a generic fallback because of a soft matcher warning.
5. Preserve context for `好` and `哦`.
6. Detect unsupported precise numerical claims.
7. Enforce relationship-based obligations for explicitly detailed analysis.
8. Reduce Overlay after an English-difficulty signal and continue the actual topic.
9. Keep Vocabulary Assistance lightweight and topic-specific.
10. Run a smaller representative real Release Corpus and submit every displayed response.

## Completed checklist facts

The reviewer selected:

- No systematic repeated Chinese translation in ordinary replies
- Vocabulary Assistance source sentence, pronunciation, concise explanation, attempted topic resume, and explicit trigger
- Deployment remains blocked
- A Beta/internal-preview label is required during further testing
- Final conclusion: `M2_TEXT_BETA_HUMAN_REVIEW_FAIL`

The reviewer did not approve:

- Consistent task completion, actionability, displayed technical correctness, context coherence, or absence of template filler
- Consistent natural Overlay
- The current Validator limitation
- Natural Fallback as consistently useful
- Everyday personal use

## RC boundary

This document records facts and required outcomes. It does not pre-approve Text Beta RC, alter frozen historical results, start M3, enable Adaptive Progression, or restore image input.
