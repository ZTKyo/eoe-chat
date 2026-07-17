# Beta Bilingual Frame Policy v1

Version: `text-beta-rc.frame.v1`

## Eligibility

Automatic English Chunks may use only these frame types:

1. `standalone_reaction`
2. `sentence_initial_connector`
3. `english_clause_stem`
4. `user_phrase_reuse`

Automatic use must start at the beginning of the response or after a complete sentence boundary. It must not occupy a Chinese internal grammar slot.

## Profile contract

```ts
type BetaBilingualFrameProfile = {
  phraseId: string;
  autoLiveSafe: boolean;
  allowedFrameTypes: Array<
    | "standalone_reaction"
    | "sentence_initial_connector"
    | "english_clause_stem"
    | "user_phrase_reuse"
  >;
  allowedFrames: string[];
  forbiddenFrames: string[];
  requiresFollowingClause: boolean;
  capitalizationPolicy: string;
  punctuationPolicy: string;
};
```

`allowedFrames` are grammar and punctuation examples, not canned answers. The Provider must write a fresh answer for the real user task.

## Automatic Live-Safe set

- `I think`
- `it depends`
- `that makes sense`
- `for example`
- `for now`
- `at the same time`
- `in the long run`
- `sounds good`

`a little` and `kind of` remain in the Registry for history, user reuse recognition, and explicit Assistance, but are not automatic Live-Safe candidates.

## Forbidden frames

- Chinese noun + English Chunk + Chinese comparative or predicate.
- Chinese degree adverb + English Chunk.
- Chinese verb + English Chunk + Chinese object.
- “按 English Phrase 的节奏”.
- Label, heading, card, direct translation, or completed-Chinese-meaning duplication.
- Chinese `例如`/`比如`/`举例` immediately followed by `For example`.
- A Phrase replacing the real answer.

## Deterministic enforcement

Template and Domain validators reject:

- `beta_frame_chinese_internal_slot`
- `beta_frame_not_auto_live_safe`
- `beta_frame_following_clause_missing`
- `beta_frame_reaction_not_standalone`
- `beta_frame_duplicate_example_marker`
- `beta_frame_example_content_missing`

Capitalization applies at every automatic sentence boundary, including a Phrase that follows a complete Chinese sentence inside the same response.

