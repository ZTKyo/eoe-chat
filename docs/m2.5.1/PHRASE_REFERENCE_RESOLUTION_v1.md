# Phrase Reference Resolution v1

## Contract

```ts
type PhraseReferenceResolutionV1 =
  | {
      status: "resolved";
      phraseId: string;
      sourceMessageId: string;
      sourceSegmentIndex: number;
    }
  | {
      status: "ambiguous";
      candidates: Array<{
        phraseId: string;
        canonical: string;
        sourceSentence: string;
        sourceMessageId: string;
        sourceSegmentIndex: number;
      }>;
    }
  | {
      status: "not_found";
    };
```

## Resolution policy

1. Source candidates come only from assistant semantic `english_chunk` history or an explicit Assistance request.
2. Explicit message, segment, or Phrase references narrow the set first.
3. A canonical or registered variant named by the user narrows the set.
4. One reasonable candidate resolves deterministically.
5. Two or more reasonable candidates produce `ambiguous`.
6. No candidate produces `not_found`.
7. Candidate order follows conversation order and retains source sentence metadata.

## Engine-owned response

For `ambiguous`, the Engine builds a short Chinese clarification that lists the canonical candidate surfaces and asks which one the user means. It does not call the ordinary generation Provider, explain every candidate, create ExposureEvent, enter Teacher Mode, or change level.

The clarification is a valid contextual response, not Natural Fallback. It is still parsed as a domain `GeneratedResponse`, passes the deterministic Validator and task-completeness review, and is visible in diagnostics.

After a user explicitly selects one candidate, the same resolver returns `resolved` and normal Vocabulary Assistance v2 runs against that exact source.
