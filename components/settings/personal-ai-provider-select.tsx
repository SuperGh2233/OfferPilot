import { PERSONAL_AI_PROVIDER, QWEN_PAYG_BEIJING_BASE_URL, type PersonalAiProvider } from "@/lib/ai/personal-ai-provider";

export function PersonalAiProviderSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: PersonalAiProvider;
  onChange: (value: PersonalAiProvider) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor="personal-ai-provider" className="block text-sm font-medium">个人 Key 的 API 服务</label>
      <select
        id="personal-ai-provider"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as PersonalAiProvider)}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-50"
      >
        <option value={PERSONAL_AI_PROVIDER.server}>服务器当前网关</option>
        <option value={PERSONAL_AI_PROVIDER.qwenPayg}>千问AI平台 · 按量付费（北京）</option>
      </select>
      {value === PERSONAL_AI_PROVIDER.qwenPayg ? (
        <p className="text-xs leading-5 text-muted-foreground">
          仅个人 Key 使用：{QWEN_PAYG_BEIJING_BASE_URL} · 模型可在下方单独设置。服务器默认 Key 与网关不变。
        </p>
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">个人 Key 沿用服务器当前网关；模型可在下方单独设置，服务器默认配置不变。</p>
      )}
    </div>
  );
}
