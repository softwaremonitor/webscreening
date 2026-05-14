"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Mot de passe incorrect");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="max-w-sm mx-auto bg-white border border-slate-200 rounded-md p-6 mt-12">
      <h1 className="text-lg font-semibold mb-4 text-brand">Accès admin</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="password"
          autoFocus
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-slate-300 rounded px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand text-white rounded px-3 py-2 disabled:opacity-50"
        >
          Se connecter
        </button>
      </form>
    </div>
  );
}
