# Response Depth Policy v1

Version: `text-beta-rc.response-depth.v1`

```ts
type ResponseDepthProfile = {
  level: "brief" | "standard" | "detailed";
  namedFactors: string[];
  requiresInteractions: boolean;
  minimumInteractionCount: number;
  requiresTradeOffs: boolean;
  requiresConclusion: boolean;
};
```

Requests containing `详细分析`, `深入分析`, relationship analysis, two-sided cost analysis, or `展开讲讲` receive a detailed profile.

A detailed response must:

1. explicitly cover the user-named major factors;
2. explain at least two causal, constraining, or feedback relationships;
3. state a trade-off, feedback loop, or long-term consequence;
4. finish with a synthesis.

Length alone does not satisfy the profile. Missing depth normally produces Soft warnings and one retry; a clearly empty or trivial response remains a Hard failure. The policy is factor-based and contains no Corpus-ID branch or canned product answer.

