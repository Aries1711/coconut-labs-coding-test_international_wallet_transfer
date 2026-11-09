"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { WalletView } from "@/domain/entities/Wallet";
import Listbox from "./Listbox";

type Props = {
  wallets: WalletView[];
  /** The wallet id currently in the URL, or "" for all wallets. */
  selected: string;
};

/**
 * Applies on selection rather than behind an Apply button, and keeps the URL as
 * the source of truth so a filtered history stays shareable and reloadable.
 */
export default function WalletFilter({ wallets, selected }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const options = [
    { value: "", label: "All wallets" },
    ...wallets.map((wallet) => ({
      value: wallet.id,
      label: `${wallet.label} (${wallet.currency})`,
    })),
  ];

  return (
    <div className="w-56">
      <Listbox
        label="Filter by wallet"
        options={options}
        value={selected}
        disabled={pending}
        busyLabel="Filtering…"
        onChange={(walletId) => {
          const href = walletId
            ? `/transactions?walletId=${encodeURIComponent(walletId)}`
            : "/transactions";
          startTransition(() => router.push(href));
        }}
      />
    </div>
  );
}
