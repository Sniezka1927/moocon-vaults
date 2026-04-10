use anchor_lang::prelude::{program_option::COption, *};
use anchor_spl::token_interface::Mint;

use crate::{error::ErrorCode, State, Vault, FEE_DENOMINATOR, STATE_SEED, VAULT_SEED};

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
    pub p_mint: InterfaceAccount<'info, Mint>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeVault>, min_deposit: u64, withdraw_fee: u64) -> Result<()> {
    let mut vault = ctx.accounts.vault.load_init()?;

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

    require!(withdraw_fee <= FEE_DENOMINATOR, ErrorCode::InvalidFee);

    vault.mint = ctx.accounts.mint.key();
    vault.lending = ctx.accounts.lending.key();
    vault.p_mint = ctx.accounts.p_mint.key();

    vault.min_deposit = min_deposit;
    vault.accumulated_fee = 0;
    vault.withdraw_fee = withdraw_fee;

    vault.last_rate = 0;
    vault.daily_jackpot_accumulated = 0;
    vault.weekly_jackpot_accumulated = 0;

    vault.last_daily_ts = Clock::get()?.unix_timestamp;
    vault.last_weekly_ts = Clock::get()?.unix_timestamp;

    vault.current_round = 0;
    vault.bump = ctx.bumps.vault;

    ctx.accounts.state.load_mut()?.last_vault += 1;
    Ok(())
}
