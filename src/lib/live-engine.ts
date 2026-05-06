
import { DynamicOddsEngine } from "./odds-engine";

export interface MatchUpdate {
  matchId: number;
  type: 'score' | 'time' | 'odds';
  payload: any;
  timestamp: number;
}

export class LiveEngine {
  private oddsEngine: DynamicOddsEngine;

  constructor() {
    this.oddsEngine = new DynamicOddsEngine();
  }

  // Simulate a tick for a single match (advance time, potential score change)
  public simulateMatchTick(match: any): MatchUpdate[] {
    const updates: MatchUpdate[] = [];
    const now = Date.now();

    // 1. Update Time (if live)
    if (match.status === 'live') {
      const currentMinute = parseInt(match.date.replace("Live ", "").replace("'", "")) || 0;
      if (currentMinute < 90 && Math.random() > 0.3) { // Advance time randomly but consistently
         updates.push({
             matchId: match.id,
             type: 'time',
             payload: `Live ${currentMinute + 1}'`,
             timestamp: now
         });
      }
    }

    // 2. Simulate Goal (Extremely Low probability for realism)
    // Real football: ~2.5 goals per 90 mins = ~0.027 goals per min = ~0.00045 goals per second
    // We'll set it slightly higher for demo purposes but much lower than before
    if (match.status === 'live' && Math.random() < 0.001) { // 0.1% chance per tick (approx 1 goal every 16 mins in simulation time)
        const scores = match.score ? match.score.split('-').map(Number) : [0, 0];
        
        // Prevent unrealistic scores (cap at 7 goals per side)
        if (scores[0] > 7 || scores[1] > 7) return updates;

        const isHomeGoal = Math.random() > 0.5;
        const newScore = isHomeGoal 
            ? `${scores[0] + 1}-${scores[1]}` 
            : `${scores[0]}-${scores[1] + 1}`;
        
        updates.push({
            matchId: match.id,
            type: 'score',
            payload: newScore,
            timestamp: now
        });

        // 3. Trigger Odds Update on Goal
        const poolDict = { home: match.pools.home, draw: match.pools.draw, away: match.pools.away };
        // Simulate pool shift (market reaction to goal)
        const shiftAmount = 500; 
        const newPools = isHomeGoal 
            ? { ...poolDict, home: poolDict.home + shiftAmount, away: Math.max(0, poolDict.away - shiftAmount) }
            : { ...poolDict, away: poolDict.away + shiftAmount, home: Math.max(0, poolDict.home - shiftAmount) };
            
        updates.push({
            matchId: match.id,
            type: 'odds',
            payload: newPools,
            timestamp: now
        });
    }

    return updates;
  }
}
