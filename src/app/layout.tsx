import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Multi-Currency Wallet",
  description: "Simulated multi-currency digital wallet",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
            <span className="font-semibold">Multi-Currency Wallet</span>
            <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
              Wallets
            </Link>
            <Link
              href="/transactions"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Transactions
            </Link>
            <span className="ml-auto text-xs text-slate-400">
              simulated funds &middot; no auth
            </span>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
