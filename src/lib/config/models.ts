// Single source of truth for model IDs. Swap a provider's model in one place.

export const MODELS = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  google: "gemini-2.0-flash",
  perplexity: "sonar",
  groq: "llama-3.1-8b-instant",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
  cerebras: "gpt-oss-120b",
} as const;

export type ProviderId = keyof typeof MODELS;
