# Evidence Provenance

## 状态谱系

- 基线提交：`4d422f9`。
- M2.5 完整 Corpus：35/39，未重跑。
- M2.5.1 Targeted：3/4，未重标。
- Manual Review Candidate 是独立交接状态，不覆盖技术失败状态。

## 来源文件与 SHA-256

| 逻辑名称 | 路径 | SHA-256 |
| --- | --- | --- |
| corpusResults | `artifacts/benchmarks/m2.5-text-corpus-results.json` | `0b906adc8fa84112b7e4a5dcf1cb7c4614b3be44981b5477914cdf9955630204` |
| corpusBudget | `artifacts/benchmarks/m2.5-text-corpus-budget.json` | `85e5d16c40ff79ee005b30dc97e4313bb0866d4a31af4507703d1acc35c0291a` |
| focusedResults | `artifacts/benchmarks/m2.5-text-focused-results.json` | `3982fb01ce78554bd911519c7e735b050771ab8911ce2328ba75ffbf3e01fdc8` |
| focusedBudget | `artifacts/benchmarks/m2.5-text-focused-budget.json` | `1328676ffe4db8f2ec02646797adca1591c5b91cc9b7d55ff79440423d4ee5dc` |
| targetedResults | `artifacts/benchmarks/m2.5.1-targeted-results.json` | `253a7aa29fbc61b059bcffe428d75d7d3b1f1a2e4a43d03d4f65e09b1c08770c` |
| targetedBudget | `artifacts/benchmarks/m2.5.1-targeted-budget.json` | `8644af690ac89fb637b105029cbe657212989cffe6dca89e7b34e557055982a8` |
| targetedRetryResults | `artifacts/benchmarks/m2.5.1-targeted-retry-typescript-results.json` | `e700b461c20ad0819deae4a33167467dc45113523524307c894b9ab6a406df9c` |
| targetedRetryBudget | `artifacts/benchmarks/m2.5.1-targeted-retry-typescript-budget.json` | `0aadc165f20a85535926fdaca4387b1e2ffcc05a82508db4b4352ceee85cb8b1` |
| targetedPreflight | `artifacts/benchmarks/m2.5.1-targeted-preflight-failure-budget.json` | `c434635f4a7101c58bfd17c5f90b6e12c34796492a68c05f808d9e5358ed545f` |
| m25Report | `docs/m2.5/M2_5_COMPLETION_REPORT.md` | `29aca9b189227e0acb7da909e7e97d6f3538d1b89f44fd52732532c35850c4c1` |
| m251Report | `docs/m2.5.1/M2_5_1_COMPLETION_REPORT.md` | `5994648b1c8823e5d0acbdd3598e77d3bb829b3c3de0f8e8cd0c2c8f8d5a2c87` |
| rootCause | `docs/m2.5.1/FINAL_BLOCKER_ROOT_CAUSE.md` | `bde2a554a105b9e776f9e3f20ffd15bf74b305ee9e0f6195942dfa9490553c55` |
| desktopScreenshot | `artifacts/screenshots/m2.5-text-beta-desktop.png` | `b26845431bb3d75611eed0c9779a2864222fb53b3a4a22784447b48f49bab2cc` |
| mobileScreenshot | `artifacts/screenshots/m2.5-text-beta-mobile-390x844.png` | `71db7f09eb1673cd2a104addfc0fd37608ae9d29757a778b18fd8bf37dfa9bf7` |

## 字段处理规则

- 用户输入、历史、最终文本、Phrase、noFit、Attempts、Task Completeness、Violation、Latency 与 Tokens 直接来自 JSON。
- `isNew` 不在 M2.5 Corpus 结果中，审核材料明确标记“未记录”，不进行反向推断。
- Assistance 的 Source Sentence 从同一场景真实历史中定位，Source Message ID 直接来自 `assistance` 字段。
- TypeScript Attempt 文本直接来自 M2.5.1 `providerOutputPreview`；M2.5 未保存的 Template 原文不会重构。
- Targeted PASS 不并入完整 Corpus。
- 人工栏均留空；自动 PASS/FAIL 只表示历史执行事实。

## 本任务禁止项确认

- 未修改历史技术报告。
- 未修改产品代码。
- 未运行真实 Provider。
- 未创建新 Corpus。
- 未启动 M3 或 Adaptive Progression。
