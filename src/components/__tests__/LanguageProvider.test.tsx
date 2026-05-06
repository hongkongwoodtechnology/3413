import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '@/components/LanguageProvider';

// A test component to consume the context
const TestComponent = () => {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div>
      <span data-testid="lang-display">{language}</span>
      <span data-testid="text-display">{t('app.title')}</span>
      <button onClick={() => setLanguage('ja')}>Set Japanese</button>
    </div>
  );
};

describe('LanguageProvider', () => {
  let originalLanguage: PropertyDescriptor | undefined;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Store original navigator.language
    originalLanguage = Object.getOwnPropertyDescriptor(window.navigator, 'language');
  });

  afterEach(() => {
    // Restore original navigator.language
    if (originalLanguage) {
      Object.defineProperty(window.navigator, 'language', originalLanguage);
    }
  });

  const mockNavigatorLanguage = (lang: string) => {
    Object.defineProperty(window.navigator, 'language', {
      value: lang,
      configurable: true,
    });
  };

  test('should fallback to "en" when browser language is not supported', () => {
    mockNavigatorLanguage('it-IT'); // Italian is not in our list
    
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    expect(screen.getByTestId('lang-display')).toHaveTextContent('en');
    expect(screen.getByTestId('text-display')).toHaveTextContent('Prophecy Arena'); // English title
  });

  test('should auto-detect exact supported language (es)', () => {
    mockNavigatorLanguage('es');
    
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    expect(screen.getByTestId('lang-display')).toHaveTextContent('es');
    expect(screen.getByTestId('text-display')).toHaveTextContent('Prophecy Arena'); // Spanish title happens to be same, let's check a different way if needed, but 'es' is set.
  });

  test('should auto-detect base language (fr-CA -> fr)', () => {
    mockNavigatorLanguage('fr-CA');
    
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    expect(screen.getByTestId('lang-display')).toHaveTextContent('fr');
  });

  test('should map zh-HK to zh-TW', () => {
    mockNavigatorLanguage('zh-HK');
    
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    expect(screen.getByTestId('lang-display')).toHaveTextContent('zh-TW');
    expect(screen.getByTestId('text-display')).toHaveTextContent('PolyBall');
  });

  test('should map zh-SG to zh-CN', () => {
    mockNavigatorLanguage('zh-SG');
    
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    expect(screen.getByTestId('lang-display')).toHaveTextContent('zh-CN');
    expect(screen.getByTestId('text-display')).toHaveTextContent('预言竞技场');
  });

  test('should respect localStorage over browser language', () => {
    mockNavigatorLanguage('es');
    localStorage.setItem('app-language', 'de'); // User explicitly chose German before
    
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    expect(screen.getByTestId('lang-display')).toHaveTextContent('de');
  });

  test('should update language and persist to localStorage when setLanguage is called', async () => {
    mockNavigatorLanguage('en');
    
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    // Initial state
    expect(screen.getByTestId('lang-display')).toHaveTextContent('en');

    // Click button to change to Japanese
    await act(async () => {
      screen.getByText('Set Japanese').click();
    });

    // Check UI updated
    expect(screen.getByTestId('lang-display')).toHaveTextContent('ja');
    expect(screen.getByTestId('text-display')).toHaveTextContent('予言アリーナ');

    // Check localStorage updated
    expect(localStorage.getItem('app-language')).toBe('ja');
  });
});
