# PolyBall / GAMBLE 智能合约审计送审工作报告

## 1. 文档目的

本报告用于向外部审计机构说明本项目当前可供审计的智能合约材料、链上与链下系统边界、当前网站真实运行架构、预言机与结算路径，以及在正式送审前需要特别说明的范围限制与风险点。

本报告基于当前仓库源码与仓库内现有技术文档整理，不包含任何未在仓库中发现的假设性实现。

## 2. 结论摘要

当前仓库中**确实存在一套 Solana Anchor 智能合约程序**，主程序名称为 `prophecy_arena`，位于 `solana-program/` 工作区下。该程序实现了市场创建、赛果解析、推荐绑定、佣金状态、下注、退款、佣金提取和赢家领取等链上逻辑。

但从当前网站前后端实现来看，**站点实际生产路径并非完全由该 Anchor 合约托管**。当前网站的下注主流程更接近以下模式：

1. 前端页面直接构造 `SPL Token Transfer` 交易。
2. 用户在钱包内签名，将 `USDT` 发送到平台收款地址。
3. 后端 API 将投注信息写入本地 JSON 数据库。
4. 赛果结算主要依赖后端数据处理与管理钱包派彩，而不是所有投注、赔率、结算都由链上程序单独完成。

因此，若要把本项目“交给智能合约审计”，必须先明确审计范围：

- 若审计对象是 **Anchor 链上程序本身**，可以直接审 `solana-program/`。
- 若审计对象是 **当前网站真实资金流系统**，则必须进行“系统级审计”，范围应覆盖前端送单、后端账本、派彩脚本、钱包密钥管理、预言机节点与链上程序之间的整体联动，而不能只审 `solana-program/`。

## 3. 智能合约与相关审计材料位置

### 3.1 核心智能合约源码

- `solana-program/programs/prophecy_arena/src/lib.rs`

这是当前仓库中最核心的链上程序文件，包含全部 Anchor 指令、账户结构、状态枚举与错误码定义。

### 3.2 Anchor 工程配置

- `solana-program/Anchor.toml`
- `solana-program/Cargo.toml`
- `solana-program/programs/prophecy_arena/Cargo.toml`

这些文件定义了 Anchor 本地集群配置、工作区组织方式与合约依赖版本，属于审计方理解编译环境与程序边界的基础材料。

### 3.3 合约测试

- `solana-program/tests/oracle.ts`

该文件是现有的 Anchor 测试材料，主要覆盖市场创建与预言机解析权限校验，但覆盖范围仍然较窄，尚不足以支撑完整审计前的自证。

### 3.4 预言机与链下解析节点

- `oracle-node/src/index.ts`
- `ORACLE_ARCHITECTURE.md`

这部分不是链上程序本体，但它直接影响赛果上链、结算可信性与权限边界，审计方通常会要求一起审阅。

### 3.5 安全与系统设计文档

- `SECURITY_IMPLEMENTATION_GUIDE.md`
- `src/app/whitepaper/page.tsx`

其中白皮书页面提供了对外高层叙述，安全指南则给出了仓库中已存在的安全目标与拟议控制措施。两者都可作为审计方理解产品宣称与实际实现差距的辅助材料。

## 4. 当前 Anchor 合约实现概览

### 4.1 程序基础信息

- 程序名：`prophecy_arena`
- 语言与框架：`Rust + Anchor`
- Anchor 版本：`anchor-lang = 0.29.0`
- 当前 `Anchor.toml` 中的本地 Program ID：`Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS`

### 4.2 已实现的主要指令

根据 `solana-program/programs/prophecy_arena/src/lib.rs`，程序当前实现了以下主要链上指令：

1. `create_market`
   - 创建比赛市场 `Market PDA`
   - 设置 `authority`、`oracle_authority`、`match_id`、`start_time`
   - 初始化资金池、状态与计数字段

2. `resolve_market`
   - 由市场创建者或 `oracle_authority` 进行赛果解析
   - 要求市场状态仍为 `Open`
   - 要求当前时间不早于比赛开始时间
   - 将结果写入 `market.result` 并将状态置为 `Resolved`

3. `bind_referral`
   - 用户链上绑定推荐人
   - 禁止自我推荐
   - 将绑定关系记录到 `ReferralState PDA`

4. `set_commission_tier`
   - 管理层级设定推荐佣金档位
   - 当前支持 `30% / 50% / 70%` 三档

5. `init_commission`
   - 初始化推荐人佣金账户 `CommissionState PDA`

6. `place_bet`
   - 验证市场开放状态、比赛未开、金额合法、赔率合法
   - 从总下注中切出平台费
   - 依据推荐佣金档位拆出佣金
   - 将净下注资金记入 `Market PDA`
   - 将平台收入转入固定 `treasury`
   - 在冷启动阶段将佣金注入市场池，正常阶段则记入推荐人佣金账户
   - 记录 `Bet PDA`

7. `withdraw_commission`
   - 推荐人从 `CommissionState` 中提取佣金

8. `check_refund`
   - 若比赛开始后投注人数少于 2，则将市场状态置为 `Refundable`

9. `refund_bet`
   - 市场处于 `Refundable` 时，原投注用户可从 `Market PDA` 取回退款

10. `claim_winnings`
   - 赢家根据 `gross_amount * locked_odds / 1e6` 领取奖金
   - 将 `Market PDA` 资金转回用户

### 4.3 合约中的关键经济逻辑

当前合约内定义的主要经济参数包括：

- 冷启动阈值：`500_000 lamports`
- 平台费率：`800 bps = 8%`
- 推荐分成：基于 `commission_tier`，在平台费内部切分
- 成交赔率：通过 `locked_odds` 固化，按 `1e6` 精度缩放

从代码注释和实现看，这套程序尝试实现以下目标：

- 冷启动阶段不要求平台额外垫资，而是通过佣金重路由填补对手盘
- 平台收入、推荐佣金与资金池进行明确拆分
- 用户下注时锁定赔率，避免赛后赔率漂移
- 市场未充分成形时支持退款

## 5. 当前网站真实运行路径

### 5.1 前端下注路径

当前首页下注逻辑位于：

- `src/app/page.tsx`
- `src/app/[locale]/page.tsx`

根据当前实现，前端下注时直接：

1. 计算用户 ATA、Pool ATA、House ATA。
2. 构造 `Transaction`。
3. 添加 `BET` Memo。
4. 发送 `USDT` SPL 转账，而不是调用 Anchor Program 指令。

也就是说，**当前网站下注主流程不是通过 `program.methods.placeBet(...)` 调用链上程序完成的**。

### 5.2 后端投注记账路径

投注记录后端接口位于：

- `src/app/api/bets/route.ts`

该接口当前会：

- 接收前端上送的 `userAddress`、`matchId`、`outcome`、`amount`、`odds`、`signature`
- 将数据写入 `data/bets_db.json`
- 按本地规则更新市场池、赔率、试用金限制与风险控制

这说明当前系统使用了**本地 JSON 数据库作为核心投注账本的一部分**，而不是完全以链上账户状态为单一事实来源。

### 5.3 派彩与退款路径

自动结算与派彩逻辑位于：

- `src/app/api/cron/settle/route.ts`
- `src/app/api/admin/payout/route.ts`

现有实现显示：

- 派彩资金由管理钱包在链下脚本中构造 `SPL transfer`
- 使用管理私钥主动向用户 ATA 转账
- 赢单与退款是否已派彩，仍需要在 `bets_db.json` 中打标记

这意味着**当前网站的派彩控制权主要掌握在管理钱包与后端逻辑中**，而不是完全通过不可篡改的链上结算状态自动完成。

## 6. 链上程序与站点运行架构之间的差异

这是送审前必须明确告知审计方的重点。

### 6.1 资产模型差异

Anchor 程序 `lib.rs` 当前使用的是 `system_program::transfer` 和账户 lamports 逻辑，核心资金操作围绕 `SOL`/lamports 模型展开。

但站点当前前端与后台真实资金流使用的是：

- `USDT Mint`
- `ATA`
- `SPL Token Transfer`

因此，**当前网站的真实资产流与 Anchor 程序的资金模型并不完全一致**。

### 6.2 结算来源差异

Anchor 程序具备 `resolve_market` 与 `claim_winnings`，理论上可在链上完成赛果写入和用户自主领款。

但当前网站实际采用的模式是：

- 后端根据本地市场数据与 JSON DB 判定输赢
- 管理员或定时任务集中派彩

这说明网站现阶段更接近“链上收款 + 链下账本 + 链下派彩”的混合架构。

### 6.3 推荐系统差异

Anchor 程序使用 `ReferralState PDA` 与 `CommissionState PDA` 管理推荐关系和佣金余额。

而站点当前使用：

- `data/referral_db.json`
- 若干 `referral` API 路由

这意味着**推荐关系与佣金状态当前主要还是链下维护**，并未完全迁移到链上 PDA 体系。

### 6.4 预言机路径差异

仓库存在 `oracle-node/src/index.ts` 和 `ORACLE_ARCHITECTURE.md`，说明系统设计上计划由链下预言机将赛果写入链上。

但当前 Oracle Node 代码中仍可见以下特征：

- 使用内嵌 Mock IDL
- 默认 `demo-key`
- 默认 `devnet` RPC 回退
- 测试与运行材料尚偏原型化

因此，预言机模块可作为审计附件，但现阶段更适合作为“设计中或原型级组件”说明，而不是成熟的主网级基础设施。

## 7. 对审计机构应如何定义审计范围

### 7.1 如果审计目标是“链上程序代码安全”

建议送审范围：

- `solana-program/programs/prophecy_arena/src/lib.rs`
- `solana-program/Anchor.toml`
- `solana-program/Cargo.toml`
- `solana-program/programs/prophecy_arena/Cargo.toml`
- `solana-program/tests/oracle.ts`
- `ORACLE_ARCHITECTURE.md`

这类审计重点通常是：

- PDA 派生与权限控制
- 下注、退款、领取奖金逻辑正确性
- 推荐佣金状态一致性
- 赛果解析权限安全
- lamports 转账是否可能造成账户透支、越权提取或双花

### 7.2 如果审计目标是“当前上线网站真实资产系统”

建议送审范围必须扩大为整站系统审计，至少包括：

- `src/app/page.tsx`
- `src/app/[locale]/page.tsx`
- `src/app/api/bets/route.ts`
- `src/app/api/cron/settle/route.ts`
- `src/app/api/admin/payout/route.ts`
- `src/lib/wallets.ts`
- `oracle-node/src/index.ts`
- `data/` 目录下的账本结构样本
- 环境变量与热钱包管理 SOP

因为对于当前站点来说，真正控制资金结果的，不仅是链上程序，还有：

- 前端送单地址与金额换算
- 后端投注记账
- 后端赛果结算
- 管理钱包派彩
- 链下推荐账本

如果只审 Anchor 程序，将无法覆盖当前网站最核心的资金与派彩风险面。

## 8. 送审前高优先级风险提示

### 8.1 审计范围错配风险

这是当前最需要避免的问题。

如果你把 `solana-program/` 单独交给审计机构，而不说明网站目前真实下注与派彩并非完全由该程序执行，那么审计报告只能证明“Anchor 程序源码安全性”，不能证明“网站当前真实运行资金系统安全”。

### 8.2 测试覆盖不足

当前仓库内与合约最直接相关的测试文件主要是 `solana-program/tests/oracle.ts`，覆盖点偏少，尚未系统覆盖：

- `place_bet`
- `refund_bet`
- `claim_winnings`
- `withdraw_commission`
- 边界资金条件
- 恶意账户输入
- 异常时间状态

正式送审前应补齐最小可用测试矩阵，以降低审计沟通成本。

### 8.3 资产模型未统一

合约使用 lamports 资金路径，站点使用 SPL USDT 资金路径，这是目前架构一致性上的关键差异。审计方一定会追问：

- 最终主网上线以哪套模型为准
- 是否计划把合约改成 SPL Token 托管
- 是否保留当前“前端直转 + 后端账本”的运营模式

在送审前，这个问题最好先内部定版。

### 8.4 派彩中心化风险

当前网站派彩依赖：

- 管理钱包
- 后端定时任务
- JSON 数据库标记

这类设计的核心风险包括：

- 派彩一致性依赖链下状态
- 管理钱包私钥泄露风险直接影响资产安全
- 派彩流程存在人工/脚本操作风险

如果项目对外宣称“完全链上、非托管、合约自动结算”，则当前实现与对外叙述之间存在明显差异，需要在送审说明中主动披露。

## 9. 建议的送审材料打包清单

建议你给审计公司的最小材料包如下：

1. `solana-program/` 全目录
2. `oracle-node/` 全目录
3. `ORACLE_ARCHITECTURE.md`
4. `SECURITY_IMPLEMENTATION_GUIDE.md`
5. 本报告 `docs/smart-contract-audit-working-report-2026-05-17.md`
6. 当前站点下注与派彩关键文件：
   - `src/app/page.tsx`
   - `src/app/[locale]/page.tsx`
   - `src/app/api/bets/route.ts`
   - `src/app/api/cron/settle/route.ts`
   - `src/app/api/admin/payout/route.ts`
   - `src/lib/wallets.ts`

同时，建议附上一页额外说明，明确写出以下一句话：

“当前仓库同时包含链上 Anchor 程序与网站现行链下/链上混合资金系统，审计方请分别评估链上程序安全性与网站实际运行资金路径，不应默认当前所有投注与派彩均已完全合约化。”

## 10. 结语

从源码角度看，本项目已经具备可被定义为“智能合约项目”的基础，因为仓库中存在独立的 Solana Anchor 程序、预言机节点与链上状态设计。但从当前网站实际实现看，项目仍处在**链上程序与链下运营系统并行存在**的阶段。

因此，本次送审不应简单表述为“审智能合约”，而应更准确地拆成两部分：

- 一部分是 `prophecy_arena` Anchor 程序的代码安全审计；
- 另一部分是当前网站真实资金路径的系统安全审查。

只有在这两部分都被完整覆盖的前提下，审计结果才真正能对应你当前平台的实际风险面。
