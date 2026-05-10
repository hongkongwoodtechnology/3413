import fs from 'fs';
import path from 'path';

const DB_FILE_PATH = path.join(process.cwd(), 'data', 'market_db.json');

export type MarketDataInfo = {
  realTotalPool: number;
  liabilities: { home: number; draw: number; away: number };
  pools?: { home: number; draw: number; away: number };
  attractionWindowUsed?: { home: number; draw: number; away: number };
  initialOdds?: { home: number; draw: number; away: number };
  seedBankroll?: number;
  refundProcessed?: boolean;
  settled?: boolean;
  finalWinner?: string;
  finalScore?: string;
  adminSurplus?: number;
};

let memCache: Record<string, MarketDataInfo> | null = null;
let memCacheLoadedAt = 0;
const MEM_CACHE_TTL = 15000;

function ensureDataDir() {
  const dataDir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function loadMarketDb(): Record<string, MarketDataInfo> {
  if (memCache && Date.now() - memCacheLoadedAt < MEM_CACHE_TTL) {
    return memCache;
  }
  try {
    ensureDataDir();
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      memCache = JSON.parse(raw);
      memCacheLoadedAt = Date.now();
      return memCache!;
    }
  } catch (error) {
    console.error('Error loading market database:', error);
  }
  memCache = {};
  memCacheLoadedAt = Date.now();
  return memCache;
}

export function saveMarketDb(db: Record<string, MarketDataInfo>) {
  memCache = db;
  memCacheLoadedAt = Date.now();
  try {
    ensureDataDir();
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving market database:', error);
  }
}

export function flushMarketDbCache() {
  memCache = null;
  memCacheLoadedAt = 0;
}
