import type { IndexedWalletAsset, WalletIndexer, WalletScanRequest } from '@/lib/providers/wallet-indexer';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const SOL_RPC = 'https://api.mainnet-beta.solana.com';

export class PublicWalletIndexer implements WalletIndexer {
  constructor(private readonly fetcher: Fetcher = fetch) {}
  async scan({ chain, address }: WalletScanRequest): Promise<IndexedWalletAsset[]> {
    if (chain !== 'SOL') return [];
    const response = await this.fetcher(SOL_RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner', params: [address, { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }] }) });
    if (!response.ok) throw new Error(`Public Solana RPC failed with HTTP ${response.status}`);
    const payload = await response.json() as { result?: { value?: Array<{ account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { amount?: string; decimals?: number } } } } } }> } };
    return (payload.result?.value ?? []).flatMap((entry) => {
      const info = entry.account?.data?.parsed?.info; const amount = info?.tokenAmount?.amount;
      if (!info?.mint || !amount || BigInt(amount) === 0n) return [];
      return [{ chain, assetAddress: info.mint, isNative: false, symbol: 'UNKNOWN', name: 'Solana token', decimals: info.tokenAmount?.decimals ?? 0, rawBalance: amount }];
    });
  }
}
