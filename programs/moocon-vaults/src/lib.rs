pub mod constants;
pub mod cpi;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use cpi::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

declare_id!("EJ6ryWkee1qE7LK2MLxWZ3SVq6hiiYLS7Q6trDmKaACv");

#[program]
pub mod premium_vaults {

    use super::*;

    // Admin

    pub fn initialize(ctx: Context<Initialize>, vrf_authority: Pubkey) -> Result<()> {
        initialize::handler(ctx, vrf_authority)
    }

    pub fn set_vrf_authority(
        ctx: Context<SetVrfAuthority>,
        new_vrf_authority: Pubkey,
    ) -> Result<()> {
        set_vrf_authority::handler(ctx, new_vrf_authority)
    }

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        min_deposit: u64,
        withdraw_fee: u64,
    ) -> Result<()> {
        initialize_vault::handler(ctx, min_deposit, withdraw_fee)
    }

    pub fn set_withdraw_fee(
        ctx: Context<SetVaultWithdrawFee>,
        vault_index: u32,
        withdraw_fee: u64,
    ) -> Result<()> {
        set_withdraw_fee::handler(ctx, vault_index, withdraw_fee)
    }

    pub fn sync_rate(ctx: Context<SyncRate>, vault_index: u32) -> Result<()> {
        sync_rate::handler(ctx, vault_index)
    }

    pub fn collect_fee(ctx: Context<CollectFee>, vault_index: u32) -> Result<()> {
        collect_fee::handler(ctx, vault_index)
    }

    // Authority

    pub fn commit(
        ctx: Context<Commit>,
        vault_index: u32,
        round: u32,
        reward_type: u8,
        tickets: u64,
        merkle_root: [u8; 32],
        secret_hash: [u8; 32],
    ) -> Result<()> {
        commit::handler(
            ctx,
            vault_index,
            round,
            reward_type,
            tickets,
            merkle_root,
            secret_hash,
        )
    }

    pub fn reveal(
        ctx: Context<Reveal>,
        vault_index: u32,
        round: u32,
        secret_seed: [u8; 32],
    ) -> Result<()> {
        reveal::handler(ctx, vault_index, round, secret_seed)
    }

    pub fn set_winner(ctx: Context<SetWinner>, vault_index: u32, round: u32) -> Result<()> {
        set_winner::handler(ctx, vault_index, round)
    }

    // User

    pub fn deposit(ctx: Context<Deposit>, vault_index: u32, amount: u64) -> Result<()> {
        deposit::handler(ctx, vault_index, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, vault_index: u32, amount: u64) -> Result<()> {
        withdraw::handler(ctx, vault_index, amount)
    }

    pub fn claim(ctx: Context<Claim>, vault_index: u32, round: u32) -> Result<()> {
        claim::handler(ctx, vault_index, round)
    }
}
