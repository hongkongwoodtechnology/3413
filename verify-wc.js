const { Client } = require('ssh2');

const HOST = '143.20.156.75';
const USER = 'root';
const PASSWORD = 'ny6o-vrP9-wsfd';

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

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({ host: HOST, port: 22, username: USER, password: PASSWORD });
  });

  await execCommand(conn, `python3 -c "
import json, urllib.request
data = json.loads(urllib.request.urlopen('http://localhost:3000/api/matches?lang=zh-CN', timeout=30).read())
total = len(data)
wc = [m for m in data if m.get('category') == 'worldcup']
print(f'Total matches: {total}')
print(f'World Cup matches: {len(wc)}')
if wc:
    for m in wc[:5]:
        print(f'  - {m[\"home\"]} vs {m[\"away\"]} | {m.get(\"league\",\"\")} | status: {m[\"status\"]}')
" 2>&1`);

  conn.end();
}

main().catch(err => console.error('Error:', err.message));
