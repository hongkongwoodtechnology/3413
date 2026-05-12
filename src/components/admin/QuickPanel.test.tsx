/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QuickPanel } from './QuickPanel';

describe('QuickPanel', () => {
  it('renders summary cards and admin shortcut links', () => {
    render(
      <QuickPanel
        cards={[
          { label: '總投注額', value: '$120,000' },
          { label: '待派彩', value: '12 筆', tone: 'warning' },
          { label: '平台儲備池', value: '$520.25', tone: 'success' },
        ]}
      />
    );

    expect(screen.getByText('Admin Quick Panel')).toBeInTheDocument();
    expect(screen.getByText('總投注額')).toBeInTheDocument();
    expect(screen.getByText('待派彩')).toBeInTheDocument();
    expect(screen.getByText('平台儲備池')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '進入完整後台' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: '市場與賽事' })).toHaveAttribute('href', '/admin/markets');
    expect(screen.getByRole('link', { name: '財務與派彩' })).toHaveAttribute('href', '/admin/finance');
    expect(screen.getByRole('link', { name: '用戶與推薦' })).toHaveAttribute('href', '/admin/users');
    expect(screen.getByRole('link', { name: '安全與系統' })).toHaveAttribute('href', '/admin/secure-audit-logs');
  });
});
