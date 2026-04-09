use anchor_lang::prelude::{instruction::Instruction, program::invoke_signed, *};

use crate::error::ErrorCode;

pub struct DepositParams<'info> {
    // User accounts
    pub signer: AccountInfo<'info>,
    pub depositor_token_account: AccountInfo<'info>,
    pub recipient_token_account: AccountInfo<'info>,

    pub mint: AccountInfo<'info>,

    // Protocol accounts
    pub lending_admin: AccountInfo<'info>,
    pub lending: AccountInfo<'info>,
    pub f_token_mint: AccountInfo<'info>,

    // Liquidity protocol accounts
    pub supply_token_reserves_liquidity: AccountInfo<'info>,
    pub lending_supply_position_on_liquidity: AccountInfo<'info>,
    pub rate_model: AccountInfo<'info>,
    pub vault: AccountInfo<'info>,
    pub liquidity: AccountInfo<'info>,
    pub liquidity_program: AccountInfo<'info>,

    // Rewards and programs
    pub rewards_rate_model: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
    pub associated_token_program: AccountInfo<'info>,
    pub system_program: AccountInfo<'info>,

    // Target lending program
    pub lending_program: UncheckedAccount<'info>,
}

fn get_deposit_discriminator() -> Vec<u8> {
    // discriminator = sha256("global:deposit")[0..8]
    vec![242, 35, 198, 137, 82, 225, 242, 182]
}

impl<'info> DepositParams<'info> {
    pub fn deposit_signed(&self, amount: u64, signer_seeds: &[&[&[u8]]]) -> Result<()> {
        let mut instruction_data = get_deposit_discriminator();
        instruction_data.extend_from_slice(&amount.to_le_bytes());

        let account_metas = vec![
            AccountMeta::new(*self.signer.key, true),
            AccountMeta::new(*self.depositor_token_account.key, false),
            AccountMeta::new(*self.recipient_token_account.key, false),
            AccountMeta::new_readonly(*self.mint.key, false),
            AccountMeta::new_readonly(*self.lending_admin.key, false),
            AccountMeta::new(*self.lending.key, false),
            AccountMeta::new(*self.f_token_mint.key, false),
            AccountMeta::new(*self.supply_token_reserves_liquidity.key, false),
            AccountMeta::new(*self.lending_supply_position_on_liquidity.key, false),
            AccountMeta::new_readonly(*self.rate_model.key, false),
            AccountMeta::new(*self.vault.key, false),
            AccountMeta::new(*self.liquidity.key, false),
            AccountMeta::new(*self.liquidity_program.key, false),
            AccountMeta::new_readonly(*self.rewards_rate_model.key, false),
            AccountMeta::new_readonly(*self.token_program.key, false),
            AccountMeta::new_readonly(*self.associated_token_program.key, false),
            AccountMeta::new_readonly(*self.system_program.key, false),
        ];

        let instruction = Instruction {
            program_id: *self.lending_program.key,
            accounts: account_metas,
            data: instruction_data,
        };

        invoke_signed(
            &instruction,
            &[
                self.signer.clone(),
                self.depositor_token_account.clone(),
                self.recipient_token_account.clone(),
                self.mint.clone(),
                self.lending_admin.clone(),
                self.lending.clone(),
                self.f_token_mint.clone(),
                self.supply_token_reserves_liquidity.clone(),
                self.lending_supply_position_on_liquidity.clone(),
                self.rate_model.clone(),
                self.vault.clone(),
                self.liquidity.clone(),
                self.liquidity_program.clone(),
                self.rewards_rate_model.clone(),
                self.token_program.clone(),
                self.associated_token_program.clone(),
                self.system_program.clone(),
            ],
            signer_seeds,
        )
        .map_err(|_| ErrorCode::CpiFailed.into())
    }
}
