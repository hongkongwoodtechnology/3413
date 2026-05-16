type ReferralCommission = {
  referee: string;
  commission: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'settled';
};

export function calculateReferralStats(params: {
  commissions: ReferralCommission[];
  now?: number;
}): {
  total: string;
  month: string;
  withdrawable: string;
} {
  const now = params.now ?? Date.now();
  const approvedCommissions = params.commissions.filter(
    (commission) => commission.referee !== 'WITHDRAWAL' && commission.status === 'approved'
  );

  const totalEarned = approvedCommissions.reduce(
    (sum, commission) => sum + (parseFloat(commission.commission) || 0),
    0
  );
  const monthEarned = approvedCommissions.reduce((sum, commission) => {
    const ts = Date.parse(commission.timestamp);
    if (!Number.isFinite(ts)) return sum;
    if (now - ts > 30 * 24 * 60 * 60 * 1000) return sum;
    return sum + (parseFloat(commission.commission) || 0);
  }, 0);
  const approvedEarned = approvedCommissions.reduce(
    (sum, commission) => sum + (parseFloat(commission.commission) || 0),
    0
  );

  return {
    total: `${totalEarned.toFixed(6)} USDT`,
    month: `${monthEarned.toFixed(6)} USDT`,
    withdrawable: `${approvedEarned.toFixed(6)} USDT`,
  };
}
