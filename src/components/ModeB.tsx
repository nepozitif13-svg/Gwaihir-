"use client";

import { useState } from "react";
import { Panel, ErrorBox } from "@/components/ModeA";

type ProviderInfo = { id: string; label: string };

interface Dossier {
  target: string;
  providersQueried: string[];
  providerLabels: Record<string, string>;
  warning?: string;
  claims: {
    subject: string;
    attribute: string;
    value: string;
    providers: string[];
    distinctProviderCount: number;
    status: "consensus" | "contested";
  }[];
  sentiment: {
    provider: string;
    sentiment: "positive" | "neutral" | "negative";
    note: string;
  }[];
  shareOfVoice: { name: string; mentions: number }[];
  summary: string;
}

export default function ModeB({
  providers,
  providerCount,
}: {
  providers: ProviderInfo[];
  providerCount: number;
}) {
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dossier, setDossier] = useState<Dossier | null>(null);

  const noProviders = providers.length === 0;

  async function run() {
    setLoading(true);
    setError(null);
    setDossier(null);
    try {
      const res = await fetch("/api/mode-b", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Recon failed.");
      else setDossier(data);
    } catch {
      setError("Network error reaching the recon endpoint.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel title="Target" kicker="INPUT">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading && !noProviders && target.trim())
                run();
            }}
            placeholder="A public company, product, project, or public figure…"
            className="flex-1 rounded border border-hairline bg-white/60 p-2.5 text-sm focus:bg-white"
          />
          <button
            onClick={run}
            disabled={loading || noProviders || !target.trim()}
            className="rounded bg-ink px-5 py-2.5 font-mono text-sm font-medium text-manila disabled:opacity-40 hover:bg-ink-soft transition-colors"
          >
            {loading ? "running…" : "Run recon"}
          </button>
        </div>

        {providerCount < 2 && (
          <p className="mt-3 text-xs text-ochre">
            {noProviders
              ? "No provider keys found. Add at least one key to .env.local and restart."
              : "Only one provider configured. Cross-checking needs ≥2 — results will be flagged contested by default."}
          </p>
        )}
      </Panel>

      {loading && <FanOutProgress providers={providers} />}

      {error && <ErrorBox message={error} />}

      {dossier && <DossierView dossier={dossier} />}
    </div>
  );
}

function FanOutProgress({ providers }: { providers: ProviderInfo[] }) {
  return (
    <Panel title="Fan-out in progress" kicker="QUERYING">
      <p className="mb-3 text-sm text-ink-soft">
        Sending the 8-question battery to each model, extracting claims, and
        cross-checking. This takes a moment.
      </p>
      <ul className="space-y-1.5">
        {providers.map((p) => (
          <li key={p.id} className="flex items-center gap-2 font-mono text-sm">
            <span className="pulse-dot h-2 w-2 rounded-full bg-sage" />
            {p.label}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function DossierView({ dossier }: { dossier: Dossier }) {
  const label = (id: string) => dossier.providerLabels[id] ?? id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-md border border-hairline bg-manila-deep/40 p-4">
        <div className="label-mono">dossier</div>
        <h2 className="font-mono text-2xl font-semibold">{dossier.target}</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Queried {dossier.providersQueried.length} model
          {dossier.providersQueried.length === 1 ? "" : "s"}:{" "}
          {dossier.providersQueried.map(label).join(", ")}
        </p>
        {dossier.warning && (
          <p className="mt-3 rounded border border-ochre/50 bg-ochre-soft/60 p-2 text-xs text-ink">
            ⚠ {dossier.warning}
          </p>
        )}
      </div>

      {/* Summary */}
      <Panel title="Read-out" kicker="SUMMARY">
        <p className="text-sm leading-relaxed">{dossier.summary}</p>
      </Panel>

      {/* Claims */}
      <Panel
        title={`Claims (${dossier.claims.length})`}
        kicker="CONSENSUS ↔ CONTESTED"
      >
        {dossier.claims.length === 0 ? (
          <p className="text-sm text-ink-soft">
            No atomic claims were extracted. Try a more well-known target.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-hairline text-left">
                  <th className="py-2 pr-3 label-mono font-normal">Claim</th>
                  <th className="py-2 pr-3 label-mono font-normal">Providers</th>
                  <th className="py-2 label-mono font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {dossier.claims.map((c, i) => (
                  <tr key={i} className="border-b border-hairline/60 align-top">
                    <td className="py-2 pr-3">
                      <span className="font-medium">{c.subject}</span>
                      <span className="text-ink-soft"> · {c.attribute} · </span>
                      <span>{c.value}</span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-ink-soft">
                      {c.distinctProviderCount}×{" "}
                      <span className="text-ink-soft/70">
                        ({c.providers.join(", ")})
                      </span>
                    </td>
                    <td className="py-2">
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Sentiment */}
      <Panel title="Sentiment by model" kicker="PORTRAYAL">
        <div className="flex flex-wrap gap-2">
          {dossier.sentiment.map((s) => (
            <div
              key={s.provider}
              className={`rounded border px-3 py-2 ${sentimentTone(s.sentiment)}`}
            >
              <div className="font-mono text-xs font-semibold">
                {label(s.provider)} · {s.sentiment}
              </div>
              <div className="text-xs text-ink-soft">{s.note}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Share of voice */}
      <Panel title="Share of voice" kicker="NAMED ALTERNATIVES">
        {dossier.shareOfVoice.length === 0 ? (
          <p className="text-sm text-ink-soft">No alternatives were named.</p>
        ) : (
          <ul className="space-y-1.5">
            {dossier.shareOfVoice.map((s) => {
              const max = dossier.shareOfVoice[0].mentions || 1;
              return (
                <li key={s.name} className="flex items-center gap-3">
                  <span className="w-40 truncate text-sm">{s.name}</span>
                  <span className="h-3 flex-1 rounded bg-manila">
                    <span
                      className="block h-3 rounded bg-sage"
                      style={{ width: `${(s.mentions / max) * 100}%` }}
                    />
                  </span>
                  <span className="w-10 text-right font-mono text-xs text-ink-soft">
                    {s.mentions}×
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function StatusBadge({ status }: { status: "consensus" | "contested" }) {
  return status === "consensus" ? (
    <span className="rounded border border-sage/50 bg-sage-soft px-2 py-0.5 font-mono text-xs text-sage">
      consensus
    </span>
  ) : (
    <span className="rounded border border-ochre/50 bg-ochre-soft px-2 py-0.5 font-mono text-xs text-ochre">
      contested
    </span>
  );
}

function sentimentTone(s: "positive" | "neutral" | "negative") {
  if (s === "positive") return "border-sage/50 bg-sage-soft";
  if (s === "negative") return "border-ochre/50 bg-ochre-soft";
  return "border-hairline bg-manila-deep";
}
