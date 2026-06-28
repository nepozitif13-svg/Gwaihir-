// Single source of truth for model IDs. Swap a provider's model in one place.

export const MODELS = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  google: "gemini-2.0-flash",
  perplexity: "sonar",
  groq: "llama-3.3-70b-versatile",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
  cerebras: "llama-3.3-70b",
} as const;

export type ProviderId = keyof typeof MODELS;
