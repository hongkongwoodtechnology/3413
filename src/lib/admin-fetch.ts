import { PublicKey } from '@solana/web3.js';

interface AdminFetchOptions {
  publicKey: PublicKey | null;
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | undefined;
}

export async function adminFetch(
  url: string,
  options: RequestInit & AdminFetchOptions
): Promise<Response> {
  const { publicKey, signMessage, ...fetchOptions } = options;

  if (!publicKey || !signMessage) {
    throw new Error('Wallet not connected');
  }

  const challengeRes = await fetch(`/api/auth/challenge?address=${publicKey.toBase58()}`);
  if (!challengeRes.ok) {
    const error = await challengeRes.json();
    throw new Error(error.error || 'Failed to get challenge');
  }

  const { challenge } = await challengeRes.json();
  const signature = await signMessage(new TextEncoder().encode(challenge));

  const headers = new Headers(fetchOptions.headers);
  headers.set('x-admin-challenge', challenge);
  headers.set('x-admin-signature', Buffer.from(signature).toString('base64'));
  headers.set('x-admin-public-key', publicKey.toBase58());

  return fetch(url, {
    ...fetchOptions,
    headers,
  });
}
