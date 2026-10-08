import { describe, expect, it } from 'vitest';
import { formatPortfolioCurrency } from '@/lib/format-portfolio-currency';

describe('formatPortfolioCurrency', () => {
  it('shows fractional USD portfolio values instead of rounding them to zero', () => {
    expect(formatPortfolioCurrency(0.00001234, 'USD')).toBe('$0.00001234');
  });

  it('uses scientific notation for USD values below readable decimal precision', () => {
    expect(formatPortfolioCurrency(0.000000001234, 'USD')).toBe('$1.234e-9');
  });

  it('keeps standard currency values readable and rounded to cents', () => {
    expect(formatPortfolioCurrency(1234.567, 'USD')).toBe('$1,234.57');
  });

  it('converts USD portfolio amounts to the selected VND display currency', () => {
    expect(formatPortfolioCurrency(2, 'VND', 25_450)).toBe('50.900 ₫');
  });

  it('uses the current supplied USD/VND rate instead of the static fallback', () => {
    expect(formatPortfolioCurrency(2, 'VND', 26_000)).toBe('52.000 ₫');
  });

  it('does not present a fabricated VND conversion when no exchange rate is available', () => {
    expect(formatPortfolioCurrency(2, 'VND')).toBe('—');
  });
});
