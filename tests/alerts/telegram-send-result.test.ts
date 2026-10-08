import { describe, expect, it } from 'vitest';
import { isTelegramSendSuccessful } from '@/supabase/functions/_shared/telegram-send-result';

describe('isTelegramSendSuccessful', () => {
  it('requires both a successful HTTP response and Telegram ok=true', () => {
    expect(isTelegramSendSuccessful(true, '{"ok":true,"result":{}}')).toBe(true);
    expect(isTelegramSendSuccessful(true, '{"ok":false,"description":"bot blocked"}')).toBe(false);
    expect(isTelegramSendSuccessful(false, '{"ok":true}')).toBe(false);
  });

  it('treats malformed or empty responses as failures', () => {
    expect(isTelegramSendSuccessful(true, 'not json')).toBe(false);
    expect(isTelegramSendSuccessful(true, '')).toBe(false);
  });
});
