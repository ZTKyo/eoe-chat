# Multi-Turn Context Contract v1

M2.4 evaluates context from real ordered message history, not a single prompt that describes earlier turns.

Required scenarios cover: meaning after an Assistant English Chunk; pronunciation; click association; natural user reuse without correction; temporary Effective Level reduction after “英语有点难”; scoped Chinese-only mode; later user-initiated English resumption; and ambiguity when several prior English Chunks exist.

Fixed Progression Level never changes. Conversation scope preferences and assistance source references are Engine-owned. The Provider receives only the minimal resolved context necessary to answer naturally.
