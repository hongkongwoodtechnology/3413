const fs = require('fs');
const path = require('path');

// Import the i18n file to get translations
const i18nPath = path.join(__dirname, 'src/lib/i18n.ts');
const content = fs.readFileSync(i18nPath, 'utf8');

// Alternative approach: Extract key patterns
const keyPattern = /'([a-z][a-z0-9._]*)':\s*'/g;

// Find all English keys
const enStart = content.indexOf("en: {");
const enEnd = content.indexOf("'zh-TW':");
const enContent = content.substring(enStart, enEnd);
const enMatches = [...enContent.matchAll(keyPattern)];
const enKeys = new Set(enMatches.map(m => m[1]));

// Find all Thai keys
const thStart = content.indexOf("th: {");
const thEnd = content.lastIndexOf("}");
const thContent = content.substring(thStart, thEnd);
const thMatches = [...thContent.matchAll(keyPattern)];
const thKeys = new Set(thMatches.map(m => m[1]));

console.log(`English keys found: ${enKeys.size}`);
console.log(`Thai keys found: ${thKeys.size}`);

const missing = Array.from(enKeys).filter(k => !thKeys.has(k)).sort();
console.log(`\nMissing keys in Thai (${missing.length}):`);
missing.forEach(k => console.log(`  '${k}'`));

fs.writeFileSync('missing-thai-keys.txt', missing.join('\n'));
console.log('\nMissing keys saved to missing-thai-keys.txt');
