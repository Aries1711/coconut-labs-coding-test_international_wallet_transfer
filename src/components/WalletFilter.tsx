"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { WalletView } from "@/lib/types";

type Props = {
  wallets: WalletView[];
  /** The wallet id currently in the URL, or "" for all wallets. */
  selected: string;
};

/**
 * Applies on change rather than behind an Apply button, and keeps the URL as
 * the source of truth so a filtered history stays shareable and reloadable.
 */
export default function WalletFilter({ wallets, selected }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-end gap-2">
      <label className="text-sm">
        <span className="mb-1 block text-slate-600">Filter by wallet</span>
        <select
          name="walletId"
          value={selected}
          disabled={pending}
          aria-busy={pending}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
          onChange={(event) => {
            const walletId = event.target.value;
            const href = walletId
              ? `/transactions?walletId=${encodeURIComponent(walletId)}`
              : "/transactions";
            startTransition(() => router.push(href));
          }}
        >
          <option value="">All wallets</option>
          {wallets.map((wallet) => (
            <option key={wallet.id} value={wallet.id}>
              {wallet.label} ({wallet.currency})
            </option>
          ))}
        </select>
      </label>
      <span className="pb-2 text-xs text-slate-400">{pending ? "Filtering…" : ""}</span>
    </div>
  );
}
