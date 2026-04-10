use anchor_lang::prelude::*;
use orao_solana_vrf::state::RandomnessAccountData;

use crate::{
    error::ErrorCode, RevealEvent, Reward, State, Vault, REWARD_SEED, STATE_SEED, VAULT_SEED,
};

#[derive(Accounts)]
#[instruction(vault_index: u32, round: u32)]
pub struct Reveal<'info> {
    pub vrf_authority: Signer<'info>,

    #[account(
        seeds = [STATE_SEED],
        bump = state.load()?.bump,
        has_one = vrf_authority @ ErrorCode::Unauthorized,
    )]
    pub state: AccountLoader<'info, State>,

    #[account(
        seeds = [VAULT_SEED, &vault_index.to_le_bytes()],
        bump = vault.load()?.bump,
    )]
    pub vault: AccountLoader<'info, Vault>,

    #[account(
        mut,
        seeds = [REWARD_SEED, vault.key().as_ref(), &round.to_le_bytes()],
        bump = reward.load()?.bump,
    )]
    pub reward: AccountLoader<'info, Reward>,

    /// CHECK: Orao randomness account — deserialized manually below
    #[account(constraint = request.owner.key() == orao_solana_vrf::ID @ ErrorCode::InvalidRandomnessAccount)]
    pub request: AccountInfo<'info>,
}

/// KISS (Keep It Simple Stupid) PRNG
/// Uses 4 x 32-bit state components combined for full-period 2^127 cycle.
struct KissRng {
    x: u32,
    y: u32,
    z: u32,
    w: u32,
}

impl KissRng {
    fn from_seed(seed: &[u8; 32]) -> Self {
        let x = u32::from_le_bytes(seed[0..4].try_into().unwrap()) | 1; // must be odd
        let y = u32::from_le_bytes(seed[4..8].try_into().unwrap()) | 1; // must be nonzero
        let z = u32::from_le_bytes(seed[8..12].try_into().unwrap());
        let w = u32::from_le_bytes(seed[12..16].try_into().unwrap());
        Self { x, y, z, w }
    }

    fn next(&mut self) -> u32 {
        // Linear congruential
        self.x = self.x.wrapping_mul(69069).wrapping_add(12345);

        // Xorshift
        self.y ^= self.y << 13;
        self.y ^= self.y >> 17;
        self.y ^= self.y << 5;

        // Carry-add
        let t = (self.z as u64).wrapping_add(self.w as u64).wrapping_add(1);
        self.z = self.w;
        self.w = t as u32;

        self.x.wrapping_add(self.y).wrapping_add(self.w)
    }

    fn next_u64(&mut self) -> u64 {
        let hi = self.next() as u64;
        let lo = self.next() as u64;
        (hi << 32) | lo
    }
}

pub fn handler(
    ctx: Context<Reveal>,
    _vault_index: u32,
    round: u32,
    secret_seed: [u8; 32],
) -> Result<()> {
    // Deserialize Orao randomness
    let mut reward = ctx.accounts.reward.load_mut()?;
    let data = ctx.accounts.request.try_borrow_data()?;
    let randomness = RandomnessAccountData::try_deserialize(&mut data.as_ref())
        .map_err(|_| error!(ErrorCode::RandomnessNotFulfilled))?;
    let onchain_randomness = randomness
        .fulfilled_randomness()
        .ok_or_else(|| error!(ErrorCode::RandomnessNotFulfilled))?;

    // XOR secret_seed with on-chain randomness
    let mut combined = [0u8; 32];
    for i in 0..32 {
        combined[i] = secret_seed[i] ^ onchain_randomness[i];
    }

    // KISS PRNG seeded with combined entropy
    let mut rng = KissRng::from_seed(&combined);
    let raw_value = rng.next_u64();

    let winner_index = raw_value % reward.total_tickets;

    // Save to Reward PDAs
    require!(
        reward.winner_index == u64::MAX && reward.claimer == Pubkey::default(),
        ErrorCode::AlreadyClaimed
    );
    reward.winner_index = winner_index;

    emit!(RevealEvent {
        vault: ctx.accounts.vault.key(),
        round,
        secret_seed,
        randomness: *onchain_randomness,
        winner_index
    });

    Ok(())
}
