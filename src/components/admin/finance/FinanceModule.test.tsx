/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { RevenuePanel } from './RevenuePanel';
import { PayoutPanel } from './PayoutPanel';
import { DangerActionsPanel } from './DangerActionsPanel';

describe('finance module blocks', () => {
  it('renders revenue summary', () => {
    render(<RevenuePanel reserveBalance={520.25} totalOwed={120.4} />);

    expect(screen.getByText('平台儲備池')).toBeInTheDocument();
    expect(screen.getByText('待派彩金額')).toBeInTheDocument();
  });

  it('renders payout list', () => {
    render(
      <PayoutPanel
        payouts={[
          { betId: '1', matchName: 'A vs B', userAddress: 'wallet-1', winAmount: 88.5, type: 'win' },
        ]}
      />
    );

    expect(screen.getByText('待派彩清單')).toBeInTheDocument();
    expect(screen.getByText('A vs B')).toBeInTheDocument();
  });

  it('renders danger action buttons', () => {
    render(
      <DangerActionsPanel
        onArchive={() => undefined}
        onMarkLegacyWins={() => undefined}
        isSubmitting={false}
      />
    );

    expect(screen.getByRole('button', { name: '封存舊注單' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '標記舊架構贏家' })).toBeInTheDocument();
  });
});
