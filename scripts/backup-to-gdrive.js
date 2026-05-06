const path = require('path');
const fs = require('fs');

// 為了讓 node 能讀取 .env.local，我們需要明確指定路徑
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { google } = require('googleapis');

// 設定要備份的資料夾路徑
const DATA_DIR = path.join(__dirname, '../data');

// 從 .env 讀取 Google OAuth 憑證
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function backupToDrive() {
    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !FOLDER_ID) {
        console.error('❌ 缺少 Google Drive OAuth 憑證！');
        console.error('請確保 .env 中已設定 GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN 與 GOOGLE_DRIVE_FOLDER_ID。');
        process.exit(1);
    }

    if (!fs.existsSync(DATA_DIR)) {
        console.error(`❌ 找不到資料夾: ${DATA_DIR}`);
        console.error('沒有資料可以備份。');
        process.exit(1);
    }

    try {
        console.log('🔄 正在連接到 Google Drive API (OAuth 2.0)...');
        
        // 建立 OAuth2 用戶端
        const oauth2Client = new google.auth.OAuth2(
            CLIENT_ID,
            CLIENT_SECRET,
            "https://developers.google.com/oauthplayground" // Redirect URL
        );

        // 設定 Refresh Token，讓程式能永久自動獲取新的 Access Token
        oauth2Client.setCredentials({
            refresh_token: REFRESH_TOKEN
        });

        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        
        // 取得所有 db json 檔案
        const filesToBackup = fs.readdirSync(DATA_DIR)
            .filter(file => file.endsWith('.json') && file.includes('_db'));

        if (filesToBackup.length === 0) {
            console.log('⚠️ 找不到任何需要備份的資料庫檔案。');
            return;
        }

        console.log(`📦 找到 ${filesToBackup.length} 個資料庫檔案準備備份...`);

        // 產生備份檔案名稱 (包含時間戳記)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        for (const file of filesToBackup) {
            const filePath = path.join(DATA_DIR, file);
            // 檔名格式： 原檔名_backup_時間戳記.json
            const fileName = `${file.replace('.json', '')}_backup_${timestamp}.json`;

            const fileMetadata = {
                name: fileName,
                parents: FOLDER_ID === 'root' ? undefined : [FOLDER_ID], 
            };

            const media = {
                mimeType: 'application/json',
                body: fs.createReadStream(filePath),
            };

            console.log(`📤 正在上傳 ${fileName} 到 Google Drive...`);
            
            const response = await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id',
            });

            console.log(`✅ 備份成功！檔案 ID: ${response.data.id}`);
        }
        
        console.log('🎉 所有資料庫備份完成！');
    } catch (error) {
        console.error('❌ 上傳到 Google Drive 時發生錯誤:', error.message);
        process.exit(1);
    }
}

backupToDrive();