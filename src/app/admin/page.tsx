import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RunBatchButton } from "@/components/admin/RunBatchButton";

export default async function AdminHome() {
  if (!(await isAdmin())) redirect("/admin/login");
  const [sources, keywords, articles, lastBatch] = await Promise.all([
    prisma.source.count(),
    prisma.keyword.count(),
    prisma.article.count(),
    prisma.batchRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-brand">Tableau de bord</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card label="Sources" value={sources} />
        <Card label="Mots-clés" value={keywords} />
        <Card label="Articles" value={articles} />
        <Card
          label="Dernier batch"
          value={lastBatch ? lastBatch.status : "—"}
          hint={lastBatch ? new Date(lastBatch.startedAt).toLocaleString("fr-FR") : ""}
        />
      </div>
      <div className="bg-white border border-slate-200 rounded-md p-4 flex flex-wrap gap-3 items-center">
        <RunBatchButton mode="manual" label="Lancer un batch manuel" />
        <RunBatchButton mode="backfill" label="Backfill 30 jours" />
        <Link href="/admin/batches" className="text-sm text-brand-accent hover:underline">
          Voir l'historique →
        </Link>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-md p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="text-[10px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}
