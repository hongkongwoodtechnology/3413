import { NextResponse } from 'next/server';
import { maskAdminName, maskIpAddress } from '@/lib/security/data-masking';
import fs from 'fs';
import path from 'path';

const DB_FILE_PATH = path.join(process.cwd(), 'data', 'logs_db.json');

// 確保資料夾與檔案存在，否則寫入預設資料
function loadLogsDatabase() {
    try {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        if (!fs.existsSync(DB_FILE_PATH)) {
            const initialDB = [
                { id: 'LOG_001', admin: 'admin_super', action: 'UPDATE_ODDS', target: 'Match #2', details: 'Changed odds A from 2.1 to 1.9', timestamp: '2026-03-19 14:23:10', ip: '192.168.1.100', status: 'SUCCESS' },
                { id: 'LOG_002', admin: 'admin_super', action: 'LOGIN', target: 'System', details: 'Admin logged in', timestamp: '2026-03-19 10:00:05', ip: '192.168.1.100', status: 'SUCCESS' },
                { id: 'LOG_003', admin: 'mod_john', action: 'SUSPEND_USER', target: 'User U1003', details: 'Suspicious betting pattern detected', timestamp: '2026-03-18 16:45:22', ip: '10.0.0.55', status: 'SUCCESS' },
                { id: 'LOG_004', admin: 'unknown', action: 'UNAUTHORIZED_ACCESS', target: 'Admin Panel', details: 'Failed login attempt', timestamp: '2026-03-18 03:12:00', ip: '45.22.11.9', status: 'FAILED' },
            ];
            fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initialDB, null, 2), 'utf-8');
            return initialDB;
        }
        
        const data = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading logs database:', error);
        return [];
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';

        // 查詢資料庫
        let logs = loadLogsDatabase();

        if (search) {
            const s = search.toLowerCase();
            logs = logs.filter((l: any) => 
                l.admin.toLowerCase().includes(s) || 
                l.action.toLowerCase().includes(s) ||
                l.details.toLowerCase().includes(s)
            );
        }

        // 應用脫敏機制
        const maskedLogs = logs.map((l: any) => ({
            ...l,
            admin: maskAdminName(l.admin),
            ip: maskIpAddress(l.ip)
        }));

        return NextResponse.json({ success: true, data: maskedLogs });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch logs from DB' }, { status: 500 });
    }
}
