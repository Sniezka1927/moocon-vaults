use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::Token;
use anchor_spl::token_interface::{mint_to, Mint, MintTo, TokenAccount};

use crate::{error::ErrorCode, Reward, State, Vault, REWARD_SEED, STATE_SEED, VAULT_SEED};

#[derive(Accounts)]
#[instruction(vault_index: u32, round: u32)]
pub struct Claim<'info> {
    #[account(mut)]
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

    #[account(mut, constraint = vault.load()?.p_mint == p_mint.key() @ ErrorCode::InvalidPMint)]
    pub p_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = claimer,
        associated_token::mint = p_mint,
        associated_token::authority = claimer,
    )]
    pub claimer_p_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

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

    // Mint p_tokens to claimer as reward
    let vault_index_bytes = vault_index.to_le_bytes();
    let seeds: &[&[u8]] = &[VAULT_SEED, &vault_index_bytes, &[bump]];
    let signer_seeds: &[&[&[u8]]] = &[seeds];

    let mint_cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.p_mint.to_account_info(),
            to: ctx.accounts.claimer_p_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        },
        signer_seeds,
    );
    mint_to(mint_cpi_ctx, amount)?;

    Ok(())
}
