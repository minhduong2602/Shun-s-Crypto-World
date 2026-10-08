export function formatAlertUsdPrice(price: number): string {
  if (!Number.isFinite(price)) return 'N/A';
  if (price > 0 && price < 1e-8) {
    return `$${price.toExponential(3).replace(/\.0+e/, 'e').replace(/(\.\d*?)0+e/, '$1e')}`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: price >= 1 ? 2 : 12,
  }).format(price);
}
