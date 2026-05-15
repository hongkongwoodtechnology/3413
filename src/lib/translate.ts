const fs = require('fs');
const path = require('path');

const TRANSLATIONS_CACHE_PATH = path.join(process.cwd(), 'data', 'team_translations.json');

let translationsCache: Record<string, string> | null = null;

function loadTranslationsCache(): Record<string, string> {
  if (translationsCache) return translationsCache;
  try {
    if (fs.existsSync(TRANSLATIONS_CACHE_PATH)) {
      translationsCache = JSON.parse(fs.readFileSync(TRANSLATIONS_CACHE_PATH, 'utf-8'));
    } else {
      translationsCache = {};
    }
  } catch {
    translationsCache = {};
  }
  return translationsCache || {};
}

function saveTranslationsCache(cache: Record<string, string>) {
  try {
    fs.writeFileSync(TRANSLATIONS_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Translate] Failed to save translations cache:', e);
  }
}

function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}

interface TranslateResult {
  translated: string;
  fromCache: boolean;
}

const pendingTranslations = new Map<string, Promise<string>>();

const TRADITIONAL_TO_SIMPLIFIED: Record<string, string> = {
  '後': '后', '麼': '么', '們': '们', '麼': '么', '這': '这', '裡': '里', '為': '为', '麼': '么', '麼': '么',
  '說': '说', '沒': '没', '對': '对', '個': '个', '時': '时', '讓': '让', '過': '过', '開': '开', '來': '来',
  '種': '种', '還': '还', '樣': '样', '點': '点', '麼': '么', '麼': '么', '麼': '么', '麼': '么',
  '學': '学', '會': '会', '能': '能', '要': '要', '想': '想', '看': '看', '發': '发', '得': '得',
  '到': '到', '出': '出', '可': '可', '好': '好', '以': '以', '不': '不', '大': '大', '小': '小',
  '多': '多', '少': '少', '上': '上', '下': '下', '中': '中', '前': '前', '後': '后', '左': '左',
  '右': '右', '裡': '里', '外': '外', '高': '高', '低': '低', '長': '长', '短': '短', '寬': '宽',
  '遠': '远', '近': '近', '早': '早', '晚': '晚', '新': '新', '舊': '旧', '生': '生', '死': '死',
  '活': '活', '動': '动', '靜': '静', '快': '快', '慢': '慢', '真': '真', '假': '假',
  '實': '实', '虛': '虚', '強': '强', '弱': '弱', '重': '重', '輕': '轻', '軟': '软', '硬': '硬',
  '深': '深', '淺': '浅', '濃': '浓', '淡': '淡', '熱': '热', '冷': '冷', '溫': '温', '涼': '凉',
  '乾': '干', '濕': '湿', '鬆': '松', '緊': '紧', '軟': '软', '硬': '硬', '滑': '滑', '澀': '涩',
  '亮': '亮', '暗': '暗', '明': '明', '闇': '暗', '顯': '显', '隱': '隐', '現': '现', '失': '失',
  '得': '得', '獲': '获', '給': '给', '拿': '拿', '放': '放', '置': '置', '送': '送', '接': '接',
  '打': '打', '關': '关', '開': '开', '閉': '闭', '拉': '拉', '推': '推', '提': '提', '拎': '拎',
  '扛': '扛', '背': '背', '抱': '抱', '牽': '牵', '抓': '抓', '握': '握', '撫': '抚', '摸': '摸',
  '拍': '拍', '打': '打', '敲': '敲', '擊': '击', '撞': '撞', '碰': '碰', '摸': '摸', '搖': '摇',
  '擺': '摆', '轉': '转', '動': '动', '走': '走', '跑': '跑', '跳': '跳', '飛': '飞', '遊': '游',
  '爬': '爬', '滾': '滚', '站': '站', '坐': '坐', '躺': '躺', '臥': '卧', '蹲': '蹲', '跪': '跪',
  '立': '立', '行': '行', '進': '进', '出': '出', '入': '入', '來': '来', '去': '去', '回': '回',
  '往': '往', '過': '过', '經': '经', '歷': '历', '經': '经', '過': '过', '從': '从', '自': '自',
  '由': '由', '因': '因', '為': '为', '所以': '所以', '但是': '但是', '而且': '而且', '或者': '或者',
  '英格蘭': '英格兰', '曼徹斯特': '曼彻斯特', '利物浦': '利物浦', '阿森納': '阿森纳', '切爾西': '切尔西',
  '曼聯': '曼联', '曼城': '曼城', '熱刺': '热刺', '紐卡斯爾': '纽卡斯尔', '阿斯頓': '阿斯顿',
  '韋斯咸': '西汉姆', '愛華頓': '埃弗顿', '列斯聯': '利兹联', '李斯特': '莱斯特', '修咸顿': '南安普顿',
  '狼隊': '狼队', '水晶宮': '水晶宫', '般尼茅夫': '伯恩茅斯', '富咸': '富勒姆', '般尼': '伯恩利',
  '錫菲爾德': '谢菲尔德', '錫周三': '谢周三', '諾丁漢': '诺丁汉', '森林': '森林', '盧頓': '卢顿',
  '西班牙': '西班牙', '皇馬': '皇马', '巴塞': '巴萨', '巴塞隆納': '巴塞罗那', '馬德里': '马德里',
  '競技': '竞技', '華倫西亞': '瓦伦西亚', '維拉利爾': '比利亚雷亚尔', '皇家': '皇家', '貝迪斯': '贝蒂斯',
  '西維爾': '塞维利亚', '艾拉維斯': '阿拉维斯', '格塔菲': '赫塔费', '奧沙辛拿': '奥萨苏纳',
  '意大利': '意大利', '祖雲達斯': '尤文图斯', 'AC米蘭': 'AC米兰', '國際米蘭': '国际米兰',
  '拿玻里': '那不勒斯', '羅馬': '罗马', '拉素': '拉齐奥', '阿特蘭大': '亚特兰大', '費倫天拿': '佛罗伦萨',
  '德國': '德国', '拜仁': '拜仁', '多蒙特': '多特蒙德', '利華古遜': '勒沃库森', '萊比錫': '莱比锡',
  '法國': '法国', '巴黎': '巴黎', '聖日耳曼': '圣日耳曼', '里昂': '里昂', '馬賽': '马赛',
  '歐洲': '欧洲', '冠軍盃': '冠军杯', '歐霸盃': '欧联杯', '世界盃': '世界杯', '聯賽': '联赛',
  '國家隊': '国家队', '俱樂部': '俱乐部', '足球': '足球', '籃球': '篮球', '網球': '网球',
  '橄欖球': '橄榄球', '棒球': '棒球', '賽車': '赛车', '運動': '运动', '體育': '体育',
  '運動員': '运动员', '球員': '球员', '教練': '教练', '領隊': '领队', '裁判': '裁判',
  '球迷': '球迷', '觀眾': '观众', '比賽': '比赛', '賽事': '赛事', '錦標賽': '锦标赛',
  '淘汰賽': '淘汰赛', '小組賽': '小组赛', '分組賽': '分组赛', '預賽': '预赛', '決賽': '决赛',
  '半決賽': '半决赛', '八強': '八强', '四強': '四强', '季軍': '季军', '亞軍': '亚军',
  '冠軍': '冠军', '獎盃': '奖杯', '獎牌': '奖牌', '金牌': '金牌', '銀牌': '银牌',
  '銅牌': '铜牌', '積分': '积分', '排名': '排名', '榜單': '榜单', '成績': '成绩',
  '戰績': '战绩', '勝': '胜', '負': '负', '和': '和', '平': '平', '輸': '输',
  '贏': '赢', '進球': '进球', '失球': '失球', '淨勝球': '净胜球', '助攻': '助攻',
  '犯規': '犯规', '黃牌': '黄牌', '紅牌': '红牌', '點球': '点球', '十二碼': '十二码',
  '角球': '角球', '自由球': '任意球', '邊線球': '边线球', '界外球': '界外球', '開球': '开球',
  '中場': '中场', '前鋒': '前锋', '後衛': '后卫', '中堅': '中坚', '守門員': '守门员',
  '門將': '门将', '替補': '替补', '後備': '后备', '陣容': '阵容', '陣式': '阵式',
  '戰術': '战术', '策略': '策略', '進攻': '进攻', '防守': '防守', '反擊': '反击',
  '傳球': '传球', '射門': '射门', '過人': '过人', '帶球': '带球', '盤球': '盘球',
  '停球': '停球', '頂球': '顶球', '鏟球': '铲球', '搶斷': '抢断', '攔截': '拦截',
  '解圍': '解围', '回傳': '回传', '長傳': '长传', '短傳': '短传', '直傳': '直传',
  '斜傳': '斜传', '橫傳': '横传', '過頂傳': '过顶传', '吊傳': '吊传', '推射': '推射',
  '抽射': '抽射', '遠射': '远射', '頭球': '头球', '腳后跟': '脚后跟', '單刀': '单刀',
  '越位': '越位', '手球': '手球', '烏龍': '乌龙', '烏龍球': '乌龙球', '假摔': '假摔',
  '拖延': '拖延', '時間': '时间', '傷停': '伤停', '補時': '补时', '加時': '加时',
  '延長': '延长', '點球大戰': '点球大战', '互射': '互射', '十二碼': '十二码',
  '伊拉克': '伊拉克', '星級': '星级', '塞浦路斯': '塞浦路斯', '甲級': '甲级',
  '保級': '保级', '以色列': '以色列', '貝爾謝巴': '贝尔谢巴', '特拉維夫': '特拉维夫',
  '哈波爾': '哈波尔', '阿爾': '阿尔', '加拉法': '加拉法', '卡爾克': '卡尔克',
  '莫蘇爾': '摩苏尔', '杜霍克': '杜胡克', '巴格達': '巴格达', '卡赫拉巴': '卡赫拉巴',
  '伊蒂哈德': '伊蒂哈德', '阿斯卡里': '阿斯卡里', '阿赫達爾': '阿赫达尔',
  '阿弗里基': '阿弗里基', '納斯爾': '纳斯尔', '希拉爾': '希拉尔',
  '阿赫利': '阿赫利', '班加西': '班加西', '阿克里塔斯': '阿克里塔斯',
  '克洛拉卡斯': '克洛拉卡斯', '利馬索爾': '利马索尔'
};

function traditionalToSimplified(text: string): string {
  if (!text) return text;
  let result = text;
  for (const [traditional, simplified] of Object.entries(TRADITIONAL_TO_SIMPLIFIED)) {
    result = result.split(traditional).join(simplified);
  }
  return result;
}

export async function translateToZh(text: string, targetLang: 'zh-TW' | 'zh-CN' = 'zh-TW'): Promise<TranslateResult> {
  if (!text) return { translated: text, fromCache: true };

  const cache = loadTranslationsCache();
  const cacheKey = text.trim();
  const cacheKeyWithLang = `${cacheKey}_${targetLang}`;

  if (cache[cacheKeyWithLang]) {
    return { translated: cache[cacheKeyWithLang], fromCache: true };
  }

  if (containsChinese(cacheKey)) {
    cache[cacheKeyWithLang] = cacheKey;
    saveTranslationsCache(cache);
    return { translated: cacheKey, fromCache: true };
  }

  if (pendingTranslations.has(cacheKeyWithLang)) {
    const result = await pendingTranslations.get(cacheKeyWithLang)!;
    return { translated: result, fromCache: true };
  }

  const promise = (async () => {
    try {
      const tl = targetLang === 'zh-CN' ? 'zh-CN' : 'zh-TW';
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${tl}&dt=t&q=${encodeURIComponent(cacheKey)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      if (!res.ok) {
        return cacheKey;
      }

      const data = await res.json();
      let translated = '';

      if (Array.isArray(data) && data[0]) {
        translated = data[0]
          .map((item: any) => item[0] || '')
          .join('');
      }

      translated = translated.trim();

      if (!translated || translated === cacheKey) {
        return cacheKey;
      }

      cache[cacheKeyWithLang] = translated;
      saveTranslationsCache(cache);

      return translated;
    } catch (e) {
      console.error(`[Translate] Failed to translate "${cacheKey}" to ${targetLang}:`, e);
      return cacheKey;
    } finally {
      pendingTranslations.delete(cacheKeyWithLang);
    }
  })();

  pendingTranslations.set(cacheKeyWithLang, promise);
  const result = await promise;
  return { translated: result, fromCache: false };
}

export async function translateToZhTW(text: string): Promise<TranslateResult> {
  return translateToZh(text, 'zh-TW');
}

export { traditionalToSimplified };
