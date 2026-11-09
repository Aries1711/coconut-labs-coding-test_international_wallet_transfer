import { Redis } from "@upstash/redis";
import { makeConvertCurrency } from "@/application/useCases/convertCurrency";
import { makeDepositFunds } from "@/application/useCases/depositFunds";
import { makeGetExchangeRate } from "@/application/useCases/getExchangeRate";
import { makeGetTransaction } from "@/application/useCases/getTransaction";
import { makeGetBalanceMinor, makeGetWallet } from "@/application/useCases/getWallet";
import { makeListTransactions } from "@/application/useCases/listTransactions";
import { makeListWallets } from "@/application/useCases/listWallets";
import { makeTransferFunds } from "@/application/useCases/transferFunds";
import { makeWithdrawFunds } from "@/application/useCases/withdrawFunds";
import type { WalletRepository } from "@/domain/repositories/WalletRepository";
import {
  createFrankfurterExchangeRateRepository,
  sharedRateCache,
} from "./repositories/FrankfurterExchangeRateRepository";
import { sharedInMemoryWalletRepository } from "./repositories/InMemoryWalletRepository";
import { createRedisWalletRepository } from "./repositories/RedisWalletRepository";

/**
 * Composition root: the only place that decides which implementations the use
 * cases run against. Direction of dependency is
 * app -> infrastructure -> application -> domain; nothing in application/ or
 * domain/ imports anything from here.
 */

/**
 * Redis when it is configured, memory otherwise.
 *
 * Serverless hosts give no instance affinity, so an in-memory ledger would
 * lose writes between requests -- Redis is required there. Locally and in
 * tests the in-memory store keeps `npm run dev` and `npm test` dependency-free.
 *
 * Both Vercel KV and a direct Upstash integration are accepted, since they set
 * differently-named variables for the same service.
 */
function createWalletRepository(): WalletRepository {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    return createRedisWalletRepository(
      new Redis({
        url,
        token,
        // The client defaults to five retries with backoff, which can outlast
        // a serverless request. Fail fast instead: a 500 the user can retry
        // beats a request that hangs.
        retry: { retries: 2, backoff: (attempt) => attempt * 50 },
      }),
    );
  }

  if (process.env.VERCEL) {
    // Failing loudly beats a wallet that silently forgets transactions.
    throw new Error(
      "Running on Vercel without Redis configured. Set KV_REST_API_URL and " +
        "KV_REST_API_TOKEN (or the UPSTASH_REDIS_REST_* equivalents): the " +
        "in-memory ledger cannot survive across serverless instances.",
    );
  }

  return sharedInMemoryWalletRepository();
}

const wallets = createWalletRepository();
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
