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
    constants::{EXCHANGE_RATE_PRECISION, SHARE_DENOMINATOR},
    error::ErrorCode,
    CommitEvent, Reward, State, Vault, REWARD_SEED, STATE_SEED, VAULT_SEED,
};

#[cfg(not(feature = "local"))]
use crate::read_exchange_rate;

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

    #[account(mut, constraint = vault.load()?.f_mint == f_token_mint.key() @ ErrorCode::InvalidMint)]
    pub f_token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = vrf_authority,
        space = Reward::LEN,
        seeds = [REWARD_SEED, vault.key().as_ref(), &round.to_le_bytes()],
        bump,
    )]
    pub reward: AccountLoader<'info, Reward>,

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
}

pub fn handler(
    ctx: Context<Commit>,
    _vault_index: u32,
    round: u32,
    reward_type: u8,
    tickets: u64,
    merkle_root: [u8; 32],
    secret_hash: [u8; 32],
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let reward_amount = {
        let state = ctx.accounts.state.load()?;
        let mut reward = ctx.accounts.reward.load_init()?;
        let mut vault = ctx.accounts.vault.load_mut()?;

        require!(
            ctx.accounts.vrf_authority.key() == state.vrf_authority,
            ErrorCode::Unauthorized
        );

        let distribution_tier_index = reward_type as usize;
        require!(
            distribution_tier_index < vault.distribution_tiers.len(),
            ErrorCode::InvalidRewardType
        );

        // Compute reward amount + tier side effects for this reward_type index.
        let (reward_amount, current_rate) = {
            // Validate round matches expected for this commit
            require!(round == vault.current_round, ErrorCode::InvalidRound);

            // All reward types compute yield and spread across configured tiers.
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

            let tiers_len = vault.distribution_tiers.len();
            let mut remaining_yield = yield_amount;
            let mut reward_amount = 0u64;

            for (index, tier) in vault.distribution_tiers.iter_mut().enumerate() {
                let tier_share = if index + 1 == tiers_len {
                    // Assign rounding remainder to the last tier.
                    remaining_yield
                } else {
                    (yield_amount as u128)
                        .checked_mul(tier.reward_share as u128)
                        .ok_or(ErrorCode::Overflow)?
                        .checked_div(SHARE_DENOMINATOR as u128)
                        .ok_or(ErrorCode::Overflow)? as u64
                };

                remaining_yield = remaining_yield
                    .checked_sub(tier_share)
                    .ok_or(ErrorCode::Overflow)?;

                if index == distribution_tier_index {
                    reward_amount = tier
                        .accumulated
                        .checked_add(tier_share)
                        .ok_or(ErrorCode::Overflow)?;
                    tier.accumulated = 0;
                    tier.distributed_at = now;
                } else {
                    tier.accumulated = tier
                        .accumulated
                        .checked_add(tier_share)
                        .ok_or(ErrorCode::Overflow)?;
                }
            }

            (reward_amount, current_rate)
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

        reward_amount
    };

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
