const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');

const HOST = '143.20.156.75';
const USER = 'root';
const PASSWORD = 'ny6o-vrP9-wsfd';
const REMOTE_DIR = '/root/gamble-site';
const LOCAL_TAR = path.join(__dirname, 'deploy-package.tar.gz');
const REMOTE_TAR = '/tmp/gamble-update.tar.gz';

function execCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let output = '';
      stream.on('data', (data) => { process.stdout.write(data); output += data.toString(); });
      stream.stderr.on('data', (data) => { process.stderr.write(data); output += data.toString(); });
      stream.on('close', (code) => resolve({ code, output }));
    });
  });
}

async function deploy() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({ host: HOST, port: 22, username: USER, password: PASSWORD });
  });

  console.log(`Uploading ${(fs.statSync(LOCAL_TAR).size / 1024).toFixed(0)} KB...`);
  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(LOCAL_TAR, REMOTE_TAR, {}, (err) => {
        sftp.end();
        if (err) return reject(err);
        console.log('✓ Uploaded\n');
        resolve();
      });
    });
  });

  console.log('=== Stopping ===');
  await execCommand(conn, 'pm2 stop gamble-site 2>/dev/null; pm2 delete gamble-site 2>/dev/null; echo "ok"');

  console.log('=== Extracting ===');
  await execCommand(conn, `cd "${REMOTE_DIR}" && tar -xzf "${REMOTE_TAR}" --overwrite`);
  await execCommand(conn, `rm -f "${REMOTE_TAR}"`);

  console.log('=== Verify seed file ===');
  await execCommand(conn, 'ls -la /root/gamble-site/data/worldcup_schedule_2026.json 2>&1');

  console.log('=== Starting ===');
  await execCommand(conn, `cd "${REMOTE_DIR}" && pm2 start node --name gamble-site -- node_modules/next/dist/bin/next start`);
  await execCommand(conn, 'pm2 save');

  console.log('\n=== Verify worldcup in API ===');
  await execCommand(conn, 'sleep 8 && curl -s --max-time 30 "http://localhost:3000/api/matches?lang=zh-CN" > /tmp/matches.json 2>&1');
  await execCommand(conn, 'grep -c "worldcup" /tmp/matches.json 2>&1');

  console.log('\n=== PM2 ===');
  await execCommand(conn, 'pm2 status');

  console.log('\n✓ Done! http://polyballdefi.xyz');
  conn.end();
}

deploy().catch(err => console.error('FAILED:', err));
