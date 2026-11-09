"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { WalletView } from "@/domain/entities/Wallet";
import Listbox from "./Listbox";

type Props = { wallets: WalletView[] };

type ApiError = { error?: { code?: string; message?: string } };

/** Posts to the API, keeps one request in flight, and refreshes server data. */
function useAction(endpoint: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = useCallback(
    async (body: Record<string, string>, successMessage: string) => {
      setPending(true);
      setError(null);
      setSuccess(null);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const payload: ApiError = await response.json().catch(() => ({}));
          setError(payload.error?.message ?? `Request failed (${response.status}).`);
          return false;
        }
        setSuccess(successMessage);
        router.refresh();
        return true;
      } catch {
        setError("Network error. Please try again.");
        return false;
      } finally {
        setPending(false);
      }
    },
    [endpoint, router],
  );

  return { submit, pending, error, success };
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Feedback({ error, success }: { error: string | null; success: string | null }) {
  if (error) return <p className="mt-2 text-sm text-red-600">{error}</p>;
  if (success) return <p className="mt-2 text-sm text-green-700">{success}</p>;
  return null;
}

const inputClass =
  "w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
const buttonClass =
  "rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400";

/**
 * Wallet picker. Uses the shared Listbox rather than a native <select> so the
 * open panel is anchored to its trigger and uses the app's type scale on every
 * viewport -- see the comment in Listbox.tsx.
 */
function WalletSelect({
  label,
  wallets,
  value,
  onChange,
  disabled,
}: {
  label: string;
  wallets: WalletView[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Listbox
      label={label}
      value={value}
      onChange={onChange}
      disabled={disabled}
      options={wallets.map((wallet) => ({
        value: wallet.id,
        label: `${wallet.label} — ${wallet.balanceFormatted}`,
      }))}
    />
  );
}

function AmountInput({
  value,
  onChange,
  currency,
}: {
  value: string;
  onChange: (value: string) => void;
  currency?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">
        Amount{currency ? ` (${currency})` : ""}
      </span>
      <input
        className={inputClass}
        value={value}
        inputMode="decimal"
        placeholder="0.00"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SingleWalletForm({
  title,
  endpoint,
  action,
  wallets,
}: Props & { title: string; endpoint: string; action: string }) {
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const { submit, pending, error, success } = useAction(endpoint);
  const currency = wallets.find((wallet) => wallet.id === walletId)?.currency;

  return (
    <Card title={title}>
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          const ok = await submit({ walletId, amount }, `${action} recorded.`);
          if (ok) setAmount("");
        }}
      >
        <WalletSelect
          label="Wallet"
          wallets={wallets}
          value={walletId}
          onChange={setWalletId}
          disabled={pending}
        />
        <AmountInput value={amount} onChange={setAmount} currency={currency} />
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending ? "Working…" : action}
        </button>
        <Feedback error={error} success={success} />
      </form>
    </Card>
  );
}

function TwoWalletForm({
  title,
  endpoint,
  action,
  wallets,
  hint,
  showRate,
}: Props & {
  title: string;
  endpoint: string;
  action: string;
  hint: string;
  showRate?: boolean;
}) {
  const [fromWalletId, setFromWalletId] = useState(wallets[0]?.id ?? "");
  const [toWalletId, setToWalletId] = useState(wallets[1]?.id ?? "");
  const [amount, setAmount] = useState("");
  const { submit, pending, error, success } = useAction(endpoint);

  const from = wallets.find((wallet) => wallet.id === fromWalletId);
  const to = wallets.find((wallet) => wallet.id === toWalletId);
  // Keyed by the pair so a stale response for a previous pair is ignored and
  // the effect only ever sets state from its own async callback.
  const pairKey = from && to ? `${from.currency}:${to.currency}` : "";
  const crossCurrency = Boolean(from && to && from.currency !== to.currency);
  const [preview, setPreview] = useState<
    { key: string; text?: string; error?: string } | null
  >(null);

  useEffect(() => {
    if (!showRate || !crossCurrency || !from || !to) return;
    const controller = new AbortController();
    const key = `${from.currency}:${to.currency}`;
    fetch(`/api/rates?from=${from.currency}&to=${to.currency}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error?.message ?? "Rate unavailable.");
        setPreview({
          key,
          text: `1 ${from.currency} = ${payload.rate} ${to.currency} (as of ${payload.date})`,
        });
      })
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") setPreview({ key, error: cause.message });
      });
    return () => controller.abort();
  }, [showRate, crossCurrency, from, to]);

  const shownPreview = preview?.key === pairKey && crossCurrency ? preview : null;

  return (
    <Card title={title}>
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          const ok = await submit(
            { fromWalletId, toWalletId, amount },
            `${action} recorded.`,
          );
          if (ok) setAmount("");
        }}
      >
        <WalletSelect
          label="From"
          wallets={wallets}
          value={fromWalletId}
          onChange={setFromWalletId}
          disabled={pending}
        />
        <WalletSelect
          label="To"
          wallets={wallets}
          value={toWalletId}
          onChange={setToWalletId}
          disabled={pending}
        />
        <AmountInput value={amount} onChange={setAmount} currency={from?.currency} />
        <p className="text-xs text-slate-500">{hint}</p>
        {showRate && shownPreview && (
          <p
            className={`text-xs ${shownPreview.error ? "text-red-600" : "text-slate-700"}`}
          >
            {shownPreview.error ?? shownPreview.text}
          </p>
        )}
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending ? "Working…" : action}
        </button>
        <Feedback error={error} success={success} />
      </form>
    </Card>
  );
}

export default function WalletActions({ wallets }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SingleWalletForm
        title="Deposit"
        endpoint="/api/deposits"
        action="Deposit"
        wallets={wallets}
      />
      <SingleWalletForm
        title="Withdraw"
        endpoint="/api/withdrawals"
        action="Withdraw"
        wallets={wallets}
      />
      <TwoWalletForm
        title="Transfer"
        endpoint="/api/transfers"
        action="Transfer"
        wallets={wallets}
        hint="Both wallets must hold the same currency (1:1)."
      />
      <TwoWalletForm
        title="Convert"
        endpoint="/api/conversions"
        action="Convert"
        wallets={wallets}
        hint="Wallets must hold different currencies; converted at the live mid-market rate."
        showRate
      />
    </div>
  );
}
