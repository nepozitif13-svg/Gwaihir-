import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { code?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const code = (body.code ?? "").trim();
  if (!code) return NextResponse.json({ error: "Invite code required." }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("invites")
    .select("id, uses, max_uses")
    .eq("code", code)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Invalid invite code." }, { status: 400 });
  }

  if (data.uses >= data.max_uses) {
    return NextResponse.json({ error: "Invite code has already been used." }, { status: 400 });
  }

  return NextResponse.json({ inviteId: data.id });
}
