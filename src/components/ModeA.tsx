"use client";

import { useState } from "react";

type ProviderInfo = { id: string; label: string };

interface ScoreResult {
  provider: { id: string; label: string };
  splitPct: number;
  prefix: string;
  trueSuffix: string;
  modelContinuation: string;
  score: {
    memorizationScore: number;
    label: string;
    longestRun: number;
    leadingExactMatch: number;
    suffixTokenCount: number;
  };
  highlight: { before: string; matched: string; after: string };
}

const SAMPLE =
  "We the People of the United States, in Order to form a more perfect Union, establish Justice, insure domestic Tranquility, provide for the common defence, promote the general Welfare, and secure the Blessings of Liberty to ourselves and our Posterity, do ordain and establish this Constitution for the United States of America.";

export default function ModeA({ providers }: { providers: ProviderInfo[] }) {
  const [text, setText] = useState("");
  const [splitPct, setSplitPct] = useState(40);
  const [providerId, setProviderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const noProviders = providers.length === 0;
  const activeProvider = providerId || providers[0]?.id || "";

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/mode-a", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, splitPct, providerId: activeProvider }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Probe failed.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error reaching the probe endpoint.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* INPUT */}
      <section className="space-y-4">
        <Panel title="Target text" kicker="INPUT">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the text you want to test for memorization…"
            rows={9}
            className="w-full resize-y rounded border border-hairline bg-white/60 p-3 text-sm leading-relaxed focus:bg-white"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="label-mono">{text.length} chars</span>
            <button
              type="button"
              onClick={() => setText(SAMPLE)}
              className="font-mono text-xs text-ink-soft underline underline-offset-2 hover:text-ink"
            >
              load sample (US Constitution preamble)
            </button>
          </div>
        </Panel>

        <Panel title="Probe configuration" kicker="CONFIG">
          <label className="block">
            <span className="label-mono">prefix split — {splitPct}%</span>
            <input
              type="range"
              min={10}
              max={90}
              value={splitPct}
              onChange={(e) => setSplitPct(Number(e.target.value))}
              className="mt-2 w-full accent-ink"
            />
            <span className="mt-1 block text-xs text-ink-soft">
              Sends the first {splitPct}% to the model; scores how much of the
              remaining {100 - splitPct}% it reproduces verbatim.
            </span>
          </label>

          <label className="mt-4 block">
            <span className="label-mono">provider</span>
            <select
              value={activeProvider}
              onChange={(e) => setProviderId(e.target.value)}
              disabled={noProviders}
              className="mt-1 w-full rounded border border-hairline bg-white/60 p-2 text-sm font-mono"
            >
              {noProviders && <option>no providers configured</option>}
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={run}
            disabled={loading || noProviders || text.trim().length < 40}
            className="mt-4 w-full rounded bg-ink px-4 py-2.5 font-mono text-sm font-medium text-manila disabled:opacity-40 hover:bg-ink-soft transition-colors"
          >
            {loading ? "probing…" : "Run probe"}
          </button>
          {noProviders && (
            <p className="mt-2 text-xs text-ochre">
              No provider keys found. Add at least one key to .env.local and
              restart.
            </p>
          )}
        </Panel>
      </section>

      {/* OUTPUT */}
      <section className="space-y-4">
        {error && <ErrorBox message={error} />}

        {!result && !error && (
          <Panel title="Result" kicker="OUTPUT">
            <p className="text-sm text-ink-soft">
              {loading
                ? "Sending prefix and comparing the continuation…"
                : "Run a probe to see the memorization score and the reproduced span."}
            </p>
          </Panel>
        )}

        {result && (
          <>
            <Panel
              title="Memorization score"
              kicker={`VIA ${result.provider.label.toUpperCase()}`}
            >
              <ScoreReadout
                score={result.score.memorizationScore}
                label={result.score.label}
              />
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-hairline pt-3">
                <Stat label="longest run" value={`${result.score.longestRun} tok`} />
                <Stat
                  label="leading match"
                  value={`${result.score.leadingExactMatch} tok`}
                />
                <Stat
                  label="suffix length"
                  value={`${result.score.suffixTokenCount} tok`}
                />
              </div>
            </Panel>

            <Panel title="Reproduced span" kicker="DIFF">
              <p className="text-sm leading-relaxed">
                {result.highlight.before}
                {result.highlight.matched && (
                  <mark className="rounded bg-ochre-soft px-0.5 text-ink decoration-ochre underline decoration-2 underline-offset-2">
                    {result.highlight.matched}
                  </mark>
                )}
                {result.highlight.after}
              </p>
              <p className="mt-2 label-mono">
                highlighted = longest contiguous token run the model reproduced
              </p>

              <button
                onClick={() => setShowRaw((v) => !v)}
                className="mt-4 font-mono text-xs text-ink-soft underline underline-offset-2 hover:text-ink"
              >
                {showRaw ? "▾ hide" : "▸ show"} raw model continuation
              </button>
              {showRaw && (
                <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded border border-hairline bg-white/60 p-3 text-xs leading-relaxed">
                  {result.modelContinuation || "(empty response)"}
                </pre>
              )}
            </Panel>
          </>
        )}
      </section>
    </div>
  );
}

function ScoreReadout({ score, label }: { score: number; label: string }) {
  const tone =
    score >= 60 ? "text-ochre" : score >= 25 ? "text-ink" : "text-sage";
  return (
    <div>
      <div className={`font-mono font-bold leading-none ${tone}`}>
        <span className="text-7xl">{score}</span>
        <span className="text-2xl text-ink-soft">/100</span>
      </div>
      <div className={`mt-2 font-mono text-sm ${tone}`}>{label}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label-mono">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}

export function Panel({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-hairline bg-manila-deep/40 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-mono text-sm font-semibold">{title}</h2>
        <span className="label-mono">{kicker}</span>
      </div>
      {children}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-ochre/50 bg-ochre-soft/50 p-4">
      <div className="label-mono mb-1 text-ochre">probe error</div>
      <p className="font-mono text-sm text-ink">{message}</p>
    </div>
  );
}
