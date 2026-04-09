use anchor_lang::prelude::*;

#[account(zero_copy)]
#[derive(InitSpace)]
pub struct Reward {
    pub claimer: Pubkey,
    pub vault: Pubkey,
    pub amount: u64,
    pub total_tickets: u64,
    pub winner_index: u64,
    pub round: u32,
    pub reward_type: u8,
    pub bump: u8,
    pub _padding: [u8; 2],
}

impl Reward {
    pub const LEN: usize = 8 + Reward::INIT_SPACE;
}
