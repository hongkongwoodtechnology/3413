export const TEAM_NAMES: Record<string, Record<string, string>> = {
    // English Premier League
    "Arsenal": {
        "zh-TW": "阿森納",
        "zh-CN": "阿森纳",
        "en": "Arsenal"
    },
    "Aston Villa": {
        "zh-TW": "阿斯頓維拉",
        "zh-CN": "阿斯顿维拉",
        "en": "Aston Villa"
    },
    "Chelsea": {
        "zh-TW": "切爾西",
        "zh-CN": "切尔西",
        "en": "Chelsea"
    },
    "Liverpool": {
        "zh-TW": "利物浦",
        "zh-CN": "利物浦",
        "en": "Liverpool"
    },
    "Manchester City": {
        "zh-TW": "曼城",
        "zh-CN": "曼城",
        "en": "Manchester City"
    },
    "Manchester United": {
        "zh-TW": "曼聯",
        "zh-CN": "曼联",
        "en": "Manchester United"
    },
    "Tottenham Hotspur": {
        "zh-TW": "托特納姆熱刺",
        "zh-CN": "托特纳姆热刺",
        "en": "Tottenham Hotspur"
    },
    "Newcastle United": {
        "zh-TW": "紐卡斯爾聯",
        "zh-CN": "纽卡斯尔联",
        "en": "Newcastle United"
    },

    // La Liga
    "Real Madrid": {
        "zh-TW": "皇家馬德里",
        "zh-CN": "皇家马德里",
        "en": "Real Madrid"
    },
    "Barcelona": {
        "zh-TW": "巴塞隆納",
        "zh-CN": "巴塞罗那",
        "en": "Barcelona"
    },
    "Atletico Madrid": {
        "zh-TW": "馬德里競技",
        "zh-CN": "马德里竞技",
        "en": "Atletico Madrid"
    },
    
    // Serie A
    "Juventus": {
        "zh-TW": "尤文圖斯",
        "zh-CN": "尤文图斯",
        "en": "Juventus"
    },
    "AC Milan": {
        "zh-TW": "AC米蘭",
        "zh-CN": "AC米兰",
        "en": "AC Milan"
    },
    "Inter Milan": {
        "zh-TW": "國際米蘭",
        "zh-CN": "国际米兰",
        "en": "Inter Milan"
    },
    "Napoli": {
        "zh-TW": "那不勒斯",
        "zh-CN": "那不勒斯",
        "en": "Napoli"
    },
    
    // Bundesliga
    "Bayern Munich": {
        "zh-TW": "拜仁慕尼黑",
        "zh-CN": "拜仁慕尼黑",
        "en": "Bayern Munich"
    },
    "Borussia Dortmund": {
        "zh-TW": "多特蒙德",
        "zh-CN": "多特蒙德",
        "en": "Borussia Dortmund"
    },
    
    // Ligue 1
    "Paris Saint-Germain": {
        "zh-TW": "巴黎聖日耳曼",
        "zh-CN": "巴黎圣日耳曼",
        "en": "Paris Saint-Germain"
    },
    
    // World Cup 2026 Teams
    "Mexico": {
        "zh-TW": "墨西哥",
        "zh-CN": "墨西哥",
        "en": "Mexico"
    },
    "Japan": {
        "zh-TW": "日本",
        "zh-CN": "日本",
        "en": "Japan"
    },
    "Spain": {
        "zh-TW": "西班牙",
        "zh-CN": "西班牙",
        "en": "Spain"
    },
    "Morocco": {
        "zh-TW": "摩洛哥",
        "zh-CN": "摩洛哥",
        "en": "Morocco"
    },
    "Brazil": {
        "zh-TW": "巴西",
        "zh-CN": "巴西",
        "en": "Brazil"
    },
    "Serbia": {
        "zh-TW": "塞爾維亞",
        "zh-CN": "塞尔维亚",
        "en": "Serbia"
    },
    "France": {
        "zh-TW": "法國",
        "zh-CN": "法国",
        "en": "France"
    },
    "Canada": {
        "zh-TW": "加拿大",
        "zh-CN": "加拿大",
        "en": "Canada"
    },

    // Default or Fallback
    "Default": {
        "zh-TW": "未知球隊",
        "zh-CN": "未知球队",
        "en": "Unknown Team"
    }
};

export const COUNTRY_CODES: Record<string, string> = {
    "Mexico": "mx",
    "Japan": "jp",
    "Spain": "es",
    "Morocco": "ma",
    "Brazil": "br",
    "Serbia": "rs",
    "France": "fr",
    "Canada": "ca",
};

export const LEAGUES = [
    {
        name: "Premier League",
        aliases: ["EPL", "English Premier League"],
        names: {
            "zh-TW": "英格蘭超級聯賽",
            "zh-CN": "英格兰超级联赛",
            "en": "Premier League"
        }
    },
    {
        name: "La Liga",
        aliases: ["Primera Division", "Spanish Primera Division"],
        names: {
            "zh-TW": "西班牙足球甲級聯賽",
            "zh-CN": "西班牙足球甲级联赛",
            "en": "La Liga"
        }
    },
    {
        name: "Serie A",
        aliases: ["Italian Serie A"],
        names: {
            "zh-TW": "義大利足球甲級聯賽",
            "zh-CN": "意大利足球甲级联赛",
            "en": "Serie A"
        }
    },
    {
        name: "Bundesliga",
        aliases: ["German Bundesliga"],
        names: {
            "zh-TW": "德國足球甲級聯賽",
            "zh-CN": "德国足球甲级联赛",
            "en": "Bundesliga"
        }
    },
    {
        name: "Ligue 1",
        aliases: ["French Ligue 1"],
        names: {
            "zh-TW": "法國足球甲級聯賽",
            "zh-CN": "法国足球甲级联赛",
            "en": "Ligue 1"
        }
    },
    {
        name: "UEFA Champions League",
        aliases: ["UCL", "Champions League"],
        names: {
            "zh-TW": "歐洲冠軍聯賽",
            "zh-CN": "欧洲冠军联赛",
            "en": "UEFA Champions League"
        }
    },
    {
        name: "UEFA Europa League",
        aliases: ["UEL", "Europa League"],
        names: {
            "zh-TW": "歐足聯歐洲聯賽",
            "zh-CN": "欧足联欧洲联赛",
            "en": "UEFA Europa League"
        }
    },
    {
        name: "FIFA World Cup",
        aliases: ["World Cup"],
        category: "worldcup",
        names: {
            "zh-TW": "國際足總世界盃",
            "zh-CN": "国际足联世界杯",
            "en": "FIFA World Cup"
        }
    }
];