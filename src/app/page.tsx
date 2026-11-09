import WalletActions from "@/components/WalletActions";
import { listWallets } from "@/lib/service/wallet";

/** Balances are derived per request from the ledger, so never cache this page. */
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const wallets = listWallets();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-xl font-semibold">Balances</h1>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {wallets.map((wallet) => (
            <div
              key={wallet.id}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <p className="text-sm text-slate-500">{wallet.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {wallet.balanceFormatted}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {wallet.currency} · {wallet.balanceMinor} minor units
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h1 className="mb-4 text-xl font-semibold">Actions</h1>
        <WalletActions wallets={wallets} />
      </section>
    </div>
  );
}
