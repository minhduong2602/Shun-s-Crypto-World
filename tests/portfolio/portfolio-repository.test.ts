import { describe, expect, it } from 'vitest';
import { buildHoldingsFromTransactions, calculateRealizedProfitLoss, getPortfolioQuotes, summarizeHoldings } from '@/lib/portfolio/repository';
import type { MarketTicker, Transaction } from '@/lib/types';

const transactions: Transaction[] = [
  {
    id: 'buy-btc', coinId: 'btc', symbol: 'BTC', name: 'Bitcoin', type: 'BUY', amount: 1,
    pricePerCoin: 100, totalAmount: 100, fee: 0, executedAt: '2026-10-01T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'buy-eth', coinId: 'eth', symbol: 'ETH', name: 'Ethereum', type: 'BUY', amount: 2,
    pricePerCoin: 10, totalAmount: 20, fee: 0, executedAt: '2026-10-02T00:00:00.000Z', createdAt: '2026-10-02T00:00:00.000Z',
  },
];

describe('portfolio price availability', () => {
  it('calculates realized profit using average cost and nets sale fees without realizing transfers', () => {
    const ledger: Transaction[] = [
      {
        id: 'buy-1', coinId: 'btc', symbol: 'BTC', name: 'Bitcoin', type: 'BUY', amount: 1,
        pricePerCoin: 100, fee: 2, totalAmount: 102,
        executedAt: '2026-10-01T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z',
      },
      {
        id: 'buy-2', coinId: 'btc', symbol: 'BTC', name: 'Bitcoin', type: 'BUY', amount: 1,
        pricePerCoin: 200, fee: 2, totalAmount: 202,
        executedAt: '2026-10-01T01:00:00.000Z', createdAt: '2026-10-01T01:00:00.000Z',
      },
      {
        id: 'sell', coinId: 'btc', symbol: 'BTC', name: 'Bitcoin', type: 'SELL', amount: 1,
        pricePerCoin: 200, fee: 1, totalAmount: 201,
        executedAt: '2026-10-02T00:00:00.000Z', createdAt: '2026-10-02T00:00:00.000Z',
      },
      {
        id: 'transfer-out', coinId: 'btc', symbol: 'BTC', name: 'Bitcoin', type: 'TRANSFER_OUT', amount: 0.5,
        pricePerCoin: 200, fee: 0, totalAmount: 100,
        executedAt: '2026-10-03T00:00:00.000Z', createdAt: '2026-10-03T00:00:00.000Z',
      },
    ];

    expect(calculateRealizedProfitLoss(ledger)).toBe(47);
  });

  it('loads one shared market snapshot for all open symbols and leaves missing prices unavailable', async () => {
    let snapshotLoads = 0;
    const quotes = await getPortfolioQuotes(['BTC', 'ETH'], async () => {
      snapshotLoads += 1;
      return [{
        id: 'btc', symbol: 'BTC', name: 'Bitcoin', rank: 1, priceUsd: 110,
        priceChange1h: null, priceChange24h: 2, priceChange7d: null, marketCapUsd: null,
        volume24hUsd: 1_000, circulatingSupply: null, sparkline7d: [], high24h: 115, low24h: 105,
      } satisfies MarketTicker];
    });

    expect(snapshotLoads).toBe(1);
    expect(quotes).toEqual({ BTC: { priceUsd: 110, change24h: 2, name: 'Bitcoin' }, ETH: null });
  });

  it('keeps holdings without a live quote unpriced instead of reporting a total loss', () => {
    const holdings = buildHoldingsFromTransactions(transactions, {
      BTC: { priceUsd: 110, change24h: 2 },
      ETH: null,
    });

    expect(holdings).toEqual(expect.arrayContaining([
      expect.objectContaining({ symbol: 'BTC', priceAvailable: true, currentPrice: 110, currentValue: 110, unrealizedPnL: 10 }),
      expect.objectContaining({ symbol: 'ETH', priceAvailable: false, currentPrice: null, currentValue: null, unrealizedPnL: null, unrealizedPnLPercentage: null }),
    ]));
  });

  it('marks aggregate valuation incomplete and withholds portfolio PnL when a holding is unpriced', () => {
    const holdings = buildHoldingsFromTransactions(transactions, {
      BTC: { priceUsd: 110, change24h: 2 },
      ETH: null,
    });

    expect(summarizeHoldings(holdings)).toMatchObject({
      totalValueUsd: 110,
      totalInvestedUsd: 120,
      totalProfitLossUsd: null,
      totalProfitLossPercentage: null,
      change24hUsd: null,
      change24hPercentage: null,
      holdingsCount: 2,
      unpricedHoldingsCount: 1,
      isValuationComplete: false,
    });
  });

  it('keeps realized PnL available independently of live quote completeness', () => {
    const holdings = buildHoldingsFromTransactions(transactions, { BTC: null, ETH: null });

    expect(summarizeHoldings(holdings, 17)).toMatchObject({ realizedProfitLossUsd: 17, totalProfitLossUsd: null });
  });

  it('preserves sub-cent values in portfolio totals and PnL calculations', () => {
    const smallPosition = buildHoldingsFromTransactions([{
      id: 'small-buy', coinId: 'smol', symbol: 'SMOL', name: 'Small Token', type: 'BUY', amount: 1,
      pricePerCoin: 0.00001234, totalAmount: 0.00001234, fee: 0,
      executedAt: '2026-10-01T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z',
    }], { SMOL: { priceUsd: 0.00001234, change24h: 1 } });

    expect(summarizeHoldings(smallPosition)).toMatchObject({
      totalValueUsd: 0.00001234,
      totalInvestedUsd: 0.00001234,
      totalProfitLossUsd: 0,
      change24hUsd: 0.00000012,
    });
  });
});
