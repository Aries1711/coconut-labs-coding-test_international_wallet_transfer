"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type ListboxOption = { value: string; label: string };

type Props = {
  label: string;
  options: ListboxOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Replaces the trigger's text while an action is in flight. */
  busyLabel?: string;
};

/**
 * The app's only dropdown. A native <select> is deliberately not used: its open
 * panel is positioned and font-scaled by the OS/browser rather than by page
 * CSS, which produced panels anchored away from their trigger and unreadable
 * text on mobile. Everything here is ours to position and size, and it behaves
 * identically on every viewport.
 *
 * Fills its container, so the caller controls width.
 */
export default function Listbox({
  label,
  options,
  value,
  onChange,
  disabled = false,
  busyLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
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

  // Keyboard navigation starts from the current selection; set alongside
  // `open` wherever it is opened, rather than in an effect.
  function openList() {
    setHighlighted(selectedIndex);
    setOpen(true);
  }

  function select(optionValue: string) {
    setOpen(false);
    onChange(optionValue);
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
      select(options[highlighted].value);
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
        {label}
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        disabled={disabled}
        aria-busy={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 focus:border-slate-500 focus:outline-none disabled:opacity-60"
      >
        <span className="truncate">
          {disabled && busyLabel ? busyLabel : (current?.label ?? "")}
        </span>
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
          // An <li> is not focusable, so pressing the mouse on one would blur
          // the trigger, and the onBlur guard above would unmount this list
          // before the option's click could fire -- the selection was silently
          // dropped. Suppressing mousedown's default keeps focus on the
          // trigger, so no blur happens and the click lands.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isHighlighted = index === highlighted;
            return (
              <li
                key={option.value || "__all__"}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => select(option.value)}
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
