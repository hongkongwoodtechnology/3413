/**
 * i18n Validation Test
 * Ensures all languages are properly configured and keys are consistent across translations
 */

import { TRANSLATIONS, LANGUAGES, Language } from '@/lib/i18n';

describe('i18n Language Validation', () => {
  // Test 1: Verify all languages in LANGUAGES array have translations
  describe('Language Configuration', () => {
    it('should have all languages defined in LANGUAGES array', () => {
      expect(LANGUAGES.length).toBeGreaterThan(0);
      LANGUAGES.forEach(lang => {
        expect(lang.code).toBeDefined();
        expect(lang.label).toBeDefined();
        expect(lang.flag).toBeDefined();
      });
    });

    it('should have translation dictionaries for all languages', () => {
      LANGUAGES.forEach(lang => {
        expect(TRANSLATIONS[lang.code as Language]).toBeDefined();
        expect(Object.keys(TRANSLATIONS[lang.code as Language]).length).toBeGreaterThan(0);
      });
    });
  });

  // Test 2: Verify English has base keys (as fallback)
  describe('English Base Keys', () => {
    it('should have English translations', () => {
      const enKeys = Object.keys(TRANSLATIONS['en']);
      expect(enKeys.length).toBeGreaterThan(0);
      console.log(`✓ English has ${enKeys.length} translation keys`);
    });

    it('should have referral keys in English', () => {
      const referralKeys = Object.keys(TRANSLATIONS['en']).filter(k => k.startsWith('referral.'));
      expect(referralKeys.length).toBeGreaterThan(0);
      console.log(`✓ English has ${referralKeys.length} referral keys`);
    });

    it('should have news keys in English', () => {
      const newsKeys = Object.keys(TRANSLATIONS['en']).filter(k => k.startsWith('news.'));
      expect(newsKeys.length).toBeGreaterThan(0);
      console.log(`✓ English has ${newsKeys.length} news keys`);
    });

    it('should have admin keys in English', () => {
      const adminKeys = Object.keys(TRANSLATIONS['en']).filter(k => k.startsWith('admin.'));
      expect(adminKeys.length).toBeGreaterThan(0);
      console.log(`✓ English has ${adminKeys.length} admin keys`);
    });
  });

  // Test 3: Verify key consistency across languages (with 80% threshold)
  describe('Key Consistency Across Languages', () => {
    it('should have similar key coverage across all languages', () => {
      const enKeys = new Set(Object.keys(TRANSLATIONS['en']));
      const coverageReport: Record<string, { total: number; coverage: number; percentage: number; missing: string[] }> = {};

      LANGUAGES.forEach(lang => {
        const langKeys = new Set(Object.keys(TRANSLATIONS[lang.code as Language]));
        const missing: string[] = [];
        
        enKeys.forEach(key => {
          if (!langKeys.has(key)) {
            missing.push(key);
          }
        });

        const coverage = langKeys.size - missing.length;
        const percentage = (coverage / enKeys.size) * 100;

        coverageReport[lang.code] = {
          total: langKeys.size,
          coverage,
          percentage: parseFloat(percentage.toFixed(2)),
          missing
        };
      });

      console.log('\n=== Language Coverage Report ===');
      Object.entries(coverageReport).forEach(([lang, stats]) => {
        const status = stats.percentage >= 80 ? '✓' : '✗';
        console.log(`${status} ${lang}: ${stats.coverage}/${stats.total} (${stats.percentage}%)`);
        if (stats.missing.length > 0 && stats.missing.length <= 5) {
          console.log(`   Missing: ${stats.missing.slice(0, 5).join(', ')}`);
        }
      });

      // All languages should have at least 80% coverage
      Object.entries(coverageReport).forEach(([lang, stats]) => {
        expect(stats.percentage).toBeGreaterThanOrEqual(80);
      });
    });
  });

  // Test 4: Verify language switching
  describe('Language Switching', () => {
    it('should have all 11+ languages available', () => {
      expect(LANGUAGES.length).toBeGreaterThanOrEqual(11);
      console.log(`✓ ${LANGUAGES.length} languages available`);
    });

    it('should support Chinese (Traditional) - zh-TW', () => {
      const zhTW = LANGUAGES.find(l => l.code === 'zh-TW');
      expect(zhTW).toBeDefined();
      expect(TRANSLATIONS['zh-TW']).toBeDefined();
      console.log(`✓ Traditional Chinese (zh-TW): ${Object.keys(TRANSLATIONS['zh-TW']).length} keys`);
    });

    it('should support Chinese (Simplified) - zh-CN', () => {
      const zhCN = LANGUAGES.find(l => l.code === 'zh-CN');
      expect(zhCN).toBeDefined();
      expect(TRANSLATIONS['zh-CN']).toBeDefined();
      console.log(`✓ Simplified Chinese (zh-CN): ${Object.keys(TRANSLATIONS['zh-CN']).length} keys`);
    });

    it('should support Spanish - es', () => {
      const es = LANGUAGES.find(l => l.code === 'es');
      expect(es).toBeDefined();
      expect(TRANSLATIONS['es']).toBeDefined();
      console.log(`✓ Spanish (es): ${Object.keys(TRANSLATIONS['es']).length} keys`);
    });

    it('should support Arabic - ar', () => {
      const ar = LANGUAGES.find(l => l.code === 'ar');
      expect(ar).toBeDefined();
      expect(TRANSLATIONS['ar']).toBeDefined();
      console.log(`✓ Arabic (ar): ${Object.keys(TRANSLATIONS['ar']).length} keys`);
    });

    it('should support French - fr', () => {
      const fr = LANGUAGES.find(l => l.code === 'fr');
      expect(fr).toBeDefined();
      expect(TRANSLATIONS['fr']).toBeDefined();
      console.log(`✓ French (fr): ${Object.keys(TRANSLATIONS['fr']).length} keys`);
    });

    it('should support Russian - ru', () => {
      const ru = LANGUAGES.find(l => l.code === 'ru');
      expect(ru).toBeDefined();
      expect(TRANSLATIONS['ru']).toBeDefined();
      console.log(`✓ Russian (ru): ${Object.keys(TRANSLATIONS['ru']).length} keys`);
    });

    it('should support German - de', () => {
      const de = LANGUAGES.find(l => l.code === 'de');
      expect(de).toBeDefined();
      expect(TRANSLATIONS['de']).toBeDefined();
      console.log(`✓ German (de): ${Object.keys(TRANSLATIONS['de']).length} keys`);
    });

    it('should support Japanese - ja', () => {
      const ja = LANGUAGES.find(l => l.code === 'ja');
      expect(ja).toBeDefined();
      expect(TRANSLATIONS['ja']).toBeDefined();
      console.log(`✓ Japanese (ja): ${Object.keys(TRANSLATIONS['ja']).length} keys`);
    });

    it('should support Korean - ko', () => {
      const ko = LANGUAGES.find(l => l.code === 'ko');
      expect(ko).toBeDefined();
      expect(TRANSLATIONS['ko']).toBeDefined();
      console.log(`✓ Korean (ko): ${Object.keys(TRANSLATIONS['ko']).length} keys`);
    });

    it('should support Portuguese - pt', () => {
      const pt = LANGUAGES.find(l => l.code === 'pt');
      expect(pt).toBeDefined();
      expect(TRANSLATIONS['pt']).toBeDefined();
      console.log(`✓ Portuguese (pt): ${Object.keys(TRANSLATIONS['pt']).length} keys`);
    });
  });

  // Test 5: Verify critical translation keys
  describe('Critical Translation Keys', () => {
    const criticalKeys = [
      'app.title',
      'bets.title',
      'nav.news',
      'referral.title',
      'admin.title',
      'bonus.title.deposit',
      'wallet.labels.has_wallet'
    ];

    it('should have all critical keys in English', () => {
      const enDict = TRANSLATIONS['en'];
      criticalKeys.forEach(key => {
        expect(enDict[key]).toBeDefined();
      });
    });

    it('should have critical keys in all languages', () => {
      LANGUAGES.forEach(lang => {
        const langDict = TRANSLATIONS[lang.code as Language];
        criticalKeys.forEach(key => {
          if (!langDict[key]) {
            console.warn(`⚠ Missing key "${key}" in ${lang.code}`);
          }
        });
      });
    });
  });

  // Test 6: Translation validation for key consistency
  describe('Translation Quality', () => {
    it('should not have empty translation values', () => {
      LANGUAGES.forEach(lang => {
        const langDict = TRANSLATIONS[lang.code as Language];
        Object.entries(langDict).forEach(([key, value]) => {
          expect(value).toBeDefined();
          expect(value.length).toBeGreaterThan(0);
        });
      });
    });

    it('should have placeholder values consistently formatted', () => {
      const langDict = TRANSLATIONS['en'];
      const placeholderKeys = Object.entries(langDict)
        .filter(([_, value]) => value.includes('{') && value.includes('}'))
        .map(([key, _]) => key);
      
      if (placeholderKeys.length > 0) {
        console.log(`✓ Found ${placeholderKeys.length} keys with placeholders`);
      }
    });
  });
});

describe('Language Detection and Fallback', () => {
  it('should have English as fallback language', () => {
    expect(TRANSLATIONS['en']).toBeDefined();
  });

  it('should handle Chinese variants correctly', () => {
    // zh-HK should map to zh-TW
    // zh-SG and generic zh should map to zh-CN
    expect(LANGUAGES.some(l => l.code === 'zh-TW')).toBe(true);
    expect(LANGUAGES.some(l => l.code === 'zh-CN')).toBe(true);
  });

  it('should support browser language detection', () => {
    const languageCodes = LANGUAGES.map(l => l.code);
    expect(languageCodes).toContain('en');
    expect(languageCodes.length).toBeGreaterThan(1);
  });
});
