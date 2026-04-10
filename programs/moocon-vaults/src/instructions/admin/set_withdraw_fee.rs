use anchor_lang::prelude::*;

use crate::{error::ErrorCode, State, Vault, FEE_DENOMINATOR, STATE_SEED, VAULT_SEED};

#[derive(Accounts)]
#[instruction(vault_index: u32)]
pub struct SetVaultWithdrawFee<'info> {
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
}

pub fn handler(
    ctx: Context<SetVaultWithdrawFee>,
    _vault_index: u32,
    withdraw_fee: u64,
) -> Result<()> {
    require!(withdraw_fee <= FEE_DENOMINATOR, ErrorCode::InvalidFee);
    ctx.accounts.vault.load_mut()?.withdraw_fee = withdraw_fee;
    Ok(())
}
