import type { SupabaseClient } from '@supabase/supabase-js';
import type { Holding, MarketTicker, PortfolioSummary, Transaction, TransactionType } from '@/lib/types';
import { getLiveTickers } from '@/lib/market-service';

type TransactionRow = {
  id: string;
  symbol: string;
  name: string;
  type: TransactionType;
  amount: number | string;
  price_per_coin: number | string;
  total_amount: number | string;
  fee: number | string;
  wallet_id: string | null;
  tx_hash: string | null;
  executed_at: string;
  notes: string | null;
  created_at: string;
};

function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    coinId: row.symbol.toLowerCase(),
    symbol: row.symbol,
    name: row.name,
    type: row.type,
    amount: Number(row.amount),
    pricePerCoin: Number(row.price_per_coin),
    totalAmount: Number(row.total_amount),
    fee: Number(row.fee),
    walletId: row.wallet_id ?? undefined,
    txHash: row.tx_hash ?? undefined,
    executedAt: row.executed_at,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

export async function listTransactions(client: SupabaseClient, ownerId: string) {
  const pageSize = 500;
  const rows: TransactionRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client.from('portfolio_transactions')
      .select('*')
      .eq('owner_id', ownerId)
      .order('executed_at', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as TransactionRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows.map(mapTransaction);
}

export function hasSufficientTransactionBalances(transactions: Transaction[]): boolean {
  const balances = new Map<string, number>();
  const ordered = [...transactions].sort((a, b) => a.executedAt.localeCompare(b.executedAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  for (const transaction of ordered) {
    const symbol = transaction.symbol.toUpperCase();
    const balance = balances.get(symbol) ?? 0;
    const outgoing = transaction.type === 'SELL' || transaction.type === 'TRANSFER_OUT';
    if (outgoing && transaction.amount > balance + 1e-10) return false;
    balances.set(symbol, balance + (outgoing ? -transaction.amount : transaction.amount));
  }
  return true;
}

export function calculateRealizedProfitLoss(transactions: Transaction[]): number {
  const positions = new Map<string, { amount: number; cost: number }>();
  let realizedProfitLoss = 0;
  const ordered = [...transactions].sort((left, right) => left.executedAt.localeCompare(right.executedAt)
    || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));

  for (const transaction of ordered) {
    const symbol = transaction.symbol.toUpperCase();
    const position = positions.get(symbol) ?? { amount: 0, cost: 0 };
    if (transaction.type === 'BUY' || transaction.type === 'TRANSFER_IN') {
      position.amount += transaction.amount;
      position.cost += transaction.totalAmount;
    } else if (position.amount > 0) {
      const removedAmount = Math.min(position.amount, transaction.amount);
      const removedCost = (position.cost * removedAmount) / position.amount;
      if (transaction.type === 'SELL') {
        const allocatedFee = transaction.fee * (removedAmount / transaction.amount);
        realizedProfitLoss += removedAmount * transaction.pricePerCoin - allocatedFee - removedCost;
      }
      position.amount -= removedAmount;
      position.cost = Math.max(0, position.cost - removedCost);
    }
    positions.set(symbol, position);
  }

  return Number(realizedProfitLoss.toFixed(8));
}

export function transactionToRow(ownerId: string, input: {
  symbol: string;
  name: string;
  type: TransactionType;
  amount: number;
  pricePerCoin: number;
  fee: number;
  walletId?: string;
  txHash?: string;
  executedAt: string;
  notes?: string;
}) {
  return {
    owner_id: ownerId,
    symbol: input.symbol.trim().toUpperCase(),
    name: input.name.trim(),
    type: input.type,
    amount: input.amount,
    price_per_coin: input.pricePerCoin,
    fee: input.fee,
    total_amount: Number((input.amount * input.pricePerCoin + input.fee).toFixed(8)),
    wallet_id: input.walletId || null,
    tx_hash: input.txHash || null,
    executed_at: input.executedAt,
    notes: input.notes?.trim() || null,
  };
}

export function buildHoldingsFromTransactions(
  transactions: Transaction[],
  quotes: Record<string, { priceUsd: number; change24h: number; name?: string } | null>
): Holding[] {
  const positions = new Map<string, { coinId: string; symbol: string; name: string; amount: number; cost: number; notes?: string; updatedAt: string }>();
  for (const tx of transactions) {
    const symbol = tx.symbol.toUpperCase();
    const position = positions.get(symbol) ?? { coinId: tx.coinId, symbol, name: tx.name, amount: 0, cost: 0, notes: tx.notes, updatedAt: tx.executedAt };
    const increasesPosition = tx.type === 'BUY' || tx.type === 'TRANSFER_IN';
    if (increasesPosition) {
      position.amount += tx.amount;
      position.cost += tx.totalAmount;
    } else if (position.amount > 0) {
      const removedAmount = Math.min(position.amount, tx.amount);
      position.cost = Math.max(0, position.cost - (position.cost * removedAmount) / position.amount);
      position.amount -= removedAmount;
    }
    if (tx.notes !== undefined) position.notes = tx.notes;
    position.updatedAt = tx.executedAt;
    positions.set(symbol, position);
  }

  const openPositions = [...positions.values()].filter((position) => position.amount > 0);
  const values = openPositions.map((position) => {
    const quote = quotes[position.symbol];
    const validPrice = quote && Number.isFinite(quote.priceUsd) && quote.priceUsd > 0 ? quote.priceUsd : null;
    const priceAvailable = validPrice !== null;
    const currentPrice = validPrice;
    const currentValue = validPrice === null ? null : position.amount * validPrice;
    const unrealizedPnL = currentValue === null ? null : currentValue - position.cost;
    return {
      id: `h-${position.symbol.toLowerCase()}`,
      coinId: position.coinId,
      symbol: position.symbol,
      name: quote?.name ?? position.name,
      amount: Number(position.amount.toFixed(8)),
      avgBuyPrice: position.amount > 0 ? Number((position.cost / position.amount).toFixed(8)) : 0,
      totalInvested: Number(position.cost.toFixed(8)),
      currentPrice,
      currentValue: currentValue === null ? null : Number(currentValue.toFixed(8)),
      priceChange24h: quote && Number.isFinite(quote.change24h) && priceAvailable ? quote.change24h : null,
      priceAvailable,
      unrealizedPnL: unrealizedPnL === null ? null : Number(unrealizedPnL.toFixed(8)),
      unrealizedPnLPercentage: unrealizedPnL !== null && position.cost > 0 ? Number(((unrealizedPnL / position.cost) * 100).toFixed(4)) : null,
      allocationPercentage: 0,
      sparkline7d: [],
      notes: position.notes,
      updatedAt: position.updatedAt,
    } satisfies Holding;
  });
  const portfolioValue = values.reduce((sum, holding) => sum + (holding.currentValue ?? 0), 0);
  return values.map((holding) => ({
    ...holding,
    allocationPercentage: holding.currentValue !== null && portfolioValue > 0 ? Number(((holding.currentValue / portfolioValue) * 100).toFixed(2)) : 0,
  })).sort((left, right) => Number(right.priceAvailable) - Number(left.priceAvailable) || (right.currentValue ?? 0) - (left.currentValue ?? 0));
}

export async function getLiveHoldings(client: SupabaseClient, ownerId: string): Promise<Holding[]> {
  return (await getLivePortfolio(client, ownerId)).holdings;
}

export async function getLivePortfolio(client: SupabaseClient, ownerId: string) {
  const transactions = await listTransactions(client, ownerId);
  const chronologicalTransactions = [...transactions].sort((a, b) =>
    a.executedAt.localeCompare(b.executedAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const symbols = [...new Set(transactions.map((transaction) => transaction.symbol))];
  const quotes = await getPortfolioQuotes(symbols);
  return {
    holdings: buildHoldingsFromTransactions(chronologicalTransactions, quotes),
    realizedProfitLossUsd: calculateRealizedProfitLoss(transactions),
    transactions,
  };
}

export async function getPortfolioQuotes(
  symbols: string[],
  loadSnapshot: () => Promise<MarketTicker[]> = getLiveTickers,
): Promise<Record<string, { priceUsd: number; change24h: number; name?: string } | null>> {
  const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
  if (uniqueSymbols.length === 0) return {};

  const requested = new Set(uniqueSymbols);
  const tickers = await loadSnapshot();
  const tickerBySymbol = new Map(tickers
    .filter((ticker) => requested.has(ticker.symbol.toUpperCase()) && Number.isFinite(ticker.priceUsd) && ticker.priceUsd > 0)
    .map((ticker) => [ticker.symbol.toUpperCase(), ticker] as const));

  return Object.fromEntries(uniqueSymbols.map((symbol) => {
    const ticker = tickerBySymbol.get(symbol);
    return [symbol, ticker ? {
      priceUsd: ticker.priceUsd,
      change24h: ticker.priceChange24h,
      name: ticker.name,
    } : null];
  }));
}

export function summarizeHoldings(holdings: Holding[], realizedProfitLossUsd = 0): PortfolioSummary {
  type PricedHolding = Holding & { currentPrice: number; currentValue: number; unrealizedPnLPercentage: number };
  const isPriced = (holding: Holding): holding is PricedHolding => holding.priceAvailable !== false && holding.currentPrice !== null && holding.currentValue !== null && holding.unrealizedPnLPercentage !== null;
  const pricedHoldings = holdings.filter(isPriced);
  const isValuationComplete = pricedHoldings.length === holdings.length;
  const hasComplete24h = isValuationComplete && holdings.every((holding) => holding.priceChange24h !== null);
  const unpricedHoldingsCount = holdings.length - pricedHoldings.length;
  const totalValueUsd = pricedHoldings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalInvestedUsd = holdings.reduce((sum, holding) => sum + holding.totalInvested, 0);
  const totalProfitLossUsd = isValuationComplete ? totalValueUsd - totalInvestedUsd : null;
  const change24hUsd = hasComplete24h ? pricedHoldings.reduce((sum, holding) => sum + ((holding.currentValue * (holding.priceChange24h ?? 0)) / 100), 0) : null;
  const byGain = [...pricedHoldings].sort((left, right) => left.unrealizedPnLPercentage - right.unrealizedPnLPercentage);
  return {
    totalValueUsd: Number(totalValueUsd.toFixed(8)),
    totalInvestedUsd: Number(totalInvestedUsd.toFixed(8)),
    totalProfitLossUsd: totalProfitLossUsd === null ? null : Number(totalProfitLossUsd.toFixed(8)),
    totalProfitLossPercentage: totalProfitLossUsd === null ? null : totalInvestedUsd > 0 ? Number(((totalProfitLossUsd / totalInvestedUsd) * 100).toFixed(2)) : 0,
    realizedProfitLossUsd: Number(realizedProfitLossUsd.toFixed(8)),
    change24hUsd: change24hUsd === null ? null : Number(change24hUsd.toFixed(8)),
    change24hPercentage: change24hUsd === null ? null : totalValueUsd > 0 ? Number(((change24hUsd / totalValueUsd) * 100).toFixed(2)) : 0,
    holdingsCount: holdings.length,
    unpricedHoldingsCount,
    isValuationComplete,
    bestPerformer: isValuationComplete && byGain.length ? { symbol: byGain.at(-1)!.symbol, gainPercentage: byGain.at(-1)!.unrealizedPnLPercentage } : undefined,
    worstPerformer: isValuationComplete && byGain.length ? { symbol: byGain[0].symbol, gainPercentage: byGain[0].unrealizedPnLPercentage } : undefined,
  };
}
