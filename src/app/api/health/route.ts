import { NextResponse } from "next/server";
import { ALL_PROVIDERS, getConfiguredProviders } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const configured = getConfiguredProviders();
  return NextResponse.json({
    ok: true,
    configured: configured.map((p) => ({ id: p.id, label: p.label })),
    all: ALL_PROVIDERS.map((p) => ({
      id: p.id,
      label: p.label,
      configured: p.isConfigured(),
    })),
    count: configured.length,
  });
}
