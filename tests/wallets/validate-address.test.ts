import { describe, expect, it } from 'vitest';
import { validateAddress } from '@/lib/wallets/validate-address';

describe('validateAddress', () => {
  it.each([
    ['ETH', '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'],
    ['BSC', '0x0000000000000000000000000000000000000001'],
    ['POLYGON', '0x0000000000000000000000000000000000000001'],
    ['ARBITRUM', '0x0000000000000000000000000000000000000001'],
    ['BASE', '0x0000000000000000000000000000000000000001'],
    ['SOL', '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'],
    ['BTC', 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'],
  ] as const)('accepts a valid %s public address', (chain, address) => {
    expect(validateAddress(chain, address).isValid).toBe(true);
  });

  it.each([
    ['ETH', '0x1234'],
    ['BSC', '0x1234'],
    ['POLYGON', '0x1234'],
    ['ARBITRUM', '0x1234'],
    ['BASE', '0x1234'],
    ['SOL', 'not-a-base58-address'],
    ['BTC', 'not-a-bitcoin-address'],
  ] as const)('rejects a malformed %s public address', (chain, address) => {
    expect(validateAddress(chain, address).isValid).toBe(false);
  });

  it('rejects a blank address with an actionable validation error', () => {
    expect(validateAddress('ETH', ' ').error).toBe('Địa chỉ ví không được để trống');
  });
});
