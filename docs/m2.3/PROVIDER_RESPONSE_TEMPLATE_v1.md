# Provider Response Template v1

Status: **Normative for M2.3**  
Schema ID: `eoe.provider-template.v1`

## DTO

```ts
type ProviderResponseTemplateV1 = {
  schemaVersion: "eoe.provider-template.v1";
  usePhrase: boolean;
  responseTemplate: string;
  noFitReason?: NoFitReason;
};

type NoFitReason =
  | "phrase_not_natural"
  | "conversation_too_short"
  | "sensitive_context"
  | "grammar_mismatch"
  | "position_mismatch"
  | "translation_risk"
  | "label_like_risk"
  | "other";
```

The JSON object is strict: additional properties are invalid.

## Placeholder contract

The exact placeholder is `{{EOE_PHRASE}}`.

- When `usePhrase` is `true`, `responseTemplate` contains the exact placeholder exactly once and `noFitReason` is absent.
- When `usePhrase` is `false`, `responseTemplate` contains no placeholder and `noFitReason` is required.
- Placeholder spellings, aliases, case variants, braces, quoted markers, or multiple placeholders are invalid.
- The Provider never substitutes, repeats, translates, defines, labels, or explains the selected Phrase.

## Valid examples

```json
{
  "schemaVersion": "eoe.provider-template.v1",
  "usePhrase": true,
  "responseTemplate": "{{EOE_PHRASE}}，我们先把最关键的一步确认清楚，再继续处理后面的部分。"
}
```

```json
{
  "schemaVersion": "eoe.provider-template.v1",
  "usePhrase": true,
  "responseTemplate": "这个判断在当前信息下 {{EOE_PHRASE}}，但还要核对一个前提。"
}
```

```json
{
  "schemaVersion": "eoe.provider-template.v1",
  "usePhrase": false,
  "responseTemplate": "我理解你现在更需要一个直接、清楚的回答。先处理最紧急的部分。",
  "noFitReason": "sensitive_context"
}
```

## Invalid examples

- `"{{EOE_PHRASE}}"` as the whole response: isolated placeholder.
- `"英语表达：{{EOE_PHRASE}}，意思是……"`: label plus unsolicited explanation.
- `"{{EOE_PHRASE}}（中文意思是……）"`: automatic gloss.
- `"建议：{{EOE_PHRASE}}"`: label-like overlay without a natural sentence role.
- `"先做这件事：{{EOE_PHRASE}}"`: colon explanation / phrase-as-answer risk.
- `"{{EOE_PHRASE}}{{EOE_PHRASE}}，然后继续。"`: duplicate placeholder.
- `"{{eoe_phrase}}，然后继续。"`: unexpected placeholder spelling.
- `"先处理问题。"` with `usePhrase: true`: missing placeholder.
- Any old `conversationFunction`, `phraseId`, `segments`, or `usedPhraseIds` field: additional property and control-plane violation.

## Serialization and parsing

- Provider adapters request strict JSON Schema or JSON mode when supported.
- The application parses the raw response text through the same strict parser for Mock, GLM text, GLM vision, and DeepSeek.
- Markdown fences, prose before/after JSON, HTML, tolerant repair, and property stripping are not accepted.
- Raw provider text may be stored only in redacted local diagnostics according to existing privacy rules.

## Mapping rule

Successful parsing is not sufficient for display. The Engine validates template semantics and boundaries, inserts its selected Registry phrase, creates Domain semantic segments, and runs Domain validation. Provider output is never rendered directly.
