
import { NextRequest, NextResponse } from 'next/server';
import { loadMarketDb, saveMarketDb } from '@/lib/marketDb';
import { PLATFORM_FEE_RATE } from '@/lib/wallets';
import { translateToZh, translateTeamName, isSupportedTranslationLang, traditionalToSimplified } from '@/lib/translate';
import { applyWorldCupSeedFallback } from '@/lib/worldcup-seed';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LangCode = 'en' | 'zh-TW' | 'zh-CN' | string;

function normalizeLang(raw: string): LangCode {
  const trimmed = raw.trim();
  const base = trimmed.split(',')[0]?.trim() || trimmed;
  const code = base.split(';')[0]?.trim() || base;
  const lower = code.toLowerCase();

  if (lower === 'zh' || lower.startsWith('zh-cn') || lower.startsWith('zh-hans') || lower === 'zh-sg') return 'zh-CN';
  if (lower.startsWith('zh-tw') || lower.startsWith('zh-hant') || lower === 'zh-hk' || lower === 'zh-mo') return 'zh-TW';

  return code;
}

function containsLatin(text: string) {
  return /[A-Za-z]/.test(text);
}

function normalizeToken(text: string) {
  return (text || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function looselyMatches(a: string, b: string) {
  const na = normalizeToken(a);
  const nb = normalizeToken(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function sanitizeZh(text: string, lang: string) {
  if (!text) return text;
  if (lang !== 'zh-TW' && lang !== 'zh-CN') return text;

  // 如果遇到單個字母或奇怪的亂碼（如 "é"），直接回傳或清除
  if (text === 'é' || text === 'e') return '';

  // 台灣/大陸繁簡體常用習慣
  const club = '俱樂部';
  const footballClub = lang === 'zh-CN' ? '足球俱乐部' : '足球俱樂部';
  const sportsClub = lang === 'zh-CN' ? '体育俱乐部' : '體育俱樂部';

  let out = text;
  
  // 我們不要把 "FC", "SC", "CF" 這種常見後綴獨立翻成 "足球俱樂部"，
  // 因為這會導致原本查不到字典的球隊，直接變成 "足球俱樂部" 或是 "俱樂部" 這種荒謬的名字。
  // 我們只針對特定的常見字尾做替換，或者乾脆直接移除這些多餘後綴。
  out = out.replace(/\bFC\b/gi, '');
  out = out.replace(/\bSC\b/gi, '');
  out = out.replace(/\bCF\b/gi, '');
  out = out.replace(/\bAC\b/gi, '');
  out = out.replace(/\bFK\b/gi, '');
  out = out.replace(/\bCD\b/gi, '');
  out = out.replace(/\bUD\b/gi, '');
  out = out.replace(/\bBK\b/gi, '');
  out = out.replace(/\bPSG\b/gi, '巴黎聖日耳曼');
  out = out.replace(/\bLA\b/gi, '洛杉磯');
  
  // 修復奇怪的翻譯錯誤 (例如 Google Translate 將 Premier League 翻成石油工業協會之類的)
  out = out.replace(/石油工業協會/g, '超級聯賽');
  out = out.replace(/石油工业协会/g, '超级联赛');
  
  // 處理 "我開始" 這種奇怪的機翻錯誤 (通常是 Start 被誤翻)
  out = out.replace(/我開始/g, '斯達');
  out = out.replace(/我开始/g, '斯达');

  // 修復某些球隊名稱因為縮寫點號導致被機翻為單獨句號 '.' 或奇怪符號的問題
  if (out === '.') return '';

  // 保留數字，移除其他英文字母，避免 "é" 這種單一字元破壞排版
  out = out.replace(/[A-Za-zÀ-ÿ]+/g, '');
  // 清理多餘的符號如 "-" 或 "/" 或句號 "."
  out = out.replace(/^[\s\-\/\.]+|[\s\-\/\.]+$/g, '');
  out = out.replace(/\s{2,}/g, ' ').trim();
  return out;
}

function localizeLeagueNameFallback(name: string, lang: string) {
  if (!name) return name;

  if (lang === 'ar') {
    let out = name.trim();
    out = out.replace(/\bPremier\s*League\s*2\b/gi, 'الدوري الممتاز 2');
    out = out.replace(/\bPremier\s*League\b/gi, 'الدوري الممتاز');
    out = out.replace(/\bPremiership\b/gi, 'الدوري الممتاز');
    out = out.replace(/\b1st\s*Division\b/gi, 'الدرجة الأولى');
    out = out.replace(/\bChampionship\b/gi, 'دوري البطولة');
    out = out.replace(/\b2\.?\s*Bundesliga\b/gi, 'الدوري الألماني الدرجة الثانية');
    out = out.replace(/\bBundesliga\b/gi, 'الدوري الألماني');
    out = out.replace(/\bFrauen[\s-]?Bundesliga\b/gi, 'الدوري الألماني للسيدات');
    out = out.replace(/\bEliteserien\b/gi, 'الدوري النرويجي الممتاز');
    out = out.replace(/\bSuper\s*Liga\b/gi, 'الدوري الممتاز');
    out = out.replace(/\bSuperliga\b/gi, 'الدوري الممتاز');
    out = out.replace(/\bLiga\s*1\b/gi, 'الدرجة الأولى');
    out = out.replace(/\bBelgian\s*Pro\s*League\b/gi, 'الدوري البلجيكي للمحترفين');
    out = out.replace(/\bLeague\s*1\b/gi, 'الدرجة الأولى');
    out = out.replace(/\bLeague\s*2\b/gi, 'الدرجة الثانية');
    out = out.replace(/\bPlay-?off\b/gi, 'الملحق');
    out = out.replace(/\bFinal\s*Stage\b/gi, 'المرحلة النهائية');
    out = out.replace(/\bClosing\b/gi, 'الختام');
    out = out.replace(/\bOpening\b/gi, 'الافتتاح');
    out = out.replace(/\bEast\b/gi, 'شرق');
    out = out.replace(/\bWest\b/gi, 'غرب');
    out = out.replace(/\bPromotion\s*Group\b/gi, 'مجموعة الصعود');
    out = out.replace(/\bRelegation\s*Group\b/gi, 'مجموعة الهبوط');
    out = out.replace(/\bChampionship\s*Group\b/gi, 'مجموعة البطولة');
    out = out.replace(/\bQualification\b/gi, 'التصفيات');
    out = out.replace(/\bQualifiers?\b/gi, 'التصفيات');
    out = out.replace(/\bRelegation\b/gi, 'الهبوط');
    out = out.replace(/\bI[\s-]?League\b/gi, 'الدوري الهندي');
    out = out.replace(/\bK[\s-]?League\s*1\b/gi, 'الدوري الكوري');
    out = out.replace(/\bU18\b/gi, 'تحت 18');
    out = out.replace(/\bU19\b/gi, 'تحت 19');
    out = out.replace(/\bU20\b/gi, 'تحت 20');
    out = out.replace(/\bU21\b/gi, 'تحت 21');
    out = out.replace(/\bU23\b/gi, 'تحت 23');
    out = out.replace(/\bPro\s*League\b/gi, 'دوري المحترفين');
    out = out.replace(/\bStars\s*League\b/gi, 'دوري النجوم');
    out = out.replace(/\bConference\s*League\b/gi, 'دوري المؤتمر');
    out = out.replace(/\bChampions\s*League\b/gi, 'دوري الأبطال');
    out = out.replace(/\bEuropa\s*League\b/gi, 'الدوري الأوروبي');
    out = out.replace(/\bApertura\b/gi, 'الافتتاح');
    out = out.replace(/\bClausura\b/gi, 'الختام');
    out = out.replace(/\bGroup\b/gi, 'مجموعة');
    out = out.replace(/\bPlay\s*Offs?\b/gi, 'الملحق');
    out = out.replace(/\s{2,}/g, ' ').trim();
    return out;
  }

  if (lang === 'es') {
    let out = name.trim();
    out = out.replace(/\bPremier\s*League\s*2\b/gi, 'Premier League 2');
    out = out.replace(/\bPremier\s*League\b/gi, 'Premier League');
    out = out.replace(/\bPremiership\b/gi, 'Premiership');
    out = out.replace(/\b1st\s*Division\b/gi, 'Primera División');
    out = out.replace(/\bChampionship\b/gi, 'Championship');
    out = out.replace(/\b2\.?\s*Bundesliga\b/gi, '2. Bundesliga');
    out = out.replace(/\bBundesliga\b/gi, 'Bundesliga');
    out = out.replace(/\bFrauen[\s-]?Bundesliga\b/gi, 'Frauen-Bundesliga');
    out = out.replace(/\bEliteserien\b/gi, 'Eliteserien');
    out = out.replace(/\bSuper\s*Liga\b/gi, 'Super Liga');
    out = out.replace(/\bSuperliga\b/gi, 'Superliga');
    out = out.replace(/\bLiga\s*1\b/gi, 'Liga 1');
    out = out.replace(/\bBelgian\s*Pro\s*League\b/gi, 'Pro League de Bélgica');
    out = out.replace(/\bLeague\s*1\b/gi, 'League One');
    out = out.replace(/\bLeague\s*2\b/gi, 'League Two');
    out = out.replace(/\bPlay-?off\b/gi, 'Play-off');
    out = out.replace(/\bFinal\s*Stage\b/gi, 'Fase Final');
    out = out.replace(/\bClosing\b/gi, 'Clausura');
    out = out.replace(/\bOpening\b/gi, 'Apertura');
    out = out.replace(/\bEast\b/gi, 'Este');
    out = out.replace(/\bWest\b/gi, 'Oeste');
    out = out.replace(/\bPromotion\s*Group\b/gi, 'Grupo de Ascenso');
    out = out.replace(/\bRelegation\s*Group\b/gi, 'Grupo de Descenso');
    out = out.replace(/\bChampionship\s*Group\b/gi, 'Grupo de Campeonato');
    out = out.replace(/\bQualification\b/gi, 'Clasificación');
    out = out.replace(/\bQualifiers?\b/gi, 'Clasificatorias');
    out = out.replace(/\bRelegation\b/gi, 'Descenso');
    out = out.replace(/\bI[\s-]?League\b/gi, 'I-League');
    out = out.replace(/\bK[\s-]?League\s*1\b/gi, 'K-League 1');
    out = out.replace(/\bU18\b/gi, 'Sub-18');
    out = out.replace(/\bU19\b/gi, 'Sub-19');
    out = out.replace(/\bU20\b/gi, 'Sub-20');
    out = out.replace(/\bU21\b/gi, 'Sub-21');
    out = out.replace(/\bU23\b/gi, 'Sub-23');
    out = out.replace(/\bPro\s*League\b/gi, 'Pro League');
    out = out.replace(/\bStars\s*League\b/gi, 'Stars League');
    out = out.replace(/\bConference\s*League\b/gi, 'Conference League');
    out = out.replace(/\bChampions\s*League\b/gi, 'Liga de Campeones');
    out = out.replace(/\bEuropa\s*League\b/gi, 'Europa League');
    out = out.replace(/\bQueensland\b/gi, 'Queensland');
    out = out.replace(/\bVictoria\b/gi, 'Victoria');
    out = out.replace(/\bSouth Australia\b/gi, 'Australia Meridional');
    out = out.replace(/\bState League\b/gi, 'Liga Estatal');
    out = out.replace(/\bApertura\b/gi, 'Apertura');
    out = out.replace(/\bClausura\b/gi, 'Clausura');
    out = out.replace(/\bGroup\b/gi, 'Grupo');
    out = out.replace(/\bPlay\s*Offs?\b/gi, 'Play-offs');
    out = out.replace(/\s{2,}/g, ' ').trim();
    return out;
  }

  if (lang === 'fr') {
    let out = name.trim();
    out = out.replace(/\bPremier\s*League\s*2\b/gi, 'Premier League 2');
    out = out.replace(/\bPremier\s*League\b/gi, 'Premier League');
    out = out.replace(/\bPremiership\b/gi, 'Premiership');
    out = out.replace(/\b1st\s*Division\b/gi, '1ʳᵉ Division');
    out = out.replace(/\bChampionship\b/gi, 'Championship');
    out = out.replace(/\b2\.?\s*Bundesliga\b/gi, '2. Bundesliga');
    out = out.replace(/\bBundesliga\b/gi, 'Bundesliga');
    out = out.replace(/\bFrauen[\s-]?Bundesliga\b/gi, 'Frauen-Bundesliga');
    out = out.replace(/\bEliteserien\b/gi, 'Eliteserien');
    out = out.replace(/\bSuper\s*Liga\b/gi, 'Super Liga');
    out = out.replace(/\bSuperliga\b/gi, 'Superliga');
    out = out.replace(/\bLiga\s*1\b/gi, 'Liga 1');
    out = out.replace(/\bBelgian\s*Pro\s*League\b/gi, 'Pro League Belge');
    out = out.replace(/\bLeague\s*1\b/gi, 'League One');
    out = out.replace(/\bLeague\s*2\b/gi, 'League Two');
    out = out.replace(/\bPlay-?off\b/gi, 'Barrage');
    out = out.replace(/\bFinal\s*Stage\b/gi, 'Phase Finale');
    out = out.replace(/\bClosing\b/gi, 'Clôture');
    out = out.replace(/\bOpening\b/gi, 'Ouverture');
    out = out.replace(/\bEast\b/gi, 'Est');
    out = out.replace(/\bWest\b/gi, 'Ouest');
    out = out.replace(/\bPromotion\s*Group\b/gi, 'Groupe de Promotion');
    out = out.replace(/\bRelegation\s*Group\b/gi, 'Groupe de Relégation');
    out = out.replace(/\bChampionship\s*Group\b/gi, 'Groupe de Championnat');
    out = out.replace(/\bQualification\b/gi, 'Qualification');
    out = out.replace(/\bQualifiers?\b/gi, 'Éliminatoires');
    out = out.replace(/\bRelegation\b/gi, 'Relégation');
    out = out.replace(/\bPro\s*League\b/gi, 'Pro League');
    out = out.replace(/\bStars\s*League\b/gi, 'Stars League');
    out = out.replace(/\bConference\s*League\b/gi, 'Conference League');
    out = out.replace(/\bChampions\s*League\b/gi, 'Ligue des Champions');
    out = out.replace(/\bEuropa\s*League\b/gi, 'Ligue Europa');
    out = out.replace(/\bU18\b/gi, 'U18');
    out = out.replace(/\bU19\b/gi, 'U19');
    out = out.replace(/\bU20\b/gi, 'U20');
    out = out.replace(/\bU21\b/gi, 'U21');
    out = out.replace(/\bU23\b/gi, 'U23');
    out = out.replace(/\bApertura\b/gi, 'Ouverture');
    out = out.replace(/\bClausura\b/gi, 'Clôture');
    out = out.replace(/\bGroup\b/gi, 'Groupe');
    out = out.replace(/\bPlay\s*Offs?\b/gi, 'Barrages');
    out = out.replace(/\s{2,}/g, ' ').trim();
    return out;
  }

  if (lang === 'de') {
    let out = name.trim();
    out = out.replace(/\bPremier\s*League\s*2\b/gi, 'Premier League 2');
    out = out.replace(/\bPremier\s*League\b/gi, 'Premier League');
    out = out.replace(/\bPremiership\b/gi, 'Premiership');
    out = out.replace(/\b1st\s*Division\b/gi, '1. Division');
    out = out.replace(/\bChampionship\b/gi, 'Championship');
    out = out.replace(/\b2\.?\s*Bundesliga\b/gi, '2. Bundesliga');
    out = out.replace(/\bBundesliga\b/gi, 'Bundesliga');
    out = out.replace(/\bFrauen[\s-]?Bundesliga\b/gi, 'Frauen-Bundesliga');
    out = out.replace(/\bEliteserien\b/gi, 'Eliteserien');
    out = out.replace(/\bSuper\s*Liga\b/gi, 'Super Liga');
    out = out.replace(/\bSuperliga\b/gi, 'Superliga');
    out = out.replace(/\bLiga\s*1\b/gi, 'Liga 1');
    out = out.replace(/\bBelgian\s*Pro\s*League\b/gi, 'Belgische Pro League');
    out = out.replace(/\bLeague\s*1\b/gi, 'League One');
    out = out.replace(/\bLeague\s*2\b/gi, 'League Two');
    out = out.replace(/\bPlay-?off\b/gi, 'Play-off');
    out = out.replace(/\bFinal\s*Stage\b/gi, 'Finalphase');
    out = out.replace(/\bClosing\b/gi, 'Schlussrunde');
    out = out.replace(/\bOpening\b/gi, 'Eröffnungsrunde');
    out = out.replace(/\bEast\b/gi, 'Ost');
    out = out.replace(/\bWest\b/gi, 'West');
    out = out.replace(/\bPromotion\s*Group\b/gi, 'Aufstiegsgruppe');
    out = out.replace(/\bRelegation\s*Group\b/gi, 'Abstiegsgruppe');
    out = out.replace(/\bChampionship\s*Group\b/gi, 'Meisterschaftsgruppe');
    out = out.replace(/\bQualification\b/gi, 'Qualifikation');
    out = out.replace(/\bQualifiers?\b/gi, 'Qualifikation');
    out = out.replace(/\bRelegation\b/gi, 'Abstieg');
    out = out.replace(/\bPro\s*League\b/gi, 'Pro League');
    out = out.replace(/\bStars\s*League\b/gi, 'Stars League');
    out = out.replace(/\bConference\s*League\b/gi, 'Conference League');
    out = out.replace(/\bChampions\s*League\b/gi, 'Champions League');
    out = out.replace(/\bEuropa\s*League\b/gi, 'Europa League');
    out = out.replace(/\bU18\b/gi, 'U18');
    out = out.replace(/\bU19\b/gi, 'U19');
    out = out.replace(/\bU20\b/gi, 'U20');
    out = out.replace(/\bU21\b/gi, 'U21');
    out = out.replace(/\bU23\b/gi, 'U23');
    out = out.replace(/\bApertura\b/gi, 'Apertura');
    out = out.replace(/\bClausura\b/gi, 'Clausura');
    out = out.replace(/\bGroup\b/gi, 'Gruppe');
    out = out.replace(/\bPlay\s*Offs?\b/gi, 'Play-offs');
    out = out.replace(/\s{2,}/g, ' ').trim();
    return out;
  }

  if (lang === 'pt') {
    let out = name.trim();
    out = out.replace(/\bPremier\s*League\s*2\b/gi, 'Premier League 2');
    out = out.replace(/\bPremier\s*League\b/gi, 'Premier League');
    out = out.replace(/\bPremiership\b/gi, 'Premiership');
    out = out.replace(/\b1st\s*Division\b/gi, '1ª Divisão');
    out = out.replace(/\bChampionship\b/gi, 'Championship');
    out = out.replace(/\b2\.?\s*Bundesliga\b/gi, '2. Bundesliga');
    out = out.replace(/\bBundesliga\b/gi, 'Bundesliga');
    out = out.replace(/\bFrauen[\s-]?Bundesliga\b/gi, 'Frauen-Bundesliga');
    out = out.replace(/\bEliteserien\b/gi, 'Eliteserien');
    out = out.replace(/\bSuper\s*Liga\b/gi, 'Super Liga');
    out = out.replace(/\bSuperliga\b/gi, 'Superliga');
    out = out.replace(/\bLiga\s*1\b/gi, 'Liga 1');
    out = out.replace(/\bBelgian\s*Pro\s*League\b/gi, 'Pro League Belga');
    out = out.replace(/\bLeague\s*1\b/gi, 'League One');
    out = out.replace(/\bLeague\s*2\b/gi, 'League Two');
    out = out.replace(/\bPlay-?off\b/gi, 'Play-off');
    out = out.replace(/\bFinal\s*Stage\b/gi, 'Fase Final');
    out = out.replace(/\bClosing\b/gi, 'Fecho');
    out = out.replace(/\bOpening\b/gi, 'Abertura');
    out = out.replace(/\bEast\b/gi, 'Leste');
    out = out.replace(/\bWest\b/gi, 'Oeste');
    out = out.replace(/\bPromotion\s*Group\b/gi, 'Grupo de Promoção');
    out = out.replace(/\bRelegation\s*Group\b/gi, 'Grupo de Despromoção');
    out = out.replace(/\bChampionship\s*Group\b/gi, 'Grupo do Campeonato');
    out = out.replace(/\bQualification\b/gi, 'Qualificação');
    out = out.replace(/\bQualifiers?\b/gi, 'Eliminatórias');
    out = out.replace(/\bRelegation\b/gi, 'Despromoção');
    out = out.replace(/\bPro\s*League\b/gi, 'Pro League');
    out = out.replace(/\bStars\s*League\b/gi, 'Stars League');
    out = out.replace(/\bConference\s*League\b/gi, 'Conference League');
    out = out.replace(/\bChampions\s*League\b/gi, 'Liga dos Campeões');
    out = out.replace(/\bEuropa\s*League\b/gi, 'Liga Europa');
    out = out.replace(/\bU18\b/gi, 'Sub-18');
    out = out.replace(/\bU19\b/gi, 'Sub-19');
    out = out.replace(/\bU20\b/gi, 'Sub-20');
    out = out.replace(/\bU21\b/gi, 'Sub-21');
    out = out.replace(/\bU23\b/gi, 'Sub-23');
    out = out.replace(/\bApertura\b/gi, 'Abertura');
    out = out.replace(/\bClausura\b/gi, 'Fecho');
    out = out.replace(/\bGroup\b/gi, 'Grupo');
    out = out.replace(/\bPlay\s*Offs?\b/gi, 'Play-offs');
    out = out.replace(/\s{2,}/g, ' ').trim();
    return out;
  }

  if (lang === 'ru') {
    let out = name.trim();
    out = out.replace(/\bPremier\s*League\b/gi, 'Премьер-лига');
    out = out.replace(/\bPremiership\b/gi, 'Премьершип');
    out = out.replace(/\b1st\s*Division\b/gi, 'Первая лига');
    out = out.replace(/\bChampionship\b/gi, 'Чемпионшип');
    out = out.replace(/\bBundesliga\b/gi, 'Бундеслига');
    out = out.replace(/\bFrauen[\s-]?Bundesliga\b/gi, 'Женская Бундеслига');
    out = out.replace(/\bEliteserien\b/gi, 'Элитсерия');
    out = out.replace(/\bSuper\s*Liga\b/gi, 'Суперлига');
    out = out.replace(/\bSuperliga\b/gi, 'Суперлига');
    out = out.replace(/\bLiga\s*1\b/gi, 'Лига 1');
    out = out.replace(/\bBelgian\s*Pro\s*League\b/gi, 'Про-лига Бельгии');
    out = out.replace(/\bLeague\s*1\b/gi, 'Лига 1');
    out = out.replace(/\bLeague\s*2\b/gi, 'Лига 2');
    out = out.replace(/\bPlay-?off\b/gi, 'Плей-офф');
    out = out.replace(/\bFinal\s*Stage\b/gi, 'Финальная стадия');
    out = out.replace(/\bEast\b/gi, 'Восток');
    out = out.replace(/\bWest\b/gi, 'Запад');
    out = out.replace(/\bPromotion\s*Group\b/gi, 'Группа повышения');
    out = out.replace(/\bRelegation\s*Group\b/gi, 'Группа вылета');
    out = out.replace(/\bChampionship\s*Group\b/gi, 'Чемпионская группа');
    out = out.replace(/\bQualification\b/gi, 'Квалификация');
    out = out.replace(/\bQualifiers?\b/gi, 'Квалификация');
    out = out.replace(/\bRelegation\b/gi, 'Вылет');
    out = out.replace(/\bPro\s*League\b/gi, 'Про-лига');
    out = out.replace(/\bStars\s*League\b/gi, 'Старс-лига');
    out = out.replace(/\bConference\s*League\b/gi, 'Лига конференций');
    out = out.replace(/\bChampions\s*League\b/gi, 'Лига чемпионов');
    out = out.replace(/\bEuropa\s*League\b/gi, 'Лига Европы');
    out = out.replace(/\bU18\b/gi, 'до 18');
    out = out.replace(/\bU19\b/gi, 'до 19');
    out = out.replace(/\bU20\b/gi, 'до 20');
    out = out.replace(/\bU21\b/gi, 'до 21');
    out = out.replace(/\bU23\b/gi, 'до 23');
    out = out.replace(/\bGroup\b/gi, 'Группа');
    out = out.replace(/\bPlay\s*Offs?\b/gi, 'Плей-офф');
    out = out.replace(/\s{2,}/g, ' ').trim();
    return out;
  }

  if (lang === 'ja') {
    let out = name.trim();
    out = out.replace(/\bPremier\s*League\b/gi, 'プレミアリーグ');
    out = out.replace(/\bPremiership\b/gi, 'プレミアシップ');
    out = out.replace(/\b1st\s*Division\b/gi, '1部');
    out = out.replace(/\bChampionship\b/gi, 'チャンピオンシップ');
    out = out.replace(/\bBundesliga\b/gi, 'ブンデスリーガ');
    out = out.replace(/\bFrauen[\s-]?Bundesliga\b/gi, '女子ブンデスリーガ');
    out = out.replace(/\bEliteserien\b/gi, 'エリテセリエン');
    out = out.replace(/\bSuper\s*Liga\b/gi, 'スーペルリーガ');
    out = out.replace(/\bSuperliga\b/gi, 'スーペルリーガ');
    out = out.replace(/\bLiga\s*1\b/gi, 'リーガ1');
    out = out.replace(/\bBelgian\s*Pro\s*League\b/gi, 'ベルギー・プロ・リーグ');
    out = out.replace(/\bLeague\s*1\b/gi, 'リーグ1');
    out = out.replace(/\bLeague\s*2\b/gi, 'リーグ2');
    out = out.replace(/\bPlay-?off\b/gi, 'プレーオフ');
    out = out.replace(/\bFinal\s*Stage\b/gi, 'ファイナルステージ');
    out = out.replace(/\bEast\b/gi, '東');
    out = out.replace(/\bWest\b/gi, '西');
    out = out.replace(/\bPromotion\s*Group\b/gi, '昇格グループ');
    out = out.replace(/\bRelegation\s*Group\b/gi, '降格グループ');
    out = out.replace(/\bChampionship\s*Group\b/gi, '優勝グループ');
    out = out.replace(/\bQualification\b/gi, '予選');
    out = out.replace(/\bQualifiers?\b/gi, '予選');
    out = out.replace(/\bRelegation\b/gi, '降格');
    out = out.replace(/\bPro\s*League\b/gi, 'プロリーグ');
    out = out.replace(/\bStars\s*League\b/gi, 'スターズリーグ');
    out = out.replace(/\bConference\s*League\b/gi, 'カンファレンスリーグ');
    out = out.replace(/\bChampions\s*League\b/gi, 'チャンピオンズリーグ');
    out = out.replace(/\bEuropa\s*League\b/gi, 'ヨーロッパリーグ');
    out = out.replace(/\bU18\b/gi, 'U18');
    out = out.replace(/\bU19\b/gi, 'U19');
    out = out.replace(/\bU20\b/gi, 'U20');
    out = out.replace(/\bU21\b/gi, 'U21');
    out = out.replace(/\bU23\b/gi, 'U23');
    out = out.replace(/\bGroup\b/gi, 'グループ');
    out = out.replace(/\bPlay\s*Offs?\b/gi, 'プレーオフ');
    out = out.replace(/\s{2,}/g, ' ').trim();
    return out;
  }

  if (lang === 'ko') {
    let out = name.trim();
    out = out.replace(/\bPremier\s*League\b/gi, '프리미어리그');
    out = out.replace(/\bPremiership\b/gi, '프리미어십');
    out = out.replace(/\b1st\s*Division\b/gi, '1부 리그');
    out = out.replace(/\bChampionship\b/gi, '챔피언십');
    out = out.replace(/\bBundesliga\b/gi, '분데스리가');
    out = out.replace(/\bFrauen[\s-]?Bundesliga\b/gi, '프라우엔-분데스리가');
    out = out.replace(/\bEliteserien\b/gi, '엘리테세리엔');
    out = out.replace(/\bSuper\s*Liga\b/gi, '수페르리가');
    out = out.replace(/\bSuperliga\b/gi, '수페르리가');
    out = out.replace(/\bLiga\s*1\b/gi, '리가 1');
    out = out.replace(/\bBelgian\s*Pro\s*League\b/gi, '벨기에 프로 리그');
    out = out.replace(/\bLeague\s*1\b/gi, '리그 1');
    out = out.replace(/\bLeague\s*2\b/gi, '리그 2');
    out = out.replace(/\bPlay-?off\b/gi, '플레이오프');
    out = out.replace(/\bFinal\s*Stage\b/gi, '파이널 스테이지');
    out = out.replace(/\bEast\b/gi, '동');
    out = out.replace(/\bWest\b/gi, '서');
    out = out.replace(/\bPromotion\s*Group\b/gi, '승격 그룹');
    out = out.replace(/\bRelegation\s*Group\b/gi, '강등 그룹');
    out = out.replace(/\bChampionship\s*Group\b/gi, '우승 그룹');
    out = out.replace(/\bQualification\b/gi, '예선');
    out = out.replace(/\bQualifiers?\b/gi, '예선');
    out = out.replace(/\bRelegation\b/gi, '강등');
    out = out.replace(/\bPro\s*League\b/gi, '프로 리그');
    out = out.replace(/\bStars\s*League\b/gi, '스타스 리그');
    out = out.replace(/\bConference\s*League\b/gi, '컨퍼런스 리그');
    out = out.replace(/\bChampions\s*League\b/gi, '챔피언스 리그');
    out = out.replace(/\bEuropa\s*League\b/gi, '유로파 리그');
    out = out.replace(/\bU18\b/gi, 'U18');
    out = out.replace(/\bU19\b/gi, 'U19');
    out = out.replace(/\bU20\b/gi, 'U20');
    out = out.replace(/\bU21\b/gi, 'U21');
    out = out.replace(/\bU23\b/gi, 'U23');
    out = out.replace(/\bGroup\b/gi, '그룹');
    out = out.replace(/\bPlay\s*Offs?\b/gi, '플레이오프');
    out = out.replace(/\s{2,}/g, ' ').trim();
    return out;
  }

  
  if (lang === 'th') {
    let out = name.trim();
    out = out.replace(/\bPremier\s*League\b/gi, 'พรีเมียร์ลีก');
    out = out.replace(/\bPremiership\b/gi, 'พรีเมียร์ชิพ');
    out = out.replace(/\b1st\s*Division\b/gi, 'ดิวิชัน 1');
    out = out.replace(/\bChampionship\b/gi, 'แชมเปียนชิพ');
    out = out.replace(/\bBundesliga\b/gi, 'บุนเดสลีกา');
    out = out.replace(/\bFrauen[\s-]?Bundesliga\b/gi, 'ฟราเอิน-บุนเดสลีกา');
    out = out.replace(/\bEliteserien\b/gi, 'เอลีเตเซเรียน');
    out = out.replace(/\bSuper\s*Liga\b/gi, 'ซูเปอร์ลีกา');
    out = out.replace(/\bSuperliga\b/gi, 'ซูเปอร์ลีกา');
    out = out.replace(/\bLiga\s*1\b/gi, 'ลีกา 1');
    out = out.replace(/\bBelgian\s*Pro\s*League\b/gi, 'โปรลีกเบลเยียม');
    out = out.replace(/\bLeague\s*1\b/gi, 'ลีก 1');
    out = out.replace(/\bLeague\s*2\b/gi, 'ลีก 2');
    out = out.replace(/\bPlay-?off\b/gi, 'เพลย์ออฟ');
    out = out.replace(/\bFinal\s*Stage\b/gi, 'รอบชิงชนะเลิศ');
    out = out.replace(/\bEast\b/gi, 'ตะวันออก');
    out = out.replace(/\bWest\b/gi, 'ตะวันตก');
    out = out.replace(/\bPromotion\s*Group\b/gi, 'กลุ่มเลื่อนชั้น');
    out = out.replace(/\bRelegation\s*Group\b/gi, 'กลุ่มตกชั้น');
    out = out.replace(/\bChampionship\s*Group\b/gi, 'กลุ่มแชมเปียนชิพ');
    out = out.replace(/\bQualification\b/gi, 'รอบคัดเลือก');
    out = out.replace(/\bQualifiers?\b/gi, 'รอบคัดเลือก');
    out = out.replace(/\bRelegation\b/gi, 'ตกชั้น');
    out = out.replace(/\bPro\s*League\b/gi, 'โปรลีก');
    out = out.replace(/\bStars\s*League\b/gi, 'สตาร์สลีก');
    out = out.replace(/\bConference\s*League\b/gi, 'คอนเฟอเรนซ์ลีก');
    out = out.replace(/\bChampions\s*League\b/gi, 'แชมเปียนส์ลีก');
    out = out.replace(/\bEuropa\s*League\b/gi, 'ยูโรปาลีก');
    out = out.replace(/\bU18\b/gi, 'U18');
    out = out.replace(/\bU19\b/gi, 'U19');
    out = out.replace(/\bU20\b/gi, 'U20');
    out = out.replace(/\bU21\b/gi, 'U21');
    out = out.replace(/\bU23\b/gi, 'U23');
    out = out.replace(/\bGroup\b/gi, 'กลุ่ม');
    out = out.replace(/\bPlay\s*Offs?\b/gi, 'เพลย์ออฟ');
    out = out.replace(/\s{2,}/g, ' ').trim();
    return out;
  }

  if (lang !== 'zh-TW' && lang !== 'zh-CN') return name;
  const isTw = lang === 'zh-TW';

  let out = name.trim();
  out = out.replace(/\s*:\s*/g, '：');
  out = out.replace(/\bPremier League\b/gi, isTw ? '超級聯賽' : '超级联赛');
  out = out.replace(/\bPremiership\b/gi, isTw ? '超級聯賽' : '超级联赛');
  out = out.replace(/\b1st Division\b/gi, isTw ? '甲級聯賽' : '甲级联赛');
  out = out.replace(/\bChampionship\b/gi, isTw ? '冠軍聯賽' : '冠军联赛');
  out = out.replace(/\bBundesliga\b/gi, isTw ? '甲級聯賽' : '甲级联赛');
  out = out.replace(/\b2\.\s*Bundesliga\b/gi, isTw ? '乙級聯賽' : '乙级联赛');
  out = out.replace(/\bFrauen[\s-]?Bundesliga\b/gi, isTw ? '女子甲級聯賽' : '女子甲级联赛');
  out = out.replace(/\bEliteserien\b/gi, isTw ? '超級聯賽' : '超级联赛');
  out = out.replace(/\bSuper\s*Liga\b/gi, isTw ? '超級聯賽' : '超级联赛');
  out = out.replace(/\bSuperliga\b/gi, isTw ? '超級聯賽' : '超级联赛');
  out = out.replace(/\bLiga\s*1\b/gi, isTw ? '甲級聯賽' : '甲级联赛');
  out = out.replace(/\bBelgian Pro League\b/gi, isTw ? '比利時甲組聯賽' : '比利时甲级联赛');
  out = out.replace(/\bLeague\s*1\b/gi, isTw ? '甲組聯賽' : '甲级联赛');
  out = out.replace(/\bLeague\s*2\b/gi, isTw ? '乙組聯賽' : '乙级联赛');
  out = out.replace(/\bPlay-?off\b/gi, isTw ? '附加賽' : '附加赛');
  out = out.replace(/\bFinal Stage\b/gi, isTw ? '決賽階段' : '决赛阶段');
  out = out.replace(/\bClosing\b/gi, isTw ? '閉幕' : '闭幕');
  out = out.replace(/\bEast\b/gi, isTw ? '東' : '东');
  out = out.replace(/\bWest\b/gi, isTw ? '西' : '西');
  out = out.replace(/\bQueensland\b/gi, isTw ? '昆士蘭' : '昆士兰');
  out = out.replace(/\bVictoria\b/gi, isTw ? '維多利亞' : '维多利亚');
  out = out.replace(/\bSouth Australia\b/gi, isTw ? '南澳' : '南澳');
  out = out.replace(/\bState League\b/gi, isTw ? '州聯賽' : '州联赛');
  out = out.replace(/\bK[\s-]?League\s*1\b/gi, isTw ? 'K聯賽1' : 'K联赛1');
  out = out.replace(/\bI[\s-]?League\b/gi, isTw ? 'I聯賽' : 'I联赛');
  out = out.replace(/\bPromotion Group\b/gi, isTw ? '升級組' : '升级组');
  out = out.replace(/\bRelegation Group\b/gi, isTw ? '保級組' : '保级组');
  out = out.replace(/\bChampionship Group\b/gi, isTw ? '冠軍組' : '冠军组');
  out = out.replace(/\bRelegation\b/gi, isTw ? '保級' : '保级');
  out = out.replace(/\bQualification\b/gi, isTw ? '資格賽' : '资格赛');
  out = out.replace(/\s{2,}/g, ' ').trim();
  return out;
}

// League definitions with fallback translations
const LEAGUES = [
  // 世界盃特區
  {
    key: 'fifa.worldcup',
    name: 'World Cup',
    country: 'Int.',
    category: 'worldcup',
    names: { 'zh-TW': '2026 世界盃', 'zh-CN': '2026 世界杯', 'es': 'Copa Mundial', 'ar': 'كأس العالم' },
    aliases: [
      'World Cup 2026',
      'FIFA World Cup',
      'World Cup Qualification',
      'World Cup Qualifiers',
      'World Cup Qualifying',
      'World Cup Qual',
      'WC Qualification',
      'WC Qualifiers',
      'WC Qualifying'
    ]
  },
  
  // 歐洲/國際級賽事
  { key: 'uefa.champions', name: 'Champions League', country: 'Champions League', category: 'europe', names: { 'zh-TW': '歐洲聯賽冠軍盃', 'zh-CN': '欧洲冠军联赛', 'es': 'Liga de Campeones', 'ar': 'دوري أبطال أوروبا' }, aliases: ['Knockout Stage', 'Group Stage', 'Qualification'] },
  { key: 'uefa.europa', name: 'Europa League', country: 'Europa League', category: 'europe', names: { 'zh-TW': '歐霸盃', 'zh-CN': '欧罗巴联赛', 'es': 'UEFA Europa League', 'ar': 'الدوري الأوروبي' } },
  { key: 'uefa.europa.conf', name: 'Conference League', country: 'Europa Conference League', category: 'europe', names: { 'zh-TW': '歐洲協會聯賽', 'zh-CN': '欧洲协会联赛', 'es': 'UEFA Conference League', 'ar': 'دوري المؤتمر الأوروبي' } },
  
  // 歐洲聯賽
  { key: 'eng.1', name: 'Premier League', country: 'England', category: 'england', names: { 'zh-TW': '英格蘭超級聯賽', 'zh-CN': '英格兰超级联赛', 'es': 'Premier League', 'ja': 'プレミアリーグ', 'ko': '프리미어리그', 'pt': 'Premier League',
 'ru': 'Премьер-лига', 'fr': 'Premier League', 'de': 'Premier League', 'ar': 'الدوري الإنجليزي الممتاز' } },
  { key: 'eng.2', name: 'Championship', country: 'England', category: 'england', names: { 'zh-TW': '英格蘭冠軍聯賽', 'zh-CN': '英格兰冠军联赛', 'es': 'Championship', 'ar': 'دوري البطولة الإنجليزية' } },
  { key: 'eng.3', name: 'League 1', country: 'England', category: 'england', names: { 'zh-TW': '英格蘭甲組聯賽', 'zh-CN': '英格兰甲级联赛', 'es': 'League 1', 'ar': 'الدوري الإنجليزي الدرجة الأولى' }, aliases: ['League One'] },
  { key: 'eng.4', name: 'League 2', country: 'England', category: 'england', names: { 'zh-TW': '英格蘭乙組聯賽', 'zh-CN': '英格兰乙级联赛', 'es': 'League 2', 'ar': 'الدوري الإنجليزي الدرجة الثانية' }, aliases: ['League Two'] },
  { key: 'eng.npl', name: 'Northern Premier League', country: 'England', category: 'england', names: { 'ar': 'الدوري الإنجليزي الشمالي الممتاز' }, aliases: ['Play-Off'] },
  { key: 'eng.u18', name: 'Premier League U18', country: 'England', category: 'england', names: { 'ar': 'الدوري الإنجليزي الممتاز تحت 18' } },
  { key: 'nor.1', name: 'Eliteserien', country: 'Norway', category: 'europe', names: { 'zh-TW': '挪威超級聯賽', 'zh-CN': '挪威超级联赛', 'es': 'Eliteserien', 'ja': 'エリテセリエン', 'ko': '엘리테세리엔', 'pt': 'Eliteserien',
 'ru': 'Элитсерия', 'fr': 'Eliteserien', 'de': 'Eliteserien', 'ar': 'الدوري النرويجي الممتاز' }, aliases: ['Norway Eliteserien'] },
  { key: 'rus.cup', name: 'Russian Cup', country: 'Russia', category: 'europe', names: { 'zh-TW': '俄羅斯盃', 'zh-CN': '俄罗斯杯', 'es': 'Copa de Rusia', 'ar': 'كأس روسيا' }, aliases: ['Cup'] },
  { key: 'ger.1', name: 'Bundesliga', country: 'Germany', category: 'europe', names: { 'zh-TW': '德國甲級聯賽', 'zh-CN': '德国甲级联赛', 'es': 'Bundesliga', 'ja': 'ブンデスリーガ', 'ko': '분데스리가', 'pt': 'Bundesliga',
 'ru': 'Бундеслига', 'fr': 'Bundesliga', 'de': 'Bundesliga', 'ar': 'الدوري الألماني' } },
  { key: 'ger.w', name: 'Frauen-Bundesliga', country: 'Germany', category: 'europe', names: { 'zh-TW': '德國女子甲級聯賽', 'zh-CN': '德国女子甲级联赛', 'es': 'Bundesliga Femenina', 'ja': '女子ブンデスリーガ', 'ko': '프라우엔-분데스리가', 'pt': 'Bundesliga Feminina',
 'ru': 'Женская Бундеслига', 'fr': 'Frauen-Bundesliga', 'de': 'Frauen-Bundesliga', 'ar': 'الدوري الألماني للسيدات' } },
  { key: 'svn.1', name: 'Prva Liga', country: 'Slovenia', category: 'europe', names: { 'zh-TW': '斯洛維尼亞甲級聯賽', 'zh-CN': '斯洛文尼亚甲级联赛', 'es': 'Prva Liga', 'ja': 'プルヴァ・リーガ', 'ko': '프르바리가', 'pt': 'Prva Liga',
 'ru': 'Первая лига', 'fr': 'Prva Liga', 'de': 'Prva Liga', 'ar': 'الدوري السلوفيني' } },
  { key: 'isr.1', name: 'Premier League', country: 'Israel', category: 'europe', names: { 'zh-TW': '以色列超級聯賽', 'zh-CN': '以色列超级联赛', 'es': 'Liga Premier de Israel', 'ja': 'イスラエル・プレミアリーグ', 'ko': '프리미어리그', 'pt': 'Premier League de Israel',
 'ru': 'Премьер-лига', 'fr': 'Premier League', 'de': 'Premier League', 'ar': 'الدوري الإسرائيلي الممتاز' }, aliases: ['Relegation Group', 'Championship Group'] },
  { key: 'nir.1', name: 'Premiership', country: 'Northern Ireland', category: 'europe', names: { 'ar': 'الدوري الأيرلندي الشمالي الممتاز' }, aliases: ['Qualification'] },
  
  // Serbia
  { key: 'srb.1', name: 'Super Liga', country: 'Serbia', category: 'europe', names: { 'zh-TW': '塞爾維亞超級聯賽', 'zh-CN': '塞尔维亚超级联赛', 'es': 'Super Liga', 'ja': 'スーペルリーガ', 'ko': '수페르리가', 'pt': 'Super Liga',
 'ru': 'Суперлига', 'fr': 'Super Liga', 'de': 'Super Liga', 'ar': 'الدوري الصربي الممتاز' }, aliases: ['Superliga'] },
  { key: 'srb.2', name: 'Prva Liga', country: 'Serbia', category: 'europe', names: { 'zh-TW': '塞爾維亞甲級聯賽', 'zh-CN': '塞尔维亚甲级联赛', 'es': 'Prva Liga', 'ja': 'プルヴァ・リーガ', 'ko': '프르바리가', 'pt': 'Prva Liga',
 'ru': 'Первая лига', 'fr': 'Prva Liga', 'de': 'Prva Liga', 'ar': 'الدوري الصربي الدرجة الأولى' } },
  
  // Malta
  { key: 'mlt.1', name: 'Malta Premier', country: 'Malta', category: 'europe', names: { 'zh-TW': '馬耳他超級聯賽', 'zh-CN': '马耳他超级联赛', 'es': 'Premier League de Malta', 'ja': 'マルタ・プレミアリーグ', 'ko': '몰타 프리미어리그', 'pt': 'Premier League de Malta',
 'ru': 'Премьер-лига Мальты', 'fr': 'Premier League maltaise', 'de': 'Maltesische Premier League', 'ar': 'الدوري المالطي الممتاز' }, aliases: ['Premier League'] },

  // Denmark
  { key: 'den.1', name: 'Superliga', country: 'Denmark', category: 'europe', names: { 'zh-TW': '丹麥超級聯賽', 'zh-CN': '丹麦超级联赛', 'es': 'Superliga Danesa', 'ja': 'スーペルリーガ', 'ko': '수페르리가', 'pt': 'Superliga Dinamarquesa',
 'ru': 'Суперлига Дании', 'fr': 'Superliga Danoise', 'de': 'Dänische Superliga', 'ar': 'دوري السوبر الدنماركي' } },

  // Cyprus
  { key: 'cyp.1', name: '1st Division', country: 'Cyprus', category: 'europe', names: { 'zh-TW': '塞浦路斯甲級聯賽', 'zh-CN': '塞浦路斯甲级联赛', 'es': 'Primera División de Chipre', 'ja': 'キプロス・ファーストディビジョン', 'ko': '키프로스 1부 리그', 'pt': 'Primeira Divisão do Chipre',
 'ru': 'Первый дивизион Кипра', 'fr': 'Première Division Chypriote', 'de': 'Zyprische First Division', 'ar': 'الدوري القبرصي الدرجة الأولى' } },

  // Belgium
  { key: 'bel.1', name: 'Belgian Pro League', country: 'Belgium', category: 'europe', names: { 'zh-TW': '比利時甲組聯賽', 'zh-CN': '比利时甲级联赛', 'es': 'Pro League de Bélgica', 'ja': 'ベルギー・プロ・リーグ', 'ko': '벨기에 프로 리그', 'pt': 'Pro League Belga',
 'ru': 'Про-лига Бельгии', 'fr': 'Pro League Belge', 'de': 'Belgische Pro League', 'ar': 'الدوري البلجيكي للمحترفين' }, aliases: ['Pro League'] },

  // Slovakia
  { key: 'svk.1', name: 'Super Liga', country: 'Slovakia', category: 'europe', names: { 'zh-TW': '斯洛伐克超級聯賽', 'zh-CN': '斯洛伐克超级联赛', 'es': 'Superliga de Eslovaquia', 'ja': 'ツォルゴン・リーガ', 'ko': '수페르리가', 'pt': 'Superliga Eslovaca',
 'ru': 'Суперлига Словакии', 'fr': 'Superliga Slovaque', 'de': 'Slowakische Superliga', 'ar': 'دوري السوبر السلوفاكي' } },

  // Romania
  { key: 'rou.1', name: 'Liga 1', country: 'Romania', category: 'europe', names: { 'zh-TW': '羅馬尼亞甲級聯賽', 'zh-CN': '罗马尼亚甲级联赛', 'es': 'Liga 1', 'ja': 'リーガ1', 'ko': '리가 1', 'pt': 'Liga 1',
 'ru': 'Лига 1', 'fr': 'Liga 1', 'de': 'Liga 1', 'ar': 'الدوري الروماني' } },

  // Moldova
  { key: 'mda.1', name: 'Super Liga', country: 'Moldova', category: 'europe', names: { 'zh-TW': '摩爾多瓦超級聯賽', 'zh-CN': '摩尔多瓦超级联赛', 'es': 'Superliga de Moldavia', 'ja': 'モルドバ・スーパーリーガ', 'ko': '수페르리가', 'pt': 'Superliga Moldava',
 'ru': 'Суперлига Молдовы', 'fr': 'Super Liga Moldave', 'de': 'Moldauische Super Liga', 'ar': 'دوري السوبر المولدوفي' } },

  // Scotland
  { key: 'sco.1', name: 'Premiership', country: 'Scotland', category: 'europe', names: { 'zh-TW': '蘇格蘭超級聯賽', 'zh-CN': '苏格兰超级联赛', 'es': 'Premiership', 'ja': 'スコティッシュ・プレミアシップ', 'ko': '프리미어십', 'pt': 'Premiership Escocesa',
 'ru': 'Премьершип', 'fr': 'Premiership Écossaise', 'de': 'Scottish Premiership', 'ar': 'الدوري الاسكتلندي الممتاز' } },

  // Egypt
  { key: 'egy.1', name: 'Premier League', country: 'Egypt', category: 'europe', names: { 'zh-TW': '埃及超級聯賽', 'zh-CN': '埃及超级联赛', 'es': 'Liga Premier de Egipto', 'ja': 'エジプト・プレミアリーグ', 'ko': '이집트 프리미어리그', 'pt': 'Premier League Egípcia',
 'ru': 'Премьер-лига Египта', 'fr': 'Premier League Égyptienne', 'de': 'Ägyptische Premier League', 'ar': 'الدوري المصري الممتاز' } },

  // Austria
  { key: 'aut.1', name: 'Bundesliga', country: 'Austria', category: 'europe', names: { 'zh-TW': '奧地利超級聯賽', 'zh-CN': '奥地利超级联赛', 'es': 'Bundesliga de Austria', 'ja': 'オーストリア・ブンデスリーガ', 'ko': '분데스리가', 'pt': 'Bundesliga Austríaca',
 'ru': 'Бундеслига Австрии', 'fr': 'Bundesliga Autrichienne', 'de': 'Österreichische Bundesliga', 'ar': 'الدوري النمساوي' } },

  // Peru
  { key: 'per.1', name: 'Liga 1', country: 'Peru', category: 'americas', names: { 'zh-TW': '秘魯甲級聯賽', 'zh-CN': '秘鲁甲级联赛', 'es': 'Liga 1', 'ja': 'リーガ1', 'ko': '리가 1', 'pt': 'Liga 1',
 'ru': 'Лига 1', 'fr': 'Liga 1', 'de': 'Liga 1', 'ar': 'الدوري البيروفي' }, aliases: ['Apertura', 'Clausura'] },

  // South Africa
  { key: 'rsa.1', name: '1st Division', country: 'South Africa', category: 'africa', names: { 'zh-TW': '南非甲級聯賽', 'zh-CN': '南非甲级联赛', 'es': 'Primera División de Sudáfrica', 'ja': '南アフリカ・ファーストディビジョン', 'ko': '1st Division', 'pt': 'Primeira Divisão da África do Sul',
 'ru': 'Первый дивизион ЮАР', 'fr': '1ère Division Sud-Africaine', 'de': 'Südafrikanische 1st Division', 'ar': 'دوري جنوب أفريقيا الدرجة الأولى' } },
  { key: 'rsa.premier', name: 'Premier League', country: 'South Africa', category: 'africa', names: { 'ar': 'الدوري الجنوب أفريقي الممتاز' } },

  // Libya
  { key: 'lby.1', name: 'Premier League', country: 'Libya', category: 'africa', names: { 'zh-TW': '利比亞超級聯賽', 'zh-CN': '利比亚超级联赛', 'es': 'Liga Premier de Libia', 'ja': 'リビア・プレミアリーグ', 'ko': '프리미어리그', 'pt': 'Premier League da Líbia',
 'ru': 'Премьер-лига Ливии', 'fr': 'Premier League Libyenne', 'de': 'Libysche Premier League', 'ar': 'الدوري الليبي الممتاز' } },

  // 亞洲賽事
  { key: 'afc.champions2', name: 'AFC Champions League Two', country: 'Asia', category: 'asia', names: { 'zh-TW': '亞冠盃2', 'zh-CN': '亚冠杯2', 'es': 'Liga de Campeones AFC 2', 'ar': 'دوري أبطال آسيا 2' }, aliases: ['Champions League Two', 'ACL Two', 'AFC Champions League 2'] },
  { key: 'afc.u20w', name: 'Women\'s Asian Cup U20', country: 'Asia', category: 'asia', names: { 'zh-TW': 'U20女子亞洲盃', 'zh-CN': 'U20女子亚洲杯', 'es': 'Copa Asiática Femenina U20', 'ar': 'كأس آسيا للسيدات تحت 20 سنة' }, aliases: ['U20 Womens Asian Cup', 'AFC U20'] },
  { key: 'sau.1', name: 'Saudi Pro League', country: 'Saudi Arabia', category: 'asia', names: { 'zh-TW': '沙特職業聯賽', 'zh-CN': '沙特职业联赛', 'es': 'Liga Profesional Saudí', 'ar': 'دوري المحترفين السعودي' }, aliases: ['Pro League'] },
  { key: 'qat.1', name: 'Stars League', country: 'Qatar', category: 'asia', names: { 'zh-TW': '卡塔爾超級聯賽', 'zh-CN': '卡塔尔星级联赛', 'es': 'Stars League', 'ja': 'カタール・スターズリーグ', 'ko': '카타르 스타스 리그', 'pt': 'Stars League',
 'ru': 'Старс-лига', 'fr': 'Stars League', 'de': 'Stars League', 'ar': 'دوري نجوم قطر' } },
  { key: 'irq.1', name: 'Iraq Stars League', country: 'Iraq', category: 'asia', names: { 'zh-TW': '伊拉克星級聯賽', 'zh-CN': '伊拉克星级联赛', 'es': 'Liga de las Estrellas de Irak', 'ja': 'イラク・スターズリーグ', 'ko': '이라크 스타스 리그', 'pt': 'Liga das Estrelas do Iraque',
 'ru': 'Старс-лига Ирака', 'fr': 'Iraq Stars League', 'de': 'Iraq Stars League', 'ar': 'دوري نجوم العراق' }, aliases: ['Stars League'] },
  { key: 'jpn.2', name: 'J2 League', country: 'Japan', category: 'asia', names: { 'zh-TW': '日乙', 'zh-CN': '日乙', 'es': 'J2 League', 'ar': 'الدوري الياباني الدرجة الثانية' }, aliases: ['East A', 'East B', 'West A', 'West B'] },
  { key: 'jpn.3', name: 'J3 League', country: 'Japan', category: 'asia', names: { 'zh-TW': '日丙', 'zh-CN': '日丙', 'es': 'J3 League', 'ar': 'الدوري الياباني الدرجة الثالثة' } },
  { key: 'jpn.100', name: 'J.League 100 Year Vision', country: 'Japan', category: 'asia', names: { 'zh-TW': '百年構想聯賽', 'zh-CN': '百年构想联赛', 'es': 'J.League 100', 'ar': 'دوري رؤية 100 عام' } },
  { key: 'aus.cup', name: 'Australia Cup', country: 'Australia', category: 'asia', names: { 'zh-TW': '澳洲盃', 'zh-CN': '澳大利亚杯', 'es': 'Copa de Australia', 'ar': 'كأس أستراليا' }, aliases: ['Cup', 'Australia Cup'] },
  { key: 'ind.1', name: 'I-League', country: 'India', category: 'asia', names: { 'ar': 'الدوري الهندي' }, aliases: ['Championship Group', 'Relegation Group'] },

  // 美洲賽事
  { key: 'conmebol.libertadores', name: 'Copa Libertadores', country: 'Copa Libertadores', category: 'americas', names: { 'zh-TW': '南美自由盃', 'zh-CN': '南美解放者杯', 'es': 'Copa Libertadores', 'ar': 'كأس ليبرتادوريس' }, aliases: ['CONMEBOL Libertadores', 'Group Stage', 'Knockout Stage', 'Group A', 'Group B', 'Group C', 'Group D', 'Group E', 'Group F', 'Group G', 'Group H'] },
  { key: 'conmebol.sudamericana', name: 'Copa Sudamericana', country: 'Copa Sudamericana', category: 'americas', names: { 'zh-TW': '南美球會盃', 'zh-CN': '南美杯', 'es': 'Copa Sudamericana', 'ar': 'كوبا سود أمريكانا' }, aliases: ['CONMEBOL Sudamericana', 'Group Stage', 'Knockout Stage', 'Group A', 'Group B', 'Group C', 'Group D', 'Group E', 'Group F', 'Group G', 'Group H'] },
  { key: 'concacaf.champions', name: 'CONCACAF Champions Cup', country: 'CONCACAF Champions Cup', category: 'americas', names: { 'zh-TW': '中北美洲冠軍盃', 'zh-CN': '中北美洲冠军杯', 'es': 'Copa de Campeones CONCACAF', 'ar': 'كأس أبطال الكونكاكاف' }, aliases: ['Champions Cup', 'CONCACAF'] },
  { key: 'mex.1', name: 'Liga MX', country: 'Mexico', category: 'americas', names: { 'zh-TW': '墨西哥超級聯賽', 'zh-CN': '墨西哥超级联赛', 'es': 'Liga MX', 'ja': 'リーガMX', 'ko': '리가 MX', 'pt': 'Liga MX',
 'ru': 'Лига МХ', 'fr': 'Liga MX', 'de': 'Liga MX', 'ar': 'الدوري المكسيكي' } },
  { key: 'mex.2', name: 'Liga de Expansion MX', country: 'Mexico', category: 'americas', names: { 'zh-TW': '墨西哥甲組聯賽', 'zh-CN': '墨西哥甲级联赛', 'es': 'Liga de Expansión MX', 'ja': 'リーガ・デ・エクスパンシオンMX', 'ko': '리가 데 엑스판시온 MX', 'pt': 'Liga de Expansión MX',
 'ru': 'Лига Экспансьон МХ', 'fr': 'Liga de Expansión MX', 'de': 'Liga de Expansión MX', 'ar': 'دوري التوسع المكسيكي' }, aliases: ['Liga de Expansion', 'Expansion MX'] },
  { key: 'arg.cup', name: 'Copa Argentina', country: 'Argentina', category: 'americas', names: { 'zh-TW': '阿根廷盃', 'zh-CN': '阿根廷杯', 'es': 'Copa Argentina', 'ar': 'كأس الأرجنتين' } },
];

// Fallback dictionary for common teams (Partial list)
const TEAM_NAMES: Record<string, Record<string, string>> = {
  'AaB': { 'ar': 'ألبورغ', 'zh-CN': '奥尔堡', 'zh-TW': '奧爾堡', 'ru': 'АаБ', 'de': 'AaB' , 'ja': 'ああB' , 'ko': 'AaB' , 'th': 'เอเอบี' , 'pt': 'AaB' },
  'Aalesund': { 'es': 'Aalesund', 'zh-CN': '奥勒松', 'zh-TW': '奧勒松', 'ru': 'Олесунн', 'de': 'Aalesund' , 'ja': 'オーレスン' , 'ko': '올레순' , 'th': 'อาเลซุนด์' , 'pt': 'Aalesund' },
  'Aarhus Fremad': { 'ar': 'آرهوس فريما', 'zh-CN': '奥尔胡斯前进', 'zh-TW': '阿爾胡斯前進', 'ru': 'Орхус Фремад', 'de': 'Aarhus Fremad' , 'ja': 'オーフス・フレマド' , 'ko': '오르후스 프레마드' , 'th': 'อาร์ฮุส เฟรมาด' , 'pt': 'Aarhus Fremad' },
  'Aberdeen': { 'ar': 'أبردين', 'zh-CN': '阿伯丁', 'zh-TW': '亞伯丁', 'ru': 'Абердин', 'de': 'Aberdeen' , 'ja': 'アバディーン' , 'ko': '애버딘' , 'th': 'อเบอร์ดีน' , 'pt': 'Aberdeen' },
  'AC Milan': { 'es': 'Milan', 'zh-CN': 'AC米兰', 'zh-TW': 'AC米蘭', 'de': 'AC Mailand', 'ru': 'Милан', 'ja': 'ACミラン' , 'ko': 'AC 밀란' , 'th': 'เอซี มิลาน' , 'pt': 'AC Milan' },
  'Academia Puerto Cabello': { 'ar': 'أكاديميا بويرتو كابيلو', 'ru': 'Академия Пуэрто-Кабельо', 'de': 'Academia Puerto Cabello' , 'ja': 'アカデミア プエルト カベッロ' , 'ko': '아카데미아 푸에르토 카베요' , 'th': 'อคาเดเมีย ปวยร์โต กาเบลโล' , 'pt': 'Academia Puerto Cabello' },
  'Accrington': { 'es': 'Accrington', 'zh-CN': '阿克宁顿', 'zh-TW': '阿克寧頓', 'ru': 'Аккрингтон', 'de': 'Accrington' , 'ja': 'アクリントン' , 'ko': '애크링턴' , 'th': 'แอคคริงตัน' , 'pt': 'Accrington' },
  'Accrington Stanley': { 'ar': 'أكرينغتون ستانلي', 'zh-CN': '阿克宁顿斯坦利', 'zh-TW': '阿克寧頓斯坦利', 'ru': 'Аккрингтон Стэнли', 'de': 'Accrington Stanley' , 'ja': 'アクリントン・スタンリー' , 'ko': '애크링턴 스탠리' , 'th': 'แอคคริงตัน สแตนลี่ย์' , 'pt': 'Accrington Stanley' },
  'ACS Champions FC Arges': { 'ar': 'أرجيس', 'zh-CN': '阿尔杰什', 'zh-TW': '阿爾傑什', 'ru': 'ACS Champions ФК Арджес', 'de': 'ACS Champions FC Arges' , 'ja': 'ACS チャンピオンズ FC アージェス' , 'ko': 'ACS 챔피언스 FC 아르게스' , 'th': 'เอซีเอส แชมเปี้ยนส์ เอฟซี อาร์เกส' , 'pt': 'ACS Champions FC Arges' },
  'Adelaide Blue Eagles': { 'ar': 'أديلايد بلو إيغلز', 'zh-CN': '阿德莱德蓝鹰', 'zh-TW': '阿德萊德藍鷹', 'ru': 'Аделаида Блю Иглз', 'de': 'Adelaide Blue Eagles' , 'ja': 'アデレード・ブルー・イーグルス' , 'ko': '애들레이드 블루 이글스' , 'th': 'อดิไลเด้ บลู อีเกิลส์' , 'pt': 'Adelaide Blue Eagles' },
  'Adelaide Cobras': { 'ar': 'أديلايد كوبراز', 'zh-CN': '阿德莱德眼镜蛇', 'zh-TW': '阿德萊德眼鏡蛇', 'ru': 'Аделаида Кобры', 'de': 'Adelaide Cobras' , 'ja': 'アデレード・コブラス' , 'ko': '애들레이드 코브라' , 'th': 'แอดิเลดคอบราส' , 'pt': 'Adelaide Cobras' },
  'Adelaide Olympic': { 'ar': 'أديلايد أولمبيك', 'zh-CN': '阿德莱德奥林匹克', 'zh-TW': '阿德萊德奧林匹克', 'ru': 'Аделаида Олимпик', 'de': 'Adelaide Olympic' , 'ja': 'アデレードオリンピック' , 'ko': '애들레이드 올림픽' , 'th': 'อเดเลด โอลิมปิก' , 'pt': 'Adelaide Olympic' },
  'Adelaide Raiders': { 'ar': 'أديلايد رايدرز', 'zh-CN': '阿德莱德突袭者', 'zh-TW': '阿德萊德突襲者', 'ru': 'Аделаида Рейдерс', 'de': 'Adelaide Raiders' , 'ja': 'アデレード・レイダース' , 'ko': '애들레이드 레이더스' , 'th': 'อเดเลด ไรเดอร์ส' , 'pt': 'Adelaide Raiders' },
  'Adelaide Victory': { 'ar': 'أديلايد فيكتوري', 'zh-CN': '阿德莱德胜利', 'zh-TW': '阿德萊德勝利', 'ru': 'Аделаида Виктори', 'de': 'Adelaide Victory' , 'ja': 'アデレード・ビクトリー' , 'ko': '애들레이드 승리' , 'th': 'อเดเลด วิคตอรี่' , 'pt': 'Adelaide Victory' },
  'AEK Larnaca': { 'zh-CN': '拉纳卡AEK', 'zh-TW': '拉納卡AEK', 'ru': 'АЕК Ларнака', 'de': 'AEK Larnaca' , 'ja': 'AEK ラルナカ' , 'ko': 'AEK 라르나카' , 'th': 'เออีเค ลาร์นากา' , 'pt': 'AEK Larnaca' },
  'AEL Limassol': { 'ar': 'أيل ليماسول', 'zh-CN': '利马索尔AEL', 'zh-TW': '利馬索爾AEL', 'ru': 'АЕЛ Лимассол', 'de': 'AEL Limassol' , 'ja': 'AEL リマソール' , 'ko': 'AEL 리마솔' , 'th': 'เออีแอล ลิมาสโซล' , 'pt': 'AEL Limassol' },
  'AFC Leopards': { 'ar': 'أيه إف سي ليوباردز', 'zh-CN': '豹子', 'zh-TW': '豹子', 'ru': 'АФК Леопарды', 'de': 'AFC Leopards' , 'ja': 'AFCレパーズ' , 'ko': 'AFC 레오파드' , 'th': 'เอเอฟซี ลีโอพาร์ด' , 'pt': 'AFC Leopards' },
  'AFC Wimbledon': { 'ar': 'إيه إف سي ويمبلدون', 'zh-CN': '温布尔登', 'zh-TW': '溫布頓', 'ru': 'АФК Уимблдон', 'de': 'AFC Wimbledon' , 'ja': 'AFCウィンブルドン' , 'ko': 'AFC 윔블던' , 'th': 'เอเอฟซี วิมเบิลดัน' , 'pt': 'AFC Wimbledon' },
  'AGF': { 'ar': 'آرهوس', 'zh-CN': '奥胡斯', 'zh-TW': '阿爾胡斯', 'ru': 'АГФ', 'de': 'AGF' , 'ja': 'AGF' , 'ko': 'AGF' , 'th': 'เอจีเอฟ' , 'pt': 'AGF' },
  'AGF W': { 'ar': 'آرهوس (سيدات)', 'ru': 'АГФ (Ж)', 'de': 'AGF W' , 'ja': 'AGF W' , 'ko': 'AGF 여' , 'th': 'เอจีเอฟ ดับเบิลยู' , 'pt': 'AGF W' },
  'Airdrieonians': { 'ar': 'إيردريونيانز', 'zh-CN': '艾迪尔人', 'zh-TW': '艾迪爾人', 'ru': 'Эйрдрионианцы', 'de': 'Airdrieonians' , 'ja': 'エアドリアン人' , 'ko': '에어드리오니안' , 'th': 'แอร์ดรีโอเนียน' , 'pt': 'Airdrieonians' },
  'Aizawl': { 'ar': 'أيزاول', 'ru': 'Айзавл', 'de': 'Aizawl' , 'ja': 'アイザウル' , 'ko': '아이자울' , 'th': 'ไอซอล' , 'pt': 'Aizawl' },
  'Akritas Chlorakas': { 'ar': 'أكريتاس كلوراكاس', 'zh-CN': '阿克里塔斯', 'zh-TW': '阿克裡塔斯', 'ru': 'Акритас Хлоракас', 'de': 'Akritas Chlorakas' , 'ja': 'アクリタス・クロラカス' , 'ko': '아크리타스 클로라카스' , 'th': 'อกฤษฎา คลอรากัส' , 'pt': 'Akritas Chlorakas' },
  'Aktobe': { 'zh-CN': '阿克托比', 'zh-TW': '阿克托比', 'ru': 'Актобе', 'de': 'Aktobe' , 'ja': 'アクトベ' , 'ko': '악토베' , 'th': 'อักโตเบ' , 'pt': 'Aktobe' },
  'Al Ahli': { 'es': 'Al-Ahli', 'zh-CN': '吉达国民', 'zh-TW': '阿赫利', 'ru': 'Аль-Ахли', 'de': 'Al Ahli' , 'ja': 'アル・アハリ' , 'ko': '알 알리' , 'th': 'อัล อาห์ลี' , 'pt': 'Al Ahli' },
  'Al Ahly': { 'ar': 'الأهلي', 'zh-CN': '阿赫利', 'zh-TW': '阿赫利', 'ru': 'Аль-Ахли', 'de': 'Al Ahly' , 'ja': 'アル・アハリ' , 'ko': '알 알리' , 'th': 'อัล อาห์ลี' , 'pt': 'Al Ahly' },
  'Al Hilal': { 'es': 'Al-Hilal', 'zh-CN': '利雅得新月', 'zh-TW': '阿爾希拉爾', 'ru': 'Аль Хилал', 'de': 'Al Hilal' , 'ja': 'アル・ヒラル' , 'ko': '알 힐랄' , 'th': 'อัล ฮิลาล' , 'pt': 'Al Hilal' },
  'Al Ittihad': { 'es': 'Al-Ittihad', 'zh-CN': '吉达联合', 'zh-TW': '伊蒂哈德', 'ru': 'Аль-Иттихад', 'de': 'Al Ittihad' , 'ja': 'アル・イティハド' , 'ko': '알 이티하드' , 'th': 'อัล อิติฮัด' , 'pt': 'Al Ittihad' },
  'Al Kahrabaa': { 'ar': 'الكهرباء', 'zh-CN': '电力', 'zh-TW': '電力', 'ru': 'Аль-Кахрабаа', 'de': 'Al Kahrabaa' , 'ja': 'アル・カハラバア' , 'ko': '알 카라바' , 'th': 'อัล คาห์ราบา' , 'pt': 'Al Kahrabaa' },
  'Al Karkh': { 'ar': 'الكرخ', 'zh-CN': '卡尔赫', 'zh-TW': '卡爾赫', 'ru': 'Аль Карх', 'de': 'Al Karkh' , 'ja': 'アル・カーク' , 'ko': '알 카르크' , 'th': 'อัล คาร์ค' , 'pt': 'Al Karkh' },
  'AL Khalidiyah': { 'ar': 'الخالدية', 'ru': 'Аль Халидия', 'de': 'AL Khalidiyah' , 'ja': 'アル・ハリディヤ' , 'ko': '알 칼리디야' , 'th': 'อัล คาลิดิยาห์' , 'pt': 'AL Khalidiyah' },
  'Al Masry': { 'ar': 'المصري', 'zh-CN': '马斯里', 'zh-TW': '馬斯里', 'ru': 'Аль Масри', 'de': 'Al Masry' , 'ja': 'アル・マスリ' , 'ko': '알 마스리' , 'th': 'อัล มาสรี' , 'pt': 'Al Masry' },
  'Al Minaa': { 'zh-CN': '港口', 'zh-TW': '港口', 'ru': 'Аль Минаа', 'de': 'Al Minaa' , 'ja': 'アル・ミナア' , 'ko': '알 미나' , 'th': 'อัล มินา' , 'pt': 'Al Minaa' },
  'Al Mokawloon Al Arab': { 'ar': 'المقاولون العرب', 'ru': 'Аль Мокавлун Аль Араб', 'de': 'Al Mokawloon Al Arab' , 'ja': 'アル・モカウルーン アル・アラブ' , 'ko': '알 모카울룬 알 아랍' , 'th': 'อัล โมกาวลูน อัล อาหรับ' , 'pt': 'Al Mokawloon Al Arab' },
  'Al Naft': { 'ar': 'النفط', 'zh-CN': '石油', 'zh-TW': '石油', 'ru': 'Аль Нафт', 'de': 'Al Naft' , 'ja': 'アル・ナフト' , 'ko': '알 나프트' , 'th': 'อัล นาฟต์' , 'pt': 'Al Naft' },
  'Al Najaf': { 'ar': 'النجف', 'zh-CN': '纳杰夫', 'zh-TW': '納杰夫', 'ru': 'Аль-Наджаф', 'de': 'Al Najaf' , 'ja': 'アル・ナジャフ' , 'ko': '알 나자프' , 'th': 'อัล นาจาฟ' , 'pt': 'Al Najaf' },
  'Al Nassr': { 'es': 'Al-Nassr', 'zh-CN': '利雅得胜利', 'zh-TW': '艾納斯', 'ru': 'Аль-Наср', 'de': 'Al Nassr' , 'ja': 'アル・ナスル' , 'ko': '알 나스르' , 'th': 'อัล นาสเซอร์' , 'pt': 'Al Nassr' },
  'Al Quwa Al Jawiya': { 'ar': 'القوة الجوية', 'zh-CN': '空军', 'zh-TW': '空軍', 'ru': 'Аль-Кува Аль-Джавия', 'de': 'Al Quwa Al Jawiya' , 'ja': 'アル クワ アル ジャウィヤ' , 'ko': '알 쿠와 알 자위야' , 'th': 'อัลกุวาอัลจาวิยะห์' , 'pt': 'Al Quwa Al Jawiya' },
  'Al Shorta': { 'zh-CN': '警察', 'zh-TW': '警察', 'ru': 'Аль Шорта', 'de': 'Al Shorta' , 'ja': 'アル・ショータ' , 'ko': '알 쇼타' , 'th': 'อัล ชอร์ต้า' , 'pt': 'Al Shorta' },
  'Al Talaba': { 'ar': 'الطلبة', 'zh-CN': '学生', 'zh-TW': '學生', 'ru': 'Аль Талаба', 'de': 'Al Talaba' , 'ja': 'アル・タラバ' , 'ko': '알 탈라바' , 'th': 'อัลตาลาบา' , 'pt': 'Al Talaba' },
  'Al Zawraa': { 'de': 'Al Zawraa', 'es': 'Al Zawraa', 'fr': 'Al Zawraa', 'ja': 'アル・ザウラー', 'ko': '알 자우라',
 'pt': 'Al Zawraa', 'ru': 'Аль-Завраа', 'zh-CN': '扎维拉', 'zh-TW': '扎維拉' , 'th': 'อัล ซอรา' },
  'Al-Ahli': { 'ar': 'الأهلي', 'ru': 'Аль-Ахли', 'de': 'Al-Ahli' , 'ja': 'アル・アハリ' , 'ko': '알 알리' , 'th': 'อัล-อาห์ลี' , 'pt': 'Al-Ahli' },
  'Al-Arabi': { 'ar': 'العربي', 'ru': 'Аль-Араби', 'de': 'Al-Arabi' , 'ja': 'アルアラビ' , 'ko': '알 아라비' , 'th': 'อัล-อราบี' , 'pt': 'Al-Arabi' },
  'Al-Duhail SC': { 'ar': 'الدحيل', 'ru': 'Аль-Духаиль СК', 'de': 'Al-Duhail SC' , 'ja': 'アル ドゥハイル SC' , 'ko': '알 두하일 SC' , 'th': 'อัล-ดูฮาอิล เอสซี' , 'pt': 'Al-Duhail SC' },
  'Al-Gharafa': { 'ar': 'الغرافة', 'ru': 'Аль-Гарафа', 'de': 'Al-Gharafa' , 'ja': 'アル・ガラファ' , 'ko': '알 가라파' , 'th': 'อัล-การาฟา' , 'pt': 'Al-Gharafa' },
  'Al-Gharraf': { 'zh-CN': '加拉夫', 'zh-TW': '加拉夫', 'ru': 'Аль-Гарраф', 'de': 'Al-Gharraf' , 'ja': 'アル・ガラフ' , 'ko': '알가라프' , 'th': 'อัล-การ์ราฟ' , 'pt': 'Al-Gharraf' },
  'Al-Hidd': { 'ar': 'الحد', 'ru': 'Аль-Хидд', 'de': 'Al-Hidd' , 'ja': 'アル・ヒッド' , 'ko': '알 히드' , 'th': 'อัล-ฮิดด์' , 'pt': 'Al-Hidd' },
  'Al-Hilal': { 'ja': 'アル・ヒラル', 'ko': '알힐랄', 'ru': 'Аль-Хиляль', 'th': 'อัลฮิลาล' , 'de': 'Al-Hilal' , 'pt': 'Al-Hilal' },
  'Al-Ittihad': { 'ja': 'アル・イテハド', 'ko': '알이티하드', 'ru': 'Аль-Иттихад', 'th': 'อัลอิติฮาด' , 'de': 'Al-Ittihad' , 'pt': 'Al-Ittihad' },
  'Al-Ittihad Alexandria': { 'ar': 'الاتحاد السكندري', 'ru': 'Аль-Иттихад Александрия', 'de': 'Al-Ittihad Alexandria' , 'ja': 'アル・イティハド・アレクサンドリア' , 'ko': '알 이티하드 알렉산드리아' , 'th': 'อัล-อิติฮัด อเล็กซานเดรีย' , 'pt': 'Al-Ittihad Alexandria' },
  'Al-Karma': { 'zh-CN': '卡尔马', 'zh-TW': '卡爾馬', 'ru': 'Аль-Карма', 'de': 'Al-Karma' , 'ja': 'アルカルマ' , 'ko': '알 카르마' , 'th': 'อัล-คาร์มา' , 'pt': 'Al-Karma' },
  'Al-Mosul': { 'zh-CN': '摩苏尔', 'zh-TW': '摩蘇爾', 'ru': 'Аль-Мосул', 'de': 'Al-Mosul' , 'ja': 'アルモスル' , 'ko': '알 모술' , 'th': 'อัล-โมซุล' , 'pt': 'Al-Mosul' },
  'Al-Najma': { 'ar': 'النجمة', 'ru': 'Аль-Наджма', 'de': 'Al-Najma' , 'ja': 'アル・ナジマ' , 'ko': '알나즈마' , 'th': 'อัล-นัจมา' , 'pt': 'Al-Najma' },
  'Al-Nassr': { 'ja': 'アル・ナスル', 'ko': '알나스르', 'ru': 'Ан-Наср', 'th': 'อันนัศร์' , 'de': 'Al-Nassr' , 'pt': 'Al-Nassr' },
  'Al-Qasim': { 'zh-CN': '卡西姆', 'zh-TW': '卡西姆', 'ru': 'Аль-Касим', 'de': 'Al-Qasim' , 'ja': 'アル・カシム' , 'ko': '알카심' , 'th': 'อัลกาซิม' , 'pt': 'Al-Qasim' },
  'Al-Rayyan': { 'ar': 'الريان', 'ru': 'Аль-Райян', 'de': 'Al-Rayyan' , 'ja': 'アル・ラヤーン' , 'ko': '알라이얀' , 'th': 'อัล-เรย์ยาน' , 'pt': 'Al-Rayyan' },
  'Al-Riffa': { 'ar': 'الرفاع', 'ru': 'Аль-Риффа', 'de': 'Al-Riffa' , 'ja': 'アル・リファ' , 'ko': '알 리파' , 'th': 'อัล-ริฟฟา' , 'pt': 'Al-Riffa' },
  'Al-Sadd': { 'ar': 'السد', 'ru': 'Аль-Садд', 'de': 'Al-Sadd' , 'ja': 'アルサッド' , 'ko': '알 사드' , 'th': 'อัล-ซาดด์' , 'pt': 'Al-Sadd' },
  'Al-Sailiya': { 'ar': 'السيلية', 'ru': 'Аль-Сайлия', 'de': 'Al-Sailiya' , 'ja': 'アル・サイリヤ' , 'ko': '알 사일리야' , 'th': 'อัล-ไซลิยา' , 'pt': 'Al-Sailiya' },
  'Al-Shabab': { 'ar': 'الشباب', 'ru': 'Аль-Шабаб', 'de': 'Al-Shabab' , 'ja': 'アル・シャバブ' , 'ko': '알샤바브' , 'th': 'อัล-ชาบับ' , 'pt': 'Al-Shabab' },
  'Al-Shahaniya': { 'ar': 'الشحانية', 'ru': 'Аль-Шахания', 'de': 'Al-Shahaniya' , 'ja': 'アル・シャハニヤ' , 'ko': '알샤하니야' , 'th': 'อัล-ชาฮานียา' , 'pt': 'Al-Shahaniya' },
  'Al-Shamal': { 'ar': 'الشمال', 'ru': 'Аль-Шамаль', 'de': 'Al-Shamal' , 'ja': 'アル・シャマル' , 'ko': '알샤말' , 'th': 'อัล-ชามาล' , 'pt': 'Al-Shamal' },
  'Al-Wakra': { 'ar': 'الوكرة', 'ru': 'Аль-Вакра', 'de': 'Al-Wakra' , 'ja': 'アル・ワクラ' , 'ko': '알 와크라' , 'th': 'อัล-วาครา' , 'pt': 'Al-Wakra' },
  'Alaves': { 'ja': 'アラベス', 'ko': '알라베스', 'ru': 'Алавес', 'th': 'อาลาเบส' , 'de': 'Alaves' , 'pt': 'Alaves' },
  'Albirex Niigata': { 'es': 'Albirex Niigata', 'zh-CN': '新潟天鹅', 'zh-TW': '新潟天鵝', 'ru': 'Альбирекс Ниигата', 'de': 'Albirex Niigata' , 'ja': 'アルビレックス新潟' , 'ko': '알비렉스 니가타' , 'th': 'อัลบิเร็กซ์ นิงาตะ' , 'pt': 'Albirex Niigata' },
  'Albirex Niigata (S)': { 'zh-CN': '新潟天鹅B', 'zh-TW': '新潟天鵝乙', 'ru': 'Альбирекс Ниигата (С)', 'de': 'Albirex Niigata (S)' , 'ja': 'アルビレックス新潟(S)' , 'ko': '알비렉스 니가타(S)' , 'th': 'อัลบิเร็กซ์ นิงาตะ (ญ)' , 'pt': 'Albirex Niigata (S)' },
  'Alebrijes Oaxaca': { 'es': 'Alebrijes Oaxaca', 'zh-CN': '瓦哈卡阿莱布里赫斯', 'zh-TW': '瓦哈卡阿萊布里赫斯', 'ru': 'Алебрихес Оахака', 'de': 'Alebrijes Oaxaca' , 'ja': 'アレブリヘス オアハカ' , 'ko': '알레브리헤스 오악사카' , 'th': 'อเลบริเยส โออาซากา' , 'pt': 'Alebrijes Oaxaca' },
  'Alianza Atletico': { 'ar': 'أليانزا أتليتيكو', 'ru': 'Альянса Атлетико', 'de': 'Alianza Atletico' , 'ja': 'アリアンサ・アトレティコ' , 'ko': '알리안자 아틀레티코' , 'th': 'อลิอันซ่า แอตเลติโก้' , 'pt': 'Alianza Atletico' },
  'Alianza Lima': { 'ar': 'أليانزا ليما', 'ru': 'Алианса Лима', 'de': 'Alianza Lima' , 'ja': 'アリアンサ・リマ' , 'ko': '알리안자 리마' , 'th': 'อลิอันซา ลิมา' , 'pt': 'Alianza Lima' },
  'Almeria': { 'ja': 'アルメリア', 'ko': '알메리아', 'ru': 'Альмерия', 'th': 'อัลเมริอา' , 'de': 'Almeria' , 'pt': 'Almeria' },
  'Altach': { 'ar': 'ألتاخ', 'zh-CN': '阿尔塔赫', 'zh-TW': '阿爾塔赫', 'ru': 'Альтах', 'de': 'Altach' , 'ja': 'アルタッハ' , 'ko': '알타크' , 'th': 'อัลทัช' , 'pt': 'Altach' },
  'Aluminij': { 'de': 'Aluminij', 'es': 'Aluminij', 'fr': 'Aluminij', 'ja': 'アルミニイ', 'ko': '알루미니',
 'pt': 'Aluminij', 'ru': 'Алюминий', 'zh-CN': '阿鲁米尼', 'zh-TW': '阿魯米尼' , 'th': 'อลูมิเนียม' },
  'Always Ready': { 'ar': 'أولويز ريدي', 'ru': 'Всегда готов', 'de': 'Always Ready' , 'ja': 'いつでも準備完了' , 'ko': '항상 준비되어 있음' , 'th': 'พร้อมเสมอ' , 'pt': 'Always Ready' },
  'America': { 'es': 'América', 'zh-CN': '美洲队', 'zh-TW': '美洲隊', 'ru': 'Америка', 'de': 'America' , 'ja': 'アメリカ' , 'ko': '미국' , 'th': 'อเมริกา' , 'pt': 'America' },
  'Anderlecht': { 'zh-CN': '安德莱赫特', 'zh-TW': '安德萊赫特', 'ru': 'Андерлехт', 'de': 'Anderlecht' , 'ja': 'アンデルレヒト' , 'ko': '안데를레흐트' , 'th': 'อันเดอร์เลชท์' , 'pt': 'Anderlecht' },
  'Annagh United': { 'ar': 'أناغ يونايتد', 'zh-CN': '安纳联', 'zh-TW': '安納聯', 'ru': 'Анна Юнайтед', 'de': 'Annagh United' , 'ja': 'アナ・ユナイテッド' , 'ko': '안나 유나이티드' , 'th': 'อันนาห์ ยูไนเต็ด' , 'pt': 'Annagh United' },
  'Anorthosis': { 'ar': 'أنورثوسيس', 'zh-CN': '安罗科萨斯', 'zh-TW': '安羅科薩斯', 'ru': 'Анортосис', 'de': 'Anorthosis' , 'ja': 'アナリストシス' , 'ko': '아노르토시스' , 'th': 'อนอร์โธซิส' , 'pt': 'Anorthosis' },
  'Antwerp': { 'zh-CN': '安特卫普', 'zh-TW': '安特衛普', 'ru': 'Антверпен', 'de': 'Antwerp' , 'ja': 'アントワープ' , 'ko': '앤트워프' , 'th': 'แอนต์เวิร์ป' , 'pt': 'Antwerp' },
  'APOEL': { 'zh-CN': '希腊人竞技', 'zh-TW': '希臘人競技', 'ru': 'АПОЭЛ', 'de': 'APOEL' , 'ja': 'アポエル' , 'ko': '아포엘' , 'th': 'อาโปเอล' , 'pt': 'APOEL' },
  'Apollon Limassol': { 'zh-CN': '利马索尔阿波罗', 'zh-TW': '利馬索爾阿波羅', 'ru': 'Аполлон Лимассол', 'de': 'Apollon Limassol' , 'ja': 'アポロン リマソール' , 'ko': '아폴론 리마솔' , 'th': 'อปอลลอน ลิมาสโซล' , 'pt': 'Apollon Limassol' },
  'Ararat-Armenia': { 'zh-CN': '亚拉拉特亚美尼亚', 'zh-TW': '亞拉拉特亞美尼亞', 'ru': 'Арарат-Армения', 'de': 'Ararat-Armenia' , 'ja': 'アララト-アルメニア' , 'ko': '아라라트-아르메니아' , 'th': 'อารารัต-อาร์เมเนีย' , 'pt': 'Ararat-Armenia' },
  'Arbroath': { 'ar': 'أربروث', 'zh-CN': '阿布罗斯', 'zh-TW': '阿布羅斯', 'ru': 'Арброт', 'de': 'Arbroath' , 'ja': 'アーブロース' , 'ko': '아브로스' , 'th': 'อาร์โบรธ' , 'pt': 'Arbroath' },
  'Argentinos Juniors': { 'es': 'Argentinos Juniors', 'zh-CN': '青年人', 'zh-TW': '小阿根廷人', 'ru': 'Аргентинос Хуниорс', 'de': 'Argentinos Juniors' , 'ja': 'アルヘンティーノス ジュニアーズ' , 'ko': '아르헨티노스 주니어스' , 'th': 'อาร์เจนติโนส จูเนียร์ส' , 'pt': 'Argentinos Juniors' },
  'Aris Limassol': { 'zh-CN': '利马索尔阿里斯', 'zh-TW': '利馬索爾阿里斯', 'ru': 'Арминия', 'de': 'Aris Limassol' , 'ja': 'アリス・リマソール' , 'ko': '아리스 리마솔' , 'th': 'อาริส ลิมาสโซล' , 'pt': 'Aris Limassol' },
  'Arminia Bielefeld': { 'ar': 'أرمينيا بيليفيلد', 'zh-CN': '比勒费尔德', 'zh-TW': '比勒費爾德', 'ru': 'Арминия Билефельд', 'de': 'Arminia Bielefeld' , 'ja': 'アルミニア・ビーレフェルト' , 'ko': '아르미니아 빌레펠트' , 'th': 'อาร์มิเนีย บีเลเฟลด์' , 'pt': 'Arminia Bielefeld' },
  'Arnett Gardens': { 'ar': 'أرنيت جاردنز', 'ru': 'Арнетт Гарденс', 'de': 'Arnett Gardens' , 'ja': 'アーネット ガーデンズ' , 'ko': '아넷 정원' , 'th': 'อาร์เน็ตต์ การ์เดนส์' , 'pt': 'Arnett Gardens' },
  'Arsenal': { 'ar': 'أرسنال', 'de': 'Arsenal', 'es': 'Arsenal', 'fr': 'Arsenal', 'ja': 'アーセナル', 'ko': '아스널',
 'pt': 'Arsenal', 'ru': 'Арсенал', 'zh-CN': '阿森纳', 'zh-TW': '阿森納' , 'th': 'อาร์เซนอล' },
  'Arsenal Sarandi': { 'es': 'Arsenal Sarandí', 'zh-CN': '萨兰迪阿森纳', 'zh-TW': '薩蘭迪阿森納', 'ru': 'Арсенал Саранди', 'de': 'Arsenal Sarandi' , 'ja': 'アーセナル・サランディ' , 'ko': '아스날 사란디' , 'th': 'อาร์เซน่อล ซารานดี้' , 'pt': 'Arsenal Sarandi' },
  'Arsenal W': { 'ar': 'أرسنال (سيدات)', 'zh-CN': '阿森纳女足', 'zh-TW': '阿森納女足', 'ru': 'Арсенал (Ж)', 'de': 'Arsenal W' , 'ja': 'アーセナル W' , 'ko': '아스날 여' , 'th': 'อาร์เซนอล ดับเบิลยู' , 'pt': 'Arsenal W' },
  'Asociacion Deportiva Tarma': { 'ar': 'رابطة ديبورتيفا تارما', 'zh-CN': '塔尔马竞技', 'zh-TW': '塔爾馬競技', 'ru': 'Ассоциация Депортива Тарма', 'de': 'Asociacion Deportiva Tarma' , 'ja': 'アソシエーシオン デポルティーバ タルマ' , 'ko': '협회 데포르티바 타르마' , 'th': 'Asociacion Deportiva Tarma' , 'pt': 'Asociacion Deportiva Tarma' },
  'Astana': { 'zh-CN': '阿斯塔纳', 'zh-TW': '阿斯塔納', 'ru': 'Астана', 'de': 'Astana' , 'ja': 'アスタナ' , 'ko': '아스타나' , 'th': 'อัสตานา' , 'pt': 'Astana' },
  'Aston Villa': { 'ar': 'أستون فيلا', 'de': 'Aston Villa', 'es': 'Aston Villa', 'fr': 'Aston Villa', 'ja': 'アストン・ヴィラ', 'ko': '애스턴 빌라',
 'pt': 'Aston Villa', 'ru': 'Астон Вилла', 'zh-CN': '阿斯顿维拉', 'zh-TW': '阿斯頓維拉' , 'th': 'แอสตัน วิลล่า' },
  'Atalanta': { 'ja': 'アタランタ', 'ko': '아탈란타', 'ru': 'Аталанта', 'th': 'อาตาลันตา' , 'de': 'Atalanta' , 'pt': 'Atalanta' },
  'Athletic Bilbao': { 'ja': 'アスレティック・ビルバオ', 'ko': '아틀레틱 빌바오', 'ru': 'Атлетик Бильбао', 'th': 'อัตเลติกบิลบาโอ' , 'de': 'Athletic Bilbao' , 'pt': 'Athletic Bilbao' },
  'Athletic Club': { 'es': 'Athletic Club', 'zh-CN': '毕尔巴鄂竞技', 'zh-TW': '畢爾包競技', 'ru': 'Спортивный клуб', 'de': 'Athletic Club' , 'ja': 'アスレチッククラブ' , 'ko': '체육 클럽' , 'th': 'สโมสรแอธเลติก' , 'pt': 'Athletic Club' },
  'Athlone Town': { 'ar': 'أثلون تاون', 'zh-CN': '阿斯隆镇', 'zh-TW': '阿斯隆鎮', 'ru': 'Атлон Таун', 'de': 'Athlone Town' , 'ja': 'アスローンタウン' , 'ko': '애슬론 타운' , 'th': 'แอธโลน ทาวน์' , 'pt': 'Athlone Town' },
  'Atlante': { 'ar': 'أتلانتي', 'ru': 'Атланта', 'de': 'Atlante' , 'ja': 'アトランテ' , 'ko': '아틀란테' , 'th': 'แอตแลนเต้' , 'pt': 'Atlante' },
  'Atlas': { 'es': 'Atlas', 'zh-CN': '阿特拉斯', 'zh-TW': '阿特拉斯', 'ru': 'Атлас', 'de': 'Atlas' , 'ja': 'アトラス' , 'ko': '아틀라스' , 'th': 'แอตลาส' , 'pt': 'Atlas' },
  'Atletico Grau': { 'ar': 'أتلتيكو جراو', 'zh-CN': '格劳竞技', 'zh-TW': '格勞競技', 'ru': 'Атлетико Грау', 'de': 'Atletico Grau' , 'ja': 'アトレティコ・グラウ' , 'ko': '아틀레티코 그라우' , 'th': 'แอตเลติโก เกรา' , 'pt': 'Atletico Grau' },
  'Atletico Junior': { 'ar': 'أتلتيكو جونيور', 'ru': 'Атлетико Джуниор', 'de': 'Atletico Junior' , 'ja': 'アトレティコ ジュニア' , 'ko': '아틀레티코 주니어' , 'th': 'แอตเลติโก้ จูเนียร์' , 'pt': 'Atletico Junior' },
  'Atletico Madrid': { 'es': 'Atlético de Madrid', 'zh-CN': '马德里竞技', 'zh-TW': '馬德里競技', 'ru': 'Атлетико Мадрид', 'de': 'Atletico Madrid' , 'ja': 'アトレティコ・マドリード' , 'ko': '아틀레티코 마드리드' , 'th': 'แอตเลติโก้ มาดริด' , 'pt': 'Atletico Madrid' },
  'Atletico Ottawa': { 'ar': 'أتلتيكو أوتاوا', 'zh-CN': '渥太华竞技', 'zh-TW': '渥太華競技', 'ru': 'Атлетико Оттава', 'de': 'Atletico Ottawa' , 'ja': 'アトレティコ オタワ' , 'ko': '아틀레티코 오타와' , 'th': 'แอตเลติโก ออตตาวา' , 'pt': 'Atletico Ottawa' },
  'Atletico San Luis': { 'es': 'Atlético San Luis', 'zh-CN': '圣路易斯体育', 'zh-TW': '聖路易斯體育', 'ru': 'Атлетико Сан Луис', 'de': 'Atletico San Luis' , 'ja': 'アトレティコ サン ルイス' , 'ko': '아틀레티코 산 루이스' , 'th': 'แอตเลติโก้ ซาน หลุยส์' , 'pt': 'Atletico San Luis' },
  'Atletico Tucuman': { 'es': 'Atlético Tucumán', 'zh-CN': '图库曼体育', 'zh-TW': '圖庫曼體育', 'ru': 'Атлетико Тукуман', 'de': 'Atletico Tucuman' , 'ja': 'アトレティコ トゥクマン' , 'ko': '아틀레티코 투쿠만' , 'th': 'แอตเลติโก ทูคูมาน' , 'pt': 'Atletico Tucuman' },
  'Audax Italiano': { 'ar': 'أوداكس إيتاليانو', 'ru': 'Аудакс Итальяно', 'de': 'Audax Italiano' , 'ja': 'オーダックス イタリアーノ' , 'ko': '오닥스 이탈리아노' , 'th': 'ออแดกซ์ อิตาเลียโน่' , 'pt': 'Audax Italiano' },
  'Augsburg': { 'ar': 'آوغسبورغ', 'zh-CN': '奥格斯堡', 'zh-TW': '奧格斯堡', 'ru': 'Аугсбург', 'de': 'Augsburg' , 'ja': 'アウグスブルク' , 'ko': '아우크스부르크' , 'th': 'เอาก์สบวร์ก' , 'pt': 'Augsburg' },
  'Austria Wien': { 'ar': 'أوستريا فيينا', 'zh-CN': '奥地利维也纳', 'zh-TW': '奧地利維也納', 'ru': 'Австрия Вена', 'de': 'Austria Wien' , 'ja': 'オーストリア ウィーン' , 'ko': '오스트리아 빈' , 'th': 'ออสเตรีย เวียนนา' , 'pt': 'Austria Wien' },
  'Auxerre': { 'ja': 'オセール', 'ko': '오세르', 'ru': 'Осер', 'th': 'โอแซร์' , 'de': 'Auxerre' , 'pt': 'Auxerre' },
  'Avispa Fukuoka': { 'es': 'Avispa Fukuoka', 'zh-CN': '福冈黄蜂', 'zh-TW': '福岡黃蜂', 'ru': 'Ависпа Фукуока', 'de': 'Avispa Fukuoka' , 'ja': 'アビスパ福岡' , 'ko': '아비스파 후쿠오카' , 'th': 'อวิสปา ฟุกุโอกะ' , 'pt': 'Avispa Fukuoka' },
  'Ayr United': { 'ar': 'آير يونايتد', 'zh-CN': '艾尔联', 'zh-TW': '艾爾聯', 'ru': 'Эйр Юнайтед', 'de': 'Ayr United' , 'ja': 'エア・ユナイテッド' , 'ko': '에어 유나이티드' , 'th': 'อายร์ ยูไนเต็ด' , 'pt': 'Ayr United' },
  'Azam FC': { 'ar': 'عزام', 'zh-CN': '阿扎姆', 'zh-TW': '阿扎姆', 'ru': 'Азам ФК', 'de': 'Azam FC' , 'ja': 'アザムFC' , 'ko': '아잠 FC' , 'th': 'อาซาม เอฟซี' , 'pt': 'Azam FC' },
  'B 93': { 'ar': 'بي 93', 'zh-CN': 'B93', 'zh-TW': 'B93', 'ru': 'Б 93', 'de': 'B 93' , 'ja': 'B93' , 'ko': '비93' , 'th': 'บี 93' , 'pt': 'B 93' },
  'Baghdad FC': { 'zh-CN': '巴格达', 'zh-TW': '巴格達', 'ru': 'Багдад ФК', 'de': 'Baghdad FC' , 'ja': 'バグダッドFC' , 'ko': '바그다드 FC' , 'th': 'แบกแดด เอฟซี' , 'pt': 'Baghdad FC' },
  'Bahrain SC': { 'ar': 'نادي البحرين', 'ru': 'Бахрейн СК', 'de': 'Bahrain SC' , 'ja': 'バーレーンSC' , 'ko': '바레인 SC' , 'th': 'บาห์เรน เอสซี' , 'pt': 'Bahrain SC' },
  'Balestier Khalsa FC': { 'ar': 'باليستيير خالسا', 'zh-CN': '马里士他卡沙', 'zh-TW': '馬里士他卡沙', 'ru': 'Балестиер Хальса', 'de': 'Balestier Khalsa FC' , 'ja': 'バレスティア・カルサFC' , 'ko': '발레스티어 칼사 FC' , 'th': 'บาเลสเตียร์ คัลซา เอฟซี' , 'pt': 'Balestier Khalsa FC' },
  'Banfield': { 'es': 'Banfield', 'zh-CN': '班菲尔德', 'zh-TW': '班菲爾德', 'ru': 'Банфилд', 'de': 'Banfield' , 'ja': 'バンフィールド' , 'ko': '반필드' , 'th': 'บานฟิลด์' , 'pt': 'Banfield' },
  'Barcelona': { 'es': 'Barcelona', 'zh-CN': '巴塞罗那', 'zh-TW': '巴塞隆納', 'ru': 'Барселона', 'de': 'Barcelona' , 'ja': 'バルセロナ' , 'ko': '바르셀로나' , 'th': 'บาร์เซโลนา' , 'pt': 'Barcelona' },
  'Bari': { 'ja': 'バーリ', 'ko': '바리', 'ru': 'Бари', 'th': 'บารี' , 'de': 'Bari' , 'pt': 'Bari' },
  'Barnet': { 'ar': 'بارنت', 'zh-CN': '巴尼特', 'zh-TW': '巴尼特', 'ru': 'Барнсли', 'de': 'Barnet' , 'ja': 'バーネット' , 'ko': '바넷' , 'th': 'บาร์เน็ต' , 'pt': 'Barnet' },
  'Barnsley': { 'ar': 'بارنسلي', 'zh-CN': '巴恩斯利', 'zh-TW': '巴恩斯利', 'ru': 'Барнсли', 'de': 'Barnsley' , 'ja': 'バーンズリー' , 'ko': '반슬리' , 'th': 'บาร์นสลีย์' , 'pt': 'Barnsley' },
  'Barracas Central': { 'es': 'Barracas Central', 'zh-CN': '巴拉卡斯中央', 'zh-TW': '巴拉卡斯中央', 'ru': 'Барракас Центральный', 'de': 'Barracas Central' , 'ja': 'バラカス セントラル' , 'ko': '바라카스 센트럴' , 'th': 'บาร์รากัส เซ็นทรัล' , 'pt': 'Barracas Central' },
  'Barrow': { 'ar': 'بارو', 'zh-CN': '巴罗', 'zh-TW': '巴羅', 'ru': 'Курган', 'de': 'Barrow' , 'ja': 'バロー' , 'ko': '손수레' , 'th': 'สาลี่' , 'pt': 'Barrow' },
  'BATE Borisov': { 'zh-CN': '鲍里索夫', 'zh-TW': '巴特', 'ru': 'Байер', 'de': 'BATE Borisov' , 'ja': 'BATEボリソフ' , 'ko': '바테 보리소프' , 'th': 'บาเต้ โบริซอฟ' , 'pt': 'BATE Borisov' },
  'Bayer Leverkusen': { 'es': 'Bayer Leverkusen', 'zh-CN': '勒沃库森', 'zh-TW': '勒沃庫森', 'ru': 'Бавария', 'de': 'Bayer Leverkusen' , 'ja': 'バイエル・レバークーゼン' , 'ko': '바이엘 레버쿠젠' , 'th': 'ไบเออร์ เลเวอร์คูเซ่น' , 'pt': 'Bayer Leverkusen' },
  'Bayern Munich': { 'es': 'Bayern de Múnich', 'zh-CN': '拜仁慕尼黑', 'zh-TW': '拜仁慕尼黑', 'ru': 'Бавария Мюнхен', 'de': 'Bayern Munich' , 'ja': 'バイエルン・ミュンヘン' , 'ko': '바이에른 뮌헨' , 'th': 'บาเยิร์น มิวนิค' , 'pt': 'Bayern Munich' },
  'Bayern Munich W': { 'zh-CN': '拜仁慕尼黑女足', 'zh-TW': '拜仁慕尼黑女足', 'ru': 'Бавария Мюнхен (Ж)', 'de': 'Bayern Munich W' , 'ja': 'バイエルン・ミュンヘン W' , 'ko': '바이에른 뮌헨 여' , 'th': 'บาเยิร์น มิวนิค W' , 'pt': 'Bayern Munich W' },
  'Bechem United': { 'ar': 'بيكيم يونايتد', 'zh-CN': '贝切姆联', 'zh-TW': '貝切姆聯', 'ru': 'Бечем Юнайтед', 'de': 'Bechem United' , 'ja': 'ベッヘム・ユナイテッド' , 'ko': '베헴 유나이티드' , 'th': 'เบเคม ยูไนเต็ด' , 'pt': 'Bechem United' },
  'Beerschot': { 'zh-CN': '比尔肖特', 'zh-TW': '比爾肖特', 'ru': 'Биршот', 'de': 'Beerschot' , 'ja': 'ベールスホット' , 'ko': '비어쇼트' , 'th': 'เบียร์ชอต' , 'pt': 'Beerschot' },
  'Beitar Jerusalem': { 'ar': 'بيتار القدس', 'zh-CN': '耶路撒冷贝塔', 'zh-TW': '耶路撒冷貝塔', 'ru': 'Бейтар Иерусалим', 'de': 'Beitar Jerusalem' , 'ja': 'ベイタル エルサレム' , 'ko': '베이타르 예루살렘' , 'th': 'เบต้า เยรูซาเลม' , 'pt': 'Beitar Jerusalem' },
  'Belgrano': { 'es': 'Belgrano', 'zh-CN': '贝尔格拉诺', 'zh-TW': '貝爾格拉諾', 'ru': 'Бельграно', 'de': 'Belgrano' , 'ja': 'ベルグラーノ' , 'ko': '벨그라노' , 'th': 'เบลกราโน' , 'pt': 'Belgrano' },
  'Birkirkara': { 'zh-CN': '比尔基卡拉', 'zh-TW': '比爾基卡拉', 'ru': 'Бирмингем', 'de': 'Birkirkara' , 'ja': 'ビルキルカラ' , 'ko': '비르키르카라' , 'th': 'บีร์กีร์การา' , 'pt': 'Birkirkara' },
  'Birmingham': { 'es': 'Birmingham', 'zh-CN': '伯明翰', 'zh-TW': '伯明翰', 'ru': 'Бирмингем', 'de': 'Birmingham' , 'ja': 'バーミンガム' , 'ko': '버밍엄' , 'th': 'เบอร์มิงแฮม' , 'pt': 'Birmingham' },
  'Birmingham City': { 'ar': 'برمنغهام سيتي', 'zh-CN': '伯明翰', 'zh-TW': '伯明翰', 'ru': 'Бирмингем Сити', 'de': 'Birmingham City' , 'ja': 'バーミンガムシティ' , 'ko': '버밍엄 시티' , 'th': 'เบอร์มิงแฮม ซิตี้' , 'pt': 'Birmingham City' },
  'BKMA': { 'ar': 'بي كي إم إيه', 'zh-CN': '中央陆军', 'zh-TW': '中央陸軍', 'ru': 'БКМА', 'de': 'BKMA' , 'ja': 'BKMA' , 'ko': 'BKMA' , 'th': 'กทม' , 'pt': 'BKMA' },
  'Black Leopards': { 'ar': 'بلاك ليوباردز', 'zh-CN': '黑豹', 'zh-TW': '黑豹', 'ru': 'Черные Леопарды', 'de': 'Black Leopards' , 'ja': '黒ヒョウ' , 'ko': '검은 표범' , 'th': 'เสือดาวดำ' , 'pt': 'Black Leopards' },
  'Blackburn': { 'es': 'Blackburn', 'zh-CN': '布莱克本', 'zh-TW': '布萊克本', 'ru': 'Блэкберн', 'de': 'Blackburn' , 'ja': 'ブラックバーン' , 'ko': '블랙번' , 'th': 'แบล็กเบิร์น' , 'pt': 'Blackburn' },
  'Blackburn Rovers': { 'ar': 'بلاكبيرن روفرز', 'zh-CN': '布莱克本流浪者', 'zh-TW': '布萊克本流浪者', 'ru': 'Блэкпул', 'de': 'Blackburn Rovers' , 'ja': 'ブラックバーン・ローバーズ' , 'ko': '블랙번 로버스' , 'th': 'แบล็คเบิร์น โรเวอร์ส' , 'pt': 'Blackburn Rovers' },
  'Blackpool': { 'ar': 'بلاكبول', 'zh-CN': '布莱克浦', 'zh-TW': '布萊克浦', 'ru': 'Блэкпул', 'de': 'Blackpool' , 'ja': 'ブラックプール' , 'ko': '블랙풀' , 'th': 'แบล็คพูล' , 'pt': 'Blackpool' },
  'Blaublitz Akita': { 'ar': 'بلاوبليتز أكيتا', 'zh-CN': '秋田蓝闪电', 'zh-TW': '秋田藍閃電', 'ru': 'Бока Хуниорс', 'de': 'Blaublitz Akita' , 'ja': 'ブラウブリッツ秋田' , 'ko': '블라우블리츠 아키타' , 'th': 'เบลาบลิทซ์ อาคิตะ' , 'pt': 'Blaublitz Akita' },
  'Bnei Sakhnin': { 'zh-CN': '萨赫宁', 'zh-TW': '薩赫寧', 'ru': 'Будё-Глимт', 'de': 'Bnei Sakhnin' , 'ja': 'ブネイ・サクニン' , 'ko': '브네이 사크닌' , 'th': 'บีไน สาคนิน' , 'pt': 'Bnei Sakhnin' },
  'Boca Juniors': { 'ja': 'ボカ・ジュニアーズ', 'ko': '보카 주니어스', 'ru': 'Бока Хуниорс', 'th': 'โบกายูนิออร์ส' , 'de': 'Boca Juniors' , 'pt': 'Boca Juniors' },
  'Bodo/Glimt': { 'ar': 'بودو/غليمت', 'zh-CN': '博德闪耀', 'zh-TW': '博德閃耀', 'ru': 'Бодо/Глимт', 'de': 'Bodo/Glimt' , 'ja': 'ボド/グリムト' , 'ko': '보도/글림트' , 'th': 'โบโด/กริมิต' , 'pt': 'Bodo/Glimt' },
  'Bodoe/Glimt': { 'de': 'Bodø/Glimt', 'es': 'Bodø/Glimt', 'fr': 'Bodø/Glimt', 'ja': 'ボデ/グリムト', 'ko': '보되/글림트',
 'pt': 'Bodø/Glimt', 'ru': 'Будё-Глимт', 'zh-CN': '博德闪耀', 'zh-TW': '博多格林特' , 'th': 'โบโด/กริตต์' },
  'Bologna': { 'ja': 'ボローニャ', 'ko': '볼로냐', 'ru': 'Болонья', 'th': 'โบโลญญา' , 'de': 'Bologna' , 'pt': 'Bologna' },
  'Bolton': { 'es': 'Bolton', 'zh-CN': '博尔顿', 'zh-TW': '博爾頓', 'ru': 'Болтон', 'de': 'Bolton' , 'ja': 'ボルトン' , 'ko': '볼튼' , 'th': 'โบลตัน' , 'pt': 'Bolton' },
  'Bolton Wanderers': { 'ar': 'بولتون واندررز', 'zh-CN': '博尔顿', 'zh-TW': '博爾頓', 'ru': 'Болтон Уондерерс', 'de': 'Bolton Wanderers' , 'ja': 'ボルトン・ワンダラーズ' , 'ko': '볼튼 원더러스' , 'th': 'โบลตัน วันเดอร์เรอร์ส' , 'pt': 'Bolton Wanderers' },
  'Borac Banja Luka': { 'ar': 'بوراتس بانيا لوكا', 'zh-CN': '巴尼亚卢卡战士', 'zh-TW': '巴尼亞盧卡戰士', 'ru': 'Боруссия Дортмунд', 'de': 'Borac Banja Luka' , 'ja': 'ボラック・バニャ・ルカ' , 'ko': '보라크 바냐 루카' , 'th': 'โบรัค บานยา ลูก้า' , 'pt': 'Borac Banja Luka' },
  'Borussia Dortmund': { 'de': 'Borussia Dortmund', 'es': 'Borussia Dortmund', 'fr': 'Borussia Dortmund', 'ja': 'ボルシア・ドルトムント', 'ko': '보루시아 도르트문트',
 'pt': 'Borussia Dortmund', 'ru': 'Боруссия Дортмунд', 'zh-CN': '多特蒙德', 'zh-TW': '多特蒙德' , 'th': 'โบรุสเซีย ดอร์ทมุนด์' },
  'Borussia Monchengladbach': { 'es': 'Mönchengladbach', 'zh-CN': '门兴', 'zh-TW': '慕遜加柏', 'ru': 'Боруссия Менхенгладбах', 'de': 'Borussia Monchengladbach' , 'ja': 'ボルシア・メンヒェングラートバッハ' , 'ko': '보루시아 묀헨글라트바흐' , 'th': 'โบรุสเซีย มึนเช่นกลัดบัค' , 'pt': 'Borussia Monchengladbach' },
  'Borussia Mönchengladbach': { 'ja': 'ボルシアMG', 'ko': '묀헨글라트바흐', 'ru': 'Боруссия Мёнхенгладбах', 'th': 'โบรุสซีอาเมินเชินกลัทบัค' , 'de': 'Borussia Mönchengladbach' , 'pt': 'Borussia Mönchengladbach' },
  'Boston River': { 'ar': 'بوسطن ريفر', 'ru': 'Река Бостон', 'de': 'Boston River' , 'ja': 'ボストン川' , 'ko': '보스턴 강' , 'th': 'แม่น้ำบอสตัน' , 'pt': 'Boston River' },
  'Botafogo FR': { 'ar': 'بوتافوغو', 'ru': 'Борнмут', 'de': 'Botafogo FR' , 'ja': 'ボタフォゴ FR' , 'ko': '프랑스 보타포고' , 'th': 'โบตาโฟโก้ FR' , 'pt': 'Botafogo FR' },
  'Botosani': { 'ar': 'بوتوشاني', 'zh-CN': '博托沙尼', 'zh-TW': '博托沙尼', 'ru': 'Ботошани', 'de': 'Botosani' , 'ja': 'ボトシャニ' , 'ko': '보토사니' , 'th': 'โบโตซานี' , 'pt': 'Botosani' },
  'Bournemouth': { 'ar': 'بورنموث', 'de': 'Bournemouth', 'es': 'Bournemouth', 'fr': 'Bournemouth', 'ja': 'ボーンマス', 'ko': '본머스',
 'pt': 'Bournemouth', 'ru': 'Борнмут', 'zh-CN': '伯恩茅斯', 'zh-TW': '伯恩茅斯' , 'th': 'บอร์นมัธ' },
  'Bradford': { 'es': 'Bradford', 'zh-CN': '布拉德福德', 'zh-TW': '布拉德福德', 'ru': 'Бранн', 'de': 'Bradford' , 'ja': 'ブラッドフォード' , 'ko': '브래드포드' , 'th': 'แบรดฟอร์ด' , 'pt': 'Bradford' },
  'Bradford City': { 'ar': 'برادفورد سيتي', 'zh-CN': '布拉德福德', 'zh-TW': '布拉德福德', 'ru': 'Брэдфорд Сити', 'de': 'Bradford City' , 'ja': 'ブラッドフォードシティ' , 'ko': '브래드포드 시티' , 'th': 'แบรดฟอร์ด ซิตี้' , 'pt': 'Bradford City' },
  'Braga': { 'es': 'Braga', 'zh-CN': '布拉加', 'zh-TW': '布拉加', 'ru': 'Брага', 'de': 'Braga' , 'ja': 'ブラガ' , 'ko': '브라가' , 'th': 'บรากา' , 'pt': 'Braga' },
  'Brann': { 'ar': 'بران', 'zh-CN': '布兰', 'zh-TW': '布蘭', 'ru': 'Бранн', 'de': 'Brann' , 'ja': 'ブラン' , 'ko': '브란' , 'th': 'แบรนน์' , 'pt': 'Brann' },
  'Bray Wanderers': { 'ar': 'بري واندررز', 'zh-CN': '布雷流浪者', 'zh-TW': '布雷流浪者', 'ru': 'Брентфорд', 'de': 'Bray Wanderers' , 'ja': 'ブレイ・ワンダラーズ' , 'ko': '브레이 원더러스' , 'th': 'เบรย์ วันเดอร์เรอร์ส' , 'pt': 'Bray Wanderers' },
  'Brentford': { 'ar': 'برينتفورد', 'de': 'Brentford', 'es': 'Brentford', 'fr': 'Brentford', 'ja': 'ブレントフォード', 'ko': '브렌트퍼드',
 'pt': 'Brentford', 'ru': 'Брентфорд', 'zh-CN': '布伦特福德', 'zh-TW': '布倫特福德' , 'th': 'เบรนท์ฟอร์ด' },
  'Brescia': { 'ja': 'ブレシア', 'ko': '브레시아', 'ru': 'Брешиа', 'th': 'เบรชา' , 'de': 'Brescia' , 'pt': 'Brescia' },
  'Brest': { 'ja': 'ブレスト', 'ko': '브레스트', 'ru': 'Брест', 'th': 'แบร็สต์' , 'de': 'Brest' , 'pt': 'Brest' },
  'Brighton': { 'ar': 'برايتون', 'de': 'Brighton', 'es': 'Brighton', 'fr': 'Brighton', 'ja': 'ブライトン', 'ko': '브라이턴',
 'pt': 'Brighton', 'ru': 'Брайтон', 'zh-CN': '布莱顿', 'zh-TW': '布萊頓' , 'th': 'ไบรท์ตัน' },
  'Brighton & Hove Albion': { 'ar': 'برايتون', 'de': 'Brighton', 'es': 'Brighton', 'fr': 'Brighton', 'ja': 'ブライトン', 'ko': '브라이턴',
 'pt': 'Brighton', 'ru': 'Брайтон', 'zh-CN': '布莱顿', 'zh-TW': '布萊頓' , 'th': 'ไบรท์ตัน แอนด์ โฮฟ อัลเบี้ยน' },
  'Bristol City': { 'ar': 'بريستول سيتي', 'zh-CN': '布里斯托城', 'zh-TW': '布里斯托城', 'ru': 'Бристоль Сити', 'de': 'Bristol City' , 'ja': 'ブリストルシティ' , 'ko': '브리스톨 시티' , 'th': 'บริสตอล ซิตี้' , 'pt': 'Bristol City' },
  'Bristol Rovers': { 'ar': 'بريستول روفرز', 'zh-CN': '布里斯托流浪者', 'zh-TW': '布里斯托流浪者', 'ru': 'Бристоль Роверс', 'de': 'Bristol Rovers' , 'ja': 'ブリストル・ローバーズ' , 'ko': '브리스톨 로버스' , 'th': 'บริสตอล โรเวอร์ส' , 'pt': 'Bristol Rovers' },
  'Broadbeach United': { 'ar': 'برودبيتش يونايتد', 'zh-CN': '布罗德海滩联', 'zh-TW': '布羅德海灘聯', 'ru': 'Брондбю', 'de': 'Broadbeach United' , 'ja': 'ブロードビーチ ユナイテッド' , 'ko': '브로드비치 유나이티드' , 'th': 'บรอดบีช ยูไนเต็ด' , 'pt': 'Broadbeach United' },
  'Broendby IF': { 'ar': 'بروندبي', 'zh-CN': '布隆德比', 'zh-TW': '布隆德比', 'ru': 'Брондбю ИФ', 'de': 'Broendby IF' , 'ja': 'ブレンビーIF' , 'ko': '브론드비 IF' , 'th': 'บรอนด์บี้ ไอเอฟ' , 'pt': 'Broendby IF' },
  'Broendby W': { 'ar': 'بروندبي (سيدات)', 'ru': 'Брондбю (Ж)', 'de': 'Broendby W' , 'ja': 'ブレンビー W' , 'ko': '브로엔비 여' , 'th': 'บรอนด์บี้ ดับเบิลยู' , 'pt': 'Broendby W' },
  'Bromley': { 'ar': 'بروملي', 'zh-CN': '布罗姆利', 'zh-TW': '布羅姆利', 'ru': 'Бромли', 'de': 'Bromley' , 'ja': 'ブロムリー' , 'ko': '브롬리' , 'th': 'บรอมลีย์' , 'pt': 'Bromley' },
  'Brunswick City': { 'ar': 'برونزويك سيتي', 'zh-CN': '布伦瑞克城', 'zh-TW': '布倫瑞克城', 'ru': 'Брансуик Сити', 'de': 'Brunswick City' , 'ja': 'ブランズウィックシティ' , 'ko': '브런즈윅 시티' , 'th': 'บรันสวิก ซิตี้' , 'pt': 'Brunswick City' },
  'Brunswick Juventus FC': { 'ar': 'برونزويك يوفنتوس', 'zh-CN': '布伦瑞克尤文图斯', 'zh-TW': '布倫瑞克尤文圖斯', 'ru': 'Брансуик Ювентус', 'de': 'Brunswick Juventus FC' , 'ja': 'ブランズウィック ユベントス FC' , 'ko': '브런즈윅 유벤투스 FC' , 'th': 'บรันสวิก ยูเวนตุส เอฟซี' , 'pt': 'Brunswick Juventus FC' },
  'Bucheon FC 1995': { 'ar': 'بوتشون 1995', 'zh-CN': '富川1995', 'zh-TW': '富川1995', 'ru': 'Пучхон 1995', 'de': 'Bucheon FC 1995' , 'ja': '富川FC 1995' , 'ko': '1995년 부천FC' , 'th': 'บูชอน เอฟซี 1995' , 'pt': 'Bucheon FC 1995' },
  'Budaiya': { 'ar': 'البديع', 'ru': 'Бернли', 'de': 'Budaiya' , 'ja': 'ぶだいや' , 'ko': '부다이야' , 'th': 'บูไดยา' , 'pt': 'Budaiya' },
  'Bulleen Lions': { 'ar': 'بولين لايونز', 'zh-CN': '布林狮', 'zh-TW': '布林獅', 'ru': 'Буллин Лайонс', 'de': 'Bulleen Lions' , 'ja': 'ブリーン・ライオンズ' , 'ko': '불린 라이온스' , 'th': 'บูลลีนไลออนส์' , 'pt': 'Bulleen Lions' },
  'Burnley': { 'ar': 'بيرنلي', 'de': 'Burnley', 'es': 'Burnley', 'fr': 'Burnley', 'ja': 'バーンリー', 'ko': '번리',
 'pt': 'Burnley', 'ru': 'Бернли', 'zh-CN': '伯恩利', 'zh-TW': '伯恩利' , 'th': 'เบิร์นลี่ย์' },
  'Burton': { 'es': 'Burton', 'zh-CN': '伯顿', 'zh-TW': '伯頓', 'ru': 'Бертон', 'de': 'Burton' , 'ja': 'バートン' , 'ko': '버튼' , 'th': 'เบอร์ตัน' , 'pt': 'Burton' },
  'Burton Albion': { 'ar': 'بيرتن ألبيون', 'zh-CN': '伯顿阿尔比恩', 'zh-TW': '伯頓阿爾比恩', 'ru': 'Бертон Альбион', 'de': 'Burton Albion' , 'ja': 'バートン アルビオン' , 'ko': '버튼 앨비언' , 'th': 'เบอร์ตัน อัลเบี้ยน' , 'pt': 'Burton Albion' },
  'Busan IPark': { 'zh-CN': '釜山偶像', 'zh-TW': '釜山偶像', 'ru': 'Пусан Ай-Парк', 'de': 'Busan IPark' , 'ja': '釜山アイパーク' , 'ko': '부산아이파크' , 'th': 'ปูซานไอปาร์ค' , 'pt': 'Busan IPark' },
  'BW Linz': { 'ar': 'بلو فايس لينتس', 'zh-CN': '林茨蓝白', 'zh-TW': '林茨藍白', 'ru': 'Кальяри', 'de': 'BW Linz' , 'ja': 'BW リンツ' , 'ko': 'BW 린츠' , 'th': 'บีดับเบิลยู ลินซ์' , 'pt': 'BW Linz' },
  'Cadiz': { 'ja': 'カディス', 'ko': '카디스', 'ru': 'Кадис', 'th': 'กาดิซ' , 'de': 'Cadiz' , 'pt': 'Cadiz' },
  'Cagliari': { 'ja': 'カリアリ', 'ko': '칼리아리', 'ru': 'Кальяри', 'th': 'กายารี' , 'de': 'Cagliari' , 'pt': 'Cagliari' },
  'Cambridge': { 'es': 'Cambridge', 'zh-CN': '剑桥联', 'zh-TW': '劍橋聯', 'ru': 'Кембридж', 'de': 'Cambridge' , 'ja': 'ケンブリッジ' , 'ko': '케임브리지' , 'th': 'เคมบริดจ์' , 'pt': 'Cambridge' },
  'Cambridge United': { 'ar': 'كامبريدج يونايتد', 'zh-CN': '剑桥联', 'zh-TW': '劍橋聯', 'ru': 'Кардифф', 'de': 'Cambridge United' , 'ja': 'ケンブリッジ・ユナイテッド' , 'ko': '케임브리지 유나이티드' , 'th': 'เคมบริดจ์ ยูไนเต็ด' , 'pt': 'Cambridge United' },
  'Cancun FC': { 'ar': 'كانكون', 'ru': 'Канкун ФК', 'de': 'Cancun FC' , 'ja': 'カンクンFC' , 'ko': '칸쿤 FC' , 'th': 'แคนคูน เอฟซี' , 'pt': 'Cancun FC' },
  'Caracas': { 'ar': 'كاراكاس', 'ru': 'Каракас', 'de': 'Caracas' , 'ja': 'カラカス' , 'ko': '카라카스' , 'th': 'คารากัส' , 'pt': 'Caracas' },
  'Cardiff': { 'es': 'Cardiff', 'zh-CN': '卡迪夫城', 'zh-TW': '卡迪夫城', 'ru': 'Кардифф', 'de': 'Cardiff' , 'ja': 'カーディフ' , 'ko': '카디프' , 'th': 'คาร์ดิฟฟ์' , 'pt': 'Cardiff' },
  'Cardiff City': { 'ar': 'كارديف سيتي', 'zh-CN': '卡迪夫城', 'zh-TW': '卡迪夫城', 'ru': 'Кардифф Сити', 'de': 'Cardiff City' , 'ja': 'カーディフ市' , 'ko': '카디프 시티' , 'th': 'คาร์ดิฟฟ์ ซิตี้' , 'pt': 'Cardiff City' },
  'Cavalier SC': { 'ar': 'كافاليير', 'ru': 'Кавалер СК', 'de': 'Cavalier SC' , 'ja': 'キャバリアSC' , 'ko': '카발리에 SC' , 'th': 'คาวาเลียร์ เอสซี' , 'pt': 'Cavalier SC' },
  'CD Recoleta': { 'ar': 'ريكوليتا', 'ru': 'компакт-диск Реколета', 'de': 'CD Recoleta' , 'ja': 'CDレコレータ' , 'ko': 'CD 레콜레타' , 'th': 'ซีดี รีโคเลต้า' , 'pt': 'CD Recoleta' },
  'CD Tepatitlan de Morelos': { 'ar': 'تيباتيتلان دي موريلوس', 'ru': 'CD Тепатитлан де Морелос', 'de': 'CD Tepatitlan de Morelos' , 'ja': 'CD テパティトラン デ モレロス' , 'ko': 'CD 테파티틀란 데 모렐로스' , 'th': 'ซีดี เตปาติตลาน เด โมเรลอส' , 'pt': 'CD Tepatitlan de Morelos' },
  'CD UT Cajamarca': { 'de': 'CD UT Cajamarca', 'es': 'CD UT Cajamarca', 'fr': 'CD UT Cajamarca', 'ja': 'CD UTカハマルカ', 'ko': 'CD UT 카하마르카',
 'pt': 'CD UT Cajamarca', 'ru': 'УТ Кахамарка', 'zh-CN': '卡哈马卡', 'zh-TW': '卡哈馬卡' , 'th': 'ซีดี ยูที กาฮามาร์ก้า' },
  'Celta Vigo': { 'ja': 'セルタ・ビーゴ', 'ko': '셀타 비고', 'ru': 'Сельта', 'th': 'เซลตาบีโก' , 'de': 'Celta Vigo' , 'pt': 'Celta Vigo' },
  'Celtic': { 'zh-CN': '凯尔特人', 'zh-TW': '塞爾提克', 'ru': 'Селтик', 'de': 'Celtic' , 'ja': 'ケルト' , 'ko': '켈트 말' , 'th': 'เซลติก' , 'pt': 'Celtic' },
  'Central Cordoba': { 'es': 'Central Córdoba', 'zh-CN': '科尔多瓦中央', 'zh-TW': '科爾多瓦中央', 'ru': 'Центральная Кордова', 'de': 'Central Cordoba' , 'ja': 'コルドバ中央部' , 'ko': '중앙 코르도바' , 'th': 'เซ็นทรัลคอร์โดบา' , 'pt': 'Central Cordoba' },
  'Ceramica Cleopatra': { 'zh-CN': '塞拉米卡克利奥帕特拉', 'zh-TW': '塞拉米卡克利奧帕特拉', 'ru': 'Керамика Клеопатра', 'de': 'Ceramica Cleopatra' , 'ja': 'セラミカ クレオパトラ' , 'ko': '세라미카 클레오파트라' , 'th': 'เซรามิกา คลีโอพัตรา' , 'pt': 'Ceramica Cleopatra' },
  'Cercle Brugge': { 'ar': 'سيركل بروج', 'zh-CN': '色格拉布鲁日', 'zh-TW': '色格拉布魯日', 'ru': 'Серкль Брюгге', 'de': 'Cercle Brugge' , 'ja': 'セルクル・ブルージュ' , 'ko': '세르클 브뤼헤' , 'th': 'เซอร์เคิล บรูช' , 'pt': 'Cercle Brugge' },
  'Cerezo Osaka': { 'es': 'Cerezo Osaka', 'zh-CN': '大阪樱花', 'zh-TW': '大阪櫻花', 'ru': 'Сересо Осака', 'de': 'Cerezo Osaka' , 'ja': 'セレッソ大阪' , 'ko': '세레소 오사카' , 'th': 'เซเรโซ โอซาก้า' , 'pt': 'Cerezo Osaka' },
  'CF Montreal': { 'zh-CN': '蒙特利尔CF', 'zh-TW': '蒙特婁CF', 'ru': 'CF Монреаль', 'de': 'CF Montreal' , 'ja': 'CF モントリオール' , 'ko': 'CF 몬트리올' , 'th': 'ซีเอฟ มอนทรีออล' , 'pt': 'CF Montreal' },
  'CF Sparta Selemet': { 'ar': 'سبارتا سيليميت', 'zh-CN': '斯巴达塞勒梅特', 'zh-TW': '斯巴達塞勒梅特', 'ru': 'КФ Спарта Селемет', 'de': 'CF Sparta Selemet' , 'ja': 'CF スパルタ セレメト' , 'ko': 'CF 스파르타 셀레메' , 'th': 'ซีเอฟ สปาร์ต้า เซเลเม็ต' , 'pt': 'CF Sparta Selemet' },
  'CFR Cluj': { 'ar': 'سي إف آر كلوج', 'zh-CN': '克卢日', 'zh-TW': '克盧日', 'ru': 'ЧФР Клуж', 'de': 'CFR Cluj' , 'ja': 'CFRクルージュ' , 'ko': 'CFR 클루지' , 'th': 'ซีเอฟอาร์ คลูช' , 'pt': 'CFR Cluj' },
  'Chanmari FC': { 'ar': 'تشانماري', 'zh-CN': '昌马里', 'zh-TW': '昌馬里', 'ru': 'Чанмари ФК', 'de': 'Chanmari FC' , 'ja': 'ちゃんまりFC' , 'ko': '찬마리 FC' , 'th': 'ชานมารี เอฟซี' , 'pt': 'Chanmari FC' },
  'Chapelton': { 'ar': 'شابيلتون', 'ru': 'Чапелтон', 'de': 'Chapelton' , 'ja': 'チャペルトン' , 'ko': '채플턴' , 'th': 'แชเปิลตัน' , 'pt': 'Chapelton' },
  'Charlton': { 'es': 'Charlton', 'zh-CN': '查尔顿竞技', 'zh-TW': '查爾頓競技', 'ru': 'Челси', 'de': 'Charlton' , 'ja': 'チャールトン' , 'ko': '찰튼' , 'th': 'ชาร์ลตัน' , 'pt': 'Charlton' },
  'Charlton Athletic': { 'ar': 'تشارلتون أثلتيك', 'zh-CN': '查尔顿竞技', 'zh-TW': '查爾頓競技', 'ru': 'Чарльтон Атлетик', 'de': 'Charlton Athletic' , 'ja': 'チャールトン・アスレティック' , 'ko': '찰튼 애슬레틱' , 'th': 'ชาร์ลตัน แอธเลติก' , 'pt': 'Charlton Athletic' },
  'Chelsea': { 'ar': 'تشيلسي', 'de': 'Chelsea', 'es': 'Chelsea', 'fr': 'Chelsea', 'ja': 'チェルシー', 'ko': '첼시',
 'pt': 'Chelsea', 'ru': 'Челси', 'zh-CN': '切尔西', 'zh-TW': '切爾西' , 'th': 'เชลซี' },
  'Cheltenham': { 'es': 'Cheltenham', 'zh-CN': '切尔滕纳姆', 'zh-TW': '切爾滕納姆', 'ru': 'Челтнем', 'de': 'Cheltenham' , 'ja': 'チェルトナム' , 'ko': '첼튼엄' , 'th': 'เชลท์แน่ม' , 'pt': 'Cheltenham' },
  'Cheltenham Town': { 'ar': 'شلتنهام تاون', 'zh-CN': '切尔滕纳姆', 'zh-TW': '切爾滕納姆', 'ru': 'Челтнем Таун', 'de': 'Cheltenham Town' , 'ja': 'チェルトナムタウン' , 'ko': '첼튼엄 타운' , 'th': 'เชลแน่ม ทาวน์' , 'pt': 'Cheltenham Town' },
  'Chesterfield': { 'ar': 'تشيسترفيلد', 'zh-CN': '切斯特菲尔德', 'zh-TW': '切斯特菲爾德', 'ru': 'Честерфилд', 'de': 'Chesterfield' , 'ja': 'チェスターフィールド' , 'ko': '침대 겸용 소파' , 'th': 'เชสเตอร์ฟิลด์' , 'pt': 'Chesterfield' },
  'Chivas': { 'es': 'Chivas', 'zh-CN': '芝华士', 'zh-TW': '芝華士', 'ru': 'Чивас', 'de': 'Chivas' , 'ja': 'シーバス' , 'ko': '시바스' , 'th': 'ชีวาส' , 'pt': 'Chivas' },
  'Chungnam Asan': { 'zh-CN': '忠南牙山', 'zh-TW': '忠南牙山', 'ru': 'Чунгнам Асан', 'de': 'Chungnam Asan' , 'ja': '忠南牙山' , 'ko': '충남아산' , 'th': 'ชุงนัม อาซาน' , 'pt': 'Chungnam Asan' },
  'Churchill Brothers': { 'zh-CN': '丘吉尔兄弟', 'zh-TW': '丘吉爾兄弟', 'ru': 'Братья Черчилль', 'de': 'Churchill Brothers' , 'ja': 'チャーチル兄弟' , 'ko': '처칠 형제' , 'th': 'พี่น้องเชอร์ชิล' , 'pt': 'Churchill Brothers' },
  'Cienciano': { 'de': 'Cienciano', 'es': 'Cienciano', 'fr': 'Cienciano', 'ja': 'シエンシアーノ', 'ko': '시엔시아노',
 'pt': 'Cienciano', 'ru': 'Сьенсиано', 'zh-CN': '西恩夏诺', 'zh-TW': '西恩夏諾' , 'th': 'เซียนเซียโน' },
  'Clermont': { 'ja': 'クレルモン', 'ko': '클레르몽', 'ru': 'Клермон', 'th': 'แกลร์มง' , 'de': 'Clermont' , 'pt': 'Clermont' },
  'Club America': { 'ja': 'クラブ・アメリカ', 'ko': '클루브 아메리카', 'ru': 'Америка', 'th': 'กลุบอาเมริกา' , 'de': 'Club America' , 'pt': 'Club America' },
  'Club Atletico Platense': { 'ar': 'بلاتينسي', 'ru': 'Клуб Атлетико Платенсе', 'de': 'Club Atletico Platense' , 'ja': 'クラブ アトレティコ プラテンセ' , 'ko': '클럽 아틀레티코 플라텐세' , 'th': 'คลับ แอตเลติโก พลาเตนเซ่' , 'pt': 'Club Atletico Platense' },
  'Club Brugge': { 'zh-CN': '布鲁日', 'zh-TW': '布魯日', 'ru': 'Клуб Брюгге', 'de': 'Club Brugge' , 'ja': 'クラブ ブルージュ' , 'ko': '클럽 브뤼헤' , 'th': 'คลับบรูซ' , 'pt': 'Club Brugge' },
  'Club Santos Laguna': { 'ar': 'سانتوس لاجونا', 'ru': 'Клуб Сантос Лагуна', 'de': 'Club Santos Laguna' , 'ja': 'クラブ サントス ラグーナ' , 'ko': '클럽 산토스 라구나' , 'th': 'คลับซานโตส ลากูน่า' , 'pt': 'Club Santos Laguna' },
  'Cobh Ramblers': { 'ar': 'كوف رامبلرز', 'zh-CN': '科夫漫步者', 'zh-TW': '科夫漫步者', 'ru': 'Коб Рамблерс', 'de': 'Cobh Ramblers' , 'ja': 'コーブ ランブラーズ' , 'ko': '코브 램블러스' , 'th': 'คอฟ แรมเบลอร์ส' , 'pt': 'Cobh Ramblers' },
  'Colchester': { 'es': 'Colchester', 'zh-CN': '科尔切斯特', 'zh-TW': '科爾切斯特', 'ru': 'Колчестер', 'de': 'Colchester' , 'ja': 'コルチェスター' , 'ko': '콜체스터' , 'th': 'โคลเชสเตอร์' , 'pt': 'Colchester' },
  'Colchester United': { 'ar': 'كولشستر يونايتد', 'zh-CN': '科尔切斯特联', 'zh-TW': '科爾切斯特聯', 'ru': 'Колчестер Юнайтед', 'de': 'Colchester United' , 'ja': 'コルチェスター・ユナイテッド' , 'ko': '콜체스터 유나이티드' , 'th': 'โคลเชสเตอร์ ยูไนเต็ด' , 'pt': 'Colchester United' },
  'Colon': { 'es': 'Colón', 'zh-CN': '科隆竞技', 'zh-TW': '科隆競技', 'ru': 'Комо', 'de': 'Colon' , 'ja': '結腸' , 'ko': '콜론' , 'th': 'ลำไส้ใหญ่' , 'pt': 'Colon' },
  'Comerciantes Unidos': { 'ar': 'كوميرسيانتيس أونيدوس', 'zh-CN': '商人联', 'zh-TW': '商人聯', 'ru': 'Коринтианс', 'de': 'Comerciantes Unidos' , 'ja': 'コメルシエンテス ウニドス' , 'ko': '코메르시안테스 우니도스' , 'th': 'Comerciantes Unidos' , 'pt': 'Comerciantes Unidos' },
  'Como': { 'ja': 'コモ', 'ko': '코모', 'ru': 'Комо', 'th': 'โกโม' , 'de': 'Como' , 'pt': 'Como' },
  'Consadole Sapporo': { 'ar': 'كونسادول سابورو', 'zh-CN': '札幌冈萨多', 'zh-TW': '札幌岡薩多', 'ru': 'Консадоле Саппоро', 'de': 'Consadole Sapporo' , 'ja': 'コンサドーレ札幌' , 'ko': '콘사도레 삿포로' , 'th': 'คอนซาโดล ซัปโปโร' , 'pt': 'Consadole Sapporo' },
  'Coquimbo Unido': { 'ar': 'كوكيمبو أونيدو', 'ru': 'Кокимбо Унидо', 'de': 'Coquimbo Unido' , 'ja': 'コキンボ ウニド' , 'ko': '코킴보 유니도' , 'th': 'โกกีมโบ ยูนิโด้' , 'pt': 'Coquimbo Unido' },
  'Corinthians': { 'ja': 'コリンチャンス', 'ko': '코린치안스', 'ru': 'Коринтианс', 'th': 'โกริงชังส์' , 'de': 'Corinthians' , 'pt': 'Corinthians' },
  'Cork City': { 'ar': 'كورك سيتي', 'zh-CN': '科克城', 'zh-TW': '科克城', 'ru': 'Корк Сити', 'de': 'Cork City' , 'ja': 'コークシティ' , 'ko': '코크 시티' , 'th': 'เมืองคอร์ก' , 'pt': 'Cork City' },
  'Coventry': { 'es': 'Coventry', 'zh-CN': '考文垂', 'zh-TW': '考文垂', 'ru': 'Ковентри', 'de': 'Coventry' , 'ja': 'コベントリー' , 'ko': '코번트리' , 'th': 'โคเวนทรี' , 'pt': 'Coventry' },
  'Coventry City': { 'ar': 'كوفنتري سيتي', 'zh-CN': '考文垂', 'zh-TW': '考文垂', 'ru': 'Ковентри Сити', 'de': 'Coventry City' , 'ja': 'コベントリー市' , 'ko': '코번트리 시티' , 'th': 'เมืองโคเวนทรี' , 'pt': 'Coventry City' },
  'Crawley': { 'es': 'Crawley', 'zh-CN': '克劳利', 'zh-TW': '克勞利', 'ru': 'Кроули', 'de': 'Crawley' , 'ja': 'クローリー' , 'ko': '크롤리' , 'th': 'ครอว์ลีย์' , 'pt': 'Crawley' },
  'Crawley Town': { 'ar': 'كراولي تاون', 'zh-CN': '克劳利镇', 'zh-TW': '克勞利鎮', 'ru': 'Кроули Таун', 'de': 'Crawley Town' , 'ja': 'クローリータウン' , 'ko': '크롤리 타운' , 'th': 'ครอว์ลีย์ ทาวน์' , 'pt': 'Crawley Town' },
  'Cremonese': { 'ja': 'クレモネーゼ', 'ko': '크레모네세', 'ru': 'Кремонезе', 'th': 'เกรโมเนเซ' , 'de': 'Cremonese' , 'pt': 'Cremonese' },
  'Crewe': { 'es': 'Crewe', 'zh-CN': '克鲁', 'zh-TW': '克魯', 'ru': 'Крус Асуль', 'de': 'Crewe' , 'ja': 'クルー' , 'ko': '크루' , 'th': 'ครูว์' , 'pt': 'Crewe' },
  'Crewe Alexandra': { 'ar': 'كرو ألكساندرا', 'zh-CN': '克鲁', 'zh-TW': '克魯亞歷山大', 'ru': 'Крю Александра', 'de': 'Crewe Alexandra' , 'ja': 'クルー・アレクサンドラ' , 'ko': '크루 알렉산드라' , 'th': 'ครูว์ อเล็กซานดรา' , 'pt': 'Crewe Alexandra' },
  'Crusaders': { 'ar': 'كروسيدرز', 'zh-CN': '十字军', 'zh-TW': '十字軍', 'ru': 'Кристал Пэлас', 'de': 'Crusaders' , 'ja': '十字軍' , 'ko': '십자군' , 'th': 'ครูเซเดอร์' , 'pt': 'Crusaders' },
  'Cruz Azul': { 'ja': 'クルス・アスル', 'ko': '크루스 아술', 'ru': 'Крус Асуль', 'th': 'กรุซอาซุล' , 'de': 'Cruz Azul' , 'pt': 'Cruz Azul' },
  'Cruzeiro': { 'ar': 'كروزيرو', 'ru': 'Крузейро', 'de': 'Cruzeiro' , 'ja': 'クルゼイロ' , 'ko': '크루제이로' , 'th': 'ครูเซโร่' , 'pt': 'Cruzeiro' },
  'Crystal Palace': { 'ar': 'كريستال بالاس', 'de': 'Crystal Palace', 'es': 'Crystal Palace', 'fr': 'Crystal Palace', 'ja': 'クリスタル・パレス', 'ko': '크리스탈 팰리스',
 'pt': 'Crystal Palace', 'ru': 'Кристал Пэлас', 'zh-CN': '水晶宫', 'zh-TW': '水晶宮' , 'th': 'คริสตัล พาเลซ' },
  'CS Petrocub': { 'de': 'CS Petrocub', 'es': 'CS Petrocub', 'fr': 'CS Petrocub', 'ja': 'CSペトロクブ', 'ko': 'CS 페트로쿠브',
 'pt': 'CS Petrocub', 'ru': 'Петрокуб', 'zh-CN': '佩特罗古', 'zh-TW': '佩特羅古' , 'th': 'ซีเอส เปโตรคิวบ์' },
  'CS Universitatea Craiova': { 'ar': 'يونيفرسيتاتيا كرايوفا', 'ru': 'CS Университет Крайова', 'de': 'CS Universitatea Craiova' , 'ja': 'CS クラヨバ大学' , 'ko': 'CS Universitatea Craiova' , 'th': 'ซีเอส ยูนิเวอร์ซิตาเตอา ไครโอวา' , 'pt': 'CS Universitatea Craiova' },
  'Cukaricki': { 'zh-CN': '丘卡里奇基', 'zh-TW': '丘卡里奇基', 'ru': 'Чукарицкий', 'de': 'Cukaricki' , 'ja': 'クカリツキ' , 'ko': '추카리츠키' , 'th': 'คูคาริกกี' , 'pt': 'Cukaricki' },
  'Cumberland United': { 'ar': 'كمبرلاند يونايتد', 'zh-CN': '坎伯兰联', 'zh-TW': '坎伯蘭聯', 'ru': 'Камберленд Юнайтед', 'de': 'Cumberland United' , 'ja': 'カンバーランド・ユナイテッド' , 'ko': '컴벌랜드 유나이티드' , 'th': 'คัมเบอร์แลนด์ ยูไนเต็ด' , 'pt': 'Cumberland United' },
  'Cusco FC': { 'ar': 'كوسكو', 'ru': 'Куско ФК', 'de': 'Cusco FC' , 'ja': 'クスコFC' , 'ko': '쿠스코 FC' , 'th': 'กุสโก เอฟซี' , 'pt': 'Cusco FC' },
  'DAC 1904 Dunajska Streda': { 'ar': 'دونيسكا ستريدا', 'zh-CN': '多瑙斯特雷达', 'zh-TW': '多瑙斯特雷達', 'ru': 'DAC 1904 Дунайска Стреда', 'de': 'DAC 1904 Dunajska Streda' , 'ja': 'DAC 1904 ドゥナイスカ ストレダ' , 'ko': 'DAC 1904 두나이스카 스트레다' , 'th': 'ดีเอซี 1904 ดูนาจสก้า สเตรดา' , 'pt': 'DAC 1904 Dunajska Streda' },
  'Dacia Buiucani': { 'zh-CN': '达契亚布尤卡尼', 'zh-TW': '達契亞布尤卡尼', 'ru': 'Дачия Буюкань', 'de': 'Dacia Buiucani' , 'ja': 'ダチア・ブイカニ' , 'ko': '다키아 부이우카니' , 'th': 'ดาเซีย บุยอูคานี่' , 'pt': 'Dacia Buiucani' },
  'Daejeon Citizen': { 'ar': 'دايجون سيتيزن', 'zh-CN': '大田市民', 'zh-TW': '大田市民', 'ru': 'Тэджон Ситизен', 'de': 'Daejeon Citizen' , 'ja': '大田市民' , 'ko': '대전시민' , 'th': 'พลเมืองแทจอน' , 'pt': 'Daejeon Citizen' },
  'Defensa y Justicia': { 'es': 'Defensa y Justicia', 'zh-CN': '国防与司法', 'zh-TW': '防衛者', 'ru': 'Дерби Каунти', 'de': 'Defensa y Justicia' , 'ja': 'ディフェンサ・イ・フスティシア' , 'ko': '디펜사 이 저스티시아' , 'th': 'ดีเฟนซา และ จัสติเซีย' , 'pt': 'Defensa y Justicia' },
  'Dempo SC': { 'ar': 'ديمبو', 'zh-CN': '丹波', 'zh-TW': '丹波', 'ru': 'Демпо СК', 'de': 'Dempo SC' , 'ja': 'デンポSC' , 'ko': '뎀포SC' , 'th': 'เดมโป เอสซี' , 'pt': 'Dempo SC' },
  'Deportivo Cuenca': { 'ar': 'ديبورتيفو كوينكا', 'ru': 'Депортиво Куэнка', 'de': 'Deportivo Cuenca' , 'ja': 'デポルティボ クエンカ' , 'ko': '데포르티보 쿠엥카' , 'th': 'เดปอร์ติโบ เควงก้า' , 'pt': 'Deportivo Cuenca' },
  'Deportivo Riestra': { 'ar': 'ديبورتيفو ريسترا', 'ru': 'Депортиво Риестра', 'de': 'Deportivo Riestra' , 'ja': 'デポルティーボ・リエストラ' , 'ko': '데포르티보 리에스트라' , 'th': 'เดปอร์ติโบ ริเอสตรา' , 'pt': 'Deportivo Riestra' },
  'Derby': { 'es': 'Derby', 'zh-CN': '德比郡', 'zh-TW': '德比郡', 'ru': 'дерби', 'de': 'Derby' , 'ja': 'ダービー' , 'ko': '더비' , 'th': 'ดาร์บี้' , 'pt': 'Derby' },
  'Derby County': { 'ar': 'ديربي كاونتي', 'zh-CN': '德比郡', 'zh-TW': '德比郡', 'ru': 'Дерби Каунти', 'de': 'Derby County' , 'ja': 'ダービー郡' , 'ko': '더비 카운티' , 'th': 'ดาร์บี้ เคาน์ตี้' , 'pt': 'Derby County' },
  'Dinamo Bucuresti': { 'de': 'Dinamo Bukarest', 'es': 'Dinamo Bucarest', 'fr': 'Dinamo Bucarest', 'ja': 'ディナモ・ブカレスト', 'ko': '디나모 부쿠레슈티',
 'pt': 'Dinamo Bucareste', 'ru': 'Динамо Бухарест', 'zh-CN': '布加勒斯特迪纳摩', 'zh-TW': '布加勒斯特迪納摩' , 'th': 'ดินาโม บูคาเรสต์' },
  'Dinamo Jug': { 'ar': 'دينامو يوغ', 'zh-CN': '迪纳摩南', 'zh-TW': '迪納摩南', 'ru': 'Динамо Кувшин', 'de': 'Dinamo Jug' , 'ja': 'ディナモジャグ' , 'ko': '디나모 저그' , 'th': 'เหยือกไดนาโม' , 'pt': 'Dinamo Jug' },
  'Dinamo Minsk': { 'zh-CN': '明斯克迪纳摩', 'zh-TW': '明斯克戴拿模', 'ru': 'Динамо Минск', 'de': 'Dinamo Minsk' , 'ja': 'ディナモ・ミンスク' , 'ko': '디나모 민스크' , 'th': 'ดินาโม มินสค์' , 'pt': 'Dinamo Minsk' },
  'Diyala': { 'de': 'Diyala', 'es': 'Diyala', 'fr': 'Diyala', 'ja': 'ディヤラ', 'ko': '디얄라',
 'pt': 'Diyala', 'ru': 'Дияла', 'zh-CN': '迪亚拉', 'zh-TW': '迪亞拉' , 'th': 'ดิยาลา' },
  'Dnepr Mogilev': { 'ar': 'دنيبر موغيليف', 'zh-CN': '莫吉廖夫第聂伯', 'zh-TW': '莫吉廖夫第聶伯', 'ru': 'Днепр Могилев', 'de': 'Dnepr Mogilev' , 'ja': 'ドニエプル・モギレフ' , 'ko': '드네프르 모길레프' , 'th': 'ดเนปร์ โมกิเลฟ' , 'pt': 'Dnepr Mogilev' },
  'Dodoma Jiji FC': { 'ar': 'دودوما جيجي', 'zh-CN': '多多马城', 'zh-TW': '多多馬城', 'ru': 'Додома Джиджи ФК', 'de': 'Dodoma Jiji FC' , 'ja': 'ドドマ・ジジFC' , 'ko': '도도마 지지 FC' , 'th': 'โดโดมา จิจิ เอฟซี' , 'pt': 'Dodoma Jiji FC' },
  'Doncaster': { 'es': 'Doncaster', 'zh-CN': '唐卡斯特', 'zh-TW': '唐卡斯特', 'ru': 'Донкастер', 'de': 'Doncaster' , 'ja': 'ドンカスター' , 'ko': '돈캐스터' , 'th': 'ดอนคาสเตอร์' , 'pt': 'Doncaster' },
  'Doncaster Rovers': { 'ar': 'دونكاستر روفرز', 'zh-CN': '唐卡斯特流浪者', 'zh-TW': '唐卡斯特流浪者', 'ru': 'Донкастер Роверс', 'de': 'Doncaster Rovers' , 'ja': 'ドンカスター・ローバーズ' , 'ko': '돈캐스터 로버스' , 'th': 'ดอนคาสเตอร์ โรเวอร์ส' , 'pt': 'Doncaster Rovers' },
  'DPMM': { 'zh-CN': '文莱DPMM', 'zh-TW': '汶萊DPMM', 'ru': 'ДПММ', 'de': 'DPMM' , 'ja': 'DPMM' , 'ko': 'DPMM' , 'th': 'ดีพีเอ็มเอ็ม' , 'pt': 'DPMM' },
  'Duhok': { 'ar': 'دهوك', 'zh-CN': '杜胡克', 'zh-TW': '杜胡克', 'ru': 'Духок', 'de': 'Duhok' , 'ja': 'ドホーク' , 'ko': '두호크' , 'th': 'ดูฮอก' , 'pt': 'Duhok' },
  'Dukla Banska Bystrica': { 'zh-CN': '班斯卡比斯特里察', 'zh-TW': '班斯卡比斯特里察', 'ru': 'Дукла Банска-Бистрица', 'de': 'Dukla Banska Bystrica' , 'ja': 'ドゥクラ バンスカ ビストリツァ' , 'ko': '두클라 반스카 비스트리차' , 'th': 'ดูคลา บานสกา บิสตริกา' , 'pt': 'Dukla Banska Bystrica' },
  'Dunbeholden': { 'ar': 'دونبيهولدين', 'ru': 'Данбехолден', 'de': 'Dunbeholden' , 'ja': 'ダンベホルデン' , 'ko': '던베홀덴' , 'th': 'ดันเบโฮลเดน' , 'pt': 'Dunbeholden' },
  'Dundee FC': { 'ar': 'دندي', 'zh-CN': '邓迪FC', 'zh-TW': '鄧迪FC', 'ru': 'Данди ФК', 'de': 'Dundee FC' , 'ja': 'ダンディーFC' , 'ko': '던디 FC' , 'th': 'ดันดี เอฟซี' , 'pt': 'Dundee FC' },
  'Dundee United': { 'ar': 'دندي يونايتد', 'zh-CN': '邓迪联', 'zh-TW': '鄧迪聯', 'ru': 'Динамо Киев', 'de': 'Dundee United' , 'ja': 'ダンディー・ユナイテッド' , 'ko': '던디 유나이티드' , 'th': 'ดันดี ยูไนเต็ด' , 'pt': 'Dundee United' },
  'Dunfermline Athletic': { 'ar': 'دنفرملين أثلتيك', 'zh-CN': '邓弗姆林', 'zh-TW': '鄧弗姆林', 'ru': 'Данфермлин Атлетик', 'de': 'Dunfermline Athletic' , 'ja': 'ダンファームリン アスレチック' , 'ko': '던펌린 애슬레틱' , 'th': 'ดันเฟิร์มลิน แอธเลติก' , 'pt': 'Dunfermline Athletic' },
  'Dynamo Dresden': { 'ar': 'دينامو دريسدن', 'zh-CN': '德累斯顿迪纳摩', 'zh-TW': '德勒斯登迪納摩', 'ru': 'Динамо Дрезден', 'de': 'Dynamo Dresden' , 'ja': 'ディナモ ドレスデン' , 'ko': '디나모 드레스덴' , 'th': 'ดินาโม เดรสเดน' , 'pt': 'Dynamo Dresden' },
  'Dynamo Kyiv': { 'ja': 'ディナモ・キーウ', 'ko': '디나모 키이우', 'ru': 'Динамо Киев', 'th': 'ดือนามอกือยิว' , 'de': 'Dynamo Kyiv' , 'pt': 'Dynamo Kyiv' },
  'Eastern': { 'zh-CN': '东方', 'zh-TW': '東方', 'ru': 'Восточный', 'de': 'Eastern' , 'ja': '東部' , 'ko': '동부' , 'th': 'ตะวันออก' , 'pt': 'Eastern' },
  'Eastern United FC': { 'ar': 'إيسترن يونايتد', 'zh-CN': '东区联', 'zh-TW': '東區聯', 'ru': 'Истерн Юнайтед', 'de': 'Eastern United FC' , 'ja': 'イースタン・ユナイテッドFC' , 'ko': '이스턴 유나이티드 FC' , 'th': 'อีสเทิร์น ยูไนเต็ด เอฟซี' , 'pt': 'Eastern United FC' },
  'Ehime FC': { 'ar': 'إهيمه', 'zh-CN': '爱媛FC', 'zh-TW': '愛媛FC', 'ru': 'Эхиме ФК', 'de': 'Ehime FC' , 'ja': '愛媛FC' , 'ko': '에히메 FC' , 'th': 'เอฮิเมะ เอฟซี' , 'pt': 'Ehime FC' },
  'Eintracht Braunschweig': { 'ar': 'آينتراخت براونشفايغ', 'zh-CN': '不伦瑞克', 'zh-TW': '布倫瑞克', 'ru': 'Айнтрахт Брауншвейг', 'de': 'Eintracht Braunschweig' , 'ja': 'アイントラハト ブラウンシュヴァイク' , 'ko': '아인트라흐트 브라운슈바이크' , 'th': 'ไอน์ทรัค เบราน์ชไวก์' , 'pt': 'Eintracht Braunschweig' },
  'Eintracht Frankfurt': { 'ar': 'آينتراخت فرانكفورت', 'zh-CN': '法兰克福', 'zh-TW': '法蘭克福', 'ru': 'Айнтрахт Франкфурт', 'de': 'Eintracht Frankfurt' , 'ja': 'アイントラハト フランクフルト' , 'ko': '아인트라흐트 프랑크푸르트' , 'th': 'ไอน์ทรัค แฟร้งค์เฟิร์ต' , 'pt': 'Eintracht Frankfurt' },
  'El Geish': { 'ar': 'طلائع الجيش', 'ru': 'Эль Гейш', 'de': 'El Geish' , 'ja': 'エル・ゲイシュ' , 'ko': '엘 게이쉬' , 'th': 'เอล เกอิช' , 'pt': 'El Geish' },
  'El Gouna': { 'zh-CN': '古纳', 'zh-TW': '古納', 'ru': 'Эль Гуна', 'de': 'El Gouna' , 'ja': 'エル・グウナ' , 'ko': '엘 구나' , 'th': 'เอล กูน่า' , 'pt': 'El Gouna' },
  'El Gounah': { 'ar': 'الجونة', 'ru': 'Эль-Гуна', 'de': 'El Gounah' , 'ja': 'エル・グナ' , 'ko': '엘 구나' , 'th': 'เอล กูนาห์' , 'pt': 'El Gounah' },
  'El Zamalek': { 'ar': 'الزمالك', 'zh-CN': '扎马雷克', 'zh-TW': '扎馬雷克', 'ru': 'Эль-Замалек', 'de': 'El Zamalek' , 'ja': 'エル・ザマレク' , 'ko': '엘 자말렉' , 'th': 'เอล ซามาเล็ค' , 'pt': 'El Zamalek' },
  'Elche': { 'ja': 'エルチェ', 'ko': '엘체', 'ru': 'Эльче', 'th': 'เอลเช' , 'de': 'Elche' , 'pt': 'Elche' },
  'Eleven Wonders': { 'ar': 'إليفين وندرز', 'zh-CN': '十一奇迹', 'zh-TW': '十一奇蹟', 'ru': 'Одиннадцать чудес', 'de': 'Eleven Wonders' , 'ja': '11の不思議' , 'ko': '11가지 불가사의' , 'th': 'สิบเอ็ดสิ่งมหัศจรรย์' , 'pt': 'Eleven Wonders' },
  'Eltham Redbacks': { 'ar': 'إلتهام ريدباكس', 'zh-CN': '埃尔瑟姆红背', 'zh-TW': '埃爾瑟姆紅背', 'ru': 'Элтэм Редбэкс', 'de': 'Eltham Redbacks' , 'ja': 'エルサム・セアカゴケ' , 'ko': '엘탐 레드백스' , 'th': 'เอลแธม เรดแบ็คส์' , 'pt': 'Eltham Redbacks' },
  'Empoli': { 'ja': 'エンポリ', 'ko': '엠폴리', 'ru': 'Эмполи', 'th': 'เอมโปลี' , 'de': 'Empoli' , 'pt': 'Empoli' },
  'Enosis Paralimni': { 'zh-CN': '帕拉利姆尼联合', 'zh-TW': '帕拉利姆尼聯合', 'ru': 'Энозис Паралимни', 'de': 'Enosis Paralimni' , 'ja': 'エノシス パラリムニ' , 'ko': '에노시스 파라림니' , 'th': 'เอโนซิส พาราลิมนี' , 'pt': 'Enosis Paralimni' },
  'ENPPI': { 'ar': 'إنبي', 'zh-CN': '恩比', 'zh-TW': '恩比', 'ru': 'ЕНППИ', 'de': 'ENPPI' , 'ja': 'エンピ' , 'ko': '엔피' , 'th': 'เอ็นพีพี' , 'pt': 'ENPPI' },
  'Epicentr Kamianets-Podilskyi': { 'ar': 'إبيسينتر كاميانيتس بوديلسكي', 'ru': 'Эпицентр Каменец-Подольский', 'de': 'Epicentr Kamianets-Podilskyi' , 'ja': 'カミアネツ・ポジリシキー震源地' , 'ko': '진원지 Kamianets-Podilskyi' , 'th': 'จุดศูนย์กลาง Kamianets-Podilskyi' , 'pt': 'Epicentr Kamianets-Podilskyi' },
  'Erbil': { 'ar': 'أربيل', 'zh-CN': '埃尔比勒', 'zh-TW': '埃爾比勒', 'ru': 'Эрбиль', 'de': 'Erbil' , 'ja': 'アルビル' , 'ko': '아르빌' , 'th': 'เอร์บิล' , 'pt': 'Erbil' },
  'Espanol': { 'es': 'Espanyol', 'zh-CN': '西班牙人', 'zh-TW': '西班牙人', 'ru': 'испанский', 'de': 'Espanol' , 'ja': 'スペイン語' , 'ko': '에스파뇰' , 'th': 'สเปน' , 'pt': 'Espanol' },
  'Espanyol': { 'ja': 'エスパニョール', 'ko': '에스파뇰', 'ru': 'Эспаньол', 'th': 'อัสปัญญ็อล' , 'de': 'Espanyol' , 'pt': 'Espanyol' },
  'Estudiantes': { 'es': 'Estudiantes', 'zh-CN': '大学生队', 'zh-TW': '大學生隊', 'ru': 'Эвертон', 'de': 'Estudiantes' , 'ja': 'エストゥディアンテス' , 'ko': '에스투디안테스' , 'th': 'นักเรียน' , 'pt': 'Estudiantes' },
  'Ethnikos Achnas': { 'ar': 'إثنيكوس أكناس', 'zh-CN': '艾治拿斯', 'zh-TW': '艾治拿斯', 'ru': 'Этникос Ахнас', 'de': 'Ethnikos Achnas' , 'ja': 'エスニコス・アクナス' , 'ko': '에트니코스 아크나스' , 'th': 'เอธนิโกส อัคนาส' , 'pt': 'Ethnikos Achnas' },
  'Everton': { 'ar': 'إيفرتون', 'de': 'Everton', 'es': 'Everton', 'fr': 'Everton', 'ja': 'エヴァートン', 'ko': '에버턴',
 'pt': 'Everton', 'ru': 'Эвертон', 'zh-CN': '埃弗顿', 'zh-TW': '艾佛頓' , 'th': 'เอฟเวอร์ตัน' },
  'Exeter': { 'es': 'Exeter', 'zh-CN': '埃克塞特城', 'zh-TW': '埃克塞特城', 'ru': 'Эксетер', 'de': 'Exeter' , 'ja': 'エクセター' , 'ko': '엑서터' , 'th': 'เอ็กซีเตอร์' , 'pt': 'Exeter' },
  'Exeter City': { 'ar': 'إكستر سيتي', 'zh-CN': '埃克塞特城', 'zh-TW': '埃克塞特城', 'ru': 'Эксетер Сити', 'de': 'Exeter City' , 'ja': 'エクセターシティ' , 'ko': '엑서터 시티' , 'th': 'เอ็กเซเตอร์ ซิตี้' , 'pt': 'Exeter City' },
  'Fagiano Fukuoka': { 'es': 'Avispa Fukuoka', 'zh-CN': '福冈黄蜂', 'zh-TW': '福岡黃蜂', 'ru': 'Фаджиано Фукуока', 'de': 'Fagiano Fukuoka' , 'ja': 'ファジアーノ福岡' , 'ko': '파지아노 후쿠오카' , 'th': 'ฟาเจียโน ฟุกุโอกะ' , 'pt': 'Fagiano Fukuoka' },
  'Fagiano Okayama': { 'es': 'Fagiano Okayama', 'zh-CN': '冈山绿雉', 'zh-TW': '岡山綠雉', 'ru': 'Фаджиано Окаяма', 'de': 'Fagiano Okayama' , 'ja': 'ファジアーノ岡山' , 'ko': '파지아노 오카야마' , 'th': 'ฟาเจียโน โอคายาม่า' , 'pt': 'Fagiano Okayama' },
  'Falkirk': { 'ar': 'فالكيرك', 'zh-CN': '福尔柯克', 'zh-TW': '福爾柯克', 'ru': 'Фалкирк', 'de': 'Falkirk' , 'ja': 'フォルカーク' , 'ko': '폴커크' , 'th': 'ฟัลเคิร์ก' , 'pt': 'Falkirk' },
  'FAP Priboj': { 'ar': 'فاب بريبوي', 'zh-CN': '普里博伊', 'zh-TW': '普里博伊', 'ru': 'Кёльн', 'de': 'FAP Priboj' , 'ja': 'FAP プリボジ' , 'ko': 'FAP 프리보이' , 'th': 'สภาวิชาชีพบัญชีปริโบจ' , 'pt': 'FAP Priboj' },
  'FC Alashkert': { 'ar': 'ألاشكيرت', 'zh-CN': '阿拉什克特', 'zh-TW': '阿拉什克特', 'ru': 'ФК Алашкерт', 'de': 'FC Alashkert' , 'ja': 'FCアラシケルト' , 'ko': 'FC 알라쉬케르트' , 'th': 'เอฟซี อลาชเคิร์ต' , 'pt': 'FC Alashkert' },
  'FC Anyang': { 'ar': 'إف سي أنيانغ', 'zh-CN': '安养FC', 'zh-TW': '安養FC', 'ru': 'ФК Аньян', 'de': 'FC Anyang' , 'ja': 'FC安養' , 'ko': 'FC안양' , 'th': 'เอฟซี อันยาง' , 'pt': 'FC Anyang' },
  'FC Ashdod': { 'ar': 'أشدود', 'ru': 'ФК Ашдод', 'de': 'FC Ashdod' , 'ja': 'FC アシュドッド' , 'ko': 'FC 아슈도드' , 'th': 'เอฟซี แอชดอด' , 'pt': 'FC Ashdod' },
  'FC Baranovichi': { 'ar': 'بارانوفيتشي', 'zh-CN': '巴拉诺维奇', 'zh-TW': '巴拉諾維奇', 'ru': 'ФК Барановичи', 'de': 'FC Baranovichi' , 'ja': 'FCバラノヴィチ' , 'ko': 'FC 바라노비치' , 'th': 'เอฟซี บาราโนวิชี่' , 'pt': 'FC Baranovichi' },
  'FC Cajamarca': { 'ar': 'كاخاماركا', 'zh-CN': '卡哈马卡', 'zh-TW': '卡哈馬卡', 'ru': 'Копенгаген', 'de': 'FC Cajamarca' , 'ja': 'FC カハマルカ' , 'ko': 'FC 카하마르카' , 'th': 'เอฟซี คาฆามาร์ก้า' , 'pt': 'FC Cajamarca' },
  'FC Cologne': { 'ar': 'كولن', 'zh-CN': '科隆', 'zh-TW': '科隆', 'ru': 'ФК Кёльн', 'de': 'FC Cologne' , 'ja': 'FCケルン' , 'ko': 'FC 쾰른' , 'th': 'เอฟซี โคโลญจน์' , 'pt': 'FC Cologne' },
  'FC Cologne W': { 'ar': 'كولن (سيدات)', 'zh-CN': '科隆女足', 'zh-TW': '科隆女足', 'ru': 'ФК Кёльн (Ж)', 'de': 'FC Cologne W' , 'ja': 'FC ケルン W' , 'ko': 'FC 쾰른 여' , 'th': 'เอฟซี โคโลญจน์ ดับบลิว' , 'pt': 'FC Cologne W' },
  'FC Copenhagen': { 'ar': 'كوبنهاغن', 'ru': 'ФК Копенгаген', 'de': 'FC Copenhagen' , 'ja': 'FC コペンハーゲン' , 'ko': 'FC 코펜하겐' , 'th': 'เอฟซี โคเปนเฮเก้น' , 'pt': 'FC Copenhagen' },
  'FC Floresti': { 'ar': 'فلوريستي', 'zh-CN': '弗洛雷什蒂', 'zh-TW': '弗洛雷什蒂', 'ru': 'ФК Флорешты', 'de': 'FC Floresti' , 'ja': 'FCフロレスティ' , 'ko': 'FC 플로레스티' , 'th': 'เอฟซี ฟลอเรสตี' , 'pt': 'FC Floresti' },
  'FC Gifu': { 'ar': 'إف سي جيفو', 'zh-CN': '岐阜FC', 'zh-TW': '岐阜FC', 'ru': 'ФК Гифу', 'de': 'FC Gifu' , 'ja': 'FC岐阜' , 'ko': 'FC 기후' , 'th': 'เอฟซี กิฟู' , 'pt': 'FC Gifu' },
  'FC Heidenheim': { 'ar': 'هايدنهايم', 'zh-CN': '海登海姆', 'zh-TW': '海登海姆', 'ru': 'ФК Хайденхайм', 'de': 'FC Heidenheim' , 'ja': 'FCハイデンハイム' , 'ko': 'FC 하이덴하임' , 'th': 'เอฟซี ไฮเดนไฮม์' , 'pt': 'FC Heidenheim' },
  'FC Hermannstadt': { 'ar': 'هيرمانشتات', 'zh-CN': '赫曼施塔特', 'zh-TW': '赫曼施塔特', 'ru': 'ФК Германштадт', 'de': 'FC Hermannstadt' , 'ja': 'FCヘルマンシュタット' , 'ko': 'FC 헤르만슈타트' , 'th': 'เอฟซี แฮร์มันน์สตัดท์' , 'pt': 'FC Hermannstadt' },
  'FC Imabari': { 'ar': 'إف سي إيماباري', 'ru': 'ФК Имабари', 'de': 'FC Imabari' , 'ja': 'FC今治' , 'ko': 'FC 이마바리' , 'th': 'เอฟซี อิมาบาริ' , 'pt': 'FC Imabari' },
  'FC Juarez': { 'es': 'FC Juárez', 'zh-CN': '华雷斯', 'zh-TW': '華雷斯', 'ru': 'ФК Хуарес', 'de': 'FC Juarez' , 'ja': 'FCフアレス' , 'ko': 'FC 후아레스' , 'th': 'เอฟซี ฮัวเรซ' , 'pt': 'FC Juarez' },
  'FC Kapaz': { 'ar': 'كاباز', 'zh-CN': '卡帕兹', 'zh-TW': '卡帕茲', 'ru': 'ФК Кяпаз', 'de': 'FC Kapaz' , 'ja': 'FCカパス' , 'ko': 'FC 카파스' , 'th': 'เอฟซี คาปาซ' , 'pt': 'FC Kapaz' },
  'FC Koln': { 'zh-CN': '科隆', 'zh-TW': '科隆', 'ru': 'ФК Кельн', 'de': 'FC Koln' , 'ja': 'FCケルン' , 'ko': 'FC 쾰른' , 'th': 'เอฟซี โคโลญจน์' , 'pt': 'FC Koln' },
  'FC Kolos Kovalivka': { 'ar': 'كولوس كوفاليفكا', 'zh-CN': '科洛斯', 'zh-TW': '科洛斯', 'ru': 'ФК Колос Коваливка', 'de': 'FC Kolos Kovalivka' , 'ja': 'FCコロス・コバリフカ' , 'ko': 'FC 콜로스 코발리브카' , 'th': 'เอฟซี โคลอส โควาลิฟก้า' , 'pt': 'FC Kolos Kovalivka' },
  'FC Kyzylzhar Petropavlovsk': { 'ar': 'كيزيلجار', 'zh-CN': '克孜勒扎尔', 'zh-TW': '克孜勒扎爾', 'ru': 'Мидтьюлланн', 'de': 'FC Kyzylzhar Petropavlovsk' , 'ja': 'FCクジルジャル・ペトロパブロフスク' , 'ko': 'FC 키질자르 페트로파블롭스크' , 'th': 'เอฟซี คืซิลซาร์ เปโตรปาฟลอฟสค์' , 'pt': 'FC Kyzylzhar Petropavlovsk' },
  'FC Liege': { 'ar': 'لييج', 'ru': 'ФК Льеж', 'de': 'FC Liege' , 'ja': 'FCリエージュ' , 'ko': 'FC 리에주' , 'th': 'เอฟซี ลีแอช' , 'pt': 'FC Liege' },
  'FC Metaloglobus Bucuresti': { 'ar': 'ميتالوجلوبوس بوخارست', 'zh-CN': '梅塔洛格洛布斯', 'zh-TW': '梅塔洛格洛布斯', 'ru': 'ФК Металлоглобус Бухарест', 'de': 'FC Metaloglobus Bucuresti' , 'ja': 'FC メタロゴブス ブカレスティ' , 'ko': 'FC 메탈로글로부스 부쿠레스티' , 'th': 'เอฟซี เมตาโลโกลบัส บูคาเรสต์' , 'pt': 'FC Metaloglobus Bucuresti' },
  'FC Midtjylland': { 'ar': 'ميتيولاند', 'zh-CN': '中日德兰', 'zh-TW': '米迪蘭特', 'ru': 'ФК Мидтьюлланд', 'de': 'FC Midtjylland' , 'ja': 'FC ミッドユラン' , 'ko': 'FC 미드질란드' , 'th': 'เอฟซี มิดทิลแลนด์' , 'pt': 'FC Midtjylland' },
  'FC Milsami Orhei': { 'ar': 'ميلسامي أورهي', 'zh-CN': '米尔萨米', 'zh-TW': '米爾薩米', 'ru': 'ФК Милсами Оргеев', 'de': 'FC Milsami Orhei' , 'ja': 'FCミルサミ・オルヘイ' , 'ko': 'FC 밀사미 오르헤이' , 'th': 'เอฟซี มิลซามิ ออร์เฮย์' , 'pt': 'FC Milsami Orhei' },
  'FC Minsk': { 'ar': 'إف سي مينسك', 'zh-CN': '明斯克', 'zh-TW': '明斯克', 'ru': 'ФК Минск', 'de': 'FC Minsk' , 'ja': 'FCミンスク' , 'ko': 'FC 민스크' , 'th': 'เอฟซี มินสค์' , 'pt': 'FC Minsk' },
  'FC Nordsjaelland': { 'ar': 'نورسيلاند', 'zh-CN': '北西兰', 'zh-TW': '北西蘭', 'ru': 'ФК Нордшелланд', 'de': 'FC Nordsjaelland' , 'ja': 'FC ノールシェラン' , 'ko': 'FC 노르드셸란트' , 'th': 'เอฟซี นอร์ดเจลแลนด์' , 'pt': 'FC Nordsjaelland' },
  'FC Olexandriya': { 'ar': 'أوليكساندريا', 'zh-CN': '亚历山德里亚', 'zh-TW': '奧歷山德里亞', 'ru': 'ФК Александрия', 'de': 'FC Olexandriya' , 'ja': 'FCオレキサンドリア' , 'ko': 'FC 올렉산드리아' , 'th': 'เอฟซี โอเล็กซานเดรีย' , 'pt': 'FC Olexandriya' },
  'FC Osaka': { 'ar': 'إف سي أوساكا', 'zh-CN': '大阪FC', 'zh-TW': '大阪FC', 'ru': 'ФК Осака', 'de': 'FC Osaka' , 'ja': 'FC大阪' , 'ko': 'FC 오사카' , 'th': 'เอฟซี โอซาก้า' , 'pt': 'FC Osaka' },
  'FC Rapid 1923': { 'de': 'FC Rapid 1923', 'es': 'FC Rapid 1923', 'fr': 'FC Rapid 1923', 'ja': 'ラピド・ブカレスト', 'ko': '라피드 부쿠레슈티',
 'pt': 'FC Rapid 1923', 'ru': 'Рапид Бухарест', 'zh-CN': '布加勒斯特快速', 'zh-TW': '布加勒斯特快速' , 'th': 'เอฟซี ราปิด 1923' },
  'FC Ryukyu': { 'ar': 'إف سي ريوكيو', 'ru': 'ФК Рюкю', 'de': 'FC Ryukyu' , 'ja': 'FC琉球' , 'ko': 'FC류큐' , 'th': 'เอฟซี ริวกิว' , 'pt': 'FC Ryukyu' },
  'FC Seoul': { 'ar': 'إف سي سيول', 'zh-CN': '首尔FC', 'zh-TW': '首爾FC', 'ru': 'ФК Сеул', 'de': 'FC Seoul' , 'ja': 'FCソウル' , 'ko': 'FC서울' , 'th': 'เอฟซี โซล' , 'pt': 'FC Seoul' },
  'FC Sheriff': { 'de': 'FC Sheriff', 'es': 'FC Sheriff', 'fr': 'FC Sheriff', 'ja': 'FCシェリフ', 'ko': 'FC 셰리프',
 'pt': 'FC Sheriff', 'ru': 'Шериф', 'zh-CN': '谢里夫', 'zh-TW': '謝里夫' , 'th': 'เอฟซี นายอำเภอ' },
  'FC Stauceni': { 'ar': 'ستاوتشيني', 'zh-CN': '斯特乌切尼', 'zh-TW': '斯特烏切尼', 'ru': 'ФК Ставчены', 'de': 'FC Stauceni' , 'ja': 'FCスタウセニ' , 'ko': 'FC 스타우세니' , 'th': 'เอฟซี สตาอูเซนี่' , 'pt': 'FC Stauceni' },
  'FC Tokyo': { 'es': 'FC Tokyo', 'zh-CN': 'FC东京', 'zh-TW': 'FC東京', 'ru': 'ФК Токио', 'de': 'FC Tokyo' , 'ja': 'FC東京' , 'ko': 'FC 도쿄' , 'th': 'เอฟซี โตเกียว' , 'pt': 'FC Tokyo' },
  'FC Unirea 2004 Slobozia': { 'ar': 'يونيريا سلوبوزيا', 'ru': 'ФК Униря 2004 Слобозия', 'de': 'FC Unirea 2004 Slobozia' , 'ja': 'FC ウニレア 2004 スロボジア' , 'ko': 'FC 우니레아 2004 슬로보지아' , 'th': 'เอฟซี ยูนิเรีย 2004 สโลโบเซีย' , 'pt': 'FC Unirea 2004 Slobozia' },
  'FC United of Manchester': { 'ar': 'إف سي يونايتد أوف مانشستر', 'ru': 'ФК Юнайтед Манчестер', 'de': 'FC United of Manchester' , 'ja': 'FC ユナイテッド オブ マンチェスター' , 'ko': 'FC 유나이티드 오브 맨체스터' , 'th': 'เอฟซี ยูไนเต็ด ออฟ แมนเชสเตอร์' , 'pt': 'FC United of Manchester' },
  'FC Zaria Balti': { 'ar': 'زاريا بالتي', 'zh-CN': '扎里亚巴尔蒂', 'zh-TW': '扎里亞巴爾蒂', 'ru': 'ФК Заря Бэлць', 'de': 'FC Zaria Balti' , 'ja': 'FC ザリア・バルティ' , 'ko': 'FC 자리아 발티' , 'th': 'เอฟซี ซาเรีย บัลติ' , 'pt': 'FC Zaria Balti' },
  'FCSB': { 'ar': 'ستيوا بوخارست', 'zh-CN': '布加勒斯特星', 'zh-TW': '布加勒斯特星', 'ru': 'ФКСБ', 'de': 'FCSB' , 'ja': 'FCSB' , 'ko': 'FCSB' , 'th': 'เอฟซีเอสบี' , 'pt': 'FCSB' },
  'FCV Farul Constanta': { 'ar': 'فارول كونستانتسا', 'zh-CN': '法鲁尔康斯坦察', 'zh-TW': '法魯爾康斯坦察', 'ru': 'Фиорентина', 'de': 'FCV Farul Constanta' , 'ja': 'FCV ファルル コンスタンツァ' , 'ko': 'FCV 파룰 콘스탄타' , 'th': 'เอฟซีวี ฟารุล คอนสตันต้า' , 'pt': 'FCV Farul Constanta' },
  'Ferencvaros': { 'es': 'Ferencváros', 'zh-CN': '费伦茨瓦罗斯', 'zh-TW': '費倫茨瓦羅斯', 'ru': 'Ференцварош', 'de': 'Ferencvaros' , 'ja': 'フェレンツヴァロス' , 'ko': '페렌크바로스' , 'th': 'เฟเรนซ์วารอส' , 'pt': 'Ferencvaros' },
  'Finn Harps': { 'ar': 'فين هاربس', 'zh-CN': '芬哈普斯', 'zh-TW': '芬哈普斯', 'ru': 'Финн Харпс', 'de': 'Finn Harps' , 'ja': 'フィン・ハープス' , 'ko': '핀 하프' , 'th': 'ฟินน์ ฮาร์ปส์' , 'pt': 'Finn Harps' },
  'Fiorentina': { 'es': 'Fiorentina', 'zh-CN': '佛罗伦萨', 'zh-TW': '佛羅倫斯', 'de': 'AC Florenz', 'ru': 'Фиорентина', 'ja': 'フィオレンティーナ' , 'ko': '피오렌티나' , 'th': 'ฟิออเรนติน่า' , 'pt': 'Fiorentina' },
  'FK Borac Cacak': { 'ar': 'بوراتس تشاتشاك', 'zh-CN': '查查克博拉茨', 'zh-TW': '查查克博拉茨', 'ru': 'ФК Борак Чачак', 'de': 'FK Borac Cacak' , 'ja': 'FK ボラック・チャチャク' , 'ko': 'FK 보라카착' , 'th': 'เอฟเค โบรัค คาคัค' , 'pt': 'FK Borac Cacak' },
  'FK Crvena Zvezda': { 'de': 'Roter Stern Belgrad', 'es': 'Estrella Roja', 'fr': 'Étoile Rouge', 'ja': 'レッドスター・ベオグラード', 'ko': '츠르베나 즈베즈다',
 'pt': 'Estrela Vermelha', 'ru': 'Црвена Звезда', 'zh-CN': '贝尔格莱德红星', 'zh-TW': '貝爾格勒紅星' , 'th': 'เอฟเค เซอร์เวน่า ซเวซดา' },
  'FK Dubocica': { 'ar': 'دوبوتشيتسا', 'zh-CN': '杜博契察', 'zh-TW': '杜博契察', 'ru': 'ФК Дубочица', 'de': 'FK Dubocica' , 'ja': 'FKドゥボシカ' , 'ko': 'FK 두보시차' , 'th': 'เอฟเค ดูโบซิก้า' , 'pt': 'FK Dubocica' },
  'FK IMT Beograd': { 'ar': 'آي إم تي بلغراد', 'ru': 'ФК ИМТ Белград', 'de': 'FK IMT Beograd' , 'ja': 'FK IMT ベオグラード' , 'ko': 'FK IMT 베오그라드' , 'th': 'เอฟเค ไอเอ็มที เบโอกราด' , 'pt': 'FK IMT Beograd' },
  'FK Napredak': { 'zh-CN': '纳普雷达克', 'zh-TW': '納普雷達克', 'ru': 'ФК Напредак', 'de': 'FK Napredak' , 'ja': 'FK ナプレダック' , 'ko': 'FK 나프레닥' , 'th': 'เอฟเค นปรีดาก' , 'pt': 'FK Napredak' },
  'FK Radnicki 1923': { 'ar': 'رادنيتشكي 1923', 'ru': 'ФК Радницкий 1923 г.', 'de': 'FK Radnicki 1923' , 'ja': 'FK ラドニツキ 1923' , 'ko': 'FK 라드니츠키 1923' , 'th': 'เอฟเค รัดนิกกี้ 1923' , 'pt': 'FK Radnicki 1923' },
  'FK Sarajevo': { 'de': 'FK Sarajevo', 'es': 'FK Sarajevo', 'fr': 'FK Sarajevo', 'ja': 'FKサラエヴォ', 'ko': 'FK 사라예보',
 'pt': 'FK Sarajevo', 'ru': 'Сараево', 'zh-CN': '萨拉热窝', 'zh-TW': '塞拉耶佛' , 'th': 'เอฟเค ซาราเยโว' },
  'FK Smederevo 1924': { 'ar': 'سميديريفو', 'zh-CN': '斯梅代雷沃', 'zh-TW': '斯梅代雷沃', 'ru': 'Фламенго', 'de': 'FK Smederevo 1924' , 'ja': 'FK スメデレヴォ 1924' , 'ko': 'FK 스메데레보 1924' , 'th': 'เอฟเค สเมเดเรโว 1924' , 'pt': 'FK Smederevo 1924' },
  'FK Spartak Subotica': { 'ar': 'سبارتاك سوبوتيتسا', 'ru': 'Фортуна Дюссельдорф', 'de': 'FK Spartak Subotica' , 'ja': 'FK スパルタク スボティツァ' , 'ko': 'FK 스파르타크 수보티차' , 'th': 'เอฟเค สปาร์ตัก ซูโบติก้า' , 'pt': 'FK Spartak Subotica' },
  'FK Velez Mostar': { 'ar': 'فيليز موستار', 'zh-CN': '莫斯塔尔维列日', 'zh-TW': '莫斯塔爾維列日', 'ru': 'ФК Велес Мостар', 'de': 'FK Velez Mostar' , 'ja': 'FK ベレス・モスタル' , 'ko': 'FK 벨레스 모스타르' , 'th': 'เอฟเค เบเลซ โมสตาร์' , 'pt': 'FK Velez Mostar' },
  'FK Zemun': { 'ar': 'زيمون', 'ru': 'ФК Земун', 'de': 'FK Zemun' , 'ja': 'FK ゼムン' , 'ko': 'FK 제문' , 'th': 'เอฟเค เซมุน' , 'pt': 'FK Zemun' },
  'Flamengo': { 'ja': 'フラメンゴ', 'ko': '플라멩구', 'ru': 'Фламенго', 'th': 'ฟลาเม็งกู' , 'de': 'Flamengo' , 'pt': 'Flamengo' },
  'Fleetwood': { 'es': 'Fleetwood', 'zh-CN': '弗利特伍德', 'zh-TW': '弗利特伍德', 'ru': 'Флитвуд', 'de': 'Fleetwood' , 'ja': 'フリートウッド' , 'ko': '플릿우드' , 'th': 'ฟลีทวูด' , 'pt': 'Fleetwood' },
  'Fleetwood Town': { 'ar': 'فليتوود تاون', 'zh-CN': '弗利特伍德', 'zh-TW': '弗利特伍德', 'ru': 'Флитвуд Таун', 'de': 'Fleetwood Town' , 'ja': 'フリートウッド タウン' , 'ko': '플리트우드 타운' , 'th': 'ฟลีตวู้ด ทาวน์' , 'pt': 'Fleetwood Town' },
  'Floriana': { 'zh-CN': '弗洛里亚纳', 'zh-TW': '弗洛里亞納', 'ru': 'Флориана', 'de': 'Floriana' , 'ja': 'フロリアナ' , 'ko': '플로리아나' , 'th': 'ฟลอเรียนา' , 'pt': 'Floriana' },
  'Forge FC': { 'ar': 'فورجي', 'ru': 'Фордж ФК', 'de': 'Forge FC' , 'ja': 'フォージFC' , 'ko': '포지 FC' , 'th': 'ฟอร์จ เอฟซี' , 'pt': 'Forge FC' },
  'Fortuna Dusseldorf': { 'ar': 'فورتونا دوسلدورف', 'zh-CN': '杜塞尔多夫', 'zh-TW': '杜塞道夫', 'ru': 'Фортуна Дюссельдорф', 'de': 'Fortuna Dusseldorf' , 'ja': 'フォルトゥナ デュッセルドルフ' , 'ko': '포르투나 뒤셀도르프' , 'th': 'ฟอร์ทูน่า ดุสเซลดอร์ฟ' , 'pt': 'Fortuna Dusseldorf' },
  'Fredrikstad': { 'ar': 'فريدريكستاد', 'zh-CN': '腓特烈斯塔', 'zh-TW': '腓特烈斯塔', 'ru': 'Фредрикстад', 'de': 'Fredrikstad' , 'ja': 'フレドリクスタ' , 'ko': '프레드릭스타드' , 'th': 'เฟรดริกสตัด' , 'pt': 'Fredrikstad' },
  'Freiburg': { 'ja': 'フライブルク', 'ko': '프라이부르크', 'ru': 'Фрайбург', 'th': 'ไฟรบวร์ค' , 'de': 'Freiburg' , 'pt': 'Freiburg' },
  'Fujieda MYFC': { 'ar': 'فوجييدا', 'zh-CN': '藤枝MYFC', 'zh-TW': '藤枝MYFC', 'ru': 'Фулхэм', 'de': 'Fujieda MYFC' , 'ja': '藤枝MYFC' , 'ko': '후지에다 MYFC' , 'th': 'ฟูจิเอดะ มายเอฟซี' , 'pt': 'Fujieda MYFC' },
  'Fukushima United': { 'es': 'Fukushima United', 'zh-CN': '福岛联', 'zh-TW': '福島聯', 'ru': 'Фукусима Юнайтед', 'de': 'Fukushima United' , 'ja': '福島ユナイテッド' , 'ko': '후쿠시마 유나이티드' , 'th': 'ฟูกูชิม่า ยูไนเต็ด' , 'pt': 'Fukushima United' },
  'Fukushima United FC': { 'es': 'Fukushima United', 'zh-CN': '福岛联', 'zh-TW': '福島聯', 'ru': 'Фукусима Юнайтед', 'de': 'Fukushima United FC' , 'ja': '福島ユナイテッドFC' , 'ko': '후쿠시마 유나이티드 FC' , 'th': 'ฟูกูชิม่า ยูไนเต็ด เอฟซี' , 'pt': 'Fukushima United FC' },
  'Fulham': { 'ar': 'فولهام', 'de': 'Fulham', 'es': 'Fulham', 'fr': 'Fulham', 'ja': 'フラム', 'ko': '풀럼',
 'pt': 'Fulham', 'ru': 'Фулхэм', 'zh-CN': '富勒姆', 'zh-TW': '富勒姆' , 'th': 'ฟูแล่ม' },
  'Fulham United FC': { 'ar': 'فولهام يونايتد', 'zh-CN': '富勒姆联', 'zh-TW': '富勒姆聯', 'ru': 'Фулхэм Юнайтед', 'de': 'Fulham United FC' , 'ja': 'フラム・ユナイテッドFC' , 'ko': '풀럼 유나이티드 FC' , 'th': 'ฟูแล่ม ยูไนเต็ด เอฟซี' , 'pt': 'Fulham United FC' },
  'Gainare Tottori': { 'ar': 'غايناري توتوري', 'zh-CN': '鸟取飞翔', 'zh-TW': '鳥取飛翔', 'ru': 'Гайнаре Тоттори', 'de': 'Gainare Tottori' , 'ja': 'ガイナーレ鳥取' , 'ko': '가나레 돗토리' , 'th': 'กานาเระ ทตโตริ' , 'pt': 'Gainare Tottori' },
  'Gamba Kobe': { 'es': 'Vissel Kobe', 'zh-CN': '神户胜利船', 'zh-TW': '神戶勝利船', 'ru': 'Гамба Кобе', 'de': 'Gamba Kobe' , 'ja': 'ガンバ神戸' , 'ko': '감바 고베' , 'th': 'กัมบะ โกเบ' , 'pt': 'Gamba Kobe' },
  'Gamba Osaka': { 'ja': 'ガンバ大阪', 'ko': '감바 오사카', 'ru': 'Гамба Осака', 'th': 'กัมบะโอซากะ' , 'de': 'Gamba Osaka' , 'pt': 'Gamba Osaka' },
  'Gangwon FC': { 'ar': 'غانغوون', 'zh-CN': '江原FC', 'zh-TW': '江原FC', 'ru': 'Канвон ФК', 'de': 'Gangwon FC' , 'ja': '江原FC' , 'ko': '강원FC' , 'th': 'แกงวัน เอฟซี' , 'pt': 'Gangwon FC' },
  'Genk': { 'ar': 'جينك', 'zh-CN': '亨克', 'zh-TW': '亨克', 'ru': 'Генк', 'de': 'Genk' , 'ja': 'ヘンク' , 'ko': '겐크' , 'th': 'เกงค์' , 'pt': 'Genk' },
  'Genoa': { 'ja': 'ジェノア', 'ko': '제노아', 'ru': 'Дженоа', 'th': 'เจนัว' , 'de': 'Genoa' , 'pt': 'Genoa' },
  'Gent': { 'zh-CN': '根特', 'zh-TW': '根特', 'ru': 'Гент', 'de': 'Gent' , 'ja': 'ゲント' , 'ko': '신사' , 'th': 'สุภาพบุรุษ' , 'pt': 'Gent' },
  'Getafe': { 'ja': 'ヘタフェ', 'ko': '헤타페', 'ru': 'Хетафе', 'th': 'เฆตาเฟ' , 'de': 'Getafe' , 'pt': 'Getafe' },
  'Geylang International FC': { 'ar': 'غيلانغ إنترناشيونال', 'zh-CN': '芽笼国际', 'zh-TW': '芽籠國際', 'ru': 'Гейланг Интернешнл', 'de': 'Geylang International FC' , 'ja': 'ゲイラン インターナショナル FC' , 'ko': '게일랑 인터내셔널 FC' , 'th': 'เกลัง อินเตอร์เนชั่นแนล เอฟซี' , 'pt': 'Geylang International FC' },
  'Ghazl Al Mehalla': { 'ar': 'غزل المحلة', 'ru': 'Газл Аль Мехалла', 'de': 'Ghazl Al Mehalla' , 'ja': 'ガズル アル メハラ' , 'ko': '가즐 알 메할라' , 'th': 'กัซ อัล เมฮาลลา' , 'pt': 'Ghazl Al Mehalla' },
  'Ghazl El Mahalla': { 'zh-CN': '马哈拉纺织', 'zh-TW': '馬哈拉紡織', 'ru': 'Газл Эль Махалла', 'de': 'Ghazl El Mahalla' , 'ja': 'ガズル エル マハラ' , 'ko': '가즐 엘 마할라' , 'th': 'ฆาซล์ เอล มาฮาลลา' , 'pt': 'Ghazl El Mahalla' },
  'Gillingham': { 'ar': 'غيلينغهام', 'zh-CN': '吉林汉姆', 'zh-TW': '吉林漢姆', 'ru': 'Джиллингем', 'de': 'Gillingham' , 'ja': 'ジリンガム' , 'ko': '길링엄' , 'th': 'จิลลิงแฮม' , 'pt': 'Gillingham' },
  'Gimcheon Sangmu': { 'ar': 'غيمتشون سانغمو', 'zh-CN': '金泉尚武', 'zh-TW': '金泉尚武', 'ru': 'Кимчхон Санму', 'de': 'Gimcheon Sangmu' , 'ja': '金泉尚武' , 'ko': '김천상무' , 'th': 'กิมชอน ซังมู' , 'pt': 'Gimcheon Sangmu' },
  'Gimnasia LP': { 'es': 'Gimnasia LP', 'zh-CN': '体操击剑', 'zh-TW': '體操擊劍', 'ru': 'Гимнасия ЛП', 'de': 'Gimnasia LP' , 'ja': 'ギムナシアLP' , 'ko': '짐나시아 LP' , 'th': 'หจก. กิมนาเซีย' , 'pt': 'Gimnasia LP' },
  'Gimnasia Mendoza': { 'es': 'Gimnasia Mendoza', 'zh-CN': '门多萨体操', 'zh-TW': '門多薩體操', 'ru': 'Гимнасия Мендоса', 'de': 'Gimnasia Mendoza' , 'ja': 'ヒムナシア メンドーサ' , 'ko': '김나시아 멘도사' , 'th': 'กิมนาเซีย เมนโดซา' , 'pt': 'Gimnasia Mendoza' },
  'Gimnasia y Tiro': { 'es': 'Gimnasia y Tiro', 'zh-CN': '体操与射击', 'zh-TW': '體操與射擊', 'ru': 'Гимнасия и Тиро', 'de': 'Gimnasia y Tiro' , 'ja': 'ヒムナシア・イ・ティロ' , 'ko': '짐나시아 이 티로' , 'th': 'กิมนาเซีย และ ติโร' , 'pt': 'Gimnasia y Tiro' },
  'Giravanz Kitakyushu': { 'es': 'Giravanz Kitakyushu', 'zh-CN': '北九州向日葵', 'zh-TW': '北九州向日葵', 'ru': 'Гираванц Китакюсю', 'de': 'Giravanz Kitakyushu' , 'ja': 'ギラヴァンツ北九州' , 'ko': '기라반즈 기타큐슈' , 'th': 'กิราวานซ์ คิตะคิวชู' , 'pt': 'Giravanz Kitakyushu' },
  'Girona': { 'ja': 'ジローナ', 'ko': '지로나', 'ru': 'Жирона', 'th': 'ฌิโรนา' , 'de': 'Girona' , 'pt': 'Girona' },
  'Godoy Cruz': { 'es': 'Godoy Cruz', 'zh-CN': '戈多伊克鲁斯', 'zh-TW': '戈多伊克魯斯', 'ru': 'Годой Круз', 'de': 'Godoy Cruz' , 'ja': 'ゴドイ・クルス' , 'ko': '고도이 크루즈' , 'th': 'โกดอย ครูซ' , 'pt': 'Godoy Cruz' },
  'Gokulam Kerala': { 'zh-CN': '戈库兰喀拉拉', 'zh-TW': '戈庫蘭喀拉拉', 'ru': 'Гокулам Керала', 'de': 'Gokulam Kerala' , 'ja': 'ゴクラム ケララ州' , 'ko': '고쿨람 케랄라' , 'th': 'โกคุลัม เกรละ' , 'pt': 'Gokulam Kerala' },
  'Granada': { 'es': 'Granada', 'zh-CN': '格拉纳达', 'zh-TW': '格拉納達', 'ru': 'Гранада', 'de': 'Granada' , 'ja': 'グラナダ' , 'ko': '그라나다' , 'th': 'กรานาดา' , 'pt': 'Granada' },
  'Grazer AK': { 'ar': 'غرايتسر', 'zh-CN': '格拉茨AK', 'zh-TW': '格拉茨AK', 'ru': 'Грейзер АК', 'de': 'Grazer AK' , 'ja': 'グレイザーAK' , 'ko': '그레이저 AK' , 'th': 'กราเซอร์ เอเค' , 'pt': 'Grazer AK' },
  'Greenock Morton': { 'ar': 'غرينوك مورتون', 'zh-CN': '摩顿', 'zh-TW': '摩頓', 'ru': 'Гамбург', 'de': 'Greenock Morton' , 'ja': 'グリーノック・モートン' , 'ko': '그리녹 모튼' , 'th': 'กรีน็อค มอร์ตัน' , 'pt': 'Greenock Morton' },
  'Greuther Furth': { 'ar': 'غرويتر فورت', 'zh-CN': '菲尔特', 'zh-TW': '菲爾特', 'ru': 'Гройтер Фюрт', 'de': 'Greuther Furth' , 'ja': 'グロイター・フュルト' , 'ko': '그로이터 퓌르트' , 'th': 'กรอยเธอร์ เฟือร์ธ' , 'pt': 'Greuther Furth' },
  'Grimsby': { 'es': 'Grimsby', 'zh-CN': '格林斯比', 'zh-TW': '格林斯比', 'ru': 'Гримсби', 'de': 'Grimsby' , 'ja': 'グリムズビー' , 'ko': '그림스비' , 'th': 'กริมสบี้' , 'pt': 'Grimsby' },
  'Grimsby Town': { 'ar': 'غريمسبي تاون', 'zh-CN': '格林斯比', 'zh-TW': '格林斯比', 'ru': 'Гримсби Таун', 'de': 'Grimsby Town' , 'ja': 'グリムズビータウン' , 'ko': '그림스비 타운' , 'th': 'กริมสบี้ ทาวน์' , 'pt': 'Grimsby Town' },
  'Guadalajara': { 'ja': 'グアダラハラ', 'ko': '과달라하라', 'ru': 'Гвадалахара', 'th': 'กวาดาลาฮารา' , 'de': 'Guadalajara' , 'pt': 'Guadalajara' },
  'Gwangju FC': { 'ar': 'غوانغجو', 'zh-CN': '光州FC', 'zh-TW': '光州FC', 'ru': 'Кванджу ФК', 'de': 'Gwangju FC' , 'ja': '光州FC' , 'ko': '광주FC' , 'th': 'กวางจู เอฟซี' , 'pt': 'Gwangju FC' },
  'Gzira United': { 'zh-CN': '格齐拉联', 'zh-TW': '格齊拉聯', 'ru': 'Гзира Юнайтед', 'de': 'Gzira United' , 'ja': 'グジラ・ユナイテッド' , 'ko': '그지라 유나이티드' , 'th': 'กซีร่า ยูไนเต็ด' , 'pt': 'Gzira United' },
  'Hamburger SV': { 'ar': 'هامبورغ', 'ja': 'ハンブルガーSV', 'ko': '함부르크 SV', 'ru': 'Гамбург', 'th': 'ฮัมบวร์ค', 'zh-CN': '汉堡', 'zh-TW': '漢堡' , 'de': 'Hamburger SV' , 'pt': 'Hamburger SV' },
  'HamKam': { 'ar': 'هاوكام', 'zh-CN': '汉坎', 'zh-TW': '漢坎', 'ru': 'ХамКам', 'de': 'HamKam' , 'ja': 'ハムカム' , 'ko': '함캄' , 'th': 'แฮมคัม' , 'pt': 'HamKam' },
  'Hamrun Spartans': { 'ar': 'هامرون سبارتانز', 'zh-CN': '哈姆伦斯巴达', 'zh-TW': '哈姆倫斯巴達', 'ru': 'Хамрун Спартанцы', 'de': 'Hamrun Spartans' , 'ja': 'ハムルン・スパルタンズ' , 'ko': '함룬 스파르탄' , 'th': 'ฮัมรุน สปาร์ตันส์' , 'pt': 'Hamrun Spartans' },
  'Hannover 96': { 'ar': 'هانوفر', 'zh-CN': '汉诺威', 'zh-TW': '漢諾威', 'ru': 'Ганновер 96', 'de': 'Hannover 96' , 'ja': 'ハノーバー 96' , 'ko': '하노버 96' , 'th': 'ฮันโนเวอร์ 96' , 'pt': 'Hannover 96' },
  'Hapoel Beer Sheva': { 'ar': 'هبوعيل بئر السبع', 'zh-CN': '贝尔谢巴工人', 'zh-TW': '貝爾謝巴工人', 'ru': 'Хапоэль Беэр-Шева', 'de': 'Hapoel Beer Sheva' , 'ja': 'ハポエル・ビア・シェバ' , 'ko': '하포엘 베르셰바' , 'th': 'ฮาโปเอล เบียร์ เชว่า' , 'pt': 'Hapoel Beer Sheva' },
  'Hapoel Haifa': { 'zh-CN': '海法工人', 'zh-TW': '海法工人', 'ru': 'Хапоэль Хайфа', 'de': 'Hapoel Haifa' , 'ja': 'ハポエル ハイファ' , 'ko': '하포엘 하이파' , 'th': 'ฮาโปเอล ไฮฟา' , 'pt': 'Hapoel Haifa' },
  'Hapoel Ironi Kiryat Shmona': { 'de': 'Ironi Kiryat Shmona', 'es': 'Hapoel Ironi Kiryat Shmona', 'fr': 'Ironi Kiryat Shmona', 'ja': 'イロニ・キリヤット・シュモナ', 'ko': '하포엘 이로니 키르야트 시모나',
 'pt': 'Ironi Kiryat Shmona', 'ru': 'Хапоэль Ирони Кирьят-Шмона', 'zh-CN': '谢莫纳城伊罗尼', 'zh-TW': '謝莫納城伊羅尼' , 'th': 'ฮาโปเอล อิโรนี่ เคอร์ยัต ชโมน่า' },
  'Hapoel Jerusalem': { 'de': 'Hapoel Jerusalem', 'es': 'Hapoel Jerusalem', 'fr': 'Hapoel Jérusalem', 'ja': 'ハポエル・エルサレム', 'ko': '하포엘 예루살렘',
 'pt': 'Hapoel Jerusalem', 'ru': 'Хапоэль Иерусалим', 'zh-CN': '耶路撒冷哈普尔', 'zh-TW': '耶路撒冷哈普爾' , 'th': 'ฮาโปเอล เยรูซาเลม' },
  'Hapoel Petah Tikva': { 'ar': 'هبوعيل بتاح تكفا', 'zh-CN': '佩塔提克瓦工人', 'zh-TW': '彼達迪瓦工人', 'ru': 'Хапоэль Петах-Тиква', 'de': 'Hapoel Petah Tikva' , 'ja': 'ハポエル・ペタク・チクヴァ' , 'ko': '하포엘 페타 티크바' , 'th': 'ฮาโปเอล เปตาห์ ทิควา' , 'pt': 'Hapoel Petah Tikva' },
  'Hapoel Tel Aviv': { 'ar': 'هبوعيل تل أبيب', 'zh-CN': '特拉维夫工人', 'zh-TW': '特拉維夫工人', 'ru': 'Хапоэль Тель-Авив', 'de': 'Hapoel Tel Aviv' , 'ja': 'ハポエル テルアビブ' , 'ko': '하포엘 텔아비브' , 'th': 'ฮาโปเอล เทล อาวีฟ' , 'pt': 'Hapoel Tel Aviv' },
  'Haras El Hodood': { 'ar': 'حرس الحدود', 'ru': 'Герта', 'de': 'Haras El Hodood' , 'ja': 'ハラス・エル・ホドゥード' , 'ko': '하라스 엘 호두드' , 'th': 'ฮารัส เอล โฮดูด' , 'pt': 'Haras El Hodood' },
  'Harbour View': { 'ar': 'هاربور فيو', 'ru': 'Вид на гавань', 'de': 'Harbour View' , 'ja': 'ハーバービュー' , 'ko': '하버뷰' , 'th': 'วิวอ่าว' , 'pt': 'Harbour View' },
  'Harrogate Town': { 'ar': 'هاروغيت تاون', 'zh-CN': '哈罗盖特', 'zh-TW': '哈羅蓋特', 'ru': 'Харрогейт Таун', 'de': 'Harrogate Town' , 'ja': 'ハロゲートタウン' , 'ko': '해러게이트 타운' , 'th': 'ฮาโรเกต ทาวน์' , 'pt': 'Harrogate Town' },
  'Haugesund': { 'ar': 'هاوغسوند', 'zh-CN': '海于格松', 'zh-TW': '海于格松', 'ru': 'Хаугесунн', 'de': 'Haugesund' , 'ja': 'ハウゲスン' , 'ko': '헤우게순' , 'th': 'เฮาเกสซุนด์' , 'pt': 'Haugesund' },
  'HB Koege': { 'ar': 'إتش بي كويه', 'zh-CN': '赫福尔格', 'zh-TW': '赫福爾格', 'ru': 'ХБ Кёге', 'de': 'HB Koege' , 'ja': 'HB キューゲ' , 'ko': 'HB 코게' , 'th': 'เอชบี โคเอจ' , 'pt': 'HB Koege' },
  'Hearts': { 'zh-CN': '哈茨', 'zh-TW': '赫斯', 'ru': 'Сердца', 'de': 'Hearts' , 'ja': 'ハート' , 'ko': '하트' , 'th': 'หัวใจ' , 'pt': 'Hearts' },
  'Hednesford': { 'ar': 'هيدنيسفورد', 'ru': 'Хеднесфорд', 'de': 'Hednesford' , 'ja': 'ヘドネスフォード' , 'ko': '헤드네스퍼드' , 'th': 'เฮดเนสฟอร์ด' , 'pt': 'Hednesford' },
  'Heidenheim': { 'es': 'Heidenheim', 'zh-CN': '海登海姆', 'zh-TW': '海登海姆', 'ru': 'Хайденхайм', 'de': 'Heidenheim' , 'ja': 'ハイデンハイム' , 'ko': '하이덴하임' , 'th': 'ไฮเดนไฮม์' , 'pt': 'Heidenheim' },
  'Hellas Verona': { 'ja': 'エラス・ヴェローナ', 'ko': '엘라스 베로나', 'ru': 'Верона', 'th': 'เฮลแลสเวโรนา' , 'de': 'Hellas Verona' , 'pt': 'Hellas Verona' },
  'Hertha Berlin': { 'ar': 'هرتا برلين', 'zh-CN': '柏林赫塔', 'zh-TW': '柏林赫塔', 'ru': 'Герта Берлин', 'de': 'Hertha Berlin' , 'ja': 'ヘルタ・ベルリン' , 'ko': '헤르타 베를린' , 'th': 'แฮร์ธ่า เบอร์ลิน' , 'pt': 'Hertha Berlin' },
  'Hibernian': { 'zh-CN': '希伯尼安', 'zh-TW': '希伯尼安', 'ru': 'Хиберниан', 'de': 'Hibernian' , 'ja': 'ハイバーニアン' , 'ko': '아일랜드 사람' , 'th': 'ฮิเบอร์เนียน' , 'pt': 'Hibernian' },
  'Hibernians': { 'zh-CN': '希伯尼安斯', 'zh-TW': '希伯尼安斯', 'ru': 'Хибернианцы', 'de': 'Hibernians' , 'ja': 'ハイバーニアン' , 'ko': '하이버니언' , 'th': 'ฮิเบอร์เนียน' , 'pt': 'Hibernians' },
  'Hobro': { 'ar': 'هوبرو', 'zh-CN': '霍布罗', 'zh-TW': '霍布羅', 'ru': 'Хобро', 'de': 'Hobro' , 'ja': 'ホブロ' , 'ko': '호브로' , 'th': 'โฮโบร' , 'pt': 'Hobro' },
  'Hoffenheim': { 'ar': 'هوفنهايم', 'zh-CN': '霍芬海姆', 'zh-TW': '霍芬海姆', 'ru': 'Хаддерсфилд', 'de': 'Hoffenheim' , 'ja': 'ホッフェンハイム' , 'ko': '호펜하임' , 'th': 'ฮอฟเฟนไฮม์' , 'pt': 'Hoffenheim' },
  'Hoffenheim W': { 'zh-CN': '霍芬海姆女足', 'zh-TW': '霍芬海姆女足', 'ru': 'Хоффенхайм (Ж)', 'de': 'Hoffenheim W' , 'ja': 'ホッフェンハイム W' , 'ko': '호펜하임 여' , 'th': 'ฮอฟเฟ่นไฮม์ ดับเบิลยู' , 'pt': 'Hoffenheim W' },
  'Hokkaido Consadole Sapporo': { 'es': 'Consadole Sapporo', 'zh-CN': '北海道札幌冈萨多', 'zh-TW': '北海道札幌岡薩多', 'ru': 'Халл', 'de': 'Hokkaido Consadole Sapporo' , 'ja': '北海道コンサドーレ札幌' , 'ko': '홋카이도 콘사도레 삿포로' , 'th': 'ฮอกไกโด คอนซาโดเล ซัปโปโร' , 'pt': 'Hokkaido Consadole Sapporo' },
  'Holland Park Hawks': { 'ar': 'هولاند بارك هوكس', 'zh-CN': '荷兰公园鹰', 'zh-TW': '荷蘭公園鷹', 'ru': 'Холланд Парк Хоукс', 'de': 'Holland Park Hawks' , 'ja': 'ホーランドパーク・ホークス' , 'ko': '홀랜드 파크 호크스' , 'th': 'ฮอลแลนด์ พาร์ก ฮอกส์' , 'pt': 'Holland Park Hawks' },
  'Holstein Kiel': { 'ar': 'هولشتاين كيل', 'zh-CN': '基尔', 'zh-TW': '基爾', 'ru': 'Гольштейн Киль', 'de': 'Holstein Kiel' , 'ja': 'ホルスタインキール' , 'ko': '홀스타인 킬' , 'th': 'โฮลสไตน์ คีล' , 'pt': 'Holstein Kiel' },
  'Hougang United FC': { 'ar': 'هوجانج يونايتد', 'ru': 'Хоуганг Юнайтед', 'de': 'Hougang United FC' , 'ja': 'ホウガン・ユナイテッドFC' , 'ko': '호우강 유나이티드 FC' , 'th': 'โหวกัง ยูไนเต็ด เอฟซี' , 'pt': 'Hougang United FC' },
  'Huddersfield': { 'es': 'Huddersfield', 'zh-CN': '哈德斯菲尔德', 'zh-TW': '哈德斯菲爾德', 'ru': 'Хаддерсфилд', 'de': 'Huddersfield' , 'ja': 'ハダースフィールド' , 'ko': '허더즈필드' , 'th': 'ฮัดเดอร์สฟิลด์' , 'pt': 'Huddersfield' },
  'Huddersfield Town': { 'ar': 'هدرسفيلد تاون', 'zh-CN': '哈德斯菲尔德', 'zh-TW': '哈德斯菲爾德', 'ru': 'Хаддерсфилд Таун', 'de': 'Huddersfield Town' , 'ja': 'ハダースフィールドタウン' , 'ko': '허더즈필드 타운' , 'th': 'ฮัดเดอร์สฟิลด์ ทาวน์' , 'pt': 'Huddersfield Town' },
  'Hull': { 'es': 'Hull', 'zh-CN': '赫尔城', 'zh-TW': '赫爾城', 'ru': 'Халл', 'de': 'Hull' , 'ja': '船体' , 'ko': '선체' , 'th': 'ฮัลล์' , 'pt': 'Hull' },
  'Hull City': { 'ar': 'هال سيتي', 'zh-CN': '赫尔城', 'zh-TW': '赫爾城', 'ru': 'Халл Сити', 'de': 'Hull City' , 'ja': 'ハルシティ' , 'ko': '헐 시티' , 'th': 'ฮัลล์ ซิตี้' , 'pt': 'Hull City' },
  'Huracan': { 'es': 'Huracán', 'zh-CN': '飓风队', 'zh-TW': '颶風隊', 'ru': 'Хуракан', 'de': 'Huracan' , 'ja': 'ウラカン' , 'ko': '우라칸' , 'th': 'ฮูราแคน' , 'pt': 'Huracan' },
  'Incheon United': { 'ar': 'إنتشون يونايتد', 'zh-CN': '仁川联', 'zh-TW': '仁川聯', 'ru': 'Инчхон Юнайтед', 'de': 'Incheon United' , 'ja': '仁川ユナイテッド' , 'ko': '인천 유나이티드' , 'th': 'อินชอน ยูไนเต็ด' , 'pt': 'Incheon United' },
  'Independiente': { 'es': 'Independiente', 'zh-CN': '独立队', 'zh-TW': '獨立隊', 'ru': 'Индепендьенте', 'de': 'Independiente' , 'ja': 'インデペンディエンテ' , 'ko': '인디펜디엔테' , 'th': 'อินดิเพนเดียนเต' , 'pt': 'Independiente' },
  'Independiente del Valle': { 'ar': 'إنديبندينتي ديل فال', 'ru': 'Индепендьенте дель Валье', 'de': 'Independiente del Valle' , 'ja': 'インデペンディエンテ デル バジェ' , 'ko': '인데펜디엔테 델 발레' , 'th': 'อินดิเพนเดียนเต้ เดล บาเญ' , 'pt': 'Independiente del Valle' },
  'Independiente Petrolero': { 'ar': 'إنديبندينتي بيتروليرو', 'ru': 'Индепендьенте Петролеро', 'de': 'Independiente Petrolero' , 'ja': 'インデペンディエンテ ペトロレロ' , 'ko': '인디펜디엔테 페트롤레로' , 'th': 'อินดิเพนเดียนเต้ เปโตรเลโร' , 'pt': 'Independiente Petrolero' },
  'Instituto': { 'es': 'Instituto', 'zh-CN': '科尔多瓦学院', 'zh-TW': '科爾多瓦學院', 'ru': 'Институт', 'de': 'Instituto' , 'ja': 'インスティトゥート' , 'ko': '연구소' , 'th': 'สถาบัน' , 'pt': 'Instituto' },
  'Inter': { 'es': 'Inter', 'zh-CN': '国际米兰', 'zh-TW': '國際米蘭', 'ru': 'Интер', 'de': 'Inter' , 'ja': 'インテル' , 'ko': '인테르' , 'th': 'อินเตอร์' , 'pt': 'Inter' },
  'Inter Miami': { 'ja': 'インテル・マイアミ', 'ko': '인터 마이애미', 'ru': 'Интер Майами', 'th': 'อินเตอร์ไมอามี' , 'de': 'Inter Miami' , 'pt': 'Inter Miami' },
  'Inter Miami CF': { 'es': 'Inter Miami', 'zh-CN': '迈阿密国际', 'zh-TW': '邁阿密國際', 'ru': 'Интер Майами', 'de': 'Inter Miami CF' , 'ja': 'インテル マイアミCF' , 'ko': '인터 마이애미 CF' , 'th': 'อินเตอร์ ไมอามี ซีเอฟ' , 'pt': 'Inter Miami CF' },
  'Inter Milan': { 'es': 'Inter', 'zh-CN': '国际米兰', 'zh-TW': '國際米蘭', 'de': 'Inter Mailand', 'ru': 'Интер Милан', 'ja': 'インテル・ミラノ' , 'ko': '인터밀란' , 'th': 'อินเตอร์ มิลาน' , 'pt': 'Inter Milan' },
  'Inter Toronto': { 'ar': 'إنتر تورونتو', 'zh-CN': '多伦多国际', 'zh-TW': '多倫多國際', 'ru': 'Интер Торонто', 'de': 'Inter Toronto' , 'ja': 'インタートロント' , 'ko': '인터 토론토' , 'th': 'อินเตอร์ โตรอนโต้' , 'pt': 'Inter Toronto' },
  'Ipswich': { 'es': 'Ipswich', 'zh-CN': '伊普斯维奇', 'zh-TW': '伊普斯維奇', 'ru': 'Ипсвич', 'de': 'Ipswich' , 'ja': 'イプスウィッチ' , 'ko': '입스위치' , 'th': 'อิปสวิช' , 'pt': 'Ipswich' },
  'Ipswich Town': { 'ar': 'إيبسويتش تاون', 'zh-CN': '伊普斯维奇', 'zh-TW': '伊普斯維奇', 'ru': 'Ипсвич Таун', 'de': 'Ipswich Town' , 'ja': 'イプスウィッチ タウン' , 'ko': '입스위치 타운' , 'th': 'อิปสวิช ทาวน์' , 'pt': 'Ipswich Town' },
  'Ipswich Town U18': { 'ar': 'إيبسويتش تاون تحت 18', 'ru': 'Ипсвич Таун U18', 'de': 'Ipswich Town U18' , 'ja': 'イプスウィッチ タウン U18' , 'ko': '입스위치 타운 U18' , 'th': 'อิปสวิช ทาวน์ U18' , 'pt': 'Ipswich Town U18' },
  'Irapuato': { 'es': 'Irapuato', 'zh-CN': '伊拉普阿托', 'zh-TW': '伊拉普阿托', 'ru': 'Ирапуато', 'de': 'Irapuato' , 'ja': 'イラプアト' , 'ko': '이라푸아토' , 'th': 'อิราปัวโต' , 'pt': 'Irapuato' },
  'Ironi Kiryat Shmona': { 'zh-CN': '谢莫纳城', 'zh-TW': '謝莫納城', 'ru': 'Ирони Кирьят Шмона', 'de': 'Ironi Kiryat Shmona' , 'ja': 'イロニ・キリヤット・シュモナ' , 'ko': '이로니 키르야트 시모나' , 'th': 'อิโรนี เคอร์ยัต ชโมนา' , 'pt': 'Ironi Kiryat Shmona' },
  'Ironi Tiberias': { 'de': 'Ironi Tiberias', 'es': 'Ironi Tiberias', 'fr': 'Ironi Tiberias', 'ja': 'イロニ・ティベリアス', 'ko': '이로니 티베리아스',
 'pt': 'Ironi Tiberias', 'ru': 'Ирони Тверия', 'zh-CN': '铁比利亚伊罗尼', 'zh-TW': '鐵比利亞伊羅尼' , 'th': 'อิโรนี่ ทิเบเรียส' },
  'Irtysh Pavlodar': { 'ar': 'إرتيش بافلودار', 'zh-CN': '额尔齐斯', 'zh-TW': '額爾齊斯', 'ru': 'Иртыш Павлодар', 'de': 'Irtysh Pavlodar' , 'ja': 'イルティシュ・パヴロダル' , 'ko': '이르티시 파블로다르' , 'th': 'อีร์ติช ปัฟโลดาร์' , 'pt': 'Irtysh Pavlodar' },
  'Iskra Ribnita': { 'ar': 'إيسكرا ريبنيتسا', 'zh-CN': '伊斯克拉里布尼察', 'zh-TW': '伊斯克拉里布尼察', 'ru': 'Искра Рыбница', 'de': 'Iskra Ribnita' , 'ja': 'イスクラ・リブニタ' , 'ko': '이스크라 리브니타' , 'th': 'อิสครา ริบนิตา' , 'pt': 'Iskra Ribnita' },
  'Ismaily': { 'zh-CN': '伊斯梅利', 'zh-TW': '伊斯梅利', 'ru': 'Исмаили', 'de': 'Ismaily' , 'ja': 'イスマイール' , 'ko': '이스마일리' , 'th': 'อิสไมลี' , 'pt': 'Ismaily' },
  'Ismaily SC': { 'ar': 'الإسماعيلي', 'ru': 'Исмаили СК', 'de': 'Ismaily SC' , 'ja': 'イスマイリーSC' , 'ko': '이스마일리 SC' , 'th': 'อิสไมลี เอสซี' , 'pt': 'Ismaily SC' },
  'Ittihad Gharyan': { 'de': 'Ittihad Gharyan', 'es': 'Ittihad Gharyan', 'fr': 'Ittihad Gharyan', 'ja': 'イテハド・ガルヤン', 'ko': '이티하드 가르얀',
 'pt': 'Ittihad Gharyan', 'ru': 'Иттихад Гарьян', 'zh-CN': '伊蒂哈德盖尔扬', 'zh-TW': '伊蒂哈德蓋爾揚' , 'th': 'อิติฮัด ฆารยาน' },
  'Iwaki FC': { 'ar': 'إيواكي', 'zh-CN': '岩手FC', 'zh-TW': '岩手FC', 'ru': 'Иваки ФК', 'de': 'Iwaki FC' , 'ja': 'いわきFC' , 'ko': '이와키 FC' , 'th': 'อิวากิ เอฟซี' , 'pt': 'Iwaki FC' },
  'Jaibos Tampico Madero': { 'es': 'Tampico Madero', 'zh-CN': '坦皮科马德罗', 'zh-TW': '坦皮科馬德羅', 'ru': 'Хайбос Тампико Мадеро', 'de': 'Jaibos Tampico Madero' , 'ja': 'ハイボス タンピコ マデロ' , 'ko': '자이보스 탐피코 마데로' , 'th': 'ไจบอส แทมปิโก มาเดโร' , 'pt': 'Jaibos Tampico Madero' },
  'Javor': { 'ar': 'جافور', 'ru': 'Явор', 'de': 'Javor' , 'ja': 'ジャボール' , 'ko': '자보르' , 'th': 'จาวอร์' , 'pt': 'Javor' },
  'Jeju United': { 'ar': 'جيجو يونايتد', 'zh-CN': '济州联', 'zh-TW': '濟州聯', 'ru': 'Чеджу Юнайтед', 'de': 'Jeju United' , 'ja': '済州ユナイテッド' , 'ko': '제주 유나이티드' , 'th': 'เจจูยูไนเต็ด' , 'pt': 'Jeju United' },
  'Jeonbuk FC': { 'ar': 'جونبك هيونداي', 'zh-CN': '全北现代', 'zh-TW': '全北現代', 'ru': 'Чонбук ФК', 'de': 'Jeonbuk FC', 'ja': '全北現代FC', 'ko': '전북FC' , 'th': 'ชอนบุก เอฟซี' , 'pt': 'Jeonbuk FC' },
  'Jeonbuk Hyundai Motors': { 'ja': '全北現代モータース', 'ko': '전북 현대 모터스', 'ru': 'Чонбук Хёндэ', 'th': 'ช็อนบุกฮุนไดมอเตอส์' , 'de': 'Jeonbuk Hyundai Motors' , 'pt': 'Jeonbuk Hyundai Motors' },
  'Juarez': { 'es': 'Juárez', 'zh-CN': '华雷斯', 'zh-TW': '華雷斯', 'ru': 'Кайзерслаутерн', 'de': 'Juarez' , 'ja': 'フアレス' , 'ko': '후아레스' , 'th': 'ฮัวเรซ' , 'pt': 'Juarez' },
  'Jubilo Iwata': { 'ar': 'جوبيلو إيواتا', 'zh-CN': '磐田喜悦', 'zh-TW': '磐田山葉', 'ru': 'Джубило Ивата', 'de': 'Jubilo Iwata', 'ja': 'ジュビロ磐田', 'ko': '주빌로 이와타' , 'th': 'จูบิโล อิวาตะ' , 'pt': 'Jubilo Iwata' },
  'Juventud de las Piedras': { 'ar': 'يوفينتود', 'ru': 'Хувентуд де лас Пьедрас', 'de': 'Juventud de las Piedras' , 'ja': 'ユベントゥド・デ・ラス・ピエドラス' , 'ko': '후벤투드 데 라스 피에드라스' , 'th': 'ยูเวนตุด เด ลาส เปียดราส' , 'pt': 'Juventud de las Piedras' },
  'Juventus': { 'es': 'Juventus', 'zh-CN': '尤文图斯', 'zh-TW': '尤文圖斯', 'de': 'Juventus Turin', 'ru': 'Ювентус', 'ja': 'ユベントス' , 'ko': '유벤투스' , 'th': 'ยูเวนตุส' , 'pt': 'Juventus' },
  'Kabel Novi Sad': { 'ar': 'كابل نوفي ساد', 'ru': 'Кабель Нови Сад', 'de': 'Kabel Novi Sad' , 'ja': 'カベル・ノヴィ・サド' , 'ko': '카벨 노비 사드' , 'th': 'คาเบล โนวี ซาด' , 'pt': 'Kabel Novi Sad' },
  'Kagoshima United': { 'es': 'Kagoshima United', 'zh-CN': '鹿儿岛联', 'zh-TW': '鹿兒島聯', 'ru': 'Кагосима Юнайтед', 'de': 'Kagoshima United' , 'ja': '鹿児島ユナイテッド' , 'ko': '가고시마 유나이티드' , 'th': 'คาโกชิม่า ยูไนเต็ด' , 'pt': 'Kagoshima United' },
  'Kagoshima United FC': { 'es': 'Kagoshima United', 'zh-CN': '鹿儿岛联', 'zh-TW': '鹿兒島聯', 'ru': 'Кагосима Юнайтед', 'de': 'Kagoshima United FC' , 'ja': '鹿児島ユナイテッドFC' , 'ko': '가고시마 유나이티드 FC' , 'th': 'คาโกชิม่า ยูไนเต็ด เอฟซี' , 'pt': 'Kagoshima United FC' },
  'Kahrbaa Alasmalia': { 'ar': 'كهرباء الإسماعيلية', 'ru': 'Карбаа Аласмалия', 'de': 'Kahrbaa Alasmalia' , 'ja': 'カールバア・アラスマリア' , 'ko': '카르바 알라스말리아' , 'th': 'คาห์รบา อลาสมาเลีย' , 'pt': 'Kahrbaa Alasmalia' },
  'Kairat Almaty': { 'ar': 'كايرات ألماتي', 'zh-CN': '阿拉木图凯拉特', 'zh-TW': '阿拉木圖凱拉特', 'ru': 'Кайрат Алматы', 'de': 'Kairat Almaty' , 'ja': 'カイラート アルマトイ' , 'ko': '카이라트 알마티' , 'th': 'ไครัต อัลมาตี' , 'pt': 'Kairat Almaty' },
  'Kaiserslautern': { 'ar': 'كايزرسلاوترن', 'zh-CN': '凯泽斯劳滕', 'zh-TW': '凱澤斯勞滕', 'ru': 'КФУМ Осло', 'de': 'Kaiserslautern' , 'ja': 'カイザースラウテルン' , 'ko': '카이저슬라우테른' , 'th': 'ไกเซอร์สเลาเทิร์น' , 'pt': 'Kaiserslautern' },
  'Kaizer Chiefs': { 'ar': 'كايزر تشيفز', 'ru': 'Кайзер Чифс', 'de': 'Kaizer Chiefs' , 'ja': 'カイザー・チーフス' , 'ko': '카이저 치프스' , 'th': 'ไกเซอร์ ชีฟส์' , 'pt': 'Kaizer Chiefs' },
  'Kamatamare Sanuki': { 'es': 'Kamatamare Sanuki', 'zh-CN': '赞岐釜玉海', 'zh-TW': '讚岐釜玉海', 'ru': 'Каматамаре Сануки', 'de': 'Kamatamare Sanuki' , 'ja': 'カマタマーレ讃岐' , 'ko': '카마타마레 사누키' , 'th': 'คามาทามาเระ ซานูกิ' , 'pt': 'Kamatamare Sanuki' },
  'Karlsruher SC': { 'ar': 'كارلسروه', 'zh-CN': '卡尔斯鲁厄', 'zh-TW': '卡爾斯魯爾', 'ru': 'Карлсруэ СК', 'de': 'Karlsruher SC' , 'ja': 'カールスルーアー SC' , 'ko': '카를스루허 SC' , 'th': 'คาร์ลสรูเฮอร์ เอสซี' , 'pt': 'Karlsruher SC' },
  'Karvan FK': { 'ar': 'كارفان', 'ru': 'Кристиансунн', 'de': 'Karvan FK' , 'ja': 'カルバンFK' , 'ko': '카르반 FK' , 'th': 'คาร์วาน เอฟเค' , 'pt': 'Karvan FK' },
  'Kashima Antlers': { 'ja': '鹿島アントラーズ', 'ko': '가시마 앤틀러스', 'ru': 'Касима Антлерс', 'th': 'คาชิมะแอนต์เลอส์' , 'de': 'Kashima Antlers' , 'pt': 'Kashima Antlers' },
  'Kashiwa Reysol': { 'es': 'Kashiwa Reysol', 'zh-CN': '柏太阳神', 'zh-TW': '柏雷素爾', 'ru': 'Касива Рейсол', 'de': 'Kashiwa Reysol' , 'ja': '柏レイソル' , 'ko': '가시와 레이솔' , 'th': 'คาชิว่า เรย์โซล' , 'pt': 'Kashiwa Reysol' },
  'Kataller Toyama': { 'ar': 'كاتالر توياما', 'ru': 'Каталлер Тояма', 'de': 'Kataller Toyama' , 'ja': 'カターレ富山' , 'ko': '카탈러 토야마' , 'th': 'คาตาลเลอร์ โทยามะ' , 'pt': 'Kataller Toyama' },
  'Kawasaki Frontale': { 'ja': '川崎フロンターレ', 'ko': '가와사키 프론탈레', 'ru': 'Кавасаки Фронтале', 'th': 'คาวาซากิฟรอนตาเล' , 'de': 'Kawasaki Frontale' , 'pt': 'Kawasaki Frontale' },
  'Kerry': { 'ar': 'كيري', 'zh-CN': '凯里', 'zh-TW': '凱里', 'ru': 'Керри', 'de': 'Kerry' , 'ja': 'ケリー' , 'ko': '케리' , 'th': 'เคอรี่' , 'pt': 'Kerry' },
  'KFUM Oslo': { 'ar': 'كي إف يو إم أوسلو', 'zh-CN': 'KFUM奥斯陆', 'zh-TW': 'KFUM奧斯陸', 'ru': 'КФУМ Осло', 'de': 'KFUM Oslo' , 'ja': 'KFUM オスロ' , 'ko': 'KFUM 오슬로' , 'th': 'KFUM ออสโล' , 'pt': 'KFUM Oslo' },
  'Kilmarnock': { 'ar': 'كيلمارنوك', 'zh-CN': '基尔马诺克', 'zh-TW': '基爾馬諾克', 'ru': 'Килмарнок', 'de': 'Kilmarnock' , 'ja': 'キルマーノック' , 'ko': '킬마녹' , 'th': 'คิลมาร์น็อค' , 'pt': 'Kilmarnock' },
  'Kitchee': { 'ar': 'كيتشي', 'zh-CN': '杰志', 'zh-TW': '傑志', 'ru': 'Китчи', 'de': 'Kitchee' , 'ja': 'キッチー' , 'ko': '킷치' , 'th': 'คิดชี' , 'pt': 'Kitchee' },
  'Kochi United SC': { 'ar': 'كوتشي يونايتد', 'zh-CN': '高知联', 'zh-TW': '高知聯', 'ru': 'Кочи Юнайтед СК', 'de': 'Kochi United SC' , 'ja': '高知ユナイテッドSC' , 'ko': '고치 유나이티드 SC' , 'th': 'โคจิ ยูไนเต็ด เอสซี' , 'pt': 'Kochi United SC' },
  'Kristiansund': { 'ar': 'كريستيانسوند', 'zh-CN': '克里斯蒂安松', 'zh-TW': '克里斯蒂安松', 'ru': 'Кристиансунн', 'de': 'Kristiansund' , 'ja': 'クリスチャンスン' , 'ko': '크리스티안순' , 'th': 'คริสเตียนซุนด์' , 'pt': 'Kristiansund' },
  'Kruger United': { 'ar': 'كروغر يونايتد', 'zh-CN': '克鲁格联', 'zh-TW': '克魯格聯', 'ru': 'Крюгер Юнайтед', 'de': 'Kruger United' , 'ja': 'クルーガー・ユナイテッド' , 'ko': '크루거 유나이티드' , 'th': 'ครูเกอร์ ยูไนเต็ด' , 'pt': 'Kruger United' },
  'Kryvbas': { 'ar': 'كريفباس', 'zh-CN': '克里夫巴斯', 'zh-TW': '克里夫巴斯', 'ru': 'Кривбасс', 'de': 'Kryvbas' , 'ja': 'クリフバス' , 'ko': '크리브바스' , 'th': 'คริฟบาส' , 'pt': 'Kryvbas' },
  'Kyoto Sanga': { 'es': 'Kyoto Sanga', 'zh-CN': '京都不死鸟', 'zh-TW': '京都不死鳥', 'ru': 'Киото Санга', 'de': 'Kyoto Sanga' , 'ja': '京都サンガ' , 'ko': '교토 상가' , 'th': 'เกียวโต ซังกะ' , 'pt': 'Kyoto Sanga' },
  'Kyoto Sanga FC': { 'es': 'Kyoto Sanga', 'zh-CN': '京都不死鸟', 'zh-TW': '京都不死鳥', 'ru': 'Киото Санга', 'de': 'Kyoto Sanga FC' , 'ja': '京都サンガFC' , 'ko': '교토 상가 FC' , 'th': 'เกียวโต แซงก้า เอฟซี' , 'pt': 'Kyoto Sanga FC' },
  'LA Galaxy': { 'ja': 'ロサンゼルス・ギャラクシー', 'ko': 'LA 갤럭시', 'ru': 'ЛА Гэлакси', 'th': 'แอลเอ แกแลกซี' , 'de': 'LA Galaxy' , 'pt': 'LA Galaxy' },
  'Langwarrin SC': { 'ar': 'لانغوارين', 'zh-CN': '朗沃林', 'zh-TW': '朗沃林', 'ru': 'Лацио', 'de': 'Langwarrin SC' , 'ja': 'ラングワーリン SC' , 'ko': '랑와린 SC' , 'th': 'แลงวาร์ริน เอสซี' , 'pt': 'Langwarrin SC' },
  'Lanus': { 'es': 'Lanús', 'zh-CN': '拉努斯', 'zh-TW': '拉努斯', 'ru': 'Ланус', 'de': 'Lanus' , 'ja': 'ラナス' , 'ko': '라누스' , 'th': 'ลานุส' , 'pt': 'Lanus' },
  'Las Palmas': { 'ja': 'ラス・パルマス', 'ko': '라스팔마스', 'ru': 'Лас-Пальмас', 'th': 'ลัสปัลมัส' , 'de': 'Las Palmas' , 'pt': 'Las Palmas' },
  'LASK': { 'ar': 'لاسك', 'zh-CN': '林茨', 'zh-TW': '林茨', 'ru': 'Лечче', 'de': 'LASK' , 'ja': 'ラスク' , 'ko': '라스크' , 'th': 'ลาสค์' , 'pt': 'LASK' },
  'Lazio': { 'es': 'Lazio', 'zh-CN': '拉齐奥', 'zh-TW': '拉齊奧', 'ru': 'Лацио', 'de': 'Lazio' , 'ja': 'ラツィオ' , 'ko': '라치오' , 'th': 'ลาซิโอ' , 'pt': 'Lazio' },
  'LDU de Quito': { 'ar': 'إل دي يو كيتو', 'ru': 'Лестер', 'de': 'LDU de Quito' , 'ja': 'LDU デ キト' , 'ko': 'LDU 데 키토' , 'th': 'แอลดียู เดอ กีโต' , 'pt': 'LDU de Quito' },
  'Le Havre': { 'ja': 'ル・アーヴル', 'ko': '르아브르', 'ru': 'Гавр', 'th': 'เลออาฟวร์' , 'de': 'Le Havre' , 'pt': 'Le Havre' },
  'Lecce': { 'ja': 'レッチェ', 'ko': '레체', 'ru': 'Лечче', 'th': 'เลชเช' , 'de': 'Lecce' , 'pt': 'Lecce' },
  'Lee Man': { 'zh-CN': '理文', 'zh-TW': '理文', 'ru': 'Ли Ман', 'de': 'Lee Man' , 'ja': 'リー・マン' , 'ko': '이만' , 'th': 'ลี มาน' , 'pt': 'Lee Man' },
  'Leeds United': { 'ar': 'ليدز يونايتد', 'zh-CN': '利兹联', 'zh-TW': '里茲聯', 'ru': 'Лидс Юнайтед', 'de': 'Leeds United' , 'ja': 'リーズ・ユナイテッド' , 'ko': '리즈 유나이티드' , 'th': 'ลีดส์ ยูไนเต็ด' , 'pt': 'Leeds United' },
  'Leganes': { 'ja': 'レガネス', 'ko': '레가네스', 'ru': 'Леганес', 'th': 'เลกาเนส' , 'de': 'Leganes' , 'pt': 'Leganes' },
  'Leicester': { 'es': 'Leicester', 'zh-CN': '莱斯特城', 'zh-TW': '萊斯特城', 'ru': 'Лестер', 'de': 'Leicester' , 'ja': 'レスター' , 'ko': '레스터' , 'th': 'เลสเตอร์' , 'pt': 'Leicester' },
  'Leicester City': { 'ar': 'ليستر سيتي', 'zh-CN': '莱斯特城', 'zh-TW': '萊斯特城', 'ru': 'Лилль', 'de': 'Leicester City' , 'ja': 'レスターシティ' , 'ko': '레스터시티' , 'th': 'เลสเตอร์ ซิตี้' , 'pt': 'Leicester City' },
  'Lens': { 'ja': 'ランス', 'ko': '랑스', 'ru': 'Ланс', 'th': 'ล็องส์' , 'de': 'Lens' , 'pt': 'Lens' },
  'Leon': { 'es': 'León', 'zh-CN': '莱昂', 'zh-TW': '萊昂', 'ru': 'Леон', 'de': 'Leon' , 'ja': 'レオン' , 'ko': '레온' , 'th': 'ลีออน' , 'pt': 'Leon' },
  'Lerumo Lions': { 'ar': 'ليرومو لايونز', 'zh-CN': '莱鲁莫雄狮', 'zh-TW': '萊魯莫雄獅', 'ru': 'Лерумо Лайонс', 'de': 'Lerumo Lions' , 'ja': 'レルモ・ライオンズ' , 'ko': '레루모 라이온스' , 'th': 'เลรูโม ไลออนส์' , 'pt': 'Lerumo Lions' },
  'Leyton Orient': { 'ar': 'ليتون أورينت', 'zh-CN': '莱顿东方', 'zh-TW': '萊頓東方', 'ru': 'Лейтон Ориент', 'de': 'Leyton Orient' , 'ja': 'レイトン・オリエント' , 'ko': '레이튼 오리엔트' , 'th': 'เลย์ตัน โอเรียนท์' , 'pt': 'Leyton Orient' },
  'Libertad': { 'ar': 'ليبيرتاد', 'ru': 'Либертад', 'de': 'Libertad' , 'ja': 'リベルタ' , 'ko': '리베르타드' , 'th': 'ลิเบอร์ตาด' , 'pt': 'Libertad' },
  'Lille': { 'ja': 'リール', 'ko': '릴', 'ru': 'Лилль', 'th': 'ลีล' , 'de': 'Lille' , 'pt': 'Lille' },
  'Lillestroem': { 'de': 'Lillestrøm', 'es': 'Lillestrøm', 'fr': 'Lillestrøm', 'ja': 'リールストロム', 'ko': '릴레스트룀',
 'pt': 'Lillestrøm', 'ru': 'Лиллестрём', 'zh-CN': '利勒斯特罗姆', 'zh-TW': '利勒斯特羅姆' , 'th': 'ลีลสตรอม' },
  'Lincoln': { 'es': 'Lincoln', 'zh-CN': '林肯城', 'zh-TW': '林肯城', 'ru': 'Ливерпуль', 'de': 'Lincoln' , 'ja': 'リンカーン' , 'ko': '링컨' , 'th': 'ลินคอล์น' , 'pt': 'Lincoln' },
  'Lincoln City': { 'ar': 'لينكولن سيتي', 'zh-CN': '林肯城', 'zh-TW': '林肯城', 'ru': 'Линкольн Сити', 'de': 'Lincoln City' , 'ja': 'リンカーンシティ' , 'ko': '링컨시티' , 'th': 'ลินคอล์น ซิตี้' , 'pt': 'Lincoln City' },
  'Lion City Sailors': { 'zh-CN': '狮城水手', 'zh-TW': '獅城水手', 'ru': 'Моряки Львиного города', 'de': 'Lion City Sailors' , 'ja': 'ライオン シティ セーラーズ' , 'ko': '라이온 시티 선원' , 'th': 'ลูกเรือเมืองสิงโต' , 'pt': 'Lion City Sailors' },
  'Liverpool': { 'ar': 'ليفربول', 'de': 'Liverpool', 'es': 'Liverpool', 'fr': 'Liverpool', 'ja': 'リヴァプール', 'ko': '리버풀',
 'pt': 'Liverpool', 'ru': 'Ливерпуль', 'zh-CN': '利物浦', 'zh-TW': '利物浦' , 'th': 'ลิเวอร์พูล' },
  'Liverpool U18': { 'ar': 'ليفربول تحت 18', 'ru': 'Лутон', 'de': 'Liverpool U18' , 'ja': 'リバプール U18' , 'ko': '리버풀 U18' , 'th': 'ลิเวอร์พูล U18' , 'pt': 'Liverpool U18' },
  'Livingston': { 'ar': 'ليفينغستون', 'zh-CN': '利文斯顿', 'zh-TW': '利文斯頓', 'ru': 'Ливингстон', 'de': 'Livingston' , 'ja': 'リヴィングストン' , 'ko': '리빙스턴' , 'th': 'ลิฟวิงสตัน' , 'pt': 'Livingston' },
  'Logan Lightning': { 'ar': 'لوغان لايتنينغ', 'zh-CN': '洛根闪电', 'zh-TW': '洛根閃電', 'ru': 'Логан Молния', 'de': 'Logan Lightning' , 'ja': 'ローガン・ライトニング' , 'ko': '로건 라이트닝' , 'th': 'โลแกน ไลท์นิ่ง' , 'pt': 'Logan Lightning' },
  'Lommel': { 'ar': 'لوميل', 'zh-CN': '洛默尔', 'zh-TW': '洛默爾', 'ru': 'Ломмель', 'de': 'Lommel' , 'ja': 'ロンメル' , 'ko': '롬멜' , 'th': 'ลอมเมล' , 'pt': 'Lommel' },
  'Longford Town': { 'ar': 'لونغفورد تاون', 'zh-CN': '朗福德镇', 'zh-TW': '朗福德鎮', 'ru': 'Лонгфорд Таун', 'de': 'Longford Town' , 'ja': 'ロングフォードタウン' , 'ko': '롱포드 타운' , 'th': 'ลองฟอร์ด ทาวน์' , 'pt': 'Longford Town' },
  'Lorient': { 'ja': 'ロリアン', 'ko': '로리앙', 'ru': 'Лорьян', 'th': 'ลอรีย็อง' , 'de': 'Lorient' , 'pt': 'Lorient' },
  'Los Angeles FC': { 'es': 'LAFC', 'zh-CN': '洛杉矶FC', 'zh-TW': '洛杉磯FC', 'ru': 'Лион', 'de': 'Los Angeles FC' , 'ja': 'ロサンゼルスFC' , 'ko': '로스앤젤레스 FC' , 'th': 'ลอสแอนเจลิส เอฟซี' , 'pt': 'Los Angeles FC' },
  'Los Chankas CYC': { 'ar': 'لوس شانكاس', 'ru': 'Лос-Чанкас CYC', 'de': 'Los Chankas CYC' , 'ja': 'ロス チャンカス CYC' , 'ko': '로스 찬카스 CYC' , 'th': 'ลอส ชังกัส CYC' , 'pt': 'Los Chankas CYC' },
  'Luton Town': { 'ar': 'لوتون تاون', 'de': 'Luton Town', 'es': 'Luton Town', 'fr': 'Luton Town', 'ja': 'ルートン・タウン', 'ko': '루턴 타운',
 'pt': 'Luton Town', 'ru': 'Лутон Таун', 'zh-CN': '卢顿', 'zh-TW': '盧頓' , 'th': 'ลูตัน ทาวน์' },
  'Lyngby': { 'ar': 'لينغبي', 'zh-CN': '林比', 'zh-TW': '林比', 'ru': 'Люнгбю', 'de': 'Lyngby' , 'ja': 'リンビー' , 'ko': '링비' , 'th': 'ลิงบี' , 'pt': 'Lyngby' },
  'Lyon': { 'ja': 'リヨン', 'ko': '리옹', 'ru': 'Лион', 'th': 'ลียง' , 'de': 'Lyon' , 'pt': 'Lyon' },
  'Lyon W': { 'ar': 'ليون (سيدات)', 'zh-CN': '里昂女足', 'zh-TW': '里昂女足', 'ru': 'Лион (Ж)', 'de': 'Lyon W' , 'ja': 'リヨン W' , 'ko': '리옹 여' , 'th': 'ลียง ดับเบิลยู' , 'pt': 'Lyon W' },
  'Maccabi Bnei Reineh': { 'ar': 'مكابي أبناء الرينة', 'ru': 'Маккаби Бней Рейне', 'de': 'Maccabi Bnei Reineh' , 'ja': 'マッカビ・ブネイ・ライネ' , 'ko': '마카비 브네이 레이네' , 'th': 'มัคคาบี้ บีไน เรเนห์' , 'pt': 'Maccabi Bnei Reineh' },
  'Maccabi Haifa': { 'ar': 'مكابي حيفا', 'zh-CN': '海法马卡比', 'zh-TW': '海法馬卡比', 'ru': 'Маккаби Хайфа', 'de': 'Maccabi Haifa' , 'ja': 'マッカビ ハイファ' , 'ko': '마카비 하이파' , 'th': 'มัคคาบี้ ไฮฟา' , 'pt': 'Maccabi Haifa' },
  'Maccabi Netanya': { 'zh-CN': '内坦亚马卡比', 'zh-TW': '內坦亞馬卡比', 'ru': 'Маккаби Нетания', 'de': 'Maccabi Netanya' , 'ja': 'マッカビ・ネタニヤ' , 'ko': '마카비 네타냐' , 'th': 'มัคคาบี เนทันยา' , 'pt': 'Maccabi Netanya' },
  'Maccabi Tel Aviv': { 'ar': 'مكابي تل أبيب', 'zh-CN': '特拉维夫马卡比', 'zh-TW': '特拉維夫馬卡比', 'ru': 'Маккаби Тель-Авив', 'de': 'Maccabi Tel Aviv' , 'ja': 'マッカビ テルアビブ' , 'ko': '마카비 텔아비브' , 'th': 'มัคคาบี้เทลอาวีฟ' , 'pt': 'Maccabi Tel Aviv' },
  'Machida Zelvia': { 'es': 'Machida Zelvia', 'zh-CN': '町田泽维亚', 'zh-TW': '町田澤維亞', 'ru': 'Мачида Зельвия', 'de': 'Machida Zelvia' , 'ja': '町田ゼルビア' , 'ko': '마치다 젤비아' , 'th': 'มาชิดะ เซลเวีย' , 'pt': 'Machida Zelvia' },
  'Macva Sabac': { 'ar': 'ماتشفا شاباتس', 'ru': 'Манчестер Сити', 'de': 'Macva Sabac' , 'ja': 'マクバ・サバツ' , 'ko': '마크바 사박' , 'th': 'มัควา ซาบัค' , 'pt': 'Macva Sabac' },
  'Mainz 05': { 'ar': 'ماينز', 'zh-CN': '美因茨', 'zh-TW': '美因茨', 'ru': 'Майнц 05', 'de': 'Mainz 05' , 'ja': 'マインツ05' , 'ko': '마인츠 05' , 'th': 'ไมนซ์ 05' , 'pt': 'Mainz 05' },
  'Malkia': { 'ar': 'المالكية', 'ru': 'Малкиа', 'de': 'Malkia' , 'ja': 'マルキア' , 'ko': '말키아' , 'th': 'มัลเกีย' , 'pt': 'Malkia' },
  'Mallorca': { 'ja': 'マジョルカ', 'ko': '마요르카', 'ru': 'Мальорка', 'th': 'มายอร์กา' , 'de': 'Mallorca' , 'pt': 'Mallorca' },
  'Mamelodi Sundowns FC': { 'ar': 'ماميلودي صن داونز', 'ru': 'Манчестер Юнайтед', 'de': 'Mamelodi Sundowns FC' , 'ja': 'マメロディ・サンダウンズFC' , 'ko': '마멜로디 선다운스 FC' , 'th': 'มาเมโลดี้ ซันดาวน์ส เอฟซี' , 'pt': 'Mamelodi Sundowns FC' },
  'Manchester City': { 'ar': 'مانشستر سيتي', 'de': 'Manchester City', 'es': 'Manchester City', 'fr': 'Manchester City', 'ja': 'マンチェスター・シティ', 'ko': '맨체스터 시티',
 'pt': 'Manchester City', 'ru': 'Манчестер Сити', 'zh-CN': '曼城', 'zh-TW': '曼城' , 'th': 'แมนเชสเตอร์ ซิตี้' },
  'Manchester United': { 'ar': 'مانشستر يونايتد', 'de': 'Manchester United', 'es': 'Manchester United', 'fr': 'Manchester United', 'ja': 'マンチェスター・ユナイテッド', 'ko': '맨체스터 유나이티드',
 'pt': 'Manchester United', 'ru': 'Манчестер Юнайтед', 'zh-CN': '曼联', 'zh-TW': '曼聯' , 'th': 'แมนเชสเตอร์ ยูไนเต็ด' },
  'Manchester United U18': { 'ar': 'مانشستر يونايتد تحت 18', 'ru': 'Манчестер Юнайтед U18', 'de': 'Manchester United U18' , 'ja': 'マンチェスター・ユナイテッド U18' , 'ko': '맨체스터 유나이티드 U18' , 'th': 'แมนเชสเตอร์ ยูไนเต็ด U18' , 'pt': 'Manchester United U18' },
  'Manningham United Blues': { 'ar': 'مانينغهام يونايتد بلوز', 'zh-CN': '曼宁汉联蓝', 'zh-TW': '曼寧漢聯藍', 'ru': 'Мэннингем Юнайтед Блюз', 'de': 'Manningham United Blues' , 'ja': 'マニンガム・ユナイテッド・ブルース' , 'ko': '매닝햄 유나이티드 블루스' , 'th': 'แมนนิ่งแฮม ยูไนเต็ด บลูส์' , 'pt': 'Manningham United Blues' },
  'Mansfield': { 'es': 'Mansfield', 'zh-CN': '曼斯菲尔德', 'zh-TW': '曼斯菲爾德', 'ru': 'Марсель', 'de': 'Mansfield' , 'ja': 'マンスフィールド' , 'ko': '맨스필드' , 'th': 'แมนส์ฟิลด์' , 'pt': 'Mansfield' },
  'Mansfield Town': { 'ar': 'مانسفيلد تاون', 'zh-CN': '曼斯菲尔德', 'zh-TW': '曼斯菲爾德', 'ru': 'Мэнсфилд Таун', 'de': 'Mansfield Town' , 'ja': 'マンスフィールドタウン' , 'ko': '맨스필드 타운' , 'th': 'แมนส์ฟิลด์ ทาวน์' , 'pt': 'Mansfield Town' },
  'Mara Sugar': { 'ar': 'مارا شوغر', 'zh-CN': '马拉糖业', 'zh-TW': '馬拉糖業', 'ru': 'Мара Шугар', 'de': 'Mara Sugar' , 'ja': 'マラシュガー' , 'ko': '마라슈가' , 'th': 'มาร่า ชูการ์' , 'pt': 'Mara Sugar' },
  'Maribor': { 'de': 'Maribor', 'es': 'Maribor', 'fr': 'Maribor', 'ja': 'マリボル', 'ko': '마리보르',
 'pt': 'Maribor', 'ru': 'Марибор', 'zh-CN': '马里博尔', 'zh-TW': '馬里博爾' , 'th': 'มาริบอร์' },
  'Marsaxlokk FC': { 'ar': 'مارساشلوك', 'zh-CN': '马尔萨什洛克', 'zh-TW': '馬爾薩什洛克', 'ru': 'Марсашлокк ФК', 'de': 'Marsaxlokk FC' , 'ja': 'マルサシュロックFC' , 'ko': '마삭슬로크 FC' , 'th': 'มาร์แซ็กลอกก์ เอฟซี' , 'pt': 'Marsaxlokk FC' },
  'Marseille': { 'es': 'Marsella', 'ja': 'マルセイユ', 'ko': '마르세유', 'ru': 'Марсель', 'th': 'มาร์แซย์', 'zh-CN': '马赛', 'zh-TW': '馬賽' , 'de': 'Marseille' , 'pt': 'Marseille' },
  'Mathare United': { 'ar': 'ماثاري يونايتد', 'zh-CN': '马塔雷联', 'zh-TW': '馬塔雷聯', 'ru': 'Мидлсбро', 'de': 'Mathare United' , 'ja': 'マタレ・ユナイテッド' , 'ko': '마타레 유나이티드' , 'th': 'มาธาร์ ยูไนเต็ด' , 'pt': 'Mathare United' },
  'Matsumoto Yamaga': { 'es': 'Matsumoto Yamaga', 'zh-CN': '松本山雅', 'zh-TW': '松本山雅', 'ru': 'Мацумото Ямага', 'de': 'Matsumoto Yamaga' , 'ja': '松本山雅' , 'ko': '마츠모토 야마가' , 'th': 'มัตสึโมโตะ ยามากะ' , 'pt': 'Matsumoto Yamaga' },
  'Mazatlan': { 'es': 'Mazatlán', 'zh-CN': '马萨特兰', 'zh-TW': '馬薩特蘭', 'ru': 'Миллуолл', 'de': 'Mazatlan' , 'ja': 'マサトラン' , 'ko': '마사틀란' , 'th': 'มาซัตลัน' , 'pt': 'Mazatlan' },
  'Mazatlan FC': { 'es': 'Mazatlán FC', 'zh-CN': '马萨特兰', 'zh-TW': '馬薩特蘭', 'ru': 'Масатлан ​​ФК', 'de': 'Mazatlan FC' , 'ja': 'マサトランFC' , 'ko': '마사틀란 FC' , 'th': 'มาซัตลัน เอฟซี' , 'pt': 'Mazatlan FC' },
  'Melbourne Srbija': { 'ar': 'ملبورن صربيا', 'zh-CN': '墨尔本塞尔维亚', 'zh-TW': '墨爾本塞爾維亞', 'ru': 'Мельбурн Сербия', 'de': 'Melbourne Srbija' , 'ja': 'メルボルン スルビア' , 'ko': '멜버른 스르비자' , 'th': 'เมลเบิร์น เซอร์บิจา' , 'pt': 'Melbourne Srbija' },
  'Melbourne Victory': { 'ja': 'メルボルン・ビクトリー', 'ko': '멜버른 빅토리', 'ru': 'Мельбурн Виктори', 'th': 'เมลเบิร์นวิกทอรี' , 'de': 'Melbourne Victory' , 'pt': 'Melbourne Victory' },
  'Middelfart': { 'ar': 'ميدلفارت', 'zh-CN': '米德尔法特', 'zh-TW': '米德爾法特', 'ru': 'Миддельфарт', 'de': 'Middelfart' , 'ja': 'ミゼルファート' , 'ko': '미델파르트' , 'th': 'มิดเดลฟาร์ต' , 'pt': 'Middelfart' },
  'Middlesbrough': { 'ar': 'ميدلزبره', 'zh-CN': '米德尔斯堡', 'zh-TW': '米德爾斯堡', 'ru': 'Мидлсбро', 'de': 'Middlesbrough' , 'ja': 'ミドルズブラ' , 'ko': '미들즈브러' , 'th': 'มิดเดิ้ลสโบรช์' , 'pt': 'Middlesbrough' },
  'Midlands Wanderers': { 'ar': 'ميدلاندز واندررز', 'ru': 'Мидлендс Уондерерс', 'de': 'Midlands Wanderers' , 'ja': 'ミッドランドワンダラーズ' , 'ko': '미들랜드 원더러스' , 'th': 'มิดแลนด์พเนจร' , 'pt': 'Midlands Wanderers' },
  'Miercurea Ciuc': { 'ar': 'ميركوريا تشيوك', 'zh-CN': '米耶尔库雷亚丘克', 'zh-TW': '米耶爾庫雷亞丘克', 'ru': 'Меркуря Чук', 'de': 'Miercurea Ciuc' , 'ja': 'ミエルキュレア・チュク' , 'ko': '미에르쿠레아 치우크' , 'th': 'มีร์คูเรีย ชุค' , 'pt': 'Miercurea Ciuc' },
  'Milan': { 'es': 'Milan', 'zh-CN': 'AC米兰', 'zh-TW': 'AC米蘭', 'ru': 'Милан', 'de': 'Milan' , 'ja': 'ミラノ' , 'ko': '밀라노' , 'th': 'มิลาน' , 'pt': 'Milan' },
  'Millonarios': { 'ar': 'ميلوناريوس', 'ru': 'Мольде', 'de': 'Millonarios' , 'ja': 'ミロナリオス' , 'ko': '밀로나리오스' , 'th': 'มิลโลนาริโอส' , 'pt': 'Millonarios' },
  'Millwall': { 'ar': 'ميلوول', 'zh-CN': '米尔沃尔', 'zh-TW': '米爾沃爾', 'ru': 'Миллуолл', 'de': 'Millwall' , 'ja': 'ミルウォール' , 'ko': '밀월' , 'th': 'มิลล์วอลล์' , 'pt': 'Millwall' },
  'Milton Keynes Dons': { 'ar': 'ميلتون كينز دونز', 'zh-CN': '米尔顿凯恩斯', 'zh-TW': '米爾頓凱恩斯', 'ru': 'Милтон Кейнс Донс', 'de': 'Milton Keynes Dons' , 'ja': 'ミルトン・ケインズ・ドンズ' , 'ko': '밀턴 케인스 던스' , 'th': 'มิลตัน คียนส์ ดอนส์' , 'pt': 'Milton Keynes Dons' },
  'Mineros de Zacatecas': { 'es': 'Mineros de Zacatecas', 'zh-CN': '萨卡特卡斯矿工', 'zh-TW': '薩卡特卡斯礦工', 'ru': 'Минерос-де-Сакатекас', 'de': 'Mineros de Zacatecas' , 'ja': 'ミネロス デ サカテカス' , 'ko': '미네로스 데 사카테카스' , 'th': 'มิเนรอส เด ซากาเตกัส' , 'pt': 'Mineros de Zacatecas' },
  'MIO Biwako Shiga': { 'es': 'MIO Biwako Shiga', 'zh-CN': '滋贺琵琶湖', 'zh-TW': '滋賀琵琶湖', 'ru': 'МИО Бивако Сига', 'de': 'MIO Biwako Shiga' , 'ja': 'MIO びわ湖 滋賀' , 'ko': 'MIO 비와코 시가' , 'th': 'มิโอะ บิวาโกะ ชิกะ' , 'pt': 'MIO Biwako Shiga' },
  'Mirassol': { 'ar': 'ميراسول', 'ru': 'Мирасол', 'de': 'Mirassol' , 'ja': 'ミラソル' , 'ko': '미라솔' , 'th': 'มิราสโซล' , 'pt': 'Mirassol' },
  'Mito Hollyhock': { 'es': 'Mito Hollyhock', 'zh-CN': '水户蜀葵', 'zh-TW': '水戶蜀葵', 'ru': 'Мито Холлихок', 'de': 'Mito Hollyhock' , 'ja': '水戸ホーリーホック' , 'ko': '미토 접시꽃' , 'th': 'มิโตะ ฮอลลี่ฮ็อค' , 'pt': 'Mito Hollyhock' },
  'Mito HollyHock': { 'es': 'Mito Hollyhock', 'zh-CN': '水户蜀葵', 'zh-TW': '水戶蜀葵', 'ru': 'Монако', 'de': 'Mito HollyHock' , 'ja': '水戸ホーリーホック' , 'ko': '미토 홀리호크' , 'th': 'มิโตะ ฮอลลี่ฮ็อค' , 'pt': 'Mito HollyHock' },
  'MK Dons': { 'es': 'MK Dons', 'zh-CN': '米尔顿凯恩斯', 'zh-TW': '米爾頓凱恩斯', 'ru': 'МК Донс', 'de': 'MK Dons' , 'ja': 'MKドンズ' , 'ko': 'MK 돈스' , 'th': 'เอ็มเค ดอนส์' , 'pt': 'MK Dons' },
  'Mladost Lucani': { 'zh-CN': '卢查尼青年', 'zh-TW': '盧查尼青年', 'ru': 'Монтеррей', 'de': 'Mladost Lucani' , 'ja': 'ムラドスト・ルカニ' , 'ko': '믈라도스트 루카니' , 'th': 'มลาดอสต์ ลูคานี่' , 'pt': 'Mladost Lucani' },
  'Modbury Jets': { 'ar': 'مودبوري جيتس', 'zh-CN': '莫德伯里喷气机', 'zh-TW': '莫德伯里噴射機', 'ru': 'Модбери Джетс', 'de': 'Modbury Jets' , 'ja': 'モドベリー ジェッツ' , 'ko': '모드베리 제트' , 'th': 'มอดเบอรี เจ็ตส์' , 'pt': 'Modbury Jets' },
  'Modern Sport': { 'zh-CN': '现代体育', 'zh-TW': '現代體育', 'ru': 'Современный спорт', 'de': 'Modern Sport' , 'ja': 'モダンスポーツ' , 'ko': '현대 스포츠' , 'th': 'กีฬาสมัยใหม่' , 'pt': 'Modern Sport' },
  'Modern Sport FC': { 'ar': 'مودرن سبورت', 'ru': 'Модерн Спорт ФК', 'de': 'Modern Sport FC' , 'ja': 'モダンスポーツFC' , 'ko': '모던 스포츠 FC' , 'th': 'โมเดิร์นสปอร์ตเอฟซี' , 'pt': 'Modern Sport FC' },
  'Molde': { 'ar': 'مولده', 'zh-CN': '莫尔德', 'zh-TW': '莫爾德', 'ru': 'Молде', 'de': 'Molde' , 'ja': 'モルデ' , 'ko': '몰데' , 'th': 'โมลเด' , 'pt': 'Molde' },
  'Molynes United': { 'ar': 'مولينز يونايتد', 'ru': 'Молинес Юнайтед', 'de': 'Molynes United' , 'ja': 'モリンズ・ユナイテッド' , 'ko': '몰린스 유나이티드' , 'th': 'โมลีนส์ ยูไนเต็ด' , 'pt': 'Molynes United' },
  'Monaco': { 'ja': 'モナコ', 'ko': '모나코', 'ru': 'Монако', 'th': 'โมนาโก' , 'de': 'Monaco' , 'pt': 'Monaco' },
  'Montedio Yamagata': { 'es': 'Montedio Yamagata', 'zh-CN': '山形山神', 'zh-TW': '山形山神', 'ru': 'Монца', 'de': 'Montedio Yamagata' , 'ja': 'モンテディオ山形' , 'ko': '몬테디오 야마가타' , 'th': 'มอนเตดิโอ ยามากาตะ' , 'pt': 'Montedio Yamagata' },
  'Montego Bay United FC': { 'ar': 'مونتيغو باي يونايتد', 'ru': 'Монтего Бэй Юнайтед', 'de': 'Montego Bay United FC' , 'ja': 'モンテゴ ベイ ユナイテッド FC' , 'ko': '몬테고 베이 유나이티드 FC' , 'th': 'มอนเตโก เบย์ ยูไนเต็ด เอฟซี' , 'pt': 'Montego Bay United FC' },
  'Monterrey': { 'ja': 'モンテレイ', 'ko': '몬테레이', 'ru': 'Монтеррей', 'th': 'มอนเตร์เรย์' , 'de': 'Monterrey' , 'pt': 'Monterrey' },
  'Montevideo City Torque': { 'ar': 'مونتيفيديو سيتي توركي', 'ru': 'Монтевидео Сити Крутящий момент', 'de': 'Montevideo City Torque' , 'ja': 'モンテビデオ シティ トルク' , 'ko': '몬테비데오 시티 토크' , 'th': 'มอนเตวิเดโอ ซิตี้ ทอร์ก' , 'pt': 'Montevideo City Torque' },
  'Montpellier': { 'ja': 'モンペリエ', 'ko': '몽펠리에', 'ru': 'Монпелье', 'th': 'มงเปอลีเย' , 'de': 'Montpellier' , 'pt': 'Montpellier' },
  'Monza': { 'ja': 'モンツァ', 'ko': '몬차', 'ru': 'Монца', 'th': 'มอนซา' , 'de': 'Monza' , 'pt': 'Monza' },
  'Mosta': { 'zh-CN': '莫斯塔', 'zh-TW': '莫斯塔', 'ru': 'Моста', 'de': 'Mosta' , 'ja': 'モスタ' , 'ko': '모스타' , 'th': 'มอสตา' , 'pt': 'Mosta' },
  'Motherwell': { 'ar': 'ماذرويل', 'zh-CN': '马瑟韦尔', 'zh-TW': '馬瑟韋爾', 'ru': 'Мазервелл', 'de': 'Motherwell' , 'ja': 'マザーウェル' , 'ko': '마더웰' , 'th': 'มาเธอร์เวลล์' , 'pt': 'Motherwell' },
  'MSK Zilina': { 'zh-CN': '日利纳', 'zh-TW': '日利納', 'ru': 'МСК Жилина', 'de': 'MSK Zilina' , 'ja': 'MSK ジリナ' , 'ko': 'MSK 질리나' , 'th': 'เอ็มเอสเค ซิลิน่า' , 'pt': 'MSK Zilina' },
  'Mtibwa Sugar': { 'ar': 'متيبوا شوغر', 'zh-CN': '姆蒂布瓦糖业', 'zh-TW': '姆蒂布瓦糖業', 'ru': 'Мтибва Сахар', 'de': 'Mtibwa Sugar' , 'ja': 'ムティブワシュガー' , 'ko': '음티브와 설탕' , 'th': 'มิติบวา ชูการ์' , 'pt': 'Mtibwa Sugar' },
  'Muharraq': { 'ar': 'المحرق', 'ru': 'Мухаррак', 'de': 'Muharraq' , 'ja': 'ムハーラク島' , 'ko': '무하라크' , 'th': 'มูฮาร์รัค' , 'pt': 'Muharraq' },
  'Naft Maysan': { 'zh-CN': '迈桑石油', 'zh-TW': '邁桑石油', 'ru': 'Нафт Майсан', 'de': 'Naft Maysan' , 'ja': 'ナフト メイサン' , 'ko': '나프트 마이산' , 'th': 'นาฟ เมย์ซาน' , 'pt': 'Naft Maysan' },
  'Naftan Novopolotsk': { 'ar': 'نافتان نوفوبولوتسك', 'zh-CN': '新波洛茨克纳夫坦', 'zh-TW': '新波洛茨克納夫坦', 'ru': 'Нафтан Новополоцк', 'de': 'Naftan Novopolotsk' , 'ja': 'ナフタン・ノヴォポロツク' , 'ko': '나프탄 노보폴로츠크' , 'th': 'นาฟตาน โนโวโปลอตสค์' , 'pt': 'Naftan Novopolotsk' },
  'Nagano Parceiro': { 'ar': 'ناغانو بارسيرو', 'zh-CN': '长野帕塞罗', 'zh-TW': '長野帕塞羅', 'ru': 'Наполи', 'de': 'Nagano Parceiro' , 'ja': '長野パルセイロ' , 'ko': '나가노 파르세이로' , 'th': 'นากาโนะ ปาร์เซโร่' , 'pt': 'Nagano Parceiro' },
  'Nagoya Grampus': { 'ja': '名古屋グランパス', 'ko': '나고야 그램퍼스', 'ru': 'Нагоя Грампус', 'th': 'นาโงยะแกรมปัส' , 'de': 'Nagoya Grampus' , 'pt': 'Nagoya Grampus' },
  'Namdhari FC': { 'ar': 'نامدهاري', 'ru': 'Намдхари ФК', 'de': 'Namdhari FC' , 'ja': 'ナムダリFC' , 'ko': '남다리 FC' , 'th': 'นัมดารี เอฟซี' , 'pt': 'Namdhari FC' },
  'Namungo FC': { 'ar': 'نامونغو', 'zh-CN': '纳蒙戈', 'zh-TW': '納蒙戈', 'ru': 'Намунго ФК', 'de': 'Namungo FC' , 'ja': 'ナムンゴFC' , 'ko': '나무고FC' , 'th': 'นามุงโก เอฟซี' , 'pt': 'Namungo FC' },
  'Nantes': { 'ja': 'ナント', 'ko': '낭트', 'ru': 'Нант', 'th': 'น็องต์' , 'de': 'Nantes' , 'pt': 'Nantes' },
  'Napoli': { 'es': 'Napoli', 'zh-CN': '那不勒斯', 'zh-TW': '拿坡里', 'de': 'SSC Neapel', 'ru': 'Неаполь', 'ja': 'ナポリ' , 'ko': '나폴리' , 'th': 'นาโปลี' , 'pt': 'Napoli' },
  'Napredak': { 'ar': 'نابريداك', 'ru': 'Напредак', 'de': 'Napredak' , 'ja': 'ナプレダック' , 'ko': '나프레닥' , 'th': 'นปรีดาก' , 'pt': 'Napredak' },
  'Nara Club': { 'es': 'Nara Club', 'zh-CN': '奈良俱乐部', 'zh-TW': '奈良俱樂部', 'ru': 'Нара Клуб', 'de': 'Nara Club' , 'ja': 'ならクラブ' , 'ko': '나라클럽' , 'th': 'นารา คลับ' , 'pt': 'Nara Club' },
  'Nashville SC': { 'ar': 'ناشفيل', 'ru': 'Нэшвилл СК', 'de': 'Nashville SC' , 'ja': 'ナッシュビルSC' , 'ko': '내슈빌 SC' , 'th': 'แนชวิลล์เอสซี' , 'pt': 'Nashville SC' },
  'National Bank': { 'zh-CN': '国家银行', 'zh-TW': '國家銀行', 'ru': 'Национальный Банк', 'de': 'National Bank' , 'ja': '国立銀行' , 'ko': '국립은행' , 'th': 'ธนาคารแห่งชาติ' , 'pt': 'National Bank' },
  'Naxxar Lions FC': { 'ar': 'ناشار لايونز', 'zh-CN': '纳克萨雄狮', 'zh-TW': '納克薩雄獅', 'ru': 'Ньюкасл', 'de': 'Naxxar Lions FC' , 'ja': 'ナッシャー・ライオンズFC' , 'ko': '낙사르 라이온스 FC' , 'th': 'นัคซาร์ ไลออนส์ เอฟซี' , 'pt': 'Naxxar Lions FC' },
  'Necaxa': { 'ar': 'نيكاكسا', 'ru': 'Некакса', 'de': 'Necaxa' , 'ja': 'ネカクサ' , 'ko': '네카사' , 'th': 'เนกซา' , 'pt': 'Necaxa' },
  'New York City FC': { 'es': 'New York City', 'zh-CN': '纽约城', 'zh-TW': '紐約城', 'ru': 'Нью-Йорк Сити', 'de': 'New York City FC' , 'ja': 'ニューヨーク シティ FC' , 'ko': '뉴욕 시티 FC' , 'th': 'นิวยอร์ก ซิตี้ เอฟซี' , 'pt': 'New York City FC' },
  'Newcastle': { 'ar': 'نيوكاسل', 'de': 'Newcastle', 'es': 'Newcastle', 'fr': 'Newcastle', 'ja': 'ニューカッスル', 'ko': '뉴캐슬',
 'pt': 'Newcastle', 'ru': 'Ньюкасл', 'zh-CN': '纽卡斯尔联', 'zh-TW': '紐卡索聯' , 'th': 'นิวคาสเซิ่ล' },
  'Newcastle United': { 'ar': 'نيوكاسل', 'de': 'Newcastle', 'es': 'Newcastle', 'fr': 'Newcastle', 'ja': 'ニューカッスル', 'ko': '뉴캐슬',
 'pt': 'Newcastle', 'ru': 'Ньюкасл', 'zh-CN': '纽卡斯尔联', 'zh-TW': '紐卡索聯' , 'th': 'นิวคาสเซิ่ล ยูไนเต็ด' },
  'Newells Old Boys': { 'es': 'Newells Old Boys', 'zh-CN': '纽维尔老男孩', 'zh-TW': '紐維爾舊生', 'ru': 'Ньюэллс Олд Бойз', 'de': 'Newells Old Boys' , 'ja': 'ニューウェルズ・オールド・ボーイズ' , 'ko': '뉴웰스 올드 보이즈' , 'th': 'นีเวลล์ส โอลด์ บอยส์' , 'pt': 'Newells Old Boys' },
  'Newport': { 'es': 'Newport', 'zh-CN': '纽波特郡', 'zh-TW': '紐波特郡', 'ru': 'Ньюпорт', 'de': 'Newport' , 'ja': 'ニューポート' , 'ko': '뉴포트' , 'th': 'นิวพอร์ต' , 'pt': 'Newport' },
  'Newport County': { 'ar': 'نيوبورت كونتي', 'zh-CN': '纽波特郡', 'zh-TW': '紐波特郡', 'ru': 'округ Ньюпорт', 'de': 'Newport County' , 'ja': 'ニューポート郡' , 'ko': '뉴포트 카운티' , 'th': 'นิวพอร์ต เคาน์ตี้' , 'pt': 'Newport County' },
  'Newroz': { 'ar': 'نوروز', 'zh-CN': '诺鲁兹', 'zh-TW': '諾魯茲', 'ru': 'Навруз', 'de': 'Newroz' , 'ja': 'ネウローズ' , 'ko': '뉴로즈' , 'th': 'นิวรอซ' , 'pt': 'Newroz' },
  'Nice': { 'ja': 'ニース', 'ko': '니스', 'ru': 'Ницца', 'th': 'นิส' , 'de': 'Nice' , 'pt': 'Nice' },
  'NK Bravo': { 'de': 'NK Bravo', 'es': 'NK Bravo', 'fr': 'NK Bravo', 'ja': 'NKブラヴォ', 'ko': 'NK 브라보',
 'pt': 'NK Bravo', 'ru': 'НК Браво', 'zh-CN': '布拉沃', 'zh-TW': '布拉沃' , 'th': 'เอ็นเค บราโว่' },
  'NK Celje': { 'de': 'NK Celje', 'es': 'NK Celje', 'fr': 'NK Celje', 'ja': 'NKツェリェ', 'ko': 'NK 첼레',
 'pt': 'NK Celje', 'ru': 'НК Целе', 'zh-CN': '采列', 'zh-TW': '采列' , 'th': 'เอ็นเค เซลเย่' },
  'North Geelong Warriors': { 'ar': 'نورث جيلونغ ووريورز', 'zh-CN': '北吉朗勇士', 'zh-TW': '北吉朗勇士', 'ru': 'Одд', 'de': 'North Geelong Warriors' , 'ja': 'ノース ジーロング ウォリアーズ' , 'ko': '노스 질롱 워리어스' , 'th': 'นอร์ธ จีลอง วอร์ริเออร์ส' , 'pt': 'North Geelong Warriors' },
  'North Sunshine Eagles SC': { 'ar': 'نورث صنشاين إيغلز', 'zh-CN': '北阳光鹰', 'zh-TW': '北陽光鷹', 'ru': 'Ноттингем Форест', 'de': 'North Sunshine Eagles SC' , 'ja': 'ノースサンシャインイーグルスSC' , 'ko': '노스 선샤인 이글스 SC' , 'th': 'นอร์ธ ซันไชน์ อีเกิลส์ เอสซี' , 'pt': 'North Sunshine Eagles SC' },
  'Northampton': { 'es': 'Northampton', 'zh-CN': '北安普顿', 'zh-TW': '北安普頓', 'ru': 'Нортгемптон', 'de': 'Northampton' , 'ja': 'ノーザンプトン' , 'ko': '노샘프턴' , 'th': 'นอร์ธแฮมป์ตัน' , 'pt': 'Northampton' },
  'Northampton Town': { 'ar': 'نورثامبتون تاون', 'zh-CN': '北安普顿', 'zh-TW': '北安普頓', 'ru': 'Нортгемптон Таун', 'de': 'Northampton Town' , 'ja': 'ノーサンプトンタウン' , 'ko': '노샘프턴 타운' , 'th': 'นอร์ทแธมป์ตัน ทาวน์' , 'pt': 'Northampton Town' },
  'Norwich': { 'es': 'Norwich', 'zh-CN': '诺维奇', 'zh-TW': '諾維奇', 'ru': 'Норвич', 'de': 'Norwich' , 'ja': 'ノリッチ' , 'ko': '노리치' , 'th': 'นอริช' , 'pt': 'Norwich' },
  'Norwich City': { 'ar': 'نورويتش سيتي', 'zh-CN': '诺维奇', 'zh-TW': '諾維奇', 'ru': 'Норвич Сити', 'de': 'Norwich City' , 'ja': 'ノリッジシティ' , 'ko': '노리치 시티' , 'th': 'นอริช ซิตี้' , 'pt': 'Norwich City' },
  'Norwich City U18': { 'ar': 'نورويتش سيتي تحت 18', 'ru': 'Норвич Сити U18', 'de': 'Norwich City U18' , 'ja': 'ノリッジ シティ U18' , 'ko': '노리치 시티 U18' , 'th': 'นอริช ซิตี้ U18' , 'pt': 'Norwich City U18' },
  'Nottingham Forest': { 'ar': 'نوتينغهام فورست', 'de': 'Nottingham Forest', 'es': 'Nottingham Forest', 'fr': 'Nottingham Forest', 'ja': 'ノッティンガム・フォレスト', 'ko': '노팅엄 포레스트',
 'pt': 'Nottingham Forest', 'ru': 'Ноттингем Форест', 'zh-CN': '诺丁汉森林', 'zh-TW': '諾丁漢森林' , 'th': 'น็อตติ้งแฮม ฟอเรสต์' },
  'Notts County': { 'ar': 'نوتس كونتي', 'zh-CN': '诺茨郡', 'zh-TW': '諾茨郡', 'ru': 'Ноттс Каунти', 'de': 'Notts County' , 'ja': 'ノッツ郡' , 'ko': '노츠 카운티' , 'th': 'น็อตต์สเคาน์ตี้' , 'pt': 'Notts County' },
  'Novi Pazar': { 'ar': 'نوفي بازار', 'zh-CN': '新帕扎尔', 'zh-TW': '新帕扎爾', 'ru': 'Нови-Пазар', 'de': 'Novi Pazar' , 'ja': 'ノヴィ・パザール' , 'ko': '노비 파자르' , 'th': 'โนวี ปาซาร์' , 'pt': 'Novi Pazar' },
  'Nurnberg': { 'ar': 'نورنبرغ', 'zh-CN': '纽伦堡', 'zh-TW': '紐倫堡', 'ru': 'Нюрнберг', 'de': 'Nurnberg' , 'ja': 'ニュルンベルク' , 'ko': '뉘른베르크' , 'th': 'เนิร์นแบร์ก' , 'pt': 'Nurnberg' },
  'Odd': { 'ar': 'أود', 'zh-CN': '奥特', 'zh-TW': '奧特', 'ru': 'Странный', 'de': 'Odd' , 'ja': '奇数' , 'ko': '이상한' , 'th': 'แปลก' , 'pt': 'Odd' },
  'OFK Beograd': { 'ar': 'أو إف كيه بلغراد', 'zh-CN': '贝尔格莱德OFK', 'zh-TW': '貝爾格萊德OFK', 'ru': 'ОФК Белград', 'de': 'OFK Beograd' , 'ja': 'OFK ベオグラード' , 'ko': 'OFK 베오그라드' , 'th': 'โอเอฟเค เบโอกราด' , 'pt': 'OFK Beograd' },
  'OFK Vrsac': { 'ar': 'أو إف كيه فرشاتس', 'ru': 'ОФК Вршац', 'de': 'OFK Vrsac' , 'ja': 'OFK ヴルサック' , 'ko': 'OFK 브르삭' , 'th': 'โอเอฟเค วีรซาค' , 'pt': 'OFK Vrsac' },
  'Oita Albirex': { 'es': 'Albirex Niigata', 'zh-CN': '新潟天鹅', 'zh-TW': '新潟天鵝', 'ru': 'Оита Альбирекс', 'de': 'Oita Albirex' , 'ja': '大分アルビレックス' , 'ko': '오이타 알비렉스' , 'th': 'โออิตะ อัลบิเร็กซ์' , 'pt': 'Oita Albirex' },
  'Oita Trinita': { 'es': 'Oita Trinita', 'zh-CN': '大分三神', 'zh-TW': '大分三神', 'ru': 'Олимпиакос', 'de': 'Oita Trinita' , 'ja': '大分トリニータ' , 'ko': '오이타 트리니타' , 'th': 'โออิตะ ทรินิตะ' , 'pt': 'Oita Trinita' },
  'Okzhetpes Kokshetau': { 'ar': 'أوكجيتيبس', 'zh-CN': '奥克杰特佩斯', 'zh-TW': '奧克傑特佩斯', 'ru': 'Окжетпес Кокшетау', 'de': 'Okzhetpes Kokshetau' , 'ja': 'オクヘトペス・コクシェタウ' , 'ko': '옥제트페스 콕셰타우' , 'th': 'ออคเชตเปส ค็อกเชเตา' , 'pt': 'Okzhetpes Kokshetau' },
  'Oldham': { 'es': 'Oldham', 'zh-CN': '奥尔德姆', 'zh-TW': '奧爾德姆', 'ru': 'Олдем', 'de': 'Oldham' , 'ja': 'オールダム' , 'ko': '올덤' , 'th': 'โอลดัม' , 'pt': 'Oldham' },
  'Oldham Athletic': { 'ar': 'أولدهام أثلتيك', 'zh-CN': '奥尔德姆', 'zh-TW': '奧爾德姆', 'ru': 'Олдхэм Атлетик', 'de': 'Oldham Athletic' , 'ja': 'オールダム・アスレチック' , 'ko': '올드햄 애슬레틱' , 'th': 'โอลด์แฮม แอธเลติก' , 'pt': 'Oldham Athletic' },
  'Olimpija Ljubljana': { 'ar': 'أولمبيا ليوبليانا', 'zh-CN': '卢布尔雅那奥林匹亚', 'zh-TW': '盧布爾雅那奧林匹亞', 'ru': 'Олимпия Любляна', 'de': 'Olimpija Ljubljana' , 'ja': 'オリンピヤ リュブリャナ' , 'ko': '올림피야 류블랴나' , 'th': 'โอลิมปิยา ลูบลิยานา' , 'pt': 'Olimpija Ljubljana' },
  'Olympiakos': { 'ja': 'オリンピアコス', 'ko': '올림피아코스', 'ru': 'Олимпиакос', 'th': 'โอลิมเปียกอส' , 'de': 'Olympiakos' , 'pt': 'Olympiakos' },
  'Olympiakos Nicosia': { 'ar': 'أولمبياكوس نيقوسيا', 'zh-CN': '尼科西亚奥林匹亚', 'zh-TW': '尼科西亞奧林匹亞', 'ru': 'Олимпиакос Никосия', 'de': 'Olympiakos Nicosia' , 'ja': 'オリンピアコス ニコシア' , 'ko': '올림피아코스 니코시아' , 'th': 'โอลิมเปียกอส นิโคเซีย' , 'pt': 'Olympiakos Nicosia' },
  'Omiya Ardija': { 'es': 'Omiya Ardija', 'zh-CN': '大宫松鼠', 'zh-TW': '大宮松鼠', 'ru': 'Омия Ардия', 'de': 'Omiya Ardija' , 'ja': '大宮アルディージャ' , 'ko': '오미야 아르디자' , 'th': 'โอมิยะ อาร์ดิจา' , 'pt': 'Omiya Ardija' },
  'Omonia Aradippou': { 'ar': 'أومونيا أراديبو', 'zh-CN': '奥摩尼亚阿拉迪普', 'zh-TW': '奧摩尼亞阿拉迪普', 'ru': 'Омония Арадиппу', 'de': 'Omonia Aradippou' , 'ja': 'オモニア・アラディッポウ' , 'ko': '오모니아 아라디푸' , 'th': 'โอโมเนีย อาราดิปปู' , 'pt': 'Omonia Aradippou' },
  'Omonia Nicosia': { 'de': 'Omonia Nicosia', 'es': 'Omonia Nicosia', 'fr': 'Omonia Nicosia', 'ja': 'オモニア・ニコシア', 'ko': '오모니아 니코시아',
 'pt': 'Omonia Nicosia', 'ru': 'Омония Никосия', 'zh-CN': '奥莫尼亚', 'zh-TW': '奧摩尼亞' , 'th': 'โอโมเนีย นิโคเซีย' },
  'Ordabasy': { 'zh-CN': '奥达巴斯', 'zh-TW': '奧達巴斯', 'ru': 'Палмейрас', 'de': 'Ordabasy' , 'ja': 'オルダバシー' , 'ko': '오르다바시' , 'th': 'ออร์ดาบาซี' , 'pt': 'Ordabasy' },
  'Osasuna': { 'ja': 'オサスナ', 'ko': '오사수나', 'ru': 'Осасуна', 'th': 'โอซาซูนา' , 'de': 'Osasuna' , 'pt': 'Osasuna' },
  'Otelul Galati': { 'ar': 'أوتسيلول غالاتس', 'zh-CN': '加拉茨钢铁', 'zh-TW': '加拉茨鋼鐵', 'ru': 'Отельул Галати', 'de': 'Otelul Galati' , 'ja': 'オテルル ガラティ' , 'ko': '오텔룰 갈라티' , 'th': 'โอเตลุล กาลาติ' , 'pt': 'Otelul Galati' },
  'Oud-Heverlee Leuven': { 'ar': 'آود هيفيرلي لوفين', 'zh-CN': '旧海弗莱鲁汶', 'zh-TW': '奧德赫維里魯汶', 'ru': 'Уд-Хеверле Левен', 'de': 'Oud-Heverlee Leuven' , 'ja': 'ウード・ヘフェルレー・ルーヴェン' , 'ko': '오드-헤버리 루벤' , 'th': 'อู๊ด-เฮเวอร์ลี ลูเวน' , 'pt': 'Oud-Heverlee Leuven' },
  'Oxford': { 'es': 'Oxford', 'zh-CN': '牛津联', 'zh-TW': '牛津聯', 'ru': 'Панатинаикос', 'de': 'Oxford' , 'ja': 'オックスフォード' , 'ko': '옥스퍼드' , 'th': 'อ็อกซ์ฟอร์ด' , 'pt': 'Oxford' },
  'Oxford United': { 'ar': 'أكسفورد يونايتد', 'zh-CN': '牛津联', 'zh-TW': '牛津聯', 'ru': 'ПАОК', 'de': 'Oxford United' , 'ja': 'オックスフォード・ユナイテッド' , 'ko': '옥스퍼드 유나이티드' , 'th': 'อ็อกซ์ฟอร์ด ยูไนเต็ด' , 'pt': 'Oxford United' },
  'Pachuca': { 'ja': 'パチューカ', 'ko': '파추카', 'ru': 'Пачука', 'th': 'ปาชูกา' , 'de': 'Pachuca' , 'pt': 'Pachuca' },
  'Pacific FC': { 'ar': 'باسيفيك', 'ru': 'ПСЖ', 'de': 'Pacific FC' , 'ja': 'パシフィックFC' , 'ko': '퍼시픽 FC' , 'th': 'แปซิฟิค เอฟซี' , 'pt': 'Pacific FC' },
  'Pafos': { 'zh-CN': '帕福斯', 'zh-TW': '帕福斯', 'ru': 'Пафос', 'de': 'Pafos' , 'ja': 'パフォス' , 'ko': '파포스' , 'th': 'ปาฟอส' , 'pt': 'Pafos' },
  'Palermo': { 'ja': 'パレルモ', 'ko': '팔레르모', 'ru': 'Палермо', 'th': 'ปาแลร์โม' , 'de': 'Palermo' , 'pt': 'Palermo' },
  'Palmeiras': { 'ja': 'パルメイラス', 'ko': '파우메이라스', 'ru': 'Палмейрас', 'th': 'ปัลเมรัส' , 'de': 'Palmeiras' , 'pt': 'Palmeiras' },
  'Panathinaikos': { 'ja': 'パナシナイコス', 'ko': '파나티나이코스', 'ru': 'Панатинаикос', 'th': 'ปานาธีนาอีกอส' , 'de': 'Panathinaikos' , 'pt': 'Panathinaikos' },
  'PAOK': { 'ja': 'PAOK', 'ko': 'PAOK', 'ru': 'ПАОК', 'th': 'พีเอโอเค' , 'de': 'PAOK' , 'pt': 'PAOK' },
  'Paris Saint-Germain': { 'es': 'PSG', 'zh-CN': '巴黎圣日耳曼', 'zh-TW': '巴黎聖日耳曼', 'ru': 'Пари Сен-Жермен', 'de': 'Paris Saint-Germain' , 'ja': 'パリ・サンジェルマン' , 'ko': '파리 생제르맹' , 'th': 'ปารีส แซงต์-แชร์กแมง' , 'pt': 'Paris Saint-Germain' },
  'Parma': { 'ja': 'パルマ', 'ko': '파르마', 'ru': 'Парма', 'th': 'ปาร์มา' , 'de': 'Parma' , 'pt': 'Parma' },
  'Partick Thistle': { 'ar': 'بارتيك ثيسل', 'zh-CN': '帕特里克', 'zh-TW': '帕特里克', 'ru': 'Плимут', 'de': 'Partick Thistle' , 'ja': 'パーティク・アザミ' , 'ko': '파틱 시슬' , 'th': 'พาร์ทิค ทริสเทล' , 'pt': 'Partick Thistle' },
  'Partizan Beograd': { 'de': 'Partizan Belgrad', 'es': 'Partizán de Belgrado', 'fr': 'Partizan Belgrade', 'ja': 'パルチザン・ベオグラード', 'ko': '파르티잔 베오그라드',
 'pt': 'Partizan Belgrado', 'ru': 'Партизан Белград', 'zh-CN': '游击队', 'zh-TW': '游擊隊' , 'th': 'ปาร์ติซาน เบโอกราด' },
  'Patro Eisden': { 'ar': 'باترو أيسدن', 'ru': 'Патро Эйсден', 'de': 'Patro Eisden' , 'ja': 'パトロ・アイスデン' , 'ko': '패트로 아이스덴' , 'th': 'ปาโตร ไอส์เดน' , 'pt': 'Patro Eisden' },
  'Peterborough': { 'es': 'Peterborough', 'zh-CN': '彼得堡联', 'zh-TW': '彼得堡聯', 'ru': 'Питерборо', 'de': 'Peterborough' , 'ja': 'ピーターバラ' , 'ko': '피터버러' , 'th': 'ปีเตอร์โบโร่' , 'pt': 'Peterborough' },
  'Peterborough United': { 'ar': 'بيتربورو يونايتد', 'zh-CN': '彼得堡联', 'zh-TW': '彼得堡聯', 'ru': 'Портсмут', 'de': 'Peterborough United' , 'ja': 'ピーターバラ・ユナイテッド' , 'ko': '피터버러 유나이티드' , 'th': 'ปีเตอร์โบโร่ ยูไนเต็ด' , 'pt': 'Peterborough United' },
  'Petrojet': { 'ar': 'بتروجيت', 'ru': 'Петроджет', 'de': 'Petrojet' , 'ja': 'ペトロジェット' , 'ko': '페트로젯' , 'th': 'เปโตรเจ็ท' , 'pt': 'Petrojet' },
  'Petrolul Ploiesti': { 'ar': 'بترولول بلويشت', 'zh-CN': '普洛耶什蒂石油', 'zh-TW': '普洛耶什蒂石油', 'ru': 'Престон', 'de': 'Petrolul Ploiesti' , 'ja': 'ペトロール・プロイエスティ' , 'ko': '페트롤룰 플로이에스티' , 'th': 'ปิโตรลูล โพลอิสติ' , 'pt': 'Petrolul Ploiesti' },
  'Pharco': { 'zh-CN': '法尔科', 'zh-TW': '法爾科', 'ru': 'Фарко', 'de': 'Pharco' , 'ja': 'ファルコ' , 'ko': '파코' , 'th': 'ฟาร์มา' , 'pt': 'Pharco' },
  'Pharco FC': { 'ar': 'فاركو', 'ru': 'Фарко ФК', 'de': 'Pharco FC' , 'ja': 'ファーコFC' , 'ko': '파르코 FC' , 'th': 'ฟาร์โก เอฟซี' , 'pt': 'Pharco FC' },
  'Platense': { 'es': 'Platense', 'zh-CN': '普拉滕斯', 'zh-TW': '普拉滕斯', 'ru': 'Платенсе', 'de': 'Platense' , 'ja': 'プラテンス' , 'ko': '플래텐스' , 'th': 'จาน' , 'pt': 'Platense' },
  'Plymouth': { 'es': 'Plymouth', 'zh-CN': '普利茅斯', 'zh-TW': '普利茅斯', 'ru': 'Плимут', 'de': 'Plymouth' , 'ja': 'プリマス' , 'ko': '플리머스' , 'th': 'พลีมัธ' , 'pt': 'Plymouth' },
  'Plymouth Argyle': { 'ar': 'بليموث أرجايل', 'zh-CN': '普利茅斯', 'zh-TW': '普利茅斯', 'ru': 'Плимут Аргайл', 'de': 'Plymouth Argyle' , 'ja': 'プリマス アーガイル' , 'ko': '플리머스 아가일' , 'th': 'พลีมัธ อาร์ไกล์' , 'pt': 'Plymouth Argyle' },
  'Podbrezova': { 'zh-CN': '波德布雷佐瓦', 'zh-TW': '波德布雷佐瓦', 'ru': 'Подбрезова', 'de': 'Podbrezova' , 'ja': 'ポドブレゾワ' , 'ko': '포드브레조바' , 'th': 'พอดเบรโซวา' , 'pt': 'Podbrezova' },
  'Pohang Steelers': { 'ar': 'بوهانغ ستيلرز', 'zh-CN': '浦项制铁', 'zh-TW': '浦項製鐵', 'ru': 'Пхохан Стилерс', 'de': 'Pohang Steelers' , 'ja': '浦項スティーラーズ' , 'ko': '포항 스틸러스' , 'th': 'โปฮัง สตีลเลอร์ส' , 'pt': 'Pohang Steelers' },
  'Politehnica UTM': { 'ar': 'بوليتيهنيكا', 'zh-CN': '理工大学', 'zh-TW': '理工大學', 'ru': 'Политехника УТМ', 'de': 'Politehnica UTM' , 'ja': '工科大学UTM' , 'ko': '폴리테니카 UTM' , 'th': 'โปลิเทห์นิกา ยูทีเอ็ม' , 'pt': 'Politehnica UTM' },
  'Polokwane City': { 'ar': 'بولوكوان سيتي', 'ru': 'Полокване Сити', 'de': 'Polokwane City' , 'ja': 'ポロクワネ市' , 'ko': '폴로콰네 시티' , 'th': 'เมืองโพโลเควน' , 'pt': 'Polokwane City' },
  'Port Vale': { 'ar': 'بورت فايل', 'zh-CN': '维尔港', 'zh-TW': '維爾港', 'ru': 'Порт-Вейл', 'de': 'Port Vale' , 'ja': 'ポートベール' , 'ko': '포트베일' , 'th': 'พอร์ทเวล' , 'pt': 'Port Vale' },
  'Portmore United': { 'ar': 'بورتمور يونايتد', 'ru': 'Портмор Юнайтед', 'de': 'Portmore United' , 'ja': 'ポートモア・ユナイテッド' , 'ko': '포트모어 유나이티드' , 'th': 'พอร์ทมอร์ ยูไนเต็ด' , 'pt': 'Portmore United' },
  'Portsmouth': { 'ar': 'بورتسموث', 'zh-CN': '朴茨茅斯', 'zh-TW': '樸茨茅斯', 'ru': 'Портсмут', 'de': 'Portsmouth' , 'ja': 'ポーツマス' , 'ko': '포츠머스' , 'th': 'พอร์ตสมัธ' , 'pt': 'Portsmouth' },
  'Posusje': { 'ar': 'بوسوشيه', 'zh-CN': '波苏什耶', 'zh-TW': '波蘇什耶', 'ru': 'КПР', 'de': 'Posusje' , 'ja': 'ポスジェ' , 'ko': '포수제' , 'th': 'โปซูเช' , 'pt': 'Posusje' },
  'Preston': { 'es': 'Preston', 'zh-CN': '普雷斯顿', 'zh-TW': '普雷斯頓', 'ru': 'Престон', 'de': 'Preston' , 'ja': 'プレストン' , 'ko': '프레스턴' , 'th': 'เพรสตัน' , 'pt': 'Preston' },
  'Preston North End': { 'ar': 'بريستون نورث إيند', 'zh-CN': '普雷斯顿', 'zh-TW': '普雷斯頓', 'ru': 'Престон Норт Энд', 'de': 'Preston North End' , 'ja': 'プレストン ノース エンド' , 'ko': '프레스턴 노스엔드' , 'th': 'เพรสตัน นอร์ท เอนด์' , 'pt': 'Preston North End' },
  'Preussen Munster': { 'ar': 'برويسن مونستر', 'zh-CN': '普鲁士明斯特', 'zh-TW': '普魯士明斯特', 'ru': 'Пройссен Мюнстер', 'de': 'Preussen Munster' , 'ja': 'プロイセンミュンスター' , 'ko': '프로이센 뮌스터' , 'th': 'พรูเซ่น มุนสเตอร์' , 'pt': 'Preussen Munster' },
  'Primorje': { 'ar': 'بريموريه', 'zh-CN': '普里莫耶', 'zh-TW': '普里莫耶', 'ru': 'Приморье', 'de': 'Primorje' , 'ja': '沿海地方' , 'ko': 'Primorje' , 'th': 'พรีมอร์เย' , 'pt': 'Primorje' },
  'PSG': { 'es': 'PSG', 'zh-CN': '巴黎圣日耳曼', 'zh-TW': '巴黎聖日耳曼', 'ru': 'ПСЖ', 'de': 'PSG' , 'ja': 'PSG' , 'ko': 'PSG' , 'th': 'เปแอสเช' , 'pt': 'PSG' },
  'Puebla': { 'es': 'Puebla', 'zh-CN': '普埃布拉', 'zh-TW': '普埃布拉', 'ru': 'Пуэбла', 'de': 'Puebla' , 'ja': 'プエブラ' , 'ko': '푸에블라' , 'th': 'ปวยบลา' , 'pt': 'Puebla' },
  'Pumas': { 'ja': 'プーマス', 'ko': '푸마스', 'ru': 'Пумас', 'th': 'ปูมัส' , 'de': 'Pumas' , 'pt': 'Pumas' },
  'Pumas UNAM': { 'es': 'Pumas UNAM', 'zh-CN': '美洲狮', 'zh-TW': '美洲獅', 'ru': 'Пумас УНАМ', 'de': 'Pumas UNAM' , 'ja': 'ピューマ UNAM' , 'ko': '푸마스 UNAM' , 'th': 'พูมาส์ ยูนัม' , 'pt': 'Pumas UNAM' },
  'Pyramids FC': { 'ar': 'بيراميدز', 'zh-CN': '金字塔', 'zh-TW': '金字塔', 'ru': 'Пирамидс ФК', 'de': 'Pyramids FC' , 'ja': 'ピラミッドFC' , 'ko': '피라미드 FC' , 'th': 'พีระมิดส์ เอฟซี' , 'pt': 'Pyramids FC' },
  'Pyunik': { 'zh-CN': '佩历克', 'zh-TW': '佩歷克', 'ru': 'Пюник', 'de': 'Pyunik' , 'ja': 'ピュニク' , 'ko': '퓨닉' , 'th': 'พยูนิค' , 'pt': 'Pyunik' },
  'Qatar SC': { 'ar': 'نادي قطر', 'ru': 'Катар СК', 'de': 'Qatar SC' , 'ja': 'カタールSC' , 'ko': '카타르 SC' , 'th': 'กาตาร์ เอสซี' , 'pt': 'Qatar SC' },
  'QPR': { 'ar': 'كوينز بارك رينجرز', 'zh-CN': '女王公园巡游者', 'zh-TW': '女王公園巡遊者', 'ru': 'КПР', 'de': 'QPR' , 'ja': 'QPR' , 'ko': 'QPR' , 'th': 'คิวพีอาร์' , 'pt': 'QPR' },
  'Queens Park Rangers': { 'es': 'QPR', 'zh-CN': '女王公园巡游者', 'zh-TW': '女王公園巡遊者', 'ru': 'Куинз Парк Рейнджерс', 'de': 'Queens Park Rangers' , 'ja': 'クイーンズ・パーク・レンジャーズ' , 'ko': '퀸즈 파크 레인저스' , 'th': 'ควีนส์ปาร์ค เรนเจอร์ส' , 'pt': 'Queens Park Rangers' },
  'Queretaro': { 'es': 'Querétaro', 'zh-CN': '克雷塔罗', 'zh-TW': '克雷塔羅', 'ru': 'Керетаро', 'de': 'Queretaro' , 'ja': 'ケレタロ' , 'ko': '케레타로' , 'th': 'เกเรตาโร' , 'pt': 'Queretaro' },
  'Raal La Louviere': { 'de': 'Raal La Louviere', 'es': 'RAAL La Louvière', 'fr': 'RAAL La Louvière', 'ja': 'ラ・ルヴィエール', 'ko': '라 루비에르',
 'pt': 'RAAL La Louvière', 'ru': 'Ла-Лувьер', 'zh-CN': '拉卢维耶尔', 'zh-TW': '拉盧維耶爾' , 'th': 'ราอัล ลา ลูวิแยร์' },
  'Racing Club': { 'es': 'Racing Club', 'zh-CN': '竞技俱乐部', 'zh-TW': '競技俱樂部', 'ru': 'Рейнджерс', 'de': 'Racing Club' , 'ja': 'レーシングクラブ' , 'ko': '레이싱 클럽' , 'th': 'ราซิ่ง คลับ' , 'pt': 'Racing Club' },
  'Racing United': { 'ar': 'راسينغ يونايتد', 'ru': 'Рапид Вена', 'de': 'Racing United' , 'ja': 'レーシング・ユナイテッド' , 'ko': '레이싱 유나이티드' , 'th': 'ราซิ่ง ยูไนเต็ด' , 'pt': 'Racing United' },
  'Radnicki 1923': { 'zh-CN': '拉德尼奇基1923', 'zh-TW': '拉德尼奇基1923', 'ru': 'Рединг', 'de': 'Radnicki 1923' , 'ja': 'ラドニツキ 1923' , 'ko': '라드니츠키 1923' , 'th': 'แรดนิกกี้ 2466' , 'pt': 'Radnicki 1923' },
  'Radnicki Nis': { 'zh-CN': '尼什拉德尼奇基', 'zh-TW': '尼什拉德尼奇基', 'ru': 'Радницки Нис', 'de': 'Radnicki Nis' , 'ja': 'ラドニキ・ニス' , 'ko': '라드니츠키 니스' , 'th': 'ราดนิกกี้ นิส' , 'pt': 'Radnicki Nis' },
  'Radnik Bijeljina': { 'ar': 'رادنيك بيلينا', 'zh-CN': '比耶利纳工人', 'zh-TW': '比耶利納工人', 'ru': 'Радник Биелина', 'de': 'Radnik Bijeljina' , 'ja': 'ラドニク・ビイェリナ' , 'ko': '라드니크 비젤지나' , 'th': 'รัดนิค บิเยลจิน่า' , 'pt': 'Radnik Bijeljina' },
  'Raith Rovers': { 'ar': 'رايث روفرز', 'zh-CN': '拉夫流浪', 'zh-TW': '拉夫流浪', 'ru': 'Рэйт Роверс', 'de': 'Raith Rovers' , 'ja': 'レイス・ローバーズ' , 'ko': '레이스 로버스' , 'th': 'เรธโรเวอร์ส' , 'pt': 'Raith Rovers' },
  'Rajasthan United': { 'ar': 'راجستان يونايتد', 'zh-CN': '拉贾斯坦联', 'zh-TW': '拉賈斯坦聯', 'ru': 'Зальцбург', 'de': 'Rajasthan United' , 'ja': 'ラジャスタン・ユナイテッド' , 'ko': '라자스탄 유나이티드' , 'th': 'ราชสถาน ยูไนเต็ด' , 'pt': 'Rajasthan United' },
  'Rangers': { 'zh-CN': '格拉斯哥流浪者', 'zh-TW': '格拉斯哥流浪者', 'ru': 'Бетис', 'de': 'Rangers' , 'ja': 'レンジャーズ' , 'ko': '레인저스' , 'th': 'เรนเจอร์' , 'pt': 'Rangers' },
  'Rapid Bucuresti': { 'ar': 'رابيد بوخارست', 'zh-CN': '布加勒斯特快速', 'zh-TW': '布加勒斯特快速', 'ru': 'Рапид Бухарест', 'de': 'Rapid Bucuresti' , 'ja': 'ラピッド ブカレスティ' , 'ko': '래피드 부쿠레스티' , 'th': 'ราปิด บูคาเรสติ' , 'pt': 'Rapid Bucuresti' },
  'Rapid Wien': { 'ar': 'رابيد فيينا', 'zh-CN': '维也纳快速', 'zh-TW': '維也納快速', 'ru': 'Рапид Вена', 'de': 'Rapid Wien' , 'ja': 'ラピッド ウィーン' , 'ko': '라피드 빈' , 'th': 'ราปิด เวียนนา' , 'pt': 'Rapid Wien' },
  'Rayo Vallecano': { 'ja': 'ラージョ・バジェカーノ', 'ko': '라요 바예카노', 'ru': 'Райо Вальекано', 'th': 'ราโยบาเยกาโน' , 'de': 'Rayo Vallecano' , 'pt': 'Rayo Vallecano' },
  'RB Leipzig': { 'es': 'RB Leipzig', 'zh-CN': 'RB莱比锡', 'zh-TW': '萊比錫紅牛', 'ru': 'РБ Лейпциг', 'de': 'RB Leipzig' , 'ja': 'RBライプツィヒ' , 'ko': 'RB 라이프치히' , 'th': 'แอร์เบ ไลป์ซิก' , 'pt': 'RB Leipzig' },
  'RB Leipzig W': { 'ar': 'لايبزيغ (سيدات)', 'zh-CN': 'RB莱比锡女足', 'zh-TW': 'RB萊比錫女足', 'ru': 'Ренн', 'de': 'RB Leipzig W' , 'ja': 'RBライプツィヒW' , 'ko': 'RB 라이프치히 여' , 'th': 'แอร์เบ ไลป์ซิก ดับเบิลยู' , 'pt': 'RB Leipzig W' },
  'RB Salzburg': { 'ar': 'ريد بول سالزبورغ', 'zh-CN': '萨尔茨堡红牛', 'zh-TW': '薩爾斯堡紅牛', 'ru': 'РБ Зальцбург', 'de': 'RB Salzburg' , 'ja': 'RBザルツブルク' , 'ko': 'RB 잘츠부르크' , 'th': 'แอร์เบ ซัลซ์บวร์ก' , 'pt': 'RB Salzburg' },
  'Reading': { 'ar': 'ريدينغ', 'zh-CN': '雷丁', 'zh-TW': '雷丁', 'ru': 'Ривер Плейт', 'de': 'Reading' , 'ja': '読む' , 'ko': '독서' , 'th': 'การอ่าน' , 'pt': 'Reading' },
  'Real Betis': { 'ja': 'レアル・ベティス', 'ko': '레알 베티스', 'ru': 'Бетис', 'th': 'เรอัลเบติส' , 'de': 'Real Betis' , 'pt': 'Real Betis' },
  'Real Madrid': { 'es': 'Real Madrid', 'zh-CN': '皇家马德里', 'zh-TW': '皇家馬德里', 'ru': 'Реал Мадрид', 'de': 'Real Madrid' , 'ja': 'レアル・マドリード' , 'ko': '레알 마드리드' , 'th': 'เรอัล มาดริด' , 'pt': 'Real Madrid' },
  'Real Sireti': { 'ar': 'ريال سيريتي', 'zh-CN': '皇家锡雷蒂', 'zh-TW': '皇家錫雷蒂', 'ru': 'Реал Сирети', 'de': 'Real Sireti' , 'ja': 'レアル・シレティ' , 'ko': '레알 시레티' , 'th': 'เรียล ซิเรติ' , 'pt': 'Real Sireti' },
  'Real Sociedad': { 'ja': 'レアル・ソシエダ', 'ko': '레알 소시에다드', 'ru': 'Реал Сосьедад', 'th': 'เรอัลโซซิเอดัด' , 'de': 'Real Sociedad' , 'pt': 'Real Sociedad' },
  'Real Valladolid': { 'es': 'Real Valladolid', 'zh-CN': '皇家巴拉多利德', 'zh-TW': '皇家瓦拉多利德', 'ru': 'Реал Вальядолид', 'de': 'Real Valladolid' , 'ja': 'レアル・バリャドリード' , 'ko': '레알 바야돌리드' , 'th': 'เรอัล บายาโดลิด' , 'pt': 'Real Valladolid' },
  'Reims': { 'ja': 'ランス', 'ko': '랭스', 'ru': 'Реймс', 'th': 'แร็งส์' , 'de': 'Reims' , 'pt': 'Reims' },
  'Rennes': { 'ja': 'レンヌ', 'ko': '렌', 'ru': 'Ренн', 'th': 'แรน' , 'de': 'Rennes' , 'pt': 'Rennes' },
  'Renofa Yamaguchi': { 'ar': 'رينوفا ياماغوتشي', 'zh-CN': '雷法山口', 'zh-TW': '山口雷法', 'ru': 'Рома', 'de': 'Renofa Yamaguchi' , 'ja': 'レノファ山口' , 'ko': '레노파 야마구치' , 'th': 'เรโนฟา ยามากูจิ' , 'pt': 'Renofa Yamaguchi' },
  'Renofa Yamaguchi FC': { 'es': 'Renofa Yamaguchi', 'zh-CN': '雷法山口', 'zh-TW': '山口雷法', 'ru': 'Ренофа Ямагучи', 'de': 'Renofa Yamaguchi FC' , 'ja': 'レノファ山口FC' , 'ko': '레노파 야마구치 FC' , 'th': 'เรโนฟา ยามากูจิ เอฟซี' , 'pt': 'Renofa Yamaguchi FC' },
  'River Plate': { 'ja': 'リーベル・プレート', 'ko': '리베르 플라테', 'ru': 'Ривер Плейт', 'th': 'ริเบร์เปลต' , 'de': 'River Plate' , 'pt': 'River Plate' },
  'Roasso Kumamoto': { 'es': 'Roasso Kumamoto', 'zh-CN': '熊本深红', 'zh-TW': '熊本羅亞素', 'ru': 'Роассо Кумамото', 'de': 'Roasso Kumamoto' , 'ja': 'ロアッソ熊本' , 'ko': '로아소 구마모토' , 'th': 'โรอัสโซ คุมาโมโตะ' , 'pt': 'Roasso Kumamoto' },
  'Robina City': { 'ar': 'روبينا سيتي', 'zh-CN': '罗比纳城', 'zh-TW': '羅比納城', 'ru': 'Робина Сити', 'de': 'Robina City' , 'ja': 'ロビーナシティ' , 'ko': '로비나시티' , 'th': 'โรบินา ซิตี้' , 'pt': 'Robina City' },
  'Roma': { 'es': 'Roma', 'zh-CN': '罗马', 'zh-TW': '羅馬', 'ru': 'Рома', 'de': 'Roma' , 'ja': 'ローマ' , 'ko': '로마' , 'th': 'โรม่า' , 'pt': 'Roma' },
  'Rosario Central': { 'es': 'Rosario Central', 'zh-CN': '罗萨里奥中央', 'zh-TW': '羅薩里奧中央', 'ru': 'Саннефьорд', 'de': 'Rosario Central' , 'ja': 'ロザリオ セントラル' , 'ko': '로사리오 센트럴' , 'th': 'โรซาริโอ เซ็นทรัล' , 'pt': 'Rosario Central' },
  'Rosenborg': { 'ar': 'روزنبورغ', 'zh-CN': '罗森博格', 'zh-TW': '羅森堡', 'ru': 'Русенборг', 'de': 'Rosenborg' , 'ja': 'ローゼンボーグ' , 'ko': '로젠보르그' , 'th': 'โรเซนบอร์ก' , 'pt': 'Rosenborg' },
  'Ross County': { 'ar': 'روس كونتي', 'zh-CN': '罗斯郡', 'zh-TW': '羅斯郡', 'ru': 'Росс Каунти', 'de': 'Ross County' , 'ja': 'ロス郡' , 'ko': '로스 카운티' , 'th': 'รอสส์ เคาน์ตี้' , 'pt': 'Ross County' },
  'Rotherham': { 'es': 'Rotherham', 'zh-CN': '罗瑟汉姆', 'zh-TW': '羅瑟漢姆', 'ru': 'Ротерхэм', 'de': 'Rotherham' , 'ja': 'ロザラム' , 'ko': '로더럼' , 'th': 'ร็อตเธอร์แฮม' , 'pt': 'Rotherham' },
  'Rotherham United': { 'ar': 'روثرهام يونايتد', 'zh-CN': '罗瑟汉姆联', 'zh-TW': '羅瑟漢姆聯', 'ru': 'Ротерхэм Юнайтед', 'de': 'Rotherham United' , 'ja': 'ロザラム・ユナイテッド' , 'ko': '로더햄 유나이티드' , 'th': 'ร็อตเธอร์แฮม ยูไนเต็ด' , 'pt': 'Rotherham United' },
  'Rudar Prijedor': { 'ar': 'رودار برييدور', 'zh-CN': '普里耶多尔矿工', 'zh-TW': '普里耶多爾礦工', 'ru': 'Рудар Приедор', 'de': 'Rudar Prijedor' , 'ja': 'ルダル・プリイェドル' , 'ko': '루다르 프리예도르' , 'th': 'รูดาร์ ไพรเยดอร์' , 'pt': 'Rudar Prijedor' },
  'Ruzomberok': { 'ar': 'روجومبيروك', 'zh-CN': '鲁容贝罗克', 'zh-TW': '魯容貝羅克', 'ru': 'Ружомберок', 'de': 'Ruzomberok' , 'ja': 'ルゾンベロック' , 'ko': '루좀베로크' , 'th': 'รูซอมเบรอก' , 'pt': 'Ruzomberok' },
  'Sabah FK': { 'ar': 'صباح', 'ru': 'Сабах ФК', 'de': 'Sabah FK' , 'ja': 'サバFK' , 'ko': '사바 FK' , 'th': 'ซาบาห์ เอฟเค' , 'pt': 'Sabah FK' },
  'Sagan Bellmare': { 'es': 'Shonan Bellmare', 'zh-CN': '湘南比马', 'zh-TW': '湘南比馬', 'ru': 'Сарпсборг', 'de': 'Sagan Bellmare' , 'ja': 'サガン・ベルマーレ' , 'ko': '세이건 벨마레' , 'th': 'ซากัน เบลล์มาเร' , 'pt': 'Sagan Bellmare' },
  'Sagan Tosu': { 'ar': 'ساغان توسو', 'zh-CN': '鸟栖砂岩', 'zh-TW': '鳥棲砂岩', 'ru': 'Саган Тосу', 'de': 'Sagan Tosu' , 'ja': 'サガン鳥栖' , 'ko': '사간토스' , 'th': 'ซากัน โทสุ' , 'pt': 'Sagan Tosu' },
  'Saint-Etienne': { 'ja': 'サンテティエンヌ', 'ko': '생테티엔', 'ru': 'Сент-Этьен', 'th': 'แซ็งเตเตียน' , 'de': 'Saint-Etienne' , 'pt': 'Saint-Etienne' },
  'Salford': { 'es': 'Salford', 'zh-CN': '索尔福德', 'zh-TW': '索爾福德', 'ru': 'Салфорд', 'de': 'Salford' , 'ja': 'サルフォード' , 'ko': '샐퍼드' , 'th': 'ซัลฟอร์ด' , 'pt': 'Salford' },
  'Salford City': { 'ar': 'سالفورد سيتي', 'zh-CN': '索尔福德城', 'zh-TW': '索爾福德城', 'ru': 'Сан-Паулу', 'de': 'Salford City' , 'ja': 'サルフォードシティ' , 'ko': '샐퍼드 시티' , 'th': 'ซอลฟอร์ด ซิตี้' , 'pt': 'Salford City' },
  'Salisbury United': { 'ar': 'سالزبري يونايتد', 'zh-CN': '索尔兹伯里联', 'zh-TW': '索爾茲伯里聯', 'ru': 'Солсбери Юнайтед', 'de': 'Salisbury United' , 'ja': 'ソールズベリー・ユナイテッド' , 'ko': '솔즈베리 유나이티드' , 'th': 'ซอลส์บิวรี ยูไนเต็ด' , 'pt': 'Salisbury United' },
  'Sampdoria': { 'ja': 'サンプドリア', 'ko': '삼프도리아', 'ru': 'Сампдория', 'th': 'ซัมป์โดเรีย' , 'de': 'Sampdoria' , 'pt': 'Sampdoria' },
  'San Lorenzo': { 'es': 'San Lorenzo', 'zh-CN': '圣洛伦索', 'zh-TW': '聖羅倫索', 'ru': 'Сан-Лоренцо', 'de': 'San Lorenzo' , 'ja': 'サン・ロレンソ' , 'ko': '산 로렌조' , 'th': 'ซาน ลอเรนโซ' , 'pt': 'San Lorenzo' },
  'San Lorenzo de Almagro': { 'ar': 'سان لورينزو', 'ru': 'Шальке', 'de': 'San Lorenzo de Almagro' , 'ja': 'サン ロレンソ デ アルマグロ' , 'ko': '산 로렌조 데 알마그로' , 'th': 'ซาน ลอเรนโซ เด อัลมาโกร' , 'pt': 'San Lorenzo de Almagro' },
  'San Luis': { 'es': 'San Luis', 'zh-CN': '圣路易斯', 'zh-TW': '聖路易斯', 'ru': 'Сан-Луис', 'de': 'San Luis' , 'ja': 'サンルイス' , 'ko': '산 루이스' , 'th': 'ซานหลุยส์' , 'pt': 'San Luis' },
  'Sandefjord': { 'ar': 'ساندفيورد', 'zh-CN': '桑讷菲尤尔', 'zh-TW': '桑訥菲尤爾', 'ru': 'Сандефьорд', 'de': 'Sandefjord' , 'ja': 'サンネフィヨルド' , 'ko': '산데피요르드' , 'th': 'ซานเดฟยอร์ด' , 'pt': 'Sandefjord' },
  'Sanfrecce Hiroshima': { 'es': 'Sanfrecce Hiroshima', 'zh-CN': '广岛三箭', 'zh-TW': '廣島三箭', 'ru': 'Санфречче Хиросима', 'de': 'Sanfrecce Hiroshima' , 'ja': 'サンフレッチェ広島' , 'ko': '산프레체 히로시마' , 'th': 'ซานเฟรซเซ ฮิโรชิม่า' , 'pt': 'Sanfrecce Hiroshima' },
  'Santa Fe': { 'ar': 'إنديبنديينتي سانتا في', 'ru': 'Сассуоло', 'de': 'Santa Fe' , 'ja': 'サンタフェ' , 'ko': '산타페' , 'th': 'ซานตาเฟ่' , 'pt': 'Santa Fe' },
  'Santos': { 'ja': 'サントス', 'ko': '산투스', 'ru': 'Сантос', 'th': 'ซังตุส' , 'de': 'Santos' , 'pt': 'Santos' },
  'Santos FC': { 'ar': 'سانتوس', 'ru': 'Сантос', 'de': 'Santos FC' , 'ja': 'サントスFC' , 'ko': '산토스 FC' , 'th': 'ซานโต๊ส เอฟซี' , 'pt': 'Santos FC' },
  'Santos Laguna': { 'es': 'Santos Laguna', 'zh-CN': '桑托斯拉古纳', 'zh-TW': '桑托斯拉古納', 'ru': 'Сантос Лагуна', 'de': 'Santos Laguna' , 'ja': 'サントス ラグーナ' , 'ko': '산토스 라구나' , 'th': 'ซานโต๊ส ลากูน่า' , 'pt': 'Santos Laguna' },
  'Sao Paulo': { 'ja': 'サンパウロ', 'ko': '상파울루', 'ru': 'Сан-Паулу', 'th': 'เซาเปาลู' , 'de': 'Sao Paulo' , 'pt': 'Sao Paulo' },
  'Sarmiento': { 'es': 'Sarmiento', 'zh-CN': '萨米恩托', 'zh-TW': '薩米恩托', 'ru': 'Сармьенто', 'de': 'Sarmiento' , 'ja': 'サルミエント' , 'ko': '사르미엔토' , 'th': 'ซาร์เมียนโต' , 'pt': 'Sarmiento' },
  'Sarpsborg 08': { 'ar': 'ساربسبورغ', 'zh-CN': '萨普斯堡', 'zh-TW': '薩普斯堡', 'ru': 'Севилья', 'de': 'Sarpsborg 08' , 'ja': 'ザルプスボルグ 08' , 'ko': '사르프스보르그 08' , 'th': 'ซาร์ปสบอร์ก 08' , 'pt': 'Sarpsborg 08' },
  'Sassuolo': { 'ja': 'サッスオーロ', 'ko': '사수올로', 'ru': 'Сассуоло', 'th': 'ซัสซูโอโล' , 'de': 'Sassuolo' , 'pt': 'Sassuolo' },
  'SC Freiburg': { 'ar': 'فرايبورغ', 'zh-CN': '弗赖堡', 'zh-TW': '弗萊堡', 'ru': 'Шахтёр', 'de': 'SC Freiburg' , 'ja': 'SCフライブルク' , 'ko': 'SC 프라이부르크' , 'th': 'เอสซี ไฟร์บวร์ก' , 'pt': 'SC Freiburg' },
  'SC Paderborn': { 'ar': 'بادربورن', 'zh-CN': '帕德博恩', 'zh-TW': '帕德博恩', 'ru': 'СК Падерборн', 'de': 'SC Paderborn' , 'ja': 'SCパーダーボルン' , 'ko': 'SC 파더보른' , 'th': 'เอสซี พาเดอร์บอร์น' , 'pt': 'SC Paderborn' },
  'SC Poltava': { 'ar': 'بولتافا', 'zh-CN': '波尔塔瓦', 'zh-TW': '波爾塔瓦', 'ru': 'СК Полтава', 'de': 'SC Poltava' , 'ja': 'SCポルタヴァ' , 'ko': 'SC 폴타바' , 'th': 'เอสซี โพลตาวา' , 'pt': 'SC Poltava' },
  'SC Sagamihara': { 'ar': 'إس سي ساغاميهارا', 'zh-CN': '相模原SC', 'zh-TW': '相模原SC', 'ru': 'СК Сагамихара', 'de': 'SC Sagamihara' , 'ja': 'SC相模原' , 'ko': 'SC 사가미하라' , 'th': 'เอสซี ซากามิฮาระ' , 'pt': 'SC Sagamihara' },
  'Schalke 04': { 'ar': 'شالكه 04', 'zh-CN': '沙尔克04', 'zh-TW': '沙爾克04', 'ru': 'Шальке 04', 'de': 'Schalke 04' , 'ja': 'シャルケ04' , 'ko': '샬케 04' , 'th': 'ชาลเก้ 04' , 'pt': 'Schalke 04' },
  'Seongnam FC': { 'zh-CN': '城南FC', 'zh-TW': '城南FC', 'ru': 'Соннам ФК', 'de': 'Seongnam FC' , 'ja': '城南FC' , 'ko': '성남FC' , 'th': 'ซองนัม เอฟซี' , 'pt': 'Seongnam FC' },
  'Seoul E-Land': { 'zh-CN': '首尔衣恋', 'zh-TW': '首爾衣戀', 'ru': 'Сеул', 'de': 'Seoul E-Land' , 'ja': 'ソウルイーランド' , 'ko': '서울이랜드' , 'th': 'โซล อี-แลนด์' , 'pt': 'Seoul E-Land' },
  'Sepsi OSK': { 'ar': 'سيبسي', 'zh-CN': '圣格奥尔基', 'zh-TW': '聖格奧爾基', 'ru': 'Сепси ОСК', 'de': 'Sepsi OSK' , 'ja': 'セプシ OSK' , 'ko': '셉시 OSK' , 'th': 'เซ็ปซี่ โอเอสเค' , 'pt': 'Sepsi OSK' },
  'Sevilla': { 'es': 'Sevilla', 'ja': 'セビージャ', 'ko': '세비야', 'ru': 'Севилья', 'th': 'เซบิยา', 'zh-CN': '塞维利亚', 'zh-TW': '塞維亞' , 'de': 'Sevilla' , 'pt': 'Sevilla' },
  'Shabana': { 'ar': 'شبانة', 'zh-CN': '沙巴纳', 'zh-TW': '沙巴納', 'ru': 'Шабана', 'de': 'Shabana' , 'ja': 'シャバナ' , 'ko': '샤바나' , 'th': 'ชาบาน่า' , 'pt': 'Shabana' },
  'Shakhtar Donetsk': { 'ja': 'シャフタール・ドネツク', 'ko': '샤흐타르 도네츠크', 'ru': 'Шахтёр Донецк', 'th': 'ชัคตาร์โดเนตสก์' , 'de': 'Shakhtar Donetsk' , 'pt': 'Shakhtar Donetsk' },
  'Shakhter Karagandy': { 'zh-CN': '卡拉干达矿工', 'zh-TW': '卡拉干達礦工', 'ru': 'Шахтер Караганды', 'de': 'Shakhter Karagandy' , 'ja': 'シャフテル・カラガンディ' , 'ko': '샤흐터 카라간디' , 'th': 'ชัคห์เตอร์ คารากันดี' , 'pt': 'Shakhter Karagandy' },
  'Shakhtyor Soligorsk': { 'zh-CN': '索利戈尔斯克矿工', 'zh-TW': '索利戈爾斯克礦工', 'ru': 'Шахтёр Солигорск', 'de': 'Shakhtyor Soligorsk' , 'ja': 'シャフチョル・ソリゴルスク' , 'ko': '샤크티오르 살리고르스크' , 'th': 'ชัคห์ยอร์ โซลิกอร์สค์' , 'pt': 'Shakhtyor Soligorsk' },
  'Sheffield United': { 'ar': 'شيفيلد يونايتد', 'de': 'Sheffield United', 'es': 'Sheffield United', 'fr': 'Sheffield United', 'ja': 'シェフィールド・ユナイテッド', 'ko': '셰필드 유나이티드',
 'pt': 'Sheffield United', 'ru': 'Шеффилд Юнайтед', 'zh-CN': '谢菲尔德联', 'zh-TW': '雪菲爾聯' , 'th': 'เชฟฟิลด์ ยูไนเต็ด' },
  'Sheffield Wednesday': { 'ar': 'شيفيلد وينزداي', 'zh-CN': '谢周三', 'zh-TW': '雪菲爾星期三', 'ru': 'Шеффилд Уэнсдей', 'de': 'Sheffield Wednesday' , 'ja': 'シェフィールド・ウェンズデー' , 'ko': '셰필드 웬즈데이' , 'th': 'เชฟฟิลด์ เว้นส์เดย์' , 'pt': 'Sheffield Wednesday' },
  'Sheriff Tiraspol': { 'zh-CN': '谢里夫', 'zh-TW': '舒列夫', 'ru': 'Шериф Тирасполь', 'de': 'Sheriff Tiraspol' , 'ja': 'ティラスポリ保安官' , 'ko': '보안관 티라스폴' , 'th': 'นายอำเภอธีรัสพล' , 'pt': 'Sheriff Tiraspol' },
  'Shillong Lajong': { 'ar': 'شيلونغ لاجونغ', 'zh-CN': '西隆拉容', 'zh-TW': '西隆拉容', 'ru': 'Шиллонг Ладжонг', 'de': 'Shillong Lajong' , 'ja': 'シロン・ラジョン' , 'ko': '실롱 라종' , 'th': 'ชิลลอง ลาจง' , 'pt': 'Shillong Lajong' },
  'Shimizu S-Pulse': { 'es': 'Shimizu S-Pulse', 'zh-CN': '清水心跳', 'zh-TW': '清水心跳', 'ru': 'Симидзу С-Палс', 'de': 'Shimizu S-Pulse' , 'ja': '清水エスパルス' , 'ko': '시미즈 S-펄스' , 'th': 'ชิมิสุ เอส-พัลส์' , 'pt': 'Shimizu S-Pulse' },
  'Shonan Bellmare': { 'ar': 'شونان بيلماري', 'zh-CN': '湘南比马', 'zh-TW': '湘南比馬', 'ru': 'Шонан Беллмаре', 'de': 'Shonan Bellmare' , 'ja': '湘南ベルマーレ' , 'ko': '쇼난 벨마레' , 'th': 'โชนัน เบลล์มาเร่' , 'pt': 'Shonan Bellmare' },
  'Shrewsbury': { 'es': 'Shrewsbury', 'zh-CN': '什鲁斯伯里', 'zh-TW': '什魯斯伯里', 'ru': 'Шрусбери', 'de': 'Shrewsbury' , 'ja': 'シュルーズベリー' , 'ko': '슈루즈버리' , 'th': 'ชรูว์สเบอรี' , 'pt': 'Shrewsbury' },
  'Shrewsbury Town': { 'ar': 'شروزبري تاون', 'zh-CN': '什鲁斯伯里', 'zh-TW': '什魯斯伯里', 'ru': 'Шрусбери Таун', 'de': 'Shrewsbury Town' , 'ja': 'シュルーズベリー タウン' , 'ko': '슈루즈버리 타운' , 'th': 'ชรูว์สบิวรี่ ทาวน์' , 'pt': 'Shrewsbury Town' },
  'Silkeborg': { 'ar': 'سيلكيبورغ', 'zh-CN': '锡尔克堡', 'zh-TW': '錫爾克堡', 'ru': 'Силькеборг', 'de': 'Silkeborg' , 'ja': 'シルケボー' , 'ko': '실케보르' , 'th': 'ซิลเคบอร์ก' , 'pt': 'Silkeborg' },
  'Simba': { 'zh-CN': '辛巴', 'zh-TW': '辛巴', 'ru': 'Саутгемптон', 'de': 'Simba' , 'ja': 'シンバ' , 'ko': '심바' , 'th': 'ซิมบ้า' , 'pt': 'Simba' },
  'Siroki Brijeg': { 'de': 'Široki Brijeg', 'es': 'Široki Brijeg', 'fr': 'Široki Brijeg', 'ja': 'シロキ・ブリイェグ', 'ko': '시로키 브리예그',
 'pt': 'Široki Brijeg', 'ru': 'Широки Бриег', 'zh-CN': '希洛基布里耶格', 'zh-TW': '希洛基布里耶格' , 'th': 'ซิโรกี บริเยก' },
  'Siwelele F.C.': { 'ar': 'سيويليلي', 'ru': 'Сивелеле ФК', 'de': 'Siwelele F.C.' , 'ja': 'シウェレレ FC' , 'ko': '시웰레레 FC' , 'th': 'ซิเวเลเล เอฟซี' , 'pt': 'Siwelele F.C.' },
  'Skalica': { 'zh-CN': '斯卡利察', 'zh-TW': '斯卡利察', 'ru': 'Скалица', 'de': 'Skalica' , 'ja': 'スカリカ' , 'ko': '스칼리차' , 'th': 'สกาลิกา' , 'pt': 'Skalica' },
  'Sliema Wanderers': { 'zh-CN': '斯利马流浪者', 'zh-TW': '斯利馬流浪者', 'ru': 'Слима Уондерерс', 'de': 'Sliema Wanderers' , 'ja': 'スリーマ ワンダラーズ' , 'ko': '슬리에마 원더러스' , 'th': 'สลีม่า วันเดอร์เรอร์ส' , 'pt': 'Sliema Wanderers' },
  'Slovan Bratislava': { 'de': 'Slovan Bratislava', 'es': 'Slovan Bratislava', 'fr': 'Slovan Bratislava', 'ja': 'スロヴァン・ブラチスラヴァ', 'ko': '슬로반 브라티슬라바',
 'pt': 'Slovan Bratislava', 'ru': 'Слован Братислава', 'zh-CN': '布拉迪斯拉发', 'zh-TW': '布拉提斯拉瓦' , 'th': 'สโลวาน บราติสลาวา' },
  'Smouha SC': { 'ar': 'سموحة', 'ru': 'Спортинг', 'de': 'Smouha SC' , 'ja': 'スムーハSC' , 'ko': '스모하 SC' , 'th': 'สมูฮา เอสซี' , 'pt': 'Smouha SC' },
  'Sofapaka': { 'ar': 'سوفاباكا', 'zh-CN': '索法帕卡', 'zh-TW': '索法帕卡', 'ru': 'Диванапака', 'de': 'Sofapaka' , 'ja': 'ソファパカ' , 'ko': '소파파카' , 'th': 'โซฟาผกา' , 'pt': 'Sofapaka' },
  'Sonderjyske': { 'ar': 'سوندرجيسكه', 'zh-CN': '桑德捷斯基', 'zh-TW': '桑德捷斯基', 'ru': 'Сендерийске', 'de': 'Sonderjyske' , 'ja': 'ソンデルユスケ' , 'ko': '존데르이스케' , 'th': 'ซอนเดอร์ยิสเก' , 'pt': 'Sonderjyske' },
  'South Adelaide': { 'ar': 'ساوث أديلايد', 'zh-CN': '南阿德莱德', 'zh-TW': '南阿德萊德', 'ru': 'Южная Аделаида', 'de': 'South Adelaide' , 'ja': 'サウス・アデレード' , 'ko': '사우스 애들레이드' , 'th': 'แอดิเลดตอนใต้' , 'pt': 'South Adelaide' },
  'Southampton': { 'ar': 'ساوثهامبتون', 'zh-CN': '南安普顿', 'zh-TW': '南安普頓', 'ru': 'Саутгемптон', 'de': 'Southampton' , 'ja': 'サウサンプトン' , 'ko': '사우샘프턴' , 'th': 'เซาแธมป์ตัน' , 'pt': 'Southampton' },
  'Spanish Town Police': { 'ar': 'شرطة سبانيش تاون', 'ru': 'Испанская городская полиция', 'de': 'Spanish Town Police' , 'ja': 'スパニッシュタウン警察' , 'ko': '스페인 타운 경찰' , 'th': 'ตำรวจเมืองสเปน' , 'pt': 'Spanish Town Police' },
  'Spartak Subotica': { 'zh-CN': '苏博蒂察斯巴达', 'zh-TW': '蘇博蒂察斯巴達', 'ru': 'Спартак Суботица', 'de': 'Spartak Subotica' , 'ja': 'スパルタク・スボティツァ' , 'ko': '스파르타크 수보티카' , 'th': 'สปาร์ตัก ซูโบติก้า' , 'pt': 'Spartak Subotica' },
  'Spartak Trnava': { 'zh-CN': '特尔纳瓦斯巴达', 'zh-TW': '特爾納瓦斯巴達', 'ru': 'Спартак Трнава', 'de': 'Spartak Trnava' , 'ja': 'スパルタク トルナヴァ' , 'ko': '스파르타크 트르나바' , 'th': 'สปาร์ตัก เตอร์นาวา' , 'pt': 'Spartak Trnava' },
  'Sport Boys': { 'ar': 'سبورت بويز', 'zh-CN': '体育男孩', 'zh-TW': '體育男孩', 'ru': 'Спортивные мальчики', 'de': 'Sport Boys' , 'ja': 'スポーツボーイズ' , 'ko': '스포츠 소년' , 'th': 'สปอร์ตบอย' , 'pt': 'Sport Boys' },
  'Sport Huancayo': { 'ar': 'سبورت وانكايو', 'ru': 'Спорт Уанкайо', 'de': 'Sport Huancayo' , 'ja': 'スポーツワンカヨ' , 'ko': '스포츠 우안카요' , 'th': 'สปอร์ต ฮวนคาโย่' , 'pt': 'Sport Huancayo' },
  'Sporting Charleroi': { 'ar': 'شارلروا', 'zh-CN': '沙勒罗瓦', 'zh-TW': '沙勒羅瓦', 'ru': 'Сток Сити', 'de': 'Sporting Charleroi' , 'ja': 'スポルティング シャルルロア' , 'ko': '스포르팅 샤를로이' , 'th': 'สปอร์ติ้ง ชาร์เลอรัว' , 'pt': 'Sporting Charleroi' },
  'Sporting CP': { 'es': 'Sporting CP', 'zh-CN': '葡萄牙体育', 'zh-TW': '葡萄牙體育', 'ru': 'Спортинг Лиссабон', 'de': 'Sporting CP' , 'ja': 'スポーツCP' , 'ko': '스포르팅 CP' , 'th': 'สปอร์ติ้ง ซีพี' , 'pt': 'Sporting CP' },
  'Sporting Cristal': { 'ar': 'سبورتينغ كريستال', 'ru': 'Спортинг Кристал', 'de': 'Sporting Cristal' , 'ja': 'スポーティングクリスタル' , 'ko': '스포르팅 크리스탈' , 'th': 'สปอร์ติ้งคริสตัล' , 'pt': 'Sporting Cristal' },
  'Sreenidi Deccan': { 'zh-CN': '斯里尼迪德干', 'zh-TW': '斯里尼迪德干', 'ru': 'Шриниди Декан', 'de': 'Sreenidi Deccan' , 'ja': 'スリーニディ・デカン' , 'ko': '스리니디 데칸' , 'th': 'ศรีนิดี เดคคัน' , 'pt': 'Sreenidi Deccan' },
  'SSV Ulm 1846': { 'ar': 'أولم', 'zh-CN': '乌尔姆', 'zh-TW': '烏爾姆', 'ru': 'ССВ Ульм 1846 г.', 'de': 'SSV Ulm 1846' , 'ja': 'SSV ウルム 1846' , 'ko': 'SSV 울름 1846' , 'th': 'เอสเอสเฟา อูล์ม 1846' , 'pt': 'SSV Ulm 1846' },
  'St. Johnstone': { 'ar': 'سانت جونستون', 'zh-CN': '圣约翰斯通', 'zh-TW': '聖約翰斯通', 'ru': 'Сент-Джонстон', 'de': 'St. Johnstone' , 'ja': 'セントジョンストン' , 'ko': '세인트존스톤' , 'th': 'เซนต์ จอห์นสโตน' , 'pt': 'St. Johnstone' },
  'St. Mirren': { 'ar': 'سانت ميرين', 'zh-CN': '圣米伦', 'zh-TW': '聖米倫', 'ru': 'Сент-Миррен', 'de': 'St. Mirren' , 'ja': 'セント・ミレン' , 'ko': '세인트 미렌' , 'th': 'เซนต์ เมียร์เรน' , 'pt': 'St. Mirren' },
  'St. Pauli': { 'ar': 'سانت باولي', 'zh-CN': '圣保利', 'zh-TW': '聖保利', 'ru': 'Санкт-Паули', 'de': 'St. Pauli' , 'ja': 'ザンクト・パウリ' , 'ko': '세인트 파울리' , 'th': 'นักบุญเปาลี' , 'pt': 'St. Pauli' },
  'St.Truiden': { 'ar': 'سانت ترويدن', 'zh-CN': '圣特赖登', 'zh-TW': '聖特賴登', 'ru': 'Штурм', 'de': 'St.Truiden' , 'ja': 'ザンクトトロイデン' , 'ko': '세인트트루이덴' , 'th': 'แซงต์ทรุยเดน' , 'pt': 'St.Truiden' },
  'Standard Liege': { 'zh-CN': '标准列日', 'zh-TW': '標準列日', 'ru': 'Стандарт Льеж', 'de': 'Standard Liege' , 'ja': 'スタンダール・リエージュ' , 'ko': '스탕다르 리에주' , 'th': 'สตองดาร์ด ลีแอช' , 'pt': 'Standard Liege' },
  'Stevenage': { 'ar': 'ستيفينيدج', 'zh-CN': '斯蒂文尼奇', 'zh-TW': '斯蒂文尼奇', 'ru': 'Стивенейдж', 'de': 'Stevenage' , 'ja': 'スティーブニッジ' , 'ko': '스티버니지' , 'th': 'สตีเวเนจ' , 'pt': 'Stevenage' },
  'Stockport': { 'es': 'Stockport', 'zh-CN': '斯托克港', 'zh-TW': '斯托克港', 'ru': 'Суонси', 'de': 'Stockport' , 'ja': 'ストックポート' , 'ko': '스톡포트' , 'th': 'สต็อคพอร์ต' , 'pt': 'Stockport' },
  'Stockport County': { 'ar': 'ستوكبورت كونتي', 'zh-CN': '斯托克港', 'zh-TW': '斯托克港', 'ru': 'Округ Стокпорт', 'de': 'Stockport County' , 'ja': 'ストックポート郡' , 'ko': '스톡포트 카운티' , 'th': 'สต็อคพอร์ต เคาน์ตี้' , 'pt': 'Stockport County' },
  'Stockton Town': { 'ar': 'ستوكتون تاون', 'ru': 'Стоктон Таун', 'de': 'Stockton Town' , 'ja': 'ストックトンタウン' , 'ko': '스톡턴 타운' , 'th': 'สต็อกตัน ทาวน์' , 'pt': 'Stockton Town' },
  'Stoke': { 'es': 'Stoke', 'zh-CN': '斯托克城', 'zh-TW': '斯托克城', 'ru': 'Сток', 'de': 'Stoke' , 'ja': 'ストーク' , 'ko': '스토크' , 'th': 'จี้' , 'pt': 'Stoke' },
  'Stoke City': { 'ar': 'ستوك سيتي', 'zh-CN': '斯托克城', 'zh-TW': '斯托克城', 'ru': 'Сток Сити', 'de': 'Stoke City' , 'ja': 'ストークシティ' , 'ko': '스토크시티' , 'th': 'สโต๊ค ซิตี้' , 'pt': 'Stoke City' },
  'Strasbourg': { 'ja': 'ストラスブール', 'ko': '스트라스부르', 'ru': 'Страсбург', 'th': 'สทราซบูร์' , 'de': 'Strasbourg' , 'pt': 'Strasbourg' },
  'Sturm Graz': { 'ar': 'شتورم غراتس', 'zh-CN': '格拉茨风暴', 'zh-TW': '格拉茨風暴', 'ru': 'Штурм Грац', 'de': 'Sturm Graz' , 'ja': 'シュトゥルム グラーツ' , 'ko': '스투름 그라츠' , 'th': 'สตอร์ม กราซ' , 'pt': 'Sturm Graz' },
  'Sumqayit': { 'ar': 'سومغايت', 'zh-CN': '苏姆盖特', 'zh-TW': '蘇姆蓋特', 'ru': 'Сумгаит', 'de': 'Sumqayit' , 'ja': 'スムガイト' , 'ko': '숨카잇' , 'th': 'ซัมกายิท' , 'pt': 'Sumqayit' },
  'Sunderland': { 'ar': 'سندرلاند', 'de': 'Sunderland', 'es': 'Sunderland', 'fr': 'Sunderland', 'ja': 'サンダーランド', 'ko': '선덜랜드',
 'pt': 'Sunderland', 'ru': 'Сандерленд', 'zh-CN': '桑德兰', 'zh-TW': '桑德蘭' , 'th': 'ซันเดอร์แลนด์' },
  'Suwon FC': { 'zh-CN': '水原FC', 'zh-TW': '水原FC', 'ru': 'Сувон ФК', 'de': 'Suwon FC' , 'ja': '水原FC' , 'ko': '수원FC' , 'th': 'ซูวอน เอฟซี' , 'pt': 'Suwon FC' },
  'SV Elversberg': { 'ar': 'إلفرسبرغ', 'zh-CN': '埃尔弗斯贝格', 'zh-TW': '埃爾弗斯貝格', 'ru': 'СВ Эльверсберг', 'de': 'SV Elversberg' , 'ja': 'SV エルバースバーグ' , 'ko': 'SV 엘버스베르크' , 'th': 'เอสวี เอลเวอร์สเบิร์ก' , 'pt': 'SV Elversberg' },
  'SV Ried': { 'ar': 'ريد', 'zh-CN': '里德', 'zh-TW': '里德', 'ru': 'СВ Рид', 'de': 'SV Ried' , 'ja': 'SV リード' , 'ko': 'SV 리트' , 'th': 'เอสวี รีด' , 'pt': 'SV Ried' },
  'Swansea': { 'es': 'Swansea', 'zh-CN': '斯旺西城', 'zh-TW': '斯旺西城', 'ru': 'Суонси', 'de': 'Swansea' , 'ja': 'スウォンジー' , 'ko': '스완지' , 'th': 'สวอนซี' , 'pt': 'Swansea' },
  'Swansea City': { 'ar': 'سوانزي سيتي', 'zh-CN': '斯旺西城', 'zh-TW': '斯旺西城', 'ru': 'Суонси Сити', 'de': 'Swansea City' , 'ja': 'スウォンジー シティ' , 'ko': '스완지 시티' , 'th': 'สวอนซี ซิตี้' , 'pt': 'Swansea City' },
  'Swindon': { 'es': 'Swindon', 'zh-CN': '斯温登', 'zh-TW': '斯溫登', 'ru': 'Суиндон', 'de': 'Swindon' , 'ja': 'スウィンドン' , 'ko': '스윈던' , 'th': 'สวินดอน' , 'pt': 'Swindon' },
  'Swindon Town': { 'ar': 'سويندون تاون', 'zh-CN': '斯温登', 'zh-TW': '斯溫登', 'ru': 'Суиндон Таун', 'de': 'Swindon Town' , 'ja': 'スウィンドンタウン' , 'ko': '스윈던 타운' , 'th': 'สวินดอน ทาวน์' , 'pt': 'Swindon Town' },
  'Sydney FC': { 'ja': 'シドニーFC', 'ko': '시드니 FC', 'ru': 'Сидней', 'th': 'ซิดนีย์เอฟซี' , 'de': 'Sydney FC' , 'pt': 'Sydney FC' },
  'Tabora United': { 'ar': 'تابورا يونايتد', 'zh-CN': '塔波拉联', 'zh-TW': '塔波拉聯', 'ru': 'Табора Юнайтед', 'de': 'Tabora United' , 'ja': 'タボラ・ユナイテッド' , 'ko': '타보라 유나이티드' , 'th': 'ทาโบรา ยูไนเต็ด' , 'pt': 'Tabora United' },
  'Tai Po': { 'ar': 'تاي بو', 'zh-CN': '大埔', 'zh-TW': '大埔', 'ru': 'Тигрес', 'de': 'Tai Po' , 'ja': '大埔' , 'ko': '타이포' , 'th': 'ไทโป' , 'pt': 'Tai Po' },
  'Talleres': { 'es': 'Talleres', 'zh-CN': '塔列雷斯', 'zh-TW': '塔列雷斯', 'ru': 'Таллерес', 'de': 'Talleres' , 'ja': 'タジェレス' , 'ko': '탈레레스' , 'th': 'ทัลเลเรส' , 'pt': 'Talleres' },
  'Tampines Rovers': { 'zh-CN': '淡滨尼流浪', 'zh-TW': '淡濱尼流浪', 'ru': 'Тампинс Роверс', 'de': 'Tampines Rovers' , 'ja': 'タンピネスローバーズ' , 'ko': '탐피네스 로버스' , 'th': 'แทมปิเนส โรเวอร์ส' , 'pt': 'Tampines Rovers' },
  'Tanjong Pagar United': { 'zh-CN': '丹戎巴葛联', 'zh-TW': '丹戎巴葛聯', 'ru': 'Танджонг Пагар Юнайтед', 'de': 'Tanjong Pagar United' , 'ja': 'タンジョン パガー ユナイテッド' , 'ko': '탄종 파가르 유나이티드' , 'th': 'ตันจง ปาการ์ ยูไนเต็ด' , 'pt': 'Tanjong Pagar United' },
  'Tanzania Prisons': { 'ar': 'سجون تنزانيا', 'zh-CN': '坦桑尼亚监狱', 'zh-TW': '坦尚尼亞監獄', 'ru': 'Танзания Тюрьмы', 'de': 'Tanzania Prisons' , 'ja': 'タンザニアの刑務所' , 'ko': '탄자니아 교도소' , 'th': 'เรือนจำแทนซาเนีย' , 'pt': 'Tanzania Prisons' },
  'Tapatio': { 'ar': 'تاباتيو', 'ru': 'Тапатио', 'de': 'Tapatio' , 'ja': 'タパティオ' , 'ko': '타파티오' , 'th': 'ทาปาติโอ' , 'pt': 'Tapatio' },
  'Tatran Presov': { 'ar': 'تاتران بريشوف', 'zh-CN': '普雷绍夫', 'zh-TW': '普雷紹夫', 'ru': 'Татран Прешов', 'de': 'Tatran Presov' , 'ja': 'タトラン・プレソフ' , 'ko': '타트란 프레소프' , 'th': 'ทาทราน เปรซอฟ' , 'pt': 'Tatran Presov' },
  'Tegevajaro Miyazaki': { 'ar': 'تيغيفاجارو ميازاكي', 'zh-CN': '宫崎特格瓦雅罗', 'zh-TW': '宮崎特格瓦雅羅', 'ru': 'Тегеваяро Миядзаки', 'de': 'Tegevajaro Miyazaki' , 'ja': 'テゲバジャーロ宮崎' , 'ko': '미야자키 테게바자로' , 'th': 'เทเกวาจาโร มิยาซากิ' , 'pt': 'Tegevajaro Miyazaki' },
  'The Cove': { 'ar': 'ذا كوف', 'zh-CN': '海湾', 'zh-TW': '海灣', 'ru': 'Бухта', 'de': 'The Cove' , 'ja': 'ザ・コーブ' , 'ko': '더 코브' , 'th': 'เดอะโคฟ' , 'pt': 'The Cove' },
  'Thespa Gunma': { 'es': 'Thespakusatsu Gunma', 'zh-CN': '群马草津温泉', 'zh-TW': '群馬溫泉', 'ru': 'Теспа Гунма', 'de': 'Thespa Gunma' , 'ja': 'ザスパ群馬' , 'ko': '테스파 군마' , 'th': 'เทพสปา กุมมะ' , 'pt': 'Thespa Gunma' },
  'Thespakusatsu Gunma': { 'es': 'Thespakusatsu Gunma', 'zh-CN': '群马草津温泉', 'zh-TW': '群馬溫泉', 'ru': 'Теспакусацу Гумма', 'de': 'Thespakusatsu Gunma' , 'ja': 'ザスパクサツ群馬' , 'ko': '테스파쿠사츠 군마' , 'th': 'เทสปะคุซัตสึ กุมมะ' , 'pt': 'Thespakusatsu Gunma' },
  'Tigre': { 'es': 'Tigre', 'zh-CN': '老虎竞技', 'zh-TW': '堤格雷', 'ru': 'Тигре', 'de': 'Tigre' , 'ja': 'ティグル' , 'ko': '티그레' , 'th': 'ไทเกร' , 'pt': 'Tigre' },
  'Tigres': { 'ja': 'ティグレス', 'ko': '티그레스', 'ru': 'Тигрес', 'th': 'ติเกรส' , 'de': 'Tigres' , 'pt': 'Tigres' },
  'Tigres UANL': { 'es': 'Tigres UANL', 'zh-CN': '新莱昂自治大学老虎', 'zh-TW': '新萊昂自治大學老虎', 'ru': 'Тигрес УАНЛ', 'de': 'Tigres UANL' , 'ja': 'ティグレス UANL' , 'ko': '티그레스 UANL' , 'th': 'ไทเกรส UANL' , 'pt': 'Tigres UANL' },
  'Tijuana': { 'es': 'Tijuana', 'zh-CN': '蒂华纳', 'zh-TW': '蒂華納', 'ru': 'Тромсё', 'de': 'Tijuana' , 'ja': 'ティファナ' , 'ko': '티후아나' , 'th': 'ติฮัวนา' , 'pt': 'Tijuana' },
  'Tivoli Gardens': { 'ar': 'تيفولي جاردنز', 'ru': 'Торино', 'de': 'Tivoli Gardens' , 'ja': 'チボリ公園' , 'ko': '티볼리 정원' , 'th': 'สวนทิโวลี' , 'pt': 'Tivoli Gardens' },
  'Tobol': { 'zh-CN': '托博尔', 'zh-TW': '杜保爾', 'ru': 'Тобол', 'de': 'Tobol' , 'ja': 'トボル' , 'ko': '토볼' , 'th': 'โทบอล' , 'pt': 'Tobol' },
  'Tochigi City FC': { 'ar': 'توتشيغي سيتي', 'zh-CN': '栃木城FC', 'zh-TW': '栃木城FC', 'ru': 'Тотиги Сити', 'de': 'Tochigi City FC' , 'ja': '栃木シティFC' , 'ko': '도치기 시티 FC' , 'th': 'โทชิกิ ซิตี้ เอฟซี' , 'pt': 'Tochigi City FC' },
  'Tochigi SC': { 'es': 'Tochigi SC', 'zh-CN': '栃木SC', 'zh-TW': '栃木SC', 'ru': 'Тотиги СК', 'de': 'Tochigi SC' , 'ja': '栃木SC' , 'ko': '도치기 SC' , 'th': 'โทชิกิ เอสซี' , 'pt': 'Tochigi SC' },
  'Tokushima Vortis': { 'ar': 'توكوشيما فورتيس', 'zh-CN': '德岛漩涡', 'zh-TW': '德島漩渦', 'ru': 'Тоттенхэм', 'de': 'Tokushima Vortis' , 'ja': '徳島ヴォルティス' , 'ko': '도쿠시마 보르티스' , 'th': 'โทคุชิมะ วอร์ติส' , 'pt': 'Tokushima Vortis' },
  'Tolima': { 'ar': 'توليما', 'ru': 'Толима', 'de': 'Tolima' , 'ja': 'トリマ' , 'ko': '톨리마' , 'th': 'โตลิมา' , 'pt': 'Tolima' },
  'Toluca': { 'ja': 'トルーカ', 'ko': '톨루카', 'ru': 'Толука', 'th': 'โตลูกา' , 'de': 'Toluca' , 'pt': 'Toluca' },
  'Torino': { 'ja': 'トリノ', 'ko': '토리노', 'ru': 'Торино', 'th': 'โตรีโน' , 'de': 'Torino' , 'pt': 'Torino' },
  'Tottenham': { 'ar': 'توتنهام', 'de': 'Tottenham', 'es': 'Tottenham', 'fr': 'Tottenham', 'ja': 'トッテナム', 'ko': '토트넘',
 'pt': 'Tottenham', 'ru': 'Тоттенхэм', 'zh-CN': '托特纳姆热刺', 'zh-TW': '熱刺' , 'th': 'ท็อตแน่ม' },
  'Tottenham Hotspur': { 'ar': 'توتنهام', 'de': 'Tottenham', 'es': 'Tottenham', 'fr': 'Tottenham', 'ja': 'トッテナム', 'ko': '토트넘',
 'pt': 'Tottenham', 'ru': 'Тоттенхэм', 'zh-CN': '托特纳姆热刺', 'zh-TW': '熱刺' , 'th': 'ท็อตแน่ม ฮ็อทสเปอร์' },
  'Toulouse': { 'ja': 'トゥールーズ', 'ko': '툴루즈', 'ru': 'Тулуза', 'th': 'ตูลูซ' , 'de': 'Toulouse' , 'pt': 'Toulouse' },
  'Tranmere': { 'es': 'Tranmere', 'zh-CN': '特兰米尔', 'zh-TW': '特蘭米爾', 'ru': 'Транмер', 'de': 'Tranmere' , 'ja': 'トランメア' , 'ko': '트랜미어' , 'th': 'ทรานเมียร์' , 'pt': 'Tranmere' },
  'Tranmere Rovers': { 'ar': 'ترانمير روفرز', 'zh-CN': '特兰米尔流浪者', 'zh-TW': '特蘭米爾流浪者', 'ru': 'Транмер Роверс', 'de': 'Tranmere Rovers' , 'ja': 'トランメア・ローバーズ' , 'ko': '트랜미어 로버스' , 'th': 'ทรานเมียร์ โรเวอร์ส' , 'pt': 'Tranmere Rovers' },
  'Trayal Krusevac': { 'ar': 'ترايال كروشيفاتس', 'zh-CN': '特拉亚尔', 'zh-TW': '特拉亞爾', 'ru': 'Траял Крушевац', 'de': 'Trayal Krusevac' , 'ja': 'トレイヤル・クルセヴァツ' , 'ko': '트레이알 크루세바츠' , 'th': 'เทรอัล ครูเซวัค' , 'pt': 'Trayal Krusevac' },
  'Treasure Beach': { 'ar': 'تريجر بيتش', 'ru': 'Пляж сокровищ', 'de': 'Treasure Beach' , 'ja': 'トレジャービーチ' , 'ko': '트레저 비치' , 'th': 'หาดเทรเชอร์' , 'pt': 'Treasure Beach' },
  'Treaty United': { 'ar': 'تريتي يونايتد', 'zh-CN': '条约联', 'zh-TW': '條約聯', 'ru': 'Удинезе', 'de': 'Treaty United' , 'ja': '条約ユナイテッド' , 'ko': '조약 유나이티드' , 'th': 'สนธิสัญญายูไนเต็ด' , 'pt': 'Treaty United' },
  'Trencin': { 'zh-CN': '特伦钦', 'zh-TW': '特倫欽', 'ru': 'Тренчин', 'de': 'Trencin' , 'ja': 'トレンチーン' , 'ko': '트렌친' , 'th': 'เทรนซิน' , 'pt': 'Trencin' },
  'Tromso': { 'ar': 'ترومسو', 'zh-CN': '特罗姆瑟', 'zh-TW': '特林素', 'ru': 'Тромсё', 'de': 'Tromso' , 'ja': 'トロムソ' , 'ko': '트롬소' , 'th': 'ทรอมโซ' , 'pt': 'Tromso' },
  'Tromsoe': { 'es': 'Tromsø', 'zh-CN': '特罗姆瑟', 'zh-TW': '特羅姆瑟', 'ru': 'Тромсе', 'de': 'Tromsoe' , 'ja': 'トロムソー' , 'ko': '트롬쇠' , 'th': 'ทรอมโซ' , 'pt': 'Tromsoe' },
  'TSC Backa Topola': { 'ar': 'تي إس سي باتشكا توبولا', 'ru': 'ТСК Бачка Топола', 'de': 'TSC Backa Topola' , 'ja': 'TSCバッカ・トポラ' , 'ko': 'TSC 바카 토폴라' , 'th': 'ทีเอสซี แบ็คก้า โทโพลา' , 'pt': 'TSC Backa Topola' },
  'TSV Hartberg': { 'ar': 'هارتبيرغ', 'zh-CN': '哈特贝格', 'zh-TW': '哈特貝格', 'ru': 'ТСВ Хартберг', 'de': 'TSV Hartberg' , 'ja': 'TSV ハートバーグ' , 'ko': 'TSV 하트베르크' , 'th': 'ทีเอสวี ฮาร์ทเบิร์ก' , 'pt': 'TSV Hartberg' },
  'Turan Tovuz': { 'ar': 'توران توفوز', 'ru': 'Туран Товуз', 'de': 'Turan Tovuz' , 'ja': 'トゥラン・トブズ' , 'ko': '투란 토부즈' , 'th': 'ตูราน โตวูซ' , 'pt': 'Turan Tovuz' },
  'UCD': { 'ar': 'جامعة دبلن', 'ru': 'ЮСиДи', 'zh-CN': '都柏林大学', 'zh-TW': '都柏林大學' , 'de': 'UCD' , 'ja': 'UCD' , 'ko': 'UCD' , 'th': 'ยูซีดี' , 'pt': 'UCD' },
  'Udinese': { 'ja': 'ウディネーゼ', 'ko': '우디네세', 'ru': 'Удинезе', 'th': 'อูดีเนเซ' , 'de': 'Udinese' , 'pt': 'Udinese' },
  'Ulinzi Stars': { 'ar': 'أولينزي ستارز', 'zh-CN': '乌林兹之星', 'zh-TW': '烏林茲之星', 'ru': 'Улинзи Старс', 'de': 'Ulinzi Stars' , 'ja': 'ウリンジ スターズ' , 'ko': '울린지 스타즈' , 'th': 'อูลินซี สตาร์' , 'pt': 'Ulinzi Stars' },
  'Ulsan Hyundai': { 'ar': 'أولسان هيونداي', 'zh-CN': '蔚山现代', 'zh-TW': '蔚山現代', 'ru': 'Волеренга', 'de': 'Ulsan Hyundai' , 'ja': '蔚山現代' , 'ko': '울산현대' , 'th': 'อุลซาน ฮุนได' , 'pt': 'Ulsan Hyundai' },
  'Umm Salal': { 'ar': 'أم صلال', 'ru': 'Умм Салал', 'de': 'Umm Salal' , 'ja': 'ウム・サラル' , 'ko': '음 살랄' , 'th': 'อุมม์ ซาลาล' , 'pt': 'Umm Salal' },
  'Union': { 'es': 'Unión', 'zh-CN': '圣菲联合', 'zh-TW': '聖菲聯合', 'ru': 'Союз', 'de': 'Union' , 'ja': '連合' , 'ko': '노동 조합' , 'th': 'ยูเนี่ยน' , 'pt': 'Union' },
  'Union Berlin': { 'ar': 'يونيون برلين', 'zh-CN': '柏林联', 'zh-TW': '柏林聯', 'ru': 'Союз Берлина', 'de': 'Union Berlin' , 'ja': 'ユニオン ベルリン' , 'ko': '유니언 베를린' , 'th': 'ยูเนี่ยน เบอร์ลิน' , 'pt': 'Union Berlin' },
  'Union St.Gilloise': { 'de': 'Union St.Gilloise', 'es': 'Union St. Gilloise', 'fr': 'Union St. Gilloise', 'ja': 'ユニオン・サン＝ジロワーズ', 'ko': '루아얄 위니옹 생질루아즈',
 'pt': 'Union St. Gilloise', 'ru': 'Юнион Сент-Жиллуаз', 'zh-CN': '圣吉罗斯', 'zh-TW': '聖吉羅斯' , 'th': 'ยูเนี่ยน เซนต์ กิลลอยส์' },
  'Unirea Slobozia': { 'ar': 'يونيريا سلوبوزيا', 'zh-CN': '斯洛博齐亚联', 'zh-TW': '斯洛博齊亞聯', 'ru': 'Униря Слобозия', 'de': 'Unirea Slobozia' , 'ja': 'ウニレア・スロボジア' , 'ko': '우니레아 슬로보지아' , 'th': 'ยูนิเรอา สโลโบเซีย' , 'pt': 'Unirea Slobozia' },
  'Universidad Central': { 'ar': 'يونيفرسيداد سنترال', 'ru': 'Валенсия', 'de': 'Universidad Central' , 'ja': '中央大学' , 'ko': '유니버시다드 센트럴' , 'th': 'มหาวิทยาลัยกลาง' , 'pt': 'Universidad Central' },
  'Universitario de Deportes': { 'ar': 'يونيفرسيتاريو دي ديبورتيس', 'ru': 'Университет Депортес', 'de': 'Universitario de Deportes' , 'ja': 'デポルテス大学' , 'ko': 'Universitario de Deportes' , 'th': 'มหาวิทยาลัยเนรเทศ' , 'pt': 'Universitario de Deportes' },
  'Universitatea Cluj': { 'ar': 'يونيفرسيتاتيا كلوج', 'zh-CN': '克卢日大学', 'zh-TW': '克盧日大學', 'ru': 'Университет Клужа', 'de': 'Universitatea Cluj' , 'ja': 'クルージュ大学' , 'ko': 'Universitatea Cluj' , 'th': 'มหาวิทยาลัยคลูช' , 'pt': 'Universitatea Cluj' },
  'University of Pretoria': { 'ar': 'جامعة بريتوريا', 'zh-CN': '比勒陀利亚大学', 'zh-TW': '普勒托利亞大學', 'ru': 'Университет Претории', 'de': 'University of Pretoria' , 'ja': 'プレトリア大学' , 'ko': '프리토리아대학교' , 'th': 'มหาวิทยาลัยพริทอเรีย' , 'pt': 'University of Pretoria' },
  'Urawa Red Diamonds': { 'ja': '浦和レッズ', 'ko': '우라와 레즈', 'ru': 'Урава Редс', 'th': 'อูราวะเรดไดมอนส์' , 'de': 'Urawa Red Diamonds' , 'pt': 'Urawa Red Diamonds' },
  'Urawa Reds': { 'es': 'Urawa Reds', 'zh-CN': '浦和红钻', 'zh-TW': '浦和紅鑽', 'ru': 'Урава Редс', 'de': 'Urawa Reds' , 'ja': '浦和レッズ' , 'ko': '우라와 레즈' , 'th': 'อูราวะ เรดส์' , 'pt': 'Urawa Reds' },
  'UTA Arad': { 'ar': 'يو تي إيه أراد', 'zh-CN': '阿拉德', 'zh-TW': '阿拉德', 'ru': 'УТА Арад', 'de': 'UTA Arad' , 'ja': 'ユタ・アラド' , 'ko': 'UTA 아라드' , 'th': 'ยูทีเอ อาราด' , 'pt': 'UTA Arad' },
  'V-Varen Nagasaki': { 'es': 'V-Varen Nagasaki', 'zh-CN': '长崎成功丸', 'zh-TW': '長崎成功丸', 'ru': 'Викинг', 'de': 'V-Varen Nagasaki' , 'ja': 'V・ファーレン長崎' , 'ko': 'V-바렌 나가사키' , 'th': 'วี-วาเรน นางาซากิ' , 'pt': 'V-Varen Nagasaki' },
  'V-Varen Niigata': { 'es': 'Albirex Niigata', 'zh-CN': '新潟天鹅', 'zh-TW': '新潟天鵝', 'ru': 'В-Варен Ниигата', 'de': 'V-Varen Niigata' , 'ja': 'V・ファーレン新潟' , 'ko': 'V-바렌 니가타' , 'th': 'วี-วาเรน นีงาตะ' , 'pt': 'V-Varen Niigata' },
  'Vaalerenga': { 'es': 'Vålerenga', 'zh-CN': '瓦勒伦加', 'zh-TW': '華拉倫加', 'ru': 'Ваалеренга', 'de': 'Vaalerenga' , 'ja': 'ヴァーレレンガ' , 'ko': '발레렌가' , 'th': 'วาเลเรนกา' , 'pt': 'Vaalerenga' },
  'Valencia': { 'ja': 'バレンシア', 'ko': '발렌시아', 'ru': 'Валенсия', 'th': 'บาเลนเซีย' , 'de': 'Valencia' , 'pt': 'Valencia' },
  'Valerenga': { 'ar': 'فوليرينغا', 'zh-CN': '瓦勒伦加', 'zh-TW': '瓦勒倫加', 'ru': 'Валеренга', 'de': 'Valerenga' , 'ja': 'ヴァレレンガ' , 'ko': '발레렝가' , 'th': 'วาเลเรนกา' , 'pt': 'Valerenga' },
  'Valletta': { 'ar': 'فاليتا', 'zh-CN': '瓦莱塔', 'zh-TW': '瓦萊塔', 'ru': 'Валлетта', 'de': 'Valletta' , 'ja': 'バレッタ' , 'ko': '발레타' , 'th': 'วัลเลตตา' , 'pt': 'Valletta' },
  'Vancouver FC': { 'de': 'Vancouver FC', 'es': 'Vancouver FC', 'fr': 'Vancouver FC', 'ja': 'バンクーバーFC', 'ko': '밴쿠버 FC',
 'pt': 'Vancouver FC', 'ru': 'Ванкувер', 'zh-CN': '温哥华FC', 'zh-TW': '溫哥華FC' , 'th': 'แวนคูเวอร์ เอฟซี' },
  'Vanraure Hachinohe': { 'es': 'Vanraure Hachinohe', 'zh-CN': '八户云罗里', 'zh-TW': '八戶雲羅里', 'ru': 'Вердер', 'de': 'Vanraure Hachinohe' , 'ja': 'ヴァンローレ八戸' , 'ko': '반로레 하치노헤' , 'th': 'วานราอุเร่ ฮาชิโนเฮะ' , 'pt': 'Vanraure Hachinohe' },
  'Vegalta Sendai': { 'ar': 'فيغالتا سينداي', 'zh-CN': '仙台维加泰', 'zh-TW': '仙台維加泰', 'ru': 'Вильярреал', 'de': 'Vegalta Sendai' , 'ja': 'ベガルタ仙台' , 'ko': '베갈타 센다이' , 'th': 'เวกัลตะ เซนได' , 'pt': 'Vegalta Sendai' },
  'Vejle Boldklub': { 'ar': 'فايله', 'ru': 'Уотфорд', 'de': 'Vejle Boldklub' , 'ja': 'ヴァイレ・ボルドクラブ' , 'ko': '바일레 볼드클럽' , 'th': 'เวจเล โบลด์คลับ' , 'pt': 'Vejle Boldklub' },
  'Velez Sarsfield': { 'es': 'Vélez Sarsfield', 'zh-CN': '萨斯菲尔德', 'zh-TW': '沙士菲', 'ru': 'Велес Сарсфилд', 'de': 'Velez Sarsfield' , 'ja': 'ベレス・サースフィールド' , 'ko': '벨레스 사스필드' , 'th': 'เบเลซ ซาร์สฟิลด์' , 'pt': 'Velez Sarsfield' },
  'Venda': { 'ar': 'فيندا', 'ru': 'Венда', 'de': 'Venda' , 'ja': 'ヴェンダ' , 'ko': '벤다' , 'th': 'เวนดา' , 'pt': 'Venda' },
  'Venezia': { 'ja': 'ヴェネツィア', 'ko': '베네치아', 'ru': 'Венеция', 'th': 'เวเนเซีย' , 'de': 'Venezia' , 'pt': 'Venezia' },
  'Ventforet Kofu': { 'es': 'Ventforet Kofu', 'zh-CN': '甲府风林', 'zh-TW': '甲府風林', 'ru': 'Вентфорет Кофу', 'de': 'Ventforet Kofu' , 'ja': 'ヴァンフォーレ甲府' , 'ko': '벤트포레 고후' , 'th': 'เวนท์ฟอเรท โคฟุ' , 'pt': 'Ventforet Kofu' },
  'Ventforet Nagasaki': { 'es': 'V-Varen Nagasaki', 'zh-CN': '长崎成功丸', 'zh-TW': '長崎成功丸', 'ru': 'Вест Бромвич', 'de': 'Ventforet Nagasaki' , 'ja': 'ヴァンフォーレ長崎' , 'ko': '벤트포레 나가사키' , 'th': 'เวนท์ฟอเรท นางาซากิ' , 'pt': 'Ventforet Nagasaki' },
  'Veres Rivne': { 'ar': 'فيريس ريفني', 'ru': 'Верес Ровно', 'de': 'Veres Rivne' , 'ja': 'ベレス・リブネ' , 'ko': '베레스 리브네' , 'th': 'เวเรส ริฟเน่' , 'pt': 'Veres Rivne' },
  'VfB Stuttgart': { 'ar': 'شتوتغارت', 'zh-CN': '斯图加特', 'zh-TW': '斯圖加特', 'ru': 'ВФБ Штутгарт', 'de': 'VfB Stuttgart' , 'ja': 'VfB シュトゥットガルト' , 'ko': 'VfB 슈투트가르트' , 'th': 'วีเอฟบี สตุ๊ตการ์ท' , 'pt': 'VfB Stuttgart' },
  'VfL Bochum': { 'ar': 'بوخوم', 'zh-CN': '波鸿', 'zh-TW': '波鴻', 'ru': 'ВФЛ Бохум', 'de': 'VfL Bochum' , 'ja': 'VfL ボーフム' , 'ko': 'VfL 보훔' , 'th': 'วีเอฟแอล โบคุ่ม' , 'pt': 'VfL Bochum' },
  'Viborg': { 'ar': 'فيبورغ', 'zh-CN': '维堡', 'zh-TW': '維堡', 'ru': 'Выборг', 'de': 'Viborg' , 'ja': 'ヴィボーグ' , 'ko': '비보르' , 'th': 'ไวบอร์ก' , 'pt': 'Viborg' },
  'Viking': { 'ar': 'فايكنغ', 'zh-CN': '维京', 'zh-TW': '維京', 'ru': 'Викинг', 'de': 'Viking' , 'ja': 'バイキング' , 'ko': '바이킹' , 'th': 'ไวกิ้ง' , 'pt': 'Viking' },
  'Villarreal': { 'ja': 'ビジャレアル', 'ko': '비야레알', 'ru': 'Вильярреал', 'th': 'บิยาร์เรอัล' , 'de': 'Villarreal' , 'pt': 'Villarreal' },
  'Vissel Kobe': { 'ja': 'ヴィッセル神戸', 'ko': '비셀 고베', 'ru': 'Виссел Кобе', 'th': 'วิสเซลโคเบะ' , 'de': 'Vissel Kobe' , 'pt': 'Vissel Kobe' },
  'Vojvodina': { 'zh-CN': '伏伊伏丁那', 'zh-TW': '禾獲甸拿', 'ru': 'Уиган', 'de': 'Vojvodina' , 'ja': 'ヴォイボディナ' , 'ko': '보이보디나' , 'th': 'วอยโวดิน่า' , 'pt': 'Vojvodina' },
  'Vozdovac': { 'ar': 'فوزدوفاتس', 'ru': 'Воздовац', 'de': 'Vozdovac' , 'ja': 'ヴォズドヴァツ' , 'ko': '보즈도박' , 'th': 'วอซโดวัค' , 'pt': 'Vozdovac' },
  'Wadi Degla FC': { 'ar': 'وادي دجلة', 'ru': 'Вади Дегла ФК', 'de': 'Wadi Degla FC' , 'ja': 'ワディ・デグラFC' , 'ko': '와디 데글라 FC' , 'th': 'วาดี้ เดกล่า เอฟซี' , 'pt': 'Wadi Degla FC' },
  'Walsall': { 'ar': 'والسال', 'zh-CN': '沃尔索尔', 'zh-TW': '沃爾索爾', 'ru': 'Уолсолл', 'de': 'Walsall' , 'ja': 'ウォールソール' , 'ko': '월솔' , 'th': 'วอลซอลล์' , 'pt': 'Walsall' },
  'Warrington Rylands': { 'ar': 'وارينغتون رايلاندس', 'ru': 'Уоррингтон Райландс', 'de': 'Warrington Rylands' , 'ja': 'ウォリントン・ライランズ' , 'ko': '워링턴 라이랜즈' , 'th': 'วอร์ริงตัน ไรแลนด์ส' , 'pt': 'Warrington Rylands' },
  'Watford': { 'ar': 'واتفورد', 'zh-CN': '沃特福德', 'zh-TW': '沃特福德', 'ru': 'Уотфорд', 'de': 'Watford' , 'ja': 'ワトフォード' , 'ko': '왓포드' , 'th': 'วัตฟอร์ด' , 'pt': 'Watford' },
  'Werder Bremen': { 'ar': 'فيردر بريمن', 'zh-CN': '云达不莱梅', 'zh-TW': '雲達不萊梅', 'ru': 'Вест Хэм', 'de': 'Werder Bremen' , 'ja': 'ヴェルダー ブレーメン' , 'ko': '베르더 브레멘' , 'th': 'แวร์เดอร์ เบรเมน' , 'pt': 'Werder Bremen' },
  'Werder Bremen W': { 'ar': 'فيردر بريمن (سيدات)', 'zh-CN': '云达不莱梅女足', 'zh-TW': '雲達不萊梅女足', 'ru': 'Вердер Бремен (Ж)', 'de': 'Werder Bremen W' , 'ja': 'ヴェルダー ブレーメン W' , 'ko': '베르더 브레멘 여' , 'th': 'แวร์เดอร์ เบรเมน ดับเบิลยู' , 'pt': 'Werder Bremen W' },
  'West Brom': { 'es': 'West Brom', 'zh-CN': '西布罗姆维奇', 'zh-TW': '西布朗', 'ru': 'Вест Бромвич', 'de': 'West Brom' , 'ja': 'ウェストブロム' , 'ko': '웨스트브롬' , 'th': 'เวสต์บรอม' , 'pt': 'West Brom' },
  'West Bromwich Albion': { 'ar': 'وست بروميتش', 'zh-CN': '西布朗', 'zh-TW': '西布朗', 'ru': 'Вест Бромвич Альбион', 'de': 'West Bromwich Albion' , 'ja': 'ウェスト ブロムウィッチ アルビオン' , 'ko': '웨스트브로미치 앨비언' , 'th': 'เวสต์บรอมวิช อัลเบี้ยน' , 'pt': 'West Bromwich Albion' },
  'West Ham': { 'ar': 'وست هام', 'de': 'West Ham', 'es': 'West Ham', 'fr': 'West Ham', 'ja': 'ウェストハム', 'ko': '웨스트햄',
 'pt': 'West Ham', 'ru': 'Вест Хэм', 'zh-CN': '西汉姆联', 'zh-TW': '西漢姆聯' , 'th': 'เวสต์แฮม' },
  'West Ham United': { 'ar': 'وست هام', 'de': 'West Ham', 'es': 'West Ham', 'fr': 'West Ham', 'ja': 'ウェストハム', 'ko': '웨스트햄',
 'pt': 'West Ham', 'ru': 'Вест Хэм', 'zh-CN': '西汉姆联', 'zh-TW': '西漢姆聯' , 'th': 'เวสต์แฮม ยูไนเต็ด' },
  'Westerlo': { 'ar': 'فيستيرلو', 'zh-CN': '韦斯特洛', 'zh-TW': '韋斯特洛', 'ru': 'Вестерло', 'de': 'Westerlo' , 'ja': 'ウェスターロ' , 'ko': '웨스텔로' , 'th': 'เวสเตอร์โล' , 'pt': 'Westerlo' },
  'Western United FC Youth': { 'ar': 'ويسترن يونايتد (شباب)', 'zh-CN': '西部联青年', 'zh-TW': '西部聯青年', 'ru': 'Вестерн Юнайтед Молодёжь', 'de': 'Western United FC Youth' , 'ja': 'ウェスタン・ユナイテッドFCユース' , 'ko': '웨스턴 유나이티드 FC 유스' , 'th': 'เวสเทิร์น ยูไนเต็ด เอฟซี (เยาวชน)' , 'pt': 'Western United FC Youth' },
  'Wexford FC': { 'ar': 'ويكسفورد', 'zh-CN': '韦克斯福德', 'zh-TW': '韋克斯福德', 'ru': 'Уэксфорд ФК', 'de': 'Wexford FC' , 'ja': 'ウェックスフォード FC' , 'ko': '웩스포드 FC' , 'th': 'เว็กซ์ฟอร์ด เอฟซี' , 'pt': 'Wexford FC' },
  'Wigan': { 'es': 'Wigan', 'zh-CN': '维冈', 'zh-TW': '維根', 'ru': 'Уиган', 'de': 'Wigan' , 'ja': 'ウィガン' , 'ko': '위건' , 'th': 'วีแกน' , 'pt': 'Wigan' },
  'Wigan Athletic': { 'ar': 'ويغان أثلتيك', 'zh-CN': '维冈竞技', 'zh-TW': '維根競技', 'ru': 'Уиган Атлетик', 'de': 'Wigan Athletic' , 'ja': 'ウィガン・アスレティック' , 'ko': '위건 애슬레틱' , 'th': 'วีแกน แอธเลติก' , 'pt': 'Wigan Athletic' },
  'Wimbledon': { 'es': 'Wimbledon', 'zh-CN': '温布尔登', 'zh-TW': '溫布頓', 'ru': 'Вулверхэмптон', 'de': 'Wimbledon' , 'ja': 'ウィンブルドン' , 'ko': '윔블던' , 'th': 'วิมเบิลดัน' , 'pt': 'Wimbledon' },
  'Wolfsberger AC': { 'ar': 'فولفسبرغر', 'zh-CN': '沃尔夫斯贝格', 'zh-TW': '沃爾夫斯貝格', 'ru': 'Вольфсбергер АК', 'de': 'Wolfsberger AC' , 'ja': 'ヴォルフスベルガーAC' , 'ko': '볼프스베르거 AC' , 'th': 'โวล์ฟสเบอร์เกอร์ เอซี' , 'pt': 'Wolfsberger AC' },
  'Wolfsburg': { 'ar': 'فولفسبورغ', 'zh-CN': '沃尔夫斯堡', 'zh-TW': '沃爾夫斯堡', 'ru': 'Вольфсбург', 'de': 'Wolfsburg' , 'ja': 'ヴォルフスブルク' , 'ko': '볼프스부르크' , 'th': 'โวล์ฟสบวร์ก' , 'pt': 'Wolfsburg' },
  'Wolfsburg W': { 'ar': 'فولفسبورغ (سيدات)', 'zh-CN': '沃尔夫斯堡女足', 'zh-TW': '沃爾夫斯堡女足', 'ru': 'Вольфсбург (Ж)', 'de': 'Wolfsburg W' , 'ja': 'ヴォルフスブルク W' , 'ko': '볼프스부르크 여' , 'th': 'โวล์ฟสบวร์ก ดับเบิลยู' , 'pt': 'Wolfsburg W' },
  'Wolverhampton Wanderers': { 'ar': 'وولفرهامبتون', 'de': 'Wolves', 'es': 'Wolves', 'fr': 'Wolves', 'ja': 'ウルヴァーハンプトン', 'ko': '울버햄튼',
 'pt': 'Wolves', 'ru': 'Вулверхэмптон', 'zh-CN': '狼队', 'zh-TW': '狼隊' , 'th': 'วูล์ฟแฮมป์ตัน วันเดอร์เรอร์ส' },
  'Wolves': { 'ar': 'وولفرهامبتون', 'de': 'Wolves', 'es': 'Wolves', 'fr': 'Wolves', 'ja': 'ウルブス', 'ko': '울브스',
 'pt': 'Wolves', 'ru': 'Вулверхэмптон', 'zh-CN': '狼队', 'zh-TW': '狼隊' , 'th': 'หมาป่า' },
  'Wrexham': { 'ar': 'ريكسهام', 'zh-CN': '雷克瑟姆', 'zh-TW': '雷克斯漢姆', 'ru': 'Рексхэм', 'de': 'Wrexham' , 'ja': 'レクサム' , 'ko': '렉섬' , 'th': 'เร็กซ์แฮม' , 'pt': 'Wrexham' },
  'WSG Tirol': { 'ar': 'دبليو إس جي تيرول', 'zh-CN': '蒂罗尔WSG', 'zh-TW': '蒂羅爾WSG', 'ru': 'WSG Тироль', 'de': 'WSG Tirol' , 'ja': 'WSG チロル' , 'ko': 'WSG 티롤' , 'th': 'WSG ทิโรล' , 'pt': 'WSG Tirol' },
  'Wycombe': { 'es': 'Wycombe', 'zh-CN': '韦康比', 'zh-TW': '韋康比', 'ru': 'Уикомб', 'de': 'Wycombe' , 'ja': 'ウィコム' , 'ko': '위컴' , 'th': 'วีคอมบ์' , 'pt': 'Wycombe' },
  'Wycombe Wanderers': { 'ar': 'ويكومب واندررز', 'zh-CN': '韦康比流浪者', 'zh-TW': '韋康比流浪者', 'ru': 'Уиком Уондерерс', 'de': 'Wycombe Wanderers' , 'ja': 'ウィコム ワンダラーズ' , 'ko': '위컴 원더러스' , 'th': 'วีคอมบ์ วันเดอร์เรอร์ส' , 'pt': 'Wycombe Wanderers' },
  'Yokohama F. Marinos': { 'ja': '横浜F・マリノス', 'ko': '요코하마 F. 마리노스', 'ru': 'Иокогама Ф. Маринос', 'th': 'โยโกฮามะ มารินอส' , 'de': 'Yokohama F. Marinos' , 'pt': 'Yokohama F. Marinos' },
  'Yokohama F.Marinos': { 'es': 'Yokohama F. Marinos', 'zh-CN': '横滨水手', 'zh-TW': '橫濱水手', 'ru': 'Йокогама Ф.Маринос', 'de': 'Yokohama F.Marinos' , 'ja': '横浜F・マリノス' , 'ko': '요코하마 F.마리노스' , 'th': 'โยโกฮาม่า เอฟ มารินอส' , 'pt': 'Yokohama F.Marinos' },
  'Yokohama FC': { 'ar': 'يوكوهاما إف سي', 'zh-CN': '横滨FC', 'zh-TW': '橫濱FC', 'ru': 'Йокогама ФК', 'de': 'Yokohama FC' , 'ja': '横浜FC' , 'ko': '요코하마FC' , 'th': 'โยโกฮาม่า เอฟซี' , 'pt': 'Yokohama FC' },
  'Young Africans': { 'zh-CN': '年轻非洲人', 'zh-TW': '年輕非洲人', 'ru': 'Молодые африканцы', 'de': 'Young Africans' , 'ja': 'アフリカの若者' , 'ko': '젊은 아프리카인' , 'th': 'หนุ่มแอฟริกัน' , 'pt': 'Young Africans' },
  'Young Lions': { 'zh-CN': '幼狮', 'zh-TW': '幼獅', 'ru': 'Молодые львы', 'de': 'Young Lions' , 'ja': 'ヤングライオンズ' , 'ko': '젊은 라이온스' , 'th': 'สิงห์หนุ่ม' , 'pt': 'Young Lions' },
  'Ypsonas': { 'ar': 'إبسوناس', 'zh-CN': '伊普索纳斯', 'zh-TW': '伊普索納斯', 'ru': 'Ипсонас', 'de': 'Ypsonas' , 'ja': 'イプソナス' , 'ko': '입소나스' , 'th': 'อิปโซนัส' , 'pt': 'Ypsonas' },
  'Zakho': { 'ar': 'زاخو', 'zh-CN': '扎胡', 'zh-TW': '扎胡', 'ru': 'Захо', 'de': 'Zakho' , 'ja': 'ザコー' , 'ko': '자코' , 'th': 'ซาโค' , 'pt': 'Zakho' },
  'Zed FC': { 'zh-CN': '泽德', 'zh-TW': '澤德', 'ru': 'Зед ФК', 'de': 'Zed FC' , 'ja': 'ゼッドFC' , 'ko': '제드 FC' , 'th': 'เซ็ด เอฟซี' , 'pt': 'Zed FC' },
  'ZED FC': { 'ar': 'زد إف سي', 'ru': 'ЗЕД ФК', 'de': 'ZED FC' , 'ja': 'ゼッドFC' , 'ko': '제드 FC' , 'th': 'เซด เอฟซี' , 'pt': 'ZED FC' },
  'Zeleznicar Pancevo': { 'de': 'Železničar Pančevo', 'es': 'Železničar Pančevo', 'fr': 'Železničar Pančevo', 'ja': 'ジェレズニチャル・パンチェヴォ', 'ko': '젤레즈니차르 판체보',
 'pt': 'Železničar Pančevo', 'ru': 'Железничар Панчево', 'zh-CN': '潘切沃铁路', 'zh-TW': '潘切沃鐵路' , 'th': 'เซเลซนิการ์ ปานเชโว' },
  'Zeljeznicar': { 'ar': 'جيلييزنيتشار', 'zh-CN': '泽列兹尼察', 'zh-TW': '澤列茲尼察', 'ru': 'Железничар', 'de': 'Zeljeznicar' , 'ja': 'ゼリエズニカール' , 'ko': '젤예즈니카르' , 'th': 'เซลเจซนิการ์' , 'pt': 'Zeljeznicar' },
  'Zimbru': { 'ar': 'زيمبرو', 'zh-CN': '津布鲁', 'zh-TW': '津布魯', 'ru': 'Зимбру', 'de': 'Zimbru' , 'ja': 'ジンブル' , 'ko': '짐브루' , 'th': 'ซิมบรู' , 'pt': 'Zimbru' },
  'Zira': { 'ar': 'زيرا', 'ru': 'Зира', 'de': 'Zira' , 'ja': 'ジラ' , 'ko': '지라' , 'th': 'ซีร่า' , 'pt': 'Zira' },
  'Zorya': { 'ar': 'زوريا', 'ru': 'Заря', 'de': 'Zorya' , 'ja': 'ゾーリャ' , 'ko': '조리야' , 'th': 'ซอร์ยา' , 'pt': 'Zorya' },
  'Zrinjski Mostar': { 'ar': 'زرينيسكي موستار', 'zh-CN': '莫斯塔尔日林斯基', 'zh-TW': '莫斯塔爾日林斯基', 'ru': 'Зриньски Мостар', 'de': 'Zrinjski Mostar' , 'ja': 'ズリニスキ・モスタル' , 'ko': '즈린스키 모스타르' , 'th': 'ซรินสกี้ โมสตาร์' , 'pt': 'Zrinjski Mostar' },
  'Zulte Waregem': { 'ar': 'زولته فاريجيم', 'zh-CN': '威尔郡', 'zh-TW': '威爾郡', 'ru': 'Зюлте-Варегем', 'de': 'Zulte Waregem' , 'ja': 'ズルテ・ワレジェム' , 'ko': '줄테 와레젬' , 'th': 'ซูลเต วาเรเจม' , 'pt': 'Zulte Waregem' },
  'Zweigen Kanazawa': { 'es': 'Zweigen Kanazawa', 'zh-CN': '金泽塞维根', 'zh-TW': '金澤薩維根', 'ru': 'Цвайген Канадзава', 'de': 'Zweigen Kanazawa' , 'ja': 'ツエーゲン金沢' , 'ko': '츠바이겐 가나자와' , 'th': 'สไวเก้น คานาซาว่า' , 'pt': 'Zweigen Kanazawa' },
};

const COUNTRY_NAMES: Record<string, Record<string, string>> = {
  'Iraq': { 'zh-TW': '伊拉克', 'zh-CN': '伊拉克', 'es': 'Irak', 'ja': 'イラク', 'ko': '이라크', 'pt': 'Iraque',
 'ru': 'Ирак', 'fr': 'Irak', 'de': 'Irak', 'ar': 'العراق' },
  'England': { 'zh-TW': '英格蘭', 'zh-CN': '英格兰', 'es': 'Inglaterra', 'ja': 'イングランド', 'ko': '잉글랜드', 'pt': 'Inglaterra',
 'ru': 'Англия', 'fr': 'Angleterre', 'de': 'England', 'ar': 'إنجلترا' },
  'Japan': { 'zh-TW': '日本', 'zh-CN': '日本', 'es': 'Japón', 'ja': '日本', 'ko': '일본', 'pt': 'Japão',
 'ru': 'Япония', 'fr': 'Japon', 'de': 'Japan', 'ar': 'اليابان' },
  'Norway': { 'zh-TW': '挪威', 'zh-CN': '挪威', 'es': 'Noruega', 'ja': 'ノルウェー', 'ko': '노르웨이', 'pt': 'Noruega',
 'ru': 'Норвегия', 'fr': 'Norvège', 'de': 'Norwegen', 'ar': 'النرويج' },
  'Mexico': { 'zh-TW': '墨西哥', 'zh-CN': '墨西哥', 'es': 'México', 'ja': 'メキシコ', 'ko': '멕시코', 'pt': 'México',
 'ru': 'Мексика', 'fr': 'Mexique', 'de': 'Mexiko', 'ar': 'المكسيك' },
  'Argentina': { 'zh-TW': '阿根廷', 'zh-CN': '阿根廷', 'es': 'Argentina', 'ja': 'アルゼンチン', 'ko': '아르헨티나', 'pt': 'Argentina',
 'ru': 'Аргентина', 'fr': 'Argentine', 'de': 'Argentinien', 'ar': 'الأرجنتين' },
  'Saudi Arabia': { 'zh-TW': '沙特阿拉伯', 'zh-CN': '沙特阿拉伯', 'es': 'Arabia Saudita', 'ja': 'サウジアラビア', 'ko': '사우디아라비아', 'pt': 'Arábia Saudita',
 'ru': 'Саудовская Аравия', 'fr': 'Arabie Saoudite', 'de': 'Saudi-Arabien', 'ar': 'السعودية' },
  'Qatar': { 'zh-TW': '卡塔爾', 'zh-CN': '卡塔尔', 'es': 'Catar', 'ja': 'カタール', 'ko': '카타르', 'pt': 'Catar',
 'ru': 'Катар', 'fr': 'Qatar', 'de': 'Katar', 'ar': 'قطر' },
  'Russia': { 'zh-TW': '俄羅斯', 'zh-CN': '俄罗斯', 'es': 'Rusia', 'ja': 'ロシア', 'ko': '러시아', 'pt': 'Rússia',
 'ru': 'Россия', 'fr': 'Russie', 'de': 'Russland', 'ar': 'روسيا' },
  'Australia': { 'zh-TW': '澳洲', 'zh-CN': '澳大利亚', 'es': 'Australia', 'ja': 'オーストラリア', 'ko': '호주', 'pt': 'Austrália',
 'ru': 'Австралия', 'fr': 'Australie', 'de': 'Australien', 'ar': 'أستراليا' },
  'Serbia': { 'zh-TW': '塞爾維亞', 'zh-CN': '塞尔维亚', 'es': 'Serbia', 'ja': 'セルビア', 'ko': '세르비아', 'pt': 'Sérvia',
 'ru': 'Сербия', 'fr': 'Serbie', 'de': 'Serbien', 'ar': 'صربيا' },
  'Austria': { 'zh-TW': '奧地利', 'zh-CN': '奥地利', 'es': 'Austria', 'ja': 'オーストリア', 'ko': '오스트리아', 'pt': 'Áustria',
 'ru': 'Австрия', 'fr': 'Autriche', 'de': 'Österreich', 'ar': 'النمسا' },
  'Moldova': { 'zh-TW': '摩爾多瓦', 'zh-CN': '摩尔多瓦', 'es': 'Moldavia', 'ja': 'モルドバ', 'ko': '몰도바', 'pt': 'Moldávia',
 'ru': 'Молдова', 'fr': 'Moldavie', 'de': 'Moldau', 'ar': 'مولدوفا' },
  'Scotland': { 'zh-TW': '蘇格蘭', 'zh-CN': '苏格兰', 'es': 'Escocia', 'ja': 'スコットランド', 'ko': '스코틀랜드', 'pt': 'Escócia',
 'ru': 'Шотландия', 'fr': 'Écosse', 'de': 'Schottland', 'ar': 'اسكتلندا' },
  'Malta': { 'zh-TW': '馬耳他', 'zh-CN': '马耳他', 'es': 'Malta', 'ja': 'マルタ', 'ko': '몰타', 'pt': 'Malta',
 'ru': 'Мальта', 'fr': 'Malte', 'de': 'Malta', 'ar': 'مالطا' },
  'Denmark': { 'zh-TW': '丹麥', 'zh-CN': '丹麦', 'es': 'Dinamarca', 'ja': 'デンマーク', 'ko': '덴마크', 'pt': 'Dinamarca',
 'ru': 'Дания', 'fr': 'Danemark', 'de': 'Dänemark', 'ar': 'الدنمارك' },
  'Cyprus': { 'zh-TW': '塞浦路斯', 'zh-CN': '塞浦路斯', 'es': 'Chipre', 'ja': 'キプロス', 'ko': '키프로스', 'pt': 'Chipre',
 'ru': 'Кипр', 'fr': 'Chypre', 'de': 'Zypern', 'ar': 'قبرص' },
  'Belgium': { 'zh-TW': '比利時', 'zh-CN': '比利时', 'es': 'Bélgica', 'ja': 'ベルギー', 'ko': '벨기에', 'pt': 'Bélgica',
 'ru': 'Бельгия', 'fr': 'Belgique', 'de': 'Belgien', 'ar': 'بلجيكا' },
  'Slovakia': { 'zh-TW': '斯洛伐克', 'zh-CN': '斯洛伐克', 'es': 'Eslovaquia', 'ja': 'スロバキア', 'ko': '슬로바키아', 'pt': 'Eslováquia',
 'ru': 'Словакия', 'fr': 'Slovaquie', 'de': 'Slowakei', 'ar': 'سلوفاكيا' },
  'Romania': { 'zh-TW': '羅馬尼亞', 'zh-CN': '罗马尼亚', 'es': 'Rumania', 'ja': 'ルーマニア', 'ko': '루마니아', 'pt': 'Romênia',
 'ru': 'Румыния', 'fr': 'Roumanie', 'de': 'Rumänien', 'ar': 'رومانيا' },
  'Egypt': { 'zh-TW': '埃及', 'zh-CN': '埃及', 'es': 'Egipto', 'ja': 'エジプト', 'ko': '이집트', 'pt': 'Egito',
 'ru': 'Египет', 'fr': 'Égypte', 'de': 'Ägypten', 'ar': 'مصر' },
  'Slovenia': { 'zh-TW': '斯洛維尼亞', 'zh-CN': '斯洛文尼亚', 'es': 'Eslovenia', 'ja': 'スロベニア', 'ko': '슬로베니아', 'pt': 'Eslovênia',
 'ru': 'Словения', 'fr': 'Slovénie', 'de': 'Slowenien', 'ar': 'سلوفينيا' },
  'Peru': { 'zh-TW': '秘魯', 'zh-CN': '秘鲁', 'es': 'Perú', 'ja': 'ペルー', 'ko': '페루', 'pt': 'Peru',
 'ru': 'Перу', 'fr': 'Pérou', 'de': 'Peru', 'ar': 'بيرو' },
  'Israel': { 'zh-TW': '以色列', 'zh-CN': '以色列', 'es': 'Israel', 'ja': 'イスラエル', 'ko': '이스라엘', 'pt': 'Israel',
 'ru': 'Израиль', 'fr': 'Israël', 'de': 'Israel', 'ar': 'إسرائيل' },
  'South Africa': { 'zh-TW': '南非', 'zh-CN': '南非', 'es': 'Sudáfrica', 'ja': '南アフリカ', 'ko': '남아프리카', 'pt': 'África do Sul',
 'ru': 'Южная Африка', 'fr': 'Afrique du Sud', 'de': 'Südafrika', 'ar': 'جنوب أفريقيا' },
  'Libya': { 'zh-TW': '利比亞', 'zh-CN': '利比亚', 'es': 'Libia', 'ja': 'リビア', 'ko': '리비아', 'pt': 'Líbia',
 'ru': 'Ливия', 'fr': 'Libye', 'de': 'Libyen', 'ar': 'ليبيا' },
  'Germany': { 'zh-TW': '德國', 'zh-CN': '德国', 'es': 'Alemania', 'ja': 'ドイツ', 'ko': '독일', 'pt': 'Alemanha',
 'ru': 'Германия', 'fr': 'Allemagne', 'de': 'Deutschland', 'ar': 'ألمانيا' },
  'Canada': { 'zh-TW': '加拿大', 'zh-CN': '加拿大', 'es': 'Canadá', 'ja': 'カナダ', 'ko': '캐나다', 'pt': 'Canadá',
 'ru': 'Канада', 'fr': 'Canada', 'de': 'Kanada', 'ar': 'كندا' },
  'Bosnia and Herzegovina': { 'zh-TW': '波士尼亞與赫塞哥維納', 'zh-CN': '波斯尼亚和黑塞哥维那', 'es': 'Bosnia y Herzegovina', 'ja': 'ボスニア・ヘルツェゴビナ', 'ko': '보스니아 헤르체고비나', 'pt': 'Bósnia e Herzegovina',
 'ru': 'Босния и Герцеговина', 'fr': 'Bosnie-Herzégovine', 'de': 'Bosnien und Herzegowina', 'ar': 'البوسنة والهرسك' },
  'Armenia': { 'zh-TW': '亞美尼亞', 'zh-CN': '亚美尼亚', 'es': 'Armenia', 'ja': 'アルメニア', 'ko': '아르메니아', 'pt': 'Armênia',
 'ru': 'Армения', 'fr': 'Arménie', 'de': 'Armenien', 'ar': 'أرمينيا' },
  'Tanzania': { 'zh-TW': '坦尚尼亞', 'zh-CN': '坦桑尼亚', 'es': 'Tanzania', 'ja': 'タンザニア', 'ko': '탄자니아', 'pt': 'Tanzânia',
 'ru': 'Танзания', 'fr': 'Tanzanie', 'de': 'Tansania', 'ar': 'تنزانيا' },
  'Ireland': { 'zh-TW': '愛爾蘭', 'zh-CN': '爱尔兰', 'es': 'Irlanda', 'ja': 'アイルランド', 'ko': '아일랜드', 'pt': 'Irlanda',
 'ru': 'Ирландия', 'fr': 'Irlande', 'de': 'Irland', 'ar': 'أيرلندا' },
  'Northern Ireland': { 'zh-TW': '北愛爾蘭', 'zh-CN': '北爱尔兰', 'es': 'Irlanda del Norte', 'ja': '北アイルランド', 'ko': '북아일랜드', 'pt': 'Irlanda do Norte',
 'ru': 'Северная Ирландия', 'fr': 'Irlande du Nord', 'de': 'Nordirland', 'ar': 'أيرلندا الشمالية' },
  'Ghana': { 'zh-TW': '加納', 'zh-CN': '加纳', 'es': 'Ghana', 'ja': 'ガーナ', 'ko': '가나', 'pt': 'Gana',
 'ru': 'Гана', 'fr': 'Ghana', 'de': 'Ghana', 'ar': 'غانا' },
  'Kazakhstan': { 'zh-TW': '哈薩克', 'zh-CN': '哈萨克斯坦', 'es': 'Kazajistán', 'ja': 'カザフスタン', 'ko': '카자흐스탄', 'pt': 'Cazaquistão',
 'ru': 'Казахстан', 'fr': 'Kazakhstan', 'de': 'Kasachstan', 'ar': 'كازاخستان' },
  'India': { 'zh-TW': '印度', 'zh-CN': '印度', 'es': 'India', 'ja': 'インド', 'ko': '인도', 'pt': 'Índia',
 'ru': 'Индия', 'fr': 'Inde', 'de': 'Indien', 'ar': 'الهند' },
  'Kenya': { 'zh-TW': '肯亞', 'zh-CN': '肯尼亚', 'es': 'Kenia', 'ja': 'ケニア', 'ko': '케냐', 'pt': 'Quênia',
 'ru': 'Кения', 'fr': 'Kenya', 'de': 'Kenia', 'ar': 'كينيا' },
  'Hong Kong': { 'zh-TW': '香港', 'zh-CN': '香港', 'es': 'Hong Kong', 'ja': '香港', 'ko': '홍콩', 'pt': 'Hong Kong',
 'ru': 'Гонконг', 'fr': 'Hong Kong', 'de': 'Hongkong', 'ar': 'هونغ كونغ' },
  'South Korea': { 'zh-TW': '南韓', 'zh-CN': '韩国', 'es': 'Corea del Sur', 'ja': '韓国', 'ko': '대한민국', 'pt': 'Coreia do Sul',
 'ru': 'Южная Корея', 'fr': 'Corée du Sud', 'de': 'Südkorea', 'ar': 'كوريا الجنوبية' },
  'Republic of Korea': { 'zh-TW': '南韓', 'zh-CN': '韩国', 'es': 'Corea del Sur', 'ja': '韓国', 'ko': '대한민국', 'pt': 'Coreia do Sul',
 'ru': 'Южная Корея', 'fr': 'Corée du Sud', 'de': 'Südkorea', 'ar': 'كوريا الجنوبية' },
  'Jamaica': { 'zh-TW': '牙買加', 'zh-CN': '牙买加', 'es': 'Jamaica', 'ja': 'ジャマイカ', 'ko': '자메이카', 'pt': 'Jamaica',
 'ru': 'Ямайка', 'fr': 'Jamaïque', 'de': 'Jamaika', 'ar': 'جامايكا' },
  'Ukraine': { 'zh-TW': '烏克蘭', 'zh-CN': '乌克兰', 'es': 'Ucrania', 'ja': 'ウクライナ', 'ko': '우크라이나', 'pt': 'Ucrânia',
 'ru': 'Украина', 'fr': 'Ukraine', 'de': 'Ukraine', 'ar': 'أوكرانيا' },
  'Singapore': { 'zh-TW': '新加坡', 'zh-CN': '新加坡', 'es': 'Singapur', 'ja': 'シンガポール', 'ko': '싱가포르', 'pt': 'Singapura',
 'ru': 'Сингапур', 'fr': 'Singapour', 'de': 'Singapur', 'ar': 'سنغافورة' },
  'Azerbaijan': { 'zh-TW': '亞塞拜然', 'zh-CN': '阿塞拜疆', 'es': 'Azerbaiyán', 'ja': 'アゼルバイジャン', 'ko': '아제르바이잔', 'pt': 'Azerbaijão',
 'ru': 'Азербайджан', 'fr': 'Azerbaïdjan', 'de': 'Aserbaidschan', 'ar': 'أذربيجان' },
  'Bahrain': { 'zh-TW': '巴林', 'zh-CN': '巴林', 'es': 'Baréin', 'ja': 'バーレーン', 'ko': '바레인', 'pt': 'Bahrein',
 'ru': 'Бахрейн', 'fr': 'Bahreïn', 'de': 'Bahrain', 'ar': 'البحرين' },
};

// We use LiveScore API to ensure we get actual real-world data without mock matches
// Global cache for LiveScore API responses
let liveScoreCache: {
  timestamp: number;
  liveData: any;
  dateDataList: any[];
} | null = null;
const CACHE_TTL = 30000; // 30 seconds

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawLang =
      searchParams.get('lang') ||
      request.headers.get('x-app-language') ||
      request.headers.get('accept-language') ||
      'en';
    const lang = normalizeLang(rawLang);

    // Include yesterday to ensure finished matches can be settled even if the user opens the app after the match ends.
    const today = new Date();
    const dateStrs = Array.from({ length: 3 }).map((_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() + (i - 1));
        return d.toISOString().slice(0, 10).replace(/-/g, '');
    });

    let liveData, dateDataList;
    const now = Date.now();

    if (liveScoreCache && now - liveScoreCache.timestamp < CACHE_TTL) {
        liveData = liveScoreCache.liveData;
        dateDataList = liveScoreCache.dateDataList;
    } else {
        const fetchWithTimeout = async (url: string, ms = 15000) => {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), ms);
          try {
            const response = await fetch(url, { 
                cache: 'no-store', 
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                }
            });
            clearTimeout(id);
            return response;
          } catch (err) {
            clearTimeout(id);
            throw err;
          }
        };

        // Fetch live matches and the next 7 days of scheduled matches
        const fetchPromises = [
          fetchWithTimeout(`https://prod-public-api.livescore.com/v1/api/app/live/soccer/0`),
          ...dateStrs.map(ds => fetchWithTimeout(`https://prod-public-api.livescore.com/v1/api/app/date/soccer/${ds}/0`))
        ];

        const responses = await Promise.all(fetchPromises);

        if (!responses[0].ok && !responses[1].ok) {
          throw new Error(`LiveScore API error`);
        }

        liveData = responses[0].ok ? await responses[0].json() : { Stages: [] };
        dateDataList = await Promise.all(responses.slice(1).map(async r => r.ok ? await r.json() : { Stages: [] }));
        
        liveScoreCache = {
            timestamp: now,
            liveData,
            dateDataList
        };
    }
    
    // Merge Stages, ensuring live matches are included and avoiding duplicates
    const stagesMap = new Map<string, any>();
    
    const processStages = (data: any) => {
        if (!data || !data.Stages) return;
        for (const stage of data.Stages) {
            const key = `${stage.Cnm}-${stage.Snm}`;
            if (!stagesMap.has(key)) {
                stagesMap.set(key, { ...stage, Events: [] });
            }
            const existingStage = stagesMap.get(key);
            for (const event of stage.Events) {
                if (!existingStage.Events.find((e: any) => e.Eid === event.Eid)) {
                    existingStage.Events.push(event);
                }
            }
        }
    };

    processStages(liveData);
    dateDataList.forEach(data => processStages(data));

    const mergedStages = Array.from(stagesMap.values());
    const allMatches: any[] = [];

    const EURO_DIRECT = new Set(['es', 'fr', 'de', 'pt']);

    const getTeamName = async (name: string, id?: string) => {
      if (!name || name === id) return lang === 'zh-CN' ? `未知队伍 #${id || '?'}` : `未知隊伍 #${id || '?'}`;

      if (TEAM_NAMES[name] && TEAM_NAMES[name][lang]) {
        let mapped = (lang === 'zh-TW' || lang === 'zh-CN') ? sanitizeZh(TEAM_NAMES[name][lang], lang) : TEAM_NAMES[name][lang];
        if (lang === 'zh-CN') {
          mapped = traditionalToSimplified(mapped);
        }
        return mapped || name;
      }

      const normalizedName = name.toLowerCase();
      for (const [key, translations] of Object.entries(TEAM_NAMES)) {
        const normalizedKey = key.toLowerCase();
        if (normalizedName.includes(normalizedKey)) {
          if ((translations as any)[lang]) {
            let mapped = (lang === 'zh-TW' || lang === 'zh-CN') ? sanitizeZh((translations as any)[lang], lang) : (translations as any)[lang];
            if (lang === 'zh-CN') {
              mapped = traditionalToSimplified(mapped);
            }
            return mapped || name;
          }
        }
      }

      if (isSupportedTranslationLang(lang) && containsLatin(name)) {
        try {
          const { translated } = await translateTeamName(name, lang);
          if (lang === 'zh-TW' || lang === 'zh-CN') {
            let sanitized = sanitizeZh(translated, lang);
            if (lang === 'zh-CN') {
              sanitized = traditionalToSimplified(sanitized);
            }
            if (sanitized && !containsLatin(sanitized)) {
              return sanitized;
            }
          } else if (translated && translated !== name) {
            return translated;
          }
        } catch (_) {}
      }

      return name;
    };

    const getLocalizedCountryName = async (country: string) => {
      const cleaned = (country || '').trim();
      if (!cleaned) return cleaned;

      if (COUNTRY_NAMES[cleaned] && COUNTRY_NAMES[cleaned][lang]) {
        return COUNTRY_NAMES[cleaned][lang];
      }

      // Check lowercase fallback
      const normalizedCountry = cleaned.toLowerCase();
      for (const [key, translations] of Object.entries(COUNTRY_NAMES)) {
        if (key.toLowerCase() === normalizedCountry) {
          if ((translations as any)[lang]) {
            return (translations as any)[lang];
          }
        }
      }
      return cleaned;
    };

    const getLeagueInfo = async (country: string, name: string) => {
      let cleanedCountry = (country || '').trim();
      let cleanedName = (name || '').trim();

      if ((!cleanedName || cleanedName === 'Unknown') && cleanedCountry.includes(' - ')) {
        const parts = cleanedCountry.split(' - ').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          cleanedCountry = parts[0]!;
          cleanedName = parts.slice(1).join(' - ');
        }
      } else if (cleanedName.includes(' - ') && !COUNTRY_NAMES[cleanedCountry]) {
        const parts = cleanedName.split(' - ').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2 && COUNTRY_NAMES[parts[0]!]) {
          cleanedCountry = parts[0]!;
          cleanedName = parts.slice(1).join(' - ');
        }
      }

      const combined = `${cleanedCountry} - ${cleanedName}`;
      const baseName = cleanedName.split(':')[0]!.trim();
      const sn = baseName.toLowerCase();
      const isWCQualifier =
        /\bworld\s*cup\b/.test(sn) && (/\bqualif/.test(sn) || /\bqualifiers?\b/.test(sn)) ||
        /\bwc\b/.test(sn) && (/\bqualif/.test(sn) || /\bqualifiers?\b/.test(sn)) ||
        /\broad to 26\b/.test(sn) || /\broad to 2026\b/.test(sn) ||
        /\bworld\s*cup\s*play-?offs?\b/.test(sn) ||
        /\bintercontinental play-?off\b/.test(sn) ||
        /\buefa\b.*qualif/.test(sn) || /\bafc\b.*qualif/.test(sn) || /\bcaf\b.*qualif/.test(sn) ||
        /\bconcacaf\b.*qualif/.test(sn) || /\bconmebol\b.*qualif/.test(sn) || /\bofc\b.*qualif/.test(sn);

      const leagueMatch = LEAGUES.find((l) => {
        const ln = l.name;
        const sn = baseName;
        let nameMatches = looselyMatches(ln, sn);
        
        // 檢查別名 (aliases)
        if (!nameMatches && (l as any).aliases) {
            nameMatches = (l as any).aliases.some((alias: string) => {
                return looselyMatches(alias, sn);
            });
        }
        
        // Strict country matching for generic league names like "Premier League" or "Super League"
        if (nameMatches && l.country) {
            const lcCountry = cleanedCountry.toLowerCase();
            if (l.country === 'Int.') {
                return lcCountry === 'intl' || lcCountry === 'international' || lcCountry === 'world' || lcCountry === 'europe' || lcCountry === 'asia' || lcCountry === 'south america' || lcCountry === 'north & central america';
            }
            return lcCountry === l.country.toLowerCase();
        }
        
        return nameMatches;
      });

      let category = 'others';
      let mappedName = combined;
      let forceLeagueLabel: string | null = null;

      if (leagueMatch) {
        category = leagueMatch.category;
        if (isWCQualifier) category = 'worldcup';
        if (leagueMatch.names && (leagueMatch.names as any)[lang]) {
          let mapped = (lang === 'zh-TW' || lang === 'zh-CN') ? sanitizeZh((leagueMatch.names as any)[lang], lang) : (leagueMatch.names as any)[lang];
          if (lang === 'zh-CN') {
            mapped = traditionalToSimplified(mapped);
          }
          // For non-Chinese languages, always trust the translation map without containsLatin checks
          if (lang !== 'zh-TW' && lang !== 'zh-CN') {
            mappedName = mapped;
            const suffix = cleanedName.includes(':') ? cleanedName.split(':').slice(1).join(':').trim() : '';
            if (suffix) mappedName = `${mappedName}: ${suffix}`;
            return { name: mappedName, category };
          }
          if (!((lang === 'zh-TW' || lang === 'zh-CN') && containsLatin(mapped))) {
            mappedName = mapped;
            const suffix = cleanedName.includes('：') ? cleanedName.split('：').slice(1).join('：').trim() : cleanedName.includes(':') ? cleanedName.split(':').slice(1).join(':').trim() : '';
            if (suffix) {
              let localizedSuffix = localizeLeagueNameFallback(suffix, lang);
              if (lang === 'zh-CN') {
                localizedSuffix = traditionalToSimplified(localizedSuffix);
              }
              mappedName = `${mappedName}：${localizedSuffix}`;
            }
            return { name: mappedName, category };
          }
        }
      }

      // 如果偵測到是世界盃外圍賽，強制歸類到 worldcup，並給出一致的聯賽名稱
      if (isWCQualifier) {
        category = 'worldcup';
        if (lang === 'zh-TW') forceLeagueLabel = '世界盃外圍賽';
        else if (lang === 'zh-CN') forceLeagueLabel = '世界杯预选赛';
        else forceLeagueLabel = 'World Cup Qualifiers';
      }

      if (lang === 'zh-TW' || lang === 'zh-CN') {
        const translatedCountry = await getLocalizedCountryName(cleanedCountry);
        let safeCountry = translatedCountry?.trim() || cleanedCountry;
        let safeLeague = forceLeagueLabel || localizeLeagueNameFallback(cleanedName, lang);
        if (lang === 'zh-CN') {
          safeCountry = traditionalToSimplified(safeCountry);
          safeLeague = traditionalToSimplified(safeLeague);
        }

        if (safeLeague && safeCountry) {
          const normalizedCountry = safeCountry.toLowerCase();
          const normalizedLeague = safeLeague.toLowerCase();

          mappedName = normalizedLeague.startsWith(normalizedCountry)
            ? safeLeague
            : `${safeCountry} - ${safeLeague}`;
        } else if (safeLeague) {
          mappedName = safeLeague;
        } else if (safeCountry) {
          mappedName = safeCountry;
        }
      } else if (lang !== 'en') {
        const translatedCountry = await getLocalizedCountryName(cleanedCountry);
        const safeCountry = translatedCountry?.trim() || cleanedCountry;
        const safeLeague = forceLeagueLabel || localizeLeagueNameFallback(cleanedName, lang);

        if (safeLeague && safeCountry) {
          const normalizedCountry = safeCountry.toLowerCase();
          const normalizedLeague = safeLeague.toLowerCase();

          // Many languages don't use "Country - League" format naturally, but since we are falling back to API, we'll keep the structure
          mappedName = normalizedLeague.startsWith(normalizedCountry)
            ? safeLeague
            : `${safeCountry} - ${safeLeague}`;
        } else if (safeLeague) {
          mappedName = safeLeague;
        } else if (safeCountry) {
          mappedName = safeCountry;
        }
      }

      return { name: mappedName || combined, category };
    };

    // Execute translation in parallel to avoid huge waterfall delays
    const matchPromises: Promise<any>[] = [];

    // Map LiveScore stages to our preferred format
    if (mergedStages.length > 0) {
      for (const stage of mergedStages) {
        // Filter out very obscure leagues if needed, or just take top ones
        const country = stage.Cnm || 'Unknown';
        const leagueName = stage.Snm || 'Unknown';
        
        for (const event of stage.Events) {
          matchPromises.push((async () => {
            const { name: translatedLeague, category } = await getLeagueInfo(country, leagueName);
            
            // Eps: "NS" (Not Started), "1" (1st Half), "HT" (Half Time), "2" (2nd Half), "FT" (Full Time), "AP" (After Penalties)
            let status = 'upcoming';
            let isLive = false;
            
            // Epr: 0 = NS, 1 = Live, 2 = Finished, 3 = Cancelled, 4 = Postponed
            if (event.Epr === 1) {
              status = 'live';
              isLive = true;
            } else if (event.Epr === 2 || ['FT', 'AET', 'AP', 'CANC', 'POST', 'Canc.', 'Postp.'].includes(event.Eps)) {
              status = 'finished';
            }

            // 根據「動態平衡資金機制」設計的初始開盤邏輯
            const seed = parseInt(event.Eid) || Math.floor(Math.random() * 10000);
            
            // 1. 估算三種賽果的真實概率 (p_A, p_B, p_C)
            // 這裡我們用 seed 生成確定性的機率分佈，模擬分析師/標準差法的結果
            let pHome = 0.40 + (seed % 20) / 100; // 0.40 - 0.59
            let pAway = 0.30 + ((seed * 2) % 15) / 100; // 0.30 - 0.44
            let pDraw = 1 - pHome - pAway; // 剩餘為和局

            // 防止極端小機率
            if (pDraw < 0.1) {
                pDraw = 0.2;
                pHome = 0.5;
                pAway = 0.3;
            }

            // 2. 設定固定利潤率 r = 8% (1.08)
            const profitMarginMultiplier = 1.08;

            // 3. 計算初始賠率 O_initial = 1 / (p_i * 1.08)
            const initialOddsHome = parseFloat((1 / (pHome * profitMarginMultiplier)).toFixed(2));
            const initialOddsDraw = parseFloat((1 / (pDraw * profitMarginMultiplier)).toFixed(2));
            const initialOddsAway = parseFloat((1 / (pAway * profitMarginMultiplier)).toFixed(2));

            // 4. 虛擬種子資金池 — 按機率比例分配，確保混權模型初始狀態正確
            const seedTotalPool = 20;

            const seedPools = {
                home: seedTotalPool * pHome,
                draw: seedTotalPool * pDraw,
                away: seedTotalPool * pAway
            };

            const seedLiabilities = {
                home: seedPools.home * initialOddsHome,
                draw: seedPools.draw * initialOddsDraw,
                away: seedPools.away * initialOddsAway
            };

            const stdDevHome = (seed % 200) / 100; // 保留供參考
            const stdDevDraw = ((seed * 2) % 150) / 100;
            const stdDevAway = ((seed * 3) % 200) / 100;

            // Parse start time
            const startStr = event.Esd.toString(); // e.g. 20260322163000
            let formattedDate = startStr;
            let timestamp = 0;
            if (startStr.length === 14) {
              const y = startStr.substring(0,4);
              const m = startStr.substring(4,6);
              const d = startStr.substring(6,8);
              const h = startStr.substring(8,10);
              const min = startStr.substring(10,12);
              formattedDate = `${y}-${m}-${d}T${h}:${min}:00Z`;
              timestamp = new Date(formattedDate).getTime();
            }

            let liveTime = '';
            let liveMinute = 0;
            if (isLive) {
                if (event.Eps === 'HT') {
                    liveTime = lang === 'zh-TW' || lang === 'zh-CN' ? '半場' : 'HT';
                } else if (event.EpsL) {
                    liveTime = `${event.EpsL}'`;
                    liveMinute = parseInt(event.EpsL) || 0;
                } else {
                    liveTime = event.Eps;
                    liveMinute = parseInt(event.Eps) || 0;
                }
                
                // Translate "Live" prefix based on language
                let livePrefix = 'Live';
                if (lang === 'zh-TW') livePrefix = '進行中';
                else if (lang === 'zh-CN') livePrefix = '进行中';
                else if (lang === 'es') livePrefix = 'En vivo';
                else if (lang === 'ja') livePrefix = 'ライブ';
                else if (lang === 'ko') livePrefix = '라이브';
                else if (lang === 'pt') livePrefix = 'Ao vivo';
                else if (lang === 'ru') livePrefix = 'В прямом эфире';
                else if (lang === 'fr') livePrefix = 'En direct';
                else if (lang === 'de') livePrefix = 'Live';

                formattedDate = `${livePrefix} ${liveTime}`;
            }

            const [homeTranslated, awayTranslated] = await Promise.all([
                getTeamName(event.T1[0]?.Nm || event.T1[0]?.ID || '', lang),
                getTeamName(event.T2[0]?.Nm || event.T2[0]?.ID || '', lang)
            ]);

            const matchObj = {
              id: event.Eid,
              league: translatedLeague,
              category: category,
              home: homeTranslated,
              away: awayTranslated,
              homeOriginal: event.T1[0]?.Nm || event.T1[0]?.ID || '',
              awayOriginal: event.T2[0]?.Nm || event.T2[0]?.ID || '',
              leagueOriginal: leagueName,
              homeLogo: event.T1[0]?.Img ? `/api/image-proxy?url=${encodeURIComponent(`https://lsm-static-prod.livescore.com/medium/${event.T1[0].Img}`)}` : '',
              awayLogo: event.T2[0]?.Img ? `/api/image-proxy?url=${encodeURIComponent(`https://lsm-static-prod.livescore.com/medium/${event.T2[0].Img}`)}` : '',
              date: formattedDate,
              timestamp: timestamp,
              liveMinute: liveMinute,
              // 相容舊前端結構，將新模型需要的變數包裝進去
              pools: { 
                  home: 0, // 舊版用的資金池不再適用，先設為0
                  draw: 0, 
                  away: 0 
              },
              marketData: {
                  realTotalPool: 0,
                  liabilities: { home: 0, draw: 0, away: 0 },
                  pools: { home: 0, draw: 0, away: 0 },
                  seedPools: { ...seedPools },
                  initialOdds: { home: initialOddsHome, draw: initialOddsDraw, away: initialOddsAway },
                  initialProbs: { home: pHome, draw: pDraw, away: pAway }
              },
              stdDevData: {
                  home: stdDevHome.toFixed(2),
                  draw: stdDevDraw.toFixed(2),
                  away: stdDevAway.toFixed(2)
              },
              status: status,
              score: (isLive || status === 'finished') ? `${event.Tr1 || 0}-${event.Tr2 || 0}` : null
            };
            
            return { matchObj, country, isLive };
          })());
        }
      }
    }

    const resolvedMatches = await Promise.all(matchPromises);
    
    // Load market db to merge real pools and liabilities
    const marketDb = loadMarketDb();

    // --- 軟刪除與冷門賽事過濾機制 ---
    let totalDeleted = 0;
    const deletedLogs: string[] = [];
    const validMatches: any[] = [];
    
    // Load bets database to process refunds if necessary
    const fs = require('fs');
    const path = require('path');
    const betsDbPath = path.join(process.cwd(), 'data', 'bets_db.json');
    let betsDb: Record<string, any[]> | null = null;
    let betsDbModified = false;
    let marketDbModified = false;

    const getBetsDb = () => {
        if (!betsDb) {
            try {
                if (fs.existsSync(betsDbPath)) {
                    betsDb = JSON.parse(fs.readFileSync(betsDbPath, 'utf-8'));
                } else {
                    betsDb = {};
                }
            } catch (e) {
                betsDb = {};
            }
        }
        return betsDb;
    };

    // 定義冷門賽事的標準
    const isObscureMatch = (match: any, isLive: boolean) => {
        // 條件 1: 未知隊伍或球隊名稱異常 (如全為數字)
        if (!match.home || !match.away || 
            match.home === 'Unknown Home' || match.away === 'Unknown Away' ||
            match.home.startsWith('未知隊伍') || match.away.startsWith('未知隊伍') ||
            /^\d+$/.test(match.home) || /^\d+$/.test(match.away)) {
            return { isObscure: true, reason: '無法識別球隊' };
        }
        
        // 條件 2: 嚴格白名單過濾 (確保只顯示指定的聯賽)
        // 世界盃與其外圍賽一律允許
        const isWhiteListed = match.category === 'worldcup' || LEAGUES.some(l => {
            const translatedName = (l.names as any)[lang];
            return match.league.includes(l.name) || (translatedName && match.league.includes(translatedName));
        });

        if (!isWhiteListed) {
             return { isObscure: true, reason: '非指定聯賽' };
        }
        
        // 條件 3: 已完賽的比賽直接刪除 (過濾掉 FT, AET, AP 等結束狀態)
        if (match.status === 'finished') {
             return { isObscure: true, reason: '比賽已結束' };
        }
        
        return { isObscure: false, reason: '' };
    };

    // 由於我們目前是動態抓取 API，沒有資料庫實體刪除的問題。
    // 「軟刪除」在這邊的實作方式為：在回傳給前端的名單中將其剔除 (或標記)，
    // 這樣既不會影響用戶歷史訂單 (歷史訂單只存 ID 和名稱在本地/合約)，也能確保畫面乾淨。
    for (const { matchObj, country, isLive } of resolvedMatches) {
        if (marketDb[matchObj.id]) {
            matchObj.marketData.realTotalPool += marketDb[matchObj.id].realTotalPool;
            matchObj.marketData.liabilities.home += marketDb[matchObj.id].liabilities.home;
            matchObj.marketData.liabilities.draw += marketDb[matchObj.id].liabilities.draw;
            matchObj.marketData.liabilities.away += marketDb[matchObj.id].liabilities.away;
            if (marketDb[matchObj.id].pools) {
                matchObj.marketData.pools.home += marketDb[matchObj.id].pools!.home;
                matchObj.marketData.pools.draw += marketDb[matchObj.id].pools!.draw;
                matchObj.marketData.pools.away += marketDb[matchObj.id].pools!.away;
            }
            
            const mkt = marketDb[matchObj.id];
            const mktPools = mkt.pools || { home: 0, draw: 0, away: 0 };
            
            if (matchObj.status === "finished" && matchObj.score && !mkt.settled) {
                const parts = matchObj.score.split("-").map((p: string) => p.trim());
                const homeGoals = parseInt(parts[0] || "", 10);
                const awayGoals = parseInt(parts[1] || "", 10);
                
                if (!isNaN(homeGoals) && !isNaN(awayGoals)) {
                    const winner = homeGoals > awayGoals ? "home" : homeGoals < awayGoals ? "away" : "draw";
                    mkt.settled = true;
                    mkt.refundProcessed = true;
                    mkt.finalWinner = winner;
                    mkt.finalScore = matchObj.score;

                    const outcomesWithBetsCheck = [mktPools.home > 0, mktPools.draw > 0, mktPools.away > 0].filter(Boolean).length;

                    if (outcomesWithBetsCheck <= 1) {
                        mkt.adminSurplus = 0;
                    } else {
                        const totalPool = mktPools.home + mktPools.draw + mktPools.away;
                        const effectivePool = totalPool * (1 - PLATFORM_FEE_RATE);
                        const payoutOwed = mkt.liabilities[winner] || 0;
                        const surplus = Math.max(0, effectivePool - payoutOwed);
                        mkt.adminSurplus = parseFloat(surplus.toFixed(6));
                        if (surplus > 0.001 && process.env.DEBUG_MATCH_SETTLEMENT === '1') {
                            console.log(`[Settle] Admin surplus: $${surplus.toFixed(4)} for match ${matchObj.id} (winner=${winner})`);
                        }
                    }

                    marketDbModified = true;
                    
                    const db = getBetsDb();
                    if (db) {
                        for (const address of Object.keys(db)) {
                            for (const bet of db[address]) {
                                if (bet.matchId === matchObj.id && bet.status === "pending") {
                                    bet.status = bet.outcome === winner ? "win" : "loss";
                                    betsDbModified = true;
                                    if (process.env.DEBUG_MATCH_SETTLEMENT === '1') {
                                        console.log(`[Settle] ${bet.outcome === winner ? "WIN" : "LOSS"}: bet ${bet.id} (${bet.outcome}) on ${matchObj.id} score ${matchObj.score}`);
                                    }
                                }
                            }
                        }
                    }
                }
            } else if (!mkt.refundProcessed && (matchObj.liveMinute >= 80 || matchObj.status === "finished")) {
                const l = matchObj.marketData?.liabilities || mkt.liabilities;
                const outcomesWithBets = [l.home > 0, l.draw > 0, l.away > 0].filter(Boolean).length;
                
                if (outcomesWithBets === 1) {
                    mkt.refundProcessed = true;
                    mkt.adminSurplus = 0;
                    marketDbModified = true;
                    const db = getBetsDb();
                    if (db) {
                        for (const address of Object.keys(db)) {
                            for (const bet of db[address]) {
                                if (bet.matchId === matchObj.id && bet.status === "pending") {
                                    bet.status = "refunded";
                                    betsDbModified = true;
                                    if (process.env.DEBUG_MATCH_SETTLEMENT === '1') {
                                        console.log(`[Refund] Refunded bet ${bet.id} for match ${matchObj.id}`);
                                    }
                                }
                            }
                        }
                    }
                } else if (outcomesWithBets > 1) {
                    mkt.refundProcessed = true;
                    marketDbModified = true;
                }
            }
        }
        
        const { isObscure, reason } = isObscureMatch(matchObj, isLive);
        
        if (isObscure) {
            totalDeleted++;
            deletedLogs.push(`[軟刪除] 賽事ID: ${matchObj.id} | 賽事: ${matchObj.home} vs ${matchObj.away} | 聯賽: ${matchObj.league} | 狀態: ${matchObj.status} | 刪除原因: ${reason}`);
            matchObj.isDeleted = true;
            continue;
        }
        
        validMatches.push(matchObj);
    }

    // 輸出批次處理日誌報告
    if (process.env.DEBUG_MATCH_CLEANUP === '1' && totalDeleted > 0) {
        console.log('\n======================================================');
        console.log('⚽ [自動化清理報告] 冷門球賽軟刪除作業');
        console.log('======================================================');
        console.log(`總計抓取賽事: ${resolvedMatches.length} 場`);
        console.log(`已軟刪除數量: ${totalDeleted} 場`);
        console.log(`保留有效賽事: ${validMatches.length} 場`);
        console.log('------------------------------------------------------');
        deletedLogs.slice(0, 20).forEach(log => console.log(log));
        if (deletedLogs.length > 20) {
             console.log(`... 及其他 ${deletedLogs.length - 20} 筆紀錄`);
        }
        console.log('======================================================\n');
    }

    if (betsDbModified && betsDb) {
        fs.writeFileSync(betsDbPath, JSON.stringify(betsDb, null, 2), 'utf-8');
    }
    if (marketDbModified) {
        saveMarketDb(marketDb);
    }

    if (betsDbModified) {
        try {
            const settleUrl = process.env.NEXT_PUBLIC_SITE_URL
                ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/cron/settle`
                : "http://localhost:3000/api/cron/settle";
            fetch(settleUrl, { method: "GET" })
                .then(r => r.json())
                .then(d => {
                    if (d.success && (d.paid > 0 || d.commissionPaid > 0)) {
                        console.log(`[AutoPayout] Triggered: ${d.paid} wins paid, ${d.commissionPaid} commissions paid`);
                    }
                })
                .catch(e => console.warn("[AutoPayout] Trigger failed:", e.message));
        } catch {}
    }

    return NextResponse.json(applyWorldCupSeedFallback(validMatches, lang));

  } catch (error) {
    console.error('Error fetching livescore data:', error);
    return NextResponse.json([]);
  }
}
