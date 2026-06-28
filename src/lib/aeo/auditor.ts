import { ModelProvider } from "@/lib/providers/types";

export interface AuditDimensions {
  structure: number;
  authority: number;
  visibility: number;
}

export interface AuditRecommendation {
  priority: "high" | "medium" | "low";
  text: string;
}

export interface AuditResult {
  score: number;
  label: "poor" | "fair" | "good" | "excellent";
  dimensions: AuditDimensions;
  recommendations: AuditRecommendation[];
}

export async function runAudit(
  content: string,
  queries: string[],
  competitors: string[],
  provider: ModelProvider
): Promise<AuditResult> {
  const system =
    "You are an AEO (Answer Engine Optimization) expert. " +
    "Analyze content and respond with valid JSON only — no markdown, no prose.";

  const user = [
    "Analyze this content for AEO readiness and return a JSON object.",
    "",
    `CONTENT (up to 8000 chars):`,
    content.slice(0, 8000),
    "",
    `TARGET QUERIES: ${queries.join(", ")}`,
    `COMPETITORS: ${competitors.length ? competitors.join(", ") : "none specified"}`,
    "",
    "Return ONLY this JSON structure (no other text):",
    JSON.stringify({
      score: "0-100 integer",
      label: "poor|fair|good|excellent",
      dimensions: { structure: "0-33", authority: "0-33", visibility: "0-34" },
      recommendations: [{ priority: "high|medium|low", text: "action text" }],
    }),
  ].join("\n");

  const raw = await provider.complete({ system, user, temperature: 0, maxTokens: 1024 });

  // Extract JSON even if model wraps it in markdown
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Audit: no JSON in provider response.");

  const parsed = JSON.parse(match[0]) as AuditResult;

  // Clamp & validate
  parsed.score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
  const labels = ["poor", "fair", "good", "excellent"] as const;
  if (!labels.includes(parsed.label)) {
    parsed.label = parsed.score >= 75 ? "excellent" : parsed.score >= 50 ? "good" : parsed.score >= 25 ? "fair" : "poor";
  }

  return parsed;
}
