# Expanded Benchmark Plan

## 范围

Golden Corpus 包含 45 个确定性场景，覆盖：普通日常聊天、简单/复杂观点、计划、建议、情绪支持、严肃话题、技术解释、财务信息、图片分析、极短回应、长篇分析、用户主动使用英文、全中文要求、Phrase 询问、无自然候选、复用、冷却期、十种 Conversation Function，以及 Level 1/2/3。

## 每场保存字段

- 用户输入；
- Conversation Analysis；
- Scheduler Decision；
- Candidate Pool 与语言适配字段；
- Selected Phrase；
- 完整 Structured Response；
- Plain Text Projection；
- Hard Validator Result；
- Soft Naturalness Review；
- Provider / Model；
- Attempts；
- noFit 与 Natural Fallback 状态。

## 自动风险标记

报告明确标记标签式、翻译式、Phrase 重复、不合理标点、句法断裂、英语超预算、合理 noFit、Conversation Function 偏移和通过机器结构门槛的自然融合。英语出现率不是通过指标。

## 产物与命令

npm run benchmark:naturalness 运行全部场景，并确定性生成 artifacts/benchmarks/m2.1-naturalness-report.md。报告展示实际文本和全部诊断，不只显示通过数量。

MockProvider 只证明策略、结构、边界、重试与诊断可复现；它不是真实语言模型自然度证据。至少 20 条输出必须进入独立人工抽样表，Live Provider 结果也必须单独复核。
