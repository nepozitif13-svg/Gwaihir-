// Single source of truth for model IDs. Swap a provider's model in one place.

export const MODELS = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  google: "gemini-1.5-pro",
  perplexity: "sonar",
  groq: "llama-3.3-70b-versatile",
  openrouter: "qwen/qwen3-8b:free",
} as const;

export type ProviderId = keyof typeof MODELS;
