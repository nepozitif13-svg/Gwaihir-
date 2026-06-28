import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkMonitor, MonitorRow } from "@/lib/monitoring/checker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // CRON_SECRET guard — must be checked FIRST
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();
  const { data: monitors, error } = await service
    .from("aeo_monitors")
    .select("id, user_id, brand_name, queries, providers")
    .eq("active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { id: string; status: string; error?: string }[] = [];

  for (const monitor of monitors as MonitorRow[]) {
    try {
      await checkMonitor(monitor);
      results.push({ id: monitor.id, status: "ok" });
    } catch (err: unknown) {
      results.push({
        id: monitor.id,
        status: "error",
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return NextResponse.json({ checked: results.length, results });
}
