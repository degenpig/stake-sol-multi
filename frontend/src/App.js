import "./App.css";
import { Metaplex } from "@metaplex-foundation/js";
import { clusterApiUrl, Connection, PublicKey,sendAndConfirmTransaction,Transaction  } from "@solana/web3.js";
import { useState, useEffect } from "react";
import  NftBox  from './NftBox';
import StakedNftBox from './StakedNftBox';

import { Program, AnchorProvider, web3 } from '@project-serum/anchor';
// import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import idl from './idl.json';

// SystemProgram is a reference to the Solana runtime!
const { SystemProgram } = web3;

// Get our program's id from the IDL file.
const programID = new PublicKey(idl.metadata.address);
const systemProgram = web3.SystemProgram.programId;
const rentSysvar = web3.SYSVAR_RENT_PUBKEY;
const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey( 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const TOKEN_PROGRAM_ID = new PublicKey(
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
)

// Set our network to devnet.
const network = clusterApiUrl('devnet');

// Controls how we want to acknowledge when a transaction is "done".
const opts = {
  preflightCommitment: "processed"
}

const vault_account_prefix = "vault_account";

const connection = new Connection(clusterApiUrl("devnet"));
const mx = Metaplex.make(connection);

function App() {
  const [address, setAddress] = useState(
    ""
  );
  const [vaultAccountBump, setVaultAccountBump] = useState(0);
  const [vaultAccount, setVaultAccount] = useState('');
  const [stakedNFTs, setStakedNFT] = useState([]);
  const [multiNfts, setMultiNFTs] = useState([]);
  const [multiStakedNFTs, setMultiStakeNFTs] = useState([]);


  const [nfts, setNft] = useState(null);

  const getProvider = () => {
    const connection = new Connection(network, opts.preflightCommitment);
    const provider = new AnchorProvider(connection, window.solana, opts.preflightCommitment,);
    
    return provider;
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

  const getStakedNFTs = async() => {
    setStakedNFT([]);
    const provider = getProvider();
    const program = new Program(idl, programID, provider);
    const vaultAccountData = await program.account.vaultAccount.fetch(vaultAccount);
    const asset = await mx.nfts().findAllByOwner({ owner: new PublicKey(address) });
    let addresses = [];
    for (let i=0; i<asset.length;i++) {
      addresses.push(asset[i].mintAddress.toString())
    }
    console.log(vaultAccountData);
    const stakedNFTs = [];
    for(let i=0; i<vaultAccountData.nftItemsStaked.length;i++) {
      if(address == vaultAccountData.nftItemsStaked[i].owner.toString()&&!addresses.includes(vaultAccountData.nftItemsStaked[i].nftMint.toString())){
        stakedNFTs.push(vaultAccountData.nftItemsStaked[i]);
      }
    }
    setStakedNFT(stakedNFTs);

  }

  const checkIfWalletIsConnected  = async () => {
    try {
      const { solana } = window;

      if (solana) {
        if (solana.isPhantom) {
          console.log('phantom wallet found!');

          const response = await solana.connect();
          console.log('Connected with publick key:', response.publicKey.toString());
          setAddress(response.publicKey.toString());
        }
      } 
    } catch (error) {
      console.log(error);
    }
  }
  const fetchNft = async () => {
    const asset = await mx.nfts().findAllByOwner({ owner: new PublicKey(address) });
    setNft(asset);
  };

  const multiState  = async () => {
    const provider = getProvider();
    const program = new Program(idl, programID, provider);

    let tx = new Transaction();
    const wallet = new PublicKey(address);
    for(let i = 0; i< multiNfts.length;i++) {
      const nftTokenAccount = (await PublicKey.findProgramAddress(
        [
            wallet.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            multiNfts[i].toBuffer()
        ],
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
      ))[0];
      const stake_tx = await program.methods.stakeNft().accounts(
        {
          owner:wallet,
          vaultAccount,
          nftMint:multiNfts[i],
          nftTokenAccount:nftTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram,
          rent: rentSysvar
        }
      ).instruction();
      tx.add(stake_tx);

    }
    tx.feePayer = new PublicKey(address);
    let blockhashObj = await connection.getRecentBlockhash();
    tx.recentBlockhash =  blockhashObj.blockhash;

    if(tx) {
      console.log("Txn created successfully");
    }                

    await provider.sendAndConfirm(tx);
    fetchNft();
    setMultiNFTs([]);
  }

  const multiUnState  = async () => {
    const provider = getProvider();
    const program = new Program(idl, programID, provider);

    let tx = new Transaction();
    const wallet = new PublicKey(address);
    for(let i = 0; i< multiStakedNFTs.length;i++) {
      const nftTokenAccount = (await PublicKey.findProgramAddress(
        [
            wallet.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            multiStakedNFTs[i].toBuffer()
        ],
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
      ))[0];
      const unstake_tx = await program.methods.unstakeNft().accounts(
        {
          owner:wallet,
          vaultAccount,
          nftMint:multiStakedNFTs[i],
          nftTokenAccount:nftTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        }
      ).instruction();
      tx.add(unstake_tx);

    }
    tx.feePayer = new PublicKey(address);
    let blockhashObj = await connection.getRecentBlockhash();
    tx.recentBlockhash =  blockhashObj.blockhash;

    if(tx) {
      console.log("Txn created successfully");
    }                

    await provider.sendAndConfirm(tx);
    getStakedNFTs();
    setMultiStakeNFTs([]);
    fetchNft();
  }
  
  useEffect(() => {
    const onLoad = async () => {
      await checkIfWalletIsConnected();
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  useEffect(() => {
    if(address)
    {
      fetchNft();
    }    
  },[address])






  return (
    <div className="App">
      <div className="container">
        <h1 className="title">NFT Mint Address</h1>
        <div className="nftForm">
          <input
            type="text"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
          <button onClick={fetchNft}>Fetch</button>
        </div>
        <button onClick={()=> multiState()}>Multi Stake</button>
        {nfts && nfts.map((nft,key) => {
          return(
            <NftBox nft={nft} key={key} walletAddress={address} multiNfts={multiNfts} setMultiNFTs={setMultiNFTs}/>
          )
        })}
        {vaultAccount!='' && vaultAccountBump!=0 &&address!=''&&<button onClick={() => getStakedNFTs()}>Get staked NFT</button>}
        <button onClick={()=> multiUnState()}>Multi InStake</button>
        {
          stakedNFTs.length!=0&& stakedNFTs.map((nft,key) => {
            return(
              <StakedNftBox nft={nft} key={key} walletAddress={address} multiStakedNFTs={multiStakedNFTs} setMultiStakeNFTs={setMultiStakeNFTs}/>
            )
          })
        }
      </div>
    </div>
  );
}

export default App;
