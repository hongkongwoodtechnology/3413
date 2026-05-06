const fs = require('fs');

// Read the existing file
let content = fs.readFileSync('src/lib/i18n.ts', 'utf8');

// Extract English REFERRAL_KEYS and BASE_TRANSLATIONS
const refMatch = content.match(/en: \{([\s\S]*?)\n  \},/);
const baseMatch = content.match(/en: \{([\s\S]*?)\n  \},/g);

// We need a robust way to add languages.
// Actually, it's easier to just rewrite the file from scratch because we need to add all these translations.
