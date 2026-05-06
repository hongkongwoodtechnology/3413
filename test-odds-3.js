const { DynamicOddsEngine } = require('./src/lib/odds-engine');

const engine = new DynamicOddsEngine();

let initialOddsHome = 1.84;
let initialOddsDraw = 4.58;
let initialOddsAway = 3.07;

function testSeed(seedTotalPool) {
    let seedPools = {
        home: (seedTotalPool * 0.92 / initialOddsHome),
        draw: (seedTotalPool * 0.92 / initialOddsDraw),
        away: (seedTotalPool * 0.92 / initialOddsAway)
    };
    
    console.log(`\n--- Testing with Seed Pool: ${seedTotalPool} ---`);
    console.log("Initial odds:");
    console.log({
        home: engine.calculateOdds(seedPools, 'home'),
        draw: engine.calculateOdds(seedPools, 'draw'),
        away: engine.calculateOdds(seedPools, 'away')
    });
    
    // Apply bets
    seedPools.home += 0.20 + 0.01;
    seedPools.draw += 1.00;
    
    console.log("Odds after 0.21 home, 1.00 draw:");
    console.log({
        home: engine.calculateOdds(seedPools, 'home'),
        draw: engine.calculateOdds(seedPools, 'draw'),
        away: engine.calculateOdds(seedPools, 'away')
    });
}

testSeed(1000);
testSeed(100);
testSeed(10);
