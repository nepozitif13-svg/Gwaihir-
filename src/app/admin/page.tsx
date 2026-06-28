import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { GenerateInviteButton } from "./GenerateInviteButton";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.user_metadata?.is_admin !== true) redirect("/");

  const service = createServiceClient();

  const [{ data: invites }, { data: runStats }] = await Promise.all([
    service.from("invites").select("*").order("created_at", { ascending: false }),
    service.from("runs").select("user_id, mode").limit(1000),
  ]);

  // Группируем runs по user_id
  const runsByUser: Record<string, { A: number; B: number }> = {};
  for (const run of runStats ?? []) {
    if (!runsByUser[run.user_id]) runsByUser[run.user_id] = { A: 0, B: 0 };
    runsByUser[run.user_id][run.mode as "A" | "B"]++;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-lg font-semibold">Admin</h1>
        <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300">← Back</a>
      </div>

      {/* Генерация инвайтов */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-300">Invite codes</h2>
          <GenerateInviteButton adminId={user.id} />
        </div>

        <div className="space-y-2">
          {(invites ?? []).length === 0 && (
            <p className="text-xs text-zinc-600">No invite codes yet.</p>
          )}
          {(invites ?? []).map((inv: { id: string; code: string; uses: number; max_uses: number }) => (
            <div key={inv.id} className="flex items-center justify-between bg-zinc-900 rounded px-3 py-2">
              <code className="text-xs font-mono text-zinc-300">{inv.code}</code>
              <span className={`text-xs ${inv.uses >= inv.max_uses ? "text-zinc-600" : "text-green-500"}`}>
                {inv.uses >= inv.max_uses ? "used" : `${inv.uses}/${inv.max_uses}`}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Статистика runs */}
      <section>
        <h2 className="text-sm font-medium text-zinc-300 mb-3">Usage by user</h2>
        {Object.keys(runsByUser).length === 0 && (
          <p className="text-xs text-zinc-600">No runs yet.</p>
        )}
        <div className="space-y-2">
          {Object.entries(runsByUser).map(([uid, counts]) => (
            <div key={uid} className="flex items-center justify-between bg-zinc-900 rounded px-3 py-2">
              <code className="text-xs font-mono text-zinc-500 truncate max-w-[200px]">{uid}</code>
              <span className="text-xs text-zinc-400">
                Mode A: {counts.A} &nbsp;·&nbsp; Mode B: {counts.B}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
