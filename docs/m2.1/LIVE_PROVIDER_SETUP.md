# Live Provider Setup

Live Provider Gate 当前为 BLOCKED_BY_MISSING_USER_CREDENTIALS，原因是仓库根目录不存在 .env.local。

请用户只在本机创建 .env.local 并填写：

    GLM_API_KEY=<your real local key>
    DEEPSEEK_API_KEY=<your real local key>
    USE_MOCK_PROVIDER=false

可选模型覆盖：PRIMARY_MODEL、VISION_MODEL、FALLBACK_MODEL。默认目标分别为 glm-4.7、glm-4.6v、deepseek-v4-flash。

安全要求：

- 不要在聊天中发送密钥；
- 不要把 .env.local 加入 Git；
- 不要把响应头或 Authorization 写入截图/报告；
- 运行 npm run test:live-providers；
- 确认输出是实际测试结果，而不是 SKIPPED — missing user credentials。

完成真实 Smoke Test 前，M2.1 不得标记完全 PASS，也不得进入 M3。
