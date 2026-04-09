use anchor_lang::prelude::*;

#[account(zero_copy)]
#[derive(InitSpace)]
pub struct State {
    pub admin: Pubkey,
    pub vrf_authority: Pubkey,
    pub last_vault: u32,
    pub bump: u8,
    pub _padding: [u8; 3],
}

impl State {
    pub const LEN: usize = 8 + State::INIT_SPACE;
}
