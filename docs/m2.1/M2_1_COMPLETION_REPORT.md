# M2.1 Completion Report

状态：`LIVE_PROVIDER_FAIL`

完成日期：2026-07-17

M2.1 的 MockProvider、结构校验与回归基线仍然通过；本轮发现真实凭据并完成 Live Provider Validation。三个真实 Provider 均可连接，但完整 Gate 中真实响应的 `segments` 普遍缺少必需的 `type` discriminator，导致 Hard Validator 拒绝、Attempt 2 仍失败并进入 Natural Fallback，因此 Live Provider Gate 为 `LIVE_PROVIDER_FAIL`。独立人工自然度复核仍待完成。M3 未启动，Adaptive Progression 保持关闭。

## 1. M2 基线 commit

- 在 M2.1 修改前完成本地基线提交：`5b84c4f M2 baseline: fixed-level English Overlay Engine alpha`。
- 提交前确认 `.env.local` 不存在且被 Git 忽略，密钥/隐私扫描无命中。
- 未配置 Git remote，未 push，未创建远程仓库。

## 2. 修改的 Phrase Registry

- Registry 版本从 M2 更新为 `eoe.phrases.v1.1`。
- 对全部 Phrase 增加并审核：`grammaticalRole`、`preferredPositions`、`requiresSubject`、`requiresCopula`、`canStandAlone`、`punctuationCompatibility`、`bilingualPatterns`、`unsafePatterns`、`bilingualCompatibility`、`punctuationRisk`、`translationRisk`、`labelLikeRisk`。
- Naturalness Eligibility 变成进入候选池前的结构门槛；缺少安全双语模式、位置不匹配或风险过高的 Phrase 不再提供给 Provider。

## 3. Phrase 数量

- Registry 总数：50。
- 保留为 active：26。
- 修改/复核元数据：50。
- 禁用：24。
- 禁用重点包括需要完整英语主语/补语的 clause stem、冒号标签或直译风险高的表达、碎片化程度副词，以及只适合句首但缺乏安全双语框架的表达。

## 4. Directive 改动

- Directive 升级为 v1.1，要求先生成完整自然回复，再输出 Semantic Segments。
- 指定 Phrase 只是可选候选；自然性不足必须返回 `noFit`。
- 明确禁止把 English Chunk 追加为标签、独立行、冒号说明、用户原话翻译或教学解释。
- 只传递本轮候选、语法角色、允许位置和双语模式，不传完整 Registry，也不允许字符串替换式修补。

## 5. Candidate Selector 改动

- 候选增加 `grammaticalFit`、`insertionPosition`、`allowedPositions`、`bilingualCompatibility`、`punctuationRisk`、`translationRisk`、`labelLikeRisk` 与 `responseLengthFit`。
- 先执行 active/等级/Conversation Function/Tone/cooldown，再执行语法角色、允许位置、安全双语框架和风险门槛。
- 语义适配由 Function frame、context hints 和近期 Exposure/Reuse 共同决定，不再只靠关键词机械匹配。
- 高风险场景不提供候选；情绪场景只允许低密度反应类候选；所有候选均可被拒绝并正常返回 `noFit`。

## 6. Validator 新规则

新增确定性 Hard Validator 规则：

- `label_like_overlay`
- `orphan_english_chunk`
- `unnatural_segment_boundary`
- `punctuation_boundary_error`
- `duplicated_translation`
- `phrase_position_violation`
- `grammatical_role_mismatch`
- `forced_overlay`
- `isolated_learning_card_style`

Hard Validator 始终先运行。新增受控 Soft Naturalness Validator，仅在首次使用、结构适配非 high、句首、高风险、Segment 过多、Benchmark/Live 等条件触发；它只输出 `natural/confidence/issues/suggestedAction`，不会改写字符串。拒绝后由 Engine 完整重生成，最多两次；仍失败则进入中文主导 Natural Fallback。

## 7. UI 改动

- English Chunk 改为轻量 inline 文本：透明背景、零 padding、继承字号/行高，仅保留轻微点状下划线和点击 Assistance Request。
- `aria-label` 与实际英文内容一致，屏幕阅读器按正常句子读取。
- 未自动显示翻译、音标、定义或学习卡片。
- 真实浏览器样式：桌面 1280×720 与移动 390×844 均为 `display: inline`、透明背景、`padding: 0`；移动页面 `scrollWidth === clientWidth === 390`，无横向溢出；控制台错误为 0。

## 8. Expanded Benchmark 结果

- Golden Corpus：45 个场景，覆盖日常、观点、计划、建议、情绪支持、医疗/法律/金融、技术解释、图片、极短回复、用户主动英文、明确中文、无候选、不同 Conversation Function 与 Level 1/2/3。
- English Chunk：14 个场景。
- `noFit`：31 个场景。
- Natural Fallback：1 个场景。
- `npm.cmd run benchmark:eoe`：45/45 passed。
- `npm.cmd run benchmark:naturalness`：1/1 passed，并生成 `artifacts/benchmarks/m2.1-naturalness-report.md`。
- 这些是 MockProvider 的确定性结构基线，不作为真实 Provider 自然度证据。

## 9. 至少 20 条实际输出摘要

- `docs/m2.1/HUMAN_REVIEW_CHECKLIST.md` 保存 20 条完整可阅读输出，包含 Chunk、noFit、高敏感度、高风险和 Natural Fallback 样本。
- `artifacts/benchmarks/m2.1-naturalness-report.md` 保存全部 45 条实际文本，以及 Conversation Analysis、Scheduler、Candidate Pool、Structured Response、Plain Text Projection、Validator、Naturalness Review 与 Attempts。
- 浏览器实测文本为：“先明确唯一必须达成的结果和不能突破的限制，再选择一个成本低、可逆、今天就能验证的步骤。这个计划适合按 step by step 的节奏推进，先完成最小的一步。”

## 10. Human Review 结果

- 状态：`PENDING_INDEPENDENT_HUMAN_REVIEW`。
- 已完成机器结构预检和本轮真实 UI 文本检查，确认没有标签式展示、自动翻译、边界破损、超预算或非法 Phrase ID。
- 未由同一个生成模型自我宣布“全部自然”。英文自然度、回答充分性、语气、删除英文是否破坏原意、是否值得保留及是否应 `noFit`，保留给独立人工审核。

## 11. MockProvider 测试

- MockProvider 改为根据 Registry 的安全 `bilingualPatterns` 直接生成 Semantic Segments，不再先生成字符串再插入 Phrase。
- 覆盖合法 noFit、合法 Chunk、非法 Phrase ID、自动释义、Teacher Mode、Overlay 超预算、Broken JSON、第一次失败第二次成功、两次失败 Natural Fallback、Provider retryable/non-retryable error。
- 完整 Vitest 最终结果：19 个文件 passed、1 个 Live 文件 skipped；111 个测试 passed、1 个 Live Gate 测试 skipped。非 Live 测试无跳过、无失败。

## 12. Live Provider Validation

### 1. M2.1 checkpoint commit

- 安全检查通过后创建本地提交：`3ce797b M2.1 checkpoint: naturalness gate with live validation pending`。
- `.env.local` 未被提交；仓库没有 remote，未 push，未修改 Git 全局身份。

### 2. 是否发现真实密钥

- `.env.local` 存在且被 `.gitignore` 忽略。
- `USE_MOCK_PROVIDER=false`、`GLM_API_KEY`、`DEEPSEEK_API_KEY` 均确认存在；只记录存在性，未输出值。
- 凭据、Bearer Token、私钥与隐私扫描均无工作树文件命中。

### 3. GLM-4.7 测试结果

- 最小连通性探针真实通过；模型请求 ID 为配置的 `glm-4.7`，Usage 与 Latency 可记录。
- 完整 Gate 执行 10 条 Golden Corpus 加 1 条句首探针；11/11 均到达真实 GLM 并取得成功 HTTP 响应，但最终均因 Structured Response 不符合 Schema 进入 Natural Fallback。
- 主要阻断：文本 Segment 包含 `language/content`，但缺少 `type: "text"`。

### 4. GLM-4.6V 测试结果

- 使用可安全提交的 `tests/fixtures/eoe-live-vision-fixture.svg`，测试时在内存转换为 PNG Base64。
- 5 条真实视觉请求均路由到 `glm-4.6v`，覆盖主内容、图片问答、图文联合分析、noFit 和 Overlay；真实请求成功，但最终均因相同 Segment discriminator 问题进入 Natural Fallback。
- 错误格式与超过 5 MiB 的图片在请求边界被拒绝；Cancellation 与 Timeout 均正确归一化。

### 5. DeepSeek V4 Flash 测试结果

- 最小连通性探针真实通过；模型请求 ID 为配置的 `deepseek-v4-flash`。
- 完整 Gate 对 8 条 Golden Corpus 执行真实请求，并执行 Validator Retry、错误结构、Timeout 与 Cancellation 控制场景。
- 8 条自然度语料均取得真实响应，但 Structured Response 同样未稳定满足 Segment Schema；Validator Retry 场景仍进入 Natural Fallback。

### 6. Fallback 测试结果

- 使用仅测试环境启用的受控 `provider_unavailable / retryable / 503` GLM 故障注入。
- 请求实际进入 DeepSeek，`providerFallback=true`，证明 Provider Fallback 路由有效。
- DeepSeek 返回后的结构仍未通过 Validator，因此最终进入 Natural Fallback；完整 `GLM → DeepSeek → Parser → Validator → Semantic Rendering` 链路未通过。
- Provider Retry=0、Provider Fallback=1、Validator Retry=27、Natural Fallback=27，四种状态分别记录，未混用。

### 7. 20 条真实 Provider Benchmark 结果

- 从现有 45 条 Golden Corpus 中选取 20 条：GLM 10、GLM Vision 2、DeepSeek 8。
- 覆盖日常、计划、建议、简单/复杂观点、情绪支持、技术解释、图片分析、用户主动英文、全中文、noFit、Phrase 复用及 Level 1/2/3。
- 逐条实际文本、候选、Structured Response、Projection、Validator、Attempts、Latency 和 Usage 见 `artifacts/benchmarks/live-provider-naturalness-report.md`。

### 8. Structured Output 成功率

- 完整 Gate 的 24 条非控制真实 Provider 场景：`0/24` 最终结构成功。
- 连接探针曾出现 4/4 成功，说明 Provider 具有生成正确 Schema 的能力，但在扩展场景中不稳定，不能据此宣布 Gate 通过。
- Zod 主要错误：`Invalid discriminator value. Expected 'text' | 'english_chunk'`。

### 9. Validator Retry 数量

- 27 个 Engine 场景触发 Attempt 2 / Validator Retry。
- Retry Directive 收到 `broken_structured_output` 后仍经常重复缺少 discriminator，未形成可靠恢复。

### 10. noFit 数量

- 最终记录 `noFit=true`：27。
- 这些多数来自 Natural Fallback，不应被误认为 Provider 正常生成的 noFit 成功。

### 11. Natural Fallback 数量

- Natural Fallback：27。
- Fallback 保留了中文可用回答且未向普通用户暴露内部错误，但这只能证明安全降级，不能证明 Live Provider Gate 通过。

### 12. Latency

- 24 条非控制真实场景：最小 3018 ms，平均 8225 ms，最大 29194 ms。
- 生产浏览器验证的一轮 GLM 请求：16828 ms，2 次 Attempts。

### 13. Token Usage

- 24 条非控制真实场景累计记录 49522 tokens。
- 生产浏览器验证的一轮 GLM 请求记录 3106 tokens。
- Usage 未在 UI 普通界面显示，仅在 Developer Panel 中显示。

### 14. Error Normalization

- GLM Vision Cancellation：`cancelled`，通过。
- GLM Vision Timeout：`timeout`，通过。
- DeepSeek Cancellation：`cancelled`，通过。
- DeepSeek Timeout：`timeout`，通过。
- 受控 GLM retryable error：`provider_unavailable / retryable / 503`，通过。

### 15. 执行的命令

```text
npm.cmd install
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run benchmark:eoe
npm.cmd run benchmark:naturalness
npm.cmd run build
PLAYWRIGHT_EXTERNAL_SERVER=true npm.cmd run test:e2e -- --reporter=list
npm.cmd run test:live-providers
npm.cmd audit
```

### 16. 测试真实 exit code

- install=0；lint=0；typecheck=0；test=0；benchmark:eoe=0；benchmark:naturalness=0；build=0；test:e2e=0。
- 最小 Live 探针=0（4/4）；完整 Live Provider Gate=1（1 个 Gate 测试失败）。
- npm audit=1（2 个 moderate vulnerabilities）。

### 17. npm audit 结果

- 包：`postcss`；路径：`next@16.2.10 → postcss@8.4.31`；advisory 影响范围 `<8.5.10`；`fixAvailable=false`。
- 问题是 CSS Stringify 对 `</style>` 未转义导致的 XSS 风险。项目源码没有直接 import 或调用 PostCSS，也没有处理用户提交 CSS 的运行时入口，因此当前可确认的暴露面主要位于 Next/Tailwind 构建工具链；仍保留为已知生产供应链风险。
- 未执行 `npm audit fix --force`，未强制升级稳定依赖。

### 18. Desktop 和 Mobile 验证

- 生产构建、真实 GLM、Desktop 1280×720：响应成功显示 Natural Fallback；Developer Panel 显示 `glm / glm-4.7`、16828 ms、3106 tokens、2 Attempts、两次 `broken_structured_output` 和 `natural=true` fallback 状态。
- Mobile 390×844：Composer 可见、无横向溢出、普通 UI 不显示 Developer Panel、内部 Prompt 或密钥；浏览器控制台错误为 0。
- English Chunk 数量为 0，因此“样式自然”和“点击记录 Assistance Request”无法完成真实 Provider 验证，记为未通过而不是跳过为 PASS。
- 截图：`artifacts/screenshots/m2.1-live-desktop.png`、`artifacts/screenshots/m2.1-live-mobile-390x844.png`。

### 19. Live Provider Gate 状态

- `LIVE_PROVIDER_FAIL`。
- Provider 连通、Usage/Latency、Cancellation、Timeout、Error Normalization 和 Fallback 路由有真实证据；Structured Parsing、English Chunk、Validator Retry 恢复与最终 Semantic Segment Rendering 未通过。

### 20. Independent Human Review

- 继续保持 `PENDING_INDEPENDENT_HUMAN_REVIEW`。
- 本报告只完成可自动检查项目，没有自行宣布真实自然度人工审核通过。

### 21. 是否具备进入 M3 的技术条件

- 不具备。必须先修正 Directive/Structured Output 兼容问题、重新完成 Live Gate、取得可展示的真实 English Chunk，并完成独立人工复核及用户明确批准。

## 13. 实际执行的命令

Windows PowerShell 使用 `npm.cmd` 等价执行 npm 命令：

```text
npm.cmd install
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run benchmark:eoe
npm.cmd run benchmark:naturalness
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run test:live-providers
npm.cmd audit
```

另外执行了 `.env.local` 忽略检查、密钥/隐私扫描、`git diff --check`、`git diff --stat`、桌面与移动端真实浏览器 QA。

## 14. 测试真实结果

| 命令 | 真实结果 |
|---|---|
| `npm.cmd install` | 成功；依赖已是最新，462 packages；报告 2 个 moderate vulnerabilities。 |
| `npm.cmd run lint` | 通过，0 warning。 |
| `npm.cmd run typecheck` | 通过。 |
| `npm.cmd run test` | 19 passed / 1 Live 文件 skipped；111 passed / 1 Live Gate 测试 skipped。 |
| `npm.cmd run benchmark:eoe` | 1 文件、45/45 tests passed。 |
| `npm.cmd run benchmark:naturalness` | 1/1 passed，报告已生成。 |
| `npm.cmd run build` | 通过；Next.js 16.2.10 生产构建成功。 |
| `PLAYWRIGHT_EXTERNAL_SERVER=true npm.cmd run test:e2e -- --reporter=list` | 退出码 0，20 passed（22.5s），覆盖 desktop 与 390×844 mobile。 |
| `npm.cmd run test:live-providers` 最小探针 | 退出码 0，GLM 文本、GLM 视觉、DeepSeek 文本、受控 fallback 共 4/4。 |
| `npm.cmd run test:live-providers` 完整 Gate | 退出码 1；20 条 Golden Corpus 和额外/控制场景实际执行，Gate 为 `LIVE_PROVIDER_FAIL`。 |
| `npm.cmd audit` | 退出码 1；Next.js→PostCSS 2 个 moderate 告警，`fixAvailable=false`。 |

## 15. Desktop 截图

- `artifacts/screenshots/m2.1-live-desktop.png`
- 1280×720；真实 GLM Natural Fallback 正常显示，Developer Panel 显示 Provider、Latency、Usage、Attempts 和 violations；无 Prompt/密钥泄露。

![M2.1 Live Desktop](../../artifacts/screenshots/m2.1-live-desktop.png)

## 16. Mobile 390×844 截图

- `artifacts/screenshots/m2.1-live-mobile-390x844.png`
- 390×844；真实响应与 Composer 正常显示，无横向溢出、无控制台错误、无内部信息泄露；因 Natural Fallback 没有 English Chunk。

![M2.1 Live Mobile 390x844](../../artifacts/screenshots/m2.1-live-mobile-390x844.png)

## 17. 已知限制

- 真实 Provider 的 Segment discriminator 生成不稳定，完整 Gate 24 条非控制场景最终结构成功率为 0/24。
- EngineDiagnostics 目前只保留配置并实际请求的 Model ID，不单独保留上游响应体的 `model` 字段；成功 HTTP 200 也未持久化为诊断字段。
- 当前 active Phrase 只允许 sentence-middle；GLM 句首 Phrase 探针无法完成，记录为兼容性限制。
- 真实 Provider 没有产生最终可展示 English Chunk，因此 Assistance Request 点击路径只能由 Mock E2E 验证，Live UI Gate 未完成该项。
- MockProvider 是确定性模板，只能验证结构、策略和回归，不能覆盖上述真实模型不稳定性。
- 20 条样本仍需独立人工复核；本报告不将机器自评当作人审结论。
- 26 个 active Phrase 是保守 Alpha 集合；被禁用 Phrase 需要在获得可靠双语框架和真实 Provider 证据后才能逐个恢复。
- `npm audit` 报告 Next.js→PostCSS 依赖链 2 个 moderate 告警，当前显示无可用修复；未为消除告警擅自升级或改写稳定基础设施。
- Playwright 内置 webServer 在本 Windows 环境有退出挂起；外部隐藏本地服务模式已验证全部 20 个 E2E 用例，但脚本层的 Windows 子进程收尾仍可后续优化。

## 18. M2.1 Gate 最终状态

- 自动化与回归 Gate：通过。
- MockProvider Naturalness Structure Gate：通过。
- Desktop / Mobile 布局与安全降级：通过；真实 English Chunk/Assistance 路径未通过。
- 安全与 Git Gate：通过；`.env.local` 存在但已忽略且未跟踪，最终密钥扫描 0、隐私扫描 0，`git diff --check` 无 whitespace error。
- Live Provider Gate：`LIVE_PROVIDER_FAIL`。
- 独立人工自然度复核：待完成。
- M2.1 最终状态：`LIVE_PROVIDER_FAIL`。

## 19. 是否具备进入 M3 的条件

不具备。本轮没有启动 M3，也没有启动 Adaptive Progression。进入 M3 至少需要：

1. 修正真实模型 Structured Response 中缺失 Segment `type` 的兼容问题，并通过完整 Live Gate；
2. 取得真实可展示 English Chunk，验证 UI 样式与 Assistance Request；
3. 对真实 Provider 输出完成独立人工复核并处理阻断性自然度问题；
4. 由用户显式批准进入 M3。

## 最终安全与 Git 说明

- 最终密钥扫描：0 个匹配文件。
- 最终隐私扫描：0 个匹配文件。
- `.env.local`：存在，且 `git check-ignore` 确认为 ignored；未被 Git 跟踪。
- M2.1 检查点 commit：`3ce797b`；Live Validation 结果保留在其后的本地工作区，未擅自提交。
- 未 push，未创建远程仓库，未删除用户文件。
