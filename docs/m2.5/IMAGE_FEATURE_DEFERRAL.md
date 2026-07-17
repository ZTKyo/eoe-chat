# Image Feature Deferral

Status: `DEFERRED_EXPERIMENTAL_FEATURE`

## Decision

EOE Chat Text-First Beta does not expose new image input by default. This does not convert any prior Vision failure into a pass. The historical M2.4.2 status remains `M2_4_2_STOPPED_WITH_BLOCKERS`.

## Reasons

1. GLM Vision still has a demonstrated timeout path.
2. Explicit-Chinese image answers may repeat English surface text visible in the image.
3. Vision is not a prerequisite for the core text-conversation Overlay experience.
4. An optional capability should not indefinitely block a bounded text Beta.

## Feature flag

`EOE_ENABLE_IMAGE_INPUT=false` is the Beta default.

New image input requires both:

- `EOE_ENABLE_IMAGE_INPUT=true` in server configuration;
- explicit Developer Mode.

The default UI hides the image picker. The API rejects unauthorized attachments with `IMAGE_FEATURE_DEFERRED`, and the Provider Gateway rejects a disabled image request before selecting the Vision adapter.

## Preserved behavior

- GLM Vision Provider, Observation, Grounding, diagnostics, fixtures, and historical tests remain.
- IndexedDB remains v4.
- Existing image Blobs and messages remain readable.
- Historical image messages display a stable read-only deferral status.
- Text messages and text Provider routing are unaffected.
- Vision work continues later as a separate Vision Track with its own evidence and release gate.
