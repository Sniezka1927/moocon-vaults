use anchor_lang::prelude::*;

#[event]
pub struct CommitEvent {
    pub vault: Pubkey,
    pub round: u32,
    pub amount: u64,
    pub merkle_root: [u8; 32],
    pub secret_hash: [u8; 32],
    pub vrf_seed: [u8; 32],
}

#[event]
pub struct RevealEvent {
    pub vault: Pubkey,
    pub round: u32,
    pub secret_seed: [u8; 32],
    pub randomness: [u8; 64],
    pub winner_index: u64,
}
