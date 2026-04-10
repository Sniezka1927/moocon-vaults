use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("CPI to Jup program failed")]
    CpiFailed,

    #[msg("Provided invalid mint")]
    InvalidMint,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Exchange rate already synced")]
    AlreadySynced,

    #[msg("Invalid exchange rate data")]
    InvalidExchangeRate,

    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("No yield to claim")]
    NothingToClaim,

    #[msg("Fee exceeds maximum")]
    InvalidFee,

    #[msg("Invalid PMint")]
    InvalidPMint,

    #[msg("Mismatched decimals between mint and pMint")]
    MismatchedDecimals,

    #[msg("Invalid lending program")]
    InvalidLendingProgram,
}
