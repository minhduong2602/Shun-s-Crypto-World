import type { ChainType } from '@/lib/types';

export function validateAddress(chain: ChainType, address: string): { isValid: boolean; error?: string } {
  const clean = address.trim();

  if (!clean) return { isValid: false, error: 'Địa chỉ ví không được để trống' };

  if (['ETH', 'BSC', 'POLYGON', 'ARBITRUM', 'BASE'].includes(chain) && !/^0x[a-fA-F0-9]{40}$/.test(clean)) {
    return {
      isValid: false,
      error: `Địa chỉ ${chain} không hợp lệ. Phải bắt đầu bằng 0x và có đúng 42 ký tự (VD: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045)`,
    };
  }

  if (chain === 'SOL' && !/^[1-9A-HJ-NP-za-km-z]{32,44}$/.test(clean)) {
    return {
      isValid: false,
      error: 'Địa chỉ Solana không hợp lệ. Phải là chuỗi Base58 từ 32-44 ký tự (VD: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU)',
    };
  }

  if (chain === 'BTC' && !/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(clean)) {
    return {
      isValid: false,
      error: 'Địa chỉ Bitcoin không hợp lệ. Phải bắt đầu bằng 1, 3 hoặc bc1 (VD: bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq)',
    };
  }

  return { isValid: true };
}
