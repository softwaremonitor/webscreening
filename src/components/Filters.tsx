"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Facets {
  sources: { id: string; name: string }[];
  keywords: { id: string; text: string }[];
  languages: string[];
}

export function Filters() {
  const router = useRouter();
  const params = useSearchParams();
  const [facets, setFacets] = useState<Facets | null>(null);
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => {
    fetch("/api/facets")
      .then((r) => r.json())
      .then((d) => setFacets(d))
      .catch(() => setFacets({ sources: [], keywords: [], languages: [] }));
  }, []);

  function update(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete("page");
    router.push(`/?${next.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    update("q", q.trim());
  }

  return (
    <div className="bg-white border border-slate-200 rounded-md p-4 mb-6 grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
      <form onSubmit={submitSearch} className="md:col-span-2">
        <label className="block text-xs text-slate-500 mb-1">Recherche texte</label>
        <input
          type="search"
          placeholder="ex. recyclage, Amcor…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full border border-slate-300 rounded px-2 py-1"
        />
      </form>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Source</label>
        <select
          value={params.get("source") ?? ""}
          onChange={(e) => update("source", e.target.value)}
          className="w-full border border-slate-300 rounded px-2 py-1 bg-white"
        >
          <option value="">Toutes</option>
          {facets?.sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Mot-clé</label>
        <select
          value={params.get("keyword") ?? ""}
          onChange={(e) => update("keyword", e.target.value)}
          className="w-full border border-slate-300 rounded px-2 py-1 bg-white"
        >
          <option value="">Tous</option>
          {facets?.keywords.map((k) => (
            <option key={k.id} value={k.text}>
              {k.text}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Du</label>
          <input
            type="date"
            value={params.get("from") ?? ""}
            onChange={(e) => update("from", e.target.value)}
            className="w-full border border-slate-300 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Au</label>
          <input
            type="date"
            value={params.get("to") ?? ""}
            onChange={(e) => update("to", e.target.value)}
            className="w-full border border-slate-300 rounded px-2 py-1"
          />
        </div>
      </div>
    </div>
  );
}
