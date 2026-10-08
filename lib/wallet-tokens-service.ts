import { ChainType } from './types';
import { getLivePriceForSymbol } from './market-service';

export interface WalletTokenItem {
  symbol: string;
  name: string;
  contractAddress?: string;
  balance: number;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
  isNative: boolean;
  chain: ChainType;
}

// Common popular ERC-20 tokens on Ethereum mainnet
const ETH_TOKENS = [
  { symbol: 'USDT', name: 'Tether USD', address: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6 },
  { symbol: 'USDC', name: 'USD Coin', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6 },
  { symbol: 'WBTC', name: 'Wrapped BTC', address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', decimals: 8 },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x6b175474e89094c44da98b954eedeac495271d0f', decimals: 18 },
  { symbol: 'LINK', name: 'Chainlink', address: '0x514910771af9ca656af840dff83e8264ecf986ca', decimals: 18 },
  { symbol: 'UNI', name: 'Uniswap', address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', decimals: 18 },
  { symbol: 'SHIB', name: 'Shiba Inu', address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce', decimals: 18 },
  { symbol: 'PEPE', name: 'Pepe', address: '0x6982508145454ce325ddbe47a25d4ec3d2311933', decimals: 18 },
];

// Common popular BEP-20 tokens on BNB Chain
const BSC_TOKENS = [
  { symbol: 'USDT', name: 'Tether USD', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
  { symbol: 'ETH', name: 'Binance-Peg Ethereum', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18 },
  { symbol: 'BTCB', name: 'Binance-Peg BTC', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18 },
  { symbol: 'CAKE', name: 'PancakeSwap Token', address: '0x0E09FaBB73BD3Ade0a17ECC321fD13a19e81cE82', decimals: 18 },
];

// Common popular Polygon tokens
const POLYGON_TOKENS = [
  { symbol: 'USDT', name: 'Tether USD', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
  { symbol: 'USDC', name: 'USD Coin', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 },
  { symbol: 'WBTC', name: 'Wrapped BTC', address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', decimals: 8 },
];

const EVM_RPC_ENDPOINTS: Record<string, string[]> = {
  ETH: ['https://rpc.ankr.com/eth', 'https://ethereum-rpc.publicnode.com', 'https://eth.blockrazor.xyz'],
  BSC: ['https://bsc-dataseed.binance.org', 'https://rpc.ankr.com/bsc', 'https://bsc-rpc.publicnode.com'],
  POLYGON: ['https://polygon-bor-rpc.publicnode.com', 'https://rpc.ankr.com/polygon'],
  ARBITRUM: ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum'],
};

/**
 * Check ERC-20 balance via eth_call
 */
async function checkErc20Balance(
  rpcUrl: string,
  tokenAddress: string,
  walletAddress: string,
  decimals: number
): Promise<number> {
  try {
    const cleanAddr = walletAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0');
    // 0x70a08231 is balanceOf(address)
    const callData = `0x70a08231${cleanAddr}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: tokenAddress, data: callData }, 'latest'],
        id: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.result && data.result !== '0x' && data.result !== '0x0') {
        const raw = BigInt(data.result);
        if (raw > BigInt(0)) {
          const balance = Number(raw) / Math.pow(10, decimals);
          return Number(balance.toFixed(6));
        }
      }
    }
  } catch {
    // Ignore RPC failure
  }
  return 0;
}

/**
 * Fetch SPL tokens on Solana using getTokenAccountsByOwner
 */
async function fetchSolanaTokens(walletAddress: string): Promise<
  Array<{ mint: string; balance: number }>
> {
  const rpcs = ['https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'];

  for (const rpc of rpcs) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [
            walletAddress,
            { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
            { encoding: 'jsonParsed' },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const accounts = data?.result?.value || [];
        const tokens: Array<{ mint: string; balance: number }> = [];

        for (const item of accounts) {
          const info = item?.account?.data?.parsed?.info;
          const mint = info?.mint;
          const uiAmount = info?.tokenAmount?.uiAmount;
          if (mint && typeof uiAmount === 'number' && uiAmount > 0) {
            tokens.push({ mint, balance: Number(uiAmount.toFixed(6)) });
          }
        }
        return tokens;
      }
    } catch {
      continue;
    }
  }
  return [];
}

/**
 * Queries all on-chain tokens in a wallet (native coin + all tokens)
 */
export async function getWalletTokensOnChain(
  chain: ChainType,
  walletAddress: string,
  nativeBalance: number,
  nativeSymbol: string
): Promise<WalletTokenItem[]> {
  const tokens: WalletTokenItem[] = [];

  // 1. Add Native token first
  const nativePriceInfo = await getLivePriceForSymbol(nativeSymbol);
  const nativePrice = nativePriceInfo?.priceUsd || (nativeSymbol === 'BTC' ? 91450 : nativeSymbol === 'ETH' ? 3420 : 180);

  tokens.push({
    symbol: nativeSymbol,
    name: nativeSymbol === 'BTC' ? 'Bitcoin' : nativeSymbol === 'SOL' ? 'Solana' : nativeSymbol === 'BNB' ? 'BNB' : 'Ethereum',
    balance: nativeBalance,
    decimals: 18,
    priceUsd: nativePrice,
    valueUsd: Number((nativeBalance * nativePrice).toFixed(2)),
    isNative: true,
    chain,
  });

  // 2. Query Tokens based on chain
  if (['ETH', 'BSC', 'POLYGON'].includes(chain)) {
    const tokenList = chain === 'ETH' ? ETH_TOKENS : chain === 'BSC' ? BSC_TOKENS : POLYGON_TOKENS;
    const rpcUrl = (EVM_RPC_ENDPOINTS[chain] || EVM_RPC_ENDPOINTS.ETH)[0];

    // Query in parallel
    const queries = tokenList.map(async (t) => {
      const bal = await checkErc20Balance(rpcUrl, t.address, walletAddress, t.decimals);
      return { token: t, balance: bal };
    });

    const results = await Promise.all(queries);

    for (const r of results) {
      if (r.balance > 0) {
        const priceData = await getLivePriceForSymbol(r.token.symbol);
        const p = priceData?.priceUsd || (r.token.symbol.includes('USD') ? 1.0 : 10);
        tokens.push({
          symbol: r.token.symbol,
          name: r.token.name,
          contractAddress: r.token.address,
          balance: r.balance,
          decimals: r.token.decimals,
          priceUsd: p,
          valueUsd: Number((r.balance * p).toFixed(2)),
          isNative: false,
          chain,
        });
      }
    }
  } else if (chain === 'SOL') {
    const solTokens = await fetchSolanaTokens(walletAddress);

    for (const t of solTokens.slice(0, 10)) {
      // Known popular mints
      let sym = 'SPL-TOKEN';
      let name = `Token (${t.mint.substring(0, 4)}...${t.mint.slice(-4)})`;
      let price = 1.0;

      if (t.mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') {
        sym = 'USDT';
        name = 'Tether USD (Solana)';
        price = 1.0;
      } else if (t.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
        sym = 'USDC';
        name = 'USD Coin (Solana)';
        price = 1.0;
      } else if (t.mint === 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263') {
        sym = 'BONK';
        name = 'Bonk';
        const p = await getLivePriceForSymbol('BONK');
        price = p?.priceUsd || 0.00002;
      }

      tokens.push({
        symbol: sym,
        name,
        contractAddress: t.mint,
        balance: t.balance,
        decimals: 6,
        priceUsd: price,
        valueUsd: Number((t.balance * price).toFixed(2)),
        isNative: false,
        chain,
      });
    }
  }

  // Sort: tokens with highest value first
  return tokens.sort((a, b) => b.valueUsd - a.valueUsd);
}
