# EOE Chat Text-First Beta Release Notes

Status: `M2_TEXT_BETA_STOPPED_WITH_BLOCKERS`; not a deployment authorization.

## Beta experience

The app opens directly into a normal text conversation. Fixed-level English Overlay can appear only when it fits a complete, natural answer. Users can request Chinese-only replies, reuse a known Phrase, and click an English Chunk for brief context-aware assistance before returning to the original topic.

## Image status

New image input is not available in this Beta. Existing image history remains readable. Vision code and evidence are retained for a separate experimental Vision Track.

## Learning claims

This Beta does not adapt the long-term level, calculate Mastery, or claim proven learning outcomes. Its purpose is to gather independent feedback on naturalness, comprehension, and continued willingness to use the assistant.

## Release boundary

No deployment or public release is authorized until:

1. all M2.5 technical gates pass;
2. an independent reviewer explicitly returns `M2_TEXT_BETA_HUMAN_REVIEW_PASS`;
3. a separate final release task verifies production configuration, Beta labeling, image-off state, PWA installation, data migration, error boundaries, deployment, and rollback.

The formal M2.5 Text Corpus executed all 39 required text scenarios but passed 35. Four scenarios entered Natural Fallback, so the technical release gate did not pass and independent human review was not started.
