import { NextRequest, NextResponse } from "next/server";
import { getConfiguredProviders } from "@/lib/providers";
import { runRecon } from "@/lib/recon";
import { saveRunSafe } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Rate limit
  const rl = await checkRateLimit(user.id, "mode-b");
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Retry in ${Math.ceil(rl.retryAfterMs / 1000)}s.` },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

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
      { status: 400 }
    );
  }

  const providers = getConfiguredProviders();
  if (providers.length === 0) {
    return NextResponse.json(
      { error: "No provider keys configured." },
      { status: 400 }
    );
  }

  let dossier;
  try {
    dossier = await runRecon(target, providers);
  } catch (err) {
    return NextResponse.json(
      { error: `Recon failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  await saveRunSafe({ userId: user.id, mode: "B", input: target, config: { providers: providers.map((p) => p.id) }, results: dossier });

  return NextResponse.json(dossier);
}
