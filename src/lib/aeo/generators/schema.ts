import { ModelProvider } from "@/lib/providers/types";
import type { FaqItem } from "./faq";

export async function generateSchema(
  faqs: FaqItem[],
  url: string | undefined,
  provider: ModelProvider
): Promise<string> {
  const system =
    "You are a JSON-LD schema expert. Respond with valid JSON only — no markdown, no prose.";

  const faqList = faqs
    .map((f, i) => `Q${i + 1}: ${f.question}\nA${i + 1}: ${f.answer}`)
    .join("\n");

  const user = [
    "Generate JSON-LD combining FAQPage + Article schema for AEO.",
    `URL: ${url ?? "https://example.com"}`,
    "",
    "FAQ ITEMS:",
    faqList,
    "",
    'Return ONLY valid JSON-LD: {"@context":"https://schema.org","@graph":[...]}',
  ].join("\n");

  const raw = await provider.complete({ system, user, temperature: 0, maxTokens: 2048 });

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Schema: no JSON in provider response.");

  // Validate it's parseable
  JSON.parse(match[0]);
  return match[0];
}
