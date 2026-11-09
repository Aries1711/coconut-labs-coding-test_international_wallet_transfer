import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WalletView } from "@/domain/entities/Wallet";
import WalletActions from "@/components/WalletActions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
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
    id: "usd-savings",
    label: "USD Savings",
    currency: "USD",
    balanceMinor: 100_000,
    balanceFormatted: "$1,000.00",
  },
  {
    id: "jpy-main",
    label: "JPY",
    currency: "JPY",
    balanceMinor: 75_000,
    balanceFormatted: "¥75,000",
  },
];

afterEach(cleanup);

describe("WalletActions wallet pickers", () => {
  it("uses no native <select> anywhere on the Wallets page", () => {
    const { container } = render(<WalletActions wallets={wallets} />);
    expect(container.querySelectorAll("select")).toHaveLength(0);
  });

  it("renders all six pickers as listbox triggers", () => {
    render(<WalletActions wallets={wallets} />);
    // Deposit + Withdraw (1 each) and Transfer + Convert (From/To each).
    const triggers = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-haspopup") === "listbox");
    expect(triggers).toHaveLength(6);
  });

  it("changes the chosen wallet when an option is clicked", async () => {
    const user = userEvent.setup();
    render(<WalletActions wallets={wallets} />);

    const deposit = within(screen.getByRole("heading", { name: "Deposit" }).closest("section")!);
    const picker = deposit.getByRole("button", { name: /wallet/i });
    expect(picker).toHaveTextContent("USD Main — $2,500.00");

    await user.click(picker);
    await user.click(within(deposit.getByRole("listbox")).getByText("JPY — ¥75,000"));

    expect(picker).toHaveTextContent("JPY — ¥75,000");
    // The amount field follows the selected wallet's currency.
    expect(deposit.getByText("Amount (JPY)")).toBeInTheDocument();
  });

  it("keeps each form's picker independent", async () => {
    const user = userEvent.setup();
    render(<WalletActions wallets={wallets} />);

    const deposit = within(screen.getByRole("heading", { name: "Deposit" }).closest("section")!);
    const withdraw = within(screen.getByRole("heading", { name: "Withdraw" }).closest("section")!);

    await user.click(deposit.getByRole("button", { name: /wallet/i }));
    await user.click(within(deposit.getByRole("listbox")).getByText("JPY — ¥75,000"));

    expect(deposit.getByRole("button", { name: /wallet/i })).toHaveTextContent("JPY");
    expect(withdraw.getByRole("button", { name: /wallet/i })).toHaveTextContent("USD Main");
  });
});
