use anchor_lang::prelude::*;

use crate::{error::ErrorCode, State, STATE_SEED};

#[derive(Accounts)]
pub struct SetVrfAuthority<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [STATE_SEED],
        bump = state.load()?.bump,
        has_one = admin @ ErrorCode::Unauthorized,
    )]
    pub state: AccountLoader<'info, State>,
}

pub fn handler(ctx: Context<SetVrfAuthority>, new_vrf_authority: Pubkey) -> Result<()> {
    ctx.accounts.state.load_mut()?.vrf_authority = new_vrf_authority;
    Ok(())
}
