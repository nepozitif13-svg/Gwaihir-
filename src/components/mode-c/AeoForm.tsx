"use client";

import { useState } from "react";
import type { AuditResult } from "@/lib/aeo/auditor";
import type { FaqItem } from "@/lib/aeo/generators/faq";

type ProviderInfo = { id: string; label: string };

interface StreamState {
  step: string;
  message: string;
}

interface AnalysisResult {
  audit: AuditResult | null;
  faqs: FaqItem[];
  schema: string | null;
  llmsTxt: string | null;
}

interface Props {
  providers: ProviderInfo[];
  onResult: (r: AnalysisResult) => void;
}

export default function AeoForm({ providers, onResult }: Props) {
  const [url, setUrl] = useState("");
  const [queries, setQueries] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [siteName, setSiteName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<StreamState | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setProgress(null);

    const result: AnalysisResult = { audit: null, faqs: [], schema: null, llmsTxt: null };

    try {
      const res = await fetch("/api/mode-c/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url,
          queries: queries.split("\n").map((q) => q.trim()).filter(Boolean),
          competitors: competitors.split("\n").map((c) => c.trim()).filter(Boolean),
          providerId,
          siteName: siteName || undefined,
          description: description || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const raw of events) {
          const lines = raw.split("\n");
          let eventType = "";
          let dataLine = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7);
            if (line.startsWith("data: ")) dataLine = line.slice(6);
          }
          if (!eventType || !dataLine) continue;
          try {
            const payload = JSON.parse(dataLine);
            if (eventType === "progress") setProgress(payload);
            if (eventType === "audit") result.audit = payload;
            if (eventType === "faq") result.faqs = payload;
            if (eventType === "schema") result.schema = payload.json;
            if (eventType === "llms") result.llmsTxt = payload.text;
            if (eventType === "error") { setError(payload.message); break; }
            if (eventType === "done") onResult(result);
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  const noProviders = providers.length === 0;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <label className="block">
          <span className="label-mono block mb-1">page url</span>
          <input
            className="input-base w-full"
            type="url"
            placeholder="https://example.com/page"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
        </label>

        <label className="block">
          <span className="label-mono block mb-1">target queries (one per line)</span>
          <textarea
            className="input-base w-full h-24 resize-none"
            placeholder={"best project management tools\nhow to organize remote team"}
            value={queries}
            onChange={(e) => setQueries(e.target.value)}
            disabled={loading}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label-mono block mb-1">site name (optional)</span>
            <input
              className="input-base w-full"
              placeholder="Acme Corp"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              disabled={loading}
            />
          </label>
          <label className="block">
            <span className="label-mono block mb-1">provider</span>
            <select
              className="input-base w-full"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              disabled={loading || noProviders}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="label-mono block mb-1">site description (optional)</span>
          <input
            className="input-base w-full"
            placeholder="Short description for llms.txt"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />
        </label>

        <label className="block">
          <span className="label-mono block mb-1">competitors (one per line, optional)</span>
          <textarea
            className="input-base w-full h-20 resize-none"
            placeholder={"competitor1.com\ncompetitor2.com"}
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
            disabled={loading}
          />
        </label>
      </div>

      {noProviders && (
        <p className="label-mono text-ochre">No API keys configured. Add at least one provider key.</p>
      )}

      {error && (
        <div className="rounded-md border border-ochre/50 bg-ochre-soft/50 p-3">
          <p className="font-mono text-sm text-ink">{error}</p>
        </div>
      )}

      {loading && progress && (
        <div className="flex items-center gap-2 label-mono text-ink/60">
          <span className="animate-pulse">●</span>
          <span>{progress.message}</span>
        </div>
      )}

      <button
        className="btn-primary w-full"
        onClick={run}
        disabled={loading || noProviders || !url.trim() || !queries.trim()}
      >
        {loading ? "Analyzing..." : "Run AEO Analysis"}
      </button>
    </div>
  );
}
