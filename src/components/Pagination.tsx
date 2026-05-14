"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function go(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    router.push(`/?${next.toString()}`);
  }

  if (totalPages <= 1) return null;
  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  return (
    <div className="flex items-center justify-center gap-2 mt-6 text-sm">
      <button
        onClick={() => go(prev)}
        disabled={page <= 1}
        className="px-3 py-1 rounded border border-slate-200 bg-white disabled:opacity-40"
      >
        ← Précédent
      </button>
      <span className="text-slate-500">
        Page {page} / {totalPages}
      </span>
      <button
        onClick={() => go(next)}
        disabled={page >= totalPages}
        className="px-3 py-1 rounded border border-slate-200 bg-white disabled:opacity-40"
      >
        Suivant →
      </button>
    </div>
  );
}
