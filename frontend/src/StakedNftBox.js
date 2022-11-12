import React, { useEffect, useState } from 'react';
import { Connection,  clusterApiUrl, PublicKey, SYSVAR_RECENT_BLOCKHASHES_PUBKEY  } from '@solana/web3.js';
import { Program, AnchorProvider, web3 } from '@project-serum/anchor';

import idl from './idl.json';
import { BN } from "bn.js";

const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey( 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const TOKEN_PROGRAM_ID = new PublicKey(
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
)

// SystemProgram is a reference to the Solana runtime!
const { SystemProgram } = web3;

// Get our program's id from the IDL file.
const programID = new PublicKey(idl.metadata.address);
const systemProgram = web3.SystemProgram.programId;
const rentSysvar = web3.SYSVAR_RENT_PUBKEY;

// Set our network to devnet.
const network = clusterApiUrl('devnet');

// Controls how we want to acknowledge when a transaction is "done".
const opts = {
  preflightCommitment: "processed"
}

const vault_account_prefix = "vault_account";
window.Buffer = window.Buffer || require('buffer').Buffer;

const StakedNftBox = (props) => {
    const [vaultAccount, setVaultAccount] = useState('');
    const [vaultAccountBump, setVaultAccountBump] = useState(0);
    const [mintAddress, setMintAddress] = useState('');
    const [staked, setStaked] = useState(true);

    const getProvider = () => {
        const connection = new Connection(network, opts.preflightCommitment);
        const provider = new AnchorProvider(connection, window.solana, opts.preflightCommitment,);
        
        return provider;
    }
    
    const handleChange = async(e) => {
        let multiStakedNFTs = props.multiStakedNFTs;
        if (e.target.checked) {
            multiStakedNFTs.push(mintAddress);
            props.setMultiStakeNFTs(multiStakedNFTs);
        } else {
            let temp = [];
            for (let i = 0; i<multiStakedNFTs.length;i++) {
                if(multiStakedNFTs[i] != mintAddress) {
                    temp.push(multiStakedNFTs[i])
                }
            }
            props.setMultiStakeNFTs(temp);
        }
    }

    const unStakeNFT = async() => {
        const provider = getProvider();
        const program = new Program(idl, programID, provider);
        console.log(program)
        try{
            const wallet = new PublicKey(props.walletAddress);
            const nftTokenAccount = (await PublicKey.findProgramAddress(
                [
                    wallet.toBuffer(),
                    TOKEN_PROGRAM_ID.toBuffer(),
                    mintAddress.toBuffer()
                ],
                SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
            ))[0];
            console.log(provider.wallet)
            const tx = await program.rpc.unstakeNft({
                accounts:{
                    owner:wallet,
                    vaultAccount,
                    nftMint:mintAddress,
                    nftTokenAccount:nftTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            });
            setStaked(false);
            
        }catch(error) {
            console.log(error)
        }
    }
    
    useEffect(()=>{
        const fetchValutAccount = async() => {
            const provider = getProvider();
            const program = new Program(idl, programID, provider);
            const [vaultAccount, vaultAccountBump] = 
                await web3.PublicKey.findProgramAddress(
                    [
                    program.programId.toBuffer(),
                    Buffer.from(vault_account_prefix)
                    ],
                    program.programId
                );
            setVaultAccount(vaultAccount);
            setVaultAccountBump(vaultAccountBump);
        }
        fetchValutAccount();
    },[])
    useEffect(()=> {
        if(props.nft.nftMint) {
            setMintAddress(props.nft.nftMint);
        }
    },[props.nft])

    return(
        <>
            {staked&&<div>
                <input type="checkbox" onChange={(e) => handleChange(e)}/>
                <h6>owner:{props.nft.owner.toString()}</h6>
                <h6>TokenAddress:{props.nft.nftMint.toString()}</h6>
                <button onClick={() => unStakeNFT()}>UnStake</button>
            </div>}
        </>
    )
}

export default StakedNftBox;