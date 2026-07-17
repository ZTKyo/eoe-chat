# EOE Architecture: M1 Foundation and M2 Alpha

## Naming boundary

- **EOE Chat** is the formal product name.
- **English Overlay Engine** is the core engine implemented by the product.
- **ACLAE** is the temporarily retained repository/workspace folder name and expands to **Adaptive Conversational Language Acquisition**, a possible broader future architecture.

Current code and product documentation should refer to EOE Chat and the English Overlay Engine. The ACLAE name does not trigger a directory migration or a parallel product architecture.

## Scope

M1 is the retained local-first chat foundation. M2 adds a fixed-level English Overlay Engine Alpha through isolated domain services without replacing the stable chat, PWA, Provider Gateway, or Repository boundaries.

## Layers

### UI

- `src/components/chat-app.tsx`: conversation orchestration and request lifecycle
- `src/components/chat/`: sidebar, message rendering, composer, and image preview
- `src/app/`: App Router shell, PWA metadata, icon route, and server API route

The UI renders `MessageSegment[]` directly. It never parses text to discover overlay content.

### Domain

- `src/domain/chat.ts`: Zod-compatible response, segment, API, and persistence boundaries
- `src/domain/eoe.ts`: Conversation Analysis, scheduling, Registry, selection, validation, and diagnostic contracts
- `src/domain/persistence.ts`: reserved M0 evidence, progression, policy, and telemetry entities

Domain types do not import provider SDKs, React, Next.js, or IndexedDB.

### Repository

- `src/lib/db/database.ts`: Dexie database, stores, and storage migrations
- `src/lib/db/repositories.ts`: Conversation and Message Repository interfaces/implementations

IndexedDB storage version 3 retains the v1-to-v2 migration and adds versioned Registry records, ExposureEvents, GenerationAttempts, AssistanceRequests, and EngineDiagnostics. Only final displayed English chunks create exposure records.

### English Overlay Engine

- `src/lib/eoe/conversation-analyzer.ts`: deterministic Conversation Function and sensitivity analysis
- `src/lib/eoe/scheduler.ts`: fixed/effective level and per-turn ceiling
- `src/lib/eoe/candidate-selector.ts`: naturalness eligibility, cooldown, reuse, ranking, and noFit
- `src/lib/eoe/directive-builder.ts`: compact per-turn Provider directive
- `src/lib/eoe/validator.ts`: deterministic pre-display Hard Validator
- `src/lib/eoe/engine.ts`: two-attempt orchestration and natural fallback
- `src/lib/eoe/registry/`: 50-item versioned Phrase Registry

### Provider gateway

- `src/lib/providers/types.ts`: normalized contract and errors
- `src/lib/providers/openai-compatible.ts`: common HTTP adapter
- `src/lib/providers/gateway.ts`: modality routing and text fallback
- `src/lib/providers/mock-provider.ts`: deterministic keyless development provider
- `src/app/api/chat/route.ts`: server-only boundary

Provider API keys exist only in server environment variables. The browser sends provider-neutral messages and optional image data to `/api/chat`.

## Request flow

1. The client persists the user message and a pending assistant message locally.
2. The client sends recent plain-text context, recent exposure IDs, and any current image to `/api/chat`.
3. The Engine classifies the Conversation Function and sensitivity.
4. The Scheduler computes fixed/effective levels and overlay ceiling before selection.
5. The Selector returns up to five natural candidates and one engine-selected Phrase ID or noFit.
6. The Directive Builder sends only current state and candidates to the Provider Gateway.
7. The Gateway routes text to GLM-4.7, vision to GLM-4.6V, and retryable text provider failure to DeepSeek V4 Flash.
8. The Provider returns `eoe.response.v2` JSON; the Hard Validator blocks invalid output before display.
9. One full regeneration is allowed. Two failures produce a validated Chinese-dominant natural fallback.
10. The client atomically stores the displayed message, attempts, diagnostics, and only the final English exposure.

## Security and privacy

- `.env.local` is ignored by Git.
- Authorization headers are constructed server-side.
- Provider errors are normalized; credentials are never returned or logged.
- IndexedDB stores local user data and image Blobs only.
- No cloud sync, accounts, or enterprise tenancy exist in M1.

## M2 boundary and extension points

- Adaptive Progression remains off; fixed Progression Level never changes automatically.
- M3 may consume ExposureEvents and explicit assistance requests, but M2 does not infer mastery.
- Add a future sync decorator around repositories without changing UI contracts.
- Add provider-native streaming behind the normalized contract without changing persisted Semantic Segments.
