import { isCurrency, type Currency } from "../currencies";
import { AppError } from "../errors";
import { convertMinor, formatMinor, parseAmountToMinor } from "../money";
import { getRate } from "../rates";
import { memoryWalletRepository } from "../repo/memory";
import type { WalletRepository } from "../repo/WalletRepository";
import type { Transaction, Wallet, WalletView } from "../types";

/**
 * All wallet business rules live here. Route handlers only validate shapes and
 * map errors; the UI never computes money.
 */
const repo: WalletRepository = memoryWalletRepository;

/** Signed effect of one ledger entry on one wallet. */
function deltaFor(tx: Transaction, walletId: string): number {
  let delta = 0;
  if (tx.fromWalletId === walletId) delta -= tx.amountMinor;
  if (tx.toWalletId === walletId) {
    delta += tx.type === "CONVERSION" ? (tx.targetAmountMinor ?? 0) : tx.amountMinor;
  }
  return delta;
}

/** Balances are derived from the append-only ledger, never stored. */
export function balancesMinor(): Map<string, number> {
  const balances = new Map<string, number>(
    repo.listWallets().map((wallet) => [wallet.id, 0]),
  );
  for (const tx of repo.listTransactions()) {
    for (const walletId of [tx.fromWalletId, tx.toWalletId]) {
      if (!walletId || !balances.has(walletId)) continue;
      balances.set(walletId, balances.get(walletId)! + deltaFor(tx, walletId));
    }
  }
  return balances;
}

export function balanceMinor(walletId: string): number {
  return repo
    .listTransactions(walletId)
    .reduce((total, tx) => total + deltaFor(tx, walletId), 0);
}

function toView(wallet: Wallet, balanceMinorValue: number): WalletView {
  return {
    ...wallet,
    balanceMinor: balanceMinorValue,
    balanceFormatted: formatMinor(balanceMinorValue, wallet.currency),
  };
}

export function listWallets(): WalletView[] {
  const balances = balancesMinor();
  return repo
    .listWallets()
    .map((wallet) => toView(wallet, balances.get(wallet.id) ?? 0));
}

function requireWallet(id: string): Wallet {
  const wallet = repo.getWallet(id);
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

export function getWallet(id: string): WalletView {
  const wallet = requireWallet(id);
  return toView(wallet, balanceMinor(id));
}

function assertSufficientFunds(wallet: Wallet, amountMinor: number): void {
  const available = balanceMinor(wallet.id);
  if (available < amountMinor) {
    throw new AppError(
      "INSUFFICIENT_FUNDS",
      422,
      `${wallet.label} holds ${formatMinor(available, wallet.currency)}, which is less than ${formatMinor(amountMinor, wallet.currency)}.`,
    );
  }
}

export function deposit(walletId: string, amount: string): Transaction {
  const wallet = requireWallet(walletId);
  const amountMinor = parseAmountToMinor(amount, wallet.currency);
  return repo.append({
    type: "DEPOSIT",
    toWalletId: wallet.id,
    amountMinor,
    currency: wallet.currency,
  });
}

export function withdraw(walletId: string, amount: string): Transaction {
  const wallet = requireWallet(walletId);
  const amountMinor = parseAmountToMinor(amount, wallet.currency);
  assertSufficientFunds(wallet, amountMinor);
  return repo.append({
    type: "WITHDRAWAL",
    fromWalletId: wallet.id,
    amountMinor,
    currency: wallet.currency,
  });
}

/** Same-currency move, 1:1. Both legs are one ledger entry, so it is atomic. */
export function transfer(
  fromWalletId: string,
  toWalletId: string,
  amount: string,
): Transaction {
  const [source, target] = requireDistinctWallets(fromWalletId, toWalletId);
  if (source.currency !== target.currency) {
    throw new AppError(
      "CURRENCY_MISMATCH",
      422,
      `A transfer requires both wallets to hold the same currency (${source.currency} vs ${target.currency}). Use a conversion instead.`,
    );
  }
  const amountMinor = parseAmountToMinor(amount, source.currency);
  assertSufficientFunds(source, amountMinor);
  return repo.append({
    type: "TRANSFER",
    fromWalletId: source.id,
    toWalletId: target.id,
    amountMinor,
    currency: source.currency,
  });
}

/** Cross-currency move at the live mid-market rate. Also one ledger entry. */
export async function convert(
  fromWalletId: string,
  toWalletId: string,
  amount: string,
): Promise<Transaction> {
  const [source, target] = requireDistinctWallets(fromWalletId, toWalletId);
  if (source.currency === target.currency) {
    throw new AppError(
      "CURRENCY_MATCH_FOR_CONVERSION",
      422,
      `Both wallets hold ${source.currency}. Use a transfer instead.`,
    );
  }
  const amountMinor = parseAmountToMinor(amount, source.currency);
  assertSufficientFunds(source, amountMinor);

  // Fetched before the append: a rate failure throws and nothing is recorded.
  const rate = await getRate(source.currency, target.currency);
  const targetAmountMinor = convertMinor(
    amountMinor,
    rate.rate,
    source.currency,
    target.currency,
  );
  if (targetAmountMinor <= 0) {
    throw new AppError(
      "ROUNDS_TO_ZERO",
      422,
      `${formatMinor(amountMinor, source.currency)} converts to less than the smallest ${target.currency} unit at the current rate.`,
    );
  }

  return repo.append({
    type: "CONVERSION",
    fromWalletId: source.id,
    toWalletId: target.id,
    amountMinor,
    currency: source.currency,
    targetAmountMinor,
    targetCurrency: target.currency,
    rate: rate.rate,
    rateDate: rate.date,
  });
}

function requireDistinctWallets(
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
  return [requireWallet(fromWalletId), requireWallet(toWalletId)];
}

export function listTransactions(walletId?: string): Transaction[] {
  if (walletId) requireWallet(walletId);
  return repo.listTransactions(walletId);
}

export function getTransaction(id: string): Transaction {
  const transaction = repo.getTransaction(id);
  if (!transaction) {
    throw new AppError("TRANSACTION_NOT_FOUND", 404, `No transaction with id "${id}".`);
  }
  return transaction;
}

export function walletLabels(): Map<string, { label: string; currency: Currency }> {
  return new Map(
    repo.listWallets().map((wallet) => [
      wallet.id,
      { label: wallet.label, currency: wallet.currency },
    ]),
  );
}
