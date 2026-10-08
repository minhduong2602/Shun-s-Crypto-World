import { describe, expect, it } from 'vitest';
import { formatAlertUsdPrice } from '../../supabase/functions/_shared/telegram-alert-message';

describe('formatAlertUsdPrice', () => {
  it('preserves fractional token prices instead of rounding them to zero', () => {
    expect(formatAlertUsdPrice(0.00001234)).toBe('$0.00001234');
  });

  it('uses scientific notation for prices below the supported decimal precision', () => {
    expect(formatAlertUsdPrice(0.000000001234)).toBe('$1.234e-9');
  });

  it('keeps normal USD prices grouped and rounded to cents', () => {
    expect(formatAlertUsdPrice(12345.678)).toBe('$12,345.68');
  });
});
