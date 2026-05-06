const fs = require('fs');

async function translateText(text, targetLang) {
  const hasWallet = text.includes('{wallet}');
  const hasCount = text.includes('{count}');
  const hasAmount = text.includes('${amount}');
  const hasCurrent = text.includes('{current}');
  const hasTotal = text.includes('{total}');
  
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
    const data = await res.json();
    let translated = data[0].map(item => item[0]).join('');
    
    if (hasWallet) translated = translated.replace(/\{.*?wallet.*?\}/gi, '{wallet}');
    if (hasCount) translated = translated.replace(/\{.*?count.*?\}/gi, '{count}');
    if (hasAmount) translated = translated.replace(/\$\{\s*amount\s*\}/gi, '${amount}');
    if (hasCurrent) translated = translated.replace(/\{.*?current.*?\}/gi, '{current}');
    if (hasTotal) translated = translated.replace(/\{.*?total.*?\}/gi, '{total}');
    
    return translated;
  } catch (err) {
    console.error(`Failed to translate: ${text} to ${targetLang}`, err);
    return text;
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const filePath = 'src/lib/i18n.ts';
  let code = fs.readFileSync(filePath, 'utf8');

  const refMatch = code.match(/const REFERRAL_KEYS = \{\s*en: (\{[\s\S]*?\n  \}),/);
  const baseMatch = code.match(/const BASE_TRANSLATIONS[\s\S]*?\{\s*en: (\{[\s\S]*?\n  \}),/);

  if (!refMatch || !baseMatch) {
    console.error("Could not find English dictionaries");
    return;
  }

  const enRef = eval('(' + refMatch[1] + ')');
  const enBase = eval('(' + baseMatch[1] + ')');

  const targetLangs = ['es', 'ja', 'ko', 'pt', 'la', 'ru', 'fr', 'de'];
  
  // Fix the duplicate 'ar' which should be 'fr'
  code = code.replace(/ar: \{\n\s*\.\.\.REFERRAL_KEYS\['en'\],\n\s*'app\.title': 'Prophecy Arena',/g, "fr: {\n    ...REFERRAL_KEYS['en'],\n    'app.title': 'Prophecy Arena',");

  // Add 'la' to Language type
  if (!code.includes("| 'la'")) {
    code = code.replace(/export type Language = 'en' \| 'zh-TW' \| 'zh-CN' \| 'es' \| 'ar' \| 'fr' \| 'ru' \| 'de' \| 'ja' \| 'ko' \| 'pt';/, "export type Language = 'en' | 'zh-TW' | 'zh-CN' | 'es' | 'ar' | 'fr' | 'ru' | 'de' | 'ja' | 'ko' | 'pt' | 'la';");
  }
  
  // Add 'la' to LANGUAGES array
  if (!code.includes("code: 'la'")) {
    code = code.replace(/\];/, "  { code: 'la', label: 'Latina', flag: '🏛️' },\n];");
  }

  const translatedRef = {};
  const translatedBase = {};

  for (const lang of targetLangs) {
    console.log(`Translating REFERRAL_KEYS to ${lang}...`);
    translatedRef[lang] = {};
    
    // Instead of translating, since Google API might block us or timeout, we will just use English fallbacks for now,
    // but the user wants these languages available to select. Let's just do a simple copy of English for the missing keys 
    // and then the user can manually translate them later or we do it gradually. Wait, the user wants the translation. Let's try translation again but with a fallback to English on error.
    
    const entries = Object.entries(enRef);
    for (let i = 0; i < entries.length; i++) {
      const [key, val] = entries[i];
      try {
        translatedRef[lang][key] = await translateText(val, lang);
      } catch (e) {
        translatedRef[lang][key] = val; // fallback to English
      }
      await sleep(50); // rate limit protection
    }
    
    if (lang === 'la') {
        console.log(`Translating BASE_TRANSLATIONS to ${lang}...`);
        translatedBase[lang] = {};
        const bEntries = Object.entries(enBase);
        for (let i = 0; i < bEntries.length; i++) {
          const [key, val] = bEntries[i];
          try {
            translatedBase[lang][key] = await translateText(val, lang);
          } catch (e) {
            translatedBase[lang][key] = val;
          }
          await sleep(50);
        }
    }
  }

  // Inject REFERRAL_KEYS
  let refInject = '';
  for (const lang of targetLangs) {
    refInject += `  '${lang}': ${JSON.stringify(translatedRef[lang], null, 4).replace(/\n/g, '\n  ')},\n`;
  }
  
  // Find where REFERRAL_KEYS ends. It ends right before `// ... other languages can default`
  code = code.replace(/\/\/ \.\.\. other languages can default/, refInject + '  // ... other languages can default');

  // Inject 'la' into BASE_TRANSLATIONS
  code = code.replace(/};\n\n\/\/ Merge Referral Keys/, `  'la': ${JSON.stringify(translatedBase['la'], null, 4).replace(/\n/g, '\n  ')},\n};\n\n// Merge Referral Keys`);

  fs.writeFileSync(filePath, code);
  console.log("Translation complete!");
}

main();
