import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function fmt(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR");
}

function dur(ms: number | null) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${s % 60} s`;
}

const STATUS_COLORS: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  partial: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  running: "bg-sky-100 text-sky-800",
};

export default async function BatchesPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const items = await prisma.batchRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
    include: {
      errors: { include: { source: { select: { id: true, name: true } } } },
    },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-brand">Historique des batchs</h1>
      <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">Début</th>
              <th className="text-left px-3 py-2">Fin</th>
              <th className="text-left px-3 py-2">Durée</th>
              <th className="text-left px-3 py-2">Mode</th>
              <th className="text-left px-3 py-2">Statut</th>
              <th className="text-left px-3 py-2">Sources</th>
              <th className="text-left px-3 py-2">Articles trouvés</th>
              <th className="text-left px-3 py-2">Articles ajoutés</th>
              <th className="text-left px-3 py-2">Erreurs</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                  Aucun batch encore exécuté.
                </td>
              </tr>
            )}
            {items.map((b) => (
              <tr key={b.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2 whitespace-nowrap">{fmt(b.startedAt)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmt(b.finishedAt)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{dur(b.durationMs)}</td>
                <td className="px-3 py-2">{b.mode}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs ${
                      STATUS_COLORS[b.status] ?? "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {b.status}
                  </span>
                </td>
                <td className="px-3 py-2">{b.sourcesAnalyzed}</td>
                <td className="px-3 py-2">{b.articlesFound}</td>
                <td className="px-3 py-2">{b.articlesAdded}</td>
                <td className="px-3 py-2 text-xs">
                  {b.errors.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <details>
                      <summary className="cursor-pointer text-red-700">
                        {b.errors.length} en erreur
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {b.errors.map((e) => (
                          <li key={e.id} className="text-slate-600">
                            <span className="font-semibold">{e.source.name}:</span>{" "}
                            <span className="text-slate-500">{e.message}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
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
