import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

const DATA_DIR = path.join(process.cwd(), 'data');
const LAST_BACKUP_FILE = path.join(DATA_DIR, 'last_gdrive_backup.txt');

// 設定自動備份的間隔時間 (例如 1 小時 = 60 * 60 * 1000 毫秒)
// 如果距離上次備份不到 1 小時，即使觸發了也不會重新上傳，以避免超過 Google API 限制
const BACKUP_INTERVAL_MS = 60 * 60 * 1000;

export async function triggerAutoBackup() {
    try {
        if (!fs.existsSync(DATA_DIR)) return;

        let lastBackupTime = 0;
        if (fs.existsSync(LAST_BACKUP_FILE)) {
            const content = fs.readFileSync(LAST_BACKUP_FILE, 'utf-8');
            lastBackupTime = parseInt(content.trim(), 10) || 0;
        }

        const now = Date.now();
        if (now - lastBackupTime < BACKUP_INTERVAL_MS) {
            // 距離上次備份時間太短，跳過本次備份
            return;
        }

        // 立即更新時間戳記檔案，防止並發 (Race condition) 時重複觸發
        fs.writeFileSync(LAST_BACKUP_FILE, now.toString(), 'utf-8');

        // 非同步執行背景備份，不阻塞主執行緒
        runBackup().catch(e => {
            console.error("[Auto Backup] 備份失敗:", e);
            // 若失敗則還原時間戳記，讓下次請求能再次嘗試
            try {
                fs.writeFileSync(LAST_BACKUP_FILE, lastBackupTime.toString(), 'utf-8');
            } catch (err) {}
        });

    } catch (e) {
        console.error("[Auto Backup] 觸發備份機制失敗", e);
    }
}

async function runBackup() {
    console.log('[Auto Backup] 🔄 正在背景執行 Google Drive 自動備份...');
    
    const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
    const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !FOLDER_ID) {
        console.warn('[Auto Backup] ⚠️ 缺少 Google Drive OAuth 憑證，跳過自動備份。');
        return;
    }

    const oauth2Client = new google.auth.OAuth2(
        CLIENT_ID,
        CLIENT_SECRET,
        "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // 取得所有 db json 檔案
    const filesToBackup = fs.readdirSync(DATA_DIR)
        .filter(file => file.endsWith('.json') && file.includes('_db'));

    if (filesToBackup.length === 0) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    for (const file of filesToBackup) {
        const filePath = path.join(DATA_DIR, file);
        // 標記為 auto_backup 以區分是否為手動執行
        const fileName = `${file.replace('.json', '')}_auto_backup_${timestamp}.json`;

        const fileMetadata = {
            name: fileName,
            parents: FOLDER_ID === 'root' ? undefined : [FOLDER_ID], 
        };

        const media = {
            mimeType: 'application/json',
            body: fs.createReadStream(filePath),
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id',
        });
        
        console.log(`[Auto Backup] ✅ 成功備份 ${file} (ID: ${response.data.id})`);
    }
    
    console.log('[Auto Backup] 🎉 自動備份完成！');
}