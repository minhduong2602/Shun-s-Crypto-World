import type { ChainType } from '@/lib/types';
import { PublicKey } from '@solana/web3.js';
import { getLivePriceForSymbol } from '@/lib/market-service';
import { fetchCoinGeckoTokenPrices } from '@/lib/market/coingecko-token-prices';
import { parseMetaplexTokenMetadata } from '@/lib/wallets/solana-metadata';
import type { IndexedWalletAsset, WalletIndexer, WalletScanRequest } from '@/lib/providers/wallet-indexer';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type BlockscoutTokenBalance = {
  value?: string | null;
  token?: { address?: string; name?: string | null; symbol?: string | null; decimals?: string | number | null; exchange_rate?: string | null; type?: string } | null;
};
type BlockscoutTokenPage = {
  items?: BlockscoutTokenBalance[];
  next_page_params?: Record<string, string | number | boolean | null> | null;
};

const BLOCKSCOUT_API: Partial<Record<ChainType, string>> = {
  ETH: 'https://eth.blockscout.com/api/v2',
  BSC: 'https://bsc.blockscout.com/api/v2',
  POLYGON: 'https://polygon.blockscout.com/api/v2',
  ARBITRUM: 'https://arbitrum.blockscout.com/api/v2',
  BASE: 'https://base.blockscout.com/api/v2',
};
const EVM_NATIVE: Partial<Record<ChainType, { symbol: string; name: string }>> = {
  ETH: { symbol: 'ETH', name: 'Ethereum' },
  BSC: { symbol: 'BNB', name: 'BNB' },
  POLYGON: { symbol: 'POL', name: 'POL' },
  ARBITRUM: { symbol: 'ETH', name: 'Ethereum' },
  BASE: { symbol: 'ETH', name: 'Ethereum' },
};
const SOLANA_RPCS = ['https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'];
const ROUTESCAN_API = 'https://api.routescan.io/v2/network/mainnet/evm/56';
const BASE_ROUTESCAN_API = 'https://api.routescan.io/v2/network/mainnet/evm/8453';
const BSC_RPCS = ['https://bsc-rpc.publicnode.com', 'https://bsc-dataseed.bnbchain.org', 'https://bsc-dataseed-public.bnbchain.org'];
const SOLANA_TOKEN_PROGRAMS = [
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
];
const METAPLEX_TOKEN_METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
const MAX_SOLANA_MULTIPLE_ACCOUNTS = 100;
const SOLANA_METADATA_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const solanaMetadataCache = new Map<string, { metadata: ReturnType<typeof parseMetaplexTokenMetadata>; expiresAt: number }>();
const MAX_BLOCKSCOUT_TOKEN_PAGES = 100;
const MAX_ROUTESCAN_TOKEN_PAGES = 100;

export class PublicWalletIndexer implements WalletIndexer {
  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly getSymbolPrice: typeof getLivePriceForSymbol = getLivePriceForSymbol,
  ) {}

  async scan({ chain, address }: WalletScanRequest): Promise<IndexedWalletAsset[]> {
    if (chain === 'SOL') return this.scanSolana(address);
    if (chain === 'BTC') return this.scanBitcoin(address);
    const baseUrl = BLOCKSCOUT_API[chain];
    if (!baseUrl) throw new Error(`Chưa cấu hình nguồn quét token cho mạng ${chain}.`);
    if (chain === 'BSC') {
      return this.scanEvmWithFallback(chain, address,
        () => this.scanRoutescanEvm('BSC', address, ROUTESCAN_API),
        () => this.scanBlockscout(chain, address, baseUrl),
      );
    }
    if (chain === 'BASE') {
      return this.scanEvmWithFallback(chain, address,
        () => this.scanRoutescanEvm('BASE', address, BASE_ROUTESCAN_API),
        () => this.scanBlockscout(chain, address, baseUrl),
      );
    }
    return this.scanBlockscout(chain, address, baseUrl);
  }

  /**
   * Public explorer APIs occasionally rate-limit or return malformed pages. A
   * failed token-indexer must not make a valid native balance disappear. For
   * BSC/Base retry against an independent explorer. An empty fallback is
   * deliberately treated as a failure so a token-only wallet is never
   * reported as empty or used to deactivate a known-good asset snapshot.
   */
  private async scanEvmWithFallback(
    chain: 'BSC' | 'BASE',
    address: string,
    primary: () => Promise<IndexedWalletAsset[]>,
    fallback: () => Promise<IndexedWalletAsset[]>,
  ): Promise<IndexedWalletAsset[]> {
    try {
      return await primary();
    } catch (primaryError) {
      try {
        const assets = await fallback();
        if (assets.length > 0) {
          console.warn(`Primary ${chain} wallet indexer failed; using fallback provider.`, primaryError);
          return assets;
        }
      } catch (fallbackError) {
        throw new Error(`Không quét được ví ${chain}. Nguồn chính: ${this.errorMessage(primaryError)}. Nguồn dự phòng: ${this.errorMessage(fallbackError)}.`);
      }
      // An independent provider returning no rows cannot prove that a
      // token-only wallet is empty. Preserve the original provider error so
      // the sync service retains the last known-good asset snapshot.
      throw primaryError;
    }
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private async fetchJson(url: string, init?: RequestInit) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await this.fetcher(url, { ...init, signal: controller.signal, headers: { Accept: 'application/json', ...init?.headers } });
      if (!response.ok) throw new Error(`Nguồn dữ liệu trả HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  private async withSymbolPrice(symbol: string) {
    if (!symbol || symbol === 'UNKNOWN') return {};
    try {
      const price = await this.getSymbolPrice(symbol);
      return price ? { priceUsd: price.priceUsd, priceChange24h: price.change24h } : {};
    } catch {
      return {};
    }
  }

  private async withContractPrices(chain: ChainType, assets: IndexedWalletAsset[]) {
    const tokens = assets.filter((asset) => !asset.isNative);
    const prices = await fetchCoinGeckoTokenPrices(chain, tokens.map((asset) => asset.assetAddress), { fetcher: this.fetcher });
    return assets.map((asset) => {
      if (asset.isNative) return asset;
      const key = chain === 'SOL' ? asset.assetAddress : asset.assetAddress.toLowerCase();
      const price = prices[key];
      return price ? { ...asset, priceUsd: price.priceUsd, priceChange24h: price.change24h } : asset;
    });
  }

  private async scanBlockscout(chain: ChainType, address: string, baseUrl: string): Promise<IndexedWalletAsset[]> {
    const tokenRows: BlockscoutTokenBalance[] = [];
    const visitedCursors = new Set<string>();
    let cursor: BlockscoutTokenPage['next_page_params'];
    let pages = 0;
    do {
      const url = new URL(`${baseUrl}/addresses/${encodeURIComponent(address)}/tokens`);
      url.searchParams.set('type', 'ERC-20');
      for (const [key, value] of Object.entries(cursor ?? {})) {
        if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
      }
      const page = await this.fetchJson(url.toString()) as BlockscoutTokenPage;
      if (!Array.isArray(page.items)) throw new Error(`Nguồn ${chain} trả về trang token không hợp lệ.`);
      tokenRows.push(...page.items);
      cursor = page.next_page_params ?? undefined;
      pages += 1;
      if (cursor) {
        const cursorKey = JSON.stringify(cursor);
        if (visitedCursors.has(cursorKey)) throw new Error(`Nguồn ${chain} lặp cursor phân trang token.`);
        visitedCursors.add(cursorKey);
        if (pages >= MAX_BLOCKSCOUT_TOKEN_PAGES) throw new Error(`Nguồn ${chain} vượt quá giới hạn ${MAX_BLOCKSCOUT_TOKEN_PAGES} trang token.`);
      }
    } while (cursor);
    const native = EVM_NATIVE[chain];
    if (!native) throw new Error(`Không xác định được native token của ${chain}.`);
    const nativePrice = await this.withSymbolPrice(native.symbol);
    const assets: IndexedWalletAsset[] = [];
    const nativeBalance = await this.readEvmNativeBalance(chain, address);
    if (BigInt(nativeBalance) > 0n) {
      assets.push({ chain, assetAddress: 'native', isNative: true, symbol: native.symbol, name: native.name, decimals: 18, rawBalance: nativeBalance, ...nativePrice });
    }

    const tokenAssets: IndexedWalletAsset[] = [];
    for (const entry of tokenRows) {
      const token = entry.token;
      if (token?.type && token.type !== 'ERC-20') continue;
      if (!token) throw new Error(`Nguồn ${chain} trả thiếu metadata token ERC-20.`);
      if (typeof entry.value !== 'string' || !/^\d+$/.test(entry.value)) {
        throw new Error(`Nguồn ${chain} trả số dư token ERC-20 không hợp lệ.`);
      }
      const rawBalance = BigInt(entry.value);
      if (rawBalance === 0n) continue;
      if (typeof token.address !== 'string' || !token.address.trim()) {
        throw new Error(`Nguồn ${chain} trả thiếu địa chỉ cho token có số dư.`);
      }
      const decimalsValue = token.decimals;
      if (decimalsValue === null || decimalsValue === undefined || decimalsValue === '') {
        throw new Error(`Blockscout returned invalid decimals for a non-zero token balance`);
      }
      const decimals = Number(decimalsValue);
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
        throw new Error(`Blockscout returned invalid decimals for a non-zero token balance`);
      }
      const symbol = token.symbol?.trim().toUpperCase() || token.address!.slice(0, 8).toUpperCase();
      const fromExplorer = Number(token.exchange_rate);
      tokenAssets.push({
        chain,
        assetAddress: chain === 'ETH' || chain === 'POLYGON' || chain === 'ARBITRUM' ? token.address!.toLowerCase() : token.address!,
        isNative: false,
        symbol,
        name: token.name?.trim() || symbol,
        decimals,
        rawBalance: entry.value,
        ...(fromExplorer > 0 ? { priceUsd: fromExplorer } : {}),
      });
    }
    assets.push(...tokenAssets);
    return this.withContractPrices(chain, assets);
  }

  private async readEvmNativeBalance(chain: ChainType, address: string): Promise<string> {
    const rpcs: Partial<Record<ChainType, string[]>> = {
      ETH: ['https://ethereum-rpc.publicnode.com', 'https://rpc.ankr.com/eth'],
      BSC: BSC_RPCS,
      POLYGON: ['https://polygon-bor-rpc.publicnode.com', 'https://rpc.ankr.com/polygon'],
      ARBITRUM: ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum'],
      BASE: ['https://base-rpc.publicnode.com', 'https://mainnet.base.org'],
    };
    let lastError: unknown;
    for (const rpc of rpcs[chain] ?? []) {
      try {
        const result = await this.fetchJson(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }),
        }) as { result?: string; error?: { message?: string } };
        if (result.error) throw new Error(result.error.message || 'JSON-RPC error');
        if (typeof result.result === 'string' && /^0x[0-9a-f]+$/i.test(result.result)) return BigInt(result.result).toString();
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`Không lấy được native balance ${chain}: ${String(lastError ?? 'RPC không phản hồi')}`);
  }

  private async scanRoutescanEvm(chain: 'BSC' | 'BASE', address: string, apiBase: string): Promise<IndexedWalletAsset[]> {
    const assets: IndexedWalletAsset[] = [];
    const native = EVM_NATIVE[chain]!;
    const nativeBalance = await this.readEvmNativeBalance(chain, address);
    if (BigInt(nativeBalance) > 0n) {
      assets.push({ chain, assetAddress: 'native', isNative: true, symbol: native.symbol, name: native.name, decimals: 18, rawBalance: nativeBalance, ...await this.withSymbolPrice(native.symbol) });
    }
    let next: string | undefined;
    const visitedCursors = new Set<string>();
    let pages = 0;
    do {
      if (next) {
        if (visitedCursors.has(next)) throw new Error('Routescan repeated a pagination cursor.');
        visitedCursors.add(next);
      }
      const url = new URL(`${apiBase}/address/${encodeURIComponent(address)}/erc20-holdings`);
      url.searchParams.set('limit', '100');
      if (next) url.searchParams.set('next', next);
      const response = await this.fetchJson(url.toString()) as {
        items?: Array<{ tokenAddress?: string; tokenName?: string; tokenSymbol?: string; tokenQuantity?: string; tokenDecimals?: number | string | null }>;
        link?: { nextToken?: string; next?: string };
      };
      if (!Array.isArray(response.items)) throw new Error('Routescan token-holdings response is invalid.');
      const pageAssets = response.items.flatMap((token) => {
        if (!token.tokenAddress || !token.tokenQuantity || !/^\d+$/.test(token.tokenQuantity)) {
          throw new Error('Routescan returned an invalid token balance row.');
        }
        if (BigInt(token.tokenQuantity) === 0n) return [];
        if (token.tokenDecimals === null || token.tokenDecimals === undefined || token.tokenDecimals === '') {
          throw new Error('Routescan returned invalid decimals for a non-zero token balance.');
        }
        const decimals = Number(token.tokenDecimals);
        if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
          throw new Error('Routescan returned invalid decimals for a non-zero token balance.');
        }
        const symbol = token.tokenSymbol?.trim().toUpperCase() || token.tokenAddress.slice(0, 8).toUpperCase();
        return [{
          chain,
          assetAddress: token.tokenAddress.toLowerCase(),
          isNative: false,
          symbol,
          name: token.tokenName?.trim() || symbol,
          decimals,
          rawBalance: token.tokenQuantity,
        }];
      });
      assets.push(...pageAssets);
      next = response.link?.nextToken ?? response.link?.next;
      pages += 1;
      if (next && pages >= MAX_ROUTESCAN_TOKEN_PAGES) {
        throw new Error(`Routescan exceeded the ${MAX_ROUTESCAN_TOKEN_PAGES}-page token scan limit.`);
      }
    } while (next);
    return this.withContractPrices(chain, assets);
  }

  private async scanSolana(address: string): Promise<IndexedWalletAsset[]> {
    let lastError: unknown;
    for (const rpc of SOLANA_RPCS) {
      try {
        const [nativeResult, tokenResults] = await Promise.all([
          this.fetchJson(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address, { commitment: 'confirmed' }] }) }) as Promise<{ result?: { value?: number }; error?: { message?: string } }>,
          Promise.all(SOLANA_TOKEN_PROGRAMS.map((programId) => this.fetchJson(rpc, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: programId, method: 'getTokenAccountsByOwner', params: [address, { programId }, { encoding: 'jsonParsed', commitment: 'confirmed' }] }),
          }) as Promise<{ result?: { value?: Array<{ account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { amount?: string; decimals?: number } } } } } }> }; error?: { message?: string } }>)),
        ]);
        if (nativeResult.error) throw new Error(nativeResult.error.message || 'Solana getBalance failed');
        if (typeof nativeResult.result?.value !== 'number') throw new Error('Solana getBalance returned invalid data');
        const lamports = BigInt(nativeResult.result.value);
        const assets: IndexedWalletAsset[] = [];
        if (lamports > 0n) assets.push({ chain: 'SOL', assetAddress: 'native', isNative: true, symbol: 'SOL', name: 'Solana', decimals: 9, rawBalance: lamports.toString(), ...await this.withSymbolPrice('SOL') });
        const byMint = new Map<string, IndexedWalletAsset>();
        for (const result of tokenResults) {
          if (result.error) throw new Error(result.error.message || 'Solana token account scan failed');
          const accounts = result.result?.value;
          if (!Array.isArray(accounts)) throw new Error('Solana token account scan returned invalid data');
          for (const account of accounts) {
            const info = account.account?.data?.parsed?.info;
            const mint = info?.mint;
            const amount = info?.tokenAmount?.amount;
            const decimals = info?.tokenAmount?.decimals;
            if (typeof amount !== 'string' || !/^\d+$/.test(amount)) {
              throw new Error('Solana token account returned an invalid raw balance');
            }
            const tokenBalance = BigInt(amount);
            if (tokenBalance === 0n) continue;
            if (typeof mint !== 'string' || !mint.trim()) {
              throw new Error('Solana returned a non-zero token account without a mint address');
            }
            if (typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
              throw new Error('Solana returned invalid decimals for a non-zero token balance');
            }
            const existing = byMint.get(mint);
            if (existing && existing.decimals !== decimals) {
              throw new Error('Solana returned conflicting decimals for the same token mint');
            }
            const rawBalance = (BigInt(existing?.rawBalance ?? '0') + tokenBalance).toString();
            byMint.set(mint, { chain: 'SOL', assetAddress: mint, isNative: false, symbol: 'SPL', name: `SPL token · ${mint.slice(0, 5)}…${mint.slice(-4)}`, decimals, rawBalance });
          }
        }
        const tokenMints = [...byMint.keys()];
        let metadataByMint = new Map<string, NonNullable<ReturnType<typeof parseMetaplexTokenMetadata>>>();
        try {
          metadataByMint = await this.loadSolanaTokenMetadata(rpc, tokenMints);
        } catch (error) {
          console.warn('Solana token metadata lookup failed:', error);
          // Token metadata is optional; a metadata RPC failure must not hide valid on-chain balances.
        }
        for (const [mint, asset] of byMint) {
          const metadata = metadataByMint.get(mint);
          if (metadata) {
            asset.symbol = metadata.symbol || asset.symbol;
            asset.name = metadata.name || asset.name;
          }
        }
        assets.push(...byMint.values());
        return this.withContractPrices('SOL', assets);
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`Không quét được ví Solana: ${String(lastError ?? 'RPC không phản hồi')}`);
  }

  private async loadSolanaTokenMetadata(
    rpc: string,
    mints: string[],
  ): Promise<Map<string, NonNullable<ReturnType<typeof parseMetaplexTokenMetadata>>>> {
    const now = Date.now();
    const metadataByMint = new Map<string, NonNullable<ReturnType<typeof parseMetaplexTokenMetadata>>>();
    const pending: Array<{ mint: string; metadataAddress: string }> = [];
    const programId = new PublicKey(METAPLEX_TOKEN_METADATA_PROGRAM_ID);

    for (const mint of mints) {
      const cached = solanaMetadataCache.get(mint);
      if (cached && cached.expiresAt > now) {
        if (cached.metadata) metadataByMint.set(mint, cached.metadata);
        continue;
      }
      try {
        const mintKey = new PublicKey(mint);
        const [metadataAddress] = PublicKey.findProgramAddressSync(
          [Buffer.from('metadata'), programId.toBuffer(), mintKey.toBuffer()],
          programId,
        );
        pending.push({ mint, metadataAddress: metadataAddress.toBase58() });
      } catch {
        // Invalid mint addresses are omitted from metadata lookup and remain visible by address.
      }
    }

    for (let start = 0; start < pending.length; start += MAX_SOLANA_MULTIPLE_ACCOUNTS) {
      const batch = pending.slice(start, start + MAX_SOLANA_MULTIPLE_ACCOUNTS);
      const response = await this.fetchJson(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'solana-metadata',
          method: 'getMultipleAccounts',
          params: [batch.map((item) => item.metadataAddress), { encoding: 'base64', commitment: 'confirmed' }],
        }),
      }) as {
        result?: { value?: Array<{ data?: [string, string]; owner?: string } | null> };
        error?: { message?: string };
      };
      if (response.error) throw new Error(response.error.message || 'Solana getMultipleAccounts failed');
      const accounts = response.result?.value;
      if (!Array.isArray(accounts) || accounts.length !== batch.length) {
        throw new Error('Solana metadata response returned an invalid account list');
      }

      batch.forEach(({ mint }, index) => {
        const account = accounts[index];
        const encodedData = account?.owner === METAPLEX_TOKEN_METADATA_PROGRAM_ID
          && account.data?.[1] === 'base64'
          ? account.data[0]
          : null;
        const metadata = encodedData ? parseMetaplexTokenMetadata(encodedData) : null;
        const verifiedMetadata = metadata?.mint === mint ? metadata : null;
        solanaMetadataCache.set(mint, { metadata: verifiedMetadata, expiresAt: now + SOLANA_METADATA_CACHE_TTL_MS });
        if (verifiedMetadata) metadataByMint.set(mint, verifiedMetadata);
      });
    }

    return metadataByMint;
  }

  private async scanBitcoin(address: string): Promise<IndexedWalletAsset[]> {
    const response = await this.fetchJson(`https://blockstream.info/api/address/${encodeURIComponent(address)}`) as {
      chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
      mempool_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
    };
    const chainStats = response.chain_stats;
    const mempoolStats = response.mempool_stats;
    if (!chainStats) throw new Error('Bitcoin explorer trả về dữ liệu balance không hợp lệ.');
    const satoshis = BigInt(chainStats.funded_txo_sum ?? 0) - BigInt(chainStats.spent_txo_sum ?? 0)
      + BigInt(mempoolStats?.funded_txo_sum ?? 0) - BigInt(mempoolStats?.spent_txo_sum ?? 0);
    if (satoshis <= 0n) return [];
    return [{ chain: 'BTC', assetAddress: 'native', isNative: true, symbol: 'BTC', name: 'Bitcoin', decimals: 8, rawBalance: satoshis.toString(), ...await this.withSymbolPrice('BTC') }];
  }
}
