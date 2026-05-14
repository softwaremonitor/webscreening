import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Packaging News",
  description:
    "Veille quotidienne sur le packaging, l'emballage, le recyclage, la réglementation et les fournisseurs du secteur.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-brand text-white font-bold">
                PN
              </span>
              <span className="text-lg font-semibold text-brand">
                Packaging News
              </span>
            </Link>
            <nav className="text-sm text-slate-600">
              <Link href="/admin" className="hover:text-brand">
                Admin
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
        <footer className="max-w-6xl mx-auto px-6 py-8 text-xs text-slate-400">
          Sources externes — les articles renvoient toujours vers l'éditeur d'origine.
        </footer>
      </body>
    </html>
  );
}
