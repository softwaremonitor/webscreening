"use client";

import { useState } from "react";
import type { Keyword } from "@prisma/client";

export function KeywordsTable({ initialItems }: { initialItems: Keyword[] }) {
  const [items, setItems] = useState<Keyword[]>(initialItems);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    const res = await fetch("/api/admin/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() }),
    });
    setBusy(false);
    const data = await res.json();
    if (res.ok) {
      setItems([...items, data.item].sort((a, b) => a.text.localeCompare(b.text)));
      setText("");
    } else {
      alert(data.error ?? "Erreur");
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce mot-clé ?")) return;
    const res = await fetch(`/api/admin/keywords/${id}`, { method: "DELETE" });
    if (res.ok) setItems(items.filter((k) => k.id !== id));
  }

  async function toggle(id: string, enabled: boolean) {
    const res = await fetch(`/api/admin/keywords/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) setItems(items.map((k) => (k.id === id ? { ...k, enabled } : k)));
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/admin/keywords/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editText.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setItems(items.map((k) => (k.id === id ? data.item : k)));
      setEditingId(null);
    } else alert(data.error ?? "Erreur");
  }

  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-md p-3 flex gap-2 items-center">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Ex. Amcor ou "Bottle Collective"`}
          className="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm"
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button
          onClick={add}
          disabled={busy}
          className="bg-brand text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Ajouter
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">Texte</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Activé</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((k) => (
              <tr key={k.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">
                  {editingId === k.id ? (
                    <input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="border rounded px-2 py-1 w-full"
                      autoFocus
                    />
                  ) : (
                    k.text
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {k.isPhrase ? "phrase exacte" : "mot-clé"}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={k.enabled}
                    onChange={(e) => toggle(k.id, e.target.checked)}
                  />
                </td>
                <td className="px-3 py-2 text-right space-x-2">
                  {editingId === k.id ? (
                    <>
                      <button
                        onClick={() => saveEdit(k.id)}
                        className="text-brand-accent hover:underline text-xs"
                      >
                        Sauver
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-slate-500 hover:underline text-xs"
                      >
                        Annuler
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(k.id);
                          setEditText(k.text);
                        }}
                        className="text-brand-accent hover:underline text-xs"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => remove(k.id)}
                        className="text-red-600 hover:underline text-xs"
                      >
                        Supprimer
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
