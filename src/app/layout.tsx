import type { Metadata } from "next";
import NavLinks from "@/components/NavLinks";
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
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <span className="font-semibold">Multi-Currency Wallet</span>
            <span className="hidden text-xs text-slate-400 sm:inline">
              simulated funds &middot; no auth
            </span>
          </div>
        </header>
        <nav className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl overflow-x-auto px-4 sm:px-6">
            <NavLinks />
          </div>
        </nav>
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
