const { DynamicOddsEngine } = require('./src/lib/odds-engine');

const engine = new DynamicOddsEngine();

// First bet
let realTotalPool = 0;
let liabilities = { home: 0, draw: 0, away: 0 };
let betAmount = 10;

// Simulate UI before bet
let oddsHome = engine.calculateDisplayOdds(realTotalPool, liabilities, 'home');
let oddsDraw = engine.calculateDisplayOdds(realTotalPool, liabilities, 'draw');
let oddsAway = engine.calculateDisplayOdds(realTotalPool, liabilities, 'away');
console.log('Before bet:', { oddsHome, oddsDraw, oddsAway });

// Place bet on home
let projectedOdds = 2.0; // say initial odds
realTotalPool += betAmount;
liabilities.home += betAmount * projectedOdds;

console.log('After bet state:', { realTotalPool, liabilities });

// Simulate UI after bet
oddsHome = engine.calculateDisplayOdds(realTotalPool, liabilities, 'home');
oddsDraw = engine.calculateDisplayOdds(realTotalPool, liabilities, 'draw');
oddsAway = engine.calculateDisplayOdds(realTotalPool, liabilities, 'away');
console.log('After bet UI odds:', { oddsHome, oddsDraw, oddsAway });
