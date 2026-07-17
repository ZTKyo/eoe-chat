# Structured Response Schema v1

- Schema version: `eoe.response.v1`
- Status: Frozen for M1 data foundation; generated in M2

## 1. Contract

The provider-neutral generated response is Zod-compatible and uses Semantic Segments:

```ts
type ConversationFunction =
  | "answer"
  | "react"
  | "empathize"
  | "advise"
  | "explain"
  | "clarify"
  | "ask_follow_up"
  | "summarize"
  | "analyze_image"
  | "complete_task";

type MessageSegment =
  | {
      type: "text";
      content: string;
      language: "zh" | "other";
    }
  | {
      type: "english_chunk";
      content: string;
      phraseId: string;
      isNew: boolean;
      assistanceAvailable: boolean;
    };

type GeneratedResponse = {
  schemaVersion: "eoe.response.v1";
  policyVersion: string;
  conversationFunction: ConversationFunction;
  segments: MessageSegment[];
  usedPhraseIds: string[];
  noFit: boolean;
  generationAttemptId?: string;
  warnings?: string[];
  confidence?: number;
};
```

Provider name, model, latency, usage, and raw diagnostics belong to `GenerationAttempt`. They may accompany an API envelope but must not change the domain response schema.

## 2. Field invariants

- `schemaVersion` is required and exact.
- `policyVersion` identifies the behavior policy applied to this response.
- `segments` is non-empty and ordered exactly as rendered.
- Segment `content` is non-empty after trimming.
- `english_chunk.phraseId` must reference a selected, valid Phrase.
- `usedPhraseIds` contains each English segment phrase ID once, in first-use order.
- `usedPhraseIds` must exactly equal the unique English segment phrase IDs.
- `noFit: true` requires zero `english_chunk` segments and an empty `usedPhraseIds` array.
- `noFit: false` may still have no English only for a documented provider fallback response; normal EOE output should use `noFit: true` instead.
- `confidence`, when present, is between 0 and 1 and is never treated as proof of comprehension.

## 3. Storage and rendering

- IndexedDB stores Semantic Segments as structured data.
- The UI renders segments directly in order.
- The application must never guess overlay boundaries by parsing Markdown, brackets, colors, HTML, or ordinary strings.
- Plain text is a derived projection for search, accessibility, export, and provider context; it is not the source of overlay identity.
- English chunks may expose vocabulary assistance only after click, long press, keyboard action, or explicit user request.
- The default chat surface must not render English chunks as conspicuous teaching cards.

## 4. Transport envelope

The server API may wrap the response with provider-neutral transport metadata:

```ts
type ChatResponseEnvelope = {
  response: GeneratedResponse;
  requestId: string;
  provider: {
    providerId: string;
    modelId: string;
    fallbackUsed: boolean;
  };
};
```

No provider SDK object may appear in this envelope, domain storage, or UI props.

## 5. M1 compatibility

M1 messages use the same `MessageSegment` representation even though the complete Overlay Engine is not implemented. Normal provider text is stored as one `text` segment. This prevents M2 from requiring a conversation-data rewrite.
