const fs = require('fs');
const path = require('path');

// ============================================================
// $10,000,000 Betting Pool - H/D/A Distribution Analysis
// Pure theoretical: "All possible ways $10M can be split across 3 outcomes"
// Probability Modeler / Sports Quantitative Analyst perspective
// ============================================================

const TOTAL_POOL   = 10_000_000;
const HOUSE_EDGE   = 0.08;
const RETURN_RATE  = 1 - HOUSE_EDGE;   // 0.92
const MIN_ODDS     = 1.01;
const STEP         = 0.01;
const N            = 100;               // 100 steps = 1% granularity

const OUTCOMES = ['home','draw','away'];

function pct(v)  { return (v*100).toFixed(1)+'%'; }
function usd(v)  { return '$'+(v/1e6).toFixed(4)+'M'; }
function fmt(v)  { return (typeof v === 'number' && isFinite(v)) ? v.toFixed(2) : '---'; }

// ============================================================
// ENUMERATE ALL 5,151 DISTRIBUTIONS
// ============================================================
console.log('='.repeat(82));
console.log('  $10,000,000 POOL: ALL POSSIBLE H/D/A DISTRIBUTIONS');
console.log('  Probability Modeler / Sports Quant Analysis');
console.log('  Granularity: 1% steps  |  House Edge: 8%  |  Min Odds: 1.01');
console.log('='.repeat(82));

const all = [];
for (let hi = 0; hi <= N; hi++) {
  for (let di = 0; di <= N - hi; di++) {
    const ai = N - hi - di;
    const hp = hi / N, dp = di / N, ap = ai / N;
    const hA = hp * TOTAL_POOL, dA = dp * TOTAL_POOL, aA = ap * TOTAL_POOL;

    // ---- PARIMUTUEL FAIR ODDS ----
    const fairH = hp>0 ? 1/hp : Infinity, fairD = dp>0 ? 1/dp : Infinity, fairA = ap>0 ? 1/ap : Infinity;

    // ---- OFFERED ODDS (8% margin, floor 1.01) ----
    const rawH = hp>0 ? RETURN_RATE/hp : 999, rawD = dp>0 ? RETURN_RATE/dp : 999, rawA = ap>0 ? RETURN_RATE/ap : 999;
    const offH = Math.max(MIN_ODDS, rawH), offD = Math.max(MIN_ODDS, rawD), offA = Math.max(MIN_ODDS, rawA);

    // ---- LIABILITIES ----
    const liabH = hA * offH, liabD = dA * offD, liabA = aA * offA;

    // ---- PLATFORM P&L PER OUTCOME ----
    const pnlH = TOTAL_POOL - liabH, pnlD = TOTAL_POOL - liabD, pnlA = TOTAL_POOL - liabA;

    // ---- WORST CASE ----
    const worstPnl = Math.min(pnlH, pnlD, pnlA);
    const bestPnl  = Math.max(pnlH, pnlD, pnlA);
    const riskRatio = Math.max(liabH,liabD,liabA) / TOTAL_POOL;

    // ---- CONCENTRATION ----
    const maxConc  = Math.max(hp,dp,ap);
    const minConc  = Math.min(hp,dp,ap);
    const hhi      = hp*hp + dp*dp + ap*ap;

    // ---- CLASSIFICATION ----
    let riskLabel = 'safe';
    if (worstPnl < -500000)      riskLabel = 'critical';
    else if (worstPnl < 0)       riskLabel = 'loss';
    else if (worstPnl < 200000)  riskLabel = 'thin';
    else if (worstPnl < 800000)  riskLabel = 'good';
    else                         riskLabel = 'max';

    let concLabel = 'balanced';
    if (maxConc >= 0.90)      concLabel = 'extreme';
    else if (maxConc >= 0.70) concLabel = 'heavy';
    else if (maxConc >= 0.50) concLabel = 'moderate';

    // ---- BREAKEVEN FRONTIER ----
    // Parimutuel odds without floor would be < 1.01 when:
    //   RETURN_RATE / p < 1.01  =>  p > RETURN_RATE / 1.01 = 0.92/1.01 ≈ 0.91089
    const needsFloorH = hp > RETURN_RATE/MIN_ODDS;
    const needsFloorD = dp > RETURN_RATE/MIN_ODDS;
    const needsFloorA = ap > RETURN_RATE/MIN_ODDS;

    all.push({
      hp,dp,ap, hA,dA,aA,
      fairH,fairD,fairA,
      offH,offD,offA,
      liabH,liabD,liabA,
      pnlH,pnlD,pnlA,
      worstPnl,bestPnl,riskRatio,
      maxConc,minConc,hhi,
      riskLabel,concLabel,
      needsFloorH,needsFloorD,needsFloorA
    });
  }
}

console.log('\nTotal distributions enumerated: ' + all.length);
console.log('(Stars and Bars: C(100+2, 2) = C(102, 2) = 5,151)\n');

// ============================================================
// SECTION 1: COMBINATORIAL SPACE OVERVIEW
// ============================================================
console.log('='.repeat(82));
console.log('SECTION 1: COMBINATORIAL SPACE');
console.log('='.repeat(82));

console.log('\n  Exact space (discrete $1 units):');
console.log('    C(10,000,000 + 3 - 1, 3 - 1) = C(10,000,002, 2)');
console.log('    = 50,000,015,000,001 distributions (~5.0 x 10^13)');

console.log('\n  Approximate space by granularity:');
[
  { g:'10% (10 steps)', n:10  },
  { g:'5%  (20 steps)', n:20  },
  { g:'2%  (50 steps)', n:50  },
  { g:'1%  (100 steps)',n:100 },
  { g:'0.5%(200 steps)',n:200 },
  { g:'0.1%(1000 steps)',n:1000}
].forEach(x => {
  let BigN = BigInt(x.n), combos = (BigN+2n)*(BigN+1n)/2n;
  console.log('    ' + x.g.padEnd(18) + ' -> C('+(x.n+2)+',2) = ' + Number(combos).toLocaleString());
});

// ============================================================
// SECTION 2: FULL STATISTICAL SUMMARY
// ============================================================
console.log('\n' + '='.repeat(82));
console.log('SECTION 2: STATISTICAL SUMMARY OF ALL 5,151 DISTRIBUTIONS');
console.log('='.repeat(82));

const buckets = { critical:0, loss:0, thin:0, good:0, max:0 };
const concBuckets = { extreme:0, heavy:0, moderate:0, balanced:0 };
all.forEach(d => { buckets[d.riskLabel]++; concBuckets[d.concLabel]++; });

const total = all.length;

console.log('\n  --- Risk Profile Distribution ---');
console.log('  CRITICAL (loss >$500K):  ' + String(buckets.critical).padStart(5) + '  (' + (buckets.critical/total*100).toFixed(1) + '%)');
console.log('  LOSS     (loss $0-$500K): ' + String(buckets.loss).padStart(5)     + '  (' + (buckets.loss/total*100).toFixed(1)     + '%)');
console.log('  THIN     (profit <$200K): ' + String(buckets.thin).padStart(5)     + '  (' + (buckets.thin/total*100).toFixed(1)     + '%)');
console.log('  GOOD     (profit $200-800K):'+ String(buckets.good).padStart(4)    + '  (' + (buckets.good/total*100).toFixed(1)    + '%)');
console.log('  MAX      (profit $800K):   ' + String(buckets.max).padStart(5)     + '  (' + (buckets.max/total*100).toFixed(1)     + '%)');
console.log('  ALWAYS PROFITABLE:        ' + String(buckets.good+buckets.max).padStart(5)+'  ('+((buckets.good+buckets.max)/total*100).toFixed(1)+'%)');
console.log('  POTENTIAL LOSS:           ' + String(buckets.critical+buckets.loss).padStart(5)+'  ('+((buckets.critical+buckets.loss)/total*100).toFixed(1)+'%)');

console.log('\n  --- Concentration Distribution ---');
console.log('  EXTREME  (max >= 90%):   ' + String(concBuckets.extreme).padStart(5)  + '  (' + (concBuckets.extreme/total*100).toFixed(1)  + '%)');
console.log('  HEAVY    (max 70-90%):   ' + String(concBuckets.heavy).padStart(5)    + '  (' + (concBuckets.heavy/total*100).toFixed(1)    + '%)');
console.log('  MODERATE (max 50-70%):   ' + String(concBuckets.moderate).padStart(5)  + '  (' + (concBuckets.moderate/total*100).toFixed(1)  + '%)');
console.log('  BALANCED (max < 50%):    ' + String(concBuckets.balanced).padStart(5)  + '  (' + (concBuckets.balanced/total*100).toFixed(1)  + '%)');

// P&L stats
const worstPnls = all.map(d=>d.worstPnl).sort((a,b)=>a-b);
const bestPnls  = all.map(d=>d.bestPnl).sort((a,b)=>a-b);
const p5  = Math.floor(total*0.05);
const p50 = Math.floor(total*0.50);
const p95 = Math.floor(total*0.95);

console.log('\n  --- Platform Worst-Case P&L (5,151 scenarios) ---');
console.log('  Absolute Worst:           ' + usd(worstPnls[0]));
console.log('  5th Percentile:           ' + usd(worstPnls[p5]));
console.log('  Median:                   ' + usd(worstPnls[p50]));
console.log('  95th Percentile:          ' + usd(worstPnls[p95]));
console.log('  Best guaranteed profit:   ' + usd(worstPnls[total-1]));
console.log('  Absolute Best (all cash): ' + usd(bestPnls[total-1]));

const riskRatios = all.map(d=>d.riskRatio).sort((a,b)=>a-b);
console.log('\n  --- Risk Ratio (Max Liability / Total Pool) ---');
console.log('  Minimum:                  ' + riskRatios[0].toFixed(2) + 'x');
console.log('  95th Percentile:          ' + riskRatios[p95].toFixed(2) + 'x');
console.log('  Maximum:                  ' + riskRatios[total-1].toFixed(2) + 'x');

// ============================================================
// SECTION 3: KEY SCENARIOS (TABLE)
// ============================================================
console.log('\n' + '='.repeat(82));
console.log('SECTION 3: KEY SCENARIOS - ODDS & PLATFORM EXPOSURE');
console.log('='.repeat(82));

const scenarioDefs = [
  {label:'PERFECT BALANCE',           cond: d=>d.hp===0.33&&d.dp===0.33&&d.ap===0.34},
  {label:'EXTREME H (100% on Home)',  cond: d=>d.hp===1},
  {label:'EXTREME D (100% on Draw)',  cond: d=>d.dp===1},
  {label:'EXTREME A (100% on Away)',  cond: d=>d.ap===1},
  {label:'H HEAVY (70% Home)',        cond: d=>d.hp===0.70&&d.dp===0.15&&d.ap===0.15},
  {label:'D HEAVY (70% Draw)',        cond: d=>d.hp===0.15&&d.dp===0.70&&d.ap===0.15},
  {label:'A HEAVY (70% Away)',        cond: d=>d.hp===0.15&&d.dp===0.15&&d.ap===0.70},
  {label:'H+D HEDGE (40/40)',         cond: d=>d.hp===0.40&&d.dp===0.40&&d.ap===0.20},
  {label:'H+A HEDGE (40/40)',         cond: d=>d.hp===0.40&&d.dp===0.20&&d.ap===0.40},
  {label:'BREAKEVEN BOUNDARY (91% H)',cond: d=>d.hp===0.91&&d.dp===0.05&&d.ap===0.04},
  {label:'PLATFORM WORST',            cond: d=>d.worstPnl===Math.min(...all.map(x=>x.worstPnl))},
  {label:'PLATFORM BEST',             cond: d=>d.worstPnl===Math.max(...all.map(x=>x.worstPnl))},
];

console.log('\n  Distribution      H%     D%     A%    H-Odds D-Odds A-Odds  WorstPnl Risk');
console.log('  ' + '-'.repeat(76));

for (const s of scenarioDefs) {
  const found = all.filter(s.cond);
  if (found.length === 0) continue;
  const d = found[0];
  const label = s.label.padEnd(17);
  const hPct  = pct(d.hp).padStart(5);
  const dPct  = pct(d.dp).padStart(5);
  const aPct  = pct(d.ap).padStart(5);
  const hO    = fmt(d.offH).padStart(5);
  const dO    = fmt(d.offD).padStart(5);
  const aO    = fmt(d.offA).padStart(5);
  const wPnl  = usd(d.worstPnl).padStart(7);
  const risk  = d.riskRatio.toFixed(2)+'x';
  const flag  = d.worstPnl < 0 ? ' !LOSS!' : '';
  console.log('  ' + label + ' ' + hPct + ' ' + dPct + ' ' + aPct + '  ' + hO + ' ' + dO + ' ' + aO + '  ' + wPnl + ' ' + risk + flag);
}

// ============================================================
// SECTION 4: BREAKEVEN ANALYSIS
// ============================================================
console.log('\n' + '='.repeat(82));
console.log('SECTION 4: BREAKEVEN / LOSS FRONTIER');
console.log('='.repeat(82));

console.log('\n  Parimutuel odds floor at ' + MIN_ODDS + '. Platform loses when:');
console.log('    RETURN_RATE / concentration < MIN_ODDS');
console.log('    => concentration > RETURN_RATE / MIN_ODDS');
console.log('    => concentration > ' + (RETURN_RATE/MIN_ODDS).toFixed(4));
console.log('    => Any option with >' + (RETURN_RATE/MIN_ODDS*100).toFixed(1) + '% of pool triggers loss.');

const lossScenarios = all.filter(d=>d.worstPnl<0);
console.log('\n  Distributions with LOSS: ' + lossScenarios.length + ' / ' + total +
            ' (' + (lossScenarios.length/total*100).toFixed(1) + '%)');

if (lossScenarios.length > 0) {
  console.log('\n  --- Worst 5 Loss Scenarios ---');
  const worst5 = lossScenarios.sort((a,b)=>a.worstPnl-b.worstPnl).slice(0,5);
  console.log('  Rank  H%     D%     A%     H-Odds D-Odds A-Odds  Loss');
  console.log('  ' + '-'.repeat(64));
  worst5.forEach((d,i) => {
    console.log('  #'+(i+1)+'   '+
      pct(d.hp).padStart(5)+' '+pct(d.dp).padStart(5)+' '+pct(d.ap).padStart(5)+'  '+
      fmt(d.offH).padStart(5)+' '+fmt(d.offD).padStart(5)+' '+fmt(d.offA).padStart(5)+'  '+
      usd(d.worstPnl));
  });
}

// ============================================================
// SECTION 5: PLATFORM P&L HEATMAP
// ============================================================
console.log('\n' + '='.repeat(82));
console.log('SECTION 5: PLATFORM WORST-CASE P&L HEATMAP');
console.log('  (X-axis = Draw%, Y-axis = Home%, Away% = 100-Home%-Draw%)');
console.log('='.repeat(82));

const gridSize = 10;
console.log('\n          D=0%  10%   20%   30%   40%   50%   60%   70%   80%   90%  100%');
console.log('  H%     ' + '-'.repeat(67));

for (let hi = 0; hi <= gridSize; hi++) {
  let row = '  ' + String(hi*10+'%').padStart(4) + ' |';
  for (let di = 0; di <= gridSize - hi; di++) {
    const hp = hi/gridSize, dp = di/gridSize;
    const d = all.find(x=>Math.abs(x.hp-hp)<0.005&&Math.abs(x.dp-dp)<0.005);
    if (!d) { row += '     '; continue; }
    if (d.worstPnl >= 750000)       row += '  ++ ';
    else if (d.worstPnl >= 500000)  row += '  +  ';
    else if (d.worstPnl >= 0)       row += '  ~  ';
    else if (d.worstPnl >= -50000)  row += '  -  ';
    else                            row += '  -- ';
  }
  console.log(row);
}
console.log('\n  ++ = safe (>$750K)   + = good ($500-750K)   ~ = thin ($0-500K)   - = loss (<$50K)   -- = critical');

// ============================================================
// SECTION 6: ODDS RANGE BY CONCENTRATION
// ============================================================
console.log('\n' + '='.repeat(82));
console.log('SECTION 6: ODDS RANGE BY CONCENTRATION LEVEL');
console.log('='.repeat(82));

const concentrationLevels = [
  { label:'0-10%',   func: d=>d.maxConc<=0.10 },
  { label:'10-20%',  func: d=>d.maxConc>0.10&&d.maxConc<=0.20 },
  { label:'20-33%',  func: d=>d.maxConc>0.20&&d.maxConc<=0.34 },
  { label:'34-50%',  func: d=>d.maxConc>0.34&&d.maxConc<=0.50 },
  { label:'50-70%',  func: d=>d.maxConc>0.50&&d.maxConc<=0.70 },
  { label:'70-90%',  func: d=>d.maxConc>0.70&&d.maxConc<=0.90 },
  { label:'90-100%', func: d=>d.maxConc>0.90 },
];

console.log('\n  Concentration  Count   H-Odds Range      D-Odds Range      A-Odds Range');
console.log('  ' + '-'.repeat(75));
concentrationLevels.forEach(level => {
  const subset = all.filter(level.func);
  if (subset.length === 0) return;
  const hOdds = subset.filter(d=>d.hp>0).map(d=>d.offH);
  const dOdds = subset.filter(d=>d.dp>0).map(d=>d.offD);
  const aOdds = subset.filter(d=>d.ap>0).map(d=>d.offA);
  const hMin=Math.min(...hOdds), hMax=Math.max(...hOdds);
  const dMin=dOdds.length?Math.min(...dOdds):0, dMax=dOdds.length?Math.max(...dOdds):0;
  const aMin=aOdds.length?Math.min(...aOdds):0, aMax=aOdds.length?Math.max(...aOdds):0;
  console.log('  ' + level.label.padEnd(14) + String(subset.length).padStart(5) +
    '  ' + hMin.toFixed(2)+'-'+hMax.toFixed(2) +
    '  '.padStart(Math.max(0,17-(String(hMin.toFixed(2)).length+String(hMax.toFixed(2)).length+1))) +
    (dOdds.length?'  '+dMin.toFixed(2)+'-'+dMax.toFixed(2):'  n/a') +
    (aOdds.length?'  '+aMin.toFixed(2)+'-'+aMax.toFixed(2):'  n/a'));
});

// ============================================================
// SECTION 7: PER-DISTRIBUTION TABLE (first 30, sorted by worst P&L)
// ============================================================
console.log('\n' + '='.repeat(82));
console.log('SECTION 7: ALL DISTRIBUTIONS SORTED BY PLATFORM SAFETY (worst first)');
console.log('='.repeat(82));

const sorted = [...all].sort((a,b)=>a.worstPnl-b.worstPnl);
console.log('\n  Rank  H%     D%     A%     H-Odds D-Odds A-Odds  WorstPnl    Risk   Status');
console.log('  ' + '-'.repeat(80));

const show = sorted.filter((_,i)=>i<30 || i>=sorted.length-10 || i%200===0).slice(0,60);
show.forEach(d => {
  const idx = all.indexOf(d);
  console.log('  ' + String(idx+1).padStart(4) +
    '  ' + pct(d.hp).padStart(5) + ' ' + pct(d.dp).padStart(5) + ' ' + pct(d.ap).padStart(5) +
    '  ' + fmt(d.offH).padStart(5) + ' ' + fmt(d.offD).padStart(5) + ' ' + fmt(d.offA).padStart(5) +
    '  ' + usd(d.worstPnl).padStart(7) + '  ' + d.riskRatio.toFixed(2)+'x' +
    '  ' + d.riskLabel);
});

// ============================================================
// SECTION 8: LIABILITY EXPOSURE DETAIL
// ============================================================
console.log('\n' + '='.repeat(82));
console.log('SECTION 8: MAXIMUM LIABILITY EXPOSURE ANALYSIS');
console.log('='.repeat(82));

console.log('\n  In a pure parimutuel system with '+(HOUSE_EDGE*100)+'% edge:');
console.log('  Return to winners = '+(RETURN_RATE*100)+'% x Total Pool = ' + usd(TOTAL_POOL*RETURN_RATE));
console.log('');
console.log('  For option X with concentration p:');
console.log('    Fair odds = 1/p');
console.log('    Offered odds = max(1.01, ' + (RETURN_RATE).toFixed(2) + '/p)');
console.log('    Platform liability if X wins = p * $10M * offered odds');
console.log('    Platform P&L = $10M - liability');
console.log('');
console.log('  Break-even point:');
console.log('    p * $10M * 1.01 = $10M  =>  p = 1/1.01 = ' + (1/MIN_ODDS*100).toFixed(1) + '%');
console.log('    But with '+(RETURN_RATE).toFixed(2)+' return: p > ' + (RETURN_RATE/MIN_ODDS*100).toFixed(2) + '% triggers loss');
console.log('');

// Show the critical thresholds
console.log('  Critical concentration thresholds:');
for (let p = 0.85; p <= 1.0; p += 0.01) {
  const raw = RETURN_RATE / p;
  const offered = Math.max(MIN_ODDS, raw);
  const liab = p * TOTAL_POOL * offered;
  const pnl = TOTAL_POOL - liab;
  const marker = pnl < 0 ? ' *** LOSS ***' : '';
  if (Math.abs(p-0.85)<0.005 || Math.abs(p-0.88)<0.005 || Math.abs(p-0.90)<0.005 ||
      Math.abs(p-0.91)<0.005 || Math.abs(p-0.92)<0.005 || Math.abs(p-0.95)<0.005 ||
      Math.abs(p-0.98)<0.005 || Math.abs(p-1.0)<0.005) {
    console.log('    ' + pct(p).padStart(5) + ' on one option -> raw odds=' + raw.toFixed(4) +
      ' offered=' + offered.toFixed(2) + ' liab=' + usd(liab) + ' P&L=' + usd(pnl) + marker);
  }
}

// ============================================================
// EXPORT DATA
// ============================================================
const summary = {
  total_pool: TOTAL_POOL,
  house_edge: HOUSE_EDGE,
  return_rate: RETURN_RATE,
  min_odds: MIN_ODDS,
  granularity: '1%',
  total_distributions: total,
  theoretical_space: '~5.0 x 10^13',
  risk_buckets: buckets,
  concentration_buckets: concBuckets,
  always_profitable: buckets.good + buckets.max,
  potential_loss: buckets.critical + buckets.loss,
  worst_case: {
    distribution: all.find(d=>d.worstPnl===Math.min(...all.map(x=>x.worstPnl))),
    pnl: worstPnls[0]
  },
  breakeven_concentration: RETURN_RATE / MIN_ODDS,
  odds_range: {
    home: [Math.min(...all.filter(d=>d.hp>0).map(d=>d.offH)), Math.max(...all.filter(d=>d.hp>0).map(d=>d.offH))],
    draw: [Math.min(...all.filter(d=>d.dp>0).map(d=>d.offD)), Math.max(...all.filter(d=>d.dp>0).map(d=>d.offD))],
    away: [Math.min(...all.filter(d=>d.ap>0).map(d=>d.offA)), Math.max(...all.filter(d=>d.ap>0).map(d=>d.offA))]
  },
  key_scenarios: scenarioDefs.filter(s=>all.filter(s.cond).length>0).map(s=>{
    const d=all.filter(s.cond)[0];
    return {label:s.label, hp:d.hp,dp:d.dp,ap:d.ap, offH:d.offH,offD:d.offD,offA:d.offA, worstPnl:d.worstPnl, riskRatio:d.riskRatio };
  })
};

fs.writeFileSync(path.join(__dirname, 'data', 'pool_10m_full_report.json'), JSON.stringify(summary, null, 2));
console.log('\n  Report exported: data/pool_10m_full_report.json');

// CSV: all 5,151 rows
const csvRows = ['hp,dp,ap,offH,offD,offA,pnlH,pnlD,pnlA,worstPnl,riskRatio,riskLabel,concLabel'];
all.forEach(d=>{
  csvRows.push([d.hp.toFixed(4),d.dp.toFixed(4),d.ap.toFixed(4),
    d.offH.toFixed(3),d.offD.toFixed(3),d.offA.toFixed(3),
    d.pnlH.toFixed(0),d.pnlD.toFixed(0),d.pnlA.toFixed(0),
    d.worstPnl.toFixed(0),d.riskRatio.toFixed(4),d.riskLabel,d.concLabel].join(','));
});
fs.writeFileSync(path.join(__dirname, 'data', 'pool_10m_all_5151.csv'), csvRows.join('\n'));
console.log('  CSV exported: data/pool_10m_all_5151.csv ('+ (csvRows.length-1) +' rows)');

// ============================================================
// FINAL INSIGHTS
// ============================================================
console.log('\n' + '='.repeat(82));
console.log('KEY INSIGHTS FOR PROBABILITY MODELER');
console.log('='.repeat(82));

console.log(`
  1. COMBINATORIAL SPACE:
     - Exact ($1 units): 5.0 x 10^13 distributions (intractable)
     - 1% granularity:    5,151 distributions (fully computable)

  2. PARIMUTUEL GUARANTEES:
     - With 8% house edge and odds floor of 1.01:
       ${buckets.good+buckets.max} distributions always profit (${((buckets.good+buckets.max)/total*100).toFixed(1)}%)
       ${buckets.critical+buckets.loss} distributions risk loss (${((buckets.critical+buckets.loss)/total*100).toFixed(1)}%)
     - Loss only when one option exceeds ${(RETURN_RATE/MIN_ODDS*100).toFixed(1)}% concentration

  3. ODDS DYNAMICS:
     - H odds range: ${all.filter(d=>d.hp>0).map(d=>d.offH).reduce((a,b)=>Math.min(a,b)).toFixed(2)} ~ ${all.filter(d=>d.hp>0).map(d=>d.offH).reduce((a,b)=>Math.max(a,b)).toFixed(2)}
     - D odds range: ${all.filter(d=>d.dp>0).map(d=>d.offD).reduce((a,b)=>Math.min(a,b)).toFixed(2)} ~ ${all.filter(d=>d.dp>0).map(d=>d.offD).reduce((a,b)=>Math.max(a,b)).toFixed(2)}
     - A odds range: ${all.filter(d=>d.ap>0).map(d=>d.offA).reduce((a,b)=>Math.min(a,b)).toFixed(2)} ~ ${all.filter(d=>d.ap>0).map(d=>d.offA).reduce((a,b)=>Math.max(a,b)).toFixed(2)}

  4. RISK MANAGEMENT:
     - Install position limits: cap any single outcome at 80%
     - Monitor concentration in real-time; auto-pause at 85%+
     - Hedge excess exposure on Betfair/Smarkets exchanges
     - Use Kelly criterion for hedge sizing

  5. OPTIMAL RANGE:
     - Balanced distribution (30-50% each): platform earns steady 8% on all outcomes
     - Risk ratio peaks at ${riskRatios[total-1].toFixed(2)}x in single-option dominance
     - 95th percentile risk ratio: ${riskRatios[p95].toFixed(2)}x
`);

console.log('='.repeat(82));
console.log('Analysis complete. ' + total.toLocaleString() + ' distributions analyzed for $10M pool.');
console.log('='.repeat(82));
