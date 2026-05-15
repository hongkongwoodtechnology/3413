/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import AdminLayout from './layout';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { LanguageProvider } from '@/components/LanguageProvider';

describe('Admin layout shell', () => {
  it('shows the five unified admin navigation modules', () => {
    render(
      <LanguageProvider initialLocale="en">
        <AdminLayout>
          <div>admin content</div>
        </AdminLayout>
      </LanguageProvider>
    );

    expect(screen.getByText('總覽')).toBeInTheDocument();
    expect(screen.getByText('市場與賽事')).toBeInTheDocument();
    expect(screen.getByText('財務與派彩')).toBeInTheDocument();
    expect(screen.getByText('用戶與推薦')).toBeInTheDocument();
    expect(screen.getByText('安全與系統')).toBeInTheDocument();
    expect(screen.getByText('admin content')).toBeInTheDocument();
  });
});

describe('AdminPageHeader', () => {
  it('renders title, description, and actions in the shared admin header', () => {
    render(
      <AdminPageHeader
        title="總覽"
        description="營運摘要、風險提醒與快捷入口"
        actions={<button>重新整理</button>}
      />
    );

    expect(screen.getByText('總覽')).toBeInTheDocument();
    expect(screen.getByText('營運摘要、風險提醒與快捷入口')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新整理' })).toBeInTheDocument();
  });
});
