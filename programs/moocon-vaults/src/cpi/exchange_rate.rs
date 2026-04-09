use anchor_lang::prelude::*;

use crate::{constants::TOKEN_EXCHANGE_PRICE_OFFSET, error::ErrorCode};

pub fn read_exchange_rate(lending_account: &AccountInfo) -> Result<u64> {
    let data = lending_account.try_borrow_data()?;
    require!(
        data.len() > TOKEN_EXCHANGE_PRICE_OFFSET + 8,
        ErrorCode::InvalidExchangeRate
    );
    let bytes: [u8; 8] = data[TOKEN_EXCHANGE_PRICE_OFFSET..TOKEN_EXCHANGE_PRICE_OFFSET + 8]
        .try_into()
        .unwrap();
    Ok(u64::from_le_bytes(bytes))
}
