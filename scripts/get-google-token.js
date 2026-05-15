const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const CLIENT_ID = (process.env.GOOGLE_OAUTH_CLIENT_ID || '').replace(/"/g, '');
const CLIENT_SECRET = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').replace(/"/g, '');

const fs = require('fs');
const http = require('http');
const { google } = require('googleapis');

const ENV_FILE = path.join(__dirname, '../.env.local');

console.log('\n========================================');
console.log('  Google Drive Token Refresh');
console.log('========================================\n');

const PLAYGROUND_URL = 'https://developers.google.com/oauthplayground';

const { exec } = require('child_process');
exec(`start firefox "${PLAYGROUND_URL}"`);

console.log('1. Browser opened: Google OAuth Playground');
console.log('');
console.log('2. Click the GEAR icon (top right) -> "Use your own OAuth credentials"');
console.log('   Client ID:     ' + CLIENT_ID);
console.log('   Client Secret: ' + CLIENT_SECRET);
console.log('');
console.log('3. In Step 1 (left panel), find "Drive API v3"');
console.log('   Expand it and select:');
console.log('   \x1b[33mhttps://www.googleapis.com/auth/drive.file\x1b[0m');
console.log('   Then click "Authorize APIs"');
console.log('');
console.log('4. Login with your Google account, accept permissions');
console.log('');
console.log('5. In Step 2, click "Exchange authorization code for tokens"');
console.log('');
console.log('6. Copy the "Refresh token" value (Step 2 right panel)');
console.log('   and ENTER IT BELOW:\n');

const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Refresh token: ', (newToken) => {
    rl.close();

    newToken = newToken.trim().replace(/"/g, '');
    if (!newToken) {
        console.log('\nNo token entered. Aborting.');
        process.exit(1);
    }

    let envContent = fs.readFileSync(ENV_FILE, 'utf-8');
    envContent = envContent.replace(
        /GOOGLE_OAUTH_REFRESH_TOKEN=.*/,
        `GOOGLE_OAUTH_REFRESH_TOKEN="${newToken}"`
    );
    fs.writeFileSync(ENV_FILE, envContent, 'utf-8');

    console.log('\n\x1b[32m.env.local updated!\x1b[0m');
    console.log('Testing backup...\n');

    const { spawn } = require('child_process');
    const test = spawn('node', ['scripts/backup-to-gdrive.js'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
    });
    test.on('close', (code) => {
        process.exit(code);
    });
});
