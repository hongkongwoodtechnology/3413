const fs = require('fs');
const path = require('path');

// ============================================================
// COLD-START ANALYSIS: Small Pool Odds Stability
// ============================================================

const HOUSE_EDGE   = 0.08;
const RETURN_RATE  = 1 - HOUSE_EDGE;
const PRIOR_PROBS  = { home: 0.45, draw: 0.27, away: 0.28 };
const MIN_ODDS     = 1.01;

function usd(v)  { return v >= 1e6 ? '$'+(v/1e6).toFixed(2)+'M' : '$'+(v/1e3).toFixed(1)+'K'; }
function pct(v)  { return (v*100).toFixed(1)+'%'; }
function odds(v) { return v.toFixed(2); }

// Blended odds formula (replicates calculateSafeBlendedOdds)
function blendedOdds(optPools, selected, stiffnessK, priorProbs) {
  const total = optPools.home + optPools.draw + optPools.away;
  const opt = selected;
  const optPool = optPools[opt] || 0;
  const priorProb = priorProbs[opt];
  
  if (total === 0 || optPool === 0) return MIN_ODDS;
  
  // Safety cap
  const safeMax = (total * RETURN_RATE) / optPool;
  
  if (!priorProb) {
    return Math.max(MIN_ODDS, Math.min(safeMax, 999));
  }
  
  const marketProb = optPool / total;
  const weight = 1 / (1 + total / stiffnessK);
  const blendedProb = weight * priorProb + (1 - weight) * marketProb;
  
  const overround = 1 / RETURN_RATE;
  const base = 1 / (blendedProb * overround);
  
  const final = Math.min(base, safeMax);
  const raw = final < MIN_ODDS ? MIN_ODDS : parseFloat(final.toFixed(2));
  return raw;
}

console.log('='.repeat(90));
console.log('  COLD-START ANALYSIS: Small Pool Odds Stability');
console.log('  Probability Modeler / Sports Quant');
console.log('='.repeat(90));

// ============================================================
// 1. CURRENT STATE: Analyse how odds evolve with pool size
// ============================================================
console.log('\n[1] CURRENT ENGINE: Odds evolution as pool grows (K=200)');
console.log('    Assumption: ALL bets on HOME, prior={H:45%,D:27%,A:28%}');
console.log('');

console.log('  Pool Size   H%      D%      A%     H-Odds  D-Odds  A-Odds  K-Weight');
console.log('  ' + '-'.repeat(74));

const poolSizes = [0, 10, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 50000, 100000, 500000, 1000000];

for (const size of poolSizes) {
  const K = 200;
  const pools = { home: size, draw: 0, away: 0 };
  const hO = blendedOdds(pools, 'home', K, PRIOR_PROBS);
  const dO = blendedOdds(pools, 'draw', K, PRIOR_PROBS);
  const aO = blendedOdds(pools, 'away', K, PRIOR_PROBS);
  const hP = size > 0 ? 100 : 0, dP = 0, aP = 0;
  const weight = 1 / (1 + size / K);
  console.log('  ' + usd(size).padStart(8) + '  ' + pct(hP/100).padStart(5) +
    '  ' + pct(dP/100).padStart(5) + '  ' + pct(aP/100).padStart(5) +
    '  ' + odds(hO).padStart(6) + '  ' + odds(dO).padStart(6) +
    '  ' + odds(aO).padStart(6) + '  ' + weight.toFixed(3));
}

// ============================================================
// 2. PROBLEM: First bet REJECTED (opponentPool = 0)
// ============================================================
console.log('\n[2] PROBLEM: First bet on empty pool → opponentPool=0 → REJECTED');
console.log('');

for (const size of [0, 1, 10, 50, 100]) {
  const pools = { home: size, draw: 0, away: 0 };
  const opp = pools.draw + pools.away;
  console.log('  Pool=' + usd(size) + ' | opponentPool=' + usd(opp) + ' → ' +
    (opp <= 0 ? 'REJECTED (opponentPool=0)' : 'ACCEPTED'));
}

// ============================================================
// 3. SOLUTION A: DYNAMIC K (Adaptive Stiffness)
// ============================================================
console.log('\n' + '='.repeat(90));
console.log('[3] SOLUTION A: DYNAMIC K — Adaptive Blending by Pool Size');
console.log('    Small pool → small K → higher prior weight → more stable');
console.log('    Large pool → large K → higher market weight → more parimutuel');
console.log('='.repeat(90));

function adaptiveK(poolSize) {
  if (poolSize <= 100)   return 10;
  if (poolSize <= 1000)  return 50;
  if (poolSize <= 10000) return 200;
  if (poolSize <= 100000) return 500;
  return 2000;
}

console.log('\n  Pool Size   FixedK   Weight(Fixed)  AdaptK  Weight(Adapt)  H-Odds(Fixed)  H-Odds(Adapt)');
console.log('  ' + '-'.repeat(88));

for (const size of poolSizes.filter(s => s >= 0 && s <= 100000)) {
  const fixK = 200;
  const adpK = adaptiveK(size);
  const pools = { home: Math.max(size, 0.01), draw: 0.01, away: 0.01 };
  
  const wFixed = 1 / (1 + (pools.home + pools.draw + pools.away) / fixK);
  const wAdapt = 1 / (1 + (pools.home + pools.draw + pools.away) / adpK);
  
  const hFix = blendedOdds(pools, 'home', fixK, PRIOR_PROBS);
  const hAdp = blendedOdds(pools, 'home', adpK, PRIOR_PROBS);
  
  console.log('  ' + usd(size).padStart(8) + '   ' + String(fixK).padStart(6) +
    '  ' + wFixed.toFixed(3).padStart(13) +
    '   ' + String(adpK).padStart(6) +
    '  ' + wAdapt.toFixed(3).padStart(13) +
    '  ' + odds(hFix).padStart(13) +
    '  ' + odds(hAdp).padStart(13));
}

// ============================================================
// 4. SOLUTION B: SEED POOL OPTIMIZATION
// ============================================================
console.log('\n' + '='.repeat(90));
console.log('[4] SOLUTION B: SEED POOL — Platform injects minimum stakes');
console.log('    Ensures opponentPool > 0 even for first bet');
console.log('    Also provides "display odds" that look natural');
console.log('='.repeat(90));

const seedLevels = [
  { perOpt: 0.01, label: '$0.01 each (virtual)' },
  { perOpt: 1, label: '$1 each' },
  { perOpt: 5, label: '$5 each' },
  { perOpt: 10, label: '$10 each' },
  { perOpt: 50, label: '$50 each' },
  { perOpt: 100, label: '$100 each' },
];

console.log('\n  Scenario: NO user bets (empty pool), just seed');
console.log('  Seed/Option  TotalPool  H-Odds  D-Odds  A-Odds  OpponentPool OK?');
console.log('  ' + '-'.repeat(68));

for (const s of seedLevels) {
  const pools = { home: s.perOpt, draw: s.perOpt, away: s.perOpt };
  const total = s.perOpt * 3;
  const hO = blendedOdds(pools, 'home', 200, PRIOR_PROBS);
  const dO = blendedOdds(pools, 'draw', 200, PRIOR_PROBS);
  const aO = blendedOdds(pools, 'away', 200, PRIOR_PROBS);
  const oppOK = (pools.draw + pools.away) > 0;
  
  console.log('  ' + s.label.padEnd(16) +
    '  ' + usd(total).padStart(8) +
    '  ' + odds(hO).padStart(6) +
    '  ' + odds(dO).padStart(6) +
    '  ' + odds(aO).padStart(6) +
    '  ' + usd(pools.draw + pools.away).padStart(8) +
    '  ' + (oppOK ? 'YES' : 'NO'));
}

// What about first real bet on top of seed?
console.log('\n  Scenario: Seed=$10 each + First user bets $100 on HOME');
console.log('  User Bet   TotalPool  H-Odds  D-Odds  A-Odds  OpponentPool');
console.log('  ' + '-'.repeat(68));

for (const s of seedLevels) {
  const pools = { home: s.perOpt + 100, draw: s.perOpt, away: s.perOpt };
  const total = s.perOpt * 3 + 100;
  const hO = blendedOdds(pools, 'home', 200, PRIOR_PROBS);
  const dO = blendedOdds(pools, 'draw', 200, PRIOR_PROBS);
  const aO = blendedOdds(pools, 'away', 200, PRIOR_PROBS);
  
  console.log('  ' + ('$' + 100).padStart(8) +
    '  ' + usd(total).padStart(8) +
    '  ' + odds(hO).padStart(6) +
    '  ' + odds(dO).padStart(6) +
    '  ' + odds(aO).padStart(6) +
    '  ' + usd(pools.draw + pools.away).padStart(10));
}

// ============================================================
// 5. SOLUTION C: FIXED-ODDS FLOOR (Prior-Only Pricing)
// ============================================================
console.log('\n' + '='.repeat(90));
console.log('[5] SOLUTION C: PRIOR-ONLY PRICING — Pure fixed-odds at cold start');
console.log('    Below threshold, ignore market and use 100% prior probabilities');
console.log('    Transition to blended above threshold');
console.log('='.repeat(90));

console.log('\n  Prior-only odds (from base rates H=45% D=27% A=28%, 8% margin):');
const overround = 1 / RETURN_RATE;
const priorOnly = {
  home: 1 / (PRIOR_PROBS.home * overround),
  draw: 1 / (PRIOR_PROBS.draw * overround),
  away: 1 / (PRIOR_PROBS.away * overround),
};
console.log('    H: ' + priorOnly.home.toFixed(2) + ' | D: ' + priorOnly.draw.toFixed(2) + ' | A: ' + priorOnly.away.toFixed(2));

const thresholds = [0, 100, 500, 1000, 5000, 10000, 50000];
console.log('\n  Transition from fixed-odds → blended-odds as pool grows:');
console.log('  Pool Size   Mode          H-Odds  D-Odds  A-Odds');
console.log('  ' + '-'.repeat(52));

for (const th of thresholds) {
  const pools = { home: th, draw: th, away: th };
  const total = th * 3;
  const mode = total < 300 ? 'FIXED (prior)' : 'BLENDED';
  const hO = blendedOdds(pools, 'home', total < 300 ? 0 : 200, PRIOR_PROBS);
  const dO = blendedOdds(pools, 'draw', total < 300 ? 0 : 200, PRIOR_PROBS);
  const aO = blendedOdds(pools, 'away', total < 300 ? 0 : 200, PRIOR_PROBS);
  
  console.log('  ' + usd(total).padStart(8) +
    '  ' + mode.padEnd(13) +
    '  ' + odds(hO).padStart(6) +
    '  ' + odds(dO).padStart(6) +
    '  ' + odds(aO).padStart(6));
}

// ============================================================
// 6. WALK-FORWARD: Bet-by-bet simulation
// ============================================================
console.log('\n' + '='.repeat(90));
console.log('[6] WALK-FORWARD SIMULATION: 5 bets on HOME, starting from $0');
console.log('    Compare 3 strategies: Fixed K=200 | Dynamic K | Seed+DynamicK');
console.log('='.repeat(90));

const betSequence = [5, 10, 25, 50, 100]; // sequential HOME bets
const strategies = [
  { name: 'Fixed K=200, No Seed',       K: () => 200, seed: 0 },
  { name: 'Dynamic K, No Seed',          K: size => adaptiveK(size * 3), seed: 0 },
  { name: 'Dynamic K, Seed=$10 each',    K: size => adaptiveK(size * 3 + 30), seed: 10 },
];

for (const strat of strategies) {
  console.log('\n  --- ' + strat.name + ' ---');
  console.log('  Bet#   Bet Amt   TotalPool  H%      D%      A%     H-Odds  D-Odds  A-Odds  K-Value  PriorWt');
  console.log('  ' + '-'.repeat(92));
  
  let pools = { home: strat.seed, draw: strat.seed, away: strat.seed };
  
  for (let i = 0; i < betSequence.length; i++) {
    const bet = betSequence[i];
    pools.home += bet;
    const total = pools.home + pools.draw + pools.away;
    const K = strat.K(total / 3);
    
    const hO = blendedOdds(pools, 'home', K, PRIOR_PROBS);
    const dO = blendedOdds(pools, 'draw', K, PRIOR_PROBS);
    const aO = blendedOdds(pools, 'away', K, PRIOR_PROBS);
    const weight = 1 / (1 + total / K);
    
    console.log('  ' + String(i + 1).padStart(3) +
      '    ' + usd(bet).padStart(7) +
      '    ' + usd(total).padStart(8) +
      '  ' + pct(pools.home/total).padStart(5) +
      '  ' + pct(pools.draw/total).padStart(5) +
      '  ' + pct(pools.away/total).padStart(5) +
      '  ' + odds(hO).padStart(6) +
      '  ' + odds(dO).padStart(6) +
      '  ' + odds(aO).padStart(6) +
      '  ' + String(K).padStart(7) +
      '  ' + weight.toFixed(3).padStart(8));
  }
  
  // Odds volatility (std dev of H odds across bets)
  const hOddsSeries = [];
  pools = { home: strat.seed, draw: strat.seed, away: strat.seed };
  for (const bet of betSequence) {
    pools.home += bet;
    const K = strat.K((pools.home + pools.draw + pools.away) / 3);
    hOddsSeries.push(blendedOdds(pools, 'home', K, PRIOR_PROBS));
  }
  const mean = hOddsSeries.reduce((a,b)=>a+b,0) / hOddsSeries.length;
  const variance = hOddsSeries.reduce((s,o) => s + (o-mean)**2, 0) / hOddsSeries.length;
  console.log('  H-Odds volatility (σ): ' + Math.sqrt(variance).toFixed(3) +
    ' (lower = more stable)');
}

// ============================================================
// 7. COMPREHENSIVE ODDS STABILITY BY TOTAL POOL
// ============================================================
console.log('\n' + '='.repeat(90));
console.log('[7] ODDS STABILITY: How much a $100 bet moves odds vs pool size');
console.log('    Impact = |old odds - new odds| after $100 bet on HOME');
console.log('='.repeat(90));

console.log('\n  Initial Pool  K-Mode    Before  After   Δ-Odds  Stability');
console.log('  ' + '-'.repeat(66));

const impactSizes = [30, 100, 300, 500, 1000, 2000, 5000, 10000, 50000, 100000];
for (const size of impactSizes) {
  const pools = { home: size/3, draw: size/3, away: size/3 };
  const K = adaptiveK(size);
  const before = blendedOdds(pools, 'home', K, PRIOR_PROBS);
  
  pools.home += 100;
  const after = blendedOdds(pools, 'home', K, PRIOR_PROBS);
  const delta = Math.abs(after - before);
  const stable = delta < 0.05 ? '★★★★★' : delta < 0.10 ? '★★★★' : delta < 0.20 ? '★★★' : delta < 0.50 ? '★★' : '★';
  
  console.log('  ' + usd(size).padStart(10) +
    '  ' + (K < 50 ? 'TIGHT' : K < 200 ? 'MEDIUM' : 'LOOSE').padStart(7) +
    '  ' + odds(before).padStart(6) +
    '  ' + odds(after).padStart(6) +
    '  ' + delta.toFixed(3).padStart(7) +
    '  ' + stable);
}

// ============================================================
// 8. RECOMMENDED COLD-START STRATEGY
// ============================================================
console.log('\n' + '='.repeat(90));
console.log('[8] RECOMMENDED 3-PHASE COLD-START STRATEGY');
console.log('='.repeat(90));

console.log(`
  ┌──────────────────────────────────────────────────────────────────────────┐
  │ PHASE 1: SEEDING ($0–$300 total pool)                                    │
  │ ───────────────────────────────────────────────────────────              │
  │ • Platform seeds $10 on each of H/D/A (total $30/market)                  │
  │ • Odds displayed = 100% prior probability based (stable, natural)         │
  │ • K=0 (infinitely stiff → pure prior odds)                                │
  │ • First bet ALWAYS accepted (opponentPool = $20 > 0)                      │
  │ • UX: "Platform-seeded odds" indicator shown                              │
  └──────────────────────────────────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────────────────────────────────┐
  │ PHASE 2: WARM-UP ($300–$10,000 total pool)                               │
  │ ───────────────────────────────────────────────────────────              │
  │ • Dynamic K ramps from K=10 to K=200                                      │
  │ • Prior weight: 75% → 50% → 20% as pool grows                            │
  │ • Odds gradually shift from prior-based to market-based                   │
  │ • Seed pool still present for counterparty guarantee                      │
  │ • UX: "Liquidity building" indicator                                     │
  └──────────────────────────────────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────────────────────────────────┐
  │ PHASE 3: MATURE ($$10,000+ total pool)                                   │
  │ ───────────────────────────────────────────────────────────              │
  │ • Fixed K=200 (or configured)                                             │
  │ • Full parimutuel + prior blend (standard mode)                           │
  │ • Seed pool removed or reduced to symbolic                                │
  │ • UX: Normal operation (no indicators)                                    │
  └──────────────────────────────────────────────────────────────────────────┘
`);

console.log('='.repeat(90));
console.log('Analysis complete.');
console.log('='.repeat(90));
