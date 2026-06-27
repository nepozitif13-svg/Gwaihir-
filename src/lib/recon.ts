import { ModelProvider } from "@/lib/providers";
import { pLimit } from "@/lib/limit";
import {
  clusterClaims,
  tallyShareOfVoice,
  ClaimCluster,
  ShareOfVoiceEntry,
  RawClaim,
} from "@/lib/scoring/consensus";

export const PROMPT_BATTERY = (target: string): string[] => [
  `What is ${target}? Give a concise factual overview.`,
  `Who founded or runs ${target}? List the people and their roles.`,
  `What does ${target} do — its main products, services, or capabilities?`,
  `When was ${target} founded and where is it based?`,
  `How is ${target} funded, and what is its scale (employees, users, revenue) if known?`,
  `What are common criticisms or weaknesses of ${target}?`,
  `What alternatives or competitors is ${target} most often compared to?`,
  `What are the most recent notable developments about ${target}?`,
];

// Index of the "competitors / alternatives" question, used for share of voice.
const COMPETITOR_Q_INDEX = 6;

export interface ProviderAnswer {
  provider: string;
  questionIndex: number;
  question: string;
  answer: string;
  error?: string;
}

export interface SentimentChip {
  provider: string;
  sentiment: "positive" | "neutral" | "negative";
  note: string;
}

export interface Dossier {
  target: string;
  providersQueried: string[];
  providerLabels: Record<string, string>;
  warning?: string;
  claims: ClaimCluster[];
  sentiment: SentimentChip[];
  shareOfVoice: ShareOfVoiceEntry[];
  summary: string;
  answers: ProviderAnswer[];
}

// Strip code fences / stray prose and parse a JSON value defensively.
export function safeJsonParse<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  let s = raw.trim();
  // remove ```json ... ``` or ``` ... ``` fences
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  // grab the first {...} or [...] block if there's surrounding prose
  const firstBrace = s.search(/[[{]/);
  const lastBrace = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

const EXTRACT_SYSTEM =
  "You convert an AI assistant's answer about a target entity into atomic factual claims. " +
  "Output ONLY valid JSON: an array of objects {\"subject\",\"attribute\",\"value\"}. " +
  "No prose, no markdown fences. Each claim must be a single checkable assertion. " +
  "If there are no factual claims, output [].";

const SENTIMENT_SYSTEM =
  "You assess how an AI assistant's answers portray a target entity. " +
  "Output ONLY valid JSON: {\"sentiment\":\"positive|neutral|negative\",\"note\":\"one short clause\"}. " +
  "No prose, no markdown fences.";

const COMPETITORS_SYSTEM =
  "You extract named competitors or alternatives mentioned in text about a target entity. " +
  "Output ONLY valid JSON: an array of short proper names (strings). No prose, no fences. " +
  "Exclude the target itself. If none, output [].";

export async function runRecon(
  target: string,
  providers: ModelProvider[],
  onProgress?: (done: number, total: number) => void,
): Promise<Dossier> {
  const battery = PROMPT_BATTERY(target);
  const limit = pLimit(4);
  const providerLabels: Record<string, string> = {};
  providers.forEach((p) => (providerLabels[p.id] = p.label));

  // [3] FAN-OUT: every question to every provider
  const jobs: Promise<ProviderAnswer>[] = [];
  let done = 0;
  const total =
    providers.length * battery.length + // answers
    providers.length * 2; // extraction + sentiment per provider (approx for progress)

  for (const provider of providers) {
    battery.forEach((question, questionIndex) => {
      jobs.push(
        limit(async () => {
          try {
            const answer = await provider.complete({
              user: question,
              temperature: 0,
              maxTokens: 700,
            });
            return { provider: provider.id, questionIndex, question, answer };
          } catch (err) {
            return {
              provider: provider.id,
              questionIndex,
              question,
              answer: "",
              error: err instanceof Error ? err.message : String(err),
            };
          } finally {
            done++;
            onProgress?.(done, total);
          }
        }),
      );
    });
  }

  const answers = await Promise.all(jobs);

  // Pick an extractor: any one configured provider.
  const extractor = providers[0];

  // [4] EXTRACT: atomic claims per answer
  const claimJobs: Promise<RawClaim[]>[] = answers
    .filter((a) => a.answer && !a.error)
    .map((a) =>
      limit(async () => {
        try {
          const raw = await extractor.complete({
            system: EXTRACT_SYSTEM,
            user: a.answer,
            temperature: 0,
            maxTokens: 900,
          });
          const parsed = safeJsonParse<
            { subject?: string; attribute?: string; value?: string }[]
          >(raw, []);
          return parsed
            .filter(Boolean)
            .map((c) => ({
              subject: String(c.subject ?? "").trim(),
              attribute: String(c.attribute ?? "").trim(),
              value: String(c.value ?? "").trim(),
              provider: a.provider,
            }));
        } catch {
          return [];
        } finally {
          done++;
          onProgress?.(done, total);
        }
      }),
    );

  const allClaims = (await Promise.all(claimJobs)).flat();
  const claims = clusterClaims(allClaims);

  // [Sentiment] per provider, over concatenated answers
  const sentimentJobs: Promise<SentimentChip>[] = providers.map((provider) =>
    limit(async () => {
      const text = answers
        .filter((a) => a.provider === provider.id && a.answer)
        .map((a) => a.answer)
        .join("\n\n");
      if (!text.trim()) {
        return { provider: provider.id, sentiment: "neutral", note: "no data" };
      }
      try {
        const raw = await provider.complete({
          system: SENTIMENT_SYSTEM,
          user: `Target: ${target}\n\nAnswers:\n${text}`,
          temperature: 0,
          maxTokens: 120,
        });
        const parsed = safeJsonParse<{ sentiment?: string; note?: string }>(raw, {});
        const s = parsed.sentiment;
        return {
          provider: provider.id,
          sentiment:
            s === "positive" || s === "negative" ? s : "neutral",
          note: String(parsed.note ?? "").slice(0, 120) || "—",
        };
      } catch {
        return { provider: provider.id, sentiment: "neutral", note: "extraction failed" };
      } finally {
        done++;
        onProgress?.(done, total);
      }
    }),
  );

  const sentiment = await Promise.all(sentimentJobs);

  // [Share of voice] from the competitors question across providers
  const competitorAnswers = answers.filter(
    (a) => a.questionIndex === COMPETITOR_Q_INDEX && a.answer && !a.error,
  );
  const sovJobs = competitorAnswers.map((a) =>
    limit(async () => {
      try {
        const raw = await extractor.complete({
          system: COMPETITORS_SYSTEM,
          user: `Target: ${target}\n\nText:\n${a.answer}`,
          temperature: 0,
          maxTokens: 300,
        });
        const names = safeJsonParse<string[]>(raw, []).map((n) => String(n));
        return { provider: a.provider, names };
      } catch {
        return { provider: a.provider, names: [] as string[] };
      }
    }),
  );
  const perProviderNames = await Promise.all(sovJobs);
  const shareOfVoice = tallyShareOfVoice(perProviderNames);

  const consensusCount = claims.filter((c) => c.status === "consensus").length;
  const contestedCount = claims.length - consensusCount;
  const warning =
    providers.length < 2
      ? "Only one provider is configured. Cross-checking needs at least 2 — every claim below is 'contested' by default and cannot be corroborated."
      : undefined;

  const summary =
    `Across ${providers.length} model${providers.length === 1 ? "" : "s"}, ` +
    `${consensusCount} claim${consensusCount === 1 ? "" : "s"} reached consensus ` +
    `(agreed by ≥2 models — treat as grounded public facts) and ${contestedCount} ` +
    `claim${contestedCount === 1 ? "" : "s"} are contested (a single model, or divergent). ` +
    `Contested claims may be hallucinations — verify them against cited or open sources before relying on them.`;

  return {
    target,
    providersQueried: providers.map((p) => p.id),
    providerLabels,
    warning,
    claims,
    sentiment,
    shareOfVoice,
    summary,
    answers,
  };
}
