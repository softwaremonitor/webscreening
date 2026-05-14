"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunBatchButton({
  mode,
  label,
  sourceId,
}: {
  mode: "manual" | "daily" | "backfill";
  label: string;
  sourceId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function trigger() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/batches/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, sourceId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMsg("Batch lancé. Actualisez l'historique dans quelques minutes.");
      router.refresh();
    } catch (err) {
      setMsg(`Échec : ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={trigger}
        disabled={busy}
        className="px-3 py-1.5 rounded bg-brand text-white text-sm disabled:opacity-50"
      >
        {busy ? "En cours…" : label}
      </button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}
