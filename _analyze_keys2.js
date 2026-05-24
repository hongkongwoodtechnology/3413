const fs = require('fs');

// Load the i18n.ts file and evaluate it in a sandbox
// We'll parse it manually and simulate the merge

const content = fs.readFileSync('src/lib/i18n.ts', 'utf-8');

// Simpler approach: Find all key-value pairs in English sections
// First, find all English key definitions

function extractAllTranslations(fileContent) {
    // We need to find what each language gets after the merge:
    // TRANSLATIONS[lang] = { ...BASE_TRANSLATIONS[lang], ...REFERRAL_KEYS['en'], ...(REFERRAL_KEYS[lang] || {}) }
    
    // Extract REFERRAL_KEYS by finding between "const REFERRAL_KEYS = {" and the matching "};"
    const refStart = fileContent.indexOf("const REFERRAL_KEYS = {");
    
    // Extract BASE_TRANSLATIONS by finding between "const BASE_TRANSLATIONS:" and the matching "};"
    const baseStart = fileContent.indexOf("const BASE_TRANSLATIONS: Record<Language");
    
    // Parse language sections using a simple approach
    function extractLangSections(text, startOffset) {
        const sections = {};
        const langRegex = /\s\s(['"](?:en|zh-TW|zh-CN|es|ar|fr|ru|de|ja|ko|pt|th)['"])\s*:\s*\{/g;
        let match;
        while ((match = langRegex.exec(text)) !== null) {
            const langCode = match[1].replace(/['"]/g, '');
            const langStart = match.index + match[0].length;
            // Find matching closing brace
            let braceCount = 1;
            let i = langStart;
            let inString = false;
            let stringChar = '';
            while (i < text.length && braceCount > 0) {
                const ch = text[i];
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
            sections[langCode] = text.substring(langStart, i - 1);
        }
        return sections;
    }
    
    const refSections = extractLangSections(content.substring(refStart, refStart + 50000), refStart);
    const baseSections = extractLangSections(content.substring(baseStart, baseStart + 50000), baseStart);
    
    // Parse key-value pairs from a section
    function parseKeyValues(sectionText) {
        const result = {};
        const lines = sectionText.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const match = trimmed.match(/^['"](\w[\w.]*\w|\w)['"]\s*:\s*['"](.+)['"],?\s*$/);
            if (match) {
                result[match[1]] = match[2];
            } else {
                // Multi-value or special
                const m2 = trimmed.match(/^['"](\w[\w.]*\w|\w)['"]\s*:\s*'(.+)',?\s*$/);
                if (m2) result[m2[1]] = m2[2];
                const m3 = trimmed.match(/^['"](\w[\w.]*\w|\w)['"]\s*:\s*"(.+)",?\s*$/);
                if (m3) result[m3[1]] = m3[2];
            }
        }
        return result;
    }
    
    // Get en keys from both sources
    const refEn = parseKeyValues(refSections['en'] || '');
    const baseEn = parseKeyValues(baseSections['en'] || '');
    const allEn = { ...refEn, ...baseEn };
    const allEnKeys = Object.keys(allEn);
    
    // For each language, simulate the merge
    const targetLangs = ['zh-TW', 'zh-CN', 'es', 'ar', 'fr', 'ru', 'de', 'ja', 'ko', 'pt', 'th'];
    
    console.log(`Total English keys: ${allEnKeys.length}`);
    console.log(`  From REFERRAL_KEYS: ${Object.keys(refEn).length}`);
    console.log(`  From BASE_TRANSLATIONS: ${Object.keys(baseEn).length}`);
    console.log();
    
    for (const lang of targetLangs) {
        const refLang = parseKeyValues(refSections[lang] || '');
        const baseLang = parseKeyValues(baseSections[lang] || '');
        
        // Simulate merge
        const merged = { ...refEn, ...refLang, ...baseLang };
        
        // Also add BASE_TRANSLATIONS.en fallback for base keys
        if (!baseLang || Object.keys(baseLang).length === 0) {
            // If BASE_TRANSLATIONS[lang] doesn't exist, base keys come from en
            // But in the actual merge, BASE_TRANSLATIONS[lang] is used first
        }
        
        const langKeys = Object.keys(merged);
        const langKeySet = new Set(langKeys);
        const missing = allEnKeys.filter(k => !langKeySet.has(k));
        
        const pct = ((langKeys.length / allEnKeys.length) * 100).toFixed(1);
        console.log(`${lang}: ${langKeys.length}/${allEnKeys.length} keys (${pct}%) - missing ${missing.length}`);
        
        if (missing.length > 0 && missing.length <= 80) {
            // Group missing keys by prefix
            const groups = {};
            for (const k of missing) {
                const prefix = k.split('.')[0];
                if (!groups[prefix]) groups[prefix] = [];
                groups[prefix].push(k);
            }
            console.log(`  Missing groups:`);
            for (const [prefix, keys] of Object.entries(groups)) {
                console.log(`    ${prefix}: ${keys.length} keys - ${keys.join(', ')}`);
            }
        }
        
        // Also save the missing keys with their English values
        const missingWithValues = {};
        for (const k of missing) {
            missingWithValues[k] = allEn[k] || '';
        }
        fs.writeFileSync(`_missing_${lang}.json`, JSON.stringify(missingWithValues, null, 2));
    }
    
    // Check which BASE_TRANSLATIONS keys are present per language
    console.log(`\n=== BASE_TRANSLATIONS coverage ===`);
    const baseKeys = Object.keys(baseEn);
    for (const lang of targetLangs) {
        const baseLang = parseKeyValues(baseSections[lang] || '');
        const missingBase = baseKeys.filter(k => !(k in baseLang));
        if (missingBase.length > 0) {
            console.log(`  ${lang} missing ${missingBase.length} BASE keys: ${missingBase.join(', ')}`);
        } else {
            console.log(`  ${lang}: complete`);
        }
    }
}

extractAllTranslations(content);
