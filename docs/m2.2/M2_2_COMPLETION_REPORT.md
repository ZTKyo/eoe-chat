# M2.2 Completion Report

- 当前状态：`LIVE_PROBE_FAIL`
- Independent Human Review：`PENDING_INDEPENDENT_HUMAN_REVIEW`
- Full Live Corpus：未执行（被六探针门禁阻止）
- M3：未启动
- Adaptive Progression：关闭

M2.2 的本地工程实现和 Non-Live Gate 已通过，但六条真实探针只有 1 条通过，因此本阶段不能标记 Pass，也不具备进入 M3 的技术条件。

## 1. M2.1 失败根因

预实现分析见 `ROOT_CAUSE_ANALYSIS.md`。M2.1 要求真实 Provider 直接生成 `MessageSegment[]` discriminated union；Provider 原始普通文本 Segment 普遍缺少 `type: "text"`。旧 Parser 只做 `JSON.parse`，没有删除字段，Domain Validator 的拒绝和 Natural Fallback 都是正确行为。

M2.1 原始失败报告保持 `LIVE_PROVIDER_FAIL`，并在修改前保存为本地检查点：

- `0d0e497 M2.1 live validation: preserve structured output failure evidence`
- `artifacts/benchmarks/live-provider-naturalness-report.md`

## 2. 原始 Provider 输出与 Parser 问题

M2.1 的主要问题在 Provider Generation Contract；Parser 的次要问题是把非 JSON、Schema、语义和 Domain 错误统一压缩为 `broken_structured_output`，使 Retry 只得到笼统 code。

M2.2 后不再要求 Provider 输出 `segments` 或 `type`，并把诊断拆分为 Provider text、JSON object、Envelope Zod、Envelope semantics、Mapper、Domain Schema、Domain Validator 与 Naturalness 阶段。

## 3. 新 Provider Envelope Schema

新增 `eoe.provider-envelope.v1`：

- `schemaVersion`
- `conversationFunction`
- `beforeText`
- `englishChunk: null | {content, phraseId}`
- `afterText`
- `noFit`
- `intentPreserved`
- `naturalnessConfidence`

实现同时提供 strict Zod Schema 与 provider-neutral JSON Schema；全字段 required，对象禁止 additional properties，confidence 限定 `[0,1]`。

## 4. Envelope 与 Domain 分层

Provider Envelope 是 Provider DTO；现有 `GeneratedResponse / MessageSegment[]` 保持不变，并继续作为：

- IndexedDB 事实来源；
- UI Semantic Rendering 来源；
- ExposureEvent 来源；
- Domain Hard Validator 输入。

Provider-specific SDK 类型没有进入 Domain、UI、IndexedDB、Phrase Registry 或 Validator contract。

## 5. Mapper 行为

确定性 Mapper 只添加 `type`、`language`、`isNew`、`assistanceAvailable`、`usedPhraseIds`、Domain schema version 与 policy version。它不修改自然语言、不重写句子、不从普通文本识别 Chunk、不猜测 Phrase、不做正则/string repair。映射结果必须再次通过 `generatedResponseSchema`。

## 6. Directive 改动

Directive 只要求一个固定槽位 Envelope：

- 禁止 Markdown、HTML、解释、`segments` 数组与 `type` 字段；
- 普通文本进入 `beforeText / afterText`；
- Selected Phrase 进入 `englishChunk`；
- 不自然时 `englishChunk=null, noFit=true`；
- 不得翻译、定义、标注或教学；
- Attempt 2 携带具体、脱敏的 parse/semantic/domain code，并完整重生成 Envelope。

没有通过继续堆叠 Domain prompt 或降低 Validator 严格度来修复。

## 7. Parser Pipeline

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

新增主要诊断：`provider_empty_response`、`provider_non_json_response`、`provider_markdown_wrapped_json`、`provider_envelope_parse_failed`、`provider_envelope_semantic_failed`、`provider_phrase_mismatch`、`provider_no_fit_conflict`、`mapper_failed`、`domain_schema_failed`、`domain_validator_failed`，并保留字段级 code。

## 8. Validator 严格性

原 Domain Validator 未删除、放宽或绕过。`invalid_phrase_id`、Teacher Mode、自动释义/音标/定义、Conversation Function、Overlay budget、Phrase position、语法角色、边界、重复翻译和内部 prompt 泄露等规则继续运行。Envelope Validation 是新增前置层，不能替代 Domain Validation 或 Naturalness Validation。

## 9. MockProvider 迁移

MockProvider 现在返回与真实 Provider 相同形式的 raw Envelope string，不再构造 Domain Segment object。18 个确定性场景全部覆盖：

1. valid noFit；
2. valid English Chunk；
3. invalid Phrase ID；
4. automatic Chinese gloss；
5. Teacher Mode；
6. overlay budget overflow；
7. broken JSON；
8. missing required Envelope field；
9. unexpected segments array；
10. first failure / second success；
11. two failures / Natural Fallback；
12. retryable Provider error；
13. non-retryable Provider error；
14. noFit / englishChunk conflict；
15. Phrase ID mismatch；
16. Markdown-wrapped JSON；
17. unexpected extra field；
18. invalid naturalnessConfidence。

## 10. Non-Live 测试结果

| 命令 | 真实结果 |
|---|---|
| `npm install` | exit 0；462 packages 已是最新；2 moderate vulnerabilities |
| `npm run lint` | exit 0；0 errors / 0 warnings |
| `npm run typecheck` | exit 0 |
| `npm run test` | exit 0；23 files passed、2 Live files skipped；141 tests passed、2 Live tests skipped |
| `npm run benchmark:eoe` | exit 0；45/45 passed |
| `npm run benchmark:naturalness` | exit 0；1/1 passed；生成 `m2.2-naturalness-report.md` |
| `npm run build` | exit 0；Next.js production build 与 TypeScript 完成 |
| `npm run test:e2e` | 最终 exit 0；Desktop 与 Mobile 共 20/20 passed（18.4s） |

第一次让 Playwright 自管开发服务器的 E2E 命令在截图已生成后未正常退出，因此被主动终止且不计 Pass。随后使用受控 production server、`USE_MOCK_PROVIDER=true` 完整重跑，20/20 为最终证据，服务器在命令结束时清理。

覆盖包括 Envelope Schema/JSON Schema、语义检查、Mapper、空槽位、Phrase mismatch、unknown Phrase、confidence、additional properties、Markdown JSON、Parser stage、Retry、Natural Fallback、Provider adapter、Provider fallback、IndexedDB Domain persistence、Exposure、Assistance、Developer Panel、M1/M2/M2.1 regression、Desktop 与 390×844 Mobile。

## 11. 六条 Live Probe

执行命令：`npm run test:live-providers`，exit 1，Harness 写出 `LIVE_PROBE_FAIL` 后停止；完整 Corpus 未执行。

| Probe | 结果 | 关键诊断 |
|---|---|---|
| GLM-4.7 noFit | PASS | Attempt 1 function mismatch；Attempt 2 完整 Pipeline 通过 |
| GLM-4.7 English | FAIL | Attempt 1 function + punctuation/boundary；Attempt 2 non-JSON |
| GLM-4.6V noFit | FAIL | 两次 `conversation_function_changed` |
| GLM-4.6V English | FAIL | function + orphan/position/boundary violations |
| DeepSeek noFit | FAIL | 两次 `conversation_function_changed` |
| DeepSeek English | FAIL | 两次 function mismatch；Provider 选择 noFit |

### Probe 指标

- Probe pass：1/6（16.7%）
- Raw Envelope parse：11/12 Attempts（91.7%）
- First-attempt Envelope parse：6/6（100%）
- Final Envelope parse：5/6（83.3%）
- Final Mapper success：5/6（83.3%）
- Final Domain Schema success：5/6（83.3%）
- Final Domain Validator success：1/6（16.7%）
- Final Structured Response success：1/6（16.7%）
- Validator Retry：6
- Natural Fallback：5
- Provider Fallback：0（完整阶段未进入）
- noFit final responses：6，其中 5 个来自 Natural Fallback，不能计作 Provider noFit success
- English Chunk final responses：0
- 总 Latency：47780 ms；平均 7963 ms
- 总 Token Usage：13523

## 12. Live Probe 后的新发现

M2.2 确实消除了原始 `type: "text"` discriminator 故障：真实探针中该错误复发 `0`，通过 Mapper 的输出均取得严格 Domain Schema。当前阻断已转移到 Domain Validator compatibility：

1. Provider 普遍把 `conversationFunction` 输出成 `answer`，而 Engine 已确定为 `react`、`advise` 或 `analyze_image`；
2. 英语 Envelope 虽能解析和映射，但部分 `beforeText / afterText` 边界仍违反 M2.1 的自然度与位置规则；
3. GLM English Attempt 2 返回一次非 JSON；
4. DeepSeek English 两次选择 noFit，而该专用探针要求一个合法 Chunk。

这些响应均被严格 Validator 阻止，没有展示给用户，也没有写入 ExposureEvent。

## 13. 完整 20 条 Live Corpus

未执行。六条最小探针没有全部通过，按 Gate 要求停止以避免继续消耗真实额度。因此以下完整 Corpus 指标均为 `n/a`，不能使用 Probe 或 Natural Fallback 数据代替：

- First-attempt Parse Rate；
- Final Parse Rate；
- Mapper/Domain Schema 20-case rate；
- Final Structured Response >=95%；
- per-Provider >=90%；
- GLM → DeepSeek live fallback；
- full-corpus noFit/Chunk/Latency/Token 指标。

## 14. Retry、Fallback 与 Usage

- 所有六条探针最多两次 Generation Attempt，没有无限重试。
- GLM noFit 的具体 function violation 在 Attempt 2 被纠正。
- 其余场景 Attempt 2 仍失败，进入 Natural Fallback。
- Natural Fallback 没有计入 Structured Response success。
- Provider Fallback 与 live Error Normalization controls 因 Probe Gate 失败而未进入执行；M2.1 的原始成功证据仍保留，M2.2 本地 mocked HTTP/Provider tests 继续通过。
- 每条完成的真实请求均记录 Usage 与 Latency。

## 15. npm audit

`npm audit --json` exit 1：2 个 moderate、0 high、0 critical。链路为直接依赖 `next` 受传递依赖 `postcss <8.5.10` 的 GHSA-qx2v-qp2m-jg93 影响；当前 npm 报告 `fixAvailable=false`。本阶段未擅自进行破坏兼容性的依赖替换。

## 16. Desktop 与 Mobile

- Desktop production E2E：通过，无横向溢出；Developer Panel 显示 Envelope、Mapper、Domain Schema 与 Validator 状态。
- 390×844 Mobile production E2E：通过；聊天文本、English Chunk 顺序、点击 Assistance 与 Panel 滚动正常。
- 截图：`artifacts/screenshots/m2.2-desktop.png`
- 截图：`artifacts/screenshots/m2.2-mobile-390x844.png`

## 17. 安全扫描

修改前扫描无凭据、Bearer Token、私钥或本机隐私路径命中；`.env.local` 被 `.gitignore` 忽略且未跟踪。Live 报告只保存脱敏结构、字段长度、Phrase ID、Usage、Latency 与诊断 code，不保存 Key、Authorization value 或完整 System Prompt。

最终扫描结果：

- credential-like pattern：0；
- 本机隐私路径：0；
- 报告/文档中的完整 Directive marker：0；
- `.env.local`：继续由 `.gitignore` 忽略且未跟踪；
- M2.1 Live 失败报告 SHA-1：工作树与 `0d0e497` 均为 `4652f0f620606e34dbd3f37c44d9db9e353e39d3`；
- `git diff --check`：通过；
- Git remote：无；未 push、未部署。

结束时 `git diff --stat`（tracked only）：19 files changed，465 insertions，127 deletions；另有 M2.2 docs、Envelope modules/tests、Live report、Naturalness report 与两张截图为未跟踪新增文件，未被该 stat 计入。M2.1 原始报告没有差异。

## 18. M2.2 Gate 与 M3 条件

- M2.2 Gate：`LIVE_PROBE_FAIL`
- Independent Human Review：`PENDING_INDEPENDENT_HUMAN_REVIEW`
- M3：未启动
- Adaptive Progression：关闭
- 是否具备进入 M3 的技术条件：**否**

下一阶段仍应停留在 M2.2 修复范围，只处理 Conversation Function contract 和自然边界稳定性；在新的六探针 6/6、完整 Corpus 达标及独立人工审核前，不应进入 M3。
