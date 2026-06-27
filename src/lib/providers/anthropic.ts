import { MODELS } from "@/lib/config/models";
import { CompleteOpts, ModelProvider, ProviderError } from "./types";

export const anthropicProvider: ModelProvider = {
  id: "anthropic",
  label: "Claude (Anthropic)",
  isConfigured() {
    return !!process.env.ANTHROPIC_API_KEY;
  },
  async complete({ system, user, temperature = 0, maxTokens = 1024 }: CompleteOpts) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELS.anthropic,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new ProviderError("anthropic", `HTTP ${res.status}: ${detail.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = (data?.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("");
    return text ?? "";
  },
};
