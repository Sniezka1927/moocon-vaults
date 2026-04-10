use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::Token,
    token_interface::{mint_to, transfer_checked, Mint, MintTo, TokenAccount, TransferChecked},
};

use crate::{error::ErrorCode, State, Vault, JUPITER_LENDING_PROGRAM_ID, STATE_SEED, VAULT_SEED};

#[cfg(not(feature = "local"))]
use crate::DepositParams;

#[derive(Accounts)]
#[instruction(vault_index: u32)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(
        mut,
        seeds = [STATE_SEED],
        bump = state.load()?.bump,
    )]
    pub state: AccountLoader<'info, State>,

    #[account(
        mut, // required for CPI Call
        seeds = [VAULT_SEED, &vault_index.to_le_bytes()],
        bump = premium_vault.load()?.bump,
    )]
    pub premium_vault: AccountLoader<'info, Vault>,

    // CPI Accounts
    #[account(mut, token::mint = mint.key(), token::authority = depositor.key())]
    pub depositor_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = mint.key(), token::authority = premium_vault.key())]
    pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: Recipient fToken account — validated by lending program via CPI
    #[account(mut)]
    pub recipient_token_account: AccountInfo<'info>,

    #[account(constraint = premium_vault.load()?.mint == mint.key() @ ErrorCode::InvalidMint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut, constraint = premium_vault.load()?.p_mint == p_mint.key() @ ErrorCode::InvalidPMint)]
    pub p_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = depositor,
        associated_token::mint = p_mint,
        associated_token::authority = depositor,
    )]
    pub depositor_p_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: Lending admin — validated by lending program via CPI
    pub lending_admin: AccountInfo<'info>,
    /// CHECK: Lending account — validated by lending program via CPI
    #[account(mut, constraint = lending.key() == premium_vault.load()?.lending)]
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

pub fn handler(ctx: Context<Deposit>, vault_index: u32, amount: u64) -> Result<()> {
    require!(amount != 0, ErrorCode::ZeroAmount);

    let vault_bump = {
        let vault = ctx.accounts.premium_vault.load()?;
        require!(amount >= vault.min_deposit, ErrorCode::BelowMinimumDeposit);
        vault.bump
    };

    // Transfer: depositor → vault_token_account
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.depositor_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        },
    );
    transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;

    // Mint p_mint tokens 1:1 to depositor
    {
        let vault_index_bytes = vault_index.to_le_bytes();
        let seeds: &[&[u8]] = &[VAULT_SEED, &vault_index_bytes, &[vault_bump]];
        let signer_seeds: &[&[&[u8]]] = &[seeds];

        let mint_cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.p_mint.to_account_info(),
                to: ctx.accounts.depositor_p_token_account.to_account_info(),
                authority: ctx.accounts.premium_vault.to_account_info(),
            },
            signer_seeds,
        );
        mint_to(mint_cpi_ctx, amount)?;
    }

    // Transfer 2: vault_token_account → lending via CPI (premium_vault PDA signs)
    #[cfg(not(feature = "local"))]
    {
        let vault_index_bytes = vault_index.to_le_bytes();
        let seeds: &[&[u8]] = &[VAULT_SEED, &vault_index_bytes, &[vault_bump]];
        let params = DepositParams {
            signer: ctx.accounts.premium_vault.to_account_info(),
            depositor_token_account: ctx.accounts.vault_token_account.to_account_info(),
            recipient_token_account: ctx.accounts.recipient_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            lending_admin: ctx.accounts.lending_admin.to_account_info(),
            lending: ctx.accounts.lending.to_account_info(),
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
            liquidity: ctx.accounts.liquidity.to_account_info(),
            liquidity_program: ctx.accounts.liquidity_program.to_account_info(),
            rewards_rate_model: ctx.accounts.rewards_rate_model.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            lending_program: ctx.accounts.lending_program.clone(),
        };
        params.deposit_signed(amount, &[seeds])?;
    }

    Ok(())
}
