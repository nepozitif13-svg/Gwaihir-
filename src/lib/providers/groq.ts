import { MODELS } from "@/lib/config/models";
import { CompleteOpts, ModelProvider, ProviderError } from "./types";

export const groqProvider: ModelProvider = {
  id: "groq",
  label: "Groq (Llama)",
  isConfigured() {
    return !!process.env.GROQ_API_KEY;
  },
  async complete({ system, user, temperature = 0, maxTokens = 1024 }: CompleteOpts) {
    const messages: { role: string; content: string }[] = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: user });

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.GROQ_API_KEY ?? ""}`,
      },
      body: JSON.stringify({
        model: MODELS.groq,
        temperature,
        max_tokens: maxTokens,
        messages,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new ProviderError("groq", `HTTP ${res.status}: ${detail.slice(0, 300)}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  },
};
