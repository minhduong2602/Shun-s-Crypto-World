import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { db } from '@/lib/db/store';
import { generateBase32Secret, generateTotpUri } from '@/lib/crypto-totp';

export async function POST() {
  try {
    const secret = generateBase32Secret(20);
    const otpUri = generateTotpUri('minhduong.sg1994@gmail.com', "Shun's Crypto World", secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpUri, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 260,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    // Save temporary secret to settings
    db.updateSettings({ twoFactorSecret: secret });

    return NextResponse.json({
      secret,
      otpUri,
      qrCodeDataUrl,
      accountName: 'minhduong.sg1994@gmail.com',
      issuer: "Shun's Crypto World",
      instructions: 'Quét mã QR bằng ứng dụng Google Authenticator, Authy hoặc nhập thủ công khóa Secret 32 ký tự.',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Không thể tạo mã 2FA: ' + String(error) }, { status: 500 });
  }
}
