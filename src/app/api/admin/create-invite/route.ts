import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Проверяем что запрос от admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // app_metadata is only writable via service_role — cannot be spoofed by the user
  if (!user || user.app_metadata?.is_admin !== true) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Генерируем читаемый код: XXXX-XXXX-XXXX
  const code = randomBytes(6)
    .toString("hex")
    .toUpperCase()
    .match(/.{4}/g)!
    .join("-");

  const service = createServiceClient();
  const { error } = await service.from("invites").insert({
    code,
    created_by: user.id,
    max_uses: 1,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to create invite." }, { status: 500 });
  }

  return NextResponse.json({ code });
}
