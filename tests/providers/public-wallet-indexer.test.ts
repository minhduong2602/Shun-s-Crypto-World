// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { PublicWalletIndexer } from '@/lib/providers/public-wallet-indexer';

afterEach(() => vi.unstubAllEnvs());

describe('PublicWalletIndexer', () => {
  it('returns every non-zero SPL token account from a public RPC response', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { method: string; params?: Array<{ programId?: string }> };
      if (request.method === 'getBalance') return new Response(JSON.stringify({ result: { value: 0 } }));
      const mint = request.params?.[1]?.programId?.startsWith('Tokenkeg') ? 'MintA' : 'MintB';
      const amount = mint === 'MintA' ? '42' : '99';
      return new Response(JSON.stringify({ result: { value: [{ account: { data: { parsed: { info: { mint, tokenAmount: { amount, decimals: 6, uiAmountString: '0.000042' } } } } } }] } }));
    });
    const assets = await new PublicWalletIndexer(fetcher).scan({ chain: 'SOL', address: 'wallet' });
    expect(assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetAddress: 'MintA', rawBalance: '42', decimals: 6 }),
      expect.objectContaining({ assetAddress: 'MintB', rawBalance: '99', decimals: 6 }),
    ]));
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('enriches Solana token balances from batched on-chain metadata while preserving the mint address', async () => {
    const mint = 'So11111111111111111111111111111111111111112';
    const metadata = Buffer.alloc(256);
    metadata[0] = 4;
    metadata.set(new PublicKey(mint).toBuffer(), 33);
    let offset = 65;
    for (const value of ['Wrapped SOL', 'WSOL']) {
      const bytes = Buffer.from(value, 'utf8');
      metadata.writeUInt32LE(bytes.length, offset);
      offset += 4;
      bytes.copy(metadata, offset);
      offset += bytes.length;
    }
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { method: string; params?: Array<{ programId?: string } | string[]> };
      if (request.method === 'getBalance') return Response.json({ result: { value: 0 } });
      if (request.method === 'getMultipleAccounts') {
        return Response.json({
          result: {
            context: { slot: 1 },
            value: [{ data: [metadata.toString('base64'), 'base64'], executable: false, lamports: 1, owner: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', rentEpoch: 1, space: offset }],
          },
        });
      }
      const programId = (request.params?.[1] as { programId?: string } | undefined)?.programId;
      if (programId?.startsWith('Tokenkeg')) {
        return Response.json({ result: { value: [{ account: { data: { parsed: { info: { mint, tokenAmount: { amount: '42000000', decimals: 6 } } } } } }] } });
      }
      return Response.json({ result: { value: [] } });
    });

    const assets = await new PublicWalletIndexer(fetcher).scan({ chain: 'SOL', address: 'wallet' });

    expect(fetcher.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).method)).toContain('getMultipleAccounts');
    expect(assets).toContainEqual(expect.objectContaining({
      chain: 'SOL', assetAddress: mint, symbol: 'WSOL', name: 'Wrapped SOL', rawBalance: '42000000', decimals: 6,
    }));
  });

  it('rejects malformed Solana token-account responses instead of treating them as an empty wallet', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { method: string };
      if (request.method === 'getBalance') return Response.json({ result: { value: 0 } });
      return Response.json({ result: {} });
    });

    await expect(new PublicWalletIndexer(fetcher).scan({ chain: 'SOL', address: 'wallet' }))
      .rejects.toThrow('Solana token account scan returned invalid data');
  });

  it('fails Solana sync when a non-zero token account is missing decimals metadata', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { method: string; params?: Array<{ programId?: string }> };
      if (request.method === 'getBalance') return Response.json({ result: { value: 0 } });
      const mint = request.params?.[1]?.programId?.startsWith('Tokenkeg') ? 'MintA' : 'MintB';
      return Response.json({
        result: { value: [{ account: { data: { parsed: { info: { mint, tokenAmount: { amount: '100' } } } } } }] },
      });
    });

    await expect(new PublicWalletIndexer(fetcher).scan({ chain: 'SOL', address: 'wallet' }))
      .rejects.toThrow('Solana returned invalid decimals for a non-zero token balance');
  });

  it('fails Solana sync when token accounts for the same mint disagree on decimals', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { method: string; params?: Array<{ programId?: string }> };
      if (request.method === 'getBalance') return Response.json({ result: { value: 0 } });
      const decimals = request.params?.[1]?.programId?.startsWith('Tokenkeg') ? 6 : 9;
      return Response.json({
        result: { value: [{ account: { data: { parsed: { info: { mint: 'MintA', tokenAmount: { amount: '100', decimals } } } } } }] },
      });
    });

    await expect(new PublicWalletIndexer(fetcher).scan({ chain: 'SOL', address: 'wallet' }))
      .rejects.toThrow('Solana returned conflicting decimals for the same token mint');
  });

  it('prices discovered SPL mints by contract address through configured CoinGecko Demo API', async () => {
    vi.stubEnv('COINGECKO_DEMO_API_KEY', 'demo-key');
    vi.stubEnv('COINGECKO_DEMO_API_KEY_2', '');
    vi.stubEnv('COINGECKO_DEMO_API_KEY_3', '');
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('api.coingecko.com')) {
        return Response.json({
          MintA: { usd: 1.23, usd_24h_change: 2.5 },
          MintB: { usd: 0.004, usd_24h_change: -3.1 },
        });
      }
      const request = JSON.parse(String(init?.body)) as { method: string; params?: Array<{ programId?: string }> };
      if (request.method === 'getBalance') return Response.json({ result: { value: 0 } });
      const mint = request.params?.[1]?.programId?.startsWith('Tokenkeg') ? 'MintA' : 'MintB';
      const amount = mint === 'MintA' ? '42' : '99';
      return Response.json({ result: { value: [{ account: { data: { parsed: { info: { mint, tokenAmount: { amount, decimals: 6 } } } } } }] } });
    });

    const assets = await new PublicWalletIndexer(fetcher).scan({ chain: 'SOL', address: 'wallet' });

    expect(assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetAddress: 'MintA', priceUsd: 1.23, priceChange24h: 2.5 }),
      expect.objectContaining({ assetAddress: 'MintB', priceUsd: 0.004, priceChange24h: -3.1 }),
    ]));
  });

  it('uses the injected market quote provider to value native wallet assets', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('ethereum-rpc.publicnode.com')) return Response.json({ result: '0xde0b6b3a7640000' });
      return Response.json({ items: [], next_page_params: null });
    });
    const getPrice = vi.fn(async (symbol: string) => ({
      priceUsd: symbol === 'ETH' ? 2500 : 0,
      change24h: 1.5,
    }));

    const assets = await new PublicWalletIndexer(fetcher, getPrice).scan({ chain: 'ETH', address: '0xWallet' });

    expect(getPrice).toHaveBeenCalledWith('ETH');
    expect(assets).toEqual([
      expect.objectContaining({ assetAddress: 'native', symbol: 'ETH', priceUsd: 2500, priceChange24h: 1.5 }),
    ]);
  });

  it('scans all BSC ERC-20 holdings across keyless Routescan pages', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('bsc-dataseed')) {
        return Response.json({ result: '0x0' });
      }
      const url = new URL(String(input));
      if (url.searchParams.get('next') === 'cursor-2') {
        return Response.json({
          items: [{ tokenAddress: '0xTokenB', tokenName: 'Token B', tokenSymbol: 'TB', tokenDecimals: 8, tokenQuantity: '250' }],
          link: {},
        });
      }
      return Response.json({
        items: [{ tokenAddress: '0xTokenA', tokenName: 'Token A', tokenSymbol: 'TA', tokenDecimals: 18, tokenQuantity: '1000000000000000000' }],
        link: { nextToken: 'cursor-2' },
      });
    });

    const assets = await new PublicWalletIndexer(fetcher).scan({ chain: 'BSC', address: '0xWallet' });

    expect(assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ chain: 'BSC', assetAddress: '0xtokena', rawBalance: '1000000000000000000', decimals: 18 }),
      expect.objectContaining({ chain: 'BSC', assetAddress: '0xtokenb', rawBalance: '250', decimals: 8 }),
    ]));
    expect(fetcher.mock.calls.some(([input]) => String(input).includes('addresstokenbalance'))).toBe(false);
    expect(fetcher.mock.calls.some(([input]) => new URL(String(input)).searchParams.get('next') === 'cursor-2')).toBe(true);
  });

  it('fails BSC scans when Routescan repeats a pagination cursor', async () => {
    let cursorRequests = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('bsc-dataseed')) return Response.json({ result: '0x0' });
      const url = new URL(String(input));
      if (url.searchParams.get('next') === 'cursor-2') {
        cursorRequests += 1;
        return Response.json({ items: [], link: cursorRequests === 1 ? { nextToken: 'cursor-2' } : {} });
      }
      return Response.json({ items: [], link: { nextToken: 'cursor-2' } });
    });

    await expect(new PublicWalletIndexer(fetcher, async () => null).scan({ chain: 'BSC', address: '0xWallet' }))
      .rejects.toThrow('Routescan repeated a pagination cursor');
    expect(cursorRequests).toBe(1);
  });

  it('fails Routescan scans that exceed the pagination safety limit', async () => {
    let pageCount = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('bsc-dataseed')) return Response.json({ result: '0x0' });
      const url = new URL(String(input));
      const cursor = Number(url.searchParams.get('next') ?? '0');
      pageCount += 1;
      return Response.json({ items: [], link: pageCount > 101 ? {} : { nextToken: String(cursor + 1) } });
    });

    await expect(new PublicWalletIndexer(fetcher, async () => null).scan({ chain: 'BSC', address: '0xWallet' }))
      .rejects.toThrow('Routescan exceeded the 100-page token scan limit');
    expect(pageCount).toBe(100);
  });

  it('follows all Blockscout ERC-20 token-balance pages instead of silently truncating holdings', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('ethereum-rpc.publicnode.com')) return Response.json({ result: '0x0' });
      const url = new URL(String(input));
      expect(url.pathname).toContain('/addresses/0xWallet/tokens');
      expect(url.searchParams.get('type')).toBe('ERC-20');
      if (url.searchParams.get('value') === '1') {
        return Response.json({ items: [{ value: '200', token: { type: 'ERC-20', address: '0xTokenB', name: 'Token B', symbol: 'TB', decimals: '6' } }], next_page_params: null });
      }
      return Response.json({
        items: [{ value: '100', token: { type: 'ERC-20', address: '0xTokenA', name: 'Token A', symbol: 'TA', decimals: '18' } }],
        next_page_params: { value: '1', items_count: 1, token_type: 'ERC-20' },
      });
    });

    const assets = await new PublicWalletIndexer(fetcher, async () => null).scan({ chain: 'ETH', address: '0xWallet' });

    expect(assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ chain: 'ETH', assetAddress: '0xtokena', rawBalance: '100', decimals: 18 }),
      expect.objectContaining({ chain: 'ETH', assetAddress: '0xtokenb', rawBalance: '200', decimals: 6 }),
    ]));
    expect(fetcher.mock.calls.filter(([input]) => String(input).includes('/tokens?')).length).toBe(2);
  });

  it('fails Blockscout scans when a non-zero ERC-20 token is missing valid decimals', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('ethereum-rpc.publicnode.com')) return Response.json({ result: '0x0' });
      return Response.json({
        items: [{ value: '100', token: { type: 'ERC-20', address: '0xTokenA', symbol: 'TA', decimals: null } }],
        next_page_params: null,
      });
    });

    await expect(new PublicWalletIndexer(fetcher, async () => null).scan({ chain: 'ETH', address: '0xWallet' }))
      .rejects.toThrow('Blockscout returned invalid decimals for a non-zero token balance');
  });

  it('fails BSC scans on an invalid Routescan response instead of treating the wallet as empty', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('bsc-dataseed')) return Response.json({ result: '0x0' });
      return Response.json({ items: 'invalid' });
    });

    await expect(new PublicWalletIndexer(fetcher).scan({ chain: 'BSC', address: '0xWallet' }))
      .rejects.toThrow('Routescan token-holdings response is invalid');
  });

  it('fails a Routescan scan when a non-zero token is missing valid decimals', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('bsc-dataseed')) return Response.json({ result: '0x0' });
      return Response.json({
        items: [{ tokenAddress: '0xTokenA', tokenName: 'Token A', tokenSymbol: 'TA', tokenQuantity: '100', tokenDecimals: null }],
        link: {},
      });
    });

    await expect(new PublicWalletIndexer(fetcher, async () => null).scan({ chain: 'BSC', address: '0xWallet' }))
      .rejects.toThrow('Routescan returned invalid decimals for a non-zero token balance');
  });

  it('scans Base ERC-20 holdings and native balance through public providers', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('base-rpc.publicnode.com')) return Response.json({ result: '0xde0b6b3a7640000' });
      const url = new URL(String(input));
      expect(url.pathname).toContain('/evm/8453/address/');
      return Response.json({ items: [{ tokenAddress: '0xTokenA', tokenName: 'Token A', tokenSymbol: 'TA', tokenDecimals: 18, tokenQuantity: '1000000000000000000' }], link: {} });
    });
    const assets = await new PublicWalletIndexer(fetcher, async () => null).scan({ chain: 'BASE', address: '0xWallet' });
    expect(assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ chain: 'BASE', assetAddress: 'native', symbol: 'ETH', rawBalance: '1000000000000000000' }),
      expect.objectContaining({ chain: 'BASE', assetAddress: '0xtokena', symbol: 'TA', rawBalance: '1000000000000000000' }),
    ]));
  });
});
