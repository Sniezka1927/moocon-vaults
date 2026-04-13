use anchor_lang::prelude::*;
use bytemuck::{Pod, Zeroable};

#[account(zero_copy)]
#[derive(InitSpace)]
pub struct Vault {
    pub mint: Pubkey,
    pub f_mint: Pubkey,
    pub p_mint: Pubkey,

    pub lending: Pubkey, // Jupiter Lending account PDA

    pub min_deposit: u64, // Minimum deposit amount in underlying tokens
    pub accumulated_fee: u64,
    pub withdraw_fee: u64,

    pub last_rate: u64,
    pub distribution_tiers: [DistributionTier; 2],
    pub current_round: u32,
    pub bump: u8,
    pub _padding: [u8; 3],
}

#[repr(C)]
#[derive(InitSpace, Pod, Zeroable, AnchorSerialize, AnchorDeserialize, Copy, Clone)]
pub struct DistributionTier {
    pub distributed_at: i64, // last distribution
    pub interval: i64,       // distributed every
    pub reward_share: u64,   // share of yield assigned to this tier
    pub accumulated: u64,    // amount of yield accumulated in this tier
}

impl Vault {
    pub const LEN: usize = 8 + Vault::INIT_SPACE;
}
