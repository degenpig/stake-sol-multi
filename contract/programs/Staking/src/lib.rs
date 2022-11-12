use anchor_lang::prelude::*;

use anchor_spl::token::{self, Mint,SetAuthority ,Token, TokenAccount};
use anchor_spl::associated_token::get_associated_token_address;
use spl_token::instruction::AuthorityType;
const VAULT_ACCOUNT_PREFIX: &[u8] = b"vault_account";

declare_id!("F4YRJBSzgvhPx8SAbLG7UpDiu581Vty78dK6fN5u9McA");


#[program]
pub mod staking {
    use super::*;

    
    pub fn initialize_valut(ctx: Context<InitializeVaultAccount>,bump:u8) -> Result<()> {
        let vault_account = &mut ctx.accounts.vault_account;
        vault_account.total_staked = 0;
        vault_account.bump = bump;
        Ok(())
    }

    pub fn stake_nft(ctx: Context<StakeNft>) -> Result<()> {

        let owner = &mut ctx.accounts.owner;
        let nft_mint = &ctx.accounts.nft_mint;
        let nft_token_account = &ctx.accounts.nft_token_account;

        let token_program = &ctx.accounts.token_program;
        let vault_account = &mut ctx.accounts.vault_account;

        //make a nft item struct staked
        let nft_item = NftItem{
            owner: *owner.to_account_info().key,
            nft_mint: nft_mint.to_account_info().key(),
        };  
        // add the nft_info into vault account
        vault_account.nft_items_staked.push(nft_item);
        vault_account.total_staked += 1;    
        //transfer nft ownership to vault
        let authority_accounts = SetAuthority {
            current_authority: owner.to_account_info(),
            account_or_mint: nft_token_account.to_account_info(),
        };
        let authority_ctx = CpiContext::new(token_program.to_account_info(), authority_accounts);
        token::set_authority(
            authority_ctx,
            AuthorityType::AccountOwner,
            Some(vault_account.key()),
        )?;

        Ok(())
    }

    pub fn unstake_nft(ctx: Context<UnstakeNft>) -> Result<()> {
        let owner = &ctx.accounts.owner;
        let nft_token_account = &ctx.accounts.nft_token_account;
        let nft_mint = &ctx.accounts.nft_mint;

        let token_program = &ctx.accounts.token_program;
        let vault_account = &mut ctx.accounts.vault_account;

        let index = vault_account.nft_items_staked.iter().position(|x| x.nft_mint == *nft_mint.to_account_info().key).unwrap();
        vault_account.nft_items_staked.remove(index);

        // vault_account.nft_items_staked.retain(|x| x.nft_mint ==  nft_mint.to_account_info().key() );
		
        vault_account.total_staked = vault_account.total_staked.checked_sub(1).unwrap_or(0);

        let vault_account_seeds = &[
            &id().to_bytes(),
            VAULT_ACCOUNT_PREFIX,
            &[vault_account.bump],
        ];

        let vault_account_signer = &[&vault_account_seeds [..]];

        //transfer nft to vault
        let authority_accounts = SetAuthority {
            current_authority: vault_account.to_account_info(),
            account_or_mint: nft_token_account.to_account_info(),
        };
        let authority_ctx = CpiContext::new_with_signer(
            token_program.to_account_info(),
            authority_accounts,
            vault_account_signer,
        );
        token::set_authority(
            authority_ctx,
            AuthorityType::AccountOwner,
            Some(owner.key()),
        )?;

        Ok(())
    }

}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct InitializeVaultAccount<'info> {
  #[account(mut, signer)]
  /// CHECK:` doc comment explaining why no checks through types are necessary.
  pub owner: AccountInfo<'info>,

  #[account(
    init,
    space = 10240,
    payer = owner,
    seeds = [&id().to_bytes(), VAULT_ACCOUNT_PREFIX],
    bump
  )]
  pub vault_account: Account<'info, VaultAccount>,
  pub system_program: Program <'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct StakeNft<'info> {
    /// CHECK:` doc comment explaining why no checks through types are necessary.
    #[account(mut, signer)]
    pub owner: AccountInfo<'info>,
    /// The stake account for the owner
    #[account(
    mut,
    seeds = [&id().to_bytes(), VAULT_ACCOUNT_PREFIX],
    bump = vault_account.bump,
    )]
    pub vault_account: Account<'info, VaultAccount>,

    /// The Mint of the NFT
    #[account(
        constraint = nft_mint.supply == 1 @ StakingError::InvalidNFTMintSupply,
    )]
    pub nft_mint: Box<Account<'info, Mint>>,

    /// The token account from the owner
    #[account(
        mut,
        has_one = owner @ StakingError::InvalidNFTOwner,
        constraint = nft_token_account.mint == nft_mint.key() @ StakingError::InvalidNFTAccountMint,
        constraint = nft_token_account.amount == 1 @ StakingError::NFTAccountEmpty,
    )]
    pub nft_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UnstakeNft<'info> {
    /// The owner of the stake account
    /// CHECK:` doc comment explaining why no checks through types are necessary.
    #[account(mut, signer)]
    pub owner: AccountInfo<'info>,
    /// The Mint of the NFT
    #[account(
        constraint = nft_mint.supply == 1 @ StakingError::InvalidNFTMintSupply,
    )]
    pub nft_mint: Box<Account<'info, Mint>>,

    /// The token account from the owner
    #[account(
        mut,
        constraint = nft_token_account.owner == vault_account.key() @ StakingError::InvalidVaultOwner,
        constraint = nft_token_account.mint == nft_mint.key() @ StakingError::InvalidNFTAccountMint,
        address = get_associated_token_address(&owner.key(), &nft_mint.key()),
    )]
    pub nft_token_account: Account<'info, TokenAccount>,

    /// the valut account
    #[account(
        mut,
        seeds = [&id().to_bytes(), VAULT_ACCOUNT_PREFIX],
        bump = vault_account.bump,
    )]
    pub vault_account: Account<'info, VaultAccount>,


    pub token_program: Program<'info, Token>,
}

#[account]
pub struct VaultAccount {
    pub total_staked: u32,
    pub nft_items_staked: Vec<NftItem>,
    pub bump: u8,
}

#[derive(Debug, AnchorDeserialize, AnchorSerialize, Default, Clone,)]
pub struct NftItem {
    pub owner: Pubkey,
    pub nft_mint: Pubkey,
}

#[error_code]
pub enum StakingError {
    #[msg("The provider NFT Mint has a supply that isn't 1")]
    InvalidNFTMintSupply,
    #[msg("The provider NFT token account is not owned by the providered owner")]
    InvalidNFTOwner,
    #[msg("The provider NFT token account is not for the NFT mint")]
    InvalidNFTAccountMint,
    #[msg("The provider NFT token account doesn't have te token")]
    NFTAccountEmpty,
    #[msg("The provided NFT token account is not by owned vault account")]
    InvalidVaultOwner,
}