import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import { LanguageProvider } from "@/components/LanguageProvider";

/*
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
*/

export const metadata: Metadata = {
  title: "PolyBall",
  description: "Decentralized sports prediction market on Solana",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "PolyBall",
      url: "https://polyball.xyz",
      applicationCategory: "FinanceApplication",
      operatingSystem: "All",
      description: "Decentralized sports prediction market on Solana",
    },
    {
      "@type": "SportsEvent",
      name: "World Cup 2026",
      description: "Bet on World Cup matches securely using Web3 technology.",
      sport: "Soccer",
      location: {
        "@type": "Place",
        name: "Global",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`antialiased`}
      >
        <LanguageProvider>
          <WalletContextProvider>
            {children}
          </WalletContextProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
