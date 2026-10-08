import { PublicKey } from '@solana/web3.js';

export interface SolanaTokenMetadata {
  mint: string;
  name: string;
  symbol: string;
}

export function parseMetaplexTokenMetadata(base64Data: string): SolanaTokenMetadata | null {
  const data = Buffer.from(base64Data, 'base64');
  if (data.length < 66 || data[0] !== 4) return null;

  let offset = 65;
  const readString = () => {
    if (offset + 4 > data.length) return null;
    const length = data.readUInt32LE(offset);
    offset += 4;
    if (length > 1024 || offset + length > data.length) return null;
    const value = data.toString('utf8', offset, offset + length).replaceAll('\0', '').trim();
    offset += length;
    return value;
  };

  const mint = new PublicKey(data.subarray(33, 65)).toBase58();
  const name = readString();
  const symbol = readString();
  if (name === null || symbol === null || (!name && !symbol)) return null;
  return { mint, name, symbol: symbol.toUpperCase() };
}
