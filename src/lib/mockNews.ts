export type NewsCategory = 'all' | 'announcement' | 'update' | 'event' | 'maintenance';

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: NewsCategory;
  date: string;
  isUnread: boolean;
  isPinned?: boolean;
}

const newsData: Record<string, NewsItem[]> = {
  en: [
    {
      id: 'news-1',
      title: 'Mainnet Launch: Register to get 100 USDT Trial Funds',
      excerpt: 'Celebrate our decentralized sports prediction market launch on Solana. Unlock 100 USDT upon your first bet.',
      content: 'To celebrate the fairest and most transparent decentralized sports prediction market launching on Solana mainnet, we are rolling out the "New User 100 USDT Airdrop".\n\nDuration: From now until the end of the month.\nRules: Accumulate 3 USDT in bets to receive the instant airdrop via smart contract.\nNote: Trial funds can only be used for betting, but profits are fully withdrawable.',
      category: 'event',
      date: '2026-04-08',
      isUnread: true,
      isPinned: true
    },
    {
      id: 'news-2',
      title: 'System Upgrade: Dynamic Odds Engine V2 Deployed',
      excerpt: 'Significantly reduced slippage during market volatility and improved pool depth and liquidity.',
      content: 'We are excited to announce that Dynamic Odds Engine V2 has been successfully deployed.\nHighlights:\n1. Introduced AMM curve optimization to lower slippage in extreme markets.\n2. Improved pool liquidity sharing.\n3. Optimized settlement contract execution, payouts are now under 3 seconds.',
      category: 'update',
      date: '2026-04-05',
      isUnread: true
    },
    {
      id: 'news-3',
      title: '[Maintenance] Solana RPC Node Upgrade',
      excerpt: 'RPC node upgrade scheduled for April 10, 02:00-04:00. Brief connection instability expected.',
      content: 'To provide better connection stability, we will upgrade our RPC nodes on April 10, 2026, 02:00 - 04:00 (UTC+8).\nImpact:\n- Brief "Wallet connection failed" or "Balance update delayed" issues.\n- Submitted bets are unaffected and will settle automatically when the network recovers.',
      category: 'maintenance',
      date: '2026-04-03',
      isUnread: false
    }
  ],
  'zh-TW': [
    {
      id: 'news-1',
      title: '主網上線慶典：註冊即領 100 USDT 體驗金',
      excerpt: '慶祝去中心化體育預測市場正式登陸 Solana，完成首次投注即可解鎖 100 USDT。',
      content: '為慶祝 Web3 最公平、最透明的去中心化體育預測市場正式登陸 Solana 主網，平台隆重推出「新戶 100 USDT 空投計畫」。\n\n活動期間：即日起至本月底止。\n發放規則：達成 3 USDT 累積投注條件後，透過智能合約即時空投，零延遲。\n注意事項：體驗金僅限投注使用，獲利可全額提現。遇問題請洽客服。',
      category: 'event',
      date: '2026-04-08',
      isUnread: true,
      isPinned: true
    },
    {
      id: 'news-2',
      title: '系統升級：動態賠率引擎 V2 部署完成',
      excerpt: '大幅降低了市場波動時的滑點，並提升了資金池的深度與流動性。',
      content: '我們很高興宣布動態賠率引擎 V2 已成功部署。\n本次升級重點：\n1. 引入了 AMM (自動做市商) 曲線優化，降低了極端行情下的滑點。\n2. 提升了資金池流動性共享機制。\n3. 優化了結算合約的執行速度，現在派彩時間縮短至 3 秒內。',
      category: 'update',
      date: '2026-04-05',
      isUnread: true
    },
    {
      id: 'news-3',
      title: '【維護通知】Solana 節點 RPC 升級',
      excerpt: '預計於 4月10日凌晨 02:00-04:00 進行 RPC 節點升級，期間可能會有短暫連線不穩。',
      content: '為提供更穩定的連線品質，我們將於 2026年4月10日 02:00 至 04:00 (UTC+8) 進行 RPC 節點升級。\n影響範圍：\n- 期間內可能會出現短暫的「無法連接錢包」或「餘額更新延遲」。\n- 已提交的訂單不受影響，結算將在網路恢復後自動完成。\n感謝您的體諒與支持。',
      category: 'maintenance',
      date: '2026-04-03',
      isUnread: false
    }
  ],
  'zh-CN': [
    {
      id: 'news-1',
      title: '主网上线庆典：注册即领 100 USDT 体验金',
      excerpt: '庆祝去中心化体育预测市场正式登陆 Solana，完成首次投注即可解锁 100 USDT。',
      content: '为庆祝 Web3 最公平、最透明的去中心化体育预测市场正式登陆 Solana 主网，平台隆重推出「新户 100 USDT 空投计划」。\n\n活动期间：即日起至本月底止。\n发放规则：达成 3 USDT 累计投注条件后，透过智能合约即时空投，零延迟。\n注意事项：体验金仅限投注使用，获利可全额提现。遇问题请洽客服。',
      category: 'event',
      date: '2026-04-08',
      isUnread: true,
      isPinned: true
    },
    {
      id: 'news-2',
      title: '系统升级：动态赔率引擎 V2 部署完成',
      excerpt: '大幅降低了市场波动时的滑点，并提升了资金池的深度与流动性。',
      content: '我们很高兴宣布动态赔率引擎 V2 已成功部署。\n本次升级重点：\n1. 引入了 AMM (自动做市商) 曲线优化，降低了极端行情下的滑点。\n2. 提升了资金池流动性共享机制。\n3. 优化了结算合约的执行速度，现在派彩时间缩短至 3 秒内。',
      category: 'update',
      date: '2026-04-05',
      isUnread: true
    },
    {
      id: 'news-3',
      title: '【维护通知】Solana 节点 RPC 升级',
      excerpt: '预计于 4月10日凌晨 02:00-04:00 进行 RPC 节点升级，期间可能会有短暂连线不稳。',
      content: '为提供更稳定的连线品质，我们将于 2026年4月10日 02:00 至 04:00 (UTC+8) 进行 RPC 节点升级。\n影响范围：\n- 期间内可能会出现短暂的「无法连接钱包」或「余额更新延迟」。\n- 已提交的订单不受影响，结算将在网络恢复后自动完成。\n感谢您的体谅与支持。',
      category: 'maintenance',
      date: '2026-04-03',
      isUnread: false
    }
  ],
  'th': [
    {
      id: 'news-1',
      title: 'การเปิดตัว Mainnet: ลงทะเบียนรับเงินทดลอง 100 USDT',
      excerpt: 'เฉลิมฉลองการเปิดตัวตลาดการทำนายผลกีฬาแบบกระจายศูนย์บน Solana รับทันที 100 USDT เมื่อคุณวางเดิมพันครั้งแรก',
      content: 'เพื่อเฉลิมฉลองตลาดการทำนายผลกีฬาแบบกระจายศูนย์ที่ยุติธรรมและโปร่งใสที่สุดบน Solana mainnet เรากำลังเปิดตัว "Airdrop ผู้ใช้ใหม่ 100 USDT"\n\nระยะเวลา: ตั้งแต่วันนี้จนถึงสิ้นเดือน\nกฎ: สะสมยอดเดิมพัน 3 USDT เพื่อรับ Airdrop ทันทีผ่านสัญญาอัจฉริยะ\nหมายเหตุ: เงินทดลองสามารถใช้สำหรับการเดิมพันเท่านั้น แต่กำไรสามารถถอนออกได้เต็มจำนวน',
      category: 'event',
      date: '2026-04-08',
      isUnread: true,
      isPinned: true
    },
    {
      id: 'news-2',
      title: 'อัปเกรดระบบ: นำ Dynamic Odds Engine V2 มาใช้',
      excerpt: 'ลดความคลาดเคลื่อน (Slippage) ระหว่างที่ตลาดมีความผันผวนอย่างมาก และปรับปรุงความลึกและสภาพคล่องของพูล',
      content: 'เรายินดีที่จะประกาศว่า Dynamic Odds Engine V2 ได้ถูกนำมาใช้เรียบร้อยแล้ว\nจุดเด่น:\n1. แนะนำการเพิ่มประสิทธิภาพโค้ง AMM เพื่อลดความคลาดเคลื่อนในตลาดที่มีความผันผวนสูง\n2. ปรับปรุงการแบ่งปันสภาพคล่องของพูล\n3. เพิ่มประสิทธิภาพการทำงานของสัญญาการชำระเงิน การจ่ายเงินใช้เวลาไม่ถึง 3 วินาที',
      category: 'update',
      date: '2026-04-05',
      isUnread: true
    },
    {
      id: 'news-3',
      title: '[การบำรุงรักษา] อัปเกรดโหนด Solana RPC',
      excerpt: 'กำหนดการอัปเกรดโหนด RPC ในวันที่ 10 เมษายน 02:00-04:00 คาดว่าจะเกิดความไม่เสถียรในการเชื่อมต่อชั่วคราว',
      content: 'เพื่อให้บริการการเชื่อมต่อที่เสถียรยิ่งขึ้น เราจะทำการอัปเกรดโหนด RPC ในวันที่ 10 เมษายน 2026 02:00 - 04:00 (UTC+8)\nผลกระทบ:\n- ปัญหาชั่วคราวเช่น "การเชื่อมต่อกระเป๋าเงินล้มเหลว" หรือ "การอัปเดตยอดคงเหลือล่าช้า"\n- การเดิมพันที่ส่งไปแล้วจะไม่ได้รับผลกระทบและจะถูกชำระอัตโนมัติเมื่อเครือข่ายกู้คืน',
      category: 'maintenance',
      date: '2026-04-03',
      isUnread: false
    }
  ]
};

export const getMockNews = (lang: string): NewsItem[] => {
  if (newsData[lang]) {
    return newsData[lang];
  }
  // Add fallback translated versions for other languages
  // In a real app these would be fetched from an API or defined in a larger translation file
  return newsData['en'];
};
