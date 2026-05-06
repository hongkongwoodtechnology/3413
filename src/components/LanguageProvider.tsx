
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, TRANSLATIONS, LANGUAGES } from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang') as Language;
    if (urlLang && LANGUAGES.some(l => l.code === urlLang)) {
      setLanguageState(urlLang);
      localStorage.setItem('app-language', urlLang);
      return;
    }

    const savedLang = localStorage.getItem('app-language') as Language;
    if (savedLang && LANGUAGES.some(l => l.code === savedLang)) {
      setLanguageState(savedLang);
      return;
    }

    const browserLang = navigator.language;

    if (browserLang.startsWith('zh')) {
      setLanguageState('zh-TW');
    } else {
      const matchedLang = LANGUAGES.find(l =>
        l.code !== 'zh-TW' && l.code !== 'zh-CN' && (
          browserLang === l.code ||
          browserLang.startsWith(l.code + '-')
        )
      );
      if (matchedLang) {
        setLanguageState(matchedLang.code);
      }
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app-language', lang);
  };

  const t = (key: string): string => {
    const dict = TRANSLATIONS[language] || TRANSLATIONS['en'];
    return dict[key] || TRANSLATIONS['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
