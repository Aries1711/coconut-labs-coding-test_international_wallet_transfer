import { makeConvertCurrency } from "@/application/useCases/convertCurrency";
import { makeDepositFunds } from "@/application/useCases/depositFunds";
import { makeGetExchangeRate } from "@/application/useCases/getExchangeRate";
import { makeGetTransaction } from "@/application/useCases/getTransaction";
import { makeGetBalanceMinor, makeGetWallet } from "@/application/useCases/getWallet";
import { makeListTransactions } from "@/application/useCases/listTransactions";
import { makeListWallets } from "@/application/useCases/listWallets";
import { makeTransferFunds } from "@/application/useCases/transferFunds";
import { makeWithdrawFunds } from "@/application/useCases/withdrawFunds";
import {
  createFrankfurterExchangeRateRepository,
  sharedRateCache,
} from "./repositories/FrankfurterExchangeRateRepository";
import { sharedInMemoryWalletRepository } from "./repositories/InMemoryWalletRepository";

/**
 * Composition root: the only place that decides which implementations the use
 * cases run against. Swapping the in-memory ledger for a database, or
 * Frankfurter for another rate source, is a change to this file alone.
 *
 * Direction of dependency is app -> infrastructure -> application -> domain;
 * nothing in application/ or domain/ imports anything from here.
 */
const wallets = sharedInMemoryWalletRepository();
const rates = createFrankfurterExchangeRateRepository({ cache: sharedRateCache() });

export const listWallets = makeListWallets({ wallets });
export const getWallet = makeGetWallet({ wallets });
export const balanceMinor = makeGetBalanceMinor({ wallets });
export const depositFunds = makeDepositFunds({ wallets });
export const withdrawFunds = makeWithdrawFunds({ wallets });
export const transferFunds = makeTransferFunds({ wallets });
export const convertCurrency = makeConvertCurrency({ wallets, rates });
export const listTransactions = makeListTransactions({ wallets });
export const getTransaction = makeGetTransaction({ wallets });
export const getExchangeRate = makeGetExchangeRate({ rates });
