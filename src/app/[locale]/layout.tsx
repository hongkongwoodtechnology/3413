import type { Metadata, Viewport } from "next";
import "../globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { LANGUAGES } from "@/lib/i18n";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d111c",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = "https://polyball.xyz";
  
  // Create alternates mapping for path-based routing
  const languages: Record<string, string> = {};
  LANGUAGES.forEach(lang => {
    languages[lang.code] = `${baseUrl}/${lang.code}`;
  });

  return {
    title: {
      template: "%s | PolyBall",
      default: "PolyBall | Web3 Sports Prediction & World Cup Betting",
    },
    description: "Decentralized sports prediction market on Solana. Bet on World Cup, Premier League, and more with zero hidden fees, instant payouts, and transparent odds.",
    keywords: [
      "DeFi Sports Betting", "Solana Betting", "World Cup 2026", "Web3 Prediction Market", "Crypto Sportsbook",
      "世界盃投注", "世界盃預測", "去中心化體育博彩", "加密貨幣賭球", "世界盃", 
      "世界杯投注", "世界杯预测", "去中心化体育博彩", "加密货币赌球", "世界杯",
      "Apuestas Copa del Mundo", "Apuestas deportivas cripto",
      "Coupe du Monde paris", "Paris sportifs crypto",
      "Münze Sportwetten", "Weltmeisterschaft Wetten",
      "ワールドカップ 予想", "仮想通貨 スポーツベット",
      "월드컵 예측", "크립토 스포츠 베팅",
      "كأس العالم", "مراهنات رياضية",
      "ฟุตบอลโลก", "เดิมพันกีฬา",
      "Apostas Copa do Mundo", "Apostas esportivas cripto",
      "Чемпионат мира ставки", "Крипто ставки на спорт"
    ],
    alternates: {
      canonical: `${baseUrl}/${locale}`,
      languages,
    },
    openGraph: {
      title: "PolyBall | Web3 Sports Prediction & World Cup Betting",
      description: "Decentralized sports prediction market on Solana. Bet on World Cup and more.",
      url: `${baseUrl}/${locale}`,
      siteName: "PolyBall",
      images: [
        {
          url: `${baseUrl}/og-image.jpg`,
          width: 1200,
          height: 630,
        },
      ],
      locale: locale.replace("-", "_"),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "PolyBall | Web3 Sports Prediction",
      description: "Decentralized sports prediction market on Solana.",
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  return (
    <LanguageProvider initialLocale={locale as any}>
      <WalletContextProvider>
        {children}
      </WalletContextProvider>
    </LanguageProvider>
  );
}
