import { NextRequest, NextResponse } from "next/server";
import { getConfiguredProviders } from "@/lib/providers";
import { runRecon } from "@/lib/recon";
import { saveRunSafe } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Fan-out across providers is slow; give it room.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: { target?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const target = (body.target ?? "").trim();
  if (!target) {
    return NextResponse.json(
      { error: "Enter a public target — a company, product, project, or public figure." },
      { status: 400 },
    );
  }

  const providers = getConfiguredProviders();
  if (providers.length === 0) {
    return NextResponse.json(
      { error: "No provider keys found. Add at least one key to .env.local and restart." },
      { status: 400 },
    );
  }

  let dossier;
  try {
    dossier = await runRecon(target, providers);
  } catch (err) {
    return NextResponse.json(
      { error: `Recon failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  await saveRunSafe({
    mode: "B",
    input: target,
    config: { providers: providers.map((p) => p.id) },
    results: dossier,
  });

  return NextResponse.json(dossier);
}
