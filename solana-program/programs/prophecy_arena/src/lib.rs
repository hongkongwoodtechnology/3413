// V7.1 Fee-Funded Opponent Pool — Solana Smart Contract
// 配合 TypeScript odds-engine 冷啟動方案
// 冷啟動期 (pool_total < COLD_START_LAMPORTS):
//   佣金注入 Market PDA 而非 Referrer PDA → 建立對手盤
// 正常期 (pool_total ≥ COLD_START_LAMPORTS):
//   佣金正常支付給推薦人

use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

const COLD_START_LAMPORTS: u64 = 500_000;  // $0.50 USDT (6 decimals)
const PLATFORM_FEE_BPS: u64 = 800;         // 8% = 800 basis points

#[program]
pub mod prophecy_arena {
    use super::*;

    // --- MARKET FUNCTIONS ---

    pub fn create_market(
        ctx: Context<CreateMarket>,
        match_id: u64,
        start_time: i64,
        oracle_authority: Option<Pubkey>
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.oracle_authority = oracle_authority.unwrap_or(ctx.accounts.authority.key());
        market.match_id = match_id;
        market.start_time = start_time;
        market.status = MarketStatus::Open;
        market.pool_home = 0;
        market.pool_draw = 0;
        market.pool_away = 0;
        market.pool_total = 0;
        market.bettor_count = 0;
        market.bump = *ctx.bumps.get("market").unwrap();
        Ok(())
    }

    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        result: Outcome
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(
            ctx.accounts.authority.key() == market.authority ||
            ctx.accounts.authority.key() == market.oracle_authority,
            CustomError::UnauthorizedOracle
        );
        require!(market.status == MarketStatus::Open, CustomError::MarketAlreadyResolved);
        require!(Clock::get()?.unix_timestamp >= market.start_time, CustomError::MatchNotFinished);
        market.result = Some(result);
        market.status = MarketStatus::Resolved;
        msg!("Market {} resolved by oracle: {:?}", market.match_id, result);
        Ok(())
    }

    // --- REFERRAL FUNCTIONS ---

    pub fn bind_referral(
        ctx: Context<BindReferral>,
        referrer: Pubkey
    ) -> Result<()> {
        let user = &ctx.accounts.user;
        let referral_state = &mut ctx.accounts.referral_state;
        require!(user.key() != referrer, CustomError::CannotReferSelf);
        referral_state.user = user.key();
        referral_state.referrer = referrer;
        referral_state.bound_at = Clock::get()?.unix_timestamp;
        referral_state.bump = *ctx.bumps.get("referral_state").unwrap();
        referral_state.commission_tier = 0; // 0 = 30% tier
        msg!("Referral Bound: User {} -> Referrer {} (tier: 30%)", user.key(), referrer);
        Ok(())
    }

    /// Admin sets commission tier for a referrer
    /// tier: 0 = 30%, 1 = 50%, 2 = 70%
    pub fn set_commission_tier(
        ctx: Context<SetCommissionTier>,
        tier: u8
    ) -> Result<()> {
        require!(tier <= 2, CustomError::InvalidCommissionTier);
        let referral_state = &mut ctx.accounts.referral_state;
        referral_state.commission_tier = tier;
        let pct = match tier { 0 => 30, 1 => 50, _ => 70 };
        msg!("Commission tier set to {}% for referrer {}", pct, referral_state.referrer);
        Ok(())
    }

    pub fn init_commission(ctx: Context<InitCommission>) -> Result<()> {
        let commission_state = &mut ctx.accounts.commission_state;
        commission_state.referrer = ctx.accounts.referrer.key();
        commission_state.amount = 0;
        commission_state.bump = *ctx.bumps.get("commission_state").unwrap();
        Ok(())
    }

    // --- BETTING FUNCTIONS ---

    /// Place a bet with locked odds (V7.1 Fee-Funded Opponent Pool)
    ///
    /// locked_odds: scaled by 1e6 (1.0000 → 1_000_000, 2.0400 → 2_040_000)
    /// Commission routing:
    ///   pool_total < COLD_START_LAMPORTS → commission → Market PDA (opponent pool)
    ///   pool_total ≥ COLD_START_LAMPORTS → commission → Referrer PDA (normal)
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        outcome: Outcome,
        amount: u64,
        locked_odds: u64
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let bet = &mut ctx.accounts.bet;
        let user = &ctx.accounts.user;
        let system_program = &ctx.accounts.system_program;

        // Validation
        require!(market.status == MarketStatus::Open, CustomError::MarketClosed);
        require!(Clock::get()?.unix_timestamp < market.start_time, CustomError::MatchStarted);
        require!(amount > 0, CustomError::InvalidAmount);
        require!(locked_odds >= 1_000_000, CustomError::InvalidOdds);

        let expected_treasury = "2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K"
            .parse::<Pubkey>().unwrap();
        require!(ctx.accounts.treasury.key() == expected_treasury, CustomError::InvalidTreasury);

        // --- FEE SPLIT (8%) ---
        let fee = amount
            .checked_mul(PLATFORM_FEE_BPS)
            .unwrap()
            .checked_div(10_000)
            .unwrap();

        // Commission percentage based on referrer tier
        let commission_pct: u64 = if let Some(ref referral_state) = ctx.accounts.referral_state {
            match referral_state.commission_tier {
                0 => 30,   // 30% of 8% = 2.4% of bet
                1 => 50,   // 50% of 8% = 4.0% of bet
                _ => 70,   // 70% of 8% = 5.6% of bet
            }
        } else {
            0
        };

        let commission = fee
            .checked_mul(commission_pct)
            .unwrap()
            .checked_div(100)
            .unwrap();
        let protocol_revenue = fee.checked_sub(commission).unwrap();
        let net_to_pool = amount.checked_sub(fee).unwrap();

        // --- COLD-START CHECK ---
        let new_pool_total = market
            .pool_total
            .checked_add(net_to_pool)
            .unwrap();
        let is_cold_start = new_pool_total < COLD_START_LAMPORTS;

        // --- TRANSFERS ---

        // 1. Net bet amount → Market PDA (always)
        let cpi_to_market = CpiContext::new(
            system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: user.to_account_info(),
                to: market.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_to_market, net_to_pool)?;

        // 2. Protocol Revenue → Treasury (always)
        let cpi_to_treasury = CpiContext::new(
            system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: user.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_to_treasury, protocol_revenue)?;

        // 3. Commission routing — depends on cold-start phase
        if commission > 0 {
            if is_cold_start {
                // V7.1 COLD-START: Commission → Market PDA (builds opponent pool)
                let cpi_commission_to_market = CpiContext::new(
                    system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: user.to_account_info(),
                        to: market.to_account_info(),
                    },
                );
                anchor_lang::system_program::transfer(cpi_commission_to_market, commission)?;
                msg!("Cold-start: Commission {} routed to market PDA (opponent pool)", commission);
            } else if let Some(referrer_commission) = &mut ctx.accounts.referrer_commission {
                if let Some(ref referral_state) = ctx.accounts.referral_state {
                    if referral_state.referrer == referrer_commission.referrer {
                        // NORMAL: Commission → Referrer PDA
                        let cpi_to_commission = CpiContext::new(
                            system_program.to_account_info(),
                            anchor_lang::system_program::Transfer {
                                from: user.to_account_info(),
                                to: referrer_commission.to_account_info(),
                            },
                        );
                        anchor_lang::system_program::transfer(cpi_to_commission, commission)?;
                        referrer_commission.amount += commission;
                        msg!("Commission: {} to referrer (tier {})", commission, referral_state.commission_tier);
                    }
                }
            }
        }

        // --- UPDATE POOLS ---
        // pool_home/draw/away track only net user funds (not commission injection)
        // pool_total tracks everything (net + cold-start commission)
        match outcome {
            Outcome::Home => market.pool_home += net_to_pool,
            Outcome::Draw => market.pool_draw += net_to_pool,
            Outcome::Away => market.pool_away += net_to_pool,
        }
        market.pool_total = new_pool_total;
        market.bettor_count += 1;

        // --- RECORD BET ---
        bet.user = user.key();
        bet.market = market.key();
        bet.outcome = outcome;
        bet.amount = net_to_pool;
        bet.gross_amount = amount;
        bet.locked_odds = locked_odds;
        bet.claimed = false;
        bet.status = BetStatus::Active;
        bet.bump = *ctx.bumps.get("bet").unwrap();

        if is_cold_start {
            msg!("Cold-start bet placed. Pool total: {} < {}",
                new_pool_total, COLD_START_LAMPORTS);
        }

        Ok(())
    }

    // --- WITHDRAW FUNCTIONS ---

    pub fn withdraw_commission(ctx: Context<WithdrawCommission>, amount: u64) -> Result<()> {
        let commission_state = &mut ctx.accounts.commission_state;
        let referrer = &ctx.accounts.referrer;
        require!(commission_state.referrer == referrer.key(), CustomError::Unauthorized);
        require!(commission_state.amount >= amount, CustomError::InsufficientFunds);
        **commission_state.to_account_info().try_borrow_mut_lamports()? -= amount;
        **referrer.to_account_info().try_borrow_mut_lamports()? += amount;
        commission_state.amount -= amount;
        msg!("Commission Withdrawn: {} by {}", amount, referrer.key());
        Ok(())
    }

    // --- REFUND MECHANISM ---

    pub fn check_refund(ctx: Context<CheckRefund>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Open, CustomError::MarketAlreadyResolved);
        require!(Clock::get()?.unix_timestamp >= market.start_time, CustomError::CutoffTimeNotReached);
        if market.bettor_count < 2 {
            market.status = MarketStatus::Refundable;
            msg!("Market {} set to Refundable. Bettor count: {}", market.match_id, market.bettor_count);
        }
        Ok(())
    }

    pub fn refund_bet(ctx: Context<RefundBet>) -> Result<()> {
        let market = &ctx.accounts.market;
        let bet = &mut ctx.accounts.bet;
        let user = &mut ctx.accounts.user;
        let system_program = &ctx.accounts.system_program;
        require!(market.status == MarketStatus::Refundable, CustomError::MarketNotRefundable);
        require!(bet.user == user.key(), CustomError::Unauthorized);
        require!(bet.status == BetStatus::Active, CustomError::BetNotActive);

        let refund_amount = bet.amount;

        let market_seeds = &[
            b"market",
            &market.match_id.to_le_bytes(),
            &[market.bump],
        ];
        let signer = &[&market_seeds[..]];

        let cpi_to_user = CpiContext::new_with_signer(
            system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: market.to_account_info(),
                to: user.to_account_info(),
            },
            signer,
        );
        anchor_lang::system_program::transfer(cpi_to_user, refund_amount)?;

        bet.status = BetStatus::Refunded;
        msg!("Refunded {} lamports to {}", refund_amount, user.key());
        Ok(())
    }

    // --- CLAIM WINNINGS ---

    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let bet = &mut ctx.accounts.bet;
        let user = &ctx.accounts.user;

        require!(market.status == MarketStatus::Resolved, CustomError::MarketNotResolved);
        require!(!bet.claimed, CustomError::AlreadyClaimed);
        require!(bet.user == user.key(), CustomError::Unauthorized);

        let winning_outcome = market.result.as_ref().ok_or(CustomError::MarketNotResolved)?;
        require!(bet.outcome == *winning_outcome, CustomError::DidNotWin);

        // V7.1: Use gross_amount for payout calculation (odds are on gross amount)
        // payout = gross_amount × (locked_odds / 1e6)
        let payout = (bet.gross_amount as u128)
            .checked_mul(bet.locked_odds as u128)
            .unwrap()
            .checked_div(1_000_000)
            .unwrap() as u64;

        // Deduct from market PDA
        **market.to_account_info().try_borrow_mut_lamports()? -= payout;
        **user.to_account_info().try_borrow_mut_lamports()? += payout;

        bet.claimed = true;

        msg!("Winnings claimed: {} lamports (gross={}, odds={})",
            payout, bet.gross_amount, bet.locked_odds);
        Ok(())
    }
}

// ============================================================
// ACCOUNTS
// ============================================================

#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct CreateMarket<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 8 + 1 + 2 + 8 + 8 + 8 + 8 + 1 + 8,
        seeds = [b"market", match_id.to_le_bytes().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BindReferral<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 8 + 1 + 1,
        seeds = [b"referral", user.key().as_ref()],
        bump
    )]
    pub referral_state: Account<'info, ReferralState>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetCommissionTier<'info> {
    #[account(
        mut,
        seeds = [b"referral", referral_state.user.as_ref()],
        bump = referral_state.bump
    )]
    pub referral_state: Account<'info, ReferralState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitCommission<'info> {
    #[account(
        init,
        payer = referrer,
        space = 8 + 32 + 8 + 1,
        seeds = [b"commission", referrer.key().as_ref()],
        bump
    )]
    pub commission_state: Account<'info, CommissionState>,
    #[account(mut)]
    pub referrer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(outcome: Outcome, amount: u64, locked_odds: u64)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 1 + 1 + 1,
        seeds = [b"bet", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub bet: Account<'info, Bet>,
    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: Treasury address (2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K)
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    #[account(
        seeds = [b"referral", user.key().as_ref()],
        bump,
    )]
    pub referral_state: Option<Account<'info, ReferralState>>,

    #[account(
        mut,
        seeds = [b"commission", referral_state.as_ref().unwrap().referrer.as_ref()],
        bump,
    )]
    pub referrer_commission: Option<Account<'info, CommissionState>>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawCommission<'info> {
    #[account(
        mut,
        seeds = [b"commission", referrer.key().as_ref()],
        bump = commission_state.bump
    )]
    pub commission_state: Account<'info, CommissionState>,
    #[account(mut)]
    pub referrer: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        seeds = [b"bet", market.key().as_ref(), user.key().as_ref()],
        bump = bet.bump
    )]
    pub bet: Account<'info, Bet>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct CheckRefund<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct RefundBet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        seeds = [b"bet", market.key().as_ref(), user.key().as_ref()],
        bump = bet.bump
    )]
    pub bet: Account<'info, Bet>,
    pub system_program: Program<'info, System>,
}

// ============================================================
// STATE
// ============================================================

#[account]
pub struct Market {
    pub authority: Pubkey,
    pub oracle_authority: Pubkey,
    pub match_id: u64,
    pub start_time: i64,
    pub status: MarketStatus,
    pub result: Option<Outcome>,
    pub pool_home: u64,       // net user funds on HOME
    pub pool_draw: u64,       // net user funds on DRAW
    pub pool_away: u64,       // net user funds on AWAY
    pub pool_total: u64,      // V7.1: accumulated total (net + cold-start commission)
    pub bump: u8,
    pub bettor_count: u64,
}

#[account]
pub struct Bet {
    pub user: Pubkey,
    pub market: Pubkey,
    pub outcome: Outcome,
    pub amount: u64,          // net amount into pool (after fee)
    pub gross_amount: u64,    // V7.1: gross bet amount (before fee)
    pub locked_odds: u64,     // V7.1: odds locked at bet time (scaled ×1e6)
    pub claimed: bool,
    pub bump: u8,
    pub status: BetStatus,
}

#[account]
pub struct ReferralState {
    pub user: Pubkey,
    pub referrer: Pubkey,
    pub bound_at: i64,
    pub bump: u8,
    pub commission_tier: u8,  // 0=30%, 1=50%, 2=70%
}

#[account]
pub struct CommissionState {
    pub referrer: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

// ============================================================
// ENUMS
// ============================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MarketStatus {
    Open,
    Resolved,
    PaidOut,
    Refundable,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum BetStatus {
    Active,
    Refunded,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    Home,
    Draw,
    Away,
}

// ============================================================
// ERRORS
// ============================================================

#[error_code]
pub enum CustomError {
    #[msg("Market is closed for betting.")]
    MarketClosed,
    #[msg("Match has already started.")]
    MatchStarted,
    #[msg("Bet amount must be greater than 0.")]
    InvalidAmount,
    #[msg("Market has already been resolved.")]
    MarketAlreadyResolved,
    #[msg("Market has not been resolved yet.")]
    MarketNotResolved,
    #[msg("Winnings have already been claimed.")]
    AlreadyClaimed,
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,
    #[msg("You did not win this bet.")]
    DidNotWin,
    #[msg("No winners in the pool.")]
    NoWinners,
    #[msg("Cannot refer yourself.")]
    CannotReferSelf,
    #[msg("Insufficient funds in commission account.")]
    InsufficientFunds,
    #[msg("Cutoff time not reached yet.")]
    CutoffTimeNotReached,
    #[msg("Market is not refundable.")]
    MarketNotRefundable,
    #[msg("Bet is not active.")]
    BetNotActive,
    #[msg("Unauthorized oracle signer.")]
    UnauthorizedOracle,
    #[msg("Match has not finished yet.")]
    MatchNotFinished,
    #[msg("Invalid treasury address provided.")]
    InvalidTreasury,
    #[msg("Invalid commission tier. Must be 0 (30%), 1 (50%), or 2 (70%).")]
    InvalidCommissionTier,
    #[msg("Invalid odds value.")]
    InvalidOdds,
    #[msg("Position limit reached for this outcome.")]
    PositionLimitReached,
}
