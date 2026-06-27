import { anthropicProvider } from "./anthropic";
import { openaiProvider } from "./openai";
import { googleProvider } from "./google";
import { perplexityProvider } from "./perplexity";
import { ModelProvider } from "./types";

// Registration order = display order.
export const ALL_PROVIDERS: ModelProvider[] = [
  anthropicProvider,
  openaiProvider,
  googleProvider,
  perplexityProvider,
];

export function getConfiguredProviders(): ModelProvider[] {
  return ALL_PROVIDERS.filter((p) => p.isConfigured());
}

export function getProvider(id: string): ModelProvider | undefined {
  return ALL_PROVIDERS.find((p) => p.id === id);
}

export type { ModelProvider } from "./types";
