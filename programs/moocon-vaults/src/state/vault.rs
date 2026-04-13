use anchor_lang::prelude::*;

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
    pub daily_jackpot_accumulated: u64,
    pub weekly_jackpot_accumulated: u64,

    pub last_daily_ts: i64,
    pub last_weekly_ts: i64,

    pub current_round: u32,
    pub bump: u8,
    pub _padding: [u8; 3],
}

impl Vault {
    pub const LEN: usize = 8 + Vault::INIT_SPACE;
}
