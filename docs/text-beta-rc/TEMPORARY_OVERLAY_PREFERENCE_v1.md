# Temporary Overlay Preference v1

Version: `text-beta-rc.overlay-preference.v1`

```ts
type TemporaryOverlayPreference = {
  mode: "normal" | "reduced" | "chinese_only";
  reason: "user_difficulty" | "explicit_chinese" | "user_resume";
};
```

## Signals

- Difficulty: `英语有点难`, `刚才那句没看懂`, `英文少一点`.
- Explicit Chinese: `多用中文`, `先用中文吧`, and existing Chinese-only requests.
- Resume: explicit request to resume English or natural user use of a Registry Phrase, including a historical Phrase that is no longer automatic Live-Safe.

## Behavior

- Difficulty changes the current session preference to `reduced`, lowers Effective Level for the turn, and skips new English in that turn.
- Explicit Chinese changes it to `chinese_only`.
- User resume changes it to `normal`.
- The response briefly acknowledges the preference and continues the actual prior topic.
- Long apologies, unrelated slogans, Teacher Mode, automatic promotion, Mastery inference, and Fixed Level mutation are prohibited.

