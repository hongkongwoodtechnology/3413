/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { OverviewKpiGrid } from './OverviewKpiGrid';
import { OverviewAlerts } from './OverviewAlerts';
import { OverviewShortcuts } from './OverviewShortcuts';

describe('admin overview blocks', () => {
  it('renders KPI cards', () => {
    render(
      <OverviewKpiGrid
        items={[
          { label: '總投注額', value: '$120,000' },
          { label: '投注人數', value: '3,240' },
          { label: '待派彩', value: '12' },
          { label: '平台儲備池', value: '$520.25' },
        ]}
      />
    );

    expect(screen.getByText('總投注額')).toBeInTheDocument();
    expect(screen.getByText('投注人數')).toBeInTheDocument();
    expect(screen.getByText('待派彩')).toBeInTheDocument();
    expect(screen.getByText('平台儲備池')).toBeInTheDocument();
  });

  it('renders alerts', () => {
    render(
      <OverviewAlerts
        alerts={[
          { title: '待派彩提醒', description: '目前有 12 筆待派彩', tone: 'warning' },
          { title: '收益摘要', description: '平台淨收益穩定', tone: 'success' },
        ]}
      />
    );

    expect(screen.getByText('待派彩提醒')).toBeInTheDocument();
    expect(screen.getByText('收益摘要')).toBeInTheDocument();
  });

  it('renders shortcut links', () => {
    render(
      <OverviewShortcuts
        items={[
          { label: '市場與賽事', href: '/admin/markets' },
          { label: '財務與派彩', href: '/admin/finance' },
          { label: '用戶與推薦', href: '/admin/users' },
          { label: '安全與系統', href: '/admin/secure-audit-logs' },
        ]}
      />
    );

    expect(screen.getByRole('link', { name: '市場與賽事' })).toHaveAttribute('href', '/admin/markets');
    expect(screen.getByRole('link', { name: '財務與派彩' })).toHaveAttribute('href', '/admin/finance');
    expect(screen.getByRole('link', { name: '用戶與推薦' })).toHaveAttribute('href', '/admin/users');
    expect(screen.getByRole('link', { name: '安全與系統' })).toHaveAttribute('href', '/admin/secure-audit-logs');
  });
});
