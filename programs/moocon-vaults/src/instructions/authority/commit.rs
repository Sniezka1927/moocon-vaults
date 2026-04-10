use std::u64;

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::Token,
    token_interface::{Mint, TokenAccount},
};
use orao_solana_vrf::cpi::accounts::RequestV2;
use orao_solana_vrf::program::OraoVrf;
use orao_solana_vrf::state::NetworkState;

use crate::{
    constants::{
        DAILY_JACKPOT_SHARE, EXCHANGE_RATE_PRECISION, REWARD_TYPE_DAILY, REWARD_TYPE_ROUND,
        REWARD_TYPE_WEEKLY, SHARE_DENOMINATOR, WEEKLY_JACKPOT_SHARE,
    },
    error::ErrorCode,
    CommitEvent, Reward, State, Vault, JUPITER_LENDING_PROGRAM_ID, REWARD_SEED, STATE_SEED,
    VAULT_SEED,
};

#[cfg(not(feature = "local"))]
use crate::{read_exchange_rate, WithdrawParams};

#[derive(Accounts)]
#[instruction(vault_index: u32, round: u32)]
pub struct Commit<'info> {
    #[account(mut)]
    pub vrf_authority: Signer<'info>,

    #[account(
        seeds = [STATE_SEED],
        bump = state.load()?.bump,
        has_one = vrf_authority @ ErrorCode::Unauthorized,
    )]
    pub state: AccountLoader<'info, State>,

    #[account(
        mut,
        seeds = [VAULT_SEED, &vault_index.to_le_bytes()],
        bump = vault.load()?.bump,
    )]
    pub vault: AccountLoader<'info, Vault>,

    /// CHECK: Jupiter Lending account — read manually for exchange rate
    #[account(mut, constraint = lending.key() == vault.load()?.lending @ ErrorCode::InvalidLendingAccount)]
    pub lending: AccountInfo<'info>,

    #[account(constraint = mint.key() == vault.load()?.mint @ ErrorCode::InvalidMint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// Vault's fToken account — read balance + burn fTokens during withdraw CPI
    #[account(
        mut,
        token::authority = vault.key(),
        token::mint = f_token_mint.key(),
    )]
    pub vault_f_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Vault's token account — receives redeemed tokens from lending
    #[account(mut, token::mint = mint.key(), token::authority = vault.key())]
    pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = vrf_authority,
        space = Reward::LEN,
        seeds = [REWARD_SEED, vault.key().as_ref(), &round.to_le_bytes()],
        bump,
    )]
    pub reward: AccountLoader<'info, Reward>,

    // Lending CPI accounts (validated by lending program via CPI)
    /// CHECK: Lending admin — validated by lending program via CPI
    pub lending_admin: AccountInfo<'info>,
    /// CHECK: fToken mint — validated by lending program via CPI
    #[account(mut)]
    pub f_token_mint: AccountInfo<'info>,
    /// CHECK: Liquidity protocol account — validated by lending program via CPI
    #[account(mut)]
    pub supply_token_reserves_liquidity: AccountInfo<'info>,
    /// CHECK: Liquidity protocol account — validated by lending program via CPI
    #[account(mut)]
    pub lending_supply_position_on_liquidity: AccountInfo<'info>,
    /// CHECK: Rate model — validated by lending program via CPI
    pub rate_model: AccountInfo<'info>,
    /// CHECK: Liquidity vault — validated by lending program via CPI
    #[account(mut)]
    pub liquidity_vault: AccountInfo<'info>,
    /// CHECK: Claim account — validated by lending program via CPI
    #[account(mut)]
    pub claim_account: AccountInfo<'info>,
    /// CHECK: Liquidity account — validated by lending program via CPI
    #[account(mut)]
    pub liquidity: AccountInfo<'info>,
    /// CHECK: Liquidity program — validated by lending program via CPI
    #[account(mut)]
    pub liquidity_program: AccountInfo<'info>,
    /// CHECK: Rewards rate model — validated by lending program via CPI
    pub rewards_rate_model: AccountInfo<'info>,

    // Orao VRF accounts
    /// CHECK: Orao treasury — validated by the Orao program via CPI
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    #[account(mut)]
    pub network_state: Box<Account<'info, NetworkState>>,
    /// CHECK: Orao randomness PDA — created and validated by the Orao program
    #[account(mut)]
    pub request: AccountInfo<'info>,
    pub vrf: Program<'info, OraoVrf>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

    /// CHECK: Jupiter lending program — target of CPI
    #[account(constraint = lending_program.key() == JUPITER_LENDING_PROGRAM_ID @ ErrorCode::InvalidLendingProgram)]
    pub lending_program: UncheckedAccount<'info>,
}

pub fn handler(
    ctx: Context<Commit>,
    vault_index: u32,
    round: u32,
    reward_type: u8,
    tickets: u64,
    merkle_root: [u8; 32],
    secret_hash: [u8; 32],
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let (reward_amount, vault_bump) = {
        let state = ctx.accounts.state.load()?;
        let mut reward = ctx.accounts.reward.load_init()?;
        let mut vault = ctx.accounts.vault.load_mut()?;

        require!(
            ctx.accounts.vrf_authority.key() == state.vrf_authority,
            ErrorCode::Unauthorized
        );

        require!(reward_type <= 2, ErrorCode::InvalidRewardType);

        // Compute reward amount + side effects depending on reward_type.
        let (reward_amount, current_rate, daily_share, weekly_share) = {
            // Validate round matches expected for this reward_type
            require!(round == vault.current_round, ErrorCode::InvalidRound);

            // All reward types compute yield and split 60/20/20
            require!(vault.last_rate > 0, ErrorCode::NotSynced);

            #[cfg(not(feature = "local"))]
            let current_rate = read_exchange_rate(&ctx.accounts.lending)?;

            #[cfg(feature = "local")]
            let current_rate = vault
                .last_rate
                .checked_add(1000)
                .ok_or(ErrorCode::Overflow)?;

            let rate_delta = current_rate
                .checked_sub(vault.last_rate)
                .ok_or(ErrorCode::Overflow)?;

            let f_token_balance = ctx.accounts.vault_f_token_account.amount;
            msg!(
                "fToken balance: {}, rate delta: {}",
                f_token_balance,
                rate_delta
            );
            let yield_amount = (f_token_balance as u128)
                .checked_mul(rate_delta as u128)
                .ok_or(ErrorCode::Overflow)?
                .checked_div(EXCHANGE_RATE_PRECISION as u128)
                .ok_or(ErrorCode::Overflow)? as u64;

            let daily_share = yield_amount
                .checked_mul(DAILY_JACKPOT_SHARE)
                .ok_or(ErrorCode::Overflow)?
                .checked_div(SHARE_DENOMINATOR)
                .ok_or(ErrorCode::Overflow)?;
            let weekly_share = yield_amount
                .checked_mul(WEEKLY_JACKPOT_SHARE)
                .ok_or(ErrorCode::Overflow)?
                .checked_div(SHARE_DENOMINATOR)
                .ok_or(ErrorCode::Overflow)?;
            let winner_share = yield_amount
                .checked_sub(daily_share)
                .ok_or(ErrorCode::Overflow)?
                .checked_sub(weekly_share)
                .ok_or(ErrorCode::Overflow)?;

            // For round: reward = winner_share
            // For daily/weekly: reward = accumulated jackpot + winner_share
            let accumulated = match reward_type {
                REWARD_TYPE_ROUND => 0,
                REWARD_TYPE_DAILY => vault.daily_jackpot_accumulated,
                REWARD_TYPE_WEEKLY => vault.weekly_jackpot_accumulated,
                _ => unreachable!(),
            };

            let reward_amount = accumulated
                .checked_add(winner_share)
                .ok_or(ErrorCode::Overflow)?;

            (reward_amount, current_rate, daily_share, weekly_share)
        };

        // Init reward
        reward.claimer = Pubkey::default();
        reward.vault = ctx.accounts.vault.key();
        reward.amount = reward_amount;
        reward.total_tickets = tickets;
        reward.winner_index = u64::MAX;
        reward.round = round;
        reward.reward_type = reward_type;
        reward.bump = ctx.bumps.reward;

        // Update vault
        vault.last_rate = current_rate;
        vault.current_round = vault
            .current_round
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        match reward_type {
            REWARD_TYPE_ROUND => {
                vault.daily_jackpot_accumulated = vault
                    .daily_jackpot_accumulated
                    .checked_add(daily_share)
                    .ok_or(ErrorCode::Overflow)?;
                vault.weekly_jackpot_accumulated = vault
                    .weekly_jackpot_accumulated
                    .checked_add(weekly_share)
                    .ok_or(ErrorCode::Overflow)?;
            }
            REWARD_TYPE_DAILY => {
                vault.last_daily_ts = now;
                vault.daily_jackpot_accumulated = 0;
                vault.weekly_jackpot_accumulated = vault
                    .weekly_jackpot_accumulated
                    .checked_add(weekly_share)
                    .ok_or(ErrorCode::Overflow)?;
            }
            REWARD_TYPE_WEEKLY => {
                vault.last_weekly_ts = now;
                vault.weekly_jackpot_accumulated = 0;
                vault.daily_jackpot_accumulated = vault
                    .daily_jackpot_accumulated
                    .checked_add(daily_share)
                    .ok_or(ErrorCode::Overflow)?;
            }
            _ => unreachable!(),
        };

        (reward_amount, vault.bump)
    };

    // Withdraw reward_amount from lending to lock in real tokens
    #[cfg(not(feature = "local"))]
    if reward_amount > 0 {
        let vault_index_bytes = vault_index.to_le_bytes();
        let seeds: &[&[u8]] = &[VAULT_SEED, &vault_index_bytes, &[vault_bump]];

        let params = WithdrawParams {
            signer: ctx.accounts.vault.to_account_info(),
            owner_token_account: ctx.accounts.vault_f_token_account.to_account_info(),
            recipient_token_account: ctx.accounts.vault_token_account.to_account_info(),
            lending_admin: ctx.accounts.lending_admin.to_account_info(),
            lending: ctx.accounts.lending.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            f_token_mint: ctx.accounts.f_token_mint.to_account_info(),
            supply_token_reserves_liquidity: ctx
                .accounts
                .supply_token_reserves_liquidity
                .to_account_info(),
            lending_supply_position_on_liquidity: ctx
                .accounts
                .lending_supply_position_on_liquidity
                .to_account_info(),
            rate_model: ctx.accounts.rate_model.to_account_info(),
            vault: ctx.accounts.liquidity_vault.to_account_info(),
            claim_account: ctx.accounts.claim_account.to_account_info(),
            liquidity: ctx.accounts.liquidity.to_account_info(),
            liquidity_program: ctx.accounts.liquidity_program.to_account_info(),
            rewards_rate_model: ctx.accounts.rewards_rate_model.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            lending_program: ctx.accounts.lending_program.clone(),
        };
        params.withdraw_signed(reward_amount, &[seeds])?;
    }

    // Compute VRF seed: merkle_root XOR secret_hash
    let mut vrf_seed = [0u8; 32];
    for i in 0..32 {
        vrf_seed[i] = merkle_root[i] ^ secret_hash[i];
    }

    // Request VRF randomness
    let cpi_accounts = RequestV2 {
        payer: ctx.accounts.vrf_authority.to_account_info(),
        network_state: ctx.accounts.network_state.to_account_info(),
        treasury: ctx.accounts.treasury.to_account_info(),
        request: ctx.accounts.request.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.vrf.to_account_info(), cpi_accounts);
    orao_solana_vrf::cpi::request_v2(cpi_ctx, vrf_seed)?;

    emit!(CommitEvent {
        vault: ctx.accounts.vault.key(),
        round,
        amount: reward_amount,
        merkle_root,
        secret_hash,
        vrf_seed
    });
    Ok(())
}
