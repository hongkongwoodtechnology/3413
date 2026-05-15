"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useLanguage } from "./LanguageProvider";
import { ShieldCheck } from "lucide-react";
import {
    getBoundReferrerStorageKey,
    resolvePreferredWalletAddress,
} from "@/lib/wallets";

function getPreferredReferralAddress(walletAdapterAddress?: string | null): string | null {
    const phantomProviderAddress =
        typeof window !== "undefined"
            ? (window as any).phantom?.solana?.publicKey?.toBase58?.() ?? null
            : null;

    return resolvePreferredWalletAddress(walletAdapterAddress ?? null, phantomProviderAddress);
}

export function ReferralHandler() {
    const searchParams = useSearchParams();
    const { connected, publicKey } = useWallet();
    const { t } = useLanguage();
    
    const [pendingReferrer, setPendingReferrer] = useState<string | null>(null);
    const [isBinding, setIsBinding] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        const ref = searchParams.get('ref');
        if (ref) {
            if (ref.length > 20) { 
                sessionStorage.setItem('pendingReferrer', ref);
                setPendingReferrer(ref);
            }
        } else {
            const stored = sessionStorage.getItem('pendingReferrer');
            if (stored) setPendingReferrer(stored);
        }
    }, [searchParams]);

    useEffect(() => {
        const preferredAddress = getPreferredReferralAddress(publicKey?.toBase58() ?? null);

        if (connected && preferredAddress && pendingReferrer) {
            if (pendingReferrer === preferredAddress) return;

            const alreadyBound = localStorage.getItem(
                getBoundReferrerStorageKey(preferredAddress)
            );

            if (!alreadyBound) {
                autoBindReferral(pendingReferrer, preferredAddress);
            }
        }
    }, [connected, publicKey, pendingReferrer]);

    const autoBindReferral = async (referrer: string, referee: string) => {
        setIsBinding(true);
        
        try {
            const res = await fetch('/api/referral', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    address: referrer,
                    newRefereeAddress: referee
                })
            });

            if (!res.ok) throw new Error('Failed to bind referral');

            localStorage.setItem(getBoundReferrerStorageKey(referee), referrer);
            sessionStorage.removeItem('pendingReferrer');
            
            setIsBinding(false);
            setShowSuccess(true);
            
            setTimeout(() => setShowSuccess(false), 5000);
        } catch (error) {
            console.error('Error auto-binding referral:', error);
            setIsBinding(false);
        }
    };

    return (
        <>
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
