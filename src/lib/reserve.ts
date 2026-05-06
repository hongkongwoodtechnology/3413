import fs from 'fs';
import path from 'path';

const RESERVE_PATH = path.join(process.cwd(), 'data', 'reserve.json');

export interface ReserveData {
  balance: number;
  totalAccumulated: number;
  lastUpdated: number;
}

export function loadReserve(): ReserveData {
  try {
    if (fs.existsSync(RESERVE_PATH)) {
      return JSON.parse(fs.readFileSync(RESERVE_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading reserve:', e);
  }
  return { balance: 0, totalAccumulated: 0, lastUpdated: Date.now() };
}

export function saveReserve(data: ReserveData): void {
  try {
    const dir = path.dirname(RESERVE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(RESERVE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving reserve:', e);
  }
}

/** 將抽水的一部分存入儲備池 */
export function addToReserve(amount: number): ReserveData {
  const data = loadReserve();
  data.balance += amount;
  data.totalAccumulated += amount;
  data.lastUpdated = Date.now();
  saveReserve(data);
  return data;
}

/** 從儲備池提取資金（促銷/應急用） */
export function withdrawFromReserve(amount: number): ReserveData | null {
  const data = loadReserve();
  if (data.balance < amount) return null;
  data.balance -= amount;
  data.lastUpdated = Date.now();
  saveReserve(data);
  return data;
}
