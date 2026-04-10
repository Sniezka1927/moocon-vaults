use anchor_lang::prelude::*;

use crate::{error::ErrorCode, State, Vault, STATE_SEED, VAULT_SEED};

#[cfg(not(feature = "local"))]
use crate::read_exchange_rate;

#[derive(Accounts)]
#[instruction(vault_index: u32)]
pub struct SyncRate<'info> {
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

    /// CHECK: Jupiter Lending account — read manually for exchange rate
    #[account(constraint = lending.key() == vault.load()?.lending)]
    pub lending: AccountInfo<'info>,
}

pub fn handler(ctx: Context<SyncRate>, _vault_index: u32) -> Result<()> {
    let mut vault = ctx.accounts.vault.load_mut()?;
    require!(vault.last_rate == 0, ErrorCode::AlreadySynced);

    #[cfg(not(feature = "local"))]
    let exchange_rate = read_exchange_rate(&ctx.accounts.lending)?;

    #[cfg(feature = "local")]
    let exchange_rate: u64 = 1_000_000_000_000;

    vault.last_rate = exchange_rate;

    Ok(())
}
