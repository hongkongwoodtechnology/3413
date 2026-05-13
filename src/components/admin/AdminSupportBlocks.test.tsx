/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ReferralTools } from './users/ReferralTools';
import { AtaInitializationPanel } from './system/AtaInitializationPanel';

describe('admin support blocks', () => {
  it('renders referral tools form controls', () => {
    render(
      <ReferralTools
        airdropAddress=""
        airdropAmount=""
        rateAddress=""
        commissionRate=""
        onAirdropAddressChange={() => undefined}
        onAirdropAmountChange={() => undefined}
        onRateAddressChange={() => undefined}
        onCommissionRateChange={() => undefined}
        onAirdrop={() => undefined}
        onUpdateRate={() => undefined}
        isAirdropping={false}
        isUpdatingRate={false}
      />
    );

    expect(screen.getByText('推薦工具')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '發送體驗金' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '更新分成比例' })).toBeInTheDocument();
  });

  it('renders ata initialization panel actions', () => {
    render(
      <AtaInitializationPanel
        status="idle"
        onCheck={() => undefined}
        onCreate={() => undefined}
      />
    );

    expect(screen.getByText('ATA 初始化')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '檢查 ATA' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '建立缺少的 ATA' })).toBeInTheDocument();
  });
});
