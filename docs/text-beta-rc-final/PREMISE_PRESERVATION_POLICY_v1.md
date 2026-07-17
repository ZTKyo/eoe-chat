# Explicit User Premise Preservation Policy v1

Status: Text Beta RC final contract

## Purpose

EOE must preserve facts, conditions, limits, preferences, and comparison
premises explicitly supplied by the user. A Provider may add analysis dimensions
or identify missing information, but it may not silently replace the user's
premises with a new hypothetical scenario.

## Domain model

```ts
type ExplicitUserPremise = {
  id: string;
  sourceText: string;
  kind:
    | "numeric"
    | "time"
    | "cost"
    | "constraint"
    | "preference"
    | "comparison"
    | "condition"
    | "other";
  normalizedValue?: string;
  mustPreserve: boolean;
};
```

Extraction is lightweight and deterministic. It operates on the latest user
message, does not translate that message, and excludes clauses that are only a
request or question. Equivalent Arabic and common Chinese-number forms are
normalized for basic numeric and time comparisons.

An indefinite classifier such as “一个方案” is not treated as a decisive numeric
fact merely because it contains “一个”. Concrete quantities, deadlines,
frequencies, costs, constraints, preferences, comparisons, and conditions are
eligible premises.

## Directive requirements

The per-turn Directive includes only the premises extracted for that turn. It
requires the Provider to:

- preserve the user's supplied values and conditions;
- avoid conflicting or replacement numbers, including in examples;
- keep real user conditions as real conditions rather than rewriting them as
  assumptions;
- avoid deriving exact weekly, monthly, annual, monetary, percentage, or
  duration totals when the required calendar or conversion assumptions were
  not supplied;
- add relevant analysis dimensions without overwriting the premise;
- say what information is still unknown when a conclusion depends on it.

## Deterministic review

```ts
type PremisePreservationReview = {
  preservedPremiseIds: string[];
  omittedPremiseIds: string[];
  contradictedPremiseIds: string[];
  replacedPremiseIds: string[];
  valid: boolean;
};
```

The review runs after structured Domain validation and before display.

Hard failures:

- `premise_omitted`: a decisive, must-preserve premise is absent;
- `premise_contradicted`: the response states the opposite condition;
- `premise_replaced`: a supplied value is replaced by a different value.

The three codes are retryable. Attempt 2 receives the specific violation code
and regenerates the complete answer. String replacement is not used. A response
that still fails after Attempt 2 follows the existing Natural Fallback policy.

Semantic paraphrase is valid when the same premise is retained. The policy does
not require a fixed sentence, fixed order, or verbatim quotation.

## Text Beta RC reference case

For “一个方案租金更高，但每天能省一小时通勤，我该怎么权衡？”, the final
answer must retain both:

- the option has higher rent;
- it saves one hour of commuting every day.

The response may discuss rent difference, time value, commuting pressure,
work-life flexibility, budget tolerance, calculation, or a reversible trial. It
must not substitute a new commute duration, percentage, wage, workday count, or
monetary threshold for the user's premises.
