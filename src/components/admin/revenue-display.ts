const PLATFORM_REVENUE_REFERRER = '__platform__';
const PLATFORM_REVENUE_LABEL = '平台直收';

export function getRevenueReferrerDisplay(referrerAddress: string): string {
  return referrerAddress === PLATFORM_REVENUE_REFERRER
    ? PLATFORM_REVENUE_LABEL
    : referrerAddress;
}
