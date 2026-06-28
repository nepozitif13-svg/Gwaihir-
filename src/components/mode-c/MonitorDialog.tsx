"use client";

import { useState } from "react";

interface Props {
  availableProviders: { id: string; label: string }[];
  onClose: () => void;
  onCreated: () => void;
}

export default function MonitorDialog({ availableProviders, onClose, onCreated }: Props) {
  const [brandName, setBrandName] = useState("");
  const [queries, setQueries] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<string[]>(
    availableProviders.slice(0, 2).map((p) => p.id)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleProvider(id: string) {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function create() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mode-c/monitor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brand_name: brandName.trim(),
          queries: queries.split("\n").map((q) => q.trim()).filter(Boolean),
          providers: selectedProviders,
        }),
      });
      const data = await res.json() as { error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to create monitor");
        return;
      }
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm">
      <div className="bg-paper rounded-lg border border-hairline p-6 w-full max-w-md shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-sm font-semibold">new brand monitor</h2>
          <button onClick={onClose} className="label-mono text-ink/40 hover:text-ink">✕</button>
        </div>

        <label className="block">
          <span className="label-mono block mb-1">brand name</span>
          <input
            className="input-base w-full"
            placeholder="Acme Corp"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            disabled={loading}
          />
        </label>

        <label className="block">
          <span className="label-mono block mb-1">queries to monitor (one per line)</span>
          <textarea
            className="input-base w-full h-24 resize-none"
            placeholder={"best CRM for startups\ntop project management tools"}
            value={queries}
            onChange={(e) => setQueries(e.target.value)}
            disabled={loading}
          />
        </label>

        <div>
          <span className="label-mono block mb-2">providers to check</span>
          <div className="flex flex-wrap gap-2">
            {availableProviders.map((p) => (
              <button
                key={p.id}
                onClick={() => toggleProvider(p.id)}
                className={`label-mono px-3 py-1 rounded border transition-colors ${
                  selectedProviders.includes(p.id)
                    ? "bg-ink text-paper border-ink"
                    : "border-hairline hover:bg-ink/5"
                }`}
                disabled={loading}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="label-mono text-red-500 text-xs">{error}</p>
        )}

        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn-primary flex-1"
            onClick={create}
            disabled={loading || !brandName.trim() || !queries.trim() || !selectedProviders.length}
          >
            {loading ? "Creating..." : "Create Monitor"}
          </button>
        </div>
      </div>
    </div>
  );
}
