const fs = require('fs');

const content = fs.readFileSync('src/lib/i18n.ts', 'utf-8');

const refStart = content.indexOf("const REFERRAL_KEYS = {");
const baseStart = content.indexOf("const BASE_TRANSLATIONS: Record<Language");

function extractLangSections(text, startFrom) {
    const sections = {};
    const sub = text.substring(startFrom);
    const langRegex = /\s\s(['"]en['"]|['"]zh-TW['"]|['"]zh-CN['"]|['"]es['"]|['"]ar['"]|['"]fr['"]|['"]ru['"]|['"]de['"]|['"]ja['"]|['"]ko['"]|['"]pt['"]|['"]th['"]|['"]la['"])\s*:\s*\{/g;
    let match;
    while ((match = langRegex.exec(sub)) !== null) {
        const langCode = match[1].replace(/['"]/g, '');
        const langStart = match.index + match[0].length;
        let braceCount = 1;
        let i = langStart;
        let inString = false;
        let stringChar = '';
        while (i < sub.length && braceCount > 0) {
            const ch = sub[i];
            if (inString) {
                if (ch === '\\') { i += 2; continue; }
                if (ch === stringChar) { inString = false; }
            } else {
                if (ch === '"' || ch === "'") { inString = true; stringChar = ch; }
                else if (ch === '{') braceCount++;
                else if (ch === '}') braceCount--;
            }
            i++;
        }
        sections[langCode] = sub.substring(langStart, i - 1);
    }
    return sections;
}

function parseKeyValues(sectionText) {
    const result = {};
    // Match: spaces 'key': 'value', or "key": "value",
    // Handle multiline strings with \n
    const lines = sectionText.split('\n');
    let currentKey = null;
    let currentValue = '';
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) continue;
        
        // Check for a new key-value pair
        const kvMatch = trimmed.match(/^(['"])([\w.]+)\1\s*:\s*(['"])(.*?)\3,?\s*$/);
        if (kvMatch) {
            if (currentKey) {
                result[currentKey] = currentValue;
                currentValue = '';
            }
            result[kvMatch[2]] = kvMatch[4];
            currentKey = null;
            continue;
        }
        
        // Check for key: 'value', without closing ' on same line
        const kvStart = trimmed.match(/^(['"])([\w.]+)\1\s*:\s*(['"])(.*)$/);
        if (kvStart && !kvStart[4].endsWith(kvStart[3])) {
            if (currentKey) {
                result[currentKey] = currentValue;
            }
            currentKey = kvStart[2];
            currentValue = kvStart[4];
            continue;
        }
        
        // Continuation line
        if (currentKey) {
            const contMatch = trimmed.match(/^(.*?)(['"]),?\s*$/);
            if (contMatch) {
                currentValue += contMatch[1] + contMatch[2];
                result[currentKey] = currentValue.replace(/\\n/g, '\n');
                currentKey = null;
                currentValue = '';
            } else {
                currentValue += trimmed.replace(/,?\s*$/, '');
            }
        }
    }
    
    if (currentKey) {
        result[currentKey] = currentValue;
    }
    
    return result;
}

const refSections = extractLangSections(content, refStart);
const baseSections = extractLangSections(content, baseStart);

console.log('REFERRAL_KEYS sections:', Object.keys(refSections));
console.log('BASE_TRANSLATIONS sections:', Object.keys(baseSections));

const refEn = parseKeyValues(refSections['en'] || '');
const baseEn = parseKeyValues(baseSections['en'] || '');

console.log(`\nREFERRAL_KEYS.en keys: ${Object.keys(refEn).length}`);
console.log(`BASE_TRANSLATIONS.en keys: ${Object.keys(baseEn).length}`);

const allEn = { ...refEn, ...baseEn };
const allEnKeys = Object.keys(allEn);
console.log(`Total unique en keys: ${allEnKeys.length}`);

// For each language, simulate the merge and find missing
const targetLangs = ['zh-TW', 'zh-CN', 'es', 'ar', 'fr', 'ru', 'de', 'ja', 'ko', 'pt', 'th'];

// First get all BASE keys
const baseKeyNames = Object.keys(baseEn);

for (const lang of targetLangs) {
    const refLang = parseKeyValues(refSections[lang] || '');
    const baseLang = parseKeyValues(baseSections[lang] || '');
    
    // Simulate merge: BASE_TRANSLATIONS[lang] (or empty if missing) + REFERRAL_KEYS['en'] fallback + REFERRAL_KEYS[lang]
    // Actually the current merge logic:
    // TRANSLATIONS[lang] = { ...BASE_TRANSLATIONS[lang], ...REFERRAL_KEYS['en'], ...(REFERRAL_KEYS[lang] || {}) }
    // And BASE_TRANSLATIONS iterates over its own keys
    
    // Simpler: just count what the system actually produces
    const merged = { ...baseLang, ...refEn, ...refLang };
    const langKeys = Object.keys(merged);
    const missing = allEnKeys.filter(k => !(k in merged));
    
    const pct = allEnKeys.length > 0 ? ((langKeys.length / allEnKeys.length) * 100).toFixed(1) : '0';
    console.log(`\n${lang}: ${langKeys.length}/${allEnKeys.length} keys (${pct}%) - missing ${missing.length}`);

    // Show first few missing
    if (missing.length > 0 && missing.length <= 80) {
        // Show by group
        const groups = {};
        for (const k of missing) {
            const parts = k.split('.');
            const prefix = parts.length >= 2 ? parts.slice(0, 2).join('.') : parts[0];
            if (!groups[prefix]) groups[prefix] = [];
            groups[prefix].push(k);
        }
        for (const [prefix, keys] of Object.entries(groups)) {
            console.log(`  ${prefix}: ${keys.length} keys`);
        }
        
        // Save missing with values
        const missingWithValues = {};
        for (const k of missing) {
            missingWithValues[k] = allEn[k] || '';
        }
        fs.writeFileSync(`_missing_${lang}.json`, JSON.stringify(missingWithValues, null, 2));
    }
}

// Check BASE_TRANSLATIONS coverage
console.log(`\n=== BASE_TRANSLATIONS coverage (${baseKeyNames.length} keys) ===`);
for (const lang of targetLangs) {
    const baseLang = parseKeyValues(baseSections[lang] || '');
    const missingBase = baseKeyNames.filter(k => !(k in baseLang));
    const extraBase = Object.keys(baseLang).filter(k => !baseKeyNames.includes(k));
    if (missingBase.length > 0) {
        console.log(`  ${lang}: missing ${missingBase.length} keys - ${missingBase.join(', ')}`);
    } else {
        console.log(`  ${lang}: complete${extraBase.length > 0 ? ' (has ' + extraBase.length + ' extra: ' + extraBase.join(', ') + ')' : ''}`);
    }
}

// Check REFERRAL_KEYS coverage
const refKeyNames = Object.keys(refEn);
console.log(`\n=== REFERRAL_KEYS coverage (${refKeyNames.length} keys) ===`);
for (const lang of targetLangs) {
    const refLang = parseKeyValues(refSections[lang] || '');
    const missingRef = refKeyNames.filter(k => !(k in refLang));
    const extraRef = Object.keys(refLang).filter(k => !refKeyNames.includes(k));
    console.log(`  ${lang}: ${Object.keys(refLang).length}/${refKeyNames.length} keys, missing ${missingRef.length}${extraRef.length > 0 ? ', extra ' + extraRef.length : ''}`);
}
