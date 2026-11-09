import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMinor } from "@/domain/entities/Money";
import type { Transaction } from "@/domain/entities/Transaction";
import { AppError } from "@/domain/errors";
import { getTransaction, listWallets } from "@/infrastructure/container";

export const dynamic = "force-dynamic";

function rows(tx: Transaction, labels: Map<string, string>) {
  const entries: Array<[string, string]> = [
    ["Transaction ID", tx.id],
    ["Type", tx.type],
    ["Created at", tx.createdAt],
    ["Amount", `${formatMinor(tx.amountMinor, tx.currency)} (${tx.amountMinor} minor units)`],
    ["Currency", tx.currency],
  ];
  if (tx.fromWalletId) {
    entries.push(["From wallet", `${labels.get(tx.fromWalletId) ?? "unknown"} (${tx.fromWalletId})`]);
  }
  if (tx.toWalletId) {
    entries.push(["To wallet", `${labels.get(tx.toWalletId) ?? "unknown"} (${tx.toWalletId})`]);
  }
  if (tx.targetAmountMinor != null && tx.targetCurrency) {
    entries.push([
      "Target amount",
      `${formatMinor(tx.targetAmountMinor, tx.targetCurrency)} (${tx.targetAmountMinor} minor units)`,
    ]);
    entries.push(["Target currency", tx.targetCurrency]);
  }
  if (tx.rate) entries.push(["Rate", tx.rate]);
  if (tx.rateDate) entries.push(["Rate date", tx.rateDate]);
  return entries;
}

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let transaction: Transaction;
  try {
    transaction = await getTransaction(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "TRANSACTION_NOT_FOUND") notFound();
    throw error;
  }

  const labels = new Map<string, string>(
    (await listWallets()).map((wallet) => [wallet.id, wallet.label]),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/transactions" className="text-sm text-slate-600 underline">
          ← Back to history
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Transaction detail</h1>
      </div>
      <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {rows(transaction, labels).map(([label, value]) => (
          <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-3">
            <dt className="text-sm text-slate-500">{label}</dt>
            <dd className="font-mono text-sm sm:col-span-2 break-all">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
