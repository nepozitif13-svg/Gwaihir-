import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { inviteId?: string; userId?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  if (!body.inviteId || !body.userId) {
    return NextResponse.json({ error: "Missing params." }, { status: 400 });
  }

  const supabase = createServiceClient();
  await supabase.rpc("use_invite", {
    p_invite_id: body.inviteId,
    p_user_id: body.userId,
  });

  return NextResponse.json({ ok: true });
}
