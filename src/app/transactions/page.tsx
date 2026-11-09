import Link from "next/link";
import { formatMinor } from "@/lib/money";
import { listTransactions, listWallets } from "@/lib/service/wallet";
import type { Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";

function describe(
  tx: Transaction,
  labels: Map<string, string>,
): { movement: string; amount: string } {
  const from = tx.fromWalletId ? (labels.get(tx.fromWalletId) ?? tx.fromWalletId) : null;
  const to = tx.toWalletId ? (labels.get(tx.toWalletId) ?? tx.toWalletId) : null;

  if (tx.type === "CONVERSION" && tx.targetCurrency && tx.targetAmountMinor != null) {
    return {
      movement: `${from} → ${to}`,
      amount: `${formatMinor(tx.amountMinor, tx.currency)} → ${formatMinor(tx.targetAmountMinor, tx.targetCurrency)}`,
    };
  }
  return {
    movement: tx.type === "DEPOSIT" ? `→ ${to}` : tx.type === "WITHDRAWAL" ? `${from} →` : `${from} → ${to}`,
    amount: formatMinor(tx.amountMinor, tx.currency),
  };
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ walletId?: string }>;
}) {
  const { walletId } = await searchParams;
  const wallets = listWallets();
  const labels = new Map(wallets.map((wallet) => [wallet.id, wallet.label]));
  const known = walletId && labels.has(walletId) ? walletId : undefined;
  const transactions = listTransactions(known);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold">Transaction history</h1>
        <form className="flex items-end gap-2" method="get">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Filter by wallet</span>
            <select
              name="walletId"
              defaultValue={known ?? ""}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All wallets</option>
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Apply
          </button>
        </form>
      </div>

      {walletId && !known && (
        <p className="text-sm text-red-600">Unknown wallet — showing all transactions.</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Movement</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No transactions yet.
                </td>
              </tr>
            )}
            {transactions.map((tx) => {
              const { movement, amount } = describe(tx, labels);
              return (
                <tr key={tx.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {new Date(tx.createdAt).toLocaleString("en-GB", { timeZone: "UTC" })}
                  </td>
                  <td className="px-4 py-3 font-medium">{tx.type}</td>
                  <td className="whitespace-nowrap px-4 py-3">{movement}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{amount}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {tx.rate ? `${tx.rate} (${tx.rateDate})` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/transactions/${tx.id}`}
                      className="text-slate-600 underline hover:text-slate-900"
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
