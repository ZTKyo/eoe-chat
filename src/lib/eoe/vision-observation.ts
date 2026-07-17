import { visionObservationEnvelopeV1Schema, type VisionObservationEnvelopeV1 } from "@/domain/eoe";

export const VISION_OBSERVATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "observations", "visibleText", "uncertainties"],
  properties: {
    schemaVersion: { const: "eoe.vision-observation.v1" },
    observations: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "confidence"],
        properties: {
          description: { type: "string", minLength: 1 },
          confidence: { enum: ["high", "medium", "low"] },
        },
      },
    },
    visibleText: { type: "array", items: { type: "string", minLength: 1 } },
    uncertainties: { type: "array", items: { type: "string", minLength: 1 } },
  },
} as const;

export function buildVisionObservationDirective(userMessage: string): string {
  return [
    "Inspect the attached image and return exactly one JSON object matching eoe.vision-observation.v1.",
    "Record only visible evidence. observations must contain at least one concrete element with confidence high, medium, or low.",
    "visibleText contains only text you can read with reasonable confidence. uncertainties names details that cannot be confirmed.",
    "Do not answer the user, add Phrase data, Conversation Function, learning content, HTML, Markdown, or Domain Segments.",
    `The later answer must address this user request: ${JSON.stringify(userMessage)}.`,
  ].join("\n");
}

export function parseVisionObservation(raw: string): {
  envelope?: VisionObservationEnvelopeV1;
  violations: string[];
} {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { violations: ["vision_observation_invalid_json"] };
  }
  const parsed = visionObservationEnvelopeV1Schema.safeParse(normalizeProviderObservation(value));
  if (!parsed.success) {
    return {
      violations: parsed.error.issues.map((issue) =>
        issue.path[0] === "observations" ? "vision_observation_missing" : "vision_observation_schema_invalid"),
    };
  }
  return { envelope: parsed.data, violations: [] };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeProviderObservation(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  const rawObservations = Array.isArray(record.observations) ? record.observations : [];
  const observationText: string[] = [];
  const observations = rawObservations.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const observation = item as Record<string, unknown>;
    const description = stringValue(observation.description) ??
      [stringValue(observation.element), stringValue(observation.details)]
        .filter((part): part is string => Boolean(part))
        .join(": ");
    const confidence = ["high", "medium", "low"].includes(String(observation.confidence))
      ? observation.confidence
      : "medium";
    const visibleText = stringValue(observation.visibleText);
    if (visibleText) observationText.push(visibleText);
    return description ? [{ description, confidence }] : [];
  });

  const rawVisibleText = Array.isArray(record.visibleText)
    ? record.visibleText.map(stringValue).filter((item): item is string => Boolean(item))
    : [stringValue(record.visibleText)].filter((item): item is string => Boolean(item));
  const rawUncertainties = Array.isArray(record.uncertainties) ? record.uncertainties : [];
  const uncertainties = rawUncertainties.flatMap((item) => {
    const direct = stringValue(item);
    if (direct) return [direct];
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const uncertainty = item as Record<string, unknown>;
    const name = stringValue(uncertainty.name);
    const details = stringValue(uncertainty.details) ?? stringValue(uncertainty.description);
    const normalized = [name, details].filter((part): part is string => Boolean(part)).join(": ");
    return normalized ? [normalized] : [];
  });

  return {
    schemaVersion: "eoe.vision-observation.v1",
    observations,
    visibleText: [...new Set([...rawVisibleText, ...observationText])],
    uncertainties,
  };
}
