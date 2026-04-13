use anchor_lang::prelude::{program_option::COption, *};
use anchor_spl::token_interface::Mint;

use crate::{
    error::ErrorCode, DistributionTier, State, Vault, PERCENTAGE_DENOMINATOR, STATE_SEED,
    VAULT_SEED,
};

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [STATE_SEED],
        bump = state.load()?.bump,
        has_one = admin @ ErrorCode::Unauthorized,
    )]
    pub state: AccountLoader<'info, State>,
    #[account(
        init,
        payer = admin,
        space = Vault::LEN,
        seeds = [VAULT_SEED, &state.load()?.last_vault.to_le_bytes()],
        bump,
    )]
    pub vault: AccountLoader<'info, Vault>,

    /// CHECK: Jupiter Lending account — read manually for exchange rate
    pub lending: AccountInfo<'info>,

    pub mint: InterfaceAccount<'info, Mint>,
    pub f_mint: InterfaceAccount<'info, Mint>,
    pub p_mint: InterfaceAccount<'info, Mint>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeVault>,
    min_deposit: u64,
    withdraw_fee: u64,
    mut tiers: [DistributionTier; 2],
) -> Result<()> {
    let mut vault = ctx.accounts.vault.load_init()?;
    let now = Clock::get()?.unix_timestamp;
    let mut sum_share = 0u64;
    for i in 0..tiers.len() {
        tiers[i].distributed_at = now;
        tiers[i].accumulated = 0;
        sum_share += tiers[i].reward_share
    }

    // Validate that p_mint mint authoritiy is vault PDA
    require!(
        ctx.accounts.p_mint.mint_authority == COption::Some(ctx.accounts.vault.key()),
        ErrorCode::InvalidPMint
    );

    require!(
        ctx.accounts.p_mint.decimals == ctx.accounts.mint.decimals,
        ErrorCode::MismatchedDecimals
    );

    require!(
        ctx.accounts.p_mint.to_account_info().owner.key() == anchor_spl::token::ID,
        ErrorCode::InvalidPMint
    );

    require!(
        withdraw_fee <= PERCENTAGE_DENOMINATOR,
        ErrorCode::InvalidFee
    );

    require!(
        sum_share == PERCENTAGE_DENOMINATOR,
        ErrorCode::InvalidVaultShare
    );

    vault.mint = ctx.accounts.mint.key();
    vault.f_mint = ctx.accounts.f_mint.key();
    vault.p_mint = ctx.accounts.p_mint.key();
    vault.lending = ctx.accounts.lending.key();

    vault.min_deposit = min_deposit;
    vault.accumulated_fee = 0;
    vault.withdraw_fee = withdraw_fee;

    vault.last_rate = 0;
    vault.distribution_tiers = tiers;

    vault.current_round = 0;
    vault.bump = ctx.bumps.vault;

    ctx.accounts.state.load_mut()?.last_vault += 1;
    Ok(())
}
