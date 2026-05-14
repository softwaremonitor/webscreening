import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SourcesTable } from "@/components/admin/SourcesTable";

export default async function SourcesPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const items = await prisma.source.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-brand">Sources</h1>
      <SourcesTable initialItems={items} />
    </div>
  );
}
