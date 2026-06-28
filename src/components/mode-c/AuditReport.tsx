"use client";

import { useState } from "react";
import { Panel } from "@/components/ModeA";
import type { AuditResult } from "@/lib/aeo/auditor";
import type { FaqItem } from "@/lib/aeo/generators/faq";

interface Props {
  audit: AuditResult;
  faqs: FaqItem[];
  schema: string | null;
  llmsTxt: string | null;
}

const LABEL_COLOR: Record<string, string> = {
  poor: "text-red-500",
  fair: "text-ochre",
  good: "text-emerald-500",
  excellent: "text-emerald-600",
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "text-red-500",
  medium: "text-ochre",
  low: "text-ink/60",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button onClick={copy} className="label-mono text-xs underline underline-offset-2">
      {copied ? "copied!" : "copy"}
    </button>
  );
}

export default function AuditReport({ audit, faqs, schema, llmsTxt }: Props) {
  const [tab, setTab] = useState<"audit" | "faq" | "schema" | "llms">("audit");

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-hairline pb-2">
        {(["audit", "faq", "schema", "llms"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`label-mono px-3 py-1 rounded ${
              tab === t ? "bg-ink text-paper" : "hover:bg-ink/5"
            }`}
          >
            {t === "llms" ? "llms.txt" : t}
          </button>
        ))}
      </div>

      {/* Audit tab */}
      {tab === "audit" && (
        <div className="space-y-4">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-4xl font-bold">{audit.score}</span>
            <span className={`label-mono text-lg ${LABEL_COLOR[audit.label] ?? ""}`}>
              {audit.label}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {Object.entries(audit.dimensions).map(([dim, val]) => (
              <Panel key={dim} title={dim} kicker={`${val} pts`}>
                <div className="h-2 rounded-full bg-hairline">
                  <div
                    className="h-full rounded-full bg-ink"
                    style={{ width: `${Math.round((val / 34) * 100)}%` }}
                  />
                </div>
              </Panel>
            ))}
          </div>

          <Panel title="recommendations" kicker={`${audit.recommendations.length} items`}>
            <ul className="space-y-2">
              {audit.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className={`label-mono shrink-0 ${PRIORITY_COLOR[r.priority] ?? ""}`}>
                    [{r.priority}]
                  </span>
                  <span className="font-mono text-sm">{r.text}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {/* FAQ tab */}
      {tab === "faq" && (
        <Panel title="faq blocks" kicker={`${faqs.length} items`}>
          <div className="space-y-4">
            {faqs.map((f, i) => (
              <div key={i} className="border-b border-hairline pb-3 last:border-0 last:pb-0">
                <p className="font-mono text-sm font-semibold mb-1">{f.question}</p>
                <p className="font-mono text-sm text-ink/70">{f.answer}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Schema tab */}
      {tab === "schema" && schema && (
        <Panel title="json-ld schema" kicker={<CopyButton text={schema} />}>
          <pre className="font-mono text-xs overflow-auto max-h-96 text-ink/80 whitespace-pre-wrap">
            {schema}
          </pre>
        </Panel>
      )}

      {/* llms.txt tab */}
      {tab === "llms" && llmsTxt && (
        <Panel title="llms.txt" kicker={<CopyButton text={llmsTxt} />}>
          <pre className="font-mono text-xs overflow-auto max-h-96 text-ink/80 whitespace-pre-wrap">
            {llmsTxt}
          </pre>
        </Panel>
      )}
    </div>
  );
}
