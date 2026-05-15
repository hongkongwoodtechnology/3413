import { PublicKey } from "@solana/web3.js";

// 資金池地址 (Pool) — 用於結算贏家派彩
export const POOL_ADDRESS = new PublicKey(
  process.env.NEXT_PUBLIC_POOL_WALLET || "9FfHYyK8ZKsA82BPtierU4sWmwTS8QTGqrGqtTt6tEu7"
);

// 莊家抽水地址 (House Edge / Rake) — 平台 8% 手續費中 70% 歸平台
export const HOUSE_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_HOUSE_WALLET || "2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K"
);

// 佣金地址 (Commission) — 平台 8% 手續費中 30% 歸推薦人/佣金池
export const COMMISSION_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_COMMISSION_WALLET || "2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K"
);

// USDT Mint 地址 (Solana Mainnet)
export const USDT_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDT_MINT || "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
);

export const USDT_DECIMALS = 6;

// 平台費率 (8%)
export const PLATFORM_FEE_RATE = 0.08;

// 佣金佔平台費的比例 (預設 30%，即投注額的 2.4%)
export const DEFAULT_COMMISSION_RATE = 0.3;

/**
 * 計算投注金額分配：
 * @returns { pool: 進資金池, house: 莊家抽水, commission: 佣金, support: 市場支撐, platformFee: 平台總手續費 }
 */
export function splitBetAmount(
  betAmount: number,
  commissionRate: number = DEFAULT_COMMISSION_RATE,
  _realTotalPool?: number
): { pool: number; house: number; commission: number; support: number; platformFee: number } {
  const platformFee = betAmount * PLATFORM_FEE_RATE;
  const commission = platformFee * commissionRate;
  const house = platformFee - commission;
  const pool = betAmount - platformFee;
  return { pool, house, commission, support: 0, platformFee };
}

/**
 * 解析優先使用的錢包地址：
 * 1. 如果有 Phantom provider 地址，優先使用
 * 2. 否則回退到錢包適配器地址
 */
export function resolvePreferredWalletAddress(
  walletAdapterAddress: string | null,
  phantomAddress: string | null
): string | null {
  if (phantomAddress) return phantomAddress;
  return walletAdapterAddress;
}

/**
 * 產生推薦人綁定的 localStorage key，確保讀寫一致
 */
export function getBoundReferrerStorageKey(address: string): string {
  return `bound_referrer_${address.trim()}`;
}

/**
 * 格式化 ATA 未初始化的錯誤訊息
 */
export function formatMissingAtaInitializationMessage(missingLabels: string[]): string {
  const labelList = missingLabels.join('、');
  return `平台尚未初始化收款帳戶：${labelList}。請聯繫管理員初始化 ATA 帳戶後再進行投注。`;
}

/**
 * 取得資金池、莊家、佣金三個目標 ATA 的設定資訊
 */
export function getDestinationAtaTargets(): { key: string; label: string; owner: PublicKey }[] {
  return [
    { key: 'pool', label: '資金池收款', owner: POOL_ADDRESS },
    { key: 'house', label: '平台淨收益收款', owner: HOUSE_WALLET },
    { key: 'commission', label: '平台佣金收款', owner: COMMISSION_WALLET },
  ];
}

const LEGACY_ADMIN_ADDRESS = '2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K';

/**
 * 從推薦人資料中移除舊的管理員地址條目
 */
export function stripLegacyAdminEntries<T extends Record<string, any>>(data: T): T {
  const result = { ...data } as Record<string, any>;
  delete result[LEGACY_ADMIN_ADDRESS];
  return result as T;
}

/**
 * 從投注記錄中移除舊的 payout 欄位
 */
export function stripLegacyBetFields(data: Record<string, any[]>): Record<string, any[]> {
  const result: Record<string, any[]> = {};
  for (const [key, bets] of Object.entries(data)) {
    result[key] = bets.map((bet: any) => {
      const { legacyPayout, ...rest } = bet;
      return rest;
    });
  }
  return result;
}
