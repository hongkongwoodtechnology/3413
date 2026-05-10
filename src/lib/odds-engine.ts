// 香港賽馬會 (HKJC) 足球主客和賠率引擎
// V7.2: 抽水先補冷啟動對手盤，剩餘 fee 才做佣金分成
//   平台不出錢、不蝕錢、只賺抽水
//   池 < $0.50 → 優先用 fee 補足冷啟動對手盤，剩餘 fee 才能分給平台/介紹人
//   佣金不再直接影響冷啟動對手盤注入
//   池 < $0.50 → opponentPool 來自 cold-start support, odds floor = 1.00
//   池 ≥ $0.50 → 正常運作, odds floor = 1.01

import {
  ATTRACTION_WINDOW_MAX_ODDS,
  type AttractionWindowUsage,
  type OutcomeKey,
  isSingleSidedMarket,
  splitBetByAttractionWindow,
} from './market-rules';

export type RiskLevel = 'normal' | 'counterparty' | 'position_limit' | 'refund_single_side';

export type PhaseAwareQuoteInput = {
  pools: Record<OutcomeKey, number>;
  liabilities: Record<OutcomeKey, number>;
  selectedOutcome: OutcomeKey;
  betAmount: number;
  initialOdds: Record<OutcomeKey, number>;
  attractionWindowUsed: AttractionWindowUsage;
  score?: string | null;
  liveMinute?: number;
  status?: string;
  returnRate?: number;
};

export type PhaseAwareQuoteResult = {
  odds: number;
  riskLevel: RiskLevel;
  attractiveAmount: number;
  regularAmount: number;
  singleSided: boolean;
};

const COLD_START_CAP = 0.50;
const PLATFORM_FEE = 0.08;

export class DynamicOddsEngine {
  private baseReturnRate: number;
  private stiffnessK: number;
  private readonly MAX_SINGLE_POSITION_RATIO = 0.85;

  constructor(profitMargin = PLATFORM_FEE, stiffnessK = 200) {
    this.baseReturnRate = 1 - profitMargin;
    this.stiffnessK = stiffnessK;
  }

  // ─── 對手盤計算（注入抽水的 house portion）────

  public static buildFeeFundedPools(
    userBets: Record<string, number>,
    profitMargin = PLATFORM_FEE,
    commissionRate = 0.3
  ): { pools: Record<string, number>; injectedAmount: number; housePortion: number; commissionPortion: number } {
    const real = { ...userBets };
    const totalReal = (real.home || 0) + (real.draw || 0) + (real.away || 0);
    const totalFee = totalReal * profitMargin;
    const supportNeeded = Math.max(0, COLD_START_CAP - totalReal);
    const housePortion = Math.min(totalFee, supportNeeded);
    const commissionPortion = Math.max(0, totalFee - housePortion) * commissionRate;
    const perOpponent = housePortion / 2;
    const entries: Array<{ key: string; val: number }> = [
      { key: 'home', val: real.home || 0 },
      { key: 'draw', val: real.draw || 0 },
      { key: 'away', val: real.away || 0 },
    ];
    entries.sort((a, b) => a.val - b.val);
    real[entries[0].key] = (real[entries[0].key] || 0) + perOpponent;
    real[entries[1].key] = (real[entries[1].key] || 0) + perOpponent;
    return { pools: real, injectedAmount: housePortion, housePortion, commissionPortion };
  }

  public getMinOdds(totalPool: number, isFeeFundedOpponent: boolean, commissionRate = 0.3): number {
    if (isFeeFundedOpponent && totalPool < COLD_START_CAP) {
      return 1.0;
    }
    return 1.01;
  }

  public getFeeFundedThreshold(): number { return COLD_START_CAP; }

  // ─── 顯示賠率 ──────────────────────────────────

  public calculateAllDisplayOdds(
    pools: Record<string, number>,
    initialProbs?: Record<string, number>,
    seedPools?: Record<string, number>,
    score?: string | null,
    liveMinute?: number,
    status?: string,
    lockedReturnRate?: number,
    isFeeFundedOpponent?: boolean,
    commissionRate?: number
  ): { home: number; draw: number; away: number } {
    const rr = lockedReturnRate ?? this.baseReturnRate;
    const realOnly = seedPools
      ? this.computeRealPools(pools, seedPools)
      : pools;
    const realOnlyPools = realOnly || pools;
    const totalReal = this.sumPools(realOnlyPools);
    const feeFunded = isFeeFundedOpponent && totalReal < COLD_START_CAP;
    const effPools = feeFunded
      ? DynamicOddsEngine.buildFeeFundedPools(realOnlyPools, PLATFORM_FEE, commissionRate ?? 0.3).pools
      : realOnlyPools;
    const minOdds = this.getMinOdds(totalReal, !!isFeeFundedOpponent, commissionRate ?? 0.3);

    return {
      home: this.calculateParimutuelOdds(effPools, 'home', rr, minOdds),
      draw: this.calculateParimutuelOdds(effPools, 'draw', rr, minOdds),
      away: this.calculateParimutuelOdds(effPools, 'away', rr, minOdds),
    };
  }

  // ─── 成交賠率 ──────────────────────────────────

  public calculateDynamicOdds(
    pools: Record<string, number>,
    selectedOption: string,
    betAmount: number,
    liabilities?: Record<string, number>,
    initialProbs?: Record<string, number>,
    seedPools?: Record<string, number>,
    initialOdds?: Record<string, number>,
    score?: string | null,
    liveMinute?: number,
    status?: string,
    lockedReturnRate?: number,
    isFeeFundedOpponent?: boolean,
    commissionRate?: number
  ): { odds: number; riskLevel: RiskLevel } | null {
    if (!this.isOutcomeKey(selectedOption)) return null;
    if (betAmount <= 0) return null;

    const realPools = this.computeRealPools(pools, seedPools);
    const purePools = realPools || pools;

    if (!this.checkPositionLimit(purePools, selectedOption, betAmount)) {
      return { odds: 0, riskLevel: 'position_limit' };
    }

    const totalReal = this.sumPools(purePools);
    const rr = lockedReturnRate ?? this.baseReturnRate;
    const feeFunded = isFeeFundedOpponent && totalReal < COLD_START_CAP;
    const minOdds = this.getMinOdds(totalReal, !!isFeeFundedOpponent, commissionRate ?? 0.3);

    const newReal = { ...purePools };
    newReal[selectedOption] = (newReal[selectedOption] || 0) + betAmount;

    const effPools = feeFunded
      ? DynamicOddsEngine.buildFeeFundedPools(newReal, PLATFORM_FEE, commissionRate ?? 0.3).pools
      : newReal;
    const effTotal = this.sumPools(effPools);

    const options = ['home', 'draw', 'away'];
    let opponentPool = 0;
    for (const opt of options) if (opt !== selectedOption) opponentPool += effPools[opt] || 0;

    if (opponentPool <= 0) return { odds: 1.00, riskLevel: 'refund_single_side' as const };

    const realLiabilities = this.computeRealLiabilities(liabilities, seedPools, initialOdds);
    const currentLiability = realLiabilities?.[selectedOption] || 0;
    const maxOddsBySolvency = (rr * effTotal - currentLiability) / betAmount;

    if (maxOddsBySolvency < minOdds) return null;

    const baseOdds = this.calculateParimutuelOdds(effPools, selectedOption, rr, minOdds);
    const finalOdds = Math.min(baseOdds, maxOddsBySolvency);
    const raw = parseFloat(finalOdds.toFixed(4));
    const capped = raw < minOdds ? minOdds : raw;

    return { odds: capped, riskLevel: baseOdds > maxOddsBySolvency ? 'counterparty' : 'normal' };
  }

  public calculatePhaseAwareLockedOdds(input: PhaseAwareQuoteInput): PhaseAwareQuoteResult | null {
    const rr = input.returnRate ?? this.baseReturnRate;

    if (isSingleSidedMarket(input.pools)) {
      return {
        odds: input.initialOdds[input.selectedOutcome] || 1.01,
        riskLevel: 'refund_single_side',
        attractiveAmount: 0,
        regularAmount: 0,
        singleSided: true,
      };
    }

    const split = splitBetByAttractionWindow(
      input.betAmount,
      input.attractionWindowUsed,
      input.selectedOutcome
    );

    const regularQuote = this.calculateDynamicOdds(
      input.pools,
      input.selectedOutcome,
      input.betAmount,
      input.liabilities,
      undefined,
      undefined,
      input.initialOdds,
      input.score,
      input.liveMinute,
      input.status,
      rr
    );

    if (!regularQuote) return null;

    const attractiveOdds = Math.min(
      ATTRACTION_WINDOW_MAX_ODDS,
      regularQuote.odds
    );

    const weightedOdds =
      input.betAmount <= 0
        ? attractiveOdds
        : (
            (split.attractiveAmount * attractiveOdds) +
            (split.regularAmount * regularQuote.odds)
          ) / input.betAmount;

    return {
      odds: parseFloat(weightedOdds.toFixed(4)),
      riskLevel: regularQuote.riskLevel,
      attractiveAmount: split.attractiveAmount,
      regularAmount: split.regularAmount,
      singleSided: false,
    };
  }

  public calculatePhaseAwareDisplayOdds(args: {
    pools: Record<OutcomeKey, number>;
    initialOdds: Record<OutcomeKey, number>;
    attractionWindowUsed: AttractionWindowUsage;
    score?: string | null;
    liveMinute?: number;
    status?: string;
    returnRate?: number;
  }): Record<OutcomeKey, number> {
    if (isSingleSidedMarket(args.pools)) {
      return args.initialOdds;
    }

    const rr = args.returnRate ?? this.baseReturnRate;
    return this.calculateAllDisplayOdds(
      args.pools,
      undefined,
      undefined,
      args.score,
      args.liveMinute,
      args.status,
      rr
    );
  }

  // ─── 集中度 ────────────────────────────────────

  public checkPositionLimit(pools: Record<string, number>, selectedOption: string, betAmount: number): boolean {
    const totalPool = this.sumPools(pools);
    if (totalPool === 0) return true;

    // 總池極小時（< $0.50）跳過持倉限制，讓早期投注者自由建倉
    if (totalPool < COLD_START_CAP) return true;

    const options = ['home', 'draw', 'away'];
    let opponentPool = 0;
    for (const opt of options) if (opt !== selectedOption) opponentPool += pools[opt] || 0;
    if (opponentPool <= 0) return true;

    const newOptionPool = (pools[selectedOption] || 0) + betAmount;
    const newTotal = totalPool + betAmount;
    return newOptionPool / newTotal <= this.MAX_SINGLE_POSITION_RATIO;
  }

  public getConcentration(pools: Record<string, number>) {
    const total = this.sumPools(pools);
    if (total === 0) return { home: 0, draw: 0, away: 0, maxOption: 'home', maxRatio: 0, alertLevel: 'normal' as const };
    const h = (pools.home || 0) / total, d = (pools.draw || 0) / total, a = (pools.away || 0) / total;
    const maxRatio = Math.max(h, d, a);
    let maxOption = 'home'; if (d === maxRatio) maxOption = 'draw'; if (a === maxRatio) maxOption = 'away';
    let alertLevel: 'normal' | 'warning' | 'danger' | 'critical' = 'normal';
    if (maxRatio >= this.MAX_SINGLE_POSITION_RATIO) alertLevel = 'critical';
    else if (maxRatio >= 0.75) alertLevel = 'danger';
    else if (maxRatio >= 0.60) alertLevel = 'warning';
    return { home: h, draw: d, away: a, maxOption, maxRatio, alertLevel };
  }

  public getMaxPositionRatio(): number { return this.MAX_SINGLE_POSITION_RATIO; }
  public getEffectiveK(totalPool: number): number { return this.computeAdaptiveK(totalPool); }

  // ─── Layer 7: 動態注額上限 ──────────────────

  public getMaxBetAmount(
    pools: Record<string, number>,
    outcome: string,
    returnRate: number = this.baseReturnRate
  ): number {
    const total = this.sumPools(pools);
    const optPool = pools[outcome] || 0;
    if (total === 0) return Number.MAX_SAFE_INTEGER;
    if (optPool === 0) return Number.MAX_SAFE_INTEGER;

    const minOdds = 1.01;
    const numerator = minOdds * optPool - total * returnRate;
    const denominator = returnRate - minOdds;
    if (denominator >= 0) return Number.MAX_SAFE_INTEGER;
    const x = numerator / denominator;
    if (x <= 0) return 0;
    return parseFloat(x.toFixed(6));
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private isOutcomeKey(value: string): value is 'home' | 'draw' | 'away' {
    return value === 'home' || value === 'draw' || value === 'away';
  }

  private sumPools(pools: Record<string, number>): number {
    return Object.values(pools).reduce((a, b) => a + b, 0);
  }

  private computeAdaptiveK(totalPool: number): number {
    if (totalPool <= 100)   return 10;
    if (totalPool <= 500)   return 25;
    if (totalPool <= 1000)  return 50;
    if (totalPool <= 5000)  return 100;
    if (totalPool <= 10000) return 200;
    if (totalPool <= 50000) return 500;
    return 1000;
  }

  private computeRealPools(pools: Record<string, number>, seedPools?: Record<string, number>): Record<string, number> | undefined {
    if (!seedPools) return undefined;
    return {
      home: Math.max(0, (pools.home || 0) - (seedPools.home || 0)),
      draw: Math.max(0, (pools.draw || 0) - (seedPools.draw || 0)),
      away: Math.max(0, (pools.away || 0) - (seedPools.away || 0)),
    };
  }

  private computeRealLiabilities(liabilities: Record<string, number> | undefined, seedPools?: Record<string, number>, initialOdds?: Record<string, number>): Record<string, number> | undefined {
    if (!liabilities) return undefined;
    if (!seedPools) return liabilities;
    const sl = this.computeSeedLiabilities(seedPools, initialOdds);
    return {
      home: Math.max(0, (liabilities.home || 0) - (sl.home || 0)),
      draw: Math.max(0, (liabilities.draw || 0) - (sl.draw || 0)),
      away: Math.max(0, (liabilities.away || 0) - (sl.away || 0)),
    };
  }

  private computeSeedLiabilities(seedPools: Record<string, number>, initialOdds?: Record<string, number>): Record<string, number> {
    if (!initialOdds) return { home: 0, draw: 0, away: 0 };
    return {
      home: (seedPools.home || 0) * (initialOdds.home || 0),
      draw: (seedPools.draw || 0) * (initialOdds.draw || 0),
      away: (seedPools.away || 0) * (initialOdds.away || 0),
    };
  }

  public getAdjustedProbs(initialProbs: Record<string, number>, score: string | null, liveMinute: number | undefined, status: string): Record<string, number> {
    if (!score || status === 'upcoming' || !liveMinute || liveMinute <= 0) return initialProbs;
    const parts = score.split('-');
    const homeGoals = parseInt(parts[0], 10), awayGoals = parseInt(parts[1], 10);
    if (isNaN(homeGoals) || isNaN(awayGoals)) return initialProbs;
    const goalDiff = awayGoals - homeGoals, remainingMinutes = Math.max(1, 90 - liveMinute);
    const result = { ...initialProbs };
    if (goalDiff === 0) {
      const timeRatio = liveMinute / 90, drawAdjust = Math.min(0.95, timeRatio * 0.98);
      result.draw = initialProbs.draw + (0.99 - initialProbs.draw) * drawAdjust;
      result.home = initialProbs.home * (1 - drawAdjust);
      result.away = initialProbs.away * (1 - drawAdjust);
    } else {
      const absDiff = Math.abs(goalDiff), difficultyScore = absDiff / Math.sqrt(Math.max(0.1, remainingMinutes / 45));
      const adjustment = Math.min(0.95, difficultyScore / (difficultyScore + 1.5));
      if (goalDiff > 0) {
        result.away = initialProbs.away + (0.99 - initialProbs.away) * adjustment;
        result.draw = initialProbs.draw * (1 - adjustment);
        result.home = initialProbs.home * (1 - adjustment);
      } else {
        result.home = initialProbs.home + (0.99 - initialProbs.home) * adjustment;
        result.draw = initialProbs.draw * (1 - adjustment);
        result.away = initialProbs.away * (1 - adjustment);
      }
    }
    const total = result.home + result.draw + result.away;
    if (total === 0) return initialProbs;
    result.home /= total; result.draw /= total; result.away /= total;
    return result;
  }

  private calculateParimutuelOdds(pools: Record<string, number>, option: string, returnRate: number, minOdds: number): number {
    const totalPool = this.sumPools(pools);
    const optPool = pools[option] || 0;
    if (totalPool === 0) return minOdds;
    if (optPool === 0) {
      const virtualBet = 0.01;
      return parseFloat(((totalPool + virtualBet) * returnRate / virtualBet).toFixed(4));
    }
    const raw = (totalPool * returnRate) / optPool;
    const v = parseFloat(raw.toFixed(4));
    return v < minOdds ? minOdds : v;
  }

  private calculateBlendedOdds(pools: Record<string, number>, option: string, returnRate: number, minOdds: number, initialProbs: Record<string, number>, effectiveK: number): number {
    const totalPool = this.sumPools(pools);
    const optPool = pools[option] || 0;
    if (totalPool === 0 || optPool === 0) return minOdds;
    const safeMax = (totalPool * returnRate) / optPool;
    const prior = initialProbs[option];
    if (!prior) {
      const raw = parseFloat(safeMax.toFixed(4));
      return raw < minOdds ? minOdds : raw;
    }
    const marketProb = optPool / totalPool;
    const weight = 1 / (1 + totalPool / effectiveK);
    const blendedProb = weight * prior + (1 - weight) * marketProb;
    const overround = 1 / returnRate;
    const blendedOdds = 1 / (blendedProb * overround);
    const final = Math.min(blendedOdds, safeMax);
    const raw = parseFloat(final.toFixed(4));
    return raw < minOdds ? minOdds : raw;
  }

  /** @deprecated */
  public calculateOdds(poolAmounts: Record<string, number>, selectedOption: string): number {
    return this.calculateParimutuelOdds(poolAmounts, selectedOption, this.baseReturnRate, 1.01);
  }

  /** @deprecated */
  public calculateSlippage(poolAmounts: Record<string, number>, betAmount: number, selectedOption: string): number {
    const c = this.calculateOdds(poolAmounts, selectedOption);
    const n = { ...poolAmounts }; n[selectedOption] += betAmount;
    return ((this.calculateOdds(n, selectedOption) - c) / c) * 100;
  }
}
