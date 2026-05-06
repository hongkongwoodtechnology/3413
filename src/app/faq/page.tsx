"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { WalletButton } from "@/components/WalletButton";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type FaqItem = {
  q: string;
  a: string;
};

export default function FaqPage() {
  const { t, language } = useLanguage();

  const items: FaqItem[] = useMemo(() => {
    if (language === "zh-TW") {
      return [
        {
          q: "這是什麼平台？",
          a: "PolyBall 是建立在 Solana 上的去中心化體育預測市場。你用錢包直接下單，資金與結算以鏈上交易為準。",
        },
        {
          q: "如何開始下注？",
          a: "1) 連接 Solana 錢包（Phantom / Solflare） 2) 準備少量 SOL 支付交易費 3) 確保錢包中有可用的 USDT（或平台活動的體驗金）4) 選擇賽事與結果，輸入金額並確認交易。",
        },
        {
          q: "平台會收取哪些費用？",
          a: "在你按下確認前，介面會顯示本次交易相關的協議費用/滑點等資訊。鏈上實際以交易拆分與最終成交為準。",
        },
        {
          q: "體驗金（tUSDT）是什麼？可以提現嗎？",
          a: "體驗金通常用於讓新用戶無風險體驗下注流程。一般規則是：由體驗金產生的獲利可提現，但體驗金本金不可提現；實際規則以活動頁條款為準。",
        },
        {
          q: "下注後多久會結算？",
          a: "結算取決於賽事結果何時被確認與寫入鏈上。當結果被確認後，合約會依規則處理結算，獎金會直接回到你的錢包地址。",
        },
        {
          q: "我可以取消下注嗎？",
          a: "鏈上交易一旦送出並確認，通常不可撤回。若賽事被取消/中止，平台可能提供退款或特殊處理；以公告與結算規則為準。",
        },
        {
          q: "公平性如何保證？平台能改結果嗎？",
          a: "關鍵資訊（交易、資金流向、結算）以鏈上為準。賽事結果的來源、驗證與寫入流程會在白皮書中說明；平台不應以中心化方式私改已上鏈的結算結果。",
        },
        {
          q: "在哪裡可以看到更完整的機制說明？",
          a: "你可以查看白皮書頁面，了解資金流、結算流程、費用分配與風險提示。",
        },
      ];
    }

    if (language === "zh-CN") {
      return [
        {
          q: "这是什么平台？",
          a: "PolyBall 是建立在 Solana 上的去中心化体育预测市场。你用钱包直接下单，资金与结算以链上交易为准。",
        },
        {
          q: "如何开始下注？",
          a: "1) 连接 Solana 钱包（Phantom / Solflare）2) 准备少量 SOL 支付交易费 3) 确保钱包中有可用的 USDT（或平台活动的体验金）4) 选择赛事与结果，输入金额并确认交易。",
        },
        {
          q: "平台会收取哪些费用？",
          a: "在你按下确认前，界面会显示本次交易相关的协议费用/滑点等信息。链上实际以交易拆分与最终成交为准。",
        },
        {
          q: "体验金（tUSDT）是什么？可以提现吗？",
          a: "体验金通常用于让新用户无风险体验下注流程。一般规则是：由体验金产生的获利可提现，但体验金本金不可提现；实际规则以活动页条款为准。",
        },
        {
          q: "下注后多久会结算？",
          a: "结算取决于赛事结果何时被确认与写入链上。当结果被确认后，合约会依规则处理结算，奖金会直接回到你的钱包地址。",
        },
        {
          q: "我可以取消下注吗？",
          a: "链上交易一旦送出并确认，通常不可撤回。若赛事被取消/中止，平台可能提供退款或特殊处理；以公告与结算规则为准。",
        },
        {
          q: "公平性如何保证？平台能改结果吗？",
          a: "关键信息（交易、资金流向、结算）以链上为准。赛事结果的来源、验证与写入流程会在白皮书中说明；平台不应以中心化方式私改已上链的结算结果。",
        },
        {
          q: "在哪里可以看到更完整的机制说明？",
          a: "你可以查看白皮书页面，了解资金流、结算流程、费用分配与风险提示。",
        },
      ];
    }

    if (language === "es") {
      return [
        {
          q: "¿Qué es esta plataforma?",
          a: "PolyBall es un mercado descentralizado de predicciones deportivas construido sobre Solana. Tus apuestas y la liquidación se reflejan en transacciones on-chain.",
        },
        {
          q: "¿Cómo empiezo a apostar?",
          a: "1) Conecta una wallet de Solana (Phantom / Solflare) 2) Mantén una pequeña cantidad de SOL para comisiones de red 3) Ten USDT disponible (o fondos de prueba de eventos) 4) Elige un partido y un resultado, introduce el monto y confirma la transacción.",
        },
        {
          q: "¿Qué comisiones pago?",
          a: "Antes de confirmar, la interfaz muestra información de comisiones/slippage relacionada con la acción. El resultado final depende de la ejecución de la transacción en la cadena.",
        },
        {
          q: "¿Qué son los fondos de prueba (tUSDT)?",
          a: "Los fondos de prueba sirven para que nuevos usuarios experimenten el flujo con menos riesgo. Normalmente, las ganancias pueden ser retirables y el principal no, pero siempre debes seguir los términos del evento.",
        },
        {
          q: "¿Cuándo se liquida la apuesta?",
          a: "La liquidación depende de cuándo se confirme y registre el resultado del partido. Una vez confirmado, el contrato liquida según las reglas y el pago vuelve directamente a tu wallet.",
        },
        {
          q: "¿Puedo cancelar una apuesta?",
          a: "Una transacción on-chain normalmente no se puede revertir una vez confirmada. Si un partido se cancela/queda nulo, la plataforma puede aplicar reembolsos u otro tratamiento según las reglas de liquidación.",
        },
        {
          q: "¿Cómo se garantiza la equidad?",
          a: "La información crítica (transacciones, flujos de fondos, liquidación) es verificable on-chain. El proceso de obtención y verificación de resultados se describe en el whitepaper.",
        },
        {
          q: "¿Dónde puedo leer la explicación completa?",
          a: "Abre la página del Whitepaper para ver detalles de flujo de fondos, liquidación, reparto de comisiones y avisos de riesgo.",
        },
      ];
    }

    if (language === "th") {
      return [
        {
          q: "นี่คือแพลตฟอร์มอะไร?",
          a: "PolyBall คือแพลตฟอร์มตลาดทำนายผลกีฬาแบบกระจายศูนย์บน Solana โดยการเดิมพันและการชำระบัญชีจะอ้างอิงจากธุรกรรมบนเชนเป็นหลัก",
        },
        {
          q: "เริ่มต้นเดิมพันอย่างไร?",
          a: "1) เชื่อมต่อกระเป๋า Solana (Phantom / Solflare) 2) เตรียม SOL เล็กน้อยสำหรับค่าธรรมเนียมเครือข่าย 3) มี USDT ในกระเป๋า (หรือเงินทดลองจากกิจกรรม) 4) เลือกการแข่งขันและผลลัพธ์ ใส่จำนวนเงิน และยืนยันธุรกรรม",
        },
        {
          q: "มีค่าธรรมเนียมอะไรบ้าง?",
          a: "ก่อนกดยืนยัน หน้าเว็บจะแสดงข้อมูลค่าธรรมเนียม/สลิปเพจที่เกี่ยวข้องกับการดำเนินการนั้น ๆ ผลลัพธ์สุดท้ายขึ้นอยู่กับการประมวลผลธุรกรรมบนเชน",
        },
        {
          q: "เงินทดลอง (tUSDT) คืออะไร? ถอนออกได้ไหม?",
          a: "เงินทดลองมักใช้เพื่อให้ผู้ใช้ใหม่ทดลองขั้นตอนการใช้งานด้วยความเสี่ยงต่ำ โดยทั่วไปกำไรอาจถอนได้ แต่เงินต้นทดลองมักถอนไม่ได้ ทั้งนี้ให้ยึดตามเงื่อนไขของกิจกรรมเป็นหลัก",
        },
        {
          q: "จะชำระบัญชีเมื่อไหร่?",
          a: "ขึ้นอยู่กับเวลาที่ผลการแข่งขันถูกยืนยันและบันทึกบนเชน เมื่อยืนยันแล้ว สัญญาจะชำระบัญชีตามกติกา และเงินรางวัลจะถูกส่งกลับไปยังกระเป๋าของคุณ",
        },
        {
          q: "ยกเลิกการเดิมพันได้ไหม?",
          a: "ธุรกรรมบนเชนโดยทั่วไปไม่สามารถย้อนกลับได้เมื่อยืนยันแล้ว หากการแข่งขันถูกยกเลิก/เป็นโมฆะ แพลตฟอร์มอาจมีการคืนเงินหรือการจัดการพิเศษตามกติกาการชำระบัญชี",
        },
        {
          q: "ความยุติธรรม/ความโปร่งใสรับประกันอย่างไร?",
          a: "ข้อมูลสำคัญ (ธุรกรรม การไหลของเงิน การชำระบัญชี) ตรวจสอบได้บนเชน กระบวนการรับผลการแข่งขันและการตรวจสอบจะอธิบายใน Whitepaper",
        },
        {
          q: "อ่านกลไกแบบละเอียดได้ที่ไหน?",
          a: "ไปที่หน้า Whitepaper เพื่อดูรายละเอียดเกี่ยวกับการไหลของเงิน การชำระบัญชี การแบ่งค่าธรรมเนียม และคำเตือนความเสี่ยง",
        },
      ];
    }

    if (language === "ar") {
      return [
        {
          q: "ما هي هذه المنصة؟",
          a: "PolyBall هو سوق توقعات رياضية لامركزي مبني على سولانا. يتم توثيق الرهانات والتسوية عبر معاملات على السلسلة (On-chain).",
        },
        {
          q: "كيف أبدأ؟",
          a: "1) اربط محفظة سولانا (Phantom / Solflare) 2) احتفِظ بقليل من SOL لرسوم الشبكة 3) تأكد من وجود USDT (أو أموال تجريبية من الفعاليات) 4) اختر مباراة ونتيجة، أدخل المبلغ ثم أكد المعاملة.",
        },
        {
          q: "ما الرسوم التي أدفعها؟",
          a: "قبل التأكيد، تعرض الواجهة معلومات الرسوم/الانزلاق المتعلقة بالإجراء. النتيجة النهائية تعتمد على تنفيذ المعاملة على السلسلة.",
        },
        {
          q: "ما هي الأموال التجريبية (tUSDT)؟ وهل يمكن سحبها؟",
          a: "تُستخدم الأموال التجريبية عادةً لتمكين المستخدمين الجدد من تجربة التدفق بمخاطر أقل. غالبًا يمكن سحب الأرباح بينما لا يمكن سحب أصل الأموال التجريبية، لكن المرجع النهائي هو شروط الفعالية.",
        },
        {
          q: "متى تتم التسوية؟",
          a: "تتم التسوية بعد تأكيد نتيجة المباراة وتسجيلها. عند التأكيد، يقوم العقد الذكي بالتسوية وفق القواعد وتعود المدفوعات مباشرةً إلى محفظتك.",
        },
        {
          q: "هل يمكنني إلغاء رهان؟",
          a: "عادةً لا يمكن عكس المعاملات على السلسلة بعد تأكيدها. إذا أُلغيت المباراة/اعتُبرت لاغية، قد تُطبق المنصة استردادًا أو معالجة خاصة وفق قواعد التسوية.",
        },
        {
          q: "كيف يتم ضمان الشفافية/العدالة؟",
          a: "البيانات الأساسية (المعاملات، تدفقات الأموال، التسوية) قابلة للتحقق على السلسلة. يشرح الـ Whitepaper آلية إدخال النتائج والتحقق منها.",
        },
        {
          q: "أين أقرأ الشرح الكامل؟",
          a: "افتح صفحة الـ Whitepaper للاطلاع على تفاصيل تدفق الأموال، التسوية، توزيع الرسوم، وتنبيهات المخاطر.",
        },
      ];
    }

    if (language === "fr") {
      return [
        {
          q: "Qu’est-ce que cette plateforme ?",
          a: "PolyBall est un marché de prédiction sportive décentralisé sur Solana. Les mises et la liquidation sont reflétées par des transactions on-chain.",
        },
        {
          q: "Comment commencer ?",
          a: "1) Connectez un wallet Solana (Phantom / Solflare) 2) Gardez un petit montant de SOL pour les frais réseau 3) Ayez des USDT (ou des fonds d’essai d’événements) 4) Choisissez un match et un résultat, saisissez le montant et confirmez la transaction.",
        },
        {
          q: "Quels frais dois-je payer ?",
          a: "Avant de confirmer, l’interface affiche les informations de frais/slippage liées à l’action. Le résultat final dépend de l’exécution on-chain.",
        },
        {
          q: "Que sont les fonds d’essai (tUSDT) ?",
          a: "Les fonds d’essai servent à permettre aux nouveaux utilisateurs de tester le parcours avec moins de risque. En général, les profits peuvent être retirables alors que le principal ne l’est pas, selon les conditions de l’événement.",
        },
        {
          q: "Quand la liquidation a-t-elle lieu ?",
          a: "La liquidation dépend de la confirmation et de l’enregistrement du résultat du match. Une fois confirmé, le contrat exécute la liquidation et les gains retournent directement à votre wallet.",
        },
        {
          q: "Puis-je annuler une mise ?",
          a: "Une transaction on-chain n’est généralement pas réversible après confirmation. Si un match est annulé/invalidé, la plateforme peut appliquer un remboursement ou un traitement spécial selon les règles de liquidation.",
        },
        {
          q: "Comment l’équité est-elle assurée ?",
          a: "Les données critiques (transactions, flux de fonds, liquidation) sont vérifiables on-chain. Le processus d’ingestion et de vérification des résultats est décrit dans le whitepaper.",
        },
        {
          q: "Où lire l’explication complète ?",
          a: "Ouvrez la page Whitepaper pour les détails sur les flux de fonds, la liquidation, la répartition des frais et les avertissements de risque.",
        },
      ];
    }

    if (language === "ru") {
      return [
        {
          q: "Что это за платформа?",
          a: "PolyBall — децентрализованный рынок спортивных прогнозов на Solana. Ставки и расчёты отражаются в on-chain транзакциях.",
        },
        {
          q: "Как начать?",
          a: "1) Подключите Solana-кошелёк (Phantom / Solflare) 2) Держите немного SOL для комиссий сети 3) Убедитесь, что у вас есть USDT (или пробные средства из событий) 4) Выберите матч и исход, введите сумму и подтвердите транзакцию.",
        },
        {
          q: "Какие комиссии я плачу?",
          a: "Перед подтверждением интерфейс показывает информацию о комиссиях/проскальзывании для текущего действия. Итог зависит от исполнения транзакции в сети.",
        },
        {
          q: "Что такое пробные средства (tUSDT)?",
          a: "Пробные средства помогают новым пользователям пройти процесс с меньшим риском. Обычно прибыль может выводиться, а пробный депозит — нет, но ориентируйтесь на условия конкретного события.",
        },
        {
          q: "Когда происходит расчёт?",
          a: "Расчёт зависит от того, когда результат матча подтверждён и записан. После подтверждения контракт выполняет расчёт, а выплаты поступают напрямую на ваш кошелёк.",
        },
        {
          q: "Можно ли отменить ставку?",
          a: "On-chain транзакции обычно нельзя откатить после подтверждения. При отмене/аннулировании матча платформа может применить возврат или особую обработку по правилам расчёта.",
        },
        {
          q: "Как обеспечивается честность?",
          a: "Ключевые данные (транзакции, потоки средств, расчёт) проверяемы on-chain. Процесс получения и проверки результатов описан в whitepaper.",
        },
        {
          q: "Где прочитать полное описание механики?",
          a: "Откройте страницу Whitepaper, чтобы узнать про потоки средств, расчёт, распределение комиссий и предупреждения о рисках.",
        },
      ];
    }

    if (language === "de") {
      return [
        {
          q: "Was ist diese Plattform?",
          a: "PolyBall ist ein dezentraler Sport‑Prediction‑Markt auf Solana. Wetten und Abrechnungen werden durch On‑Chain‑Transaktionen abgebildet.",
        },
        {
          q: "Wie starte ich?",
          a: "1) Solana‑Wallet verbinden (Phantom / Solflare) 2) Etwas SOL für Netzwerkgebühren bereithalten 3) USDT bereithalten (oder Testguthaben aus Aktionen) 4) Match und Ergebnis wählen, Betrag eingeben und Transaktion bestätigen.",
        },
        {
          q: "Welche Gebühren fallen an?",
          a: "Vor dem Bestätigen zeigt die UI relevante Fee/Slippage‑Infos. Das endgültige Ergebnis hängt von der On‑Chain‑Ausführung ab.",
        },
        {
          q: "Was sind Testguthaben (tUSDT)?",
          a: "Testguthaben dient dazu, den Ablauf mit geringerem Risiko auszuprobieren. Häufig sind Gewinne abhebbar, das Test‑Principal jedoch nicht — maßgeblich sind die Aktionsbedingungen.",
        },
        {
          q: "Wann findet die Abrechnung statt?",
          a: "Die Abrechnung hängt davon ab, wann das Match‑Ergebnis bestätigt und gespeichert wird. Danach rechnet der Vertrag gemäß Regeln ab und Auszahlungen gehen direkt an dein Wallet.",
        },
        {
          q: "Kann ich eine Wette stornieren?",
          a: "On‑Chain‑Transaktionen sind nach Bestätigung in der Regel nicht rückgängig zu machen. Bei Abbruch/Annullierung kann es je nach Regeln Rückerstattungen oder Sonderbehandlung geben.",
        },
        {
          q: "Wie wird Fairness sichergestellt?",
          a: "Kritische Daten (Transaktionen, Geldflüsse, Abrechnung) sind on‑chain überprüfbar. Der Ergebnis‑Ingest und die Verifikation werden im Whitepaper beschrieben.",
        },
        {
          q: "Wo finde ich die vollständige Erklärung?",
          a: "Sieh dir die Whitepaper‑Seite an: Geldfluss, Abrechnung, Gebührenaufteilung und Risikohinweise.",
        },
      ];
    }

    if (language === "ja") {
      return [
        {
          q: "このプラットフォームは何ですか？",
          a: "PolyBall は Solana 上の分散型スポーツ予測マーケットです。ベットと精算はオンチェーンの取引として記録されます。",
        },
        {
          q: "始め方は？",
          a: "1) Solana ウォレット（Phantom / Solflare）を接続 2) ネットワーク手数料用に少量の SOL を用意 3) USDT（またはイベントのトライアル資金）を用意 4) 試合と結果を選び、金額を入力して取引を承認します。",
        },
        {
          q: "手数料はかかりますか？",
          a: "承認前に、UI で手数料/スリッページ等の情報が表示されます。最終結果はオンチェーンでの実行により確定します。",
        },
        {
          q: "トライアル資金（tUSDT）とは？",
          a: "新規ユーザーが低リスクで流れを体験するための資金です。一般に利益は出金でき、元本は出金できない場合があります（イベント規約に従ってください）。",
        },
        {
          q: "精算はいつ行われますか？",
          a: "試合結果が確認されオンチェーンに記録された後、ルールに従って精算され、支払いはウォレットに直接戻ります。",
        },
        {
          q: "ベットをキャンセルできますか？",
          a: "オンチェーン取引は一度確定すると通常取り消せません。試合が中止/無効となった場合は、ルールに基づき返金等が行われることがあります。",
        },
        {
          q: "公平性はどう保証されますか？",
          a: "取引、資金フロー、精算などの重要情報はオンチェーンで検証できます。結果の取得と検証の流れは Whitepaper に記載します。",
        },
        {
          q: "詳しい仕組みはどこで読めますか？",
          a: "Whitepaper ページで、資金フロー、精算、手数料配分、リスク情報を確認してください。",
        },
      ];
    }

    if (language === "ko") {
      return [
        {
          q: "이 플랫폼은 무엇인가요?",
          a: "PolyBall은 Solana 기반의 탈중앙화 스포츠 예측 마켓입니다. 베팅과 정산은 온체인 트랜잭션으로 기록됩니다.",
        },
        {
          q: "어떻게 시작하나요?",
          a: "1) Solana 지갑(Phantom / Solflare) 연결 2) 네트워크 수수료용 SOL 소량 준비 3) USDT(또는 이벤트 트라이얼 자금) 보유 4) 경기와 결과를 선택하고 금액 입력 후 트랜잭션을 승인합니다.",
        },
        {
          q: "어떤 수수료가 있나요?",
          a: "확인 전에 UI에서 수수료/슬리피지 관련 정보를 보여줍니다. 최종 결과는 온체인 실행에 따라 결정됩니다.",
        },
        {
          q: "트라이얼 자금(tUSDT)이란?",
          a: "신규 사용자가 낮은 리스크로 흐름을 체험할 수 있도록 제공되는 자금입니다. 일반적으로 수익은 출금 가능하고 원금은 출금 불가할 수 있으며, 실제 조건은 이벤트 약관을 따릅니다.",
        },
        {
          q: "정산은 언제 되나요?",
          a: "경기 결과가 확인되어 기록된 이후 규칙에 따라 정산되며, 지급금은 지갑 주소로 직접 돌아갑니다.",
        },
        {
          q: "베팅을 취소할 수 있나요?",
          a: "온체인 트랜잭션은 확정 후 보통 되돌릴 수 없습니다. 경기 취소/무효 시에는 정산 규칙에 따라 환불 또는 특별 처리될 수 있습니다.",
        },
        {
          q: "공정성은 어떻게 보장되나요?",
          a: "거래, 자금 흐름, 정산 등 핵심 데이터는 온체인에서 검증 가능합니다. 결과 입력 및 검증 흐름은 Whitepaper에 설명됩니다.",
        },
        {
          q: "전체 메커니즘은 어디서 보나요?",
          a: "Whitepaper 페이지에서 자금 흐름, 정산, 수수료 배분, 리스크 안내를 확인하세요.",
        },
      ];
    }

    if (language === "pt") {
      return [
        {
          q: "O que é esta plataforma?",
          a: "PolyBall é um mercado descentralizado de previsões esportivas na Solana. As apostas e a liquidação são refletidas por transações on-chain.",
        },
        {
          q: "Como começo?",
          a: "1) Conecte uma carteira Solana (Phantom / Solflare) 2) Mantenha um pouco de SOL para taxas de rede 3) Tenha USDT (ou fundos de teste de eventos) 4) Escolha uma partida e um resultado, informe o valor e confirme a transação.",
        },
        {
          q: "Quais taxas eu pago?",
          a: "Antes de confirmar, a interface mostra informações de taxa/slippage relacionadas à ação. O resultado final depende da execução on-chain.",
        },
        {
          q: "O que são fundos de teste (tUSDT)?",
          a: "Os fundos de teste ajudam novos usuários a experimentar o fluxo com menor risco. Em geral, os lucros podem ser sacáveis e o principal não, mas siga os termos do evento.",
        },
        {
          q: "Quando ocorre a liquidação?",
          a: "A liquidação depende de quando o resultado da partida é confirmado e registrado. Uma vez confirmado, o contrato liquida conforme as regras e os pagamentos voltam diretamente para sua carteira.",
        },
        {
          q: "Posso cancelar uma aposta?",
          a: "Transações on-chain geralmente não podem ser revertidas após confirmadas. Se uma partida for cancelada/invalidada, a plataforma pode aplicar reembolso ou tratamento especial conforme as regras de liquidação.",
        },
        {
          q: "Como a equidade é garantida?",
          a: "Dados críticos (transações, fluxo de fundos, liquidação) são verificáveis on-chain. O processo de ingestão e verificação de resultados é descrito no whitepaper.",
        },
        {
          q: "Onde posso ler a explicação completa?",
          a: "Abra a página do Whitepaper para detalhes de fluxo de fundos, liquidação, alocação de taxas e avisos de risco.",
        },
      ];
    }

    return [
      {
        q: "What is this platform?",
        a: "PolyBall is a decentralized sports prediction market built on Solana. Bets and settlements are reflected by on-chain transactions.",
      },
      {
        q: "How do I start?",
        a: "1) Connect a Solana wallet (Phantom / Solflare) 2) Keep a small amount of SOL for network fees 3) Hold USDT (or trial funds from events) 4) Pick a match and an outcome, enter an amount, and confirm the transaction.",
      },
      {
        q: "What fees do I pay?",
        a: "Before you confirm, the UI shows fee/slippage-related info for the current action. The final on-chain outcome is determined by transaction execution.",
      },
      {
        q: "What are trial funds (tUSDT)?",
        a: "Trial funds are typically used to help new users experience the flow with lower risk. Commonly, profits may be withdrawable while the trial principal is not, but always follow the event terms.",
      },
      {
        q: "When does settlement happen?",
        a: "Settlement depends on when the match result is confirmed and recorded. Once confirmed, settlement is executed according to the rules and payouts go directly to your wallet address.",
      },
      {
        q: "Can I cancel a bet?",
        a: "On-chain transactions cannot usually be reverted once confirmed. If a match is canceled/voided, the platform may apply refunds or special handling based on the settlement rules.",
      },
      {
        q: "How is fairness ensured?",
        a: "Critical data (transactions, fund flows, settlement) is verifiable on-chain. The result ingestion and verification flow is described in the whitepaper.",
      },
      {
        q: "Where can I read the full mechanism?",
        a: "Open the Whitepaper page for details about fund flow, settlement, fee allocation, and risk disclosures.",
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
            <div className="font-bold text-lg text-white">{t("page.faq.title")}</div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher />
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 lg:px-8 py-8 max-w-5xl w-full">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-2xl">{t("page.faq.title")}</CardTitle>
            <CardDescription>
              <span className="text-neutral-400">
                {language === "zh-TW"
                  ? "快速解答：錢包、費用、結算與安全。"
                  : language === "zh-CN"
                    ? "快速解答：钱包、费用、结算与安全。"
                    : language === "es"
                      ? "Respuestas rápidas: wallets, comisiones, liquidación y seguridad."
                      : language === "th"
                        ? "คำตอบแบบรวดเร็ว: กระเป๋า ค่าธรรมเนียม การชำระบัญชี และความปลอดภัย"
                        : language === "ar"
                          ? "إجابات سريعة: المحافظ، الرسوم، التسوية، والأمان."
                          : language === "fr"
                            ? "Réponses rapides : wallets, frais, liquidation et sécurité."
                            : language === "ru"
                              ? "Быстрые ответы: кошельки, комиссии, расчёт и безопасность."
                              : language === "de"
                                ? "Kurze Antworten: Wallets, Gebühren, Abrechnung und Sicherheit."
                                : language === "ja"
                                  ? "クイック回答：ウォレット、手数料、精算、安全性。"
                                  : language === "ko"
                                    ? "빠른 안내: 지갑, 수수료, 정산, 보안."
                                    : language === "pt"
                                      ? "Respostas rápidas: carteiras, taxas, liquidação e segurança."
                    : "Quick answers about wallets, fees, settlement, and safety."}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-end">
              <Link href="/whitepaper" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                {t("page.view_whitepaper")}
              </Link>
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <details key={item.q} className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-4 py-3">
                  <summary className="cursor-pointer select-none font-semibold text-neutral-100">
                    {item.q}
                  </summary>
                  <div className="pt-2 text-sm leading-6 text-neutral-300 whitespace-pre-line">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="w-full border-t border-neutral-800 bg-neutral-900/80">
        <div className="container mx-auto px-4 lg:px-8 py-4 text-xs text-neutral-500">
          {language === "zh-TW"
            ? "提示：請負責任地參與，並確保你所在司法管轄區允許相關活動。"
            : language === "zh-CN"
              ? "提示：请负责任地参与，并确保你所在司法辖区允许相关活动。"
              : language === "es"
                ? "Aviso: participa de forma responsable y asegúrate de que esta actividad esté permitida en tu jurisdicción."
                : language === "th"
                  ? "คำเตือน: โปรดเข้าร่วมอย่างมีความรับผิดชอบ และตรวจสอบให้แน่ใจว่ากิจกรรมนี้ถูกต้องตามกฎหมายในเขตอำนาจศาลของคุณ"
                  : language === "ar"
                    ? "تنبيه: شارك بمسؤولية وتأكد من أن هذا النشاط مسموح به ضمن ولايتك القضائية."
                    : language === "fr"
                      ? "Rappel : participez de manière responsable et assurez-vous que cette activité est autorisée dans votre juridiction."
                      : language === "ru"
                        ? "Напоминание: участвуйте ответственно и убедитесь, что это разрешено в вашей юрисдикции."
                        : language === "de"
                          ? "Hinweis: Bitte verantwortungsvoll teilnehmen und prüfen, ob diese Aktivität in deiner Jurisdiktion erlaubt ist."
                          : language === "ja"
                            ? "注意：責任を持って参加し、居住地域で許可されているか確認してください。"
                            : language === "ko"
                              ? "안내: 책임감 있게 참여하고, 해당 활동이 거주 지역에서 허용되는지 확인하세요."
                              : language === "pt"
                                ? "Aviso: participe com responsabilidade e verifique se esta atividade é permitida na sua jurisdição."
              : "Reminder: participate responsibly and ensure this activity is permitted in your jurisdiction."}
        </div>
      </footer>
    </div>
  );
}
