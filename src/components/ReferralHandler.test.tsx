/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { TextDecoder, TextEncoder } from 'util';

(global as typeof globalThis & {
  TextDecoder: typeof TextDecoder;
  TextEncoder: typeof TextEncoder;
}).TextEncoder = TextEncoder;

(global as typeof globalThis & {
  TextDecoder: typeof TextDecoder;
  TextEncoder: typeof TextEncoder;
}).TextDecoder = TextDecoder;

const { ReferralHandler } = require('./ReferralHandler') as typeof import('./ReferralHandler');
const { getBoundReferrerStorageKey } = require('@/lib/wallets') as typeof import('@/lib/wallets');

const mockUseWallet = jest.fn();
const mockUseSearchParams = jest.fn();
const mockUseLanguage = jest.fn(() => ({ t: (key: string) => key }));

jest.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => mockUseWallet(),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

jest.mock('./LanguageProvider', () => ({
  useLanguage: () => mockUseLanguage(),
}));

describe('ReferralHandler', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('pendingReferrer', 'referrer-address');
    mockUseSearchParams.mockReturnValue({
      get: () => null,
    });
    mockUseWallet.mockReturnValue({
      connected: true,
      publicKey: {
        toBase58: () => 'wallet-adapter-address',
      },
      wallet: {
        adapter: {
          name: 'Phantom',
        },
      },
    });
    Object.defineProperty(window, 'phantom', {
      configurable: true,
      value: {
        solana: {
          publicKey: {
            toBase58: () => 'phantom-provider-address',
          },
        },
      },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as jest.Mock;
  });

  it('stores the bound referrer under the preferred wallet address key', async () => {
    render(<ReferralHandler />);

    await waitFor(() => {
      expect(
        localStorage.getItem(getBoundReferrerStorageKey('phantom-provider-address'))
      ).toBe('referrer-address');
    });

    expect(localStorage.getItem('bound_referrer_wallet-adapter-address')).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/referral',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          address: 'referrer-address',
          newRefereeAddress: 'phantom-provider-address',
        }),
      })
    );
  });
});
