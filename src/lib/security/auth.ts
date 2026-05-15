import { createPublicKey, verify, randomUUID } from 'crypto';
import { NextResponse } from 'next/server';

const CHALLENGE_TTL = 5 * 60 * 1000;
const challenges = new Map<string, number>();

function cleanExpiredChallenges(): void {
  const now = Date.now();
  for (const [key, expiry] of challenges) {
    if (now > expiry) challenges.delete(key);
  }
}

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58ToBytes(b58: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < b58.length; i++) {
    let c = B58_ALPHABET.indexOf(b58[i]);
    if (c < 0) throw new Error('Invalid base58 character');
    for (let j = 0; j < bytes.length; j++) {
      c += bytes[j] * 58;
      bytes[j] = c & 0xff;
      c >>= 8;
    }
    while (c > 0) {
      bytes.push(c & 0xff);
      c >>= 8;
    }
  }
  for (let i = 0; i < b58.length && b58[i] === '1'; i++) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function rawEd25519PublicKeyToSpki(rawKey: Uint8Array): Buffer {
  return Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(rawKey)]);
}

export function getAdminAddresses(): string[] {
  const addresses: string[] = [];
  const fromEnv = process.env.ADMIN_WALLET_ADDRESS?.trim();
  if (fromEnv) addresses.push(fromEnv);
  const fromHouse = process.env.NEXT_PUBLIC_HOUSE_WALLET?.trim();
  if (fromHouse) addresses.push(fromHouse);
  if (addresses.length === 0) {
    addresses.push('3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2');
  }
  return [...new Set(addresses)];
}

function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET?.trim();
}

export function generateAdminChallenge(): string {
  cleanExpiredChallenges();
  const challenge = `polyball-admin:${Date.now()}:${randomUUID()}`;
  challenges.set(challenge, Date.now() + CHALLENGE_TTL);
  return challenge;
}

export function verifyAdminSignature(
  challenge: string,
  signatureBase58: string,
  publicKeyBase58: string
): boolean {
  try {
    cleanExpiredChallenges();
    const expiry = challenges.get(challenge);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      challenges.delete(challenge);
      return false;
    }
    const adminAddresses = getAdminAddresses();
    if (!adminAddresses.includes(publicKeyBase58)) return false;
    const messageBytes = Buffer.from(challenge, 'utf-8');
    const signatureBytes = Buffer.from(base58ToBytes(signatureBase58));
    const publicKeyBytes = base58ToBytes(publicKeyBase58);
    const spkiKey = rawEd25519PublicKeyToSpki(publicKeyBytes);
    const publicKey = createPublicKey({
      key: spkiKey,
      format: 'der',
      type: 'spki',
    });
    const isValid = verify(null, messageBytes, publicKey, signatureBytes);
    challenges.delete(challenge);
    return isValid;
  } catch {
    return false;
  }
}

export async function requireAdminAuth(
  request: Request
): Promise<{ authorized: true } | { authorized: false; response: Response }> {
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedCronSecret = getCronSecret();
  if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
    return { authorized: true };
  }

  const signature = request.headers.get('x-admin-signature');
  const challenge = request.headers.get('x-admin-challenge');
  const publicKey = request.headers.get('x-admin-public-key');

  if (!signature || !challenge || !publicKey) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  if (!verifyAdminSignature(challenge, signature, publicKey)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Invalid admin credentials' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true };
}
