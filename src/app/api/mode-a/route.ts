import { NextRequest, NextResponse } from "next/server";
import { getProvider, getConfiguredProviders } from "@/lib/providers";
import {
  scoreMemorization,
  splitAtWordBoundary,
  highlightSpans,
} from "@/lib/scoring/memorization";
import { saveRunSafe } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM =
  "You are a text-completion engine. Continue the text verbatim from exactly where it ends. " +
  "Output only the continuation — no preamble, no quotation marks, no commentary.";

export async function POST(req: NextRequest) {
  let body: { text?: string; splitPct?: number; providerId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  const splitPct = Number(body.splitPct ?? 40);

  if (text.length < 40) {
    return NextResponse.json(
      { error: "Paste at least a couple of sentences (40+ characters) to probe." },
      { status: 400 },
    );
  }

  const configured = getConfiguredProviders();
  if (configured.length === 0) {
    return NextResponse.json(
      { error: "No provider keys found. Add at least one key to .env.local and restart." },
      { status: 400 },
    );
  }

  const provider =
    (body.providerId && getProvider(body.providerId)) || configured[0];
  if (!provider || !provider.isConfigured()) {
    return NextResponse.json(
      { error: `Provider "${body.providerId}" is not configured.` },
      { status: 400 },
    );
  }

  const { prefix, trueSuffix } = splitAtWordBoundary(text, splitPct);
  if (!trueSuffix.trim()) {
    return NextResponse.json(
      { error: "Split point leaves nothing to compare. Lower the prefix percentage." },
      { status: 400 },
    );
  }

  let modelContinuation = "";
  try {
    modelContinuation = await provider.complete({
      system: SYSTEM,
      user: prefix,
      temperature: 0,
      maxTokens: 600,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Probe failed via ${provider.label}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 502 },
    );
  }

  const score = scoreMemorization(trueSuffix, modelContinuation);
  const highlight = highlightSpans(trueSuffix, score.matchStart, score.matchEnd);

  const results = {
    provider: { id: provider.id, label: provider.label },
    splitPct,
    prefix,
    trueSuffix,
    modelContinuation,
    score,
    highlight,
  };

  await saveRunSafe({
    mode: "A",
    input: text,
    config: { providerId: provider.id, splitPct },
    results,
  });

  return NextResponse.json(results);
}
