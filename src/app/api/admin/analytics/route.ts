import { NextResponse } from 'next/server';

// 模擬真實資料庫查詢結果
const getRealDBAnalytics = () => {
    return {
        langDistributionData: [
            { name: '英文 (EN)', users: 4500, volume: 120000 },
            { name: '繁體中文 (ZH-TW)', users: 3200, volume: 95000 },
            { name: '日文 (JA)', users: 1800, volume: 60000 },
            { name: '韓文 (KO)', users: 1500, volume: 45000 },
        ],
        activeHoursData: Array.from({ length: 24 }).map((_, i) => ({
            hour: `${i}:00`,
            EN: 100 + i * 15,
            ZH: 50 + i * 20,
            JA: 30 + i * 10,
        })),
        prefData: [
            { sport: '籃球', EN: 40, ZH: 60, JA: 30, KO: 20 },
            { sport: '足球', EN: 70, ZH: 30, JA: 40, KO: 50 },
            { sport: '電競', EN: 30, ZH: 50, JA: 60, KO: 80 },
            { sport: '棒球', EN: 20, ZH: 40, JA: 70, KO: 30 },
        ]
    };
};

export async function GET() {
    try {
        const data = getRealDBAnalytics();

        return NextResponse.json({ 
            success: true, 
            data 
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch analytics from DB' }, { status: 500 });
    }
}
