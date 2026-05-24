
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, TRANSLATIONS, LANGUAGES } from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function detectLanguage(browserLang: string): Language {
  const validCodes = LANGUAGES.map(l => l.code);
  
  if (validCodes.includes(browserLang as Language)) {
    return browserLang as Language;
  }
  
  const baseLang = browserLang.split('-')[0];
  if (validCodes.includes(baseLang as Language)) {
    return baseLang as Language;
  }
  
  if (browserLang.startsWith('zh')) {
    if (browserLang === 'zh-HK' || browserLang === 'zh-MO') {
      return 'zh-TW';
    }
    if (browserLang === 'zh-SG') {
      return 'zh-CN';
    }
    return 'zh-TW';
  }
  
  const matchedLang = LANGUAGES.find(l => 
    l.code !== 'zh-TW' && l.code !== 'zh-CN' && 
    (l.code === baseLang || browserLang.startsWith(l.code + '-'))
  );
  
  if (matchedLang) {
    return matchedLang.code;
  }
  
  return 'en';
}

export function LanguageProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: Language }) {
  const [language, setLanguageState] = useState<Language>(initialLocale || 'en');

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (initialLocale) {
      setLanguageState(initialLocale);
      return;
    }

    const savedLang = localStorage.getItem('app-language') as Language;
    if (savedLang && LANGUAGES.some(l => l.code === savedLang)) {
      setLanguageState(savedLang);
      return;
    }

    const browserLang = navigator.language;
    const detectedLang = detectLanguage(browserLang);
    setLanguageState(detectedLang);
  }, [initialLocale]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app-language', lang);
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const dict = TRANSLATIONS[language] || TRANSLATIONS['en'];
    let text = dict[key] || TRANSLATIONS['en'][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return text;
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
