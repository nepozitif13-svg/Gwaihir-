export interface CompleteOpts {
  system?: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ModelProvider {
  id: string; // "anthropic" | "openai" | "google" | "perplexity"
  label: string;
  isConfigured(): boolean; // true if its API key env var is set
  complete(opts: CompleteOpts): Promise<string>; // plain text of the model's reply
}

export class ProviderError extends Error {
  constructor(
    public providerId: string,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
