use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TransferChecked};

use crate::{error::ErrorCode, Reward, State, Vault, REWARD_SEED, STATE_SEED, VAULT_SEED};

#[derive(Accounts)]
#[instruction(vault_index: u32, round: u32)]
pub struct Claim<'info> {
    pub claimer: Signer<'info>,

    #[account(
        seeds = [STATE_SEED],
        bump = state.load()?.bump,
    )]
    pub state: AccountLoader<'info, State>,

    #[account(
        seeds = [VAULT_SEED, &vault_index.to_le_bytes()],
        bump = vault.load()?.bump,
    )]
    pub vault: AccountLoader<'info, Vault>,

    #[account(
        mut,
        close = rent_recipient,
        seeds = [REWARD_SEED, vault.key().as_ref(), &round.to_le_bytes()],
        bump = reward.load()?.bump,
    )]
    pub reward: AccountLoader<'info, Reward>,

    #[account(constraint = vault.load()?.mint == mint.key() @ ErrorCode::InvalidMint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, token::mint = mint.key(), token::authority = vault.key())]
    pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = mint.key(), token::authority = claimer.key())]
    pub claimer_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,

    /// CHECK: VRF authority receives rent from closed reward account
    #[account(
        mut,
        constraint = rent_recipient.key() == state.load()?.vrf_authority
    )]
    pub rent_recipient: AccountInfo<'info>,
}

pub fn handler(ctx: Context<Claim>, vault_index: u32, _round: u32) -> Result<()> {
    let (amount, bump) = {
        let reward = ctx.accounts.reward.load()?;
        let vault = ctx.accounts.vault.load()?;

        require!(
            reward.claimer == ctx.accounts.claimer.key(),
            ErrorCode::NotWinner
        );

        (reward.amount, vault.bump)
    };

    // Transfer reward tokens from vault to claimer
    let vault_index_bytes = vault_index.to_le_bytes();
    let seeds: &[&[u8]] = &[VAULT_SEED, &vault_index_bytes, &[bump]];
    let signer_seeds: &[&[&[u8]]] = &[seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.vault_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.claimer_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        },
        signer_seeds,
    );
    transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;

    Ok(())
}
