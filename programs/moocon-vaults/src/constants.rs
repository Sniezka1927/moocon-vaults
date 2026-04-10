use anchor_lang::prelude::*;

#[constant]
pub const STATE_SEED: &[u8] = b"state";
#[constant]
pub const VAULT_SEED: &[u8] = b"vault";
#[constant]
pub const REWARD_SEED: &[u8] = b"reward";

pub const EXCHANGE_RATE_PRECISION: u64 = 1_000_000_000_000; // 1e12
pub const TOKEN_EXCHANGE_PRICE_OFFSET: usize = 115;

#[constant]
pub const REWARD_TYPE_ROUND: u8 = 0;
#[constant]
pub const REWARD_TYPE_DAILY: u8 = 1;
#[constant]
pub const REWARD_TYPE_WEEKLY: u8 = 2;
#[constant]
pub const WINNER_SHARE: u64 = 600000;
#[constant]
pub const DAILY_JACKPOT_SHARE: u64 = 200000;
#[constant]
pub const WEEKLY_JACKPOT_SHARE: u64 = 200000;
#[constant]
pub const SHARE_DENOMINATOR: u64 = 1000000;
#[constant]
pub const FEE_DENOMINATOR: u64 = 1_000_000;

/// https://dev.jup.ag/docs/lend/program-addresses
#[constant]
#[cfg(feature = "local")]
pub const JUPITER_LENDING_PROGRAM_ID: Pubkey =
    pubkey!("5za4DTEi2hT35dWfNysVgFSeoJ93xTZsKc8Za4gfxEni");
#[cfg(not(feature = "local"))]
pub const JUPITER_LENDING_PROGRAM_ID: Pubkey =
    pubkey!("7tjE28izRUjzmxC1QNXnNwcc4N82CNYCexf3k8mw67s3");
// Devnet: 7tjE28izRUjzmxC1QNXnNwcc4N82CNYCexf3k8mw67s3
