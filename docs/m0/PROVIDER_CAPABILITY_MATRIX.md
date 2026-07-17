# Provider Capability Matrix

- Matrix version: `eoe.providers.2026-07-16`
- Verified against official documentation: 2026-07-16
- Scope: Initial M1 adapters; runtime account access still requires user-supplied API keys

## 1. Verified matrix

| Capability | GLM-4.7 | GLM-4.6V | DeepSeek V4 Flash |
|---|---|---|---|
| Role | Primary text generator | Vision provider | Text fallback and benchmark provider |
| Official model ID | `glm-4.7` | `glm-4.6v` | `deepseek-v4-flash` |
| Base URL | `https://open.bigmodel.cn/api/paas/v4` | Same | `https://api.deepseek.com` |
| Authentication | `Authorization: Bearer <key>` | Same | `Authorization: Bearer <key>` |
| Text input/output | Yes / Yes | Yes / Yes | Yes / Yes |
| Vision input | No | Images, video, files | Not documented; treat as No |
| Structured output | JSON output documented | Not confirmed for vision response | JSON output documented |
| JSON Mode | `response_format: {type: "json_object"}` for text models | Not confirmed | `response_format: {type: "json_object"}` |
| Direct JSON Schema response | Not documented | Not documented | Not documented |
| Strict tool schema | Tool calling supported; strictness not assumed | Function Call supported; strictness not assumed | Strict tool-call schema available as Beta |
| Streaming | SSE supported | SSE supported | SSE supported |
| Cancellation | Client HTTP abort; no separate provider API confirmed | Same | Same |
| Tool calling | Yes | Yes, including native multimodal tool calling | Yes |
| Context limit | 200K | 128K | 1M |
| Maximum output | 128K documented | Not confirmed on model page | 384K documented |
| Usage metadata | Yes | Common API response supports usage | Yes |
| Rate limit | Account/plan dependent; read platform limits | Account/plan dependent | Official concurrency: 2500 for V4 Flash |
| Image URL | Not applicable | Yes | Not supported as a vision model |
| Base64 image | Not applicable | Yes | Not supported as a vision model |
| Region/deployment constraints | Use the configured mainland China endpoint; account policy applies | Same | No special region rule confirmed in cited docs |

“Not documented” means the application must not assume the capability. Runtime conformance tests may confirm more, but cannot silently broaden this frozen matrix without updating its version.

## 2. Official sources

- GLM-4.7 model and invocation: <https://docs.bigmodel.cn/cn/guide/models/text/glm-4.7>
- GLM-4.6V model, URL input, Base64 input, streaming, and context: <https://docs.bigmodel.cn/cn/guide/models/vlm/glm-4.6v>
- GLM chat API, JSON mode, request ID, usage, and common parameters: <https://docs.bigmodel.cn/api-reference/模型-api/对话补全>
- GLM streaming: <https://docs.bigmodel.cn/cn/guide/capabilities/streaming>
- DeepSeek current models and base URL: <https://api-docs.deepseek.com/quick_start/pricing>
- DeepSeek model IDs: <https://api-docs.deepseek.com/api/list-models>
- DeepSeek Chat Completions, streaming, usage, JSON mode, and strict tools: <https://api-docs.deepseek.com/api/create-chat-completion>
- DeepSeek JSON output limitations: <https://api-docs.deepseek.com/guides/json_mode>
- DeepSeek rate limits: <https://api-docs.deepseek.com/quick_start/rate_limit>

## 3. Normalized Provider Contract

Every adapter must normalize:

- provider-neutral messages and attachments;
- requested modality and model role;
- streaming preference;
- timeout and cancellation signal;
- correlation/request ID;
- normalized response text or stream events;
- provider/model identity;
- token usage and latency;
- normalized errors and retryable classification;
- an optional raw diagnostic response retained only on the server or in redacted local developer telemetry.

Provider SDK objects must not leak into the Domain Layer, Repository Layer, or UI Layer.

## 4. Initial routing decisions

1. Text without an image routes to GLM-4.7.
2. Any request containing a valid image routes to GLM-4.6V.
3. Retryable GLM-4.7 text failures may route once to DeepSeek V4 Flash.
4. DeepSeek is not a vision fallback.
5. If the vision provider fails, return a clear image-analysis error while preserving the unsent local draft and attachment.
6. M1 uses provider-native ordinary text. M2 adds EOE structured generation and validator orchestration.

## 5. Error normalization

Initial categories:

- `authentication`
- `rate_limit`
- `timeout`
- `cancelled`
- `invalid_request`
- `content_filter`
- `provider_unavailable`
- `invalid_response`
- `unknown`

Each normalized error records `retryable`, HTTP status when available, provider code when safe, correlation ID, and a redacted diagnostic message. API keys and Authorization headers are never logged.
