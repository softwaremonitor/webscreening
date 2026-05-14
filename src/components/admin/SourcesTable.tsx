"use client";

import { useState } from "react";
import type { Source } from "@prisma/client";

type SourceForm = {
  name: string;
  homepageUrl: string;
  feedUrl: string;
  sitemapUrl: string;
  fetchStrategy: "auto" | "rss" | "sitemap" | "html";
  defaultLanguage: string;
  perDayLimit: number;
  enabled: boolean;
  notes: string;
};

const emptyForm: SourceForm = {
  name: "",
  homepageUrl: "",
  feedUrl: "",
  sitemapUrl: "",
  fetchStrategy: "auto",
  defaultLanguage: "",
  perDayLimit: 10,
  enabled: true,
  notes: "",
};

export function SourcesTable({ initialItems }: { initialItems: Source[] }) {
  const [items, setItems] = useState<Source[]>(initialItems);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<SourceForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  function startEdit(s: Source) {
    setCreating(false);
    setEditing(s.id);
    setForm({
      name: s.name,
      homepageUrl: s.homepageUrl,
      feedUrl: s.feedUrl ?? "",
      sitemapUrl: s.sitemapUrl ?? "",
      fetchStrategy: s.fetchStrategy as SourceForm["fetchStrategy"],
      defaultLanguage: s.defaultLanguage ?? "",
      perDayLimit: s.perDayLimit,
      enabled: s.enabled,
      notes: s.notes ?? "",
    });
  }

  async function save() {
    setBusy(true);
    try {
      const payload = {
        ...form,
        feedUrl: form.feedUrl || null,
        sitemapUrl: form.sitemapUrl || null,
        defaultLanguage: form.defaultLanguage || null,
        notes: form.notes || null,
      };
      if (creating) {
        const res = await fetch("/api/admin/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) setItems([data.item, ...items]);
        else alert(data.error ?? "Erreur");
      } else if (editing) {
        const res = await fetch(`/api/admin/sources/${editing}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          setItems(items.map((s) => (s.id === editing ? data.item : s)));
        } else alert(data.error ?? "Erreur");
      }
      cancel();
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setEditing(null);
    setCreating(false);
    setForm(emptyForm);
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cette source ?")) return;
    const res = await fetch(`/api/admin/sources/${id}`, { method: "DELETE" });
    if (res.ok) setItems(items.filter((s) => s.id !== id));
  }

  async function toggle(id: string, enabled: boolean) {
    const res = await fetch(`/api/admin/sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) setItems(items.map((s) => (s.id === id ? { ...s, enabled } : s)));
  }

  const filtered = items.filter(
    (s) =>
      !filter ||
      s.name.toLowerCase().includes(filter.toLowerCase()) ||
      s.homepageUrl.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <input
          type="search"
          placeholder="Filtrer…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-slate-300 rounded px-3 py-1.5 text-sm w-64"
        />
        <button
          onClick={() => {
            setCreating(true);
            setEditing(null);
            setForm(emptyForm);
          }}
          className="bg-brand text-white text-sm rounded px-3 py-1.5"
        >
          + Ajouter une source
        </button>
      </div>

      {(creating || editing) && (
        <div className="bg-white border border-slate-200 rounded-md p-4 grid md:grid-cols-2 gap-3 text-sm">
          <Field label="Nom">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded px-2 py-1"
            />
          </Field>
          <Field label="URL homepage">
            <input
              value={form.homepageUrl}
              onChange={(e) => setForm({ ...form, homepageUrl: e.target.value })}
              className="w-full border rounded px-2 py-1"
            />
          </Field>
          <Field label="URL flux RSS / Atom">
            <input
              value={form.feedUrl}
              onChange={(e) => setForm({ ...form, feedUrl: e.target.value })}
              className="w-full border rounded px-2 py-1"
              placeholder="optionnel — auto-discovery si vide"
            />
          </Field>
          <Field label="URL sitemap">
            <input
              value={form.sitemapUrl}
              onChange={(e) => setForm({ ...form, sitemapUrl: e.target.value })}
              className="w-full border rounded px-2 py-1"
              placeholder="optionnel"
            />
          </Field>
          <Field label="Stratégie">
            <select
              value={form.fetchStrategy}
              onChange={(e) =>
                setForm({ ...form, fetchStrategy: e.target.value as SourceForm["fetchStrategy"] })
              }
              className="w-full border rounded px-2 py-1 bg-white"
            >
              <option value="auto">auto</option>
              <option value="rss">rss</option>
              <option value="sitemap">sitemap</option>
              <option value="html">html</option>
            </select>
          </Field>
          <Field label="Langue par défaut">
            <input
              value={form.defaultLanguage}
              onChange={(e) => setForm({ ...form, defaultLanguage: e.target.value })}
              className="w-full border rounded px-2 py-1"
              placeholder="fr, en, de…"
            />
          </Field>
          <Field label="Limite articles / jour">
            <input
              type="number"
              value={form.perDayLimit}
              onChange={(e) =>
                setForm({ ...form, perDayLimit: Number(e.target.value) })
              }
              className="w-full border rounded px-2 py-1"
            />
          </Field>
          <Field label="Activée">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
          </Field>
          <Field label="Notes" className="md:col-span-2">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border rounded px-2 py-1"
              rows={2}
            />
          </Field>
          <div className="md:col-span-2 flex gap-2 justify-end">
            <button onClick={cancel} className="px-3 py-1.5 rounded border border-slate-300">
              Annuler
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="px-3 py-1.5 rounded bg-brand text-white disabled:opacity-50"
            >
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">Nom</th>
              <th className="text-left px-3 py-2">URL</th>
              <th className="text-left px-3 py-2">Stratégie</th>
              <th className="text-left px-3 py-2">Limite/j</th>
              <th className="text-left px-3 py-2">Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2 text-slate-500">
                  <a href={s.homepageUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {s.homepageUrl}
                  </a>
                </td>
                <td className="px-3 py-2">{s.fetchStrategy}</td>
                <td className="px-3 py-2">{s.perDayLimit}</td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) => toggle(s.id, e.target.checked)}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => startEdit(s)}
                    className="text-brand-accent hover:underline text-xs mr-2"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    className="text-red-600 hover:underline text-xs"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="block text-xs text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
