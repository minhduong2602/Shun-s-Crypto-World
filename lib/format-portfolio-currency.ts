export function formatPortfolioCurrency(valueUsd: number, currency = 'USD', usdVndRate?: number | null) {
  if (!Number.isFinite(valueUsd)) return '—';

  const isVnd = currency === 'VND';
  if (isVnd && (!Number.isFinite(usdVndRate) || (usdVndRate ?? 0) <= 0)) return '—';
  const value = isVnd ? valueUsd * usdVndRate! : valueUsd;
  const absValue = Math.abs(value);
  if (!isVnd && absValue > 0 && absValue < 1e-8) {
    return `${value < 0 ? '-$' : '$'}${absValue.toExponential(3).replace(/\.0+e/, 'e').replace(/(\.\d*?)0+e/, '$1e')}`;
  }

  const minimumFractionDigits = isVnd
    ? (absValue > 0 && absValue < 1 ? 2 : 0)
    : 2;
  const maximumFractionDigits = isVnd
    ? (absValue > 0 && absValue < 1 ? 2 : 0)
    : absValue >= 1 ? 2 : Math.min(12, Math.max(2, Math.ceil(-Math.log10(absValue)) + 4));

  return new Intl.NumberFormat(isVnd ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: isVnd ? 'VND' : 'USD',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}
