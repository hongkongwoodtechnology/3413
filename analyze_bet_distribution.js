const fs = require('fs');
const path = require('path');

const betsDb = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'bets_db.json'), 'utf-8'));

const OUTCOMES = ['home', 'draw', 'away'];
const LABELS = { home: 'H(主胜)', draw: 'D(和)', away: 'A(客胜)' };

function pad(s, len) { return String(s).padEnd(len); }
function padL(s, len) { return String(s).padStart(len); }

// ============================================================
// 1. Overview
// ============================================================
console.log('='.repeat(80));
console.log('[1. 赌波主客和投注分布 - 完整分析]');
console.log('='.repeat(80));

const allBets = [];
for (const [user, bets] of Object.entries(betsDb)) {
  for (const bet of bets) {
    allBets.push({ ...bet, userAddress: user });
  }
}

const uniqueUsers = [...new Set(allBets.map(b => b.userAddress))];
const uniqueMatches = [...new Set(allBets.map(b => b.matchId))];

console.log('\nTotal Users: ' + uniqueUsers.length);
console.log('Total Matches: ' + uniqueMatches.length);
console.log('Total Bets: ' + allBets.length);

// ============================================================
// 2. Per-user distribution
// ============================================================
console.log('\n' + '='.repeat(80));
console.log('[2. 每位用户的投注分布]');
console.log('='.repeat(80));

for (const user of uniqueUsers) {
  const userBets = allBets.filter(b => b.userAddress === user);
  const dist = { home: { count: 0, amount: 0 }, draw: { count: 0, amount: 0 }, away: { count: 0, amount: 0 } };
  for (const bet of userBets) {
    const o = bet.outcome;
    if (dist[o]) {
      dist[o].count++;
      dist[o].amount += bet.amount;
    }
  }
  const totalAmount = dist.home.amount + dist.draw.amount + dist.away.amount;
  const totalCount = dist.home.count + dist.draw.count + dist.away.count;
  
  const shortAddr = user.slice(0, 8) + '...' + user.slice(-4);
  console.log('\nUser: ' + shortAddr);
  console.log('  Total bets: ' + totalCount + ', Total amount: ' + totalAmount.toFixed(2) + ' USDT');
  console.log('  Option     Count      Amount     Cnt%      Amt%');
  console.log('  ' + '-'.repeat(52));
  for (const o of OUTCOMES) {
    const cntPct = totalCount > 0 ? (dist[o].count / totalCount * 100).toFixed(1) : '0.0';
    const amtPct = totalAmount > 0 ? (dist[o].amount / totalAmount * 100).toFixed(1) : '0.0';
    const line = '  ' + pad(LABELS[o], 10) + ' ' + padL(String(dist[o].count), 8) + ' ' + padL(dist[o].amount.toFixed(2), 10) + ' ' + padL(cntPct + '%', 8) + ' ' + padL(amtPct + '%', 8);
    console.log(line);
  }
}

// ============================================================
// 3. Per-match distribution
// ============================================================
console.log('\n' + '='.repeat(80));
console.log('[3. 每场赛事的投注分布]');
console.log('='.repeat(80));

const matchGroups = {};
for (const bet of allBets) {
  if (!matchGroups[bet.matchId]) {
    matchGroups[bet.matchId] = { matchName: bet.matchName, bets: [] };
  }
  matchGroups[bet.matchId].bets.push(bet);
}

for (const [matchId, group] of Object.entries(matchGroups)) {
  const { matchName, bets } = group;
  const usersInMatch = [...new Set(bets.map(b => b.userAddress))];
  
  const dist = { home: { count: 0, amount: 0, users: new Set() }, draw: { count: 0, amount: 0, users: new Set() }, away: { count: 0, amount: 0, users: new Set() } };
  for (const bet of bets) {
    const o = bet.outcome;
    if (dist[o]) {
      dist[o].count++;
      dist[o].amount += bet.amount;
      dist[o].users.add(bet.userAddress);
    }
  }
  
  const totalAmount = dist.home.amount + dist.draw.amount + dist.away.amount;
  const totalCount = dist.home.count + dist.draw.count + dist.away.count;
  
  console.log('\nMatch: ' + matchName + ' (ID: ' + matchId + ')');
  console.log('  Users: ' + usersInMatch.length + ', Bets: ' + totalCount + ', Total: ' + totalAmount.toFixed(2) + ' USDT');
  console.log('  Option     Count      Amount     Users     Amt%');
  console.log('  ' + '-'.repeat(48));
  for (const o of OUTCOMES) {
    const amtPct = totalAmount > 0 ? (dist[o].amount / totalAmount * 100).toFixed(1) : '0.0';
    const line = '  ' + pad(LABELS[o], 10) + ' ' + padL(String(dist[o].count), 8) + ' ' + padL(dist[o].amount.toFixed(2), 10) + ' ' + padL(String(dist[o].users.size), 8) + ' ' + padL(amtPct + '%', 8);
    console.log(line);
  }
  
  const perUser = {};
  for (const bet of bets) {
    if (!perUser[bet.userAddress]) {
      perUser[bet.userAddress] = { home: 0, draw: 0, away: 0, homeAmt: 0, drawAmt: 0, awayAmt: 0 };
    }
    perUser[bet.userAddress][bet.outcome]++;
    perUser[bet.userAddress][bet.outcome + 'Amt'] += bet.amount;
  }
  console.log('  Per-user breakdown:');
  for (const [addr, d] of Object.entries(perUser)) {
    const parts = [];
    for (const o of OUTCOMES) {
      if (d[o] > 0) parts.push(LABELS[o] + ':' + d[o] + 'bets/' + d[o + 'Amt'].toFixed(2) + 'USDT');
    }
    console.log('    ' + addr.slice(0, 8) + '... -> ' + parts.join(', '));
  }
}

// ============================================================
// 4. Combinatorial enumeration of all possibilities
// ============================================================
console.log('\n' + '='.repeat(80));
console.log('[4. 所有可能投注分布 - 组合数学枚舉]');
console.log('='.repeat(80));

console.log('\n--- 4a. 单一用户对单一赛事的选择空间 ---');
console.log('');
console.log('  3个选项 (H/D/A), 每个选项可投或不投:');
console.log('  理论状态空间 = 2^3 = 8 种组合');
console.log('');
const states = [];
for (let mask = 0; mask < 8; mask++) {
  const parts = [];
  if (mask & 1) parts.push('H');
  if (mask & 2) parts.push('D');
  if (mask & 4) parts.push('A');
  states.push(parts.length === 0 ? '(none)' : parts.join('+'));
}
states.forEach((s, i) => console.log('    ' + i + '. ' + s));

console.log('\n--- 4b. 多用户联合分布空间 ---');
console.log('');
console.log('  N个用户在同一赛事中, 每人 8 种选择:');
console.log('  联合分布空间 = 8^N');
console.log('');

for (const [matchId, group] of Object.entries(matchGroups)) {
  const n = [...new Set(group.bets.map(b => b.userAddress))].length;
  const total = BigInt(8) ** BigInt(n);
  console.log('  Match ' + group.matchName + ': ' + n + ' users -> 8^' + n + ' = ' + total + ' possibilities');
}

console.log('\n--- 4c. 简化模型: 每用户每场只选一个结果 ---');
console.log('');
console.log('  每用户每场只能选 H/D/A 之一 (或多选任一):');
console.log('  理论状态空间 = 4^N (H, D, A, none)');
console.log('');

for (const [matchId, group] of Object.entries(matchGroups)) {
  const n = [...new Set(group.bets.map(b => b.userAddress))].length;
  const total = BigInt(4) ** BigInt(n);
  console.log('  Match ' + group.matchName + ': ' + n + ' users -> 4^' + n + ' = ' + total + ' possibilities');
}

// ============================================================
// 5. Enumerate actual observed patterns
// ============================================================
console.log('\n' + '='.repeat(80));
console.log('[5. 实际观察到的投注模式]');
console.log('='.repeat(80));

for (const [matchId, group] of Object.entries(matchGroups)) {
  const users = [...new Set(group.bets.map(b => b.userAddress))];
  
  console.log('\nMatch: ' + group.matchName + ' (' + users.length + ' users)');
  
  // Per-user outcome set
  for (const u of users) {
    const uBets = group.bets.filter(b => b.userAddress === u);
    const outcomes = [...new Set(uBets.map(b => b.outcome))].sort();
    const outcomeLabel = outcomes.length === 0 ? '(none)' : outcomes.map(o => LABELS[o]).join('+');
    const totalAmt = uBets.reduce((s, b) => s + b.amount, 0);
    console.log('  User ' + u.slice(0, 8) + '...: ' + outcomeLabel + ' | ' + uBets.length + ' bets, ' + totalAmt.toFixed(2) + ' USDT');
  }
  
  // Joint pattern (reduced: just the set of outcomes each user chose)
  const jointPattern = users.map(u => {
    const outcomes = [...new Set(group.bets.filter(b => b.userAddress === u).map(b => b.outcome))].sort();
    return outcomes.join('+') || 'none';
  }).join(' | ');
  console.log('  Joint pattern: [' + jointPattern + ']');
  
  // Count how many matches show each type of user behavior
  console.log('  User selection type breakdown:');
  const typeCount = { single: 0, dual: 0, triple: 0 };
  for (const u of users) {
    const outcomes = [...new Set(group.bets.filter(b => b.userAddress === u).map(b => b.outcome))];
    if (outcomes.length === 1) typeCount.single++;
    else if (outcomes.length === 2) typeCount.dual++;
    else if (outcomes.length === 3) typeCount.triple++;
  }
  console.log('    Single-option: ' + typeCount.single + ' users');
  console.log('    Dual-option: ' + typeCount.dual + ' users');
  console.log('    Triple-option: ' + typeCount.triple + ' users');
}

// ============================================================
// 6. Platform-wide aggregate
// ============================================================
console.log('\n' + '='.repeat(80));
console.log('[6. 平台整体分布]');
console.log('='.repeat(80));

const plat = { home: { count: 0, amount: 0 }, draw: { count: 0, amount: 0 }, away: { count: 0, amount: 0 } };
for (const bet of allBets) {
  const o = bet.outcome;
  if (plat[o]) {
    plat[o].count++;
    plat[o].amount += bet.amount;
  }
}
const totalAmt = plat.home.amount + plat.draw.amount + plat.away.amount;
const totalCnt = plat.home.count + plat.draw.count + plat.away.count;

console.log('\n  Total bets: ' + totalCnt + ', Total amount: ' + totalAmt.toFixed(2) + ' USDT');
console.log('  Option     Count      Amount     Cnt%      Amt%');
console.log('  ' + '-'.repeat(52));
for (const o of OUTCOMES) {
  const cntPct = totalCnt > 0 ? (plat[o].count / totalCnt * 100).toFixed(1) : '0.0';
  const amtPct = totalAmt > 0 ? (plat[o].amount / totalAmt * 100).toFixed(1) : '0.0';
  console.log('  ' + pad(LABELS[o], 10) + ' ' + padL(String(plat[o].count), 8) + ' ' + padL(plat[o].amount.toFixed(2), 10) + ' ' + padL(cntPct + '%', 8) + ' ' + padL(amtPct + '%', 8));
}

console.log('\n  --- Implied Market Probability (by amount) ---');
for (const o of OUTCOMES) {
  const impliedProb = totalAmt > 0 ? (plat[o].amount / totalAmt * 100).toFixed(1) : '0.0';
  const fairOdds = plat[o].amount > 0 ? (totalAmt / plat[o].amount).toFixed(2) : 'inf';
  console.log('  ' + LABELS[o] + ': implied prob = ' + impliedProb + '%, fair odds = ' + fairOdds);
}

// ============================================================
// 7. Strategy classification
// ============================================================
console.log('\n' + '='.repeat(80));
console.log('[7. 用户策略分类]');
console.log('='.repeat(80));

for (const user of uniqueUsers) {
  const userBets = allBets.filter(b => b.userAddress === user);
  const userMatches = [...new Set(userBets.map(b => b.matchId))];
  
  const perMatchOutcomes = {};
  for (const bet of userBets) {
    if (!perMatchOutcomes[bet.matchId]) perMatchOutcomes[bet.matchId] = new Set();
    perMatchOutcomes[bet.matchId].add(bet.outcome);
  }
  
  const coverage = Object.values(perMatchOutcomes).map(s => s.size);
  const avgCoverage = coverage.reduce((a, b) => a + b, 0) / coverage.length;
  const maxCoverage = Math.max(...coverage);
  
  let hedgeMatches = 0;
  for (const [, outcomes] of Object.entries(perMatchOutcomes)) {
    if (outcomes.has('home') && outcomes.has('away')) hedgeMatches++;
    if (outcomes.size === 3) hedgeMatches++;
  }
  
  const shortAddr = user.slice(0, 8) + '...';
  console.log('\nUser: ' + shortAddr);
  console.log('  Matches: ' + userMatches.length);
  console.log('  Avg options per match: ' + avgCoverage.toFixed(2) + ' (max: ' + maxCoverage + ')');
  console.log('  Hedge matches: ' + hedgeMatches + '/' + userMatches.length + ' (' + (hedgeMatches / userMatches.length * 100).toFixed(1) + '%)');
  
  let strategy;
  if (maxCoverage >= 3) strategy = 'FULL HEDGE (投满3个选项)';
  else if (avgCoverage >= 2) strategy = 'MULTI-OPTION (多选项分散)';
  else if (avgCoverage >= 1.3) strategy = 'SLIGHT DIVERSIFY (偏单但偶分散)';
  else strategy = 'SINGLE FOCUS (单选专注)';
  console.log('  Strategy: ' + strategy);
}

// ============================================================
// 8. Cross-user correlation
// ============================================================
console.log('\n' + '='.repeat(80));
console.log('[8. 用户间行为相关性]');
console.log('='.repeat(80));

const multiUserMatches = Object.entries(matchGroups).filter(([, g]) => [...new Set(g.bets.map(b => b.userAddress))].length >= 2);

if (multiUserMatches.length > 0) {
  for (const [matchId, group] of multiUserMatches) {
    const users = [...new Set(group.bets.map(b => b.userAddress))];
    
    const userMain = {};
    for (const u of users) {
      const uBets = group.bets.filter(b => b.userAddress === u);
      const totals = { home: 0, draw: 0, away: 0 };
      for (const b of uBets) totals[b.outcome] += b.amount;
      const main = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
      userMain[u] = { outcome: main[0], amount: main[1] };
    }
    
    const outcomes = users.map(u => userMain[u].outcome);
    const allSame = outcomes.every(o => o === outcomes[0]);
    const uniqueOutcomes = [...new Set(outcomes)];
    
    console.log('\nMatch: ' + group.matchName);
    console.log('  Consensus: ' + (allSame ? 'YES (all agree)' : 'NO (' + uniqueOutcomes.length + ' different views)'));
    console.log('  Main picks: ' + outcomes.map(o => LABELS[o]).join(', '));
    
    const outcomeCounts = { home: 0, draw: 0, away: 0 };
    for (const o of outcomes) outcomeCounts[o]++;
    const hhi = Object.values(outcomeCounts).reduce((sum, c) => sum + (c / users.length) ** 2, 0);
    console.log('  HHI concentration: ' + hhi.toFixed(4) + ' (1.0=perfect consensus, 0.333=fully dispersed)');
  }
} else {
  console.log('\n  No matches with multiple users.');
}

console.log('\n' + '='.repeat(80));
console.log('Analysis complete.');
console.log('='.repeat(80));
