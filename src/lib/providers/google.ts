import { MODELS } from "@/lib/config/models";
import { CompleteOpts, ModelProvider, ProviderError } from "./types";

export const googleProvider: ModelProvider = {
  id: "google",
  label: "Gemini (Google)",
  isConfigured() {
    return !!process.env.GOOGLE_API_KEY;
  },
  async complete({ system, user, temperature = 0, maxTokens = 1024 }: CompleteOpts) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.google}:generateContent` +
      `?key=${process.env.GOOGLE_API_KEY ?? ""}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new ProviderError("google", `HTTP ${res.status}: ${detail.slice(0, 300)}`);
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p: { text?: string }) => p.text ?? "").join("");
  },
};
