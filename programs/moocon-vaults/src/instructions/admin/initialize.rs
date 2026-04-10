use anchor_lang::prelude::*;

use crate::{State, STATE_SEED};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = State::LEN,
        seeds = [STATE_SEED],
        bump,
    )]
    pub state: AccountLoader<'info, State>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, vrf_authority: Pubkey) -> Result<()> {
    let mut state = ctx.accounts.state.load_init()?;
    state.admin = ctx.accounts.admin.key();
    state.vrf_authority = vrf_authority;
    state.last_vault = 0;
    state.bump = ctx.bumps.state;
    Ok(())
}
