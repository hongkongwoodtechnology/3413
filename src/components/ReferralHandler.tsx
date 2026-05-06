
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useLanguage } from "./LanguageProvider";
import { ShieldCheck } from "lucide-react";

export function ReferralHandler() {
    const searchParams = useSearchParams();
    const { connected, publicKey } = useWallet();
    const { t } = useLanguage();
    
    const [pendingReferrer, setPendingReferrer] = useState<string | null>(null);
    const [isBinding, setIsBinding] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // 1. Capture URL param and store in sessionStorage
    useEffect(() => {
        const ref = searchParams.get('ref');
        if (ref) {
            // Basic validation: Check if it looks like an address (simple length check for now)
            if (ref.length > 20) { 
                sessionStorage.setItem('pendingReferrer', ref);
                setPendingReferrer(ref);
            }
        } else {
            // Restore from session if not in URL (e.g. after reload)
            const stored = sessionStorage.getItem('pendingReferrer');
            if (stored) setPendingReferrer(stored);
        }
    }, [searchParams]);

    // 2. Check for binding opportunity when wallet connects
    useEffect(() => {
        if (connected && publicKey && pendingReferrer) {
            // Don't bind if self-referring
            if (pendingReferrer === publicKey.toBase58()) return;

            // Check if already bound (Simulated on-chain check)
            const alreadyBound = localStorage.getItem(`bound_referrer_${publicKey.toBase58()}`);
            if (!alreadyBound) {
                // 自動觸發綁定，不再彈出確認視窗
                autoBindReferral(pendingReferrer, publicKey.toBase58());
            }
        }
    }, [connected, publicKey, pendingReferrer]);

    const autoBindReferral = async (referrer: string, referee: string) => {
        setIsBinding(true);
        
        try {
            // 呼叫後端 API 記錄推薦關係
            const res = await fetch('/api/referral', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    address: referrer, // 推薦人的地址
                    newRefereeAddress: referee // 被推薦人（目前登入的使用者）的地址
                })
            });

            if (!res.ok) throw new Error('Failed to bind referral');

            // Success
            localStorage.setItem(`bound_referrer_${referee}`, referrer);
            sessionStorage.removeItem('pendingReferrer');
            
            setIsBinding(false);
            setShowSuccess(true);
            
            // Hide success toast after 5s
            setTimeout(() => setShowSuccess(false), 5000);
        } catch (error) {
            console.error('Error auto-binding referral:', error);
            setIsBinding(false);
        }
    };

    return (
        <>
            {/* Success Toast */}
            {showSuccess && (
                <div className="fixed top-24 right-4 z-[100] bg-success/10 border border-success/20 text-success px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right fade-in duration-500 flex items-center gap-3 backdrop-blur-md">
                    <div className="bg-success/20 p-2 rounded-full">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                        <h4 className="font-bold text-lg">{t('referral.welcome.success')}</h4>
                    </div>
                </div>
            )}
        </>
    );
}
