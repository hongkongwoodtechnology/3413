const { Keypair } = require('@solana/web3.js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const adminSecretMatch = envContent.match(/^ADMIN_SECRET_KEY=(.+)$/m);
if (!adminSecretMatch) { console.error('ADMIN_SECRET_KEY not found'); process.exit(1); }
const secretKeyStr = adminSecretMatch[1].trim();

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58ToBytes(b58) {
  const bytes = [];
  for (let i = 0; i < b58.length; i++) {
    let c = BASE58.indexOf(b58[i]);
    if (c < 0) throw new Error('Invalid base58 char');
    for (let j = 0; j < bytes.length; j++) { c += bytes[j] * 58; bytes[j] = c & 0xff; c >>= 8; }
    while (c > 0) { bytes.push(c & 0xff); c >>= 8; }
  }
  for (let i = 0; i < b58.length && b58[i] === '1'; i++) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

let secretKey;
if (secretKeyStr.startsWith('[')) {
  secretKey = new Uint8Array(JSON.parse(secretKeyStr));
} else {
  secretKey = base58ToBytes(secretKeyStr);
}

const adminKeypair = Keypair.fromSecretKey(secretKey);
const adminAddress = adminKeypair.publicKey.toBase58();

console.log('Admin public key:', adminAddress);
console.log('Expected address:', '3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2');
console.log('Match:', adminAddress === '3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2' ? 'YES' : 'NO');
