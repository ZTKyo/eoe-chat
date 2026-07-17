# M2.1 Naturalness Contract v1

状态：Active
适用范围：固定等级 English Overlay Engine Alpha
明确不包含：Adaptive Progression、Mastery、自动升降级

## 产品原则

EOE Chat 首先是普通 AI 聊天应用。English Chunk 只有在不损害真实回答、Conversation Function、语法、语义和阅读节奏时才允许出现。English Coverage 是上限，不是配额；自然的 noFit 是成功结果。

Engine 负责候选资格、位置、预算、验证、重试与 noFit；Provider 负责从头组织完整回复。任何模块都不得在生成后的完整字符串上追加、前置或替换 Phrase。

## Hard Reject

以下默认不可接受：

- English Chunk 后直接使用全角或半角冒号，再跟中文说明；
- English Chunk 独占一行，呈现为标题、标签、Badge 或学习卡；
- Phrase 与前后句没有语法或语义关系；
- 为了出现 Phrase 重复同一个意思；
- 先给英文，再完整翻译成中文；
- 中文回答已经结束，再附加无必要的英文表达；
- Segment 拼接后出现句法断裂、重复标点或错误空格；
- Overlay 改变原本应采用的 Conversation Function；
- 候选的语法角色、允许位置或中英兼容性不满足当前句子；
- 正常回答被缩短、弱化或替换为教学说明。

## 自然方向

不推荐：

> a good place to start：先确认最重要的目标，再决定具体动作。

更合理的方向：

> 我觉得先确认最重要的目标，是 a good place to start；之后再决定具体动作。

另一个方向：

> 这个计划适合按 step by step 的节奏推进，先完成最小的一步。

这些仅说明边界与句法方向，不是生成模板。真实 Provider 必须依据当轮上下文从头组织完整回答；Phrase 不适合时返回 noFit: true。

## Conversation First Gate

最终回复必须同时满足：

1. 完整回应用户真实意图；
2. 保持分类得到的 Conversation Function；
3. 中文仍是当前等级的主要承载语言；
4. English Chunk 来自本轮选中候选；
5. Phrase 在完整句子中承担可解释的语法作用；
6. 删除 Phrase 不会暴露“标签 + 翻译”结构；
7. Plain Text Projection 保持原意、顺序和可读性；
8. Hard Validator 通过；
9. 触发条件满足时，Soft Naturalness Validator 接受；
10. 无自然方案时使用 noFit，不强制 Overlay。

## Soft Naturalness Gate

Soft Validator 只返回 accept、regenerate 或 use_no_fit，不得改写回复。首次使用、非 high grammaticalFit、句首 Chunk、冒号边界、超过三个 Segment、高标签/翻译风险、Benchmark 与 Live 模式会触发复核。Hard Validator 始终先运行。
