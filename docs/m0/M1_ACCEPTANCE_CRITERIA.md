# M1 Acceptance Criteria

- Criteria version: `eoe.m1-acceptance.v1`
- Gate: Every required item must pass before M2 begins

## 1. Foundation and tooling

- [x] Next.js with App Router
- [x] TypeScript strict mode
- [x] Tailwind CSS
- [x] Zod schemas at API and persistence boundaries
- [x] ESLint command succeeds
- [x] Type-check command succeeds
- [x] Vitest unit/integration test command succeeds
- [x] Playwright E2E command exists and runs when the environment supports it
- [x] Production build succeeds

**Evidence:** `package.json` and framework configuration; final M1 runs of lint, type-check, Vitest, Playwright, and production build all exited 0. Vitest passed 14 tests and Playwright passed 12 tests.

## 2. PWA

- [x] Valid manifest with name, icons, theme, display, and start URL
- [x] Service worker registered in production-capable mode
- [x] Core application shell is installable
- [x] PWA installation guide exists
- [x] Offline reload presents a useful shell or explicit network state; generation is not falsely presented as offline-capable

**Evidence:** Production browser verification returned HTTP 200 for the manifest, service worker, and 192/512 icons; `public/sw.js` caches the application shell and never represents provider generation as offline-capable. Installation and offline behavior are documented in `docs/PWA_INSTALLATION.md`.

## 3. Chat experience

- [x] App opens directly into chat
- [x] Minimal DeepSeek-inspired layout without copied brand logos
- [x] Responsive conversation sidebar and chat surface
- [x] Multiple conversations can be created, selected, renamed, and deleted
- [x] Text messages can be sent and displayed
- [x] Pending/loading/streaming-equivalent state is visible
- [x] User can cancel an in-flight request
- [x] Errors are clear and retryable without losing the draft
- [x] Main UI does not expose a complex model selector

**Evidence:** Desktop and 390×844 browser/E2E verification covered direct chat entry, multi-conversation behavior, Mock replies, pending/cancel/retry states, and responsive primary actions without horizontal overflow.

## 4. Local persistence

- [x] IndexedDB is the source of truth for conversations and messages
- [x] Conversation history survives reload
- [x] Messages store Semantic Segments rather than overlay-parsed strings
- [x] Repository Pattern isolates IndexedDB
- [x] Versioned schema migration exists
- [x] Migration tests pass
- [x] Provider secrets never enter IndexedDB

**Evidence:** Repository tests passed against fake IndexedDB, including v1-to-v2 migration and attachment persistence; Playwright verified history after reload. Persistence schemas contain no provider-secret fields.

## 5. Provider gateway

- [x] Provider calls occur only in server code
- [x] Unified normalized Provider Contract exists
- [x] MockProvider supports development and tests without real keys
- [x] GLM-4.7 text adapter exists and uses the verified model ID
- [x] GLM-4.6V vision adapter exists and routes image requests
- [x] DeepSeek V4 Flash fallback adapter exists
- [x] Text routing, image routing, and fallback routing have integration tests
- [x] Timeout, cancellation, retryable errors, and normalized error categories are implemented
- [x] Correlation ID, provider/model, latency, usage, retry, and fallback status are available for local diagnostics

**Evidence:** MockProvider UI/API tests and mocked HTTP contract tests passed for GLM text, GLM vision, DeepSeek fallback, timeout/error normalization, and diagnostics. **Live Provider Tests: Not Executed** because `.env.local` contains no user-supplied credentials; no live-pass claim is made.

Real-provider live calls are accepted only when the corresponding user-supplied API key is present. Without keys, adapters must be validated with mocked HTTP responses and the Provider Contract tests; absence of keys is not permission to invent a live-pass result.

## 6. Images

- [x] User can choose a supported image file
- [x] Preview appears before sending
- [x] User can remove the image before sending
- [x] Image and prompt can be sent to the vision route
- [x] Unsupported type and oversize errors are handled
- [x] Image attachment persists locally with its message
- [x] Vision failure preserves the conversation and provides a retry path

**Evidence:** Composer, API, repository, and Playwright tests covered supported/unsupported files, size limits, preview/removal, vision routing, Blob persistence, and retry-safe error state.

## 7. Tests and visual verification

- [x] Unit tests cover schemas, provider normalization, routing, and repositories
- [x] Integration tests cover API gateway and IndexedDB migration/persistence
- [x] E2E covers initial chat, conversation creation, persistence/reload, mock reply, image preview/removal, cancellation or retry state
- [x] Desktop browser verification completed
- [x] 390×844 mobile verification completed
- [x] Desktop screenshot saved
- [x] Mobile screenshot saved
- [x] No horizontal overflow, clipped controls, hidden composer, or inaccessible primary actions

**Evidence:** Final M1 evidence is 6 Vitest files/14 passing tests and 12 passing Playwright tests across desktop and mobile. Screenshots are stored in `artifacts/screenshots/desktop.png` and `artifacts/screenshots/mobile-390x844.png`.

## 8. Documentation and environment

- [x] `README.md` explains setup, scripts, architecture, providers, and limitations
- [x] `.env.example` contains placeholders only
- [x] Architecture documentation exists
- [x] PWA installation guide exists
- [x] Real keys are supplied manually through `.env.local` and ignored by Git

**Evidence:** `README.md`, `.env.example`, `docs/ARCHITECTURE.md`, and `docs/PWA_INSTALLATION.md` exist; `git check-ignore .env.local` confirms the secret-bearing file is ignored.

## 9. Mandatory command evidence

The final M1 report must record the actual exit result of:

1. `npm install`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test`
5. `npm run build`
6. `npm run test:e2e` when supported

No command or test may be reported as passing unless it was actually executed successfully.

## 10. M1 boundary

M1 establishes a clean, stable, extensible chat foundation. It does not implement the complete English Overlay Engine, adaptive progression, phrase scheduling, or validator-before-display pipeline. M2 must not begin until all required M1 criteria pass or are explicitly recorded as unresolved limitations.
