# EOE Progression Policy v1

- Policy version: `eoe.progression.v1`
- Status: Frozen for M1; implemented in M3

## 1. State model

EOE keeps two related states:

- **Progression Level**: the conservative long-term level derived from replayable evidence.
- **Effective Level**: the maximum difficulty allowed for the current response or conversation. It may drop immediately after difficulty signals without changing the long-term Progression Level.

`Effective Level <= Progression Level`, except when the user explicitly requests a temporary “more English” override. A temporary override is not mastery evidence by itself.

English Coverage means the share of a reply the user is reasonably expected to understand in context. It is a policy ceiling/range, not a quota. `noFit` always permits 0% English.

## 2. Seven levels

| Level | Allowed English form | Understandable English Coverage | New focuses per reply | Typical scheduling | Phrase cooldown |
|---|---|---:|---:|---|---:|
| 1 | Familiar single words or very short expressions | 0–5% | 0–1 | At most 1 eligible reply in 3 | 3 eligible replies |
| 2 | High-frequency reusable semantic chunks | 0–10% | 0–1 | At most 1 eligible reply in 2 | 3 eligible replies |
| 3 | English sentence frames with Chinese content retained inside or around them | 5–20% | 0–1 | Up to 1 overlay per eligible reply | 2 eligible replies |
| 4 | Complete, simple clauses understandable from context | 10–35% | 0–1 | Up to 1 overlay per eligible reply | 2 eligible replies |
| 5 | Complete English sentences naturally alternating with Chinese | 25–55% | 0–2 | Most eligible replies, never forced | 1 eligible reply |
| 6 | English-majority replies with Chinese only where needed | 50–85% | 0–2 | Default on eligible replies | 1 eligible reply |
| 7 | Natural full-English conversation | 85–100% | 0–2 | Default, with contextual simplification | No forced repeat |

These ranges guide the scheduler and validator. Short replies, emotional replies, proper nouns, code, quotations, and task output must not be manipulated to hit a numerical percentage.

## 3. Reuse strategy

1. A new phrase is first introduced only when it fits the intent and Conversation Function naturally.
2. Previously exposed phrases are preferred over new material until comprehension evidence exists across contexts.
3. Reuse should vary the surrounding context; identical mechanical repetition is discouraged.
4. A phrase inside its cooldown is ineligible unless the user repeats or explicitly asks about it.
5. No response should carry more new focuses than the current level allows.

## 4. Evidence model

### Positive Comprehension Evidence

- **Strong (+2):** the user correctly uses or paraphrases the English item in a different context; explicitly explains its meaning correctly; or completes a task that unambiguously depends on understanding it.
- **Moderate (+1):** the user responds appropriately to the meaning of the English content without relying on a nearby gloss.
- **Weak (+0.25):** the conversation continues without a question or visible mismatch. Silence is not proof and cannot be the majority of promotion evidence.
- **Exposure (0):** the phrase merely appeared or was repeated by the assistant.

A single restatement, a single correct response, or absence of a question never proves mastery.

### Difficulty Signals

- **Strong (-2):** explicit “I don't understand”, wrong task outcome caused by misunderstanding, request to switch back, or negative feedback about English difficulty.
- **Moderate (-1):** asks for meaning/translation, responds to the wrong meaning, skips a required part, or repeatedly switches away immediately after the overlay.
- **Contextual (0 to state):** high emotional load, urgent task, safety-sensitive topic, or dense technical content. This reduces the Effective Level but is not evidence of lost mastery.

## 5. Promotion conditions

Promotion from Level N to N+1 requires all of the following:

1. At least 24 eligible assistant replies in the observation window.
2. Evidence drawn from at least 3 separate conversations or sessions.
3. Evidence covering at least 3 Conversation Functions.
4. At least 8 positive evidence points, including at least 3 strong-evidence events.
5. Weak evidence contributes no more than 25% of the required points.
6. No strong difficulty signal in the last 8 eligible overlay replies.
7. At most one unresolved moderate difficulty signal in that same recent window.
8. Reused content, not only newly introduced content, has demonstrated comprehension.
9. The user has not manually locked the current level.

Time and exposure count satisfy only observation breadth; they never substitute for comprehension evidence. One event can never trigger promotion.

## 6. Regression and rapid simplification

### Per-turn or per-conversation simplification

The engine immediately lowers the Effective Level when the context or a difficulty signal requires it:

- one moderate signal: reduce by at least one level for the next 3 eligible replies;
- one strong signal: reduce by at least two levels, or to Level 1, for the remainder of the conversation;
- emotional, urgent, or safety-sensitive context: allow Chinese-first or `noFit` regardless of Progression Level.

### Long-term regression

The Progression Level is lowered by one when either condition occurs:

- two strong difficulty signals within 8 eligible overlay replies; or
- one strong plus two moderate difficulty signals across at least 2 contexts within the replay window.

Manual lowering takes effect immediately. A single fully Chinese response or conversation never changes the long-term Progression Level by itself.

## 7. Topic suitability and noFit

The scheduler returns `noFit: true` when:

- no candidate matches the user's intent and Conversation Function naturally;
- an overlay would harm empathy, clarity, safety, urgency, or task correctness;
- the available candidates exceed the Effective Level;
- cooldown or new-focus limits leave no valid candidate;
- the response is too short for a natural insertion.

`noFit` is a successful engine decision, not an error.

## 8. Manual controls

The user may:

- lock the current Progression Level;
- request temporarily less or more English;
- lower the long-term level immediately;
- request a higher trial level without recording automatic mastery;
- clear a temporary override.

Manual controls must be reversible and stored as versioned state. The default UI should use plain language rather than displaying a competitive level ranking.

## 9. Replay requirements

Progression is calculated from append-only Exposure Events and Comprehension Evidence plus the versioned policy. The application must not store only a final score. Recalculation must produce the same state for the same ordered events and policy version.
