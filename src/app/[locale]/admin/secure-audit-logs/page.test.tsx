/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminAuditLogsPage from './page';

const mockSendTransaction = jest.fn();
const mockPublicKey = {
  toBase58: () => 'AdminWallet1111111111111111111111111111111',
};
const mockConnection = {
  confirmTransaction: jest.fn(),
};

jest.mock('@solana/web3.js', () => ({
  PublicKey: class MockPublicKey {
    value: string;

    constructor(value: string) {
      this.value = value;
    }

    toBuffer() {
      return Buffer.from(this.value.padEnd(32, '1').slice(0, 32));
    }

    toBase58() {
      return this.value;
    }

    static findProgramAddressSync() {
      return [new MockPublicKey('MockAta1111111111111111111111111111111111')];
    }
  },
  ComputeBudgetProgram: {
    setComputeUnitLimit: jest.fn(() => ({ type: 'compute-budget' })),
  },
  SystemProgram: {
    programId: { toBase58: () => '11111111111111111111111111111111' },
  },
  Transaction: class MockTransaction {
    add() {
      return this;
    }
  },
  TransactionInstruction: class MockTransactionInstruction {},
}));

jest.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    publicKey: mockPublicKey,
    sendTransaction: mockSendTransaction,
  }),
  useConnection: () => ({
    connection: mockConnection,
  }),
}));

jest.mock('@/components/admin/AdminPageHeader', () => ({
  AdminPageHeader: ({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </div>
  ),
}));

jest.mock('@/lib/wallets', () => ({
  USDT_MINT: {
    toBuffer: () => Buffer.from('usdt'.padEnd(32, '1').slice(0, 32)),
    toBase58: () => 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },
  getDestinationAtaTargets: () => ([
    {
      key: 'house',
      label: '平台淨收益收款',
      owner: {
        toBuffer: () => Buffer.from('owner'.padEnd(32, '1').slice(0, 32)),
        toBase58: () => '3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2',
      },
    },
  ]),
}));

describe('AdminAuditLogsPage ATA checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/api/admin/logs')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: [] }),
        } as Response;
      }

      if (url.includes('/api/rpc')) {
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
        if (body?.method === 'getLatestBlockhash') {
          return {
            ok: true,
            json: async () => ({
              result: {
                value: {
                  blockhash: 'mock-blockhash',
                  lastValidBlockHeight: 123,
                },
              },
            }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({
            result: {
              value: {
                data: ['AA==', 'base64'],
              },
            },
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as jest.Mock;
  });

  it('treats malformed ATA account data as needed instead of existing', async () => {
    const user = userEvent.setup();
    render(<AdminAuditLogsPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/logs?search=');
    });

    await user.click(screen.getByRole('button', { name: '檢查 ATA' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/rpc',
        expect.objectContaining({ method: 'POST' })
      );
    });

    expect(screen.getByText('平台淨收益收款')).toBeInTheDocument();
    expect(screen.queryByText('目前沒有待建立項目')).not.toBeInTheDocument();
  });

  it('creates missing ATAs through the wallet adapter flow', async () => {
    const user = userEvent.setup();
    mockSendTransaction.mockResolvedValue('mock-signature');
    mockConnection.confirmTransaction.mockResolvedValue({ value: { err: null } });

    render(<AdminAuditLogsPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/logs?search=');
    });

    await user.click(screen.getByRole('button', { name: '檢查 ATA' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '建立缺少的 ATA' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: '建立缺少的 ATA' }));

    await waitFor(() => {
      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
    });
  });
});
