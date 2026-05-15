import fs from 'fs';
import path from 'path';

// Parse the i18n.ts file to see what's actually there
const content = fs.readFileSync('./src/lib/i18n.ts', 'utf-8');

const langs = ['en', 'zh-TW', 'zh-CN', 'es', 'ar', 'fr', 'ru', 'de', 'ja', 'ko', 'pt', 'la', 'th'];

console.log("Checking BASE_TRANSLATIONS keys...");
for (const lang of langs) {
    const startIdx = content.indexOf(`  '${lang}': {`);
    const startIdx2 = content.indexOf(`  ${lang}: {`);
    let idx = startIdx !== -1 ? startIdx : startIdx2;
    if (idx === -1) {
        console.log(`Lang ${lang}: NOT FOUND`);
        continue;
    }
    const nextLangs = langs.filter(l => l !== lang);
    let nextIdx = content.length;
    for (const nl of nextLangs) {
        const i1 = content.indexOf(`  '${nl}': {`, idx + 10);
        const i2 = content.indexOf(`  ${nl}: {`, idx + 10);
        if (i1 !== -1 && i1 < nextIdx) nextIdx = i1;
        if (i2 !== -1 && i2 < nextIdx) nextIdx = i2;
    }
    const block = content.substring(idx, nextIdx);
    const hasLive = block.includes('filter.time.live');
    console.log(`Lang ${lang}: has filter.time.live? ${hasLive}`);
}



