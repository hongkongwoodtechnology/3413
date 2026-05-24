const fs = require('fs');
const content = fs.readFileSync('src/lib/i18n.ts', 'utf-8');

// Find en keys in REFERRAL_KEYS
const refStart = content.indexOf("const REFERRAL_KEYS = {");
// Find the closing of REFERRAL_KEYS by looking for next top-level declaration
const afterRef = content.substring(refStart);
let refBraceCount = 0;
let refEnd = -1;
for (let i = afterRef.indexOf('{'); i < afterRef.length; i++) {
    if (afterRef[i] === '{') refBraceCount++;
    if (afterRef[i] === '}') {
        refBraceCount--;
        if (refBraceCount === 0) {
            refEnd = refStart + i;
            break;
        }
    }
}

// Extract en keys from REFERRAL_KEYS
const refBlock = content.substring(refStart, refEnd + 1);
const enRefStart = refBlock.indexOf("  en: {");
const afterEnRef = refBlock.substring(enRefStart);
let enRefBrace = 0;
let enRefEnd = -1;
for (let i = afterEnRef.indexOf('{'); i < afterEnRef.length; i++) {
    if (afterEnRef[i] === '{') enRefBrace++;
    if (afterEnRef[i] === '}') {
        enRefBrace--;
        if (enRefBrace === 0) {
            enRefEnd = enRefStart + i;
            break;
        }
    }
}
const enRefBlock = refBlock.substring(enRefStart, enRefEnd + 1);
const enRefKeys = [...enRefBlock.matchAll(/['"](\w[\w.]*\w|\w)['"]\s*:/g)].map(m => m[1]);
console.log(`REFERRAL_KEYS.en has ${enRefKeys.length} keys`);

// Find en keys in BASE_TRANSLATIONS
const baseStart = content.indexOf("const BASE_TRANSLATIONS: Record<Language, Record<string, string>> = {");
const afterBase = content.substring(baseStart);
let baseBraceCount = 0;
let baseEnd = -1;
for (let i = afterBase.indexOf('{'); i < afterBase.length; i++) {
    if (afterBase[i] === '{') baseBraceCount++;
    if (afterBase[i] === '}') {
        baseBraceCount--;
        if (baseBraceCount === 0) {
            baseEnd = baseStart + i;
            break;
        }
    }
}
const baseBlock = content.substring(baseStart, baseEnd + 1);
const enBaseStart = baseBlock.indexOf("  en: {");
const afterEnBase = baseBlock.substring(enBaseStart);
let enBaseBrace = 0;
let enBaseEnd = -1;
for (let i = afterEnBase.indexOf('{'); i < afterEnBase.length; i++) {
    if (afterEnBase[i] === '{') enBaseBrace++;
    if (afterEnBase[i] === '}') {
        enBaseBrace--;
        if (enBaseBrace === 0) {
            enBaseEnd = enBaseStart + i;
            break;
        }
    }
}
const enBaseBlock = baseBlock.substring(enBaseStart, enBaseEnd + 1);
const enBaseKeys = [...enBaseBlock.matchAll(/['"](\w[\w.]*\w|\w)['"]\s*:/g)].map(m => m[1]);
console.log(`BASE_TRANSLATIONS.en has ${enBaseKeys.length} keys`);

// All English keys
const allEnKeys = [...new Set([...enRefKeys, ...enBaseKeys])];
console.log(`Total unique en keys: ${allEnKeys.length}`);

// For each language in REFERRAL_KEYS, count keys
const langPattern = /  ['"](en|zh-TW|zh-CN|es|ar|fr|ru|de|ja|ko|pt|th)['"]:\s*\{/g;
const refLangMatches = [...refBlock.matchAll(langPattern)];
console.log(`\n=== REFERRAL_KEYS language sections ===`);
for (const m of refLangMatches) {
    console.log(`  ${m[1]}`);
}

const baseLangMatches = [...baseBlock.matchAll(langPattern)];
console.log(`\n=== BASE_TRANSLATIONS language sections ===`);
for (const m of baseLangMatches) {
    console.log(`  ${m[1]}`);
}

// For each language, extract all keys from REFERRAL_KEYS
console.log(`\n=== Missing keys analysis ===`);
const targetLangs = ['en', 'zh-TW', 'zh-CN', 'es', 'ar', 'fr', 'ru', 'de', 'ja', 'ko', 'pt', 'th'];

for (const lang of targetLangs) {
    // Find in REFERRAL_KEYS
    const refKeys = [];
    const refLangRegex = new RegExp(`  '${lang}':\\s*\\{`);
    const refLangMatch = refBlock.match(refLangRegex);
    if (refLangMatch) {
        const refLangStart = refLangMatch.index;
        const afterLang = refBlock.substring(refLangStart);
        let bCount = 0;
        let langEnd = -1;
        for (let i = afterLang.indexOf('{'); i < afterLang.length; i++) {
            if (afterLang[i] === '{') bCount++;
            if (afterLang[i] === '}') {
                bCount--;
                if (bCount === 0) {
                    langEnd = refLangStart + i;
                    break;
                }
            }
        }
        if (langEnd > 0) {
            const langBlock = refBlock.substring(refLangStart, langEnd + 1);
            const keys = [...langBlock.matchAll(/['"](\w[\w.]*\w|\w)['"]\s*:/g)].map(m => m[1]);
            refKeys.push(...keys);
        }
    }
    
    // Find in BASE_TRANSLATIONS
    const baseLangRegex = new RegExp(`  '${lang}':\\s*\\{`);
    const baseLangMatch = baseBlock.match(baseLangRegex);
    if (baseLangMatch) {
        const baseLangStart = baseLangMatch.index;
        const afterLang = baseBlock.substring(baseLangStart);
        let bCount = 0;
        let langEnd = -1;
        for (let i = afterLang.indexOf('{'); i < afterLang.length; i++) {
            if (afterLang[i] === '{') bCount++;
            if (afterLang[i] === '}') {
                bCount--;
                if (bCount === 0) {
                    langEnd = baseLangStart + i;
                    break;
                }
            }
        }
        if (langEnd > 0) {
            const langBlock = baseBlock.substring(baseLangStart, langEnd + 1);
            const keys = [...langBlock.matchAll(/['"](\w[\w.]*\w|\w)['"]\s*:/g)].map(m => m[1]);
            refKeys.push(...keys);
        }
    }
    
    const langKeySet = new Set(refKeys);
    const allEnSet = new Set(allEnKeys);
    const missing = [...allEnSet].filter(k => !langKeySet.has(k));
    
    if (lang === 'en') {
        console.log(`  ${lang}: ${langKeySet.size} keys (reference)`);
    } else {
        const pct = ((langKeySet.size / allEnKeys.length) * 100).toFixed(1);
        console.log(`  ${lang}: ${langKeySet.size}/${allEnKeys.length} keys (${pct}%) - missing ${missing.length}`);
        if (missing.length > 0 && missing.length <= 50) {
            console.log(`    Missing: ${missing.join(', ')}`);
        }
    }
}

// Save all en keys to a file for reference
fs.writeFileSync('_all_en_keys.json', JSON.stringify(allEnKeys, null, 2));
console.log(`\nSaved all ${allEnKeys.length} en keys to _all_en_keys.json`);
