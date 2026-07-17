# M2.1 Acceptance Criteria

状态：`PASS_WITH_LIVE_PROVIDER_PENDING`

状态只可为 PASS、PASS_WITH_LIVE_PROVIDER_PENDING、BLOCKED 或 FAIL。以下勾选仅表示有对应的真实证据；未执行的 Live Provider 调用保持未勾选。

- [x] 1. 不再生成默认的“English Phrase：中文说明”格式。
  - Evidence：Directive v1.1 禁止标签式拼接；Hard Validator 新增 `label_like_overlay`；45 场景 MockProvider Benchmark 未生成该默认格式。
- [x] 2. English Chunk 能出现在自然的句中位置。
  - Evidence：`step by step` 在桌面端及 390×844 移动端真实聊天中均位于完整中文句子的中间；E2E 与组件测试覆盖句中渲染。
- [x] 3. Phrase Position 与语法属性匹配。
  - Evidence：Registry v1.1 为全部 50 个 Phrase 增加语法角色、允许位置、双语模式和风险属性；Selector 在进入候选池前执行结构适配门槛；Validator 检查 `phrase_position_violation` 与 `grammatical_role_mismatch`。
- [x] 4. Plain Text Projection 是完整自然句子。
  - Evidence：Segment 不再裁剪边界空白；自动化测试验证精确 Projection；真实界面显示“这个计划适合按 step by step 的节奏推进，先完成最小的一步。”且复制顺序保持完整。该项只确认结构与文本完整性，不替代独立自然度判断。
- [x] 5. English Chunk 默认视觉不再像 Badge 或学习卡片。
  - Evidence：真实浏览器计算样式为 `display: inline`、透明背景、四向 `padding: 0`、继承字号/行高；桌面和移动截图均已人工查看。
- [x] 6. Validator 能拦截标签式、孤立式和翻译式 Overlay。
  - Evidence：新增 `label_like_overlay`、`orphan_english_chunk`、`duplicated_translation`、`isolated_learning_card_style` 等确定性规则及对应测试。
- [x] 7. noFit 仍然是正常结果。
  - Evidence：45 场景中 31 个 `noFit` 均返回完整中文主导回复并通过 Validator；高风险和无结构适配候选时优先走该路径。
- [x] 8. M1 和 M2 功能不回归。
  - Evidence：完整 Vitest 为 111 passed、4 个 Live 测试因凭据缺失 skipped；Playwright 桌面与移动项目最终为 20 passed；生产构建通过。
- [x] 9. MockProvider 全部测试通过。
  - Evidence：合法 Chunk、noFit、非法 Phrase、翻译/Teacher Mode、预算、Broken JSON、两次尝试、Natural Fallback 及 Provider Error 场景均包含在完整测试中；非 Live 测试无跳过。
- [x] 10. 扩展 Golden Corpus 全部运行。
  - Evidence：`npm.cmd run benchmark:eoe` 实际结果为 45/45 passed；`npm.cmd run benchmark:naturalness` 生成 45 条逐场景证据报告。
- [x] 11. 至少保存 20 条可人工阅读的完整输出。
  - Evidence：`HUMAN_REVIEW_CHECKLIST.md` 保存 20 条完整 MockProvider 输出；`artifacts/benchmarks/m2.1-naturalness-report.md` 保存全部 45 条实际文本、候选、Segments、Projection、Validator 与 Attempt。
- [ ] 12. 如果存在真实密钥，完成三个 Provider 的 Live Smoke Test。
  - Evidence：`.env.local` 不存在，未发现用户凭据；GLM-4.7、GLM-4.6V、DeepSeek V4 Flash 及 GLM→DeepSeek Live Fallback 均未执行，不得标记为 Live Pass。
- [x] 13. 如果不存在真实密钥，明确保持 M2.1 Gate 未完全关闭。
  - Evidence：`npm.cmd run test:live-providers` 明确输出 `SKIPPED — missing user credentials`；Live Provider Gate 为 `BLOCKED_BY_MISSING_USER_CREDENTIALS`。
- [x] 14. 不得启动 Adaptive Progression。
  - Evidence：M2 固定等级逻辑保持不变，未实现长期自动升级或降级，M3 未启动。
- [x] 15. 不得以测试数量代替对实际文本的检查。
  - Evidence：已检查完整 45 条文本报告、20 条人工审核样本和桌面/移动真实聊天文本。机器只确认结构风险；自然度、回答充分性和语气仍标记为 `PENDING_INDEPENDENT_HUMAN_REVIEW`。

## Gate 结论

- 自动化、结构约束与真实 UI Gate：通过。
- Live Provider Gate：`BLOCKED_BY_MISSING_USER_CREDENTIALS`。
- 独立人工自然度复核：待用户或独立审阅者完成，不伪造结论。
- 最终状态：`PASS_WITH_LIVE_PROVIDER_PENDING`，不具备进入 M3 的批准条件。
