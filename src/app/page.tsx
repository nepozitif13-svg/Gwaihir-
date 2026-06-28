"use client";

import { useEffect, useState } from "react";
import ModeA from "@/components/ModeA";
import ModeB from "@/components/ModeB";
import { createClient } from "@/lib/supabase/client";

type ProviderInfo = { id: string; label: string };
type Health = {
  configured: ProviderInfo[];
  all: { id: string; label: string; configured: boolean }[];
  count: number;
};

export default function Page() {
  const [mode, setMode] = useState<"A" | "B">("A");
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealthError("Could not reach /api/health."));

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.app_metadata?.is_admin === true) setIsAdmin(true);
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-hairline">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-7 pb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3">
                <Eagle />
                <h1 className="font-mono text-2xl font-semibold tracking-tight">
                  GWAIHIR
                </h1>
              </div>
              <p className="mt-2 text-sm text-ink-soft max-w-xl">
                Reads the model layer from two sides — audits whether a model
                memorized your text, and runs cross-model recon on a public
                target.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <HealthPill health={health} error={healthError} />
              {isAdmin && (
                <a
                  href="/admin"
                  className="font-mono text-xs border border-hairline rounded px-3 py-2 text-ink-soft hover:text-ink hover:border-ink/40 transition-colors"
                >
                  admin
                </a>
              )}
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  className="font-mono text-xs border border-hairline rounded px-3 py-2 text-ink-soft hover:text-ink hover:border-ink/40 transition-colors"
                >
                  sign out
                </button>
              </form>
            </div>
          </div>

          {/* Mode toggle */}
          <div
            role="tablist"
            aria-label="Mode"
            className="mt-6 inline-flex rounded-md border border-hairline bg-manila-deep p-1"
          >
            <ModeTab
              active={mode === "A"}
              onClick={() => setMode("A")}
              kicker="MODE A"
              label="Memorization Audit"
            />
            <ModeTab
              active={mode === "B"}
              onClick={() => setMode("B")}
              kicker="MODE B"
              label="Model-Layer Recon"
            />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-7">
          {mode === "A" ? (
            <ModeA providers={health?.configured ?? []} />
          ) : (
            <ModeB
              providers={health?.configured ?? []}
              providerCount={health?.count ?? 0}
            />
          )}
        </div>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4">
          <p className="label-mono leading-relaxed">
            Gwaihir audits public information and model behavior. It does not
            extract private data. Mode B targets public entities only.
          </p>
        </div>
      </footer>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  kicker,
  label,
}: {
  active: boolean;
  onClick: () => void;
  kicker: string;
  label: string;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-4 py-2 rounded text-left transition-colors ${
        active
          ? "bg-ink text-manila"
          : "text-ink-soft hover:text-ink"
      }`}
    >
      <span
        className={`block font-mono text-[0.6rem] tracking-widest ${
          active ? "text-manila/70" : "text-ink-soft/70"
        }`}
      >
        {kicker}
      </span>
      <span className="block text-sm font-medium">{label}</span>
    </button>
  );
}

function HealthPill({
  health,
  error,
}: {
  health: Health | null;
  error: string | null;
}) {
  if (error) {
    return (
      <div className="font-mono text-xs text-ochre border border-ochre/40 rounded px-3 py-2">
        {error}
      </div>
    );
  }
  if (!health) {
    return (
      <div className="font-mono text-xs text-ink-soft border border-hairline rounded px-3 py-2">
        checking providers…
      </div>
    );
  }
  return (
    <div className="border border-hairline rounded px-3 py-2 bg-manila-deep">
      <div className="label-mono mb-1">providers online</div>
      <div className="flex flex-wrap gap-1.5">
        {health.all.map((p) => (
          <span
            key={p.id}
            className={`font-mono text-[0.7rem] px-1.5 py-0.5 rounded border ${
              p.configured
                ? "border-sage/50 text-sage bg-sage-soft"
                : "border-hairline text-ink-soft/50 line-through"
            }`}
          >
            {p.id}
          </span>
        ))}
      </div>
    </div>
  );
}

function Eagle() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-ink"
    >
      <path d="M2 9c4-3 7 0 10-2 3 2 6-1 10 2-3 3-6 2-8 2 1 2 0 5-2 7-2-2-3-5-2-7-2 0-5 1-6-2z" />
    </svg>
  );
}
