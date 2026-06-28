import { ModelProvider } from "@/lib/providers/types";

export interface FaqItem {
  question: string;
  answer: string;
}

export async function generateFaq(
  content: string,
  queries: string[],
  provider: ModelProvider
): Promise<FaqItem[]> {
  const system =
    "You are an AEO FAQ generator. Respond with valid JSON array only — no markdown.";

  const user = [
    "Generate 5-8 FAQ blocks optimized for AI search engines (AEO).",
    "Each answer must be 40-60 words, self-contained, and directly answer the question.",
    "",
    `CONTENT (up to 6000 chars):`,
    content.slice(0, 6000),
    "",
    `TARGET QUERIES: ${queries.join(", ")}`,
    "",
    'Return ONLY a JSON array: [{"question":"...","answer":"..."}]',
  ].join("\n");

  const raw = await provider.complete({ system, user, temperature: 0.2, maxTokens: 2048 });

  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("FAQ: no JSON array in provider response.");

  const items = JSON.parse(match[0]) as FaqItem[];
  return items.filter((f) => f.question && f.answer).slice(0, 8);
}
