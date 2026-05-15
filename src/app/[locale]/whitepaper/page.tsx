"use client";

import { LocalizedLink as Link } from "@/components/LocalizedLink"
import { useMemo } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { WalletButton } from "@/components/WalletButton";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type Section = {
  title: string;
  body: string;
};

export default function WhitepaperPage() {
  const { t, language } = useLanguage();

  const sections: Section[] = useMemo(() => {
    if (language === "zh-TW") {
      return [
        {
          title: "1. 摘要",
          body: "PolyBall 是建立在 Solana 上的去中心化體育預測市場。平台的核心設計目標是：非託管資金、鏈上可驗證的資金流向，以及更透明的結算流程。",
        },
        {
          title: "2. 我們解決什麼問題",
          body: "傳統投注平台常見痛點包含：資金被平台託管、結算規則不透明、提款速度不確定，以及使用者難以核對費用與資金流。PolyBall 以鏈上交易作為記錄與對帳依據，降低黑箱空間。",
        },
        {
          title: "3. 產品概覽（使用者流程）",
          body: "連接錢包 → 選擇賽事與結果 → 輸入投注金額 → 確認交易 → 等待賽事結束與結果確認 → 結算完成後獎金回到錢包。\n\n重要：所有資金移動以鏈上交易為準，請以錢包與區塊瀏覽器記錄核對。",
        },
        {
          title: "4. 資金流與費用分配（高層描述）",
          body: "每筆投注會在鏈上被拆分到不同用途（例如：進入獎池、平台費用、佣金/推薦獎勵等）。在你確認前，介面會呈現本次操作涉及的費用與預期影響；最終以交易實際執行為準。",
        },
        {
          title: "5. 結算與結果來源",
          body: "結算需要可靠的賽事結果來源與驗證流程。平台會將賽事結果以可稽核的方式輸入到鏈上，並由合約依規則計算輸贏與派彩。\n\n若遇到賽事取消/中止/改期等特殊情況，將依結算規則或公告進行處理（例如退款或作廢）。",
        },
        {
          title: "6. 安全與風險提示",
          body: "區塊鏈交易不可逆；請確認你使用的是正確的網路與代幣。任何投資/下注行為均存在風險，請量力而為。\n\n我們建議：只使用你能承受損失的資金、做好風險管理，並確保你所在地允許相關活動。",
        },
        {
          title: "7. 透明性承諾",
          body: "PolyBall 以鏈上可驗證為核心原則：資金流向、交易紀錄、與結算結果可被第三方獨立核對。若出現系統事件或異常，將以公告形式提供可理解的說明與後續處置。",
        },
      ];
    }

    if (language === "zh-CN") {
      return [
        {
          title: "1. 摘要",
          body: "PolyBall 是建立在 Solana 上的去中心化体育预测市场。平台的核心设计目标是：非托管资金、链上可验证的资金流向，以及更透明的结算流程。",
        },
        {
          title: "2. 我们解决什么问题",
          body: "传统投注平台常见痛点包含：资金被平台托管、结算规则不透明、提款速度不确定，以及用户难以核对费用与资金流。PolyBall 以链上交易作为记录与对账依据，降低黑箱空间。",
        },
        {
          title: "3. 产品概览（用户流程）",
          body: "连接钱包 → 选择赛事与结果 → 输入投注金额 → 确认交易 → 等待赛事结束与结果确认 → 结算完成后奖金回到钱包。\n\n重要：所有资金移动以链上交易为准，请以钱包与区块浏览器记录核对。",
        },
        {
          title: "4. 资金流与费用分配（高层描述）",
          body: "每笔投注会在链上被拆分到不同用途（例如：进入奖池、平台费用、佣金/推荐奖励等）。在你确认前，界面会呈现本次操作涉及的费用与预期影响；最终以交易实际执行为准。",
        },
        {
          title: "5. 结算与结果来源",
          body: "结算需要可靠的赛事结果来源与验证流程。平台会将赛事结果以可稽核的方式输入到链上，并由合约依规则计算输赢与派奖。\n\n若遇到赛事取消/中止/改期等特殊情况，将依结算规则或公告进行处理（例如退款或作废）。",
        },
        {
          title: "6. 安全与风险提示",
          body: "区块链交易不可逆；请确认你使用的是正确的网络与代币。任何投资/下注行为均存在风险，请量力而为。\n\n我们建议：只使用你能承受损失的资金、做好风险管理，并确保你所在地允许相关活动。",
        },
        {
          title: "7. 透明性承诺",
          body: "PolyBall 以链上可验证为核心原则：资金流向、交易记录、与结算结果可被第三方独立核对。若出现系统事件或异常，将以公告形式提供可理解的说明与后续处置。",
        },
      ];
    }

    return [
      {
        title: "1. Abstract",
        body: "PolyBall is a decentralized sports prediction market built on Solana. The core design goals are non-custodial funds, on-chain verifiable fund flows, and a more transparent settlement process.",
      },
      {
        title: "2. Problem Statement",
        body: "Traditional betting platforms often custody user funds, use opaque settlement rules, and make it difficult for users to verify fees and fund flows. PolyBall uses on-chain transactions as the source of truth for auditing.",
      },
      {
        title: "3. User Flow",
        body: "Connect wallet → select a match and outcome → enter an amount → confirm the transaction → wait for result confirmation → settlement completes and payouts return to your wallet.\n\nImportant: always verify activity using your wallet history and a block explorer.",
      },
      {
        title: "4. Fund Flow & Fees (High-Level)",
        body: "Each bet can be split on-chain for different purposes (e.g., prize pool, protocol/platform fees, commissions/referrals). Before confirmation, the UI surfaces the relevant fee and impact information; the final outcome is determined by transaction execution.",
      },
      {
        title: "5. Settlement & Result Ingestion",
        body: "Settlement depends on a reliable result source and a verifiable ingestion flow. Results are recorded in an auditable way and contracts settle according to the rules.\n\nCanceled/voided/postponed events may be handled via refunds or other settlement rules announced by the platform.",
      },
      {
        title: "6. Security & Risk Disclosures",
        body: "Blockchain transactions are irreversible. Verify the network and tokens carefully. Any prediction/betting activity involves risk; participate responsibly and within your means.\n\nEnsure the activity is permitted in your jurisdiction.",
      },
      {
        title: "7. Transparency Commitment",
        body: "PolyBall prioritizes verifiability: fund flows, transaction records, and settlement results can be independently audited. If incidents occur, we aim to publish clear announcements and follow-up actions.",
      },
    ];
  }, [language]);

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 font-sans flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-neutral-800 bg-neutral-900/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("page.back_home")}
            </Link>
            <div className="font-bold text-lg text-white">{t("page.whitepaper.title")}</div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher />
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 lg:px-8 py-8 max-w-5xl w-full space-y-6">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-2xl">{t("page.whitepaper.title")}</CardTitle>
            <CardDescription>
              <span className="text-neutral-400">
                {language === "zh-TW"
                  ? "非託管、可驗證、以鏈上為準。"
                  : language === "zh-CN"
                    ? "非托管、可验证、以链上为准。"
                    : "Non-custodial, verifiable, and on-chain-first."}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-end">
              <Link href="/faq" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                {t("page.view_faq")}
              </Link>
            </div>

            <div className="space-y-4">
              {sections.map((s) => (
                <section key={s.title} className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4">
                  <div className="font-semibold text-neutral-100">{s.title}</div>
                  <div className="mt-2 text-sm leading-6 text-neutral-300 whitespace-pre-line">{s.body}</div>
                </section>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="w-full border-t border-neutral-800 bg-neutral-900/80">
        <div className="container mx-auto px-4 lg:px-8 py-4 text-xs text-neutral-500">
          {language === "zh-TW"
            ? "本白皮書頁面為一般性說明，不構成投資建議或任何保證。"
            : language === "zh-CN"
              ? "本白皮书页面为一般性说明，不构成投资建议或任何保证。"
              : "This whitepaper page is for general information only and does not constitute financial advice."}
        </div>
      </footer>
    </div>
  );
}

