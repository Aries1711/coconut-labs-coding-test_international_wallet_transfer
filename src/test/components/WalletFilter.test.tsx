import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WalletView } from "@/domain/entities/Wallet";
import WalletFilter from "@/components/WalletFilter";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const wallets: WalletView[] = [
  {
    id: "usd-main",
    label: "USD Main",
    currency: "USD",
    balanceMinor: 250_000,
    balanceFormatted: "$2,500.00",
  },
  {
    id: "jpy-main",
    label: "JPY",
    currency: "JPY",
    balanceMinor: 75_000,
    balanceFormatted: "¥75,000",
  },
];

afterEach(() => {
  cleanup();
  push.mockReset();
});

function openList() {
  return screen.getByRole("button", { name: /filter by wallet/i });
}

describe("WalletFilter", () => {
  it("opens the list when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<WalletFilter wallets={wallets} selected="" />);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.click(openList());

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3); // All wallets + 2
  });

  // The regression this issue is about: pressing the mouse on a non-focusable
  // <li> blurred the trigger and unmounted the list before the click landed.
  it("applies the selection when an option is clicked", async () => {
    const user = userEvent.setup();
    render(<WalletFilter wallets={wallets} selected="" />);

    await user.click(openList());
    await user.click(within(screen.getByRole("listbox")).getByText("JPY (JPY)"));

    expect(push).toHaveBeenCalledWith("/transactions?walletId=jpy-main");
  });

  it("returns to the unfiltered view when 'All wallets' is clicked", async () => {
    const user = userEvent.setup();
    render(<WalletFilter wallets={wallets} selected="jpy-main" />);

    await user.click(openList());
    await user.click(within(screen.getByRole("listbox")).getByText("All wallets"));

    expect(push).toHaveBeenCalledWith("/transactions");
  });

  it("selects with the keyboard: arrow down then Enter", async () => {
    const user = userEvent.setup();
    render(<WalletFilter wallets={wallets} selected="" />);

    openList().focus();
    await user.keyboard("{ArrowDown}"); // opens, highlighting the current option
    await user.keyboard("{ArrowDown}"); // -> "USD Main (USD)"
    await user.keyboard("{Enter}");

    expect(push).toHaveBeenCalledWith("/transactions?walletId=usd-main");
  });

  it("closes on Escape without selecting", async () => {
    const user = userEvent.setup();
    render(<WalletFilter wallets={wallets} selected="" />);

    await user.click(openList());
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("closes on an outside click without selecting", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <WalletFilter wallets={wallets} selected="" />
        <button type="button">outside</button>
      </div>,
    );

    await user.click(openList());
    await user.click(screen.getByRole("button", { name: "outside" }));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the currently selected wallet on the trigger", () => {
    render(<WalletFilter wallets={wallets} selected="jpy-main" />);
    expect(openList()).toHaveTextContent("JPY (JPY)");
  });
});
