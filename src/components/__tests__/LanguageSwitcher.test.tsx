import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '../LanguageProvider';
import { LanguageSwitcher } from '../LanguageSwitcher';

const push = jest.fn();
const mockedUsePathname = jest.fn();
const mockedUseSearchParams = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => mockedUsePathname(),
  useSearchParams: () => mockedUseSearchParams(),
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    push.mockReset();
    localStorage.clear();
    mockedUsePathname.mockReturnValue('/zh-CN/faq');
    mockedUseSearchParams.mockReturnValue(new URLSearchParams('page=2'));
  });

  test('should navigate to the same sub-path under the selected locale', () => {
    render(
      <LanguageProvider initialLocale="zh-CN">
        <LanguageSwitcher />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('日本語'));

    expect(localStorage.getItem('app-language')).toBe('ja');
    expect(push).toHaveBeenCalledWith('/ja/faq?page=2');
  });

  test('should navigate from root to the selected locale root', () => {
    mockedUsePathname.mockReturnValue('/');
    mockedUseSearchParams.mockReturnValue(new URLSearchParams());

    render(
      <LanguageProvider initialLocale="en">
        <LanguageSwitcher />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Deutsch'));

    expect(push).toHaveBeenCalledWith('/de');
  });
});
