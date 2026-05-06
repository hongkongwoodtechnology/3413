import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/matches/route';

// Mock fetch globally
global.fetch = jest.fn((input: any) => {
  const url = typeof input === 'string' ? input : input?.url;

  if (typeof url === 'string' && url.startsWith('https://prod-public-api.livescore.com/')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        Stages: [
          {
            Cnm: 'England',
            Snm: 'Premier League',
            Events: [
              {
                Eid: '123',
                Eps: '1',
                Esd: '20260322163000',
                T1: [{ Nm: 'Arsenal', Img: '' }],
                T2: [{ Nm: 'Manchester City', Img: '' }],
                Tr1: '1',
                Tr2: '0'
              }
            ]
          },
          {
            Cnm: 'Spain',
            Snm: 'La Liga',
            Events: [
              {
                Eid: '124',
                Eps: 'HT',
                Esd: '20260322163000',
                T1: [{ Nm: 'Real Madrid', Img: '' }],
                T2: [{ Nm: 'Barcelona', Img: '' }],
                Tr1: '0',
                Tr2: '0'
              }
            ]
          },
          {
            Cnm: 'Germany',
            Snm: 'Bundesliga',
            Events: [
              {
                Eid: '125',
                Eps: 'NS',
                Esd: '20260322163000',
                T1: [{ Nm: 'Bayern Munich', Img: '' }],
                T2: [{ Nm: 'Borussia Dortmund', Img: '' }],
                Tr1: '0',
                Tr2: '0'
              }
            ]
          },
          {
            Cnm: 'England',
            Snm: 'Test League',
            Events: [
              {
                Eid: '999',
                Eps: 'NS',
                Esd: '20260322163000',
                T1: [{ Nm: 'Some Unknown FC', Img: '', ID: 't1' }],
                T2: [{ Nm: 'Demo Club', Img: '', ID: 't2' }],
                Tr1: '0',
                Tr2: '0'
              }
            ]
          }
        ]
      }),
    } as any);
  }

  if (typeof url === 'string' && url.startsWith('https://translate.googleapis.com/translate_a/single')) {
    const u = new URL(url);
    const q = u.searchParams.get('q') || '';
    const tl = u.searchParams.get('tl') || '';

    const map: Record<string, Record<string, string>> = {
      'zh-TW': {
        'Some Unknown FC': '未知足球會',
        'Demo Club': '示範俱樂部',
        'England - Test League': '英格蘭測試聯賽',
      },
      'zh-CN': {
        'Some Unknown FC': '未知足球会',
        'Demo Club': '示范俱乐部',
        'England - Test League': '英格兰测试联赛',
      },
    };

    const translated = map[tl]?.[q] || (tl === 'zh-TW' ? '測試' : '测试');
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([[[translated, q, null, null, 1]]]),
    } as any);
  }

  return Promise.reject(new Error(`Unexpected fetch url in test: ${String(url)}`));
}) as jest.Mock;

describe('Matches API i18n Translation Logic', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('should return default English names when lang=en', async () => {
    const req = new NextRequest('http://localhost:3000/api/matches?lang=en');
    const res = await GET(req);
    const data = await res.json();

    expect(data.length).toBeGreaterThan(0);
    
    // Arsenal vs Manchester City
    const match1 = data.find((m: any) => m.id === '123');
    expect(match1.home).toBe('Arsenal');
    expect(match1.away).toBe('Manchester City');
    expect(match1.league).toBe('England - Premier League');

    // Real Madrid vs Barcelona
    const match2 = data.find((m: any) => m.id === '124');
    expect(match2.home).toBe('Real Madrid');
    expect(match2.away).toBe('Barcelona');
    expect(match2.league).toBe('Spain - La Liga');

    const match4 = data.find((m: any) => m.id === '999');
    expect(match4.home).toBe('Some Unknown FC');
    expect(match4.away).toBe('Demo Club');
  });

  it('should return Traditional Chinese names when lang=zh-TW', async () => {
    const req = new NextRequest('http://localhost:3000/api/matches?lang=zh-TW');
    const res = await GET(req);
    const data = await res.json();

    const match1 = data.find((m: any) => m.id === '123');
    expect(match1.home).toBe('阿森納');
    expect(match1.away).toBe('曼城');
    expect(match1.league).toBe('英格蘭超級聯賽');

    const match2 = data.find((m: any) => m.id === '124');
    expect(match2.home).toBe('皇家馬德里');
    expect(match2.away).toBe('巴塞隆納');
    expect(match2.league).toBe('西班牙甲級聯賽');
    
    const match3 = data.find((m: any) => m.id === '125');
    expect(match3.home).toBe('拜仁慕尼黑');
    expect(match3.away).toBe('多特蒙德');
    expect(match3.league).toBe('德國甲級聯賽');

    const match4 = data.find((m: any) => m.id === '999');
    expect(match4.home).toBe('未知足球會');
    expect(match4.away).toBe('示範俱樂部');
    expect(match4.league).toBe('英格蘭測試聯賽');
  });

  it('should return Simplified Chinese names when lang=zh-CN', async () => {
    const req = new NextRequest('http://localhost:3000/api/matches?lang=zh-CN');
    const res = await GET(req);
    const data = await res.json();

    const match1 = data.find((m: any) => m.id === '123');
    expect(match1.home).toBe('阿森纳');
    expect(match1.away).toBe('曼城');
    expect(match1.league).toBe('英格兰超级联赛');

    const match2 = data.find((m: any) => m.id === '124');
    expect(match2.home).toBe('皇家马德里');
    expect(match2.away).toBe('巴塞罗那');
    expect(match2.league).toBe('西班牙甲级联赛');

    const match4 = data.find((m: any) => m.id === '999');
    expect(match4.home).toBe('未知足球会');
    expect(match4.away).toBe('示范俱乐部');
    expect(match4.league).toBe('英格兰测试联赛');
  });
});
