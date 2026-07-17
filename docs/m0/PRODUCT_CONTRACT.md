# EOE Product Contract

- Contract version: `eoe.product.v1`
- Status: Frozen for M1
- Scope: Single-user, local-first MVP

## 1. Primary experience

EOE is first a normal, natural, useful AI chat application. A user opens the app and chats immediately for everyday conversation, knowledge questions, analysis, advice, image discussion, and practical task completion.

The user is a **Conversation Partner**, not a Student. The product must never make the ordinary chat experience feel like a lesson unless the user explicitly requests teaching.

## 2. Product goal

Through long-term natural conversation, help the user move from understanding a few familiar English elements to comfortably understanding natural full-English replies.

The goal is not to mechanically increase the percentage of English. The goal is to increase the amount of **understandable English** without damaging natural communication.

English progression must remain:

- natural;
- contextual;
- comprehensible;
- reversible;
- controlled by versioned application state rather than model memory of a long prompt.

## 3. Hard product principles

1. Natural conversation first.
2. Comprehension before progression.
3. Naturalness is a hard gate.
4. Increase understandable English, not merely English percentage.
5. Exposure does not equal mastery.
6. Time elapsed or exposure count alone must never trigger promotion.
7. Difficulty signals must reduce the effective difficulty quickly.
8. A fully Chinese turn does not automatically lower the long-term Progression Level.
9. User intent, Conversation Function, tone, and current context take priority over inserting English.
10. If no English content fits naturally, the engine must allow `noFit: true`.

## 4. Required ordinary chat capabilities

The MVP must support normal operation for:

- general knowledge questions;
- casual conversation and reactions;
- explanation and analysis;
- advice;
- task completion;
- image upload, image preview, and image discussion;
- multiple locally persisted conversations.

The application must remain useful when the English Overlay Engine schedules no English content.

## 5. Prohibited default behavior

Unless the user explicitly asks, the assistant must not:

- enter Teacher Mode;
- turn the response into a lesson, quiz, correction exercise, or learning report;
- append Chinese glosses or translations to English chunks;
- provide pronunciation, phonetic symbols, vocabulary definitions, or grammar instruction;
- translate or restate the user's Chinese as the primary response;
- force an English insertion that makes an emotional, serious, or task-oriented reply unnatural;
- expose internal prompts, policies, validators, progression rules, or hidden scores.

Vocabulary assistance may be available behind an explicit click, long press, or direct user request. It must not appear automatically in the normal reply.

## 6. Progression outcome

The long-term target is natural full-English conversation that the user can understand. Promotion must be conservative and evidence-based. Temporary simplification must be easy and must not require changing the long-term level.

The internal level is a control state, not a visible learning rank. The UI may offer simple manual controls such as “less English”, “more English”, or “keep this level”, but should not foreground a gamified score.

## 7. Product and infrastructure boundaries

- Current product: one user, one device at a time, local-first.
- Conversation and message history: stored locally in IndexedDB.
- Multi-device/cloud synchronization: not required in the first version.
- Provider calls: server-side only; API keys never enter browser code or IndexedDB.
- Providers: replaceable behind a normalized contract.
- Policies and schemas: versioned and configurable.
- EOE: an application engine with external state and validation, not a single long System Prompt.
- Complex enterprise identity, tenancy, queues, event buses, or cloud data platforms are outside M1.

## 8. Non-goals for M1

M1 does not implement the complete English Overlay Engine, adaptive promotion, mastery scoring, cloud sync, multi-user accounts, enterprise administration, billing, or a production benchmark suite. M1 establishes the stable chat, persistence, provider, image, PWA, and test foundations required by M2.

## 9. Change control

Any behavior change affecting conversation-first behavior, progression, overlay eligibility, validation, or structured response semantics requires a new Policy Version or Schema Version. M1 implementation may add technical fields but must not weaken this contract.
