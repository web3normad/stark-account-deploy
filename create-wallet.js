import {
  Account,
  ec,
  stark,
  RpcProvider,
  hash,
  CallData,
  CairoOption,
  CairoOptionVariant,
  CairoCustomEnum,
  Contract,
} from 'starknet';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Configuration
const NODE_URL = process.env.STARKNET_NODE_URL || 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/o1lEX0VBV5svBnSxttojbhEM0_p6uy4_';
const FUND_ACCOUNT = process.env.FUND_ACCOUNT !== 'false'; 
const ETH_FUNDING_AMOUNT = process.env.ETH_FUNDING_AMOUNT || '2000000000000000'; 
const STRK_FUNDING_AMOUNT = process.env.STRK_FUNDING_AMOUNT || '2000000000000000'; 
const FUNDER_PRIVATE_KEY = process.env.FUNDER_PRIVATE_KEY; 
const FUNDER_ADDRESS = process.env.FUNDER_ADDRESS; 

// Contracts
const ETH_CONTRACT = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
const STRK_CONTRACT = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"; 
const ARGENT_ACCOUNT_CLASS_HASH = '0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f';

// ERC20 ABI 
const tokenAbi = [
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      {
        "name": "recipient",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "amount",
        "type": "core::integer::u256"
      }
    ],
    "outputs": [
      {
        "type": "core::bool"
      }
    ],
    "state_mutability": "external"
  }
];

// Account funding
async function fundAccount(accountAddress, tokenType = 'all') {
  if (!FUND_ACCOUNT) {
    console.log('Auto-funding disabled. Please fund the account manually.');
    return false;
  }

  if (!FUNDER_PRIVATE_KEY || !FUNDER_ADDRESS) {
    console.log('❌ Funder information missing in .env file. Please set FUNDER_PRIVATE_KEY and FUNDER_ADDRESS.');
    return false;
  }

  try {
    const provider = new RpcProvider({ 
      nodeUrl: NODE_URL,
      rpcVersion: '0.7' 
    });

    
    const funderAccount = new Account(
      provider, 
      FUNDER_ADDRESS, 
      FUNDER_PRIVATE_KEY, 
      '1'  
    );

    async function fundToken(tokenContractAddress, tokenType, fundingAmount) {
      console.log(`Attempting to fund ${accountAddress} with ${Number(fundingAmount) / 1e18} ${tokenType.toUpperCase()}...`);

      try {
        
        const tokenContract = new Contract(tokenAbi, tokenContractAddress, provider);
        tokenContract.connect(funderAccount);

       
        const tokenAmount = {
          low: (BigInt(fundingAmount) & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')).toString(),
          high: (BigInt(fundingAmount) >> BigInt(128)).toString()
        };

        
        const transferCall = {
          contractAddress: tokenContractAddress,
          entrypoint: 'transfer',
          calldata: CallData.compile({
            recipient: accountAddress,
            amount: tokenAmount
          })
        };

       
        const txConfig = {
          version: 3,
          nonce: await funderAccount.getNonce(),
          maxFee: 0,  // Let network estimate
          skipValidate: true
        };

        const tx = await funderAccount.execute(
          [transferCall], 
          undefined, 
          txConfig
        );

        console.log(`${tokenType.toUpperCase()} Transfer Hash:`, tx.transaction_hash);

        
        await provider.waitForTransaction(tx.transaction_hash, { 
          retryInterval: 2000,  
          maxRetries: 10         
        });

        console.log(`✅ Successfully funded ${accountAddress} with ${tokenType.toUpperCase()}`);
        return true;
      } catch (error) {
        console.error(`Funding ${tokenType.toUpperCase()} Error:`, error);
        return false;
      }
    }

    let fundingResults = [];

    
    if (tokenType === 'all' || tokenType === 'eth') {
      const ethFundResult = await fundToken(ETH_CONTRACT, 'eth', ETH_FUNDING_AMOUNT);
      fundingResults.push(ethFundResult);
    }

    if (tokenType === 'all' || tokenType === 'strk') {
      const strkFundResult = await fundToken(STRK_CONTRACT, 'strk', STRK_FUNDING_AMOUNT);
      fundingResults.push(strkFundResult);
    }

   
    return fundingResults.every(result => result === true);

  } catch (error) {
    console.error('Comprehensive Funding Error:', error);
    return false;
  }
}

// Function to create and deploy an Argent account
async function createAndDeployArgentAccount() {
  try {
    console.log('=== Creating and Deploying Argent Wallet ===');

    // Create the wallet
    console.log('Creating Argent wallet...');
    const provider = new RpcProvider({ 
      nodeUrl: NODE_URL,
      rpcVersion: '0.7'
    });

    // Generate keys
    const privateKey = stark.randomAddress();
    const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);

    console.log('\n--- Keys Generated ---');
    console.log('Private Key:', privateKey);
    console.log('Public Key:', starkKeyPub);

    // Prepare constructor arguments
    const axSigner = new CairoCustomEnum({ Starknet: { pubkey: starkKeyPub } });
    const axGuardian = new CairoOption(CairoOptionVariant.None);
    const argentConstructorCallData = CallData.compile({
      owner: axSigner,
      guardian: axGuardian,
    });

    // Calculate contract address
    const contractAddress = hash.calculateContractAddressFromHash(
      starkKeyPub,
      ARGENT_ACCOUNT_CLASS_HASH,
      argentConstructorCallData,
      0
    );

    console.log('\n--- Account Information ---');
    console.log('Precalculated Address:', contractAddress);

    // Save wallet info
    const walletInfo = {
      type: 'Argent',
      privateKey,
      publicKey: starkKeyPub,
      address: contractAddress,
      deployed: false,
      ethFundingAmount: ETH_FUNDING_AMOUNT,
      strkFundingAmount: STRK_FUNDING_AMOUNT,
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync('./wallet-info.json', JSON.stringify(walletInfo, null, 2));
    console.log('\n✅ Wallet information saved to wallet-info.json');

    // Fund the wallet
    console.log('\n=== Funding Wallet ===');
    const funded = await fundAccount(contractAddress);

    if (!funded) {
      console.log('\n⚠️ Funding failed. You need to fund this address manually before deployment.');
      console.log(`Address: ${contractAddress}`);
      console.log(`Required ETH amount: ${Number(ETH_FUNDING_AMOUNT) / 1e18} ETH`);
      console.log(`Required STRK amount: ${Number(STRK_FUNDING_AMOUNT) / 1e18} STRK`);
      return;
    }

    //  Deploy the wallet
    console.log('\n=== Deploying Wallet ===');
    const account = new Account(provider, contractAddress, privateKey);

    const deployAccountPayload = {
      classHash: ARGENT_ACCOUNT_CLASS_HASH,
      constructorCalldata: argentConstructorCallData,
      contractAddress: contractAddress,
      addressSalt: starkKeyPub,
    };

    const { transaction_hash, contract_address } = await account.deployAccount({
      classHash: ARGENT_ACCOUNT_CLASS_HASH,
      constructorCalldata: argentConstructorCallData,
      contractAddress: contractAddress,
      addressSalt: starkKeyPub,
      version: 3 
    });

    console.log('Deployment transaction hash:', transaction_hash);
    console.log('Waiting for transaction confirmation...');

    await provider.waitForTransaction(transaction_hash);

    console.log('\n✅ Argent account deployed successfully!');
    console.log('Account address:', contract_address);

    // Update wallet info
    if (fs.existsSync('./wallet-info.json')) {
      const walletInfo = JSON.parse(fs.readFileSync('./wallet-info.json', 'utf8'));
      walletInfo.deployed = true;
      walletInfo.deployedAt = new Date().toISOString();
      walletInfo.deployTxHash = transaction_hash;
      fs.writeFileSync('./wallet-info.json', JSON.stringify(walletInfo, null, 2));
      console.log('Wallet information updated in wallet-info.json');
    }

    return {
      privateKey,
      publicKey: starkKeyPub,
      address: contract_address
    };

  } catch (error) {
    console.error('Error in create and deploy process:', error);
    throw error;
  }
}


createAndDeployArgentAccount()
  .then(() => console.log('Wallet creation process completed successfully'))
  .catch(error => console.error('Wallet creation failed:', error));