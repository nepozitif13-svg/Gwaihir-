"use client";

import { useState } from "react";
import AeoForm from "@/components/mode-c/AeoForm";
import AuditReport from "@/components/mode-c/AuditReport";
import MonitorPanel from "@/components/mode-c/MonitorPanel";
import type { AuditResult } from "@/lib/aeo/auditor";
import type { FaqItem } from "@/lib/aeo/generators/faq";

type ProviderInfo = { id: string; label: string };

interface AnalysisResult {
  audit: AuditResult | null;
  faqs: FaqItem[];
  schema: string | null;
  llmsTxt: string | null;
}

export default function ModeC({ providers }: { providers: ProviderInfo[] }) {
  const [tab, setTab] = useState<"analyze" | "monitor">("analyze");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1">
        {(["analyze", "monitor"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`label-mono px-4 py-1.5 rounded-full border transition-colors ${
              tab === t
                ? "bg-ink text-paper border-ink"
                : "border-hairline hover:bg-ink/5"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "analyze" && (
        <div className="space-y-6">
          <AeoForm
            providers={providers}
            onResult={(r) => setResult(r)}
          />
          {result?.audit && (
            <AuditReport
              audit={result.audit}
              faqs={result.faqs}
              schema={result.schema}
              llmsTxt={result.llmsTxt}
            />
          )}
        </div>
      )}

      {tab === "monitor" && (
        <MonitorPanel availableProviders={providers} />
      )}
    </div>
  );
}
