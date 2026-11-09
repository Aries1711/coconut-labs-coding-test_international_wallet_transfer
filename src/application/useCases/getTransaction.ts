import type { Transaction } from "@/domain/entities/Transaction";
import { AppError } from "@/domain/errors";
import type { WalletDeps } from "./shared";

export function makeGetTransaction({ wallets }: WalletDeps) {
  return async function getTransaction(id: string): Promise<Transaction> {
    const transaction = await wallets.getTransaction(id);
    if (!transaction) {
      throw new AppError("TRANSACTION_NOT_FOUND", 404, `No transaction with id "${id}".`);
    }
    return transaction;
  };
}
