export interface EoeConfig {
  enabled: boolean;
  fixedLevel: number;
  developerMode: boolean;
}

function level(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 7 ? parsed : 2;
}

export function loadEoeConfig(env: NodeJS.ProcessEnv = process.env): EoeConfig {
  return {
    enabled: env.EOE_ENABLED !== "false",
    fixedLevel: level(env.EOE_FIXED_LEVEL),
    developerMode: env.EOE_DEVELOPER_MODE === "true",
  };
}
