# Quantitative Claim Policy v1

Version: `text-beta-rc.quantitative-claim.v1`

The deterministic detector activates only when a response contains an exact percentage, amount, multiplier, percentage-point change, or comparable precise quantitative claim.

A detected claim is displayable only when at least one condition is met:

1. the same number appears in user-provided conversation content;
2. the response identifies a traceable data source;
3. the response clearly marks the number as an example or hypothesis;
4. the response says the actual value or proportion cannot be determined.

An unsupported claim produces Hard violation `unsupported_quantitative_claim` and one full regeneration request. The retry must delete the number or mark it honestly without abandoning the user’s task.

If Attempt 2 repeats the unsupported claim, the generated answer is not displayed and cannot pass the Release Gate. Normal non-numeric answers incur no extra model call.

