import { balanceOf, type Transaction } from "@/domain/entities/Transaction";
import { formatMinor } from "@/domain/entities/Money";
import type { Wallet, WalletView } from "@/domain/entities/Wallet";
import { isCurrency } from "@/domain/entities/Currency";
import { AppError } from "@/domain/errors";
import type { WalletRepository } from "@/domain/repositories/WalletRepository";

/** Dependencies every wallet use case needs. */
export type WalletDeps = { wallets: WalletRepository };

/** Resolves a wallet or throws the 404 the API contract promises. */
export function requireWallet(wallets: WalletRepository, id: string): Wallet {
  const wallet = wallets.getWallet(id);
  if (!wallet) {
    throw new AppError("WALLET_NOT_FOUND", 404, `No wallet with id "${id}".`);
  }
  if (!isCurrency(wallet.currency)) {
    throw new AppError(
      "UNSUPPORTED_CURRENCY",
      422,
      `Wallet "${id}" holds an unsupported currency.`,
    );
  }
  return wallet;
}

export function requireDistinctWallets(
  wallets: WalletRepository,
  fromWalletId: string,
  toWalletId: string,
): [Wallet, Wallet] {
  if (fromWalletId === toWalletId) {
    throw new AppError(
      "SAME_WALLET",
      422,
      "The source and target wallet must be different.",
    );
  }
  return [requireWallet(wallets, fromWalletId), requireWallet(wallets, toWalletId)];
}

/** Current balance for one wallet, folded from its ledger entries. */
export function balanceMinorOf(wallets: WalletRepository, walletId: string): number {
  return balanceOf(wallets.listTransactions(walletId), walletId);
}

/** No overdraft: the balance is re-read from the ledger at the point of use. */
export function assertSufficientFunds(
  wallets: WalletRepository,
  wallet: Wallet,
  amountMinor: number,
): void {
  const available = balanceMinorOf(wallets, wallet.id);
  if (available < amountMinor) {
    throw new AppError(
      "INSUFFICIENT_FUNDS",
      422,
      `${wallet.label} holds ${formatMinor(available, wallet.currency)}, which is less than ${formatMinor(amountMinor, wallet.currency)}.`,
    );
  }
}

export function toWalletView(wallet: Wallet, balanceMinor: number): WalletView {
  return {
    ...wallet,
    balanceMinor,
    balanceFormatted: formatMinor(balanceMinor, wallet.currency),
  };
}

export type { Transaction };
