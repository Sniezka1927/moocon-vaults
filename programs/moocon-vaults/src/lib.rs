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

declare_id!("26WWiEiNHYzksQsp9KBfa4acAyoKPnS2Ssp24Uv756S4");

#[program]
pub mod moocon_vaults {
    use super::*;

    // pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    //     initialize::handler(ctx)
    // }
}
