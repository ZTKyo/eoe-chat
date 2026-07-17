# M2.2 Root Cause Analysis

- 分析日期：2026-07-17
- 基线提交：`0d0e497 M2.1 live validation: preserve structured output failure evidence`
- 原始 Gate 状态：`LIVE_PROVIDER_FAIL`（保持不变）
- 范围：仅分析 Provider Structured Output 链路；不涉及 M3 或 Adaptive Progression

## 1. 结论

M2.1 的主要故障发生在 **Provider Generation Contract** 层，而不是 Domain Validator 层。

真实 Provider 能成功建立连接、返回 HTTP 成功响应、模型标识、Usage 与 Latency，但在扩展场景中不能稳定直接生成最终 `MessageSegment[]` discriminated union。最常见的原始结构缺陷是普通文本 Segment 只有 `language` 与 `content`，缺少 Domain Schema 必需的 `type: "text"`。现有 Parser 只调用 `JSON.parse`，不会删除字段；代码中也不存在 JSON repair、Segment normalizer 或 Plain Text Projection 回写路径。因此缺失字段在进入 Parser 前已经存在。

现有 Validator 按 Domain Schema 拒绝这些响应是正确行为，Natural Fallback 也正确保护了用户体验。修复方向是将 Provider DTO 与 Domain Entity 分层，而不是放宽 Validator、补猜字段或修改 Gate 标准。

## 2. 已保留证据

- 原始完整报告：`artifacts/benchmarks/live-provider-naturalness-report.md`
- 原始完成报告：`docs/m2.1/M2_1_COMPLETION_REPORT.md`
- 原始状态：24 条非控制真实场景中最终 Structured Response 成功 `0/24`
- Validator Retry：27
- Natural Fallback：27
- 代表性 Zod 信息：`Invalid discriminator value. Expected 'text' | 'english_chunk'`
- 本地证据检查点：`0d0e497`

上述文件不会被 M2.2 报告覆盖或改写。M2.1 报告只持久化了脱敏结构摘要、最终 Domain fallback、Attempt 元数据和 violation code，没有持久化完整 Provider 原文；这是 M2.1 的可观测性缺口，不能在事后伪造逐字原文。以下诊断只记录当时已观察并写入报告的字段形状，不恢复用户文本或完整 System Prompt。

## 3. M2.1 发送给 Provider 的结构要求摘要

所有路径共享同一个 Directive Builder，要求 Provider 直接返回最终 Domain Response，包含：

- `schemaVersion`
- `policyVersion`
- `conversationFunction`
- `segments`
- `usedPhraseIds`
- `noFit`
- `naturalnessConfidence`
- `intentPreserved`

Directive 对 Segment 的摘要是“text segment 需要 `language`，english_chunk 需要 `content`、`phraseId`、`isNew`、`assistanceAvailable`”。它没有把完整、机器可验证的 JSON Schema 传给 Provider，也没有明确列出 text Segment 的必需 discriminator `type: "text"`。Provider 同时需要生成数组、discriminated union、边界空白和多项 Domain 字段。

约束方式：

| 路径 | 请求约束 | 实际约束能力 |
|---|---|---|
| GLM-4.7 | `response_format: {"type":"json_object"}` + Directive | 只约束输出为 JSON Object，不约束嵌套 Segment Schema |
| GLM-4.6V | Directive | 当前 capability matrix 未确认 JSON Mode；Adapter 未发送 `response_format` |
| DeepSeek V4 Flash | `response_format: {"type":"json_object"}` + Directive | 只约束输出为 JSON Object，不约束嵌套 Segment Schema |
| GLM → DeepSeek fallback | DeepSeek 的上述约束 | 路由切换成功，但输出契约没有改变 |

## 4. 脱敏结构诊断

### 4.1 共同管线

```text
Provider HTTP 200 content string
  -> JSON.parse (不提取、不修复、不改字段)
  -> generatedResponseSchema.safeParse
  -> validateStructuredResponse
  -> broken_structured_output
  -> Attempt 2 或 Natural Fallback
```

M2.1 没有独立 JSON Object Extraction 阶段。`parseProviderJson` 对完整字符串直接调用 `JSON.parse`；成功时返回同一对象，失败时返回 `undefined`。

### 4.2 GLM-4.7：HTTP 成功、Schema 失败

- 请求约束摘要：JSON Mode + 最终 Domain `segments` 指令。
- 原始响应脱敏形状（代表性）：

```json
{
  "schemaVersion": "<string>",
  "policyVersion": "<string>",
  "conversationFunction": "<enum>",
  "segments": [
    { "language": "zh", "content": "<redacted>" }
  ],
  "usedPhraseIds": [],
  "noFit": true,
  "naturalnessConfidence": "<number>",
  "intentPreserved": true
}
```

- Parser 后结构：与上面相同；`JSON.parse` 没有投影或删除字段。
- Zod 路径模式：`segments.<text index>.type`，缺少 discriminator。
- Validator violation：`broken_structured_output`。
- 层级判定：Provider Generation Contract 失败；Domain Validator 正常拒绝。

### 4.3 GLM-4.6V：HTTP 成功、Schema 失败

- 请求约束摘要：无已确认 JSON Mode，仅使用相同 Domain `segments` Directive。
- 原始响应脱敏形状：顶层为 JSON Object；普通文本元素出现 `{language, content}` 而无 `type`。
- Parser 后结构：未变化。
- Zod 路径模式：`segments.<text index>.type`。
- Validator violation：`broken_structured_output`。
- 层级判定：Vision 路径的原生结构约束更弱，但故障形状与文本 Provider 相同，说明共同 Directive/Domain union 是主要共同原因。

### 4.4 DeepSeek V4 Flash：HTTP 成功、Schema 失败

- 请求约束摘要：JSON Mode + 最终 Domain `segments` 指令。
- 原始响应脱敏形状：顶层 JSON 可解析；普通文本元素缺少 `type`。少数重试还出现非 JSON 或字段类型错误。
- Parser 后结构：JSON 可解析时未变化；非 JSON 时为 `undefined`。
- Zod 路径模式：主要为 `segments.<text index>.type`；非 JSON 响应没有可用 Zod 对象路径。
- Validator violation：统一被压缩为 `broken_structured_output`。
- 层级判定：主要是 Provider Generation Contract；同时暴露 Parser Diagnostics 过粗。

### 4.5 GLM → DeepSeek fallback：路由成功、Schema 失败

- GLM 的受控 retryable `provider_unavailable / 503` 正确触发 DeepSeek fallback。
- DeepSeek 返回 HTTP 成功响应，`providerFallback=true` 被正确记录。
- fallback 响应仍按相同复杂 Domain Schema 生成，普通文本 Segment 同样缺少 discriminator。
- Parser 后结构未变化，Zod 路径模式仍是 `segments.<text index>.type`。
- Validator violation：`broken_structured_output`，随后 Natural Fallback。
- 层级判定：Provider Gateway 正常；fallback 没有解决共享输出契约缺陷。

### 4.6 Attempt 1 与 Attempt 2

| Attempt | 输入给重试的信息 | 观察结果 | 判定 |
|---|---|---|---|
| 1 | 普通 Directive | 多数可解析为 JSON，但普通文本 Segment 缺少 `type` | 复杂 Domain contract 不稳定 |
| 2 | `previousViolationCodes=["broken_structured_output"]` | 经常重复同一 discriminator 缺失；部分响应转为非 JSON或错误字段类型 | Retry 信息过粗，未携带阶段、Zod 路径和具体字段错误 |

Attempt 2 要求完整重生成，这是正确方向；问题在于它只知道笼统 code，无法区分 `missing type`、非 JSON、额外字段或字段类型错误。

## 5. 十项可能性的逐项判定

| # | 可能性 | 判定 | 证据 |
|---:|---|---|---|
| 1 | Provider 原始响应本身缺少 `type` | **确认** | M2.1 Live 诊断在 Parser 前观察到 `{language, content}`；三类 Provider 路径均出现 |
| 2 | Provider 返回了 `type`，但 Parser 丢失 | **排除** | Parser 只有 `JSON.parse`，成功后直接把对象交给 Zod |
| 3 | JSON extraction/repair 删除了 `type` | **排除** | M2.1 不存在 extraction 或 repair 阶段 |
| 4 | Zod 与实际传给 Provider 的 JSON Schema 不一致 | **确认存在契约缺口** | Domain Zod 很严格，但当时没有向任何 Provider 发送对应的 native JSON Schema |
| 5 | Prompt 示例与正式 Schema 不一致 | **确认** | Directive 摘要没有明确 text Segment 的 `type` 必填项，也没有完整固定示例 |
| 6 | Native JSON Mode 未真正约束嵌套 Segment | **确认** | GLM/DeepSeek 使用的是 `json_object`，不是 native JSON Schema；它只保证 JSON 语法层 |
| 7 | discriminated union 对真实 Provider 过于复杂 | **高度确认** | 三类模型能生成顶层字段，却共同在 union discriminator 失败；最小探针偶发成功但扩展语料 0/24 |
| 8 | GLM、DeepSeek、Vision 使用不同结构约束 | **确认，但不是唯一根因** | GLM/DeepSeek text 有 JSON Mode，Vision 无；三者仍共享同一失败形状 |
| 9 | Retry Directive 未明确修正具体结构错误 | **确认** | Attempt 2 只收到 `broken_structured_output`，没有 path/stage/error code |
| 10 | Plain Text Projection/Normalizer 覆盖 Segment | **排除** | Projection 只在验证后用于显示/上下文；验证前没有 Segment normalizer |

## 6. 根因树

```text
最终结构成功 0/24
├─ 直接原因：Provider 原始普通文本 Segment 缺少 discriminator
├─ 契约原因：要求 Provider 直接生成复杂 Domain discriminated union
├─ 约束原因：JSON Mode 不是嵌套 JSON Schema；Vision 约束更弱
├─ 指令原因：结构摘要与 Domain Zod 不完全一致
├─ 重试原因：只传笼统 violation code，缺少阶段和字段路径
└─ 可观测性原因：所有 parse/schema 问题被聚合成 broken_structured_output
```

## 7. M2.2 修复边界

M2.2 将：

1. 新增固定槽位的 `ProviderGenerationEnvelopeV1`；
2. 对 Envelope 执行严格 JSON/Zod/语义验证；
3. 通过确定性 Mapper 添加 Domain-only 字段；
4. 继续对映射后的 Domain Entity 执行原有 Zod、Hard Validator 与 Naturalness Validation；
5. 将失败拆分为 Provider text、JSON、Envelope、Mapper、Domain Schema、Domain Validator 阶段；
6. 在 Attempt 2 中携带具体、脱敏的错误 code。

M2.2 不会：

- 接受缺失字段；
- 从普通文本识别或猜测 English Chunk；
- 用正则或字符串替换修复 JSON；
- 删除、放宽或绕过 Domain Validator；
- 把 Natural Fallback 计为 Structured Response Success；
- 启动 M3 或 Adaptive Progression。
