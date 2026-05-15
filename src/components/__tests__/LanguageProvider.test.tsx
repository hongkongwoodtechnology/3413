import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '../LanguageProvider';

// A test component to consume the context
const TestComponent = () => {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div>
      <span data-testid="lang-display">{language}</span>
      <span data-testid="text-display">{t('footer.faq')}</span>
      <button onClick={() => setLanguage('ja')}>Set Japanese</button>
    </div>
  );
};

const TranslationProbe = ({ translationKey }: { translationKey: string }) => {
  const { t } = useLanguage();
  return <span data-testid={`translation-${translationKey}`}>{t(translationKey)}</span>;
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
    expect(screen.getByTestId('text-display')).toHaveTextContent('FAQ');
  });

  test('should auto-detect exact supported language (es)', () => {
    mockNavigatorLanguage('es');
    
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    expect(screen.getByTestId('lang-display')).toHaveTextContent('es');
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
    expect(screen.getByTestId('text-display')).toHaveTextContent('常見問題');
  });

  test('should map zh-SG to zh-CN', () => {
    mockNavigatorLanguage('zh-SG');
    
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    expect(screen.getByTestId('lang-display')).toHaveTextContent('zh-CN');
    expect(screen.getByTestId('text-display')).toHaveTextContent('常见问题');
  });

  test('should prefer initialLocale for locale routes before client effects run', () => {
    mockNavigatorLanguage('en');

    render(
      React.createElement(
        LanguageProvider as React.ComponentType<any>,
        { initialLocale: 'zh-CN' },
        <TestComponent />
      )
    );

    expect(screen.getByTestId('lang-display')).toHaveTextContent('zh-CN');
    expect(screen.getByTestId('text-display')).toHaveTextContent('常见问题');
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

  test('should ignore ?lang query overrides and keep localStorage as the client-side source of truth', () => {
    mockNavigatorLanguage('es');
    localStorage.setItem('app-language', 'de');
    window.history.replaceState({}, '', '/?lang=ja');

    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    expect(screen.getByTestId('lang-display')).toHaveTextContent('de');
    expect(localStorage.getItem('app-language')).toBe('de');
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
    expect(screen.getByTestId('text-display')).toHaveTextContent('よくある質問');

    // Check localStorage updated
    expect(localStorage.getItem('app-language')).toBe('ja');
  });

  test('should resolve time filter labels instead of returning raw i18n keys', () => {
    render(
      <LanguageProvider initialLocale="en">
        <div>
          <TranslationProbe translationKey="filter.time.live" />
          <TranslationProbe translationKey="filter.time.1day" />
          <TranslationProbe translationKey="filter.time.3days" />
          <TranslationProbe translationKey="filter.time.7days" />
          <TranslationProbe translationKey="filter.time.all" />
        </div>
      </LanguageProvider>
    );

    expect(screen.getByTestId('translation-filter.time.live')).not.toHaveTextContent('filter.time.live');
    expect(screen.getByTestId('translation-filter.time.1day')).not.toHaveTextContent('filter.time.1day');
    expect(screen.getByTestId('translation-filter.time.3days')).not.toHaveTextContent('filter.time.3days');
    expect(screen.getByTestId('translation-filter.time.7days')).not.toHaveTextContent('filter.time.7days');
    expect(screen.getByTestId('translation-filter.time.all')).not.toHaveTextContent('filter.time.all');
  });
});
