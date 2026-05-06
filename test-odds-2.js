const { DynamicOddsEngine } = require('./src/lib/odds-engine');

const engine = new DynamicOddsEngine();

// Simulate initial state
let seedTotalPool = 1000;
let initialOddsHome = 1.92;
let initialOddsDraw = 8.36;
let initialOddsAway = 2.24;

let seedPools = {
    home: (1000 * 0.92 / initialOddsHome),
    draw: (1000 * 0.92 / initialOddsDraw),
    away: (1000 * 0.92 / initialOddsAway)
};

console.log("Initial seed pools:", seedPools);
let sumPools = seedPools.home + seedPools.draw + seedPools.away;
console.log("Sum of initial seed pools:", sumPools);

// Odds calculated by engine initially
let oddsH = engine.calculateOdds(seedPools, 'home');
let oddsD = engine.calculateOdds(seedPools, 'draw');
let oddsA = engine.calculateOdds(seedPools, 'away');
console.log("Initial calculated odds:", { home: oddsH, draw: oddsD, away: oddsA });

// Now user bets 0.1 on home
let betHome = 0.1;
seedPools.home += betHome;

oddsH = engine.calculateOdds(seedPools, 'home');
oddsD = engine.calculateOdds(seedPools, 'draw');
oddsA = engine.calculateOdds(seedPools, 'away');
console.log("Odds after 0.1 bet on home:", { home: oddsH, draw: oddsD, away: oddsA });

// Now user bets 0.01 on away
let betAway = 0.01;
seedPools.away += betAway;

oddsH = engine.calculateOdds(seedPools, 'home');
oddsD = engine.calculateOdds(seedPools, 'draw');
oddsA = engine.calculateOdds(seedPools, 'away');
console.log("Odds after 0.01 bet on away:", { home: oddsH, draw: oddsD, away: oddsA });

