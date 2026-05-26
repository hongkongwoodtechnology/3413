"use client"

import { useWallet } from "@solana/wallet-adapter-react"
import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useLanguage } from "./LanguageProvider"
import { AlertCircle, X } from "lucide-react"

const BaseWalletMultiButtonDynamic = dynamic(
  async () => {
    const mod = await import("@solana/wallet-adapter-react-ui");
    return { default: mod.BaseWalletMultiButton };
  },
  { ssr: false }
)

export const WalletButton = () => {
  const { wallet, connecting } = useWallet();
  const { t } = useLanguage();
  const [showWarning, setShowWarning] = useState(false);
  const connectingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showWarningRef = useRef(false);

  useEffect(() => {
    if (connecting) {
      showWarningRef.current = false;
      connectingTimerRef.current = setTimeout(() => {
        showWarningRef.current = true;
        setShowWarning(true);
      }, 5000);
    } else {
      if (connectingTimerRef.current) {
        clearTimeout(connectingTimerRef.current);
        connectingTimerRef.current = null;
      }
      if (showWarningRef.current) {
        showWarningRef.current = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowWarning(false);
      }
    }

    return () => {
      if (connectingTimerRef.current) {
        clearTimeout(connectingTimerRef.current);
        connectingTimerRef.current = null;
      }
    };
  }, [connecting]);

  const handleCancelConnecting = () => {
    if (wallet?.adapter) {
      wallet.adapter.disconnect().catch(() => {});
    }
    setShowWarning(false);
  };

  const LABELS = {
    'change-wallet': t('wallet.labels.change_wallet'),
    connecting: t('wallet.labels.connecting'),
    'copy-address': t('wallet.labels.copy_address'),
    copied: t('wallet.labels.copied'),
    disconnect: t('wallet.labels.disconnect'),
    'has-wallet': t('wallet.labels.has_wallet'),
    'no-wallet': t('wallet.labels.no_wallet'),
  };

  return (
    <div className="relative flex items-center shrink-0">
      {showWarning && (
        <div
          className="absolute -bottom-20 right-0 w-72 bg-neutral-800 border border-orange-500/50 shadow-xl rounded-lg p-3 text-xs text-neutral-200 z-50 animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-orange-400 mb-0.5">{t('wallet.warning.timeout')}</p>
              <p className="mb-2">{t('wallet.warning.check_unlock').replace('{wallet}', wallet?.adapter?.name || 'Phantom')}</p>
              <button
                onClick={handleCancelConnecting}
                className="w-full bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 py-1.5 rounded-md text-xs font-medium transition-colors"
              >
                {t('wallet.warning.cancel_retry')}
              </button>
            </div>
            <button
              onClick={() => setShowWarning(false)}
              className="text-neutral-500 hover:text-neutral-300 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <BaseWalletMultiButtonDynamic labels={LABELS} />
    </div>
  )
}
