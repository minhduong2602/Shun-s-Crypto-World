import { describe, expect, it } from 'vitest';
import { getAlertDeliveryBucket } from '@/supabase/functions/_shared/delivery-bucket';

describe('getAlertDeliveryBucket', () => {
  it('keeps a successful alert in the same cooldown for a full interval regardless of clock boundaries', () => {
    const lastSentAt = '2026-10-09T10:29:00.000Z';
    const beforeCooldown = Date.parse('2026-10-09T10:58:59.000Z');
    const afterCooldown = Date.parse('2026-10-09T10:59:00.000Z');

    expect(getAlertDeliveryBucket('alert-1', 30, beforeCooldown, lastSentAt, '2026-10-09T00:00:00.000Z'))
      .toBe(getAlertDeliveryBucket('alert-1', 30, Date.parse('2026-10-09T10:31:00.000Z'), lastSentAt, '2026-10-09T00:00:00.000Z'));
    expect(getAlertDeliveryBucket('alert-1', 30, afterCooldown, lastSentAt, '2026-10-09T00:00:00.000Z'))
      .not.toBe(getAlertDeliveryBucket('alert-1', 30, beforeCooldown, lastSentAt, '2026-10-09T00:00:00.000Z'));
  });

  it('uses the creation time as the cooldown anchor before the first successful delivery', () => {
    const createdAt = '2026-10-09T10:29:00.000Z';
    expect(getAlertDeliveryBucket('alert-2', 30, Date.parse('2026-10-09T10:30:00.000Z'), null, createdAt))
      .toBe(getAlertDeliveryBucket('alert-2', 30, Date.parse('2026-10-09T10:58:59.000Z'), null, createdAt));
  });
});
