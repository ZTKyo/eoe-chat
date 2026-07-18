# EOE Chat / English Overlay Engine

## 其他 Agent 应用构建与接手指南

- 文档用途：把本项目从最初产品定义、M0/M1、M2.x、独立人工审核、Text Beta RC，到 GitHub/Vercel 部署及首轮真实使用修正的命令、要求、资料和结论集中到一个文件中。
- 适用对象：需要理解、复刻、维护或继续验证 EOE Chat 的开发 Agent。
- 当前基线日期：2026-07-18
- Product Name：**EOE Chat**
- Core Engine：**English Overlay Engine**
- Repository / Workspace Folder：**ACLAE**（可保留，不需要迁移目录）
- ACLAE 含义：未来更完整的 **Adaptive Conversational Language Acquisition** 架构
- 当前产品范围：**Text-First、Fixed-Level、Password-Protected PWA**
- 当前公开源码：<https://github.com/ZTKyo/eoe-chat>
- 当前部署入口：<https://eoe-chat.vercel.app/>
- 当前公开主线参考提交：`9d530b6`

> 本文不包含 API Key、访问密码、Session Secret、`.env.local` 内容、完整 Provider Directive、私人绝对路径或聊天隐私。给其他 Agent 时，也不得附带这些内容。

---

## 1. 使用本指南时的权威顺序

当历史资料发生冲突时，按以下顺序判断：

1. 用户最后一次明确指令；
2. 独立人工审核对自然度、任务完成度和产品可用性的判断；
3. `docs/PRODUCT_CONSTITUTION.md`；
4. 当前阶段的正式 Contract / Policy；
5. 当前代码中的类型、Schema、测试和运行保护；
6. 原始三份 EOE 设计文档；
7. Mock、自动 Validator、Benchmark 和历史 Completion Report。

重要解释：

- 自动测试 PASS 不能覆盖人工审核对自然度或任务完成度的 FAIL。
- 原始路线图把 Validator、Telemetry、Vocabulary Assistance 部分安排在 M3；实际项目经过验证后已将它们的一部分提前到 M2.x。**Adaptive Progression 仍然没有启动。**
- 早期 Private Beta 文档写过“禁止公开部署”；之后用户明确授权 GitHub 开源并部署到带密码的 Vercel。后者是当前有效命令。
- 冻结的工程状态和人工产品结论可以同时存在：
  - Engineering Status：`M2_TEXT_BETA_RC_FINAL_STOPPED_WITH_BLOCKERS`
  - Human Product Verdict：`M2_TEXT_BETA_RC_HUMAN_REVIEW_PASS_WITH_KNOWN_LIMITATION`
  - 后续运行状态：已按用户明确授权部署为密码保护的个人 Text Beta
- `eoe.response.v1` 是早期数据基础；当前显示响应使用 `eoe.response.v2`，Provider 当前只返回严格的 `eoe.provider-template.v1`。

---

## 2. 给新 Agent 的第一条规则

如果新 Agent 是从零构建或准备大改，必须先完整读取：

1. `EOE_White_Paper_v1.0.docx`
2. `EOE_Software_Specification_v1.0.docx`
3. `EOE_Development_Guide_v1.0.docx`

然后读取本指南第 15 节列出的当前权威资料。

在没有得到实现批准前，新 Agent 应先输出 Implementation Plan，至少包括：

1. 对产品目标的理解；
2. 对 English Overlay Engine 的理解；
3. 总体软件架构；
4. 数据模型；
5. Provider 抽象；
6. Milestones；
7. 风险；
8. 不一致或缺失规范；
9. 改进建议。

如果是在现有仓库内维护：

- 先检查 `git status`；
- 不删除用户文件；
- 不重写 M1 已稳定的聊天、IndexedDB、PWA 和 Provider 基础设施；
- 不启动 M3；
- 不启动 Adaptive Progression；
- 不因为一个失败场景进行大范围重构；
- 不调用真实 Provider，除非本轮有明确授权、运行预算和审计要求。

---

## 3. 产品目标

EOE Chat 首先是一个自然、可靠、普通的 AI 聊天应用。用户通过日常对话逐步接触可理解、可复用的英语语义块，但不应感觉自己进入了传统英语学习软件。

长期目标：

- 从孤立的高频 English Chunk 开始；
- 在真实语境中自然复现；
- 逐步提高英语承载比例；
- 最终让英语成为交流媒介，而不是对话主题。

当前版本只验证固定等级下的 Overlay，不验证自动升级，不宣称 Mastery，也不宣称已经证明长期语言习得效果。

### 3.1 不可覆盖的产品原则

1. 用户真实问题始终优先。
2. 普通答案的准确、完整、安全和连贯优先于英语出现。
3. Conversation Function 必须先于 Overlay 决策。
4. Naturalness 是 Hard Eligibility Gate。
5. English Coverage 是 Ceiling，不是 Quota。
6. `noFit: true` 是正常成功结果，但不能用来逃避本来应该回答的任务。
7. 英文不能代替正常回答。
8. 不得为了英语学习目标翻译、复述或改写用户问题来充当答案。
9. 不得进入 Teacher Mode。
10. 不得自动提供中文释义、音标、定义、语法课、练习、背诵或测试。
11. Vocabulary Assistance 必须由用户点击或明确提问触发。
12. Engine 管理状态、选择、Phrase ID、验证、重试、Fallback 和 Exposure；模型只负责自然表达。
13. 普通 UI 不显示内部等级、候选、Directive、Validator 或学习机制。
14. 用户应始终感觉自己在使用普通 AI 助手。

### 3.2 当前不做

- Adaptive Progression；
- 自动升级或降低长期 Progression Level；
- Mastery Score；
- 自动 Comprehension Evidence 推断；
- 账户和多用户；
- 云同步；
- 游戏化、排行榜、打卡、XP；
- 自动词汇解释或自动音标；
- 图片入口和图片 Overlay；
- 大规模 UI 重设计；
- 复杂模型选择 UI；
- 匿名公开访问；
- M3。

---

## 4. 当前产品范围

当前是 **Text-First Fixed-Level Beta**。

已包含：

- 普通文本对话；
- 多轮上下文；
- 知识问答、观点讨论、建议、技术解释、计划和比较；
- 情绪支持；
- 固定等级 English Overlay；
- 合法 `noFit`；
- 用户主动使用过的 Phrase 的上下文复用；
- 用户触发的 Vocabulary Assistance；
- 明确要求中文时的临时中文模式及恢复；
- IndexedDB 本地历史；
- Desktop 和 390×844 Mobile；
- PWA 安装；
- 密码访问；
- 每日请求上限；
- GLM 主 Provider 和 DeepSeek 文本 Fallback。

已保留但默认关闭：

- Vision 代码；
- 历史图片数据；
- GLM-4.6V 适配。

当前图片开关要求：

```dotenv
EOE_ENABLE_IMAGE_INPUT=false
```

不得把 Vision 代码存在等同于当前产品支持图片输入。

---

## 5. English Overlay Engine 的工作方式

### 5.1 完整请求链路

```text
User Message
→ Intent / Conversation Analysis
→ Conversation Function
→ Overlay Scheduler
→ Candidate Selector
→ Per-turn Directive
→ Provider Template Generation
→ Strict Template Parser
→ Template Validator
→ Engine Phrase Realization
→ Semantic Response Mapping
→ Hard Validator
→ Soft Quality Review（仅必要时）
→ Retry / Answer-Preserving Fallback
→ Semantic Segment Rendering
→ Local Exposure / Attempts / Diagnostics
```

### 5.2 Conversation Functions

固定 Taxonomy：

- `answer`
- `react`
- `empathize`
- `advise`
- `explain`
- `clarify`
- `ask_follow_up`
- `summarize`
- `analyze_image`
- `complete_task`

分类结构至少包含：

```ts
type ConversationAnalysis = {
  primaryFunction: ConversationFunction;
  secondaryFunction?: ConversationFunction;
  sensitivity: "normal" | "emotional" | "high_stakes" | "technical";
  responseLength: "short" | "medium" | "long";
  overlaySuitability: "high" | "medium" | "low" | "none";
  confidence: number;
};
```

分类器不得把用户消息翻译成英文，也不得改变用户任务。

### 5.3 Fixed Level 与 Effective Level

- 默认长期 Fixed Level：`2`
- 可通过环境变量或隐藏开发设置修改；
- M2.x 不自动 Promotion 或 Demotion；
- Effective Level 只影响当前一轮；
- 临时降级不得修改长期 Fixed Level。

以下场景应降低 Effective Level 或跳过 Overlay：

- 情绪敏感；
- 医疗、法律、金融等高风险；
- 用户明确表示没听懂；
- 信息复杂；
- 必须极短回复；
- 明确中文要求；
- 没有自然插入位置；
- 图片内容复杂（当前图片入口已关闭）。

### 5.4 Scheduler

```ts
type OverlayDecision = {
  mode: "preferred" | "skip";
  fixedLevel: number;
  effectiveLevel: number;
  maxNewFocus: number;
  maxEnglishSegments: number;
  reusePreferred: boolean;
  candidateCount: number;
  reasonCodes: string[];
  policyVersion: string;
};
```

规则：

- Scheduler 必须先于 Selector；
- 普通实质性回复可以优先尝试一个自然机会；
- 默认最多一个新学习重点；
- 熟悉 Phrase 可以自然复用；
- 不强制每轮出现英语；
- 极短、敏感、高风险、明确中文场景可 skip；
- 不得为了配额破坏句子；
- 用户主动英语不应被误判为系统 Overlay。

### 5.5 Candidate Selector

选择顺序：

1. Registry Active 状态；
2. Effective Level；
3. Conversation Function；
4. 语义和 Tone；
5. cooldown；
6. 近期 Exposure 与值得复用的 Phrase；
7. 生成 3–5 个候选；
8. Naturalness Eligibility；
9. 排序；
10. 允许全部拒绝并输出 `noFit`。

```ts
type CandidateSelection = {
  candidates: Array<{
    phraseId: string;
    score: number;
    reasons: string[];
    isReuse: boolean;
  }>;
  selectedPhraseId?: string;
  noFit: boolean;
  selectorVersion: string;
};
```

不能仅依靠关键词机械匹配，也不能把 Phrase 粗暴插入已经完成的句子。

### 5.6 Phrase Registry

当前 Registry：

- 50 个高频、跨话题、可复用 Semantic Chunks；
- Level 1：15 个；
- Level 2：26 个；
- Level 3：9 个；
- 当前实现：`src/lib/eoe/phrases/core-v1.ts`；
- Registry 有版本、Zod Schema、状态、cooldown 和 Conversation Function 约束。

每个 Phrase 至少具有：

```ts
type Phrase = {
  id: string;
  canonical: string;
  variants: string[];
  level: number;
  difficulty: number;
  frequencyRank: number;
  reuseValue: number;
  conversationFunctions: ConversationFunction[];
  semanticTags: string[];
  compatibleTones: string[];
  contextualHints: string[];
  cooldownTurns: number;
  status: "active" | "disabled";
  registryVersion: string;
};
```

准入优先级：

1. 自然性；
2. 日常高频；
3. 长期复用价值；
4. 跨话题复用；
5. 上下文可猜测；
6. Conversation Function 匹配；
7. 等级匹配；
8. 技术精确性。

已发现并修复的典型问题：

- `That makes sense` 和 `Sounds good` 不能出现在无关事实回答前；
- Phrase 不能作为标签，例如“英语表达：…”；
- Phrase 不能直接粘到中文字符、数字或拉丁字符；
- Placeholder 不能单独成为整个答案；
- Phrase 不得自动附带释义。

### 5.7 Per-turn Directive

Directive 必须紧凑，只发送当前必要状态，不发送完整 Registry。

包含：

- 用户意图；
- Conversation Function；
- 当前必要上下文；
- Fixed / Effective Level；
- Overlay Decision；
- 当前候选和 Engine 选定 Phrase；
- 最近 Exposure；
- 明确禁止行为；
- Provider Template Schema；
- 当前任务完整性要求；
- 用户明确前提；
- 重试时的具体 Violation Code。

必须明确：

- 先完整回答用户；
- 中文仍是主要承载语言；
- Phrase 不自然时返回 `noFit`；
- 不翻译用户原话；
- 不自动解释英语；
- 不显示内部规则；
- 不进入 Teacher Mode；
- 只返回严格 JSON。

### 5.8 Provider 输出边界

Provider 不直接输出 Domain Semantic Segments。当前严格 DTO：

```ts
type ProviderResponseTemplateV1 = {
  schemaVersion: "eoe.provider-template.v1";
  usePhrase: boolean;
  responseTemplate: string;
  noFitReason?:
    | "phrase_not_natural"
    | "conversation_too_short"
    | "sensitive_context"
    | "grammar_mismatch"
    | "position_mismatch"
    | "translation_risk"
    | "label_like_risk"
    | "other";
};
```

唯一 Placeholder：

```text
{{EOE_PHRASE}}
```

约束：

- `usePhrase=true`：Placeholder 必须恰好出现一次，且不能有 `noFitReason`；
- `usePhrase=false`：不得有 Placeholder，必须有 `noFitReason`；
- 额外字段直接拒绝；
- 不接受 Markdown Fence、HTML、JSON 前后说明或宽松修复；
- Provider 不输出 `phraseId`、候选 ID、Conversation Function、Segments、Level、Policy Version、Exposure 或 Validator 状态；
- Provider 原始结果绝不能直接渲染。

### 5.9 Engine 控制权

Engine 拥有：

- Conversation Function；
- Fixed / Effective Level；
- Scheduler；
- Candidates 和 selected Phrase ID；
- Phrase 内容；
- Placeholder 插入；
- Semantic Segments；
- Response Schema；
- Validator；
- Retry；
- Fallback；
- Exposure；
- Diagnostics。

Provider 只拥有：

- 是否能自然使用指定 Placeholder；
- 完整自然回答的措辞；
- 合法 `noFitReason`。

### 5.10 最终 Semantic Response

```ts
type GeneratedResponse = {
  schemaVersion: "eoe.response.v2";
  conversationFunction: ConversationFunction;
  segments: MessageSegment[];
  usedPhraseIds: string[];
  noFit: boolean;
  naturalnessConfidence?: number;
  intentPreserved?: boolean;
};

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
```

UI 必须直接渲染 Segment：

- 不从纯文本反向识别英语；
- 不渲染 Provider HTML；
- Plain Text Projection 只用于上下文、复制、搜索和无障碍；
- Plain Text 不是 Overlay 身份的事实来源；
- 复制整条消息时顺序必须自然；
- 屏幕阅读器应按普通句子读取。

---

## 6. Validator、Retry 与 Fallback

### 6.1 Hard Validator

Hard Error 阻止显示。核心 Violation：

- `broken_structured_output`
- `invalid_phrase_id`
- `phrase_not_selected`
- `excessive_new_content`
- `overlay_budget_exceeded`
- `full_english_takeover_before_ready`
- `automatic_gloss`
- `unsolicited_pronunciation`
- `unsolicited_definition`
- `teacher_mode`
- `translation_mode`
- `internal_prompt_leak`
- `conversation_function_changed`
- `empty_response`
- `duplicate_segment`
- `invalid_language_tag`
- `low_naturalness_confidence`
- 明确中文要求违反；
- 核心答案遗漏或任务被替换；
- 多轮上下文重置；
- 用户明确前提遗漏、矛盾或被替换；
- 无依据的精确数字；
- Provider Template 或 Placeholder 违规。

```ts
type ValidationResult = {
  valid: boolean;
  violations: Array<{
    code: string;
    severity: "error" | "warning";
    details?: string;
  }>;
  retryable: boolean;
};
```

### 6.2 Hard 与 Soft 分离

Soft Warning 不能单独触发 Natural Fallback。

Soft Review 可用于：

- 回答深度可能不足；
- 比较维度不完整；
- 表达略模板化；
- Phrase 流动略机械；
- 技术建议存在有效同义表达，但规则不确定；
- Hard Validator 无法确定的自然度问题。

当 Attempt 1 Hard-valid 但有 Soft Warning：

1. 保留 Attempt 1；
2. 最多再生成一次；
3. 对两个 Hard-valid 候选比较任务义务、内容实质、Soft Confidence 和 Warning 数；
4. 如果第二次更差，显示保留的第一个安全答案；
5. Soft Warning 只进入本地 Developer Diagnostics。

### 6.3 最大尝试次数

- 每个用户请求最多两次完整 Provider Generation Attempt；
- Attempt 2 带具体 Violation 和纠正要求；
- 不做字符串替换修补；
- Provider Fallback 与 Validator Retry 必须分别记录；
- 不能因为结构失败无限换 Provider。

### 6.4 P0：Answer-Preserving Natural Fallback

真实使用发现的 P0：

- Provider 已经给出安全、相关的回答；
- 后续 Overlay / Soft Quality 检查失败；
- Engine 却用泛化 Natural Fallback 替换了答案；
- 用户最终看到“关于你的问题，我会先确认目标……”等没有回答问题的内容。

当前要求：

1. 只要存在 Hard-valid、实质回答用户问题的 Provider 结果，就优先保留它；
2. Overlay 失败不得抹掉普通答案；
3. Soft Warning 不得把有效答案替换为 Natural Fallback；
4. 只有 Provider 失败或两次 Hard-invalid 且无安全内容时，才使用真正 Fallback；
5. 真正 Fallback 也必须诚实说明本轮未能生成可靠答案，不能伪装成已经回答；
6. 最终 Fallback 为中文主导、`noFit: true`，不显示内部错误。

### 6.5 P1：降低生成与验证延迟

当前已采用的低风险优化：

- 第一次因为任务完整性或 Soft Quality 进入第二次生成时，第二次关闭 Overlay；
- Retry 专注于回答真实问题，不再承担 Phrase 实现；
- 保留第一次 Hard-valid 结果，避免第二次失败后第三次工作；
- 最多两次 Attempt 的总上限不变；
- 不为了速度跳过 Hard Validator；
- 不为了速度降低回答质量或放宽安全规则。

后续优化只能基于真实 Latency/Usage 诊断，不能靠减少必要验证来“优化”。

---

## 7. Vocabulary Assistance 与多轮行为

Vocabulary Assistance 只允许由以下动作触发：

- 点击或长按 English Chunk；
- 用户明确问含义；
- 用户明确问发音；
- 用户表示没有理解；
- 用户明确指出某个已出现 Phrase。

Assistance 应：

- 解析真实 Source Message、Phrase ID 和完整 Source Sentence；
- 结合前一条用户消息和当前主题；
- 简短说明上下文含义；
- 用户问发音时才给发音；
- 需要时只给一个短例子；
- 随后立即回到原话题。

Assistance 不应：

- 解释每一个词；
- 变成课程或单词卡；
- 要求跟读、背诵或做题；
- 丢失原话题；
- 在没查历史前否认 Phrase 出现过；
- 多个 Phrase 有歧义时擅自猜测，应先澄清。

多轮要求：

- 保留用户前提、约束、时间、成本和方向关系；
- 不把“更贵但省一小时”改成不存在的工资、工作日或金额；
- 不将“好吧”“哦”等短响应误当成新话题；
- Engine-owned acknowledgement 可以有 `attemptCount=0`、`providerRequests=0`；
- 上下文确认不能重置成问候语。

---

## 8. 软件架构

### 8.1 技术栈

- Next.js App Router；
- TypeScript；
- React；
- Zod；
- Dexie / IndexedDB；
- Vitest；
- Playwright；
- PWA Manifest + Production Service Worker；
- OpenAI-compatible HTTP Provider Adapter。

最低运行环境：

- Node.js 20.9+；
- npm；
- 现代 Chromium / Safari；
- AI 生成需要网络和可用 Provider。

### 8.2 分层

#### UI

- `src/components/chat-app.tsx`
- `src/components/chat/`
- `src/app/`

职责：

- 请求生命周期；
- 会话列表和消息；
- Composer；
- Segment 渲染；
- Assistance 触发；
- 隐藏 Developer Panel；
- PWA Shell。

UI 不直接调用 Provider，不解析字符串寻找 Phrase。

#### Domain

- `src/domain/chat.ts`
- `src/domain/eoe.ts`
- `src/domain/persistence.ts`

职责：

- Provider-neutral 类型；
- Semantic Segment；
- Engine Contract；
- Persistence Contract。

Domain 不导入 Provider SDK、React、Next.js 或 IndexedDB。

#### Repository

- `src/lib/db/database.ts`
- `src/lib/db/repositories.ts`

职责：

- Dexie Schema 和 Migration；
- Conversation / Message / Phrase / Exposure / Attempt / Assistance / Diagnostic；
- Transaction；
- 本地导出和删除扩展点。

#### English Overlay Engine

- `src/lib/eoe/conversation-analyzer.ts`
- `src/lib/eoe/scheduler.ts`
- `src/lib/eoe/candidate-selector.ts`
- `src/lib/eoe/directive-builder.ts`
- `src/lib/eoe/provider-template/`
- `src/lib/eoe/registry/`
- `src/lib/eoe/validator.ts`
- `src/lib/eoe/soft-naturalness-validator.ts`
- `src/lib/eoe/task-completeness.ts`
- `src/lib/eoe/natural-fallback.ts`
- `src/lib/eoe/engine.ts`

#### Provider Gateway

- `src/lib/providers/types.ts`
- `src/lib/providers/openai-compatible.ts`
- `src/lib/providers/gateway.ts`
- `src/lib/providers/mock-provider.ts`
- `src/app/api/chat/route.ts`

Provider SDK 类型不得泄漏到 Domain、Repository 或 UI。

---

## 9. 数据模型

IndexedDB 数据库：`eoe`

当前存储版本：v3；保留旧版本迁移。

主要实体：

### Conversation

- `id`
- `title`
- `createdAt`
- `updatedAt`
- `archivedAt?`
- `activePolicyVersion`
- `lastMessageAt?`

### Message

- `id`
- `conversationId`
- `role`
- `segments`
- `attachments`
- `plainText`（派生值）
- `status`
- `providerId?`
- `modelId?`
- `generationAttemptId?`
- `policyVersion`
- `schemaVersion`
- timestamps

### Phrase

- Registry 中的版本化 Phrase；
- Level、Function、Tags、Tone、Cooldown、Status。

### ExposureEvent

只在最终显示 English Chunk 后写入：

- `id`
- `phraseId`
- `conversationId`
- `messageId`
- `timestamp`
- `fixedLevel`
- `effectiveLevel`
- `conversationFunction`
- `isNew`
- `provider`
- `policyVersion`
- `registryVersion`
- `selectorVersion`
- `generationAttemptId`

被 Validator 拒绝的结果不得创建 Exposure。

### GenerationAttempt

- Provider / Model；
- Request / Correlation ID；
- started/completed；
- Latency；
- Usage；
- Validator 结果；
- Retry Index；
- Provider Fallback 与 Natural Fallback 状态；
- 已脱敏错误。

### AssistanceRequest

- 只记录明确的用户 Assistance 行为；
- 不直接推导 Mastery。

### EngineDiagnostics

- Conversation Function；
- Fixed / Effective Level；
- Overlay Mode；
- Candidate IDs；
- Selected Phrase；
- noFit；
- Provider；
- Attempt Count；
- Validator / Violation；
- Latency / Usage；
- Fallback；
- Policy / Registry / Selector Version。

### 保留但当前不用于自动升级

- ComprehensionEvidence；
- ProgressionState；
- EnginePolicy；
- ProviderObservation。

数据原则：

- 本地优先；
- 不只保存最终分数；
- 保留可重放事件；
- Migration 不得破坏已有用户历史；
- Clearing Site Data 会删除本机历史；
- 没有跨浏览器、跨设备同步。

---

## 10. Provider 抽象

### 10.1 路由

| 请求 | Primary | Fallback |
|---|---|---|
| Text | GLM-4.7 | DeepSeek V4 Flash，仅 retryable text failure |
| Image + Text | 当前 Beta 禁用；隔离 Vision 模式下 GLM-4.6V | 无 text-only Vision fallback |
| 开发/自动测试 | MockProvider | 不需要真实 Key |

### 10.2 标准化 Contract

每个 Adapter 必须标准化：

- Provider-neutral messages / attachments；
- modality；
- model role；
- timeout 和 cancellation；
- request/correlation ID；
- response text；
- provider / model ID；
- token usage；
- latency；
- normalized error；
- `retryable`；
- 已脱敏 diagnostics。

Error Category：

- `authentication`
- `rate_limit`
- `timeout`
- `cancelled`
- `invalid_request`
- `content_filter`
- `provider_unavailable`
- `invalid_response`
- `unknown`

### 10.3 Production Fail-Closed

真实 Provider 只有在以下条件全部满足时才启用：

```dotenv
EOE_EXECUTION_MODE=production
EOE_ALLOW_LIVE_PROVIDER=true
USE_MOCK_PROVIDER=false
GLM_API_KEY=<server secret>
DEEPSEEK_API_KEY=<server secret>
```

任何条件缺失都不得静默落入错误的真实运行模式。

### 10.4 Live Probe 保护

专门的 Live Probe 除 Key 外还应要求：

- 明确 `live_probe` execution mode；
- `EOE_LIVE_RUN_ID`；
- `EOE_LIVE_LEDGER_PATH`；
- Request 上限；
- Token 上限；
- Runtime 上限；
- Pending Attempt 必须回收；
- 不在 Mock E2E 中调用 Live Provider；
- 不在报告中保存 Key、Bearer、Authorization 或完整 Directive。

不要把 Live Provider 的结构化失败当成放宽 Validator 的理由。

---

## 11. UI、Developer Panel 与 PWA

### 11.1 普通 UI

- 首页直接进入聊天；
- 不做学习首页、等级面板或课程列表；
- English Chunk 轻微可点击，不做成单词卡；
- Hover 不自动弹中文；
- 点击才触发 Assistance；
- 不显示内部机制；
- Desktop 和 390×844 Mobile 都必须可用；
- 不大规模重做 Sidebar 和 Composer。

### 11.2 Developer Panel

默认关闭。开发环境可以通过：

```text
?eoe-dev=1
```

可选测试等级：

```text
?eoe-level=3
```

生产环境不应向普通用户暴露 Developer Panel。

### 11.3 PWA

生产 Service Worker 只在 Production Build 注册。

Desktop Chromium：

1. 打开部署地址；
2. 点击地址栏安装图标或浏览器菜单；
3. 选择 Install EOE Chat。

Android：

1. Chrome 打开；
2. 菜单；
3. Install app / Add to Home screen。

iPhone / iPad：

1. Safari 打开；
2. Share；
3. Add to Home Screen。

PWA 离线边界：

- App Shell 和已存 IndexedDB 会话可离线访问；
- AI 生成仍需要网络；
- 不得宣称模型离线可用。

---

## 12. 环境变量模板

只能提交变量名和空模板，不能提交值：

```dotenv
PRIMARY_PROVIDER=glm
PRIMARY_MODEL=glm-4.7

VISION_PROVIDER=glm-vision
VISION_MODEL=glm-4.6v

FALLBACK_PROVIDER=deepseek
FALLBACK_MODEL=deepseek-v4-flash

GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_API_KEY=

DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=

USE_MOCK_PROVIDER=true
PROVIDER_TIMEOUT_MS=30000

EOE_ALLOW_LIVE_PROVIDER=false

EOE_ACCESS_PASSWORD=
EOE_ACCESS_SESSION_SECRET=
EOE_DAILY_REQUEST_LIMIT=0

EOE_ENABLED=true
EOE_FIXED_LEVEL=2
EOE_DEVELOPER_MODE=false
EOE_ENABLE_IMAGE_INPUT=false
```

Vercel Production 推荐值：

```dotenv
EOE_EXECUTION_MODE=production
EOE_ALLOW_LIVE_PROVIDER=true
USE_MOCK_PROVIDER=false

GLM_API_KEY=<在 Vercel 中设置>
DEEPSEEK_API_KEY=<在 Vercel 中设置>
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
DEEPSEEK_BASE_URL=https://api.deepseek.com
PRIMARY_MODEL=glm-4.7
FALLBACK_MODEL=deepseek-v4-flash
PROVIDER_TIMEOUT_MS=30000

EOE_ENABLED=true
EOE_FIXED_LEVEL=2
EOE_DEVELOPER_MODE=false
EOE_ENABLE_IMAGE_INPUT=false

EOE_ACCESS_PASSWORD=<在 Vercel 中设置>
EOE_ACCESS_SESSION_SECRET=<至少 32 字符的随机值>
EOE_DAILY_REQUEST_LIMIT=50
```

注意：

- Secret 不能使用 `NEXT_PUBLIC_` 前缀；
- `.env.local` 必须被 Git 忽略；
- 不把 `.env.local` 上传给其他 Agent；
- 不把 Key 贴到聊天、截图、Issue、报告或 Artifact；
- Access Password 和 Provider Key 只在 Hosting Server Environment 中配置。

---

## 13. 安全与隐私边界

1. 聊天、Segments、Diagnostics 默认存于浏览器 IndexedDB。
2. 必要上下文会通过 Server Route 发给 Provider。
3. 项目不主动把聊天写入自有云数据库。
4. Hosting 和 Provider 可能按其政策保存运行日志。
5. Provider Key、Access Password、Session Secret 只在服务端。
6. `Authorization` Header 不得进入客户端、IndexedDB、日志或报告。
7. `artifacts/` 不公开；`docs/` 可以公开。
8. 不公开人工审核包中的私人内容、Base64、图片字节或原始 Live 响应。
9. 不把 `node_modules`、`.git`、缓存、临时运行文件打包。
10. 完成发布前再次做 Secret Scan。

当前密码和限额边界：

- 密码登录使用 HTTP-only 签名 Cookie；
- 每日限额使用服务器签名 Cookie，按 UTC 日期重置；
- 适合当前单用户、可信访问；
- 知道密码的人可以清 Cookie 后重新登录，因此不是持久的匿名防滥用系统；
- 若以后允许匿名或多用户访问，必须换成账户认证和 Redis/KV Durable Rate Limiter。

---

## 14. 完整命令清单

### 14.1 初次安装

Windows：

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

默认使用 MockProvider，不需要真实 Key。

### 14.2 基础质量门禁

```powershell
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

必须真实执行；不得声称未执行命令通过。

### 14.3 Benchmark

```powershell
npm run benchmark:eoe
npm run benchmark:structure
npm run benchmark:naturalness
npm run replay:m2.3-live-failures
```

说明：

- `benchmark:naturalness` 是 deprecated alias；
- 结构测试和自动 Naturalness 评价不是独立人工审核；
- 英语出现率不能成为硬性通过指标。

### 14.4 全部 Live Script

以下命令只能在本轮有明确 Live 授权、Key 已存在、Budget Guard 已配置时执行：

```powershell
npm run test:live-providers
npm run test:live-final-corpus
npm run test:live-m2.4
npm run test:live-m2.4.1-focused
npm run test:live-m2.4.2-focused
npm run test:live-m2.4.2-focused-targeted-retry
npm run test:live-m2.5-text-focused
npm run test:live-m2.5-text-focused-targeted-retry
npm run test:live-m2.5-text-corpus
npm run test:live-m2.5.1-targeted
npm run test:live-m2.5.1-targeted-retry-typescript
npm run test:live-m2.5.1-final-corpus
npm run test:live-text-beta-rc
npm run test:live-text-beta-rc-targeted-retry
npm run test:live-text-beta-rc-final
npm run test:live-text-beta-rc-final-targeted-retry
npm run test:live-m2.3.2
```

不得在 Key 缺失时等待用户把 Key 发到聊天，也不得伪造 Live PASS。

### 14.5 本地 Production Beta

```powershell
npm run build
npm run start
```

项目自带 Windows 启停脚本：

```powershell
.\Start-Private-Beta.cmd
.\Private-Beta-Status.cmd
.\Stop-Private-Beta.cmd
```

可信局域网临时访问：

```powershell
.\Start-Private-Beta.cmd -Lan
```

不要在公共 Wi-Fi 开启，不要开放公网端口，不要做路由器端口转发。

### 14.6 Git 安全检查

开始前：

```powershell
git status --short
git branch --show-current
git log -3 --oneline
git check-ignore .env.local
```

完成后：

```powershell
git diff --stat
git status --short
```

敏感信息扫描示例：

```powershell
rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' --glob '!.env.local' `
  '(Bearer\s+[A-Za-z0-9._-]+|Authorization\s*:|API[_-]?KEY\s*=\s*\S+|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY)' .
```

扫描命中变量模板不等于泄露，需要检查是否存在真实值。

### 14.7 发布到 GitHub

仅在用户明确授权创建/更新远程仓库时执行。当前目标：

- GitHub 用户：`ZTKyo`
- 仓库：`eoe-chat`
- License：MIT
- Copyright：ZTKyo
- `docs/`：公开
- `artifacts/`：不公开

新仓库示例：

```powershell
git status --short
git add <明确确认的文件>
git commit -m "Prepare EOE Chat release"
gh repo create ZTKyo/eoe-chat --public --source . --remote origin --push
```

已有仓库不要重复创建；先检查：

```powershell
git remote -v
git fetch origin
git status --short
```

不得擅自 push，不得用 `git reset --hard` 或 destructive checkout 覆盖用户改动。

### 14.8 Vercel 部署

1. 在 Vercel 选择 **Continue with GitHub**；
2. 导入 `ZTKyo/eoe-chat`；
3. Project Name：`eoe-chat`；
4. Application Preset：Next.js；
5. Root Directory：`./`；
6. 添加第 12 节 Production Environment Variables；
7. Secret 标记为 Sensitive；
8. Deploy；
9. 验证 `/access`、密码、聊天、Manifest、Service Worker、Icons；
10. 验证 Desktop 和 Mobile 安装。

GitHub Pages 不能完整托管本项目，因为 `/api/chat` 需要服务端运行。

### 14.9 Production 验证

```text
/access
/manifest.webmanifest
/sw.js
/icons/192
/icons/512
```

检查：

- 未登录跳转 `/access`；
- 错误密码被拒绝；
- 正确密码进入聊天；
- 文本请求返回真实 Provider 结果；
- 图片入口关闭；
- Developer Mode 不暴露；
- IndexedDB 历史刷新后保留；
- PWA 可安装；
- AI 断网时不声称可离线生成。

---

## 15. 必需资料集合

### 15.1 原始产品资料

必须完整阅读：

- `EOE_White_Paper_v1.0.docx`
- `EOE_Software_Specification_v1.0.docx`
- `EOE_Development_Guide_v1.0.docx`

它们定义了 Conversation-First、External State、Overlay-not-Teacher、Adaptive 的长期愿景、Validator-before-Display 和 Replaceable Providers。

### 15.2 当前最高优先级规范

- `README.md`
- `docs/PRODUCT_CONSTITUTION.md`
- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `docs/PWA_INSTALLATION.md`
- `docs/PRIVACY.md`
- `.env.example`

### 15.3 M0/M1 基础 Contract

- `docs/m0/PRODUCT_CONTRACT.md`
- `docs/m0/CONVERSATION_FUNCTIONS_v1.md`
- `docs/m0/DATA_MODEL_v1.md`
- `docs/m0/PROGRESSION_POLICY_v1.md`
- `docs/m0/PROVIDER_CAPABILITY_MATRIX.md`
- `docs/m0/STRUCTURED_RESPONSE_SCHEMA_v1.md`
- `docs/m0/VALIDATION_POLICY_v1.md`
- `docs/m0/M1_ACCEPTANCE_CRITERIA.md`
- `docs/M1_COMPLETION_REPORT.md`

### 15.4 M2 Engine Contract

- `docs/m2/M2_IMPLEMENTATION_CONTRACT.md`
- `docs/m2/PHRASE_REGISTRY_DESIGN.md`
- `docs/m2/SCHEDULER_POLICY_v1.md`
- `docs/m2/CANDIDATE_SELECTION_POLICY_v1.md`
- `docs/m2/DIRECTIVE_CONTRACT_v1.md`
- `docs/m2/M2_VALIDATOR_RULES_v1.md`
- `docs/m2/M2_ACCEPTANCE_CRITERIA.md`
- `docs/m2/M2_COMPLETION_REPORT.md`

### 15.5 Provider Template 与 Control Plane

- `docs/m2.1/NATURALNESS_CONTRACT_v1.md`
- `docs/m2.1/SEGMENT_BOUNDARY_POLICY_v1.md`
- `docs/m2.2/PROVIDER_GENERATION_ENVELOPE_v1.md`（历史/Deprecated）
- `docs/m2.2/ROOT_CAUSE_ANALYSIS.md`
- `docs/m2.3/CONTROL_PLANE_OWNERSHIP_v1.md`
- `docs/m2.3/PROVIDER_RESPONSE_TEMPLATE_v1.md`
- `docs/m2.3/TEMPLATE_VALIDATION_POLICY_v1.md`
- `docs/m2.3/PHRASE_REALIZATION_POLICY_v1.md`
- `docs/m2.3.2/PHRASE_FRAME_DECISION.md`

### 15.6 Task Completeness 与自然度

- `docs/m2.4/TASK_COMPLETENESS_CONTRACT_v1.md`
- `docs/m2.4/NATURAL_OVERLAY_POLICY_v2.md`
- `docs/m2.4/NO_FIT_CALIBRATION_POLICY_v1.md`
- `docs/m2.4/MULTI_TURN_CONTEXT_CONTRACT_v1.md`
- `docs/m2.4/VOCABULARY_ASSISTANCE_CONTRACT_v1.md`
- `docs/m2.4/LIVE_SAFE_PHRASE_POLICY_v2.md`
- `docs/m2.4/INDEPENDENT_HUMAN_REVIEW_INPUT.md`

### 15.7 Text-First 与专项质量策略

- `docs/m2.4.1/IMAGE_OVERLAY_POLICY_v1.md`
- `docs/m2.4.1/VISION_OBSERVATION_CONTRACT_v1.md`
- `docs/m2.4.1/VOCABULARY_ASSISTANCE_CONTEXT_v2.md`
- `docs/m2.4.1/PLAN_COMPLETENESS_POLICY_v2.md`
- `docs/m2.4.1/USER_PHRASE_REUSE_POLICY_v1.md`
- `docs/m2.5/TEXT_FIRST_BETA_SCOPE.md`
- `docs/m2.5/IMAGE_FEATURE_DEFERRAL.md`
- `docs/m2.5/TEXT_BETA_ACCEPTANCE_CRITERIA.md`
- `docs/m2.5.1/COMPARISON_DECISION_REQUIREMENTS_v1.md`
- `docs/m2.5.1/DAILY_ADVICE_REQUIREMENTS_v1.md`
- `docs/m2.5.1/PHRASE_REFERENCE_RESOLUTION_v1.md`
- `docs/m2.5.1/TECHNICAL_SEGMENT_CLASSIFICATION_v1.md`

### 15.8 RC Hard / Soft 与前提保存

- `docs/text-beta-rc/HARD_SOFT_VALIDATION_POLICY_v1.md`
- `docs/text-beta-rc/QUANTITATIVE_CLAIM_POLICY_v1.md`
- `docs/text-beta-rc/RESPONSE_DEPTH_POLICY_v1.md`
- `docs/text-beta-rc/TEMPORARY_OVERLAY_PREFERENCE_v1.md`
- `docs/text-beta-rc/CONTEXTUAL_ACKNOWLEDGEMENT_POLICY_v1.md`
- `docs/text-beta-rc/BETA_BILINGUAL_FRAME_POLICY_v1.md`
- `docs/text-beta-rc-final/PREMISE_PRESERVATION_POLICY_v1.md`
- `docs/text-beta-rc-final/TECHNICAL_COMPARISON_REQUIREMENTS_v1.md`
- `docs/text-beta-rc-final/ENGINE_OWNED_EXECUTION_ACCOUNTING_v1.md`

### 15.9 人工审核与真实使用

- `docs/private-text-beta/human-review/TEXT_BETA_RC_FINAL_INDEPENDENT_HUMAN_REVIEW.md`
- `docs/private-text-beta/human-review/TEXT_BETA_RC_FINAL_REVIEW_CHECKLIST_COMPLETED.md`
- `docs/private-text-beta/PRIVATE_BETA_STATUS.md`
- `docs/private-text-beta/PRIVATE_BETA_RELEASE_NOTES.md`
- `docs/private-text-beta/REAL_USE_GUIDE.md`
- `docs/private-text-beta/REAL_USE_FAILURE_TEMPLATE.md`
- `docs/private-text-beta/REAL_USE_REVIEW_RULES.md`

人工审核原始输入高于自动自然度 PASS。不得由开发 Agent 自评覆盖。

### 15.10 不应交给其他 Agent 的资料

- `.env.local`
- 真实 API Key；
- Access Password；
- Session Secret；
- Authorization / Bearer 值；
- 未脱敏 Live Response；
- 完整 Provider Directive；
- 用户聊天隐私；
- Base64 图片；
- `artifacts/` 整体；
- `node_modules/`；
- `.git/`；
- 缓存和临时运行文件。

---

## 16. 测试要求

### 16.1 Unit / Integration

至少覆盖：

- Phrase Registry Schema；
- Conversation Analyzer；
- Scheduler；
- Candidate Selector；
- Directive Builder；
- Provider Template Parser；
- Template Validator；
- Template Mapper；
- Structured Response Parser；
- Hard Validator；
- Soft Quality Review；
- Task Completeness；
- Retry；
- Answer-Preserving Fallback；
- Natural Fallback；
- ExposureEvent；
- GenerationAttempt；
- AssistanceRequest；
- Developer Diagnostics；
- Provider Error Normalization；
- Execution Isolation；
- Budget Guard；
- IndexedDB Migration；
- M1 Regression。

### 16.2 MockProvider 确定性场景

至少覆盖：

1. 合法 `noFit`；
2. 合法 English Chunk；
3. 非法 Phrase ID；
4. 自动中文释义；
5. Teacher Mode；
6. Overlay Budget 超限；
7. Broken JSON；
8. 第一次失败、第二次成功；
9. 两次失败并 Fallback；
10. Provider Retryable Error；
11. Provider Non-retryable Error；
12. Placeholder 重复；
13. Placeholder 缺失；
14. Label-like Phrase；
15. Soft Warning 后保留有效 Attempt 1；
16. Engine-owned acknowledgement，0 Provider Attempt。

### 16.3 Golden Corpus

至少覆盖：

1. 日常闲聊；
2. 观点讨论；
3. 计划和建议；
4. 情绪支持；
5. 技术解释；
6. 图片分析历史场景（不作为当前 Beta Release Gate）；
7. 极短回复；
8. 用户主动英语；
9. 明确要求中文；
10. 没有自然 Overlay；
11. 多轮前提保存；
12. 成本/时间/数字比较；
13. `any` vs `unknown` 等技术概念；
14. Vocabulary Assistance；
15. 用户主动 Phrase 复用；
16. Provider 有效答案但 Overlay 失败。

检查：

- 是否回答真实意图；
- 是否错误翻译用户；
- 是否 Teacher Mode；
- 是否自动解释英语；
- 是否中文主承载；
- Phrase 是否来自候选；
- 英文是否自然；
- 是否超过 Budget；
- `noFit` 是否合理；
- Fallback 是否回答或诚实保留用户问题；
- 用户前提是否保留；
- 是否编造精确数字；
- Attempt 和 Provider Request 计数是否真实。

### 16.4 E2E

- Desktop；
- 390×844 Mobile；
- 多会话；
- IndexedDB；
- PWA；
- Access Gate；
- Semantic Segment；
- Assistance；
- Explicit Chinese；
- Mock `Live requests=0`；
- E2E 不依赖 Live Provider；
- 不允许因异步 UI Race 产生假失败。

---

## 17. 里程碑和历次命令演进

| 阶段 | 用户核心命令 | 结果 / 影响 |
|---|---|---|
| Initial Plan | 完整读三份文档，先理解和计划，不写代码 | 建立 Plan-first 和审批边界 |
| M0 | 冻结产品 Contract、Conversation Function、Data、Provider、Schema、Validation | 建立不可随实现漂移的工程边界 |
| M1 | 完成普通聊天、IndexedDB、PWA、图片、Provider Gateway、Mock 和 E2E | 成为后续不得大改的稳定基础 |
| M1 Closeout | 同步真实 Evidence，解释 EOE/ACLAE 命名，Key 存在才做 Live Smoke | 验收状态与真实证据对齐 |
| M2 | Fixed Level Overlay Alpha；Registry、Scheduler、Selector、Directive、Segments、Validator、Retry、Fallback、Exposure、Panel | 不启动 Adaptive |
| M2.1 | 修复 Phrase Label / Boundary 自然度，扩展 Benchmark 和人工审核 | Naturalness 从“分数”提升为真正 Gate |
| M2.1 Live | 只做真实 Provider Validation | 不得用 Mock 冒充 Live |
| M2.2 | 修复真实 Provider 结构化 Contract | 不放宽 Validator；简化输出 |
| M2.3 | Engine 重新取得 Control Plane | Provider Template + Placeholder |
| Autonomous M2 | 有限自主诊断和最多三轮修复 | 达到阻断条件即停止，不自动进 M3 |
| M2.3.2 | 修复 DeepSeek Phrase Boundary 和 Budget Guard | 原始边界阻断关闭 |
| M2 Final | GLM/DeepSeek 技术 Corpus 验证 | 技术通过不等于人工自然度通过 |
| M2.4 | 以独立人工审核为事实输入修任务完成和自然度 | Human Review 优先 |
| M2.4.1 | 图片 Scope Correction、Assistance、Plan、Phrase Reuse | 图片不再成为 Text Beta Gate |
| M2.4.2 | 隔离 Mock E2E 和 Live Runtime，强化 Budget Ledger | 防止测试误调用真实 Provider |
| M2.5 | Text-First Fixed-Level Beta | 图片入口默认关闭 |
| M2.5.1 | 修建议、TypeScript、Daily Advice、Phrase Ambiguity | 技术 Validator 仍出现 False Positive |
| Manual Review | 冻结工程结果，独立人工审核 | 不预选人工 PASS |
| Text Beta RC | 按人工失败做有限质量校准 | Hard/Soft 分离 |
| RC Final | 修 TypeScript、Premise、Context Ack、Attempt Accounting | 工程状态冻结，转人工审核 |
| Human Final | 私人个人 Text Beta PASS with known limitation | 不启动 M3 |
| Private Launch | Freeze、PWA、真实使用交接 | 收集真实失败，而不是继续自动修 |
| GitHub/Vercel | MIT 开源，Vercel 密码访问，50 次/日，Docs 公开、Artifacts 私有 | 当前可安装 Web App |
| Real-use P0/P1 | P0 有效答案被 Fallback 覆盖；P1 延迟 | 保留安全答案；第二次质量 Retry 关闭 Overlay |

---

## 18. 已知不一致与正确解释

### 18.1 M3 路线图与当前实现

原始开发指南把 Validator、Telemetry、Vocabulary Assistance 放在 M3。实际开发中，为了让固定等级 M2 可安全展示，确定性 Validator、Diagnostics 和用户触发 Assistance 已提前实现。

正确解释：

- 已实现这些能力不代表 M3 已开始；
- Adaptive Progression、Mastery 和自动升级仍关闭。

### 18.2 M1 图片能力与 Text-First Beta

M1 实现过图片选择、持久化和 Vision Routing；M2.5 以后新图片入口被明确延期。

正确解释：

- 保留历史代码和数据迁移；
- 当前 UI 默认不允许新图片；
- 图片不是当前 Release Gate。

### 18.3 Private-only 与 Vercel Deployment

历史人工审核只批准 private/local use，并明确当时不批准 public launch。之后用户明确授权：

- GitHub 公开源码；
- Vercel 部署；
- Access Password；
- 每日 50 次；
- Docs 公开；
- Artifacts 私有。

当前可以按后续授权维持密码保护部署，但不能把它宣传为匿名公开、多人稳定正式产品。

### 18.4 Technical PASS 与 Human FAIL

自动 Schema、Validator 和 Corpus 通过，只能证明工程结构满足规则，不能证明英语自然、回答完整。

正确解释：

- 产品自然度和任务完成度冲突时，以独立人工审核为准；
- 自动测试仍用于防回归。

### 18.5 noFit 的演进

早期强调 `noFit` 是成功结果；后续发现 `noFit` 可能被滥用来逃避任务。

当前定义：

- Overlay 的 `noFit` 是成功；
- 普通对话仍必须完整回答；
- `noFit` 不能成为空回答、模板答复或任务替换。

### 18.6 Fallback 的演进

早期规则是两次失败后统一 Natural Fallback；真实使用证明这会覆盖第一次有效答案。

当前定义：

- 优先保留任何 Hard-valid、实质回答用户问题的结果；
- Soft Warning 不触发 Natural Fallback；
- 只有无安全内容时才真正 Fallback。

---

## 19. 风险

1. **Provider 非确定性**：同一 Directive 可能产生不同质量，Live 结果不能只看一次。
2. **结构化输出兼容**：JSON Mode 不等于严格 JSON Schema，必须继续本地 Parser/Validator。
3. **自然度不可完全确定化**：规则可发现明显边界错误，但不能替代人类判断。
4. **Validator False Positive**：技术同义表达或建议可能被误判，必须保留 Hard/Soft 分离。
5. **任务完整性与延迟冲突**：二次生成增加时间；不能为速度跳过 Hard Gate。
6. **Phrase Boundary**：中英文直接拼接、标签式短语、重复 Placeholder 会迅速破坏体验。
7. **Fallback 覆盖答案**：任何后续改动都必须回归 P0。
8. **用户前提丢失**：建议和比较场景最容易替换成本、时间和方向关系。
9. **限额可绕过**：当前 Signed Cookie Daily Limit 不适合匿名公网。
10. **本地数据易丢失**：清 Site Data 会删除历史，且无云同步。
11. **PWA 离线误解**：Shell 可离线，AI 不能。
12. **Provider 隐私**：用户内容会发送到配置的模型服务。
13. **无网页浏览工具**：当前模型回答不等于实时联网检索；若加入 Web Retrieval，必须作为独立可审计能力设计。
14. **Artifacts 泄露**：Live Corpus、截图、Directive 和原始响应必须继续保持私有。
15. **历史文档漂移**：新 Agent 可能误用 Deprecated Envelope 或旧 Acceptance 状态。

---

## 20. 推荐改进

以下属于未来维护建议，不等于授权启动 M3：

1. 在匿名或多用户前，用账号认证和 Durable Redis/KV 限额替换 Cookie Quota。
2. 持续收集真实失败对话，只修高频、可复现、影响真实使用的问题。
3. 为 P0 增加永久回归：任何 Hard-valid 实质答案不得被泛化 Fallback 覆盖。
4. 将 Attempt Latency、Provider Latency、Validation Time 分开记录，避免凭感觉优化。
5. 保留“质量 Retry 关闭 Overlay”的策略，并用真实数据判断是否还需要第二次生成。
6. 继续减少 Assistance 模板感，但不要加入课程化 UI。
7. 优化 Desktop 过多留白和 Mobile Composer 高度，但不要变成 UI 重做。
8. 对 Provider Model ID、Endpoint 和价格定期按官方文档重新验证。
9. 如果加入实时联网能力，必须明确显示来源、时间边界和失败状态，不能让模型假装浏览。
10. M3 只有在真实使用证据足够、用户另行批准后，才讨论 Adaptive Progression。

---

## 21. 当前参考实现状态

截至本指南生成时的参考状态：

- 本地工作分支最新功能提交：
  - `200885d`：修复 Answer-Preserving Fallback 和 Retry Latency
  - `eded068`：稳定 Multi-turn E2E Response Wait
- GitHub Public `main`：
  - `1f79343`：对应 P0/P1 修复
  - `9d530b6`：对应 E2E 稳定修复
- 已知最终本地门禁：
  - Lint：PASS
  - Typecheck：PASS
  - Build：PASS
  - Unit/Integration：427 passed，9 live suites skipped
  - E2E：22/22 PASS
- 已知公开 Staging/CI：
  - Lint：PASS
  - Typecheck：PASS
  - Build：PASS
  - Test：370 passed，12 skipped
  - GitHub CI：PASS
- PWA Manifest、Service Worker、192/512 Icons：部署后已验证可访问
- 本轮指南生成没有调用 Live Provider
- M3：未启动
- Adaptive Progression：关闭
- Image Input：关闭

这些数字是当前参考快照。以后提交代码后必须重新执行命令，不能沿用旧 PASS。

---

## 22. 真实使用问题记录方式

不要在聊天历史里混入“请修改程序”的普通消息作为唯一记录。推荐为每个问题建立一条独立记录：

```md
# EOE Chat Real-Use Issue

- 日期：
- 严重度：blocker | major | minor | polish
- 类型：
  ordinary_answer_wrong |
  ordinary_answer_shallow |
  context_lost |
  premise_omitted |
  premise_replaced |
  unsupported_fact |
  english_chunk_awkward |
  assistance_templated |
  validator_false_positive |
  ui_usability |
  latency |
  other
- 是否可稳定复现：是 | 否 | 不确定

## 对话证据

- 用户原始输入：
- 必要前文：
- 实际显示回答：
- 是否含 English Chunk：
- 是否遗漏/替换前提：
- 是否编造数字：
- 是否上下文重置：
- 大致等待时间：

## 影响与期望

- 实际影响：
- 期望行为：
- 最小复现步骤：
- 设备/浏览器：
- 截图：
```

不要记录：

- API Key；
- Token；
- Password；
- Authorization；
- 无关隐私；
- 完整内部 Directive。

---

## 23. 交给其他 Agent 的可复制主指令

下面内容可以直接复制给另一个 Agent。把三份原始 DOCX 和本仓库一起提供给它。

```text
你要构建或接手一个名为 EOE Chat 的应用，核心是 English Overlay Engine。

工作目录可以继续叫 ACLAE；不要为了命名进行目录迁移。ACLAE 只代表未来可能扩展的 Adaptive Conversational Language Acquisition 架构。当前正式名称是 EOE Chat 和 English Overlay Engine。

在写任何代码前：

1. 完整读取：
   - EOE_White_Paper_v1.0.docx
   - EOE_Software_Specification_v1.0.docx
   - EOE_Development_Guide_v1.0.docx
   - docs/handoff/EOE_AGENT_APPLICATION_BUILD_GUIDE.md
2. 再读取指南第 15 节列出的当前权威资料。
3. 检查 git status、当前分支、最近提交、.env.local ignore 状态。
4. 不显示、复制、提交或记录任何真实 Key、Password、Session Secret 或 Authorization。

先建立自己的项目理解，再提交 Implementation Plan。Plan 至少包含：

1. 产品目标；
2. English Overlay Engine；
3. 软件架构；
4. 数据模型；
5. Provider 抽象；
6. Milestones；
7. 风险；
8. 不一致或缺失规范；
9. 改进建议。

在我批准 Plan 前不要写代码。

产品不可变原则：

- 用户真实问题优先；
- EOE Chat 首先是普通、自然、可靠的 AI 助手；
- Conversation Function 先于 Overlay；
- Naturalness 是 Hard Gate；
- English Coverage 是 Ceiling，不是 Quota；
- noFit 是正常结果，但普通答案仍必须完整；
- 不翻译或复述用户问题来代替回答；
- 不进入 Teacher Mode；
- 不自动给释义、音标、定义、练习、背诵或课程；
- Assistance 必须由用户触发；
- Engine 拥有 Phrase ID、状态、选择、验证、重试、Fallback 和 Exposure；
- Provider 只负责自然表达；
- UI 直接渲染 Semantic Segments；
- Provider 输出不得直接渲染。

当前范围：

- Text-First；
- Fixed Progression Level，默认 Level 2；
- Effective Level 可单轮降低；
- 不自动 Promotion/Demotion；
- 不启动 M3；
- 不启动 Adaptive Progression；
- 不实现 Mastery；
- 图片入口关闭；
- 不大规模重做 UI；
- 保留 M1 聊天、IndexedDB、PWA 和 Provider 基础设施。

当前 Provider Template：

- schemaVersion 必须是 eoe.provider-template.v1；
- Provider 只返回 schemaVersion、usePhrase、responseTemplate 和条件式 noFitReason；
- 唯一 Placeholder 是 {{EOE_PHRASE}}；
- Engine 负责插入 Registry Phrase、映射 eoe.response.v2 Segments 并验证；
- 最多两次完整 Generation Attempt；
- Soft Warning 不能单独触发 Natural Fallback；
- 有 Hard-valid 实质答案时必须保留，不能被泛化 Fallback 覆盖；
- 第二次质量 Retry 应关闭 Overlay，优先完成用户任务。

实现或修改后必须真实执行：

npm install
npm run lint
npm run typecheck
npm run test
npm run benchmark:eoe
npm run benchmark:structure
npm run build
npm run test:e2e

Mock E2E 必须确认 Live Provider Request=0。

除非我单独明确授权，否则：

- 不运行任何 test:live-*；
- 不调用真实 Provider；
- 不创建远程仓库；
- 不 push；
- 不 deploy；
- 不开始新的自动修复阶段；
- 不修改冻结的人工审核结论。

完成后报告：

- 修改文件；
- 架构影响；
- 数据迁移影响；
- Provider 影响；
- Validator/Retry/Fallback 行为；
- 全部实际执行命令及真实结果；
- Desktop 和 390×844 Mobile 结果；
- Secret Scan；
- git diff --stat；
- 是否有 Live Request；
- 已知限制；
- 不要声称未验证内容通过。
```

用户批准 Plan 后，可补充：

```text
我批准该 Implementation Plan。现在可以在已批准范围内实施。

继续遵守 docs/handoff/EOE_AGENT_APPLICATION_BUILD_GUIDE.md。
不要重新进行大范围架构评审，不要重写稳定的 M1 基础设施，不要启动 M3 或 Adaptive Progression。
先实现最小可泛化修复，再运行完整质量门禁并提交真实报告。
```

---

## 24. 最终验收清单

### 产品

- [ ] 用户问题得到完整回答；
- [ ] 普通答案不会因 Overlay 失败被抹掉；
- [ ] 英文自然且来自 Registry/Selection；
- [ ] 无自然 Phrase 时合法 `noFit`；
- [ ] 不进入 Teacher Mode；
- [ ] 不自动释义或发音；
- [ ] 不替换用户前提；
- [ ] 不编造无依据精确数字；
- [ ] 明确中文要求得到遵守；
- [ ] 多轮上下文没有重置。

### Engine

- [ ] Conversation Function 先运行；
- [ ] Scheduler 先于 Selector；
- [ ] Fixed Level 不自动改变；
- [ ] Effective Level 只单轮生效；
- [ ] Provider Template 严格解析；
- [ ] Phrase ID 由 Engine 拥有；
- [ ] Semantic Segments 由 Engine 构建；
- [ ] Hard Validator 在展示前运行；
- [ ] 最多两次 Attempt；
- [ ] Soft Warning 不触发 Fallback；
- [ ] 只有最终显示 Phrase 创建 Exposure；
- [ ] Diagnostics 已脱敏。

### 基础设施

- [ ] M1 多会话未回归；
- [ ] IndexedDB Migration 未破坏历史；
- [ ] PWA 可安装；
- [ ] Desktop 可用；
- [ ] 390×844 Mobile 可用；
- [ ] Mock E2E Live Request=0；
- [ ] `.env.local` 被忽略；
- [ ] `artifacts/` 未公开；
- [ ] Secret Scan 无真实值；
- [ ] Production Fail-Closed；
- [ ] Access Gate 和每日 50 次配置生效。

### 报告

- [ ] 每条 PASS 有真实 Evidence；
- [ ] Live 未执行就标记 Not Executed；
- [ ] 人工审核不被自动结果覆盖；
- [ ] `git diff --stat` 已输出；
- [ ] 未擅自 push/deploy；
- [ ] M3 和 Adaptive Progression 仍关闭。
