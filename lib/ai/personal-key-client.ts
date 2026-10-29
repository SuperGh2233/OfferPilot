import { PERSONAL_AI_PROVIDER, isPersonalAiProvider, isValidPersonalAiModel, type PersonalAiProvider } from "./personal-ai-provider";

const PREFIX = "offerpilot:ai-key:";
const PROVIDER_PREFIX = "offerpilot:ai-provider:";
const MODEL_PREFIX = "offerpilot:ai-model:";

export type AiSettingsInfo = { scope: string; model: string; defaultConfigured: boolean };

export async function loadAiSettings(): Promise<AiSettingsInfo> {
  const response = await fetch("/api/ai/settings", { cache: "no-store" });
  if (!response.ok) throw new Error("无法读取 AI 设置，请检查登录状态后重试。");
  const info: unknown = await response.json();
  if (!info || typeof info !== "object" || !("scope" in info) || typeof info.scope !== "string" ||
      !("model" in info) || typeof info.model !== "string" || !("defaultConfigured" in info) || typeof info.defaultConfigured !== "boolean") {
    throw new Error("AI 设置响应无效。");
  }
  return info as AiSettingsInfo;
}

export function personalKeyStorageName(scope: string) {
  return `${PREFIX}${scope}`;
}

export function personalProviderStorageName(scope: string) {
  return `${PROVIDER_PREFIX}${scope}`;
}

export function personalModelStorageName(scope: string) {
  return `${MODEL_PREFIX}${scope}`;
}

export function getPersonalAiProvider(scope: string): PersonalAiProvider {
  if (typeof window === "undefined") return PERSONAL_AI_PROVIDER.server;
  const stored = window.localStorage.getItem(personalProviderStorageName(scope));
  return isPersonalAiProvider(stored) ? stored : PERSONAL_AI_PROVIDER.server;
}

export function getPersonalAiModel(scope: string): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(personalModelStorageName(scope));
  return isValidPersonalAiModel(stored) ? stored : null;
}

export async function aiRequestHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return { "Content-Type": "application/json" };
  const { scope } = await loadAiSettings();
  const key = window.localStorage.getItem(personalKeyStorageName(scope));
  if (!key) return { "Content-Type": "application/json" };
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-OfferPilot-AI-Key": key, "X-OfferPilot-AI-User": scope };
  const provider = getPersonalAiProvider(scope);
  if (provider !== PERSONAL_AI_PROVIDER.server) headers["X-OfferPilot-AI-Provider"] = provider;
  const model = getPersonalAiModel(scope);
  if (model) headers["X-OfferPilot-AI-Model"] = model;
  return headers;
}
