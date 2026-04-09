use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("CPI to Jup program failed")]
    CpiFailed,
    #[msg("Invalid exchange rate data")]
    InvalidExchangeRate,
}
