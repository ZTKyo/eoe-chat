export type FeatureEnvironment = Record<string, string | undefined>;

export const IMAGE_FEATURE_DEFERRED_CODE = "IMAGE_FEATURE_DEFERRED";
export const IMAGE_FEATURE_DEFERRED_MESSAGE = "图片功能暂未开放，历史图片仍可查看。";

export function isImageInputConfigured(
  env: FeatureEnvironment = process.env,
): boolean {
  return env.EOE_ENABLE_IMAGE_INPUT === "true";
}

export function isImageInputEnabled(input: {
  configured: boolean;
  developerMode: boolean;
}): boolean {
  return input.configured && input.developerMode;
}

export function isImageRequestAllowed(input: {
  attachmentCount: number;
  developerMode: boolean;
  env?: FeatureEnvironment;
}): boolean {
  if (input.attachmentCount === 0) return true;
  return isImageInputConfigured(input.env) && input.developerMode;
}
