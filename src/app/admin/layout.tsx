import Link from "next/link";
import { isAdmin } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await isAdmin();
  return (
    <div>
      {admin && (
        <nav className="mb-6 flex gap-2 text-sm flex-wrap">
          {[
            { href: "/admin", label: "Tableau de bord" },
            { href: "/admin/sources", label: "Sources" },
            { href: "/admin/keywords", label: "Mots-clés" },
            { href: "/admin/batches", label: "Batchs" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100"
            >
              {link.label}
            </Link>
          ))}
          <form action="/api/admin/logout" method="post" className="ml-auto">
            <button
              type="submit"
              className="px-3 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100"
            >
              Déconnexion
            </button>
          </form>
        </nav>
      )}
      {children}
    </div>
  );
}
