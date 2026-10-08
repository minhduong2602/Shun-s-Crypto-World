import { describe, expect, it, vi } from 'vitest';
import { claimAlertDelivery } from '@/supabase/functions/_shared/claim-delivery';

describe('claimAlertDelivery', () => {
  it('claims a retry through the atomic database RPC with the observed quote', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    const claimed = await claimAlertDelivery({ rpc }, {
      ownerId: 'owner-1',
      alertId: 'alert-1',
      bucketKey: 'alert-1:123',
      price: 100,
      change24h: 2.5,
    });

    expect(claimed).toBe(true);
    expect(rpc).toHaveBeenCalledWith('claim_alert_delivery', {
      p_owner_id: 'owner-1',
      p_alert_id: 'alert-1',
      p_bucket_key: 'alert-1:123',
      p_observed_price_usd: 100,
      p_observed_change_24h: 2.5,
    });
  });

  it('does not claim a delivery already owned by another cron run', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });

    await expect(claimAlertDelivery({ rpc }, {
      ownerId: 'owner-1', alertId: 'alert-1', bucketKey: 'alert-1:123', price: 100, change24h: 2.5,
    })).resolves.toBe(false);
  });

  it('surfaces database claim errors so the scheduler can retry', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('database unavailable') });

    await expect(claimAlertDelivery({ rpc }, {
      ownerId: 'owner-1', alertId: 'alert-1', bucketKey: 'alert-1:123', price: 100, change24h: 2.5,
    })).rejects.toThrow('database unavailable');
  });
});
