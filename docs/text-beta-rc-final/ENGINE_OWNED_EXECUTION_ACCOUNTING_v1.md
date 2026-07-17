# Engine-Owned Execution Accounting v1

Status: Text Beta RC final contract

## Execution source

```ts
type ResponseExecutionSource =
  | "provider_generated"
  | "engine_owned_resolution"
  | "engine_owned_acknowledgement"
  | "engine_owned_assistance_fallback"
  | "natural_fallback";
```

`ResponseExecutionSource` is Engine-owned diagnostic state. It lets the release
harness validate request and attempt accounting according to the path that
actually produced the response.

## Accounting rules

| Source | Provider attempts | Provider requests | Standard scenario PASS |
|---|---:|---:|---|
| `provider_generated` | 1–2 | at least 1 | allowed if the product gates pass |
| `engine_owned_resolution` | exactly 0 | exactly 0 | allowed |
| `engine_owned_acknowledgement` | exactly 0 | exactly 0 | allowed |
| `engine_owned_assistance_fallback` | 0 or more | 0 or more | decided by the Assistance gate |
| `natural_fallback` | recorded actual value | recorded actual value | never counted as an ordinary PASS |

The release harness must never fabricate Attempt 1 for an Engine-owned reply.
Provider fallback, Validator retry, Engine-owned resolution, Engine-owned
acknowledgement, Assistance fallback, and Natural Fallback remain distinct.

## Context acknowledgement reference case

For the established commuting conversation followed by “哦”, a valid result has:

- `responseExecutionSource=engine_owned_acknowledgement`;
- `attemptCount=0`;
- `providerRequestCount=0`;
- the commuting topic retained;
- no greeting reset or generic “how can I help” question;
- no English Chunk;
- `naturalFallback=false`.

These values are evidence of the intended fast path, not an invalid attempt
count.

