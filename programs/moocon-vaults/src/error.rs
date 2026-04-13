use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // 6000
    #[msg("Randomness has not been fulfilled yet")]
    RandomnessNotFulfilled,
    // 6001
    #[msg("ZeroAmount")]
    ZeroAmount,
    // 6002
    #[msg("CPI to Jup program failed")]
    CpiFailed,
    // 6003
    #[msg("Provided invalid mint")]
    InvalidMint,
    // 6004
    #[msg("Arithmetic overflow")]
    Overflow,
    // 6005
    #[msg("Exchange rate already synced")]
    AlreadySynced,
    // 6006
    #[msg("Exchange rate not synced yet")]
    NotSynced,
    // 6007
    #[msg("Invalid exchange rate data")]
    InvalidExchangeRate,
    // 6008
    #[msg("Unauthorized")]
    Unauthorized,
    // 6009
    #[msg("Winner not yet assigned")]
    WinnerNotSet,
    // 6010
    #[msg("Reward already claimed")]
    AlreadyClaimed,
    // 6011
    #[msg("Not the winner")]
    NotWinner,
    // 6012
    #[msg("No yield to claim")]
    NothingToClaim,
    // 6013
    #[msg("Invalid reward type")]
    InvalidRewardType,
    // 6014
    #[msg("Jackpot pool is empty")]
    JackpotEmpty,
    // 6015
    #[msg("Fee exceeds maximum")]
    InvalidFee,
    // 6016
    #[msg("Invalid PMint")]
    InvalidPMint,
    // 6017
    #[msg("Mismatched decimals between mint and pMint")]
    MismatchedDecimals,
    // 6018
    #[msg("Invalid randomness account")]
    InvalidRandomnessAccount,
    // 6019
    #[msg("Invalid lending program")]
    InvalidLendingProgram,
    // 6020
    #[msg("Invalid lending account")]
    InvalidLendingAccount,
    // 6021
    #[msg("Insufficient funds")]
    InsufficientFunds,
    // 6022
    #[msg("Invalid Round")]
    InvalidRound,
    // 6023
    #[msg("Below minimum deposit")]
    BelowMinimumDeposit,
    // 6024
    #[msg("Invalid Vault share")]
    InvalidVaultShare,
}
