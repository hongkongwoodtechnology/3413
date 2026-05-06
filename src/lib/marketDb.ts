import fs from 'fs';
import path from 'path';

const DB_FILE_PATH = path.join(process.cwd(), 'data', 'market_db.json');

export type MarketDataInfo = {
  realTotalPool: number;
  liabilities: { home: number; draw: number; away: number };
  pools?: { home: number; draw: number; away: number };
  seedBankroll?: number;
  refundProcessed?: boolean;
  settled?: boolean;
  finalWinner?: string;
  finalScore?: string;
  adminSurplus?: number;
};

export function loadMarketDb(): Record<string, MarketDataInfo> {
  try {
    const dataDir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(DB_FILE_PATH)) {
      const data = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading market database:', error);
  }
  return {};
}

export function saveMarketDb(db: Record<string, MarketDataInfo>) {
  try {
    const dataDir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving market database:', error);
  }
}
