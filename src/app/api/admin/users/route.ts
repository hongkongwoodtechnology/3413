import { NextResponse } from 'next/server';
import { maskWalletAddress } from '@/lib/security/data-masking';
import fs from 'fs';
import path from 'path';

const DB_FILE_PATH = path.join(process.cwd(), 'data', 'users_db.json');

// 確保資料夾與檔案存在，否則寫入預設資料
function loadUsersDatabase() {
    try {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        if (!fs.existsSync(DB_FILE_PATH)) {
            const initialDB = [
                { id: 'SOL_U1', address: '7xV9p2aB4cDEFG5hIJ6kLM7nOP8qRS9tU0vW1xY2z', refCode: 'REF_ALPHA', totalBets: 15, totalAmount: 4500, joinedAt: '2026-03-01', type: 'User', commission: 0, downlines: 0 },
                { id: 'SOL_U2', address: '3mK2z1yX0wV9uT8sR7qP6oN5mL4kJ3iH2gG1fF0eE', refCode: 'REF_ALPHA', totalBets: 42, totalAmount: 12000, joinedAt: '2026-02-15', type: 'Referrer', commission: 450, downlines: 12 },
                { id: 'SOL_U3', address: '9vQ4x8wR2yT5uI1oP7lK3jH6gG0fF9eD8cB7aA6Z5', refCode: 'REF_BETA', totalBets: 5, totalAmount: 300, joinedAt: '2026-03-10', type: 'User', commission: 0, downlines: 0 },
                { id: 'SOL_U4', address: '1aA2bB3cC4dD5eE6fF7gG8hH9iI0jJ1kK2lL3mM4n', refCode: 'REF_GAMMA', totalBets: 120, totalAmount: 45000, joinedAt: '2026-01-20', type: 'Referrer', commission: 1250, downlines: 45 },
            ];
            fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initialDB, null, 2), 'utf-8');
            return initialDB;
        }
        
        const data = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading users database:', error);
        return [];
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const type = searchParams.get('type') || 'all';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');

        // 查詢 "真實" 資料庫
        let users = loadUsersDatabase();

        // 應用過濾邏輯
        if (type !== 'all') {
            users = users.filter((u: any) => u.type.toLowerCase() === type.toLowerCase());
        }
        if (search) {
            const s = search.toLowerCase();
            users = users.filter((u: any) => 
                u.id.toLowerCase().includes(s) || 
                u.address.toLowerCase().includes(s) || 
                (u.refCode && u.refCode.toLowerCase().includes(s))
            );
        }

        // 應用脫敏機制 (在傳給前端之前處理)
        const maskedUsers = users.map((u: any) => ({
            ...u,
            address: maskWalletAddress(u.address)
        }));

        // Pagination
        const total = maskedUsers.length;
        const paginatedUsers = maskedUsers.slice((page - 1) * limit, page * limit);

        return NextResponse.json({ 
            success: true, 
            data: paginatedUsers,
            meta: { total, page, limit } 
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch users from DB' }, { status: 500 });
    }
}
