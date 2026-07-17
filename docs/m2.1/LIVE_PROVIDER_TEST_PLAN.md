# Live Provider Test Plan

## Gate 状态

当前：BLOCKED_BY_MISSING_USER_CREDENTIALS。

.env.local 不存在。不得创建假密钥、不得把密钥写入 Fixture、日志、截图或报告，也不得把缺少凭据记录为 Live Pass。

## 前置条件

用户在本机 .env.local 手动配置 GLM_API_KEY、DEEPSEEK_API_KEY 与 USE_MOCK_PROVIDER=false。该文件必须继续由 Git 忽略。

## 最小 Smoke Matrix

1. GLM-4.7 文本：检查模型 ID、HTTP 成功、JSON 解析、Structured Response、Usage、Latency、Hard/Soft Validator、Retry 与 Error Normalization。
2. GLM-4.6V 图片：使用最小本地像素图片，检查视觉路由、结构化响应兼容、模型 ID、Usage、Latency 与 Validator。
3. DeepSeek V4 Flash 文本：检查同一 Structured Response Contract、Usage、Latency 与 Validator。
4. GLM 可重试错误后的 DeepSeek fallback：使用受控、已归一化的 provider_unavailable 触发 Gateway fallback，验证 Provider Fallback 与 Validator Retry 仍然分离。

## 命令

    npm run test:live-providers

无凭据时必须明确输出状态行：

    SKIPPED — missing user credentials

这不是 Pass。存在凭据时，专用测试才会发起真实请求。测试代码只断言 Provider、Model、Latency、Usage 可解析性、Structured Schema、Validator、Retry/Fallback 和归一化错误，不输出密钥。

## 通过条件

四条路径均真实执行并记录结果；所有最终回复通过 Hard Validator，Soft Review 结果可追溯；任何失败均按真实状态记录，不以 Mock 测试替代。
