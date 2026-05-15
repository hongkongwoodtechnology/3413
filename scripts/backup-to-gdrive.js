const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { google } = require('googleapis');

const DATA_DIR = path.join(__dirname, '../data');

const CLIENT_ID = (process.env.GOOGLE_OAUTH_CLIENT_ID || '').replace(/"/g, '');
const CLIENT_SECRET = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').replace(/"/g, '');
const REFRESH_TOKEN = (process.env.GOOGLE_OAUTH_REFRESH_TOKEN || '').replace(/"/g, '');
const FOLDER_ID = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').replace(/"/g, '');

const LOG_FILE = path.join(DATA_DIR, 'backups', 'gdrive_backup.log');

function log(message) {
    const line = `[${new Date().toISOString()}] ${message}`;
    console.log(line);
    try {
        const dir = path.dirname(LOG_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(LOG_FILE, line + '\n', 'utf-8');
    } catch (_) {}
}

async function backupToDrive() {
    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !FOLDER_ID) {
        log('MISSING_CONFIG: Google OAuth credentials incomplete in .env.local');
        log('  Run: node scripts/get-google-token.js to refresh token.');
        process.exit(1);
    }

    if (!fs.existsSync(DATA_DIR)) {
        log(`DATA_DIR_NOT_FOUND: ${DATA_DIR}`);
        process.exit(1);
    }

    try {
        log('Connecting to Google Drive API...');

        const oauth2Client = new google.auth.OAuth2(
            CLIENT_ID,
            CLIENT_SECRET,
            'https://developers.google.com/oauthplayground'
        );

        oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const filesToBackup = fs.readdirSync(DATA_DIR)
            .filter(file => file.endsWith('.json') && file.includes('_db'));

        if (filesToBackup.length === 0) {
            log('No _db.json files found to backup.');
            return;
        }

        log(`Found ${filesToBackup.length} db file(s) to upload.`);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        for (const file of filesToBackup) {
            const filePath = path.join(DATA_DIR, file);
            const fileName = `${file.replace('.json', '')}_backup_${timestamp}.json`;

            const fileMetadata = {
                name: fileName,
                parents: FOLDER_ID === 'root' ? undefined : [FOLDER_ID],
            };

            const media = {
                mimeType: 'application/json',
                body: fs.createReadStream(filePath),
            };

            log(`Uploading ${fileName}...`);

            const response = await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id',
            });

            log(`OK: ${fileName} -> ${response.data.id}`);
        }

        log('All files backed up to Google Drive.');

        const allFiles = fs.readdirSync(DATA_DIR)
            .filter(f => f.endsWith('.json') && f.includes('_db'));

        if (allFiles.length > 0) {
            const listResp = await drive.files.list({
                q: `'${FOLDER_ID}' in parents and name contains '_backup_'`,
                orderBy: 'createdTime desc',
                pageSize: 100,
                fields: 'files(id, name, createdTime)',
            });

            const toKeep = allFiles.length * 7;
            if (listResp.data.files && listResp.data.files.length > toKeep) {
                const toDelete = listResp.data.files.slice(toKeep);
                for (const f of toDelete) {
                    await drive.files.delete({ fileId: f.id });
                    log(`Cleaned old: ${f.name}`);
                }
            }
        }

        log('DONE');
    } catch (error) {
        if (error.message && error.message.includes('invalid_grant')) {
            log('TOKEN_EXPIRED: Refresh token is invalid or expired.');
            log('  Run: node scripts/get-google-token.js to get a new token.');
        } else {
            log(`ERROR: ${error.message}`);
        }
        process.exit(1);
    }
}

backupToDrive();
