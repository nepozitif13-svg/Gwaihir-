import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership before deleting
  const { data: monitor } = await supabase
    .from("aeo_monitors")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!monitor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const service = createServiceClient();
  await service.from("aeo_monitors").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error: dbErr } = await supabase
    .from("aeo_monitors")
    .select("*, aeo_monitor_results(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (dbErr || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ monitor: data });
}
