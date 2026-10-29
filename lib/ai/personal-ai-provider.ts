export const PERSONAL_AI_PROVIDER = {
  server: "server",
  qwenPayg: "qwen-payg",
} as const;

export const QWEN_PAYG_BEIJING_BASE_URL = "https://cn-beijing.maas.qianwenaiapi.com/compatible-mode/v1";
export const PERSONAL_AI_MODEL_MAX_LENGTH = 128;

export type PersonalAiProvider = (typeof PERSONAL_AI_PROVIDER)[keyof typeof PERSONAL_AI_PROVIDER];

export function isPersonalAiProvider(value: string | null): value is PersonalAiProvider {
  return value === PERSONAL_AI_PROVIDER.server || value === PERSONAL_AI_PROVIDER.qwenPayg;
}

export function isValidPersonalAiModel(value: string | null): value is string {
  return value !== null && value.length > 0 && value.length <= PERSONAL_AI_MODEL_MAX_LENGTH && /^[\x21-\x7e]+$/.test(value);
}
