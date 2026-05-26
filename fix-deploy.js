const { Client } = require('ssh2');

const HOST = '143.20.156.75';
const USER = 'root';
const PASSWORD = 'ny6o-vrP9-wsfd';

function execCmd(conn, cmd, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
    conn.exec(cmd, (err, stream) => {
      if (err) { clearTimeout(timer); return reject(err); }
      let out = '';
      stream.on('data', (d) => { out += d.toString(); });
      stream.stderr.on('data', (d) => { out += d.toString(); });
      stream.on('close', (code) => { clearTimeout(timer); resolve({ code, out }); });
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((r, e) => {
    conn.on('ready', r);
    conn.on('error', e);
    conn.connect({ host: HOST, port: 22, username: USER, password: PASSWORD, readyTimeout: 300000 });
  });

  try {
    // Kill any stuck build processes
    await execCmd(conn, 'pkill -f "next build" 2>/dev/null; sleep 3; echo done');
    
    // Restart PM2 - just bring old site back up
    let r = await execCmd(conn, 'pm2 restart gamble-site 2>&1 || pm2 start node --name gamble-site -- next start 2>&1');
    console.log(r.out);
    r = await execCmd(conn, 'pm2 save');
    r = await execCmd(conn, 'pm2 ls');
    console.log(r.out);
    
    // Now try build with minimal memory
    r = await execCmd(conn, 'nohup bash -c \'cd /root/gamble-site && NODE_OPTIONS="--max-old-space-size=400" npm run build > /tmp/gamble-build3.log 2>&1; echo BUILD_EXIT_$? >> /tmp/gamble-build3.log; pm2 restart gamble-site >> /tmp/gamble-build3.log 2>&1\' > /dev/null 2>&1 & echo PID=$!');
    console.log('Build PID:', r.out.trim());
    console.log('\nBuild running in background. Site is back up (old build).');
    console.log('After ~15 min, visit http://polyballdefi.xyz/zh-TW for the fix.');
    console.log('Check: ssh root@143.20.156.75 "tail /tmp/gamble-build3.log"');
  } finally {
    conn.end();
  }
}

main().catch(e => { console.error(e.message); });
