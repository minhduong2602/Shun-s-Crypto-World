export function hasCronAuthorization(request: Request, secret: string | undefined) {
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}

export type WalletSyncBatchResult =
  | { walletId: string; status: 'success' }
  | { walletId: string; status: 'failed'; error: string };

export async function runWalletSyncBatch<T extends { id: string }>(
  wallets: T[],
  sync: (wallet: T) => Promise<unknown>,
  delayMs = 0,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<WalletSyncBatchResult[]> {
  const results: WalletSyncBatchResult[] = [];
  for (const [index, wallet] of wallets.entries()) {
    if (index > 0 && delayMs > 0) await wait(delayMs);
    try {
      await sync(wallet);
      results.push({ walletId: wallet.id, status: 'success' });
    } catch (error) {
      results.push({
        walletId: wallet.id,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
