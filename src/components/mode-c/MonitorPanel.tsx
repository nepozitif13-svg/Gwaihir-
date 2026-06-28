"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ModeA";
import MonitorDialog from "./MonitorDialog";

interface MonitorResult {
  mentioned: boolean;
  query: string;
  provider: string;
  created_at: string;
}

interface Monitor {
  id: string;
  brand_name: string;
  queries: string[];
  providers: string[];
  last_checked_at: string | null;
  active: boolean;
  aeo_monitor_results?: MonitorResult[];
}

interface Props {
  availableProviders: { id: string; label: string }[];
}

export default function MonitorPanel({ availableProviders }: Props) {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  async function fetchMonitors() {
    setLoading(true);
    try {
      const res = await fetch("/api/mode-c/monitor");
      const data = await res.json() as { monitors?: Monitor[] };
      setMonitors(data.monitors ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchMonitors(); }, []);

  async function deleteMonitor(id: string) {
    await fetch(`/api/mode-c/monitor/${id}`, { method: "DELETE" });
    setMonitors((m) => m.filter((x) => x.id !== id));
  }

  function mentionRate(m: Monitor): string {
    const results = m.aeo_monitor_results ?? [];
    if (!results.length) return "no data";
    const mentioned = results.filter((r) => r.mentioned).length;
    return `${Math.round((mentioned / results.length) * 100)}%`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="label-mono">brand monitors</span>
        <button
          className="btn-primary text-sm"
          onClick={() => setShowDialog(true)}
        >
          + Add Monitor
        </button>
      </div>

      {loading && <p className="label-mono text-ink/50">Loading...</p>}

      {!loading && monitors.length === 0 && (
        <p className="label-mono text-ink/50">
          No monitors yet. Create one to track your brand mentions across AI providers.
        </p>
      )}

      {monitors.map((m) => (
        <Panel key={m.id} title={m.brand_name} kicker={mentionRate(m)}>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {m.providers.map((p) => (
                <span key={p} className="label-mono bg-ink/5 px-2 py-0.5 rounded">{p}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {m.queries.map((q, i) => (
                <span key={i} className="label-mono text-ink/60 text-xs">"{q}"</span>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="label-mono text-xs text-ink/40">
                last checked: {m.last_checked_at ? new Date(m.last_checked_at).toLocaleDateString() : "never"}
              </span>
              <button
                className="label-mono text-xs text-red-500 hover:underline"
                onClick={() => deleteMonitor(m.id)}
              >
                delete
              </button>
            </div>

            {/* Recent results */}
            {(m.aeo_monitor_results ?? []).length > 0 && (
              <div className="mt-2 space-y-1 border-t border-hairline pt-2">
                {m.aeo_monitor_results!.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono">
                    <span className={r.mentioned ? "text-emerald-500" : "text-red-500"}>
                      {r.mentioned ? "✓" : "✗"}
                    </span>
                    <span className="text-ink/60">{r.provider}</span>
                    <span className="truncate text-ink/50">"{r.query}"</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      ))}

      {showDialog && (
        <MonitorDialog
          availableProviders={availableProviders}
          onClose={() => setShowDialog(false)}
          onCreated={() => { setShowDialog(false); fetchMonitors(); }}
        />
      )}
    </div>
  );
}
