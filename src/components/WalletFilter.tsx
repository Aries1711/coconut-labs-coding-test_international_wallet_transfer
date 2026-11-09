"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import type { WalletView } from "@/lib/types";

type Props = {
  wallets: WalletView[];
  /** The wallet id currently in the URL, or "" for all wallets. */
  selected: string;
};

type Option = { value: string; label: string };

/**
 * A hand-built listbox instead of a native <select>. The native control's
 * open panel is positioned and sized by the OS/browser, not by our CSS, which
 * is exactly what produced a dropdown anchored away from its trigger on
 * desktop and tiny OS-scaled text on mobile. This version applies on
 * selection, keeps the URL as the source of truth, and is fully ours to
 * position and size.
 */
export default function WalletFilter({ wallets, selected }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  const options: Option[] = [
    { value: "", label: "All wallets" },
    ...wallets.map((wallet) => ({
      value: wallet.id,
      label: `${wallet.label} (${wallet.currency})`,
    })),
  ];
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selected),
  );
  const current = options[selectedIndex] ?? options[0];

  // Close on an outside click/tap (pointerdown covers touch as well as mouse).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keyboard navigation starts from whichever option is currently selected;
  // set alongside `open` wherever it is opened, rather than in an effect.
  function openList() {
    setHighlighted(selectedIndex);
    setOpen(true);
  }

  function apply(walletId: string) {
    setOpen(false);
    const href = walletId
      ? `/transactions?walletId=${encodeURIComponent(walletId)}`
      : "/transactions";
    startTransition(() => router.push(href));
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((index) => Math.min(options.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      apply(options[highlighted].value);
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative text-sm"
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <span id={labelId} className="mb-1 block text-slate-600">
        Filter by wallet
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        disabled={pending}
        aria-busy={pending}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className="flex w-56 items-center justify-between gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 disabled:opacity-60"
      >
        <span className="truncate">{pending ? "Filtering…" : current.label}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4 flex-none text-slate-400"
        >
          <path
            d="M5 7.5 10 12.5 15 7.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-labelledby={labelId}
          className="absolute left-0 z-20 mt-1 max-h-64 w-56 overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {options.map((option, index) => {
            const isSelected = option.value === selected;
            const isHighlighted = index === highlighted;
            return (
              <li
                key={option.value || "all"}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => apply(option.value)}
                className={`cursor-pointer px-3 py-2.5 ${
                  isHighlighted ? "bg-slate-100" : ""
                } ${isSelected ? "font-medium text-slate-900" : "text-slate-700"}`}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
