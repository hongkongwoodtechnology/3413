const fs = require('fs');
const content = fs.readFileSync('src/lib/i18n.ts', 'utf-8');

function extractAllSections(text, startMarker, langKeys) {
    const startIdx = text.indexOf(startMarker);
    if (startIdx === -1) return {};
    
    let braceDepth = 0;
    let blockEnd = -1;
    // Find the opening brace of the object
    const openBrace = text.indexOf('{', startIdx);
    for (let i = openBrace; i < text.length; i++) {
        if (text[i] === '{') braceDepth++;
        if (text[i] === '}') {
            braceDepth--;
            if (braceDepth === 0) { blockEnd = i; break; }
        }
    }
    
    const block = text.substring(openBrace + 1, blockEnd);
    const sections = {};
    
    // Find each language section - handle both quoted and unquoted keys
    // Pattern: spaces, then (langCode or 'langCode' or "langCode"), then :, then {
    for (const lang of langKeys) {
        const patterns = [
            new RegExp(`\\s{2}${lang}\\s*:\\s*\\{`),
            new RegExp(`\\s{2}'${lang}'\\s*:\\s*\\{`),
            new RegExp(`\\s{2}"${lang}"\\s*:\\s*\\{`),
        ];
        
        for (const pat of patterns) {
            const m = block.match(pat);
            if (m) {
                const langBodyStart = m.index + m[0].length;
                let bCount = 1;
                let j = langBodyStart;
                let inStr = false, strCh = '';
                while (j < block.length && bCount > 0) {
                    const ch = block[j];
                    if (inStr) {
                        if (ch === '\\') { j += 2; continue; }
                        if (ch === strCh) { inStr = false; }
                    } else {
                        if (ch === '"' || ch === "'") { inStr = true; strCh = ch; }
                        else if (ch === '{') bCount++;
                        else if (ch === '}') bCount--;
                    }
                    j++;
                }
                sections[lang] = block.substring(langBodyStart, j - 1);
                break;
            }
        }
    }
    
    return sections;
}

function parseKV(sectionText) {
    const result = {};
    if (!sectionText) return result;
    
    const lines = sectionText.split('\n');
    let currentKey = null;
    let accumValue = '';
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) continue;
        
        if (currentKey) {
            // Continuation of multiline value
            // Value ends with ' or ", optionally followed by ,
            const endMatch = trimmed.match(/^(.*?)(['"]),?\s*$/);
            if (endMatch) {
                accumValue += endMatch[1] + endMatch[2];
                result[currentKey] = accumValue.replace(/\\n/g, '\n');
                currentKey = null;
                accumValue = '';
            } else {
                accumValue += trimmed.replace(/,?\s*$/, '');
            }
            continue;
        }
        
        // Key: 'value', or Key: "value",
        const kvMatch = trimmed.match(/^(['"]?)([\w.]+)\1\s*:\s*(['"])(.*)$/);
        if (kvMatch) {
            const valEnd = kvMatch[4];
            if (valEnd.endsWith(kvMatch[3]) && (valEnd.match(new RegExp(kvMatch[3], 'g')) || []).length === 1) {
                // Value ends on same line
                result[kvMatch[2]] = valEnd.slice(0, -1);
            } else {
                // Multiline value
                currentKey = kvMatch[2];
                accumValue = valEnd;
            }
        }
    }
    
    if (currentKey) {
        result[currentKey] = accumValue;
    }
    
    return result;
}

const targetLangs = ['en', 'zh-TW', 'zh-CN', 'es', 'ar', 'fr', 'ru', 'de', 'ja', 'ko', 'pt', 'th', 'la'];

const refSections = extractAllSections(content, 'const REFERRAL_KEYS = {', targetLangs);
const baseSections = extractAllSections(content, 'const BASE_TRANSLATIONS: Record<Language, Record<string, string>> = {', targetLangs);

console.log('REFERRAL_KEYS has:', Object.keys(refSections).join(', '));
console.log('BASE_TRANSLATIONS has:', Object.keys(baseSections).join(', '));

const enRef = parseKV(refSections['en'] || '');
const enBase = parseKV(baseSections['en'] || '');

console.log(`\nREFERRAL_KEYS.en: ${Object.keys(enRef).length} keys`);
console.log(`BASE_TRANSLATIONS.en: ${Object.keys(enBase).length} keys`);

const allEn = { ...enRef, ...enBase };
const allEnKeys = Object.keys(allEn);
console.log(`Total unique en keys: ${allEnKeys.length}`);

if (allEnKeys.length === 0) {
    console.log('ERROR: Could not parse English keys!');
    console.log('enRef section length:', (refSections['en'] || '').length);
    console.log('enBase section length:', (baseSections['en'] || '').length);
    console.log('First 200 chars of enRef:', (refSections['en'] || '').substring(0, 200));
    console.log('First 200 chars of enBase:', (baseSections['en'] || '').substring(0, 200));
    process.exit(1);
}

const mainLangs = ['zh-TW', 'zh-CN', 'es', 'ar', 'fr', 'ru', 'de', 'ja', 'ko', 'pt', 'th'];

for (const lang of mainLangs) {
    const langRef = parseKV(refSections[lang] || '');
    const langBase = parseKV(baseSections[lang] || '');
    
    // Simulate current merge: merge(langBase, enRef as fallback, langRef)
    const merged = { ...langBase, ...enRef, ...langRef };
    const langKeySet = new Set(Object.keys(merged));
    const missing = allEnKeys.filter(k => !langKeySet.has(k));
    
    const pct = ((Object.keys(merged).length / allEnKeys.length) * 100).toFixed(1);
    console.log(`\n${lang}: ${Object.keys(merged).length}/${allEnKeys.length} (${pct}%), missing ${missing.length}`);
    
    if (missing.length > 0 && missing.length <= 80) {
        const groups = {};
        for (const k of missing) {
            const parts = k.split('.');
            const prefix = parts.slice(0, 2).join('.');
            if (!groups[prefix]) groups[prefix] = [];
            groups[prefix].push(k);
        }
        for (const [p, ks] of Object.entries(groups)) {
            console.log(`  ${p} (${ks.length}): ${ks.join(', ')}`);
        }
        
        const mv = {};
        for (const k of missing) mv[k] = allEn[k];
        fs.writeFileSync(`_missing_${lang}.json`, JSON.stringify(mv, null, 2));
    }
}

// Save all en keys for reference
fs.writeFileSync('_all_en_keys.json', JSON.stringify(allEn, null, 2));
console.log(`\nSaved _all_en_keys.json`);
