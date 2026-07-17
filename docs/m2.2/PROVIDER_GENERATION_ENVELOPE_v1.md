# Provider Generation Envelope v1

- Contract ID：`eoe.provider-envelope.v1`
- Domain response：`eoe.response.v2`（保持不变）
- 范围：M2.2 Provider 输出边界

## 1. 分层

```text
Provider Raw Text
  -> ProviderGenerationEnvelopeV1
  -> deterministic Mapper
  -> GeneratedResponse / MessageSegment[]
  -> Domain Hard Validator
  -> Naturalness Validator
```

Provider Envelope 是 Provider DTO，不是持久化或 UI 的事实来源。`GeneratedResponse` 仍是 IndexedDB、Semantic Rendering、ExposureEvent 与 Domain Validator 的事实来源。

## 2. TypeScript 形状

```ts
type ProviderGenerationEnvelopeV1 = {
  schemaVersion: "eoe.provider-envelope.v1";
  conversationFunction: ConversationFunction;
  beforeText: string;
  englishChunk: null | {
    content: string;
    phraseId: string;
  };
  afterText: string;
  noFit: boolean;
  intentPreserved: boolean;
  naturalnessConfidence: number;
};
```

所有八个字段都是 required；对象及 `englishChunk` 子对象均禁止额外字段。实现同时维护严格 Zod Schema 与 provider-neutral JSON Schema。

## 3. 不变量

1. `beforeText`、`afterText` 只保存普通回复文本，内容不会被 Mapper 改写。
2. 两个文本槽位可以分别为空，但不能同时为空。
3. `englishChunk` 只保存本轮 Selected Phrase；Provider 不输出 `type`、`language`、`isNew`、`assistanceAvailable` 或 `usedPhraseIds`。
4. `noFit=true` 时 `englishChunk=null`。
5. `noFit=false` 时 `englishChunk` 必须存在。
6. `phraseId` 必须等于本轮 Selected Phrase ID，`content` 必须是其 canonical 或 variant。
7. 没有 Selected Phrase 时必须输出 `noFit=true`。
8. `naturalnessConfidence` 必须处于 `[0,1]`。
9. 禁止 HTML、Markdown code fence 与额外字段。
10. Envelope 非法时失败并触发一次完整重生成；不做字符串修复。

## 4. 确定性 Mapper

Mapper 只添加应用确定的字段：

- `type`
- `language`（按普通文本是否含中文字符确定为 `zh` 或 `other`）
- `isNew`
- `assistanceAvailable=true`
- `usedPhraseIds`
- `schemaVersion=eoe.response.v2`
- 当前 `policyVersion`

Mapper 不修改自然语言、不重写边界、不从普通文本识别英语、不补猜 Phrase，也不修复未知 JSON。映射结果必须再次通过 `generatedResponseSchema`。

如果一个英语 Envelope 的 `beforeText` 或 `afterText` 单边为空，Mapper 可以忠实生成 Domain Segment；现有 Domain Hard Validator 仍会按 M2.1 的双侧语境规则判断 `orphan_english_chunk`。这保留了“结构映射”和“展示资格”之间的职责边界。

## 5. Provider-specific 请求策略

| Provider 能力 | 请求策略 | 本地保证 |
|---|---|---|
| 已确认 native JSON Schema | 发送本文件的 strict JSON Schema，required 全字段、`additionalProperties=false` | Zod + Semantic + Domain validation |
| 仅 JSON Mode | 发送 `json_object`，Directive 只描述 Envelope | 同上 |
| 无已确认 JSON Mode（当前 Vision） | 不发送未经确认的 `response_format`；Directive 提供单一 Envelope 形状 | 同上；失败后最多一次结构纠正 Retry |

当前 capability matrix 未确认 GLM-4.7、GLM-4.6V 或 DeepSeek V4 Flash 的 direct JSON Schema response，因此生产配置不假定该能力。GLM-4.7 与 DeepSeek 使用 JSON Mode；GLM-4.6V 使用极简 Directive 与本地严格 Parse。Provider SDK 类型不会进入 Domain、UI、IndexedDB、Registry 或 Validator contract。

## 6. Parser Pipeline 与诊断

```text
Raw Provider Response
-> Provider Text Extraction
-> JSON Object Extraction
-> Provider Envelope Zod Parse
-> Envelope Semantic Checks
-> Deterministic Mapper
-> Domain Zod Parse
-> Domain Hard Validator
-> Naturalness Validator
```

主要诊断：

- `provider_empty_response`
- `provider_non_json_response`
- `provider_markdown_wrapped_json`
- `provider_envelope_parse_failed`
- `provider_envelope_semantic_failed`
- `provider_phrase_mismatch`
- `provider_no_fit_conflict`
- `mapper_failed`
- `domain_schema_failed`
- `domain_validator_failed`

字段级 Retry code 包括：

- `missing_beforeText`
- `missing_afterText`
- `invalid_englishChunk`
- `phrase_id_mismatch`
- `noFit_chunk_conflict`
- `unexpected_segments_array`
- `unexpected_extra_field`
- `invalid_confidence`

错误只进入本地 Developer Diagnostics 与脱敏报告；普通聊天界面仍只显示自然回复或 Natural Fallback。

## 7. Retry 与 Fallback

- Attempt 1：完整生成 Envelope。
- Envelope、Mapper、Domain 或 Naturalness 任一 Gate 失败：Attempt 2 收到具体 code，并完整重生成 Envelope。
- 不做字符串替换、不放宽 Schema、不无限重试。
- Attempt 2 仍失败：返回自然中文主导的 `noFit=true` fallback。
- Provider Fallback、Validator Retry、Natural Fallback 分别记录。

## 8. 安全与非目标

- 报告不得保存 Key、Authorization header、完整 System Prompt 或用户隐私。
- Natural Fallback 不计入 Structured Response Success。
- M2.2 不启动 M3，不实现或启用 Adaptive Progression。
