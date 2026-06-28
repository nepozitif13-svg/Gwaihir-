import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Требуем авторизацию — userId берём из сессии, не из body
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { inviteId?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  if (!body.inviteId) {
    return NextResponse.json({ error: "Missing inviteId." }, { status: 400 });
  }

  // Проверяем что inviteId совпадает с тем что был сохранён при регистрации
  const expectedInviteId = user.user_metadata?.invite_id;
  if (expectedInviteId && expectedInviteId !== body.inviteId) {
    return NextResponse.json({ error: "Invite mismatch." }, { status: 403 });
  }

  const service = createServiceClient();
  await service.rpc("use_invite", {
    p_invite_id: body.inviteId,
    p_user_id: user.id, // всегда из сессии, не из body
  });

  return NextResponse.json({ ok: true });
}
