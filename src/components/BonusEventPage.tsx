import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { CheckCircle2, Gift, Loader2, AlertCircle, ChevronRight, Trophy } from 'lucide-react';
import { mintTrialTokens } from '@/lib/solana';
import { useLanguage } from './LanguageProvider';

export function BonusEventPage() {
    const { connected, publicKey, signTransaction } = useWallet();
    const { t } = useLanguage();
    
    const [totalBetAmount, setTotalBetAmount] = useState<number>(0);
    const [isClaimed, setIsClaimed] = useState<boolean>(false);
    const [isClaiming, setIsClaiming] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<number>(1); // 1: Check, 2: Terms, 3: Claim, 4: Success

    const TARGET_AMOUNT = 3.0;
    const BONUS_AMOUNT = 100.0;

    // Simulate fetching total bet amount from backend
    useEffect(() => {
        if (connected && publicKey) {
            // Mock backend call
            const fetchUserStats = async () => {
                // In production, this would be: await fetch(`/api/users/${publicKey.toBase58()}/stats`)
                setTimeout(() => {
                    setTotalBetAmount(3.5); // Mocked: user has bet $3.5
                    
                    // Check if already claimed from local storage (mock DB)
                    const claimedStatus = localStorage.getItem(`bonus_claimed_${publicKey.toBase58()}`);
                    if (claimedStatus === 'true') {
                        setIsClaimed(true);
                        setStep(4);
                    }
                }, 800);
            };
            fetchUserStats();
        }
    }, [connected, publicKey]);

    const progressPercentage = Math.min((totalBetAmount / TARGET_AMOUNT) * 100, 100);
    const isEligible = totalBetAmount >= TARGET_AMOUNT;

    const handleClaim = async () => {
        if (!connected || !publicKey || !signTransaction) {
            setError(t('bonus.error.connect'));
            return;
        }

        setIsClaiming(true);
        setError(null);

        try {
            // 1. Backend Validation (Mocked)
            // await fetch('/api/bonus/validate', { method: 'POST', body: JSON.stringify({ user: publicKey.toBase58() }) });

            // 2. Blockchain Transaction (Mint 100 Trial Tokens)
            const txSignature = await mintTrialTokens(publicKey, signTransaction, BONUS_AMOUNT);
            
            if (txSignature) {
                // 3. Backend Record Update (Mocked)
                localStorage.setItem(`bonus_claimed_${publicKey.toBase58()}`, 'true');
                setIsClaimed(true);
                setStep(4);
            } else {
                throw new Error("Transaction failed or rejected.");
            }
        } catch (err: any) {
            console.error("Claim Error:", err);
            setError(err.message || t('bonus.error.fail'));
        } finally {
            setIsClaiming(false);
        }
    };

    return (
        <div className="min-h-[80vh] py-12 px-4 flex items-center justify-center">
            <div className="max-w-3xl w-full">
                
                {/* Hero Section */}
                <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="inline-flex items-center justify-center p-4 bg-primary-purple/10 rounded-full mb-6 relative">
                        <div className="absolute inset-0 bg-primary-purple/20 blur-xl rounded-full"></div>
                        <Gift className="w-12 h-12 text-primary-purple relative z-10" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
                        {t('bonus.title.deposit')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-purple to-primary-blue">$3</span>
                        <br />
                        {t('bonus.title.get')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">$100</span> {t('bonus.title.free')}
                    </h1>
                    <p className="text-neutral-400 text-lg max-w-xl mx-auto">
                        {t('bonus.desc')}
                    </p>
                </div>

                {!connected ? (
                    <div className="bg-neutral-800/50 backdrop-blur-sm border border-neutral-700 p-8 rounded-3xl text-center">
                        <Trophy className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">{t('bonus.connect.title')}</h3>
                        <p className="text-neutral-400 mb-6">{t('bonus.connect.desc')}</p>
                        {/* Wallet button is handled in the header */}
                        <div className="inline-block px-6 py-3 bg-neutral-700 text-white rounded-xl font-medium">
                            {t('bonus.connect.btn')}
                        </div>
                    </div>
                ) : (
                    <div className="bg-neutral-900 border border-neutral-800 shadow-2xl rounded-3xl overflow-hidden">
                        
                        {/* Progress Bar Section */}
                        <div className="p-8 border-b border-neutral-800 bg-neutral-800/20">
                            <div className="flex justify-between items-end mb-4">
                                <div>
                                    <div className="text-sm text-neutral-400 font-medium mb-1">{t('bonus.progress.title')}</div>
                                    <div className="text-2xl font-bold text-white">
                                        ${totalBetAmount.toFixed(2)} <span className="text-neutral-500 text-lg">/ ${TARGET_AMOUNT.toFixed(2)}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {isEligible ? (
                                        <div className="inline-flex items-center gap-1.5 text-green-400 bg-green-400/10 px-3 py-1 rounded-full text-sm font-bold">
                                            <CheckCircle2 className="w-4 h-4" /> {t('bonus.progress.reached')}
                                        </div>
                                    ) : (
                                        <div className="text-primary-purple font-bold text-sm">
                                            {t('bonus.progress.remaining').replace('${amount}', `$${(TARGET_AMOUNT - totalBetAmount).toFixed(2)}`)}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="h-4 bg-neutral-800 rounded-full overflow-hidden relative">
                                <div 
                                    className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out ${isEligible ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-primary-purple to-primary-blue'}`}
                                    style={{ width: `${progressPercentage}%` }}
                                >
                                    {isEligible && (
                                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Claim Flow */}
                        <div className="p-8">
                            {step === 4 ? (
                                // Success State
                                <div className="text-center py-8 animate-in zoom-in-95 duration-500">
                                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <CheckCircle2 className="w-10 h-10 text-green-500" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">{t('bonus.step4.title')}</h3>
                                    <p className="text-neutral-400 max-w-md mx-auto mb-8">
                                        {t('bonus.step4.desc')}
                                    </p>
                                    <button 
                                        onClick={() => window.location.reload()}
                                        className="px-8 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition-colors"
                                    >
                                        {t('bonus.step4.btn.go')}
                                    </button>
                                </div>
                            ) : (
                                // Multi-step Flow
                                <div className="space-y-8">
                                    {/* Steps Indicator */}
                                    <div className="flex items-center justify-center gap-2 mb-8">
                                        <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-primary-purple' : 'bg-neutral-800'}`}></div>
                                        <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-primary-purple' : 'bg-neutral-800'}`}></div>
                                        <div className={`h-2 flex-1 rounded-full ${step >= 3 ? 'bg-primary-purple' : 'bg-neutral-800'}`}></div>
                                    </div>

                                    {step === 1 && (
                                        <div className="text-center py-4 animate-in fade-in duration-300">
                                            <h3 className="text-xl font-bold text-white mb-4">{t('bonus.step1.title')}</h3>
                                            <p className="text-neutral-400 mb-8">{t('bonus.step1.desc')}</p>
                                            
                                            <button 
                                                onClick={() => setStep(2)}
                                                disabled={!isEligible}
                                                className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                                                    isEligible 
                                                    ? 'bg-primary-purple hover:bg-primary-purple/90 text-white shadow-lg shadow-primary-purple/25' 
                                                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                                }`}
                                            >
                                                {isEligible ? t('bonus.step1.btn.continue') : t('bonus.step1.btn.not_reached')}
                                                {isEligible && <ChevronRight className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    )}

                                    {step === 2 && (
                                        <div className="text-center py-4 animate-in slide-in-from-right-8 duration-300">
                                            <h3 className="text-xl font-bold text-white mb-4">{t('bonus.step2.title')}</h3>
                                            <div className="bg-neutral-800/50 p-4 rounded-xl text-left text-sm text-neutral-400 mb-8 h-32 overflow-y-auto custom-scrollbar">
                                                <ul className="list-disc pl-5 space-y-2">
                                                    <li>{t('bonus.step2.li1')}</li>
                                                    <li>{t('bonus.step2.li2')}</li>
                                                    <li>{t('bonus.step2.li3')}</li>
                                                    <li>{t('bonus.step2.li4')}</li>
                                                </ul>
                                            </div>
                                            
                                            <div className="flex gap-4">
                                                <button 
                                                    onClick={() => setStep(1)}
                                                    className="w-1/3 py-4 rounded-xl font-bold text-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-all"
                                                >
                                                    {t('bonus.step2.btn.back')}
                                                </button>
                                                <button 
                                                    onClick={() => setStep(3)}
                                                    className="w-2/3 py-4 rounded-xl font-bold text-lg bg-primary-purple hover:bg-primary-purple/90 text-white shadow-lg shadow-primary-purple/25 transition-all flex items-center justify-center gap-2"
                                                >
                                                    {t('bonus.step2.btn.agree')}
                                                    <ChevronRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {step === 3 && (
                                        <div className="text-center py-4 animate-in slide-in-from-right-8 duration-300">
                                            <h3 className="text-xl font-bold text-white mb-4">{t('bonus.step3.title')}</h3>
                                            <p className="text-neutral-400 mb-8">{t('bonus.step3.desc')}</p>
                                            
                                            {error && (
                                                <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-xl flex items-start gap-3 text-left">
                                                    <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                                                    <p className="text-error text-sm">{error}</p>
                                                </div>
                                            )}

                                            <div className="flex gap-4">
                                                <button 
                                                    onClick={() => setStep(2)}
                                                    disabled={isClaiming}
                                                    className="w-1/3 py-4 rounded-xl font-bold text-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-all disabled:opacity-50"
                                                >
                                                    {t('bonus.step2.btn.back')}
                                                </button>
                                                <button 
                                                    onClick={handleClaim}
                                                    disabled={isClaiming}
                                                    className="w-2/3 py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white shadow-lg shadow-green-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                                >
                                                    {isClaiming ? (
                                                        <><Loader2 className="w-5 h-5 animate-spin" /> {t('bonus.step3.btn.processing')}</>
                                                    ) : (
                                                        <><Gift className="w-5 h-5" /> {t('bonus.step3.btn.claim')}</>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}