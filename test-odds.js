// 測試賠率計算
const { DynamicOddsEngine } = require('./src/lib/odds-engine.ts');

const engine = new DynamicOddsEngine(0.08, 200);

// 模擬第一個投注者投了 10 USDT 到主勝
const poolsAfterFirstBet = {
  home: 10,
  draw: 0,
  away: 0
};

console.log('=== 第一個投注者投注後 (home=10) ===');
console.log('Pools:', poolsAfterFirstBet);

const odds1 = engine.calculateAllDisplayOdds(
  poolsAfterFirstBet,
  undefined,
  undefined,
  null,
  undefined,
  'upcoming',
  0.92
);
console.log('賠率:', odds1);

// 模擬第二個投注者輸入 5 USDT 到主勝
const projectedPools = {
  home: 10 + 5,  // 15
  draw: 0,
  away: 0
};

console.log('\n=== 第二個投注者輸入 5 USDT 到主勝後 ===');
console.log('Projected Pools:', projectedPools);

const odds2 = engine.calculateAllDisplayOdds(
  projectedPools,
  undefined,
  undefined,
  null,
  undefined,
  'upcoming',
  0.92
);
console.log('賠率:', odds2);

// 模擬第二個投注者輸入 5 USDT 到和局
const projectedPoolsDraw = {
  home: 10,
  draw: 5,
  away: 0
};

console.log('\n=== 第二個投注者輸入 5 USDT 到和局後 ===');
console.log('Projected Pools:', projectedPoolsDraw);

const odds3 = engine.calculateAllDisplayOdds(
  projectedPoolsDraw,
  undefined,
  undefined,
  null,
  undefined,
  'upcoming',
  0.92
);
console.log('賠率:', odds3);
