"use client"

import { useWallet } from "@solana/wallet-adapter-react"
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useLanguage } from "./LanguageProvider"
import { AlertCircle } from "lucide-react"

const BaseWalletMultiButtonDynamic = dynamic(
  async () => {
    const mod = await import("@solana/wallet-adapter-react-ui");
    return { default: mod.BaseWalletMultiButton };
  },
  { ssr: false }
)

export const WalletButton = () => {
  const { wallet, connecting, connected } = useWallet();
  const { t } = useLanguage();
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    // 如果錢包狀態是 connecting (正在連線中)
    if (connecting) {
      // 設定 5 秒超時，如果 5 秒後還是 connecting，就跳出提示
      timeoutId = setTimeout(() => {
        setShowWarning(true);
      }, 5000);
    } else {
      // 如果已經連線成功或取消連線，隱藏警告並清除 timeout
      setShowWarning(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [connecting]);

  // 當使用者點擊警告時，隱藏它
  const dismissWarning = () => setShowWarning(false);

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
      {/* 警告氣泡 (Toast) */}
      {showWarning && (
        <div 
          className="absolute -bottom-16 right-0 w-64 bg-neutral-800 border border-orange-500/50 shadow-xl rounded-lg p-3 text-xs text-neutral-200 z-50 animate-in fade-in slide-in-from-top-2 flex items-start gap-3 cursor-pointer hover:bg-neutral-700 transition-colors"
          onClick={dismissWarning}
        >
          <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-orange-400 mb-0.5">{t('wallet.warning.timeout')}</p>
            <p>{t('wallet.warning.check_unlock').replace('{wallet}', wallet?.adapter?.name || 'Phantom')}</p>
          </div>
        </div>
      )}

      <BaseWalletMultiButtonDynamic labels={LABELS} />
    </div>
  )
}
