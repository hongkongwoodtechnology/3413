const fs = require('fs');
const db = JSON.parse(fs.readFileSync('data/bets_db.json', 'utf-8'));
const market = JSON.parse(fs.readFileSync('data/market_db.json', 'utf-8'));

// Find all bets by odds pattern (5.2571 and 11.6533 are very specific)
let targetBets = [];
for (const [user, bets] of Object.entries(db)) {
  for (const b of bets) {
    if (b.matchName && (b.matchName.includes('Gouna') || b.matchName.includes('Gaish') || 
        b.matchName.includes('gu na') || b.matchName.includes('ai er') ||
        b.odds === 5.2571 || b.odds === 11.6533)) {
      targetBets.push({ ...b, userAddress: user });
    }
  }
}

// Deduplicate by bet ID from same match
const seenMatchIds = new Set();
targetBets.forEach(b => seenMatchIds.add(b.matchId));

console.log('=== Match IDs:', [...seenMatchIds].join(', '));
console.log('');

for (const b of targetBets) {
  const mkt = market[String(b.matchId)] || {};
  console.log('Bet ID:', b.id);
  console.log('  Match ID:', b.matchId);
  console.log('  Match Name:', b.matchName);
  console.log('  User:', b.userAddress);
  console.log('  Amount:', b.amount.toFixed(4), 'USDT');
  console.log('  Trial Funds:', b.useBonus);
  console.log('  Outcome:', b.outcome);
  console.log('  Odds:', b.odds);
  console.log('  Status:', b.status);
  console.log('  NetPayout:', b.netPayout);
  console.log('  PaidOut:', b.paidOut ? 'YES' : 'NO');
  console.log('  Timestamp:', new Date(b.timestamp).toISOString());
  console.log('  Market finalWinner:', mkt.finalWinner || '(not set)');
  console.log('  Market settled:', mkt.settled || false);
  console.log('  Market refundProcessed:', mkt.refundProcessed || false);
  console.log('');
}

// Now find all bets on this match
if (seenMatchIds.size > 0) {
  const matchId = [...seenMatchIds][0];
  console.log('=== ALL bets for Match ID', matchId, '===');
  let allMatchBets = [];
  for (const [user, bets] of Object.entries(db)) {
    for (const b of bets) {
      if (String(b.matchId) === String(matchId)) {
        allMatchBets.push({ ...b, userAddress: user });
      }
    }
  }
  let total = 0;
  for (const b of allMatchBets) {
    total += b.amount;
    const paid = b.paidOut ? 'PAID' : 'UNPAID';
    const bonus = b.useBonus ? 'TRIAL' : 'REAL';
    console.log('  [' + (b.status || 'pending') + '][' + paid + '][' + bonus + '] ' + b.amount.toFixed(4) + ' USDT | ' + b.outcome + ' @' + (b.odds || '?') + ' | netPayout:' + (b.netPayout || '?') + ' | ' + b.userAddress.slice(0,12));
  }
  console.log('  Total bet amount:', total.toFixed(4), 'USDT');

  const mkt = market[String(matchId)] || {};
  console.log('');
  console.log('Market Status:');
  console.log('  finalWinner:', mkt.finalWinner || '(not set)');
  console.log('  finalScore:', mkt.finalScore || '(not set)');
  console.log('  settled:', mkt.settled);
  console.log('  refundProcessed:', mkt.refundProcessed);
  console.log('  adminSurplus:', mkt.adminSurplus);
  console.log('  realTotalPool:', mkt.realTotalPool);
  console.log('  pools:', JSON.stringify(mkt.pools));
  console.log('  liabilities:', JSON.stringify(mkt.liabilities));
}

// Check settle route for useBonus handling
console.log('');
console.log('=== Settle Route: useBonus/trial funds handling ===');
const settleCode = fs.readFileSync('src/app/api/cron/settle/route.ts', 'utf-8');

// Find the win filter
const winIdx = settleCode.indexOf('status === "win"');
if (winIdx >= 0) {
  console.log('Win filter (line ~' + settleCode.slice(0, winIdx).split('\n').length + '):');
  console.log(settleCode.slice(winIdx, winIdx + 120));
  console.log('...');
  // Check if useBonus is excluded from wins
  const winSection = settleCode.slice(winIdx, winIdx + 250);
  console.log('useBonus mentioned in win section:', winSection.includes('useBonus'));
}

// Find the refund filter
const refundIdx = settleCode.indexOf('status === "refunded"');
if (refundIdx >= 0) {
  console.log('');
  console.log('Refund filter (line ~' + settleCode.slice(0, refundIdx).split('\n').length + '):');
  console.log(settleCode.slice(refundIdx, refundIdx + 150));
  console.log('useBonus mentioned in refund section:', settleCode.slice(refundIdx, refundIdx + 150).includes('useBonus'));
}
