# Known Validator Limitation

Canonical review artifact：`artifacts/human-review/m2-text-beta-manual/KNOWN_VALIDATOR_LIMITATION.md`。

## 1. 场景

`core-technical-typescript`

## 2. 用户任务

解释 TypeScript 中 `unknown` 和 `any` 的区别。

## 3. Provider 最终技术回答

```text
TypeScript 中的 unknown 和 any 都表示任意类型，但安全性截然不同。any 完全禁用了类型检查，你可以对其进行任何操作，这容易导致运行时错误。unknown 是类型安全的顶层类型，它要求你必须先进行类型收窄、守卫检查或断言，明确变量具体是什么类型后，才能对其进行操作。因此，在不确定类型时，优先使用 unknown 可以强制你处理潜在的运行时风险。
```

完整原始 Provider 输出：

```json
{"schemaVersion":"eoe.provider-template.v1","usePhrase":false,"responseTemplate":"TypeScript 中的 unknown 和 any 都表示任意类型，但安全性截然不同。any 完全禁用了类型检查，你可以对其进行任何操作，这容易导致运行时错误。unknown 是类型安全的顶层类型，它要求你必须先进行类型收窄、守卫检查或断言，明确变量具体是什么类型后，才能对其进行操作。因此，在不确定类型时，优先使用 unknown 可以强制你处理潜在的运行时风险。","noFitReason":"phrase_not_natural"}
```

## 4. 人类语义判断所需事实（未填写）

- 是否正确解释 any：________________
- 是否正确解释 unknown：________________
- 是否说明类型收窄：________________
- 是否提供安全性差异：________________
- 是否真正回答问题：________________
- 审核备注：________________

## 5. Matcher 拒绝原因

- 脆弱的词序要求。
- 固定词汇要求；最终 Attempt 使用“禁用了类型检查”，未被 `any` 行为词表接受。
- 固定距离窗口。
- 对合法长句支持不足；`unknown` 的收窄、守卫、断言与操作限制位于较长自然句中。

最终 Attempt 2 的准确 Violation Codes：

- `task_incomplete`
- `response_obligation_missing`
- `technical_distinction_incomplete`
- `technical_any_behavior_missing`

## 6. 明确排除

- 不是 Teacher Mode。
- 不是自动释义。
- 不是翻译重复。
- 不是 Phrase Boundary。
- 不是英语 Overlay 失败。
- 不是用户任务明显未完成。

该 Attempt 已通过 Template Parse、Template Semantics、Template Validator、Mapper、Domain Schema 与 Domain Validator，失败阶段是 `task_completeness_validator`。

## 7. 技术状态

`FAIL`

Natural Fallback 仍按 FAIL 记录，场景不得改写为 PASS。

## 8. 产品审核问题（未回答）

当前 false positive 是否严重到足以阻止用户开始使用 Text Beta？

人工答案：________________

## 9. 风险

在真实聊天中，某些语义完整的技术解释可能被 matcher 拒绝并进入 Natural Fallback，增加延迟和额外 Provider 请求。Fallback 仍会返回中文主导的可显示回复，但本场实际 fallback 对 TypeScript 问题的针对性明显弱于被拒绝的正确 Attempt，因此不能把 fallback 当成技术 PASS。

实际 Natural Fallback：

```text
关于“解释 TypeScript 里 unknown 和 any 的区别”，先抓住核心关系：确认现象、找出直接原因，再区分触发条件和长期因素。你把具体例子或报错补充出来，我可以继续给出针对性的解释。
```

## 10. 后续处理

不在发布前继续扩展关键词规则。应在实际 Beta 使用中收集更多不同技术解释样本，再重新设计语义证据检查方式。本审核任务没有修复或绕过 matcher。
