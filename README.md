# EOE Chat

EOE Chat is a single-user, local-first AI chat PWA powered by the English Overlay Engine. M2 adds a fixed-level Overlay Alpha while keeping ordinary natural conversation primary.

The current hosted target is a password-protected **Private Text Beta**.
Adaptive Progression and new image input remain disabled.

## Naming

- **Product Name:** EOE Chat
- **Core Engine:** English Overlay Engine
- **Repository / Workspace Folder:** ACLAE (temporarily retained; no directory rename is required)
- **Future architecture name:** ACLAE means Adaptive Conversational Language Acquisition and describes a broader future architecture.

The current product and implementation use **EOE Chat** and **English Overlay Engine** as their formal names. ACLAE is only the retained workspace name and future architectural umbrella, not a competing product name.

M1 established the stable chat, IndexedDB, image, Provider, PWA, and testing foundation. M2 implements fixed-level scheduling and validation only; Adaptive Progression remains disabled. M2.5 defines a Text-First Fixed-Level Beta: image history and Vision code are retained, while new image input is disabled by default as a deferred experimental feature.

## Requirements

- Node.js 20.9 or newer
- npm
- Optional GLM and DeepSeek API keys for live providers

## Setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open <http://127.0.0.1:3000>. The default example configuration uses `MockProvider`, so development and automated tests do not require a real key.

To use live providers, edit `.env.local` manually:

```dotenv
USE_MOCK_PROVIDER=false
GLM_API_KEY=your-key
DEEPSEEK_API_KEY=your-key
EOE_ENABLED=true
EOE_FIXED_LEVEL=2
EOE_DEVELOPER_MODE=false
EOE_ENABLE_IMAGE_INPUT=false
```

Never commit `.env.local`. Provider keys are read only by the server route.

## Open-source and hosted deployment

The source is licensed under the [MIT License](LICENSE). The application uses
a Next.js server route, so GitHub Pages is not a complete host for the chat
application. The reference deployment connects this GitHub repository to
Vercel.

Hosted production is fail-closed: real providers require explicit production
authorization and server-only keys. The Private Beta also supports an
HTTP-only password session and a configurable signed-cookie daily request
limit. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the exact variables,
security boundary, PWA verification, and rollback procedure.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run benchmark:eoe
npm run test:e2e
npm run build
npm run start
```

## M1 features

- Responsive minimal chat UI that opens directly into conversation
- Multiple local conversations with rename and delete
- IndexedDB conversation/message persistence through Repository interfaces
- Semantic Segment message storage
- Versioned IndexedDB migration from storage v1 to v2
- Image selection, preview, removal, local persistence, and vision routing
- Server-only provider gateway
- GLM-4.7 text adapter
- GLM-4.6V vision adapter using image URL/Base64-compatible input
- DeepSeek V4 Flash text fallback adapter
- MockProvider for keyless development and tests
- Pending, cancellation, timeout, normalized error, and retry states
- Installable PWA manifest and production service worker
- Vitest unit/integration tests and Playwright desktop/mobile projects

## M2 Engine Alpha

- 50-item curated Phrase Registry with versioned Zod schema
- Fixed Progression Level (default Level 2) and per-turn Effective Level reductions
- Deterministic Conversation Function classification and Overlay Scheduler
- Naturalness-gated 3–5 candidate selection with cooldown and reuse preference
- Compact per-turn Directive with one engine-selected Phrase ID
- `eoe.response.v2` Semantic Segments and Provider JSON-mode compatibility
- Deterministic Hard Validator before display
- At most two complete generation attempts, followed by a Chinese-dominant natural fallback
- Local ExposureEvent, GenerationAttempt, AssistanceRequest, and diagnostic records
- Hidden Developer Panel through `?eoe-dev=1`; optional fixed test level through `?eoe-level=3`
- Golden Conversation Corpus via `npm run benchmark:eoe`

## Provider routing

| Request | Default route | Fallback |
|---|---|---|
| Text | GLM-4.7 | DeepSeek V4 Flash on retryable failure |
| Image + text | Deferred in Text-First Beta; GLM-4.6V only when the image flag and Developer Mode are both enabled | No text-only fallback |
| Development without GLM key | MockProvider | Not applicable |

Exact capability evidence is recorded in `docs/m0/PROVIDER_CAPABILITY_MATRIX.md`.

## Local data

Conversations, messages, Semantic Segments, image Blobs, Registry snapshots, displayed Phrase exposures, generation attempts, assistance clicks, and diagnostics are stored in IndexedDB on the current device. There is no cloud sync. Clearing site data deletes the local history.

API keys and Authorization headers are never written to IndexedDB or client-side source.

## Documentation

- `docs/m0/`: frozen M0 product and engineering contracts
- `docs/m2/`: M2 fixed-level engine contracts, policies, acceptance, and completion evidence
- `docs/ARCHITECTURE.md`: M1 foundation and M2 request flow
- `docs/PWA_INSTALLATION.md`: install and offline behavior
- `docs/DEPLOYMENT.md`: password-protected Vercel deployment
- `docs/PRIVACY.md`: local storage and provider data boundary

## Known M2 boundaries

- Adaptive Promotion/Demotion, Mastery Score, and complete Comprehension Evidence inference are intentionally absent.
- Text-First Beta does not expose new image input by default. Set `EOE_ENABLE_IMAGE_INPUT=true` and explicitly enter Developer Mode only for isolated Vision work.
- Real provider calls require keys supplied by the user in `.env.local`.
- The UI uses pending responses rather than token-by-token streaming.
- Image attachments remain limited to one image and 5 MB per message.
- Local data does not sync between browsers or devices.
- The Private Beta signed-cookie quota is designed for one trusted user, not
  anonymous public abuse prevention.
