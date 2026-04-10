use anchor_lang::prelude::*;

use crate::{error::ErrorCode, Reward, State, Vault, REWARD_SEED, STATE_SEED, VAULT_SEED};

#[derive(Accounts)]
#[instruction(vault_index: u32, round: u32)]
pub struct SetWinner<'info> {
    pub vrf_authority: Signer<'info>,

    #[account(
        seeds = [STATE_SEED],
        bump = state.load()?.bump,
        has_one = vrf_authority @ ErrorCode::Unauthorized,
    )]
    pub state: AccountLoader<'info, State>,

    #[account(
        seeds = [VAULT_SEED, &vault_index.to_le_bytes()],
        bump = vault.load()?.bump,
    )]
    pub vault: AccountLoader<'info, Vault>,

    #[account(
        mut,
        seeds = [REWARD_SEED, vault.key().as_ref(), &round.to_le_bytes()],
        bump = reward.load()?.bump,
    )]
    pub reward: AccountLoader<'info, Reward>,

    pub winner: SystemAccount<'info>,
}

pub fn handler(ctx: Context<SetWinner>, _vault_index: u32, _round: u32) -> Result<()> {
    let state = ctx.accounts.state.load()?;
    let mut reward = ctx.accounts.reward.load_mut()?;

    require!(
        ctx.accounts.vrf_authority.key() == state.vrf_authority,
        ErrorCode::Unauthorized
    );
    require!(
        reward.claimer == Pubkey::default(),
        ErrorCode::AlreadyClaimed
    );
    require!(reward.winner_index != u64::MAX, ErrorCode::WinnerNotSet);

    reward.claimer = ctx.accounts.winner.key();

    Ok(())
}
