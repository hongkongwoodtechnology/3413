"use client"

import { useWallet } from "@solana/wallet-adapter-react"
import { WalletButton } from "@/components/WalletButton"
import { useLanguage } from "@/components/LanguageProvider"
import { Gift, ShieldCheck, TrendingUp, Users } from "lucide-react"

interface ReferralLandingPageProps {
  referrerId: string;
  onSkip: () => void;
}

export function ReferralLandingPage({ referrerId, onSkip }: ReferralLandingPageProps) {
  const { connected } = useWallet();
  const { t } = useLanguage();

  // If already connected, we don't need to show this page. The main page logic will handle it.
  if (connected) {
    return null;
  }

  // Helper to format the wallet address
  const formatAddress = (address: string) => {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-neutral-950 flex flex-col items-center justify-center overflow-y-auto px-4 py-8">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary-purple/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary-blue/20 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      </div>

      <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col items-center text-center">
        {/* Header Icon */}
        <div className="w-20 h-20 bg-gradient-to-br from-primary-purple to-primary-blue rounded-3xl flex items-center justify-center shadow-2xl shadow-primary-purple/20 mb-8 border border-white/10">
          <Gift className="w-10 h-10 text-white" />
        </div>

        {/* Title & Invitation */}
        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 mb-4">
          {t('referral.landing.title')}
        </h1>
        
        <p className="text-lg md:text-xl text-neutral-400 mb-2">
          {t('referral.landing.friend')} <span className="font-mono font-bold text-primary-blue bg-primary-blue/10 px-3 py-1 rounded-lg border border-primary-blue/20">{formatAddress(referrerId)}</span> 
        </p>
        <p className="text-lg md:text-xl text-neutral-300 mb-12">
          {t('referral.landing.desc')}
        </p>

        {/* Action Section */}
        <div className="flex flex-col items-center w-full space-y-6">
          <div className="w-full max-w-xs transform hover:scale-105 transition-transform duration-300 flex justify-center">
            <WalletButton />
          </div>
          
          <p className="text-sm text-neutral-500">
            {t('referral.landing.tos')}
          </p>
          
          <button 
            onClick={onSkip}
            className="text-neutral-400 hover:text-white transition-colors text-sm underline underline-offset-4"
          >
            {t('referral.landing.skip')}
          </button>
        </div>
      </div>
    </div>
  );
}