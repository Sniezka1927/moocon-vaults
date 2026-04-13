use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::Token,
    token_interface::{burn, transfer_checked, Burn, Mint, TokenAccount, TransferChecked},
};

use crate::{
    error::ErrorCode, Vault, JUPITER_LENDING_PROGRAM_ID, PERCENTAGE_DENOMINATOR, VAULT_SEED,
};

#[cfg(not(feature = "local"))]
use crate::WithdrawParams;

#[derive(Accounts)]
#[instruction(vault_index: u32)]
pub struct Withdraw<'info> {
    pub withdrawer: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, &vault_index.to_le_bytes()],
        bump = premium_vault.load()?.bump,
    )]
    pub premium_vault: AccountLoader<'info, Vault>,

    // CPI accounts
    #[account(mut, token::mint = f_token_mint.key(), token::authority = premium_vault.key())]
    pub vault_f_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = mint.key(), token::authority = premium_vault.key())]
    pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = mint.key(), token::authority = withdrawer.key())]
    pub withdrawer_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(constraint = premium_vault.load()?.mint == mint.key() @ ErrorCode::InvalidMint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut, constraint = premium_vault.load()?.p_mint == p_mint.key() @ ErrorCode::InvalidPMint)]
    pub p_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, token::mint = p_mint.key(), token::authority = withdrawer.key())]
    pub withdrawer_p_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: Lending admin — validated by lending program via CPI
    pub lending_admin: AccountInfo<'info>,
    /// CHECK: Lending account — validated by lending program via CPI
    #[account(mut)]
    pub lending: AccountInfo<'info>,
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
    pub vault: AccountInfo<'info>,
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

    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,

    /// CHECK: Jupiter lending program — target of CPI
    #[account(constraint = lending_program.key() == JUPITER_LENDING_PROGRAM_ID @ ErrorCode::InvalidLendingProgram)]
    pub lending_program: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<Withdraw>, vault_index: u32, mut amount: u64) -> Result<()> {
    require!(amount != 0, ErrorCode::ZeroAmount);

    let vault_index_bytes = vault_index.to_le_bytes();

    let (withdraw_amount, bump) = {
        let mut vault = ctx.accounts.premium_vault.load_mut()?;

        if amount == u64::MAX {
            amount = ctx.accounts.withdrawer_p_token_account.amount;
        }

        require!(
            ctx.accounts.withdrawer_p_token_account.amount >= amount,
            ErrorCode::InsufficientFunds
        );

        let withdraw_fee = vault.withdraw_fee;

        let fee_amount = amount
            .checked_mul(withdraw_fee)
            .and_then(|v| v.checked_div(PERCENTAGE_DENOMINATOR))
            .ok_or(ErrorCode::Overflow)?;

        let withdraw_amount = amount.checked_sub(fee_amount).ok_or(ErrorCode::Overflow)?;

        vault.accumulated_fee = vault
            .accumulated_fee
            .checked_add(fee_amount)
            .ok_or(ErrorCode::Overflow)?;

        (withdraw_amount, vault.bump)
    };

    // Burn p_mint tokens 1:1 from withdrawer
    let seeds: &[&[u8]] = &[VAULT_SEED, &vault_index_bytes, &[bump]];
    let signer_seeds: &[&[&[u8]]] = &[seeds];

    let balance_before = ctx.accounts.vault_token_account.amount;

    let burn_cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.p_mint.to_account_info(),
            from: ctx.accounts.withdrawer_p_token_account.to_account_info(),
            authority: ctx.accounts.withdrawer.to_account_info(),
        },
    );
    burn(burn_cpi_ctx, amount)?;

    #[cfg(not(feature = "local"))]
    {
        let params = WithdrawParams {
            signer: ctx.accounts.premium_vault.to_account_info(),
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
            vault: ctx.accounts.vault.to_account_info(),
            claim_account: ctx.accounts.claim_account.to_account_info(),
            liquidity: ctx.accounts.liquidity.to_account_info(),
            liquidity_program: ctx.accounts.liquidity_program.to_account_info(),
            rewards_rate_model: ctx.accounts.rewards_rate_model.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            lending_program: ctx.accounts.lending_program.clone(),
        };

        // sub 3 units for rounding buffer to avoid dust accounts
        params.withdraw_signed(withdraw_amount, &[seeds])?;
    }

    #[cfg(feature = "local")]
    {
        let _ = balance_before;
        msg!("[local] Skipped lending withdraw CPI");
    }

    #[cfg(not(feature = "local"))]
    let delta = {
        ctx.accounts.vault_token_account.reload()?;
        ctx.accounts
            .vault_token_account
            .amount
            .checked_sub(balance_before)
            .ok_or(ErrorCode::Overflow)?
    };

    #[cfg(feature = "local")]
    let delta = withdraw_amount;

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.vault_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.withdrawer_token_account.to_account_info(),
            authority: ctx.accounts.premium_vault.to_account_info(),
        },
        signer_seeds,
    );

    transfer_checked(cpi_ctx, delta, ctx.accounts.mint.decimals)?;

    Ok(())
}
