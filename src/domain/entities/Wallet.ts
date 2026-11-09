import type { Currency } from "./Currency";

/** A named container holding exactly one currency. It has no stored balance. */
export type Wallet = {
  id: string;
  label: string;
  currency: Currency;
};

/** A wallet plus the balance derived from the ledger, for read paths. */
export type WalletView = Wallet & {
  balanceMinor: number;
  balanceFormatted: string;
};
