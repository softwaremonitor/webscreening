import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KeywordsTable } from "@/components/admin/KeywordsTable";

export default async function KeywordsPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const items = await prisma.keyword.findMany({ orderBy: { text: "asc" } });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-brand">Mots-clés</h1>
      <p className="text-xs text-slate-500">
        Mettez l'expression entre guillemets <code>"…"</code> pour exiger une correspondance exacte
        de la phrase complète. Sinon le matching se fait en sous-chaîne insensible à la casse.
      </p>
      <KeywordsTable initialItems={items} />
    </div>
  );
}
