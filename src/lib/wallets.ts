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
 * @returns { pool: 進資金池, house: 莊家抽水, commission: 佣金 }
 */
export function splitBetAmount(
  betAmount: number,
  commissionRate: number = DEFAULT_COMMISSION_RATE
): { pool: number; house: number; commission: number } {
  const platformFee = betAmount * PLATFORM_FEE_RATE;
  const commission = platformFee * commissionRate;
  const house = platformFee - commission;
  const pool = betAmount - platformFee;
  return { pool, house, commission };
}
