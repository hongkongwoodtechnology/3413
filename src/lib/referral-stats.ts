type ReferralCommission = {
  referee: string;
  commission: string;
  timestamp: string;
  status: 'settled' | 'pending';
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
  const activeCommissions = params.commissions.filter((commission) => commission.referee !== 'WITHDRAWAL');
  const settledCommissions = activeCommissions.filter((commission) => commission.status === 'settled');

  const totalEarned = activeCommissions.reduce(
    (sum, commission) => sum + (parseFloat(commission.commission) || 0),
    0
  );
  const monthEarned = activeCommissions.reduce((sum, commission) => {
    const ts = Date.parse(commission.timestamp);
    if (!Number.isFinite(ts)) return sum;
    if (now - ts > 30 * 24 * 60 * 60 * 1000) return sum;
    return sum + (parseFloat(commission.commission) || 0);
  }, 0);
  const settledEarned = settledCommissions.reduce(
    (sum, commission) => sum + (parseFloat(commission.commission) || 0),
    0
  );
  const withdrawn = params.commissions
    .filter((commission) => commission.referee === 'WITHDRAWAL' && commission.status === 'settled')
    .reduce((sum, commission) => sum + Math.abs(parseFloat(commission.commission) || 0), 0);

  return {
    total: `${totalEarned.toFixed(6)} USDT`,
    month: `${monthEarned.toFixed(6)} USDT`,
    withdrawable: `${Math.max(0, settledEarned - withdrawn).toFixed(6)} USDT`,
  };
}
