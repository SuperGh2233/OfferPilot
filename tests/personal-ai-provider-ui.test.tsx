import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PersonalAiProviderSelect } from "../components/settings/personal-ai-provider-select";
import { PERSONAL_AI_PROVIDER } from "../lib/ai/personal-ai-provider";

describe("personal AI provider selector", () => {
  it("shows the fixed Qwen pay-as-you-go preset and preserves the server gateway option", () => {
    const html = renderToStaticMarkup(
      <PersonalAiProviderSelect value={PERSONAL_AI_PROVIDER.qwenPayg} onChange={() => undefined} />,
    );
    expect(html).toContain("千问AI平台 · 按量付费（北京）");
    expect(html).toContain("服务器当前网关");
    expect(html).toContain("https://cn-beijing.maas.qianwenaiapi.com/compatible-mode/v1");
    expect(html).toContain("服务器默认 Key 与网关不变");
  });
});
