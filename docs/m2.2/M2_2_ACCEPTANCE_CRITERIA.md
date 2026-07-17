# M2.2 Acceptance Criteria

当前 Gate：`LIVE_PROBE_FAIL`

状态标记必须基于真实证据；未执行项保持未勾选。Independent Human Review 未完成前，最高状态为 `M2_2_PASS_WITH_HUMAN_REVIEW_PENDING`。

## A. 证据与安全

- [x] M2.1 `LIVE_PROVIDER_FAIL` 报告保持不变并建立本地检查点。
- [x] `.env.local` 被忽略且未提交。
- [x] 修改前凭据、Bearer Token、私钥与本机隐私路径扫描无命中。
- [x] 修改后安全扫描无命中。
- [x] 未 push、未部署、未启动 M3 或 Adaptive Progression。

Evidence：基线检查点为 `0d0e497`；最终凭据、Bearer、私钥、本机隐私路径与报告完整 Directive marker 扫描均无命中；M2.1 Live 报告工作树哈希与检查点一致。

## B. Root Cause 与 Contract

- [x] `ROOT_CAUSE_ANALYSIS.md` 在 Parser 修改前完成。
- [x] 根因分析区分用户要求的十种可能性。
- [x] Provider Envelope 与 Domain Schema 分离。
- [x] Domain `MessageSegment` Schema 保持严格且未被替换。
- [x] Envelope 同时有 strict Zod Schema 与 provider-neutral JSON Schema。
- [x] Mapper 不修改自然语言、不猜测 Phrase、不做字符串修复。

Evidence：见同目录 `ROOT_CAUSE_ANALYSIS.md` 与 `PROVIDER_GENERATION_ENVELOPE_v1.md`。

## C. Parser、Retry 与 Diagnostics

- [x] Parser 分层诊断测试通过。
- [x] Attempt 1 失败 / Attempt 2 成功测试通过。
- [x] Attempt 2 失败 / Natural Fallback 测试通过。
- [x] Retry Directive 携带具体 Envelope code。
- [x] Developer Panel 显示 Pipeline 阶段与错误。
- [x] 最多两次 Generation Attempt。

Evidence：`npm run test` 141/141 非 Live 测试通过；Engine、Parser、Directive 和 Developer Panel 定向测试覆盖具体 stage/code。

## D. Mock、Persistence 与 Regression

- [x] 18 个要求的 Mock raw-response 场景均覆盖。
- [x] Exposure 只在最终验证并显示后写入。
- [x] IndexedDB 保存严格 Domain Segment 和 Pipeline Diagnostics。
- [x] Assistance Request 回归通过。
- [x] M1/M2/M2.1 回归通过。
- [x] Desktop 与 390×844 Mobile 通过。

Evidence：Vitest 23 files passed、Playwright Desktop/Mobile 20/20 passed；截图位于 `artifacts/screenshots/m2.2-*.png`。

## E. Non-Live Gate

- [x] `npm install`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test`
- [x] `npm run benchmark:eoe`
- [x] `npm run benchmark:naturalness`
- [x] `npm run build`
- [x] `npm run test:e2e`

Evidence：全部最终退出码 0；Vitest 141 passed、EOE 45 passed、Naturalness 1 passed、Playwright 20 passed。第一次 Playwright 自管 server 在测试后清理挂起，不计 Pass；受控 production server 重跑为最终证据。

## F. Live Probe（先于完整 Corpus）

- [x] GLM-4.7 noFit probe。
- [ ] GLM-4.7 English Chunk probe。
- [ ] GLM-4.6V noFit probe。
- [ ] GLM-4.6V English Chunk probe。
- [ ] DeepSeek V4 Flash noFit probe。
- [ ] DeepSeek V4 Flash English Chunk probe。
- [ ] 六条均通过后才允许运行完整 Live Corpus。

Evidence：任一失败则停止并标记 `LIVE_PROBE_FAIL`。

实际证据：1/6 passed；GLM English、GLM Vision 两条、DeepSeek 两条失败，完整 Corpus 未执行。原 discriminator 错误为 0；主要新阻断为 `conversation_function_changed` 与 English boundary violations。

## G. Full Live Gate

- [ ] 20 条现有 Golden Corpus 实际执行。
- [ ] Envelope → Domain Mapper Success Rate = 100%。
- [ ] Domain Schema Success Rate = 100%。
- [ ] Final Structured Response Success Rate >= 95%。
- [ ] 每个 Provider Final Structured Response Success Rate >= 90%。
- [ ] GLM → DeepSeek fallback 最终得到合法 Domain Response。
- [ ] Usage、Latency 与 Error Normalization 正常。
- [ ] Natural Fallback 未计入 Structured Response Success。

Evidence：只有六条 Live Probe 全部通过时才适用。

## H. Human Review 与阶段边界

- [ ] Independent Human Review 完成。
- [x] Independent Human Review 当前明确为 Pending。
- [x] M3 未启动。
- [x] Adaptive Progression 未启动。

Evidence：Human Review 只能由独立人工审核更新。
