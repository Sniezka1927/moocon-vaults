use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::Token,
    token_interface::{transfer_checked, Mint, TokenAccount, TransferChecked},
};

use crate::{error::ErrorCode, State, Vault, STATE_SEED, VAULT_SEED};

#[cfg(not(feature = "local"))]
use crate::{WithdrawParams, JUPITER_LENDING_PROGRAM_ID};

#[derive(Accounts)]
#[instruction(vault_index: u32)]
pub struct CollectFee<'info> {
    pub admin: Signer<'info>,
    #[account(
        seeds = [STATE_SEED],
        bump = state.load()?.bump,
        has_one = admin @ ErrorCode::Unauthorized,
    )]
    pub state: AccountLoader<'info, State>,
    #[account(
        mut,
        seeds = [VAULT_SEED, &vault_index.to_le_bytes()],
        bump = vault.load()?.bump,
    )]
    pub vault: AccountLoader<'info, Vault>,

    #[account(mut, token::mint = f_token_mint.key(), token::authority = vault.key())]
    pub vault_f_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = mint.key(), token::authority = vault.key())]
    pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = mint.key(), token::authority = admin.key())]
    pub admin_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(constraint = vault.load()?.mint == mint.key() @ ErrorCode::InvalidMint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

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
    pub lending_vault: AccountInfo<'info>,
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
    #[cfg(not(feature = "local"))]
    #[account(constraint = lending_program.key() == JUPITER_LENDING_PROGRAM_ID @ ErrorCode::InvalidLendingProgram)]
    pub lending_program: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<CollectFee>, vault_index: u32) -> Result<()> {
    let (amount, bump) = {
        let mut vault = ctx.accounts.vault.load_mut()?;
        let amount = vault.accumulated_fee;
        require!(amount > 0, ErrorCode::NothingToClaim);
        let bump = vault.bump;
        vault.accumulated_fee = 0;
        (amount, bump)
    };

    let vault_index_bytes = vault_index.to_le_bytes();
    let seeds: &[&[u8]] = &[VAULT_SEED, &vault_index_bytes, &[bump]];
    let signer_seeds: &[&[&[u8]]] = &[seeds];

    let balance_before = ctx.accounts.vault_token_account.amount;

    // Withdraw from Jupiter lending into vault_token_account
    #[cfg(not(feature = "local"))]
    {
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
            vault: ctx.accounts.lending_vault.to_account_info(),
            claim_account: ctx.accounts.claim_account.to_account_info(),
            liquidity: ctx.accounts.liquidity.to_account_info(),
            liquidity_program: ctx.accounts.liquidity_program.to_account_info(),
            rewards_rate_model: ctx.accounts.rewards_rate_model.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            lending_program: ctx.accounts.lending_program.clone(),
        };

        params.withdraw_signed(amount, &[seeds])?;
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
    let delta = amount;

    // Transfer withdrawn tokens to admin
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.vault_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.admin_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        },
        signer_seeds,
    );
    transfer_checked(cpi_ctx, delta, ctx.accounts.mint.decimals)?;

    Ok(())
}
