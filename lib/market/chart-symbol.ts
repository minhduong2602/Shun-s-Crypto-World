const COIN_ID_TO_SYMBOL: Record<string, string> = {
  aave: 'AAVE',
  arbitrum: 'ARB',
  'avalanche-2': 'AVAX',
  'bitcoin-cash': 'BCH',
  binancecoin: 'BNB',
  bitcoin: 'BTC',
  bittensor: 'TAO',
  cardano: 'ADA',
  chainlink: 'LINK',
  cosmos: 'ATOM',
  dogecoin: 'DOGE',
  ethereum: 'ETH',
  'injective-protocol': 'INJ',
  litecoin: 'LTC',
  'near-protocol': 'NEAR',
  optimism: 'OP',
  pepe: 'PEPE',
  polkadot: 'DOT',
  'polygon-ecosystem-token': 'POL',
  'render-token': 'RENDER',
  ripple: 'XRP',
  solana: 'SOL',
  'shiba-inu': 'SHIB',
  sui: 'SUI',
  'the-open-network': 'TON',
  tron: 'TRX',
  uniswap: 'UNI',
};

const SYMBOL_TO_COIN_ID = Object.fromEntries(
  Object.entries(COIN_ID_TO_SYMBOL).map(([coinId, symbol]) => [symbol, coinId]),
);

export function normalizeChartSymbol(value: string): string {
  const normalized = value.trim().toLowerCase();
  return COIN_ID_TO_SYMBOL[normalized] ?? normalized.toUpperCase();
}

export function getCoinGeckoIdForSymbol(symbol: string): string | null {
  return SYMBOL_TO_COIN_ID[symbol.trim().toUpperCase()] ?? null;
}
