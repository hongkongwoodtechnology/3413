
"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "./LanguageProvider";
import { LANGUAGES, Language } from "@/lib/i18n";
import { Globe, ChevronDown, Check } from "lucide-react";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();

  const localeSet = useMemo(() => new Set(LANGUAGES.map((lang) => lang.code)), []);

  function buildLocalePath(nextLocale: Language) {
    const segments = pathname.split("/").filter(Boolean);
    const hasLocalePrefix = segments.length > 0 && localeSet.has(segments[0] as Language);

    const nextSegments = hasLocalePrefix
      ? [nextLocale, ...segments.slice(1)]
      : [nextLocale, ...segments];

    const nextPath = `/${nextSegments.join("/")}`;
    const query = searchParams?.toString();

    return query ? `${nextPath}?${query}` : nextPath;
  }

  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 transition-colors text-sm font-medium text-neutral-200"
      >
        <span className="text-lg leading-none">{currentLang.flag}</span>
        <span className="hidden sm:inline-block">{currentLang.label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-neutral-800 border border-neutral-700 rounded-xl shadow-xl z-50 py-1 max-h-[80vh] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200 origin-top-right">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  localStorage.setItem('app-language', lang.code);
                  setLanguage(lang.code);
                  router.push(buildLocalePath(lang.code));
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-neutral-700/50 transition-colors ${
                  language === lang.code ? 'bg-primary-purple/10 text-primary-purple font-medium' : 'text-neutral-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg leading-none">{lang.flag}</span>
                  <span>{lang.label}</span>
                </div>
                {language === lang.code && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
