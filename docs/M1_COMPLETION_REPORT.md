# M1 Completion Report

- 状态：`PASS`
- 完成日期：2026-07-16
- 范围：M0 契约固化与 M1 本地优先聊天基础
- 边界：未启动 M2，未实现完整 English Overlay Engine

## 1. M0 交付物

以下冻结文档已创建：

1. `docs/m0/PRODUCT_CONTRACT.md`
2. `docs/m0/PROGRESSION_POLICY_v1.md`
3. `docs/m0/CONVERSATION_FUNCTIONS_v1.md`
4. `docs/m0/STRUCTURED_RESPONSE_SCHEMA_v1.md`
5. `docs/m0/VALIDATION_POLICY_v1.md`
6. `docs/m0/PROVIDER_CAPABILITY_MATRIX.md`
7. `docs/m0/DATA_MODEL_v1.md`
8. `docs/m0/M1_ACCEPTANCE_CRITERIA.md`

汇总见 `docs/m0/M0_COMPLETION_REPORT.md`。

## 2. M0 关键决策

- 产品以自然对话为第一目标，英文覆盖服务于理解，不采用固定配额硬塞英文。
- 采用七级 Progression Level；遇到复杂、高风险或情绪性内容时，可仅降低本轮 Effective Level。
- 升级需要跨对话、跨上下文的保守证据；降级可以快速发生。
- 无适合短语时 `noFit: true` 是成功结果，不为了覆盖率强制插入英文。
- 持久化和 UI 均以 Semantic Segments 为边界，不从最终字符串反向解析 overlay。
- 每次生成最多两次尝试；展示前必须通过确定性校验。
- M1 为单用户、local-first，IndexedDB 是会话与消息的本地事实来源。
- API 密钥只存在于服务端环境变量，不进入客户端、IndexedDB 或日志。

## 3. M1 创建或修改的文件

- 工程配置：`package.json`、`package-lock.json`、`tsconfig.json`、Next.js、Tailwind、ESLint、Vitest、Playwright 配置。
- 应用入口：`src/app/`，包括 App Router 页面、布局、PWA manifest、动态 PNG 图标和 `/api/chat`。
- 聊天 UI：`src/components/chat-app.tsx` 与 `src/components/chat/`。
- 领域模型：`src/domain/chat.ts`、`src/domain/persistence.ts`。
- 本地数据：`src/lib/db/database.ts`、`src/lib/db/repositories.ts`。
- Provider：`src/lib/providers/` 下的统一契约、OpenAI-compatible adapter、gateway 与 MockProvider。
- PWA：`public/sw.js`、`src/components/service-worker-register.tsx`。
- 测试：同目录单元/集成测试及 `tests/e2e/chat.spec.ts`。
- 文档与环境：`README.md`、`.env.example`、`docs/ARCHITECTURE.md`、`docs/PWA_INSTALLATION.md`。
- 验证截图：`artifacts/screenshots/desktop.png`、`artifacts/screenshots/mobile-390x844.png`。

## 4. 项目树

```text
ACLAE/
├─ docs/
│  ├─ m0/                         # M0 冻结契约与验收门
│  ├─ ARCHITECTURE.md
│  ├─ PWA_INSTALLATION.md
│  └─ M1_COMPLETION_REPORT.md
├─ public/
│  └─ sw.js
├─ src/
│  ├─ app/                        # App Router、manifest、icons、API
│  ├─ components/                 # 聊天 UI 与 service worker 注册
│  ├─ domain/                     # Semantic Segments 与持久化边界
│  └─ lib/
│     ├─ db/                      # Dexie、Repository、迁移
│     └─ providers/               # 契约、adapter、gateway、Mock
├─ tests/e2e/
├─ artifacts/screenshots/
├─ .env.example
├─ package.json
└─ README.md
```

## 5. 已实现功能

- 直接进入聊天页的简洁响应式界面，不复制第三方品牌标识。
- 多会话创建、选择、重命名和删除。
- 文本发送、Mock 回复、pending 状态、取消、超时、错误与重试。
- IndexedDB 持久化会话、Semantic Segment 消息、诊断信息与图片 Blob。
- Repository Pattern 和 IndexedDB v1 到 v2 的版本化迁移。
- 单张图片选择、类型与 5 MB 大小校验、预览、移除、发送及本地持久化。
- 服务端 Provider Gateway、文本/视觉路由与可重试文本 fallback。
- PWA manifest、192/512 PNG 图标、生产模式 service worker 与安装文档。
- 单元、集成、桌面和移动端 E2E 测试。

M1 普通回复保存为单个 `text` Semantic Segment，并使用 `noFit: true`；这是有意保留的 M1 边界。

## 6. Provider 状态

| Provider | 模型 | M1 状态 | Live 状态 |
|---|---|---|---|
| Mock | deterministic mock | UI、API、E2E 已验证 | 已通过 |
| GLM text | `glm-4.7` | adapter、HTTP 契约与路由测试已通过 | 未提供密钥，未声称 live pass |
| GLM vision | `glm-4.6v` | 图片 Base64 请求、契约与视觉路由测试已通过 | 未提供密钥，未声称 live pass |
| DeepSeek fallback | `deepseek-v4-flash` | retryable 文本 fallback 与诊断测试已通过 | 未提供密钥，未声称 live pass |

实际密钥只能由用户手动写入被 Git 忽略的 `.env.local`。

## 7. 执行命令

```text
npm install          exit 0  (up to date)
npm run lint         exit 0
npm run typecheck    exit 0
npm run test         exit 0
npm run build        exit 0
npm run test:e2e     exit 0
```

Playwright Chromium 已在当前环境安装，因此 E2E 未被跳过。

## 8. 测试结果

- Vitest：6 个测试文件、14 个测试全部通过。
- Playwright：桌面与 390×844 移动端两个 project，共 12 个测试全部通过。
- 覆盖：Zod schema、Provider 规范化、文本/视觉/fallback 路由、API、IndexedDB 迁移与持久化、会话创建与刷新、Mock 回复、图片预览/移除/持久化、取消与重试。
- 初始验证曾发现并修复 TypeScript/ESLint 问题、缺失 Chromium 以及移动端测试误点隐藏桌面按钮；以上问题修复后重新执行，最终结果均为 exit 0。

## 9. 截图与真实界面验证

- Desktop：`artifacts/screenshots/desktop.png`（1280×720）
- Mobile：`artifacts/screenshots/mobile-390x844.png`（390×844）

生产构建页面已实际检查：无横向溢出，移动端 composer 可见，主要操作可访问；Mock 消息可完成发送并更新会话标题。manifest、service worker、192/512 图标均返回 HTTP 200，浏览器控制台无错误或警告。

## 10. 已知限制

- 尚未实现完整 EOE、Phrase Registry、自适应升级、候选选择或展示前 validator pipeline。
- M1 使用清晰 pending 状态，不提供 token-by-token UI streaming。
- 每条消息最多一张图片，最大 5 MB。
- 数据仅保存在当前浏览器，没有账户、跨设备同步或导出 UI。
- 未使用用户真实密钥执行 GLM/DeepSeek live 调用；只验证了 Mock、路由与 mocked HTTP 契约。

## 11. 未完成项

M1 验收范围内没有已知未完成项。唯一凭据相关的 live-provider 验证保持明确未执行；根据 M1 验收标准，缺少用户密钥不构成失败，也不能被报告为 live pass。

M2 尚未启动。

## 12. M2 精确下一步

仅在用户批准后启动：实现 Phrase Registry、固定等级 scheduler、candidate/directive 生成、结构化 Provider 响应以及最多两次尝试的确定性 validator-before-display 流程；先不实现自适应 progression。M2 必须继续沿用 M0 的 Semantic Segments、`noFit`、版本化 policy/schema 和 provider-neutral 边界。
