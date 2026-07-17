# EOE Data Model v1

- Schema version: `eoe.data.v1`
- IndexedDB database: `eoe`
- Status: Frozen for M1 foundation

## 1. Entities

### Conversation

- `id`, `title`, `createdAt`, `updatedAt`, `archivedAt?`
- `activePolicyVersion`
- `lastMessageAt?`
- local-first conversation metadata

### Message

- `id`, `conversationId`, `role`
- `segments: MessageSegment[]`
- `attachments: MessageAttachment[]`
- `plainText` derived from segments
- `status: pending | streaming | complete | error | cancelled`
- `providerId?`, `modelId?`, `generationAttemptId?`
- `policyVersion`, `schemaVersion`
- `createdAt`, `updatedAt`

### MessageSegment

- `text`: content plus `zh | other` language
- `english_chunk`: content, Phrase ID, `isNew`, and `assistanceAvailable`
- ordered semantic source of truth for storage and rendering

### MessageAttachment

- `id`, `kind: image`, `name`, `mimeType`, `size`
- local Blob for device persistence
- preview metadata such as width and height when available
- no remote URL is required for M1; the server request may serialize the current image as Base64 for the vision provider

### Phrase

- `id`, canonical English, variants, Progression Level, difficulty
- Conversation Functions, semantic tags, status, catalogue version

### ExposureEvent

- append-only `id`, Phrase ID, Conversation/Message IDs, Effective Level
- presentation context, `isNew`, timestamp, Policy Version

### ComprehensionEvidence

- append-only when policy conditions permit
- `id`, Phrase ID(s), source event, evidence type, strength, confidence, context, timestamp, Policy Version
- confidence never converts exposure into mastery automatically

### ProgressionState

- singleton for the current local user
- Progression Level, Effective Level override, lock state
- promotion/regression eligibility and last replay position
- Policy Version and recalculation timestamp
- derived from evidence history; not the sole source of truth

### GenerationAttempt

- `id`, Conversation/Message IDs, provider/model
- request/correlation ID, started/completed timestamps, latency
- usage, normalized result, validator result, retry index, fallback flags
- redacted error diagnostics

### EnginePolicy

- Policy Version, schema compatibility, effective date
- configured progression, scheduling, candidate, validation, and retry settings

### ProviderObservation

- provider/model, time, capability matrix version
- latency, normalized error, schema/stream outcome, fallback result
- local developer telemetry by default

## 2. IndexedDB stores and indexes

| Store | Key | Required indexes |
|---|---|---|
| `conversations` | `id` | `updatedAt`, `lastMessageAt` |
| `messages` | `id` | `conversationId`, `[conversationId, createdAt]`, `generationAttemptId` |
| `phrases` | `id` | `level`, `catalogueVersion`, multi-entry `conversationFunctions` |
| `exposureEvents` | `id` | `phraseId`, `messageId`, `createdAt` |
| `comprehensionEvidence` | `id` | `phraseId`, `createdAt`, `strength` |
| `progressionStates` | `id` | `policyVersion` |
| `generationAttempts` | `id` | `messageId`, `providerId`, `startedAt` |
| `enginePolicies` | `version` | `effectiveAt` |
| `providerObservations` | `id` | `providerId`, `createdAt`, `errorCategory` |
| `meta` | `key` | none |

M1 may initially create only the stores it actively uses, but migration definitions must reserve the complete v1 plan and must not require destructive recreation later.

## 3. Repository boundaries

Domain and UI code use Repository Interfaces rather than direct IndexedDB calls. Initial repositories:

- Conversation Repository
- Message Repository
- Progression Repository
- Phrase Repository
- Evidence Repository
- Generation Attempt Repository

Repositories return domain objects, own IndexedDB transactions, and expose future-compatible export/delete operations. A later sync layer may wrap repositories without changing UI contracts, but sync is not implemented in M1.

## 4. Migration policy

- Every IndexedDB structural change increments the integer database version.
- Every migration is ordered, idempotent within the browser upgrade transaction, and tested from the previous supported version.
- Schema Version is recorded in `meta` and on generated messages.
- Destructive migrations require an explicit export/backup path and are prohibited in M1.
- M1 tests must demonstrate a v1-to-current migration fixture even if current is still v1.

## 5. Replay and audit rules

1. Never store only a final progression score.
2. Preserve evidence events that caused progression changes.
3. Recompute Progression State deterministically from ordered events and the matching Policy Version.
4. Record the Policy Version on every generated message.
5. Record provider, latency, usage, validator result, retry, and fallback for each generation attempt when available.
6. Exposure does not create positive comprehension evidence automatically.

## 6. Privacy and secrets

- API keys are server-side environment variables only.
- API keys, Authorization headers, and unredacted provider diagnostics are never stored in IndexedDB.
- Telemetry remains local by default.
- Export and delete interfaces are included; UI may be completed after M1.
- Image Blobs remain local except while explicitly sent for the current vision request.
- M1 does not implement cloud synchronization.
