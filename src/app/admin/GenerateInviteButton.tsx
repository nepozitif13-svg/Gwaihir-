"use client";

import { useState } from "react";

export function GenerateInviteButton({ adminId }: { adminId: string }) {
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    const res = await fetch("/api/admin/create-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const d = await res.json();
      alert(d.error ?? "Failed to generate invite.");
    }
    setLoading(false);
  }

  return (
    <button
      onClick={generate}
      disabled={loading}
      className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded px-3 py-1.5 transition disabled:opacity-50"
    >
      {loading ? "Generating…" : "+ New invite"}
    </button>
  );
}
