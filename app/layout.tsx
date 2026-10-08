import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: "Shun's Crypto World | Personal Crypto Portfolio & AI Intelligence",
  description: "Personal crypto portfolio tracker for Shun's Crypto World with real-time CoinMarketCap-style analytics, view-only multi-chain wallet tracking, Gemini AI market intelligence, and Telegram price alert triggers.",
  openGraph: {
    title: "Shun's Crypto World | Personal Crypto Portfolio & AI Intelligence",
    description: "Personal crypto portfolio tracker for Shun's Crypto World with real-time CoinMarketCap-style analytics, view-only multi-chain wallet tracking, Gemini AI market intelligence, and Telegram price alert triggers.",
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Shun's Crypto World | Personal Crypto Portfolio & AI Intelligence",
    description: "Personal crypto portfolio tracker for Shun's Crypto World with real-time CoinMarketCap-style analytics, view-only multi-chain wallet tracking, Gemini AI market intelligence, and Telegram price alert triggers.",
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="vi" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
