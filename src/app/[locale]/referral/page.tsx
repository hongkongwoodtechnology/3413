"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gift, Copy, Check, ExternalLink, Users, Wallet, TrendingUp, History, Twitter, MessageCircle, ArrowLeft, Edit2, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useLanguage } from "@/components/LanguageProvider";
import { WalletButton } from "@/components/WalletButton";
import { LocalizedLink as Link } from "@/components/LocalizedLink"

interface Commission {
    id: string;
    referee: string;
    betAmount: string;
    fee: string;
    commission: string;
    timestamp: string;
    status: 'pending' | 'approved' | 'settled';
}

export default function ReferralPage() {
    const { connected, publicKey } = useWallet();
    const { t, language } = useLanguage();
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'settled'>('all');
    const [timeFilter, setTimeFilter] = useState<'1d' | '3d' | '7d' | '30d' | '3m' | 'all'>('all');
    const [commissionPage, setCommissionPage] = useState(1);
    const commissionsPerPage = 8;
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [withdrawSuccess, setWithdrawSuccess] = useState(false);
    
    // Add pagination state for referrees
    const [refereePage, setRefereePage] = useState(1);
    const refereesPerPage = 10;
    
    // Add custom names state
    const [customNames, setCustomNames] = useState<Record<string, string>>({});
    const [editingRefId, setEditingRefId] = useState<string | null>(null);
    const [editNameInput, setEditNameInput] = useState('');
    
    // Sorting state
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | null>(null);
    const [sortColumn, setSortColumn] = useState<'earned' | 'volume' | 'date' | null>(null);
    const [mounted, setMounted] = useState(false);

    // Data fetching state
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [referralData, setReferralData] = useState<{
        stats: any;
        commissions: Commission[];
        referees: any[];
        balances: { usdt: number; bonus: number };
        commissionRate: number;
    } | null>(null);

    // Fetch data from API
    const fetchReferralData = async () => {
        if (!connected || !publicKey) {
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            const res = await fetch(`/api/referral?address=${publicKey.toBase58()}`);
            if (!res.ok) throw new Error('Failed to fetch referral data');
            const { data } = await res.json();
            setReferralData({
                stats: data.stats,
                commissions: data.commissions,
                referees: data.referees,
                balances: data.balances || { usdt: 0, bonus: 0 },
                commissionRate: data.commissionRate ?? 0.3,
            });
        } catch (err: any) {
            setError(err.message || 'Something went wrong');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            fetchReferralData();
            // Set up polling for real-time updates (every 30 seconds)
            const interval = setInterval(fetchReferralData, 30000);
            return () => clearInterval(interval);
        }
    }, [connected, publicKey, mounted]);

    // Mock Data (Fallback / Derived)
    const inviteLink = connected && publicKey 
        ? `${typeof window !== 'undefined' ? window.location.origin : 'https://prophecy-arena.com'}?ref=${publicKey.toBase58()}&lang=${language}`
        : "Connect Wallet first";

    const stats = referralData?.stats || {
        total: "0 USDT",
        withdrawable: "0 USDT",
        month: "0 USDT",
        friends: 0
    };

    const parseUsdtDisplay = (value: string) => {
        const normalized = String(value || '').replace('USDT', '').trim();
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    };
    
    const balances = referralData?.balances || { usdt: 0, bonus: 0 };
    const commissionRatePercent = `${Math.round((referralData?.commissionRate ?? 0.3) * 100)}%`;
    const totalCommissionValue = parseUsdtDisplay(stats.total);
    const withdrawableCommissionValue = parseUsdtDisplay(stats.withdrawable);
    const showReserveWarning = totalCommissionValue > 0 && withdrawableCommissionValue === 0;

    const commissions = referralData?.commissions || [];
    const visibleCommissions = React.useMemo(
        () => commissions.filter((commission) => commission.referee !== 'WITHDRAWAL'),
        [commissions]
    );
    const refereeLedgerTotals = React.useMemo(() => {
        const totals = new Map<string, { totalVolumeValue: number; earnedCommissionValue: number }>();

        for (const commission of visibleCommissions) {
            const current = totals.get(commission.referee) || {
                totalVolumeValue: 0,
                earnedCommissionValue: 0,
            };

            current.totalVolumeValue += parseUsdtDisplay(commission.betAmount);
            current.earnedCommissionValue += parseUsdtDisplay(commission.commission);
            totals.set(commission.referee, current);
        }

        return totals;
    }, [visibleCommissions]);
    const allReferees = React.useMemo(() => {
        return (referralData?.referees || []).map((ref: any) => {
            const derived = refereeLedgerTotals.get(ref.address);
            const totalVolumeValue =
                ref.totalVolumeValue > 0 ? ref.totalVolumeValue : derived?.totalVolumeValue ?? 0;
            const earnedCommissionValue =
                ref.earnedCommissionValue > 0 ? ref.earnedCommissionValue : derived?.earnedCommissionValue ?? 0;

            return {
                ...ref,
                totalVolumeValue,
                earnedCommissionValue,
                joinDate: ref.joinDateValue === 0 ? 'Just now' : `${ref.joinDateValue} days ago`,
                totalVolume: `${totalVolumeValue.toFixed(2)} USDT`,
                earnedCommission: `${earnedCommissionValue.toFixed(2)} USDT`,
            };
        });
    }, [referralData?.referees, refereeLedgerTotals]);

    // Apply sorting
    const sortedReferees = React.useMemo(() => {
        let sorted = [...allReferees];
        if (sortOrder === 'desc') {
            if (sortColumn === 'earned') {
                sorted.sort((a, b) => b.earnedCommissionValue - a.earnedCommissionValue);
            } else if (sortColumn === 'volume') {
                sorted.sort((a, b) => b.totalVolumeValue - a.totalVolumeValue);
            } else if (sortColumn === 'date') {
                sorted.sort((a, b) => b.joinDateValue - a.joinDateValue); // desc: oldest first (larger days ago)
            }
        } else if (sortOrder === 'asc') {
            if (sortColumn === 'earned') {
                sorted.sort((a, b) => a.earnedCommissionValue - b.earnedCommissionValue);
            } else if (sortColumn === 'volume') {
                sorted.sort((a, b) => a.totalVolumeValue - b.totalVolumeValue);
            } else if (sortColumn === 'date') {
                sorted.sort((a, b) => a.joinDateValue - b.joinDateValue); // asc: newest first (smaller days ago)
            }
        }
        return sorted;
    }, [allReferees, sortOrder, sortColumn]);

    const totalRefereePages = Math.ceil(sortedReferees.length / refereesPerPage);
    const currentReferees = sortedReferees.slice((refereePage - 1) * refereesPerPage, refereePage * refereesPerPage);

    const toggleSort = (column: 'earned' | 'volume' | 'date') => {
        if (sortColumn !== column) {
            setSortColumn(column);
            setSortOrder('desc');
        } else {
            setSortOrder(current => {
                if (current === 'desc') return 'asc';
                if (current === 'asc') {
                    setSortColumn(null);
                    return null;
                }
                return 'desc';
            });
        }
        setRefereePage(1); // Reset to page 1 on sort
    };

    const handleCopy = () => {
        if (!inviteLink) return;
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleWithdraw = async () => {
        if (!connected || !publicKey || !withdrawAmount || isWithdrawing) return;
        const amount = parseFloat(withdrawAmount);
        if (isNaN(amount) || amount <= 0) return;

        const currentWithdrawable = withdrawableCommissionValue;
        if (amount > currentWithdrawable) {
            alert(t('referral.withdraw.insufficient') || '提現金額超過可提現餘額');
            return;
        }

        setIsWithdrawing(true);

        try {
            const res = await fetch('/api/referral', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'withdraw_commission',
                    userAddress: publicKey.toBase58(),
                    amount,
                })
            });
            const data = await res.json();
            if (data.success) {
                await fetchReferralData();
                setWithdrawAmount('');
                setWithdrawSuccess(true);
                setTimeout(() => setWithdrawSuccess(false), 3000);
            } else {
                alert(data.error || '提現失敗');
            }
        } catch (err: any) {
            alert('提現失敗: ' + (err.message || 'Unknown error'));
        } finally {
            setIsWithdrawing(false);
        }
    };

    const nowMs = Date.now();
    const MS_DAY = 86400000;
    const timeCutoffs: Record<string, number> = {
        '1d': nowMs - 1 * MS_DAY,
        '3d': nowMs - 3 * MS_DAY,
        '7d': nowMs - 7 * MS_DAY,
        '30d': nowMs - 30 * MS_DAY,
        '3m': nowMs - 90 * MS_DAY,
        'all': 0,
    };
    const cutoff = timeCutoffs[timeFilter] || 0;

    const filteredCommissions = (activeTab === 'all' 
        ? visibleCommissions 
        : visibleCommissions.filter(c => c.status === activeTab)
    ).filter(c => cutoff === 0 || new Date(c.timestamp).getTime() >= cutoff);

    const totalPages = Math.max(1, Math.ceil(filteredCommissions.length / commissionsPerPage));
    const safePage = Math.min(commissionPage, Math.max(1, totalPages));
    const paginatedCommissions = filteredCommissions.slice(
        (safePage - 1) * commissionsPerPage,
        safePage * commissionsPerPage
    );

    const shareText = encodeURIComponent(t('referral.invite.share_text') || 'Join me on PolyBall to predict sports and win crypto! Use my link:');
    const shareUrl = encodeURIComponent(inviteLink);

    const handleShare = (platform: 'twitter' | 'whatsapp' | 'telegram') => {
        let url = '';
        switch (platform) {
            case 'twitter':
                url = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`;
                break;
            case 'whatsapp':
                url = `https://wa.me/?text=${shareText}%20${shareUrl}`;
                break;
            case 'telegram':
                url = `https://t.me/share/url?url=${shareUrl}&text=${shareText}`;
                break;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleClose = () => {
        // Try to close window if opened in new tab, otherwise fallback to back navigation
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.close();
            // If window.close() is blocked (not opened by script), redirect to home
            window.location.href = '/';
        }
    };

    const startEditingName = (id: string, currentName: string) => {
        setEditingRefId(id);
        setEditNameInput(currentName);
    };

    const saveName = (id: string) => {
        if (editNameInput.trim()) {
            setCustomNames(prev => ({ ...prev, [id]: editNameInput.trim() }));
        }
        setEditingRefId(null);
    };

    const resetName = (id: string) => {
        setCustomNames(prev => {
            const newNames = { ...prev };
            delete newNames[id];
            return newNames;
        });
    };

    // Ensure client-side rendering only for dynamic data
    if (!mounted) return null;

    if (!connected) {
        return (
            <div className="min-h-screen bg-neutral-900 text-neutral-100 font-sans selection:bg-primary-purple/30 flex flex-col items-center justify-center">
                <Gift className="h-16 w-16 text-primary-purple mb-6 animate-pulse" />
                <h1 className="text-2xl font-bold mb-4">Connect Wallet to view Referrals</h1>
                <div className="flex flex-col items-center gap-4">
                    <WalletButton />
                    <button 
                        onClick={handleClose}
                        className="text-neutral-400 hover:text-white transition-colors flex items-center gap-2 mt-4"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back</span>
                    </button>
                </div>
            </div>
        );
    }

    if (isLoading && !referralData) {
        return (
            <div className="min-h-screen bg-neutral-900 text-neutral-100 font-sans selection:bg-primary-purple/30 flex flex-col items-center justify-center">
                <div className="h-12 w-12 border-4 border-primary-purple border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-neutral-400">Loading referral data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-neutral-900 text-neutral-100 font-sans selection:bg-primary-purple/30 flex flex-col items-center justify-center">
                <div className="text-error mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                </div>
                <h1 className="text-xl font-bold text-white mb-2">Failed to load data</h1>
                <p className="text-neutral-400 mb-6">{error}</p>
                <Button onClick={fetchReferralData} variant="outline" className="border-neutral-700">Try Again</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-900 text-neutral-100 font-sans selection:bg-primary-purple/30 flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-neutral-800 bg-neutral-900/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/60">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={handleClose}
                            className="p-2 -ml-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors flex items-center gap-2"
                        >
                            <ArrowLeft className="h-5 w-5" />
                            <span className="font-medium hidden sm:inline-block">{t('btn.close') || 'Back'}</span>
                        </button>
                    </div>
                    <div className="flex items-center gap-4">
                        <WalletButton />
                    </div>
                </div>
            </header>

            <main className="flex-1 container mx-auto px-4 lg:px-8 py-8 max-w-5xl">
                <div className="bg-gradient-to-r from-neutral-800 to-neutral-900 p-8 rounded-t-3xl border border-neutral-800 border-b-0">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Gift className="h-8 w-8 text-primary-purple" />
                        {t('referral.title')}
                    </h1>
                    <p className="text-neutral-400 mt-2 text-lg">{t('referral.subtitle')}</p>
                </div>

                <div className="bg-neutral-900 p-8 rounded-b-3xl border border-neutral-800 shadow-2xl space-y-8">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        {[
                            { label: t('referral.stat.total'), value: stats.total, icon: TrendingUp, color: 'text-yellow-400' },
                            { label: t('referral.stat.withdrawable'), value: stats.withdrawable, icon: Wallet, color: 'text-primary-blue' },
                            { label: t('referral.stat.month'), value: stats.month, icon: History, color: 'text-primary-purple' },
                            { label: t('referral.stat.friends'), value: stats.friends, icon: Users, color: 'text-success' },
                            { label: t('referral.page.bonus_balance'), value: `${balances.bonus} USDT`, icon: Gift, color: 'text-pink-500' },
                        ].map((stat, i) => (
                            <div key={i} className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50 hover:border-neutral-600 transition-colors">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-sm text-neutral-400 font-medium">{stat.label}</span>
                                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                                </div>
                                <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Invite Section */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-neutral-800/30 p-6 rounded-3xl border border-neutral-700/50 space-y-4">
                                <h3 className="font-bold text-xl flex items-center gap-2">
                                    <Users className="h-6 w-6 text-primary-purple" />
                                    {t('referral.invite.link')}
                                </h3>
                                
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="flex-1 relative group/link">
                                        <Input 
                                            readOnly 
                                            value={inviteLink} 
                                            className="bg-neutral-900 border-neutral-700 font-mono text-base h-14 pr-12 text-neutral-300" 
                                        />
                                        <div className="absolute right-0 top-0 h-full w-14 flex items-center justify-center bg-neutral-800 rounded-r-md border-l border-neutral-700">
                                            <ExternalLink className="h-5 w-5 text-neutral-500" />
                                        </div>
                                    </div>
                                    <Button 
                                        onClick={handleCopy}
                                        className={`h-14 px-8 font-bold text-lg transition-all ${copied ? 'bg-success hover:bg-success text-neutral-900' : 'bg-primary-purple hover:bg-primary-purple/90'}`}
                                    >
                                        {copied ? (
                                            <><Check className="mr-2 h-5 w-5" /> {t('referral.invite.copied')}</>
                                        ) : (
                                            <><Copy className="mr-2 h-5 w-5" /> {t('referral.invite.copy')}</>
                                        )}
                                    </Button>
                                </div>

                                {/* Share Buttons */}
                                <div className="flex flex-wrap gap-3 pt-4">
                                    <Button onClick={() => handleShare('twitter')} variant="outline" className="flex-1 min-w-[120px] h-12 border-neutral-700 hover:bg-[#1DA1F2]/10 hover:text-[#1DA1F2] hover:border-[#1DA1F2]/50">
                                        <Twitter className="mr-2 h-5 w-5" /> Twitter
                                    </Button>
                                    <Button onClick={() => handleShare('whatsapp')} variant="outline" className="flex-1 min-w-[120px] h-12 border-neutral-700 hover:bg-[#25D366]/10 hover:text-[#25D366] hover:border-[#25D366]/50">
                                        <MessageCircle className="mr-2 h-5 w-5" /> WhatsApp
                                    </Button>
                                    <Button onClick={() => handleShare('telegram')} variant="outline" className="flex-1 min-w-[120px] h-12 border-neutral-700 hover:bg-[#0088cc]/10 hover:text-[#0088cc] hover:border-[#0088cc]/50">
                                        <MessageCircle className="mr-2 h-5 w-5" /> Telegram
                                    </Button>
                                </div>
                            </div>

                            {/* Commission History */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <h3 className="font-bold text-xl">{t('referral.history.title')}</h3>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {(['all', 'pending', 'approved', 'settled'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => { setActiveTab(tab); setCommissionPage(1); }}
                                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === tab ? 'bg-neutral-700 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'}`}
                                        >
                                            {t(`referral.tab.${tab}`)}
                                        </button>
                                    ))}
                                    <div className="w-px h-8 bg-neutral-700 mx-1 self-center" />
                                    {(['1d', '3d', '7d', '30d', '3m', 'all'] as const).map(tf => {
                                        const labelMap: Record<string, string> = { '1d': '1D', '3d': '3D', '7d': '7D', '30d': '30D', '3m': '3M', 'all': 'ALL' };
                                        return (
                                            <button
                                                key={tf}
                                                onClick={() => { setTimeFilter(tf); setCommissionPage(1); }}
                                                className={`px-3 py-2 text-xs font-bold rounded-md transition-all ${timeFilter === tf ? 'bg-primary-purple/20 text-primary-purple border border-primary-purple/30' : 'text-neutral-500 hover:text-neutral-300'}`}
                                            >
                                                {labelMap[tf]}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="space-y-3">
                                    {paginatedCommissions.length > 0 ? (
                                        paginatedCommissions.map((comm) => (
                                            <div key={comm.id} className="flex items-center justify-between p-5 bg-neutral-800/30 rounded-xl border border-neutral-800 hover:bg-neutral-800/50 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className={`h-2.5 w-2.5 rounded-full ${comm.status === 'settled' ? 'bg-success' : comm.status === 'approved' ? 'bg-primary-blue' : 'bg-neutral-500'}`} />
                                                    <div>
                                                        <div className="text-base font-bold text-white font-mono">{comm.referee.length > 12 ? comm.referee.slice(0, 4) + '...' + comm.referee.slice(-4) : comm.referee}</div>
                                                        <div className="text-sm text-neutral-500 flex flex-wrap items-center gap-2">
                                                            <span>{comm.timestamp}</span>
                                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${comm.status === 'settled' ? 'bg-success/15 text-success' : comm.status === 'approved' ? 'bg-primary-blue/15 text-primary-blue' : 'bg-neutral-700 text-neutral-300'}`}>
                                                                {t(`referral.status.${comm.status}`)}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-neutral-400 mt-1">
                                                            {t('referral.history.bet_amount')}: {comm.betAmount} USDT
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-bold text-success">+{comm.commission} USDT</div>
                                                    <div className="text-sm text-neutral-500">Fee: {comm.fee} USDT</div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12 text-neutral-500 bg-neutral-800/20 rounded-xl border border-neutral-800 border-dashed text-lg">
                                            {t('referral.history.empty')}
                                        </div>
                                    )}
                                </div>

                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-3 pt-2">
                                        <button
                                            onClick={() => setCommissionPage(p => Math.max(1, p - 1))}
                                            disabled={safePage <= 1}
                                            className="px-3 py-1.5 text-sm font-medium rounded-md bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            ←
                                        </button>
                                        <span className="text-sm text-neutral-400">
                                            {safePage} / {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCommissionPage(p => Math.min(totalPages, p + 1))}
                                            disabled={safePage >= totalPages}
                                            className="px-3 py-1.5 text-sm font-medium rounded-md bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            →
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* My Referrees List */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-xl flex items-center gap-2">
                                        <Users className="h-5 w-5 text-primary-blue" />
                                        {t('referral.page.my_referrals')}
                                    </h3>
                                    <div className="text-sm text-neutral-400">
                                        {t('referral.page.total')} <span className="text-white font-bold">{allReferees.length}</span>
                                    </div>
                                </div>

                                <div className="bg-neutral-800/30 rounded-2xl border border-neutral-800 overflow-hidden overflow-x-auto">
                                    <div className="min-w-[600px]">
                                        <div className="grid grid-cols-4 gap-4 p-4 border-b border-neutral-800 text-xs font-medium text-neutral-400 uppercase tracking-wider">
                                            <div>{t('referral.page.user')}</div>
                                            <div 
                                                className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors select-none"
                                                onClick={() => toggleSort('date')}
                                                title="Sort by date"
                                            >
                                                {t('referral.page.join_date')}
                                                <span className="text-neutral-500 flex flex-col -space-y-1">
                                                    <ArrowUp className={`h-3 w-3 ${sortColumn === 'date' && sortOrder === 'desc' ? 'text-primary-blue' : 'opacity-50'}`} />
                                                    <ArrowDown className={`h-3 w-3 ${sortColumn === 'date' && sortOrder === 'asc' ? 'text-primary-blue' : 'opacity-50'}`} />
                                                </span>
                                            </div>
                                            <div 
                                                className="text-right flex items-center justify-end gap-1 cursor-pointer hover:text-white transition-colors select-none"
                                                onClick={() => toggleSort('volume')}
                                                title="Sort by volume"
                                            >
                                                {t('referral.page.vol')}
                                                <span className="text-neutral-500 flex flex-col -space-y-1">
                                                    <ArrowUp className={`h-3 w-3 ${sortColumn === 'volume' && sortOrder === 'desc' ? 'text-primary-blue' : 'opacity-50'}`} />
                                                    <ArrowDown className={`h-3 w-3 ${sortColumn === 'volume' && sortOrder === 'asc' ? 'text-primary-blue' : 'opacity-50'}`} />
                                                </span>
                                            </div>
                                            <div 
                                                className="text-right flex items-center justify-end gap-1 cursor-pointer hover:text-white transition-colors select-none"
                                                onClick={() => toggleSort('earned')}
                                                title="Sort by commission"
                                            >
                                                {t('referral.page.earned')}
                                                <span className="text-neutral-500 flex flex-col -space-y-1">
                                                    <ArrowUp className={`h-3 w-3 ${sortColumn === 'earned' && sortOrder === 'desc' ? 'text-primary-blue' : 'opacity-50'}`} />
                                                    <ArrowDown className={`h-3 w-3 ${sortColumn === 'earned' && sortOrder === 'asc' ? 'text-primary-blue' : 'opacity-50'}`} />
                                                </span>
                                            </div>
                                        </div>
                                        <div className="divide-y divide-neutral-800/50">
                                        {currentReferees.length > 0 ? (
                                            currentReferees.map((ref) => {
                                                const isEditing = editingRefId === ref.id;
                                                const hasCustomName = !!customNames[ref.id];
                                                // 縮短地址顯示 (例如: 2Ntk...d5K)
                                                const shortAddress = ref.address.length > 10 
                                                    ? `${ref.address.slice(0, 4)}...${ref.address.slice(-4)}` 
                                                    : ref.address;
                                                const displayName = customNames[ref.id] || shortAddress;
                                                
                                                return (
                                                    <div key={ref.id} className="grid grid-cols-4 gap-4 p-4 items-center hover:bg-neutral-800/50 transition-colors group">
                                                        <div className="flex items-center gap-2">
                                                            {isEditing ? (
                                                                <div className="flex items-center gap-2 w-full">
                                                                    <Input 
                                                                        autoFocus
                                                                        value={editNameInput}
                                                                        onChange={(e) => setEditNameInput(e.target.value)}
                                                                        onKeyDown={(e) => e.key === 'Enter' && saveName(ref.id)}
                                                                        onBlur={() => saveName(ref.id)}
                                                                        className="h-8 text-xs bg-neutral-900 border-primary-purple"
                                                                    />
                                                                    <button 
                                                                        onClick={() => {
                                                                            navigator.clipboard.writeText(ref.address);
                                                                        }}
                                                                        className="p-1.5 shrink-0 bg-neutral-800 hover:bg-neutral-700 rounded-md text-neutral-400 hover:text-white transition-colors"
                                                                        title={t('referral.page.copy_address')}
                                                                    >
                                                                        <Copy className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className={`font-mono text-sm ${hasCustomName ? 'text-primary-blue font-bold' : 'text-white'}`}>
                                                                        {displayName}
                                                                    </div>
                                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button 
                                                                            onClick={() => {
                                                                                navigator.clipboard.writeText(ref.address);
                                                                                // You might want to add a small toast notification here
                                                                            }}
                                                                            className="p-1.5 hover:bg-neutral-700 rounded-md text-neutral-400 hover:text-white transition-colors"
                                                                            title={t('referral.page.copy_address')}
                                                                        >
                                                                            <Copy className="h-3.5 w-3.5" />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => startEditingName(ref.id, displayName)}
                                                                            className="p-1.5 hover:bg-neutral-700 rounded-md text-neutral-400 hover:text-white transition-colors"
                                                                            title={t('referral.page.edit_name')}
                                                                        >
                                                                            <Edit2 className="h-3.5 w-3.5" />
                                                                        </button>
                                                                        {hasCustomName && (
                                                                            <button 
                                                                                onClick={() => resetName(ref.id)}
                                                                                className="p-1.5 hover:bg-neutral-700 rounded-md text-neutral-400 hover:text-white transition-colors"
                                                                                title={t('referral.page.reset_address')}
                                                                            >
                                                                                <RotateCcw className="h-3.5 w-3.5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className="text-sm text-neutral-500">{ref.joinDate}</div>
                                                        <div className="text-sm text-neutral-300 text-right">{ref.totalVolume}</div>
                                                        <div className="text-sm font-bold text-success text-right">+{ref.earnedCommission}</div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="text-center py-8 text-neutral-500">
                                                {t('referral.page.no_referrals')}
                                            </div>
                                        )}
                                    </div>
                                    </div>
                                    
                                    {/* Pagination */}
                                    {totalRefereePages > 1 && (
                                        <div className="p-4 border-t border-neutral-800 flex items-center justify-between">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="border-neutral-700 hover:bg-neutral-700"
                                                disabled={refereePage === 1}
                                                onClick={() => setRefereePage(p => Math.max(1, p - 1))}
                                            >
                                                {t('referral.page.previous')}
                                            </Button>
                                            <span className="text-sm text-neutral-400">
                                                {t('referral.page.page_of').replace('{current}', refereePage.toString()).replace('{total}', totalRefereePages.toString())}
                                            </span>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="border-neutral-700 hover:bg-neutral-700"
                                                disabled={refereePage === totalRefereePages}
                                                onClick={() => setRefereePage(p => Math.min(totalRefereePages, p + 1))}
                                            >
                                                {t('referral.page.next')}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Withdraw Section */}
                        <div className="lg:col-span-1">
                            <div className="bg-gradient-to-b from-neutral-800 to-neutral-900 p-8 rounded-3xl border border-neutral-700/50 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-primary-blue/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                                
                                <h3 className="font-bold text-xl mb-8 relative z-10">{t('referral.withdraw.title')}</h3>
                                
                                <div className="space-y-6 relative z-10">
                                    <div className="rounded-2xl border border-neutral-700/60 bg-neutral-950/40 p-4 space-y-2">
                                        <div className="text-sm font-medium text-neutral-400 uppercase tracking-wider">
                                            {t('referral.withdraw.rate_label')}
                                        </div>
                                        <div className="text-2xl font-bold text-primary-blue tracking-tight">
                                            {commissionRatePercent}
                                        </div>
                                        <div className="text-sm text-neutral-500">
                                            {t('referral.withdraw.rate_desc')}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="rounded-2xl border border-neutral-700/60 bg-neutral-950/40 p-4 space-y-2">
                                            <label className="text-sm font-medium text-neutral-400 uppercase tracking-wider">{t('referral.withdraw.total_label')}</label>
                                            <div className="text-2xl font-bold text-white tracking-tight">{stats.total}</div>
                                        </div>
                                        <div className="rounded-2xl border border-neutral-700/60 bg-neutral-950/40 p-4 space-y-2">
                                            <label className="text-sm font-medium text-neutral-400 uppercase tracking-wider">{t('referral.stat.withdrawable')}</label>
                                            <div className="text-3xl font-bold text-white tracking-tight">{stats.withdrawable}</div>
                                            {showReserveWarning ? (
                                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                                                    {t('referral.withdraw.reserve_insufficient')}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-sm text-neutral-400">{t('referral.withdraw.amount')}</label>
                                        <div className="relative">
                                            <Input 
                                                value={withdrawAmount}
                                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                                placeholder="0.00"
                                                className="bg-neutral-950/50 border-neutral-700 text-xl h-14 pr-16"
                                            />
                                            <button 
                                                onClick={() => setWithdrawAmount(stats.withdrawable.split(' ')[0])}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-primary-blue hover:underline"
                                            >
                                                MAX
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-sm text-neutral-400">{t('referral.withdraw.address')}</label>
                                        <div className="p-4 bg-neutral-950/50 border border-neutral-700 rounded-xl text-sm font-mono text-neutral-300 truncate">
                                            {publicKey ? publicKey.toBase58() : 'Connect Wallet'}
                                        </div>
                                    </div>

                                    <Button 
                                        onClick={handleWithdraw}
                                        disabled={!connected || !withdrawAmount || isWithdrawing || withdrawSuccess}
                                        className={`w-full h-14 text-lg font-bold text-neutral-900 transition-all ${
                                            withdrawSuccess 
                                                ? 'bg-success hover:bg-success' 
                                                : 'bg-white hover:bg-neutral-200'
                                        }`}
                                    >
                                        {withdrawSuccess ? t('referral.withdraw.success') : isWithdrawing ? t('referral.page.processing') : t('referral.withdraw.btn')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
