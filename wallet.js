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
const NODE_URL = process.env.STARKNET_NODE_URL || 'https://free-rpc.nethermind.io/sepolia-juno/v0_8';
const FUND_ACCOUNT = process.env.FUND_ACCOUNT !== 'false'; 
const ETH_FUNDING_AMOUNT = process.env.ETH_FUNDING_AMOUNT || '2000000000000000'; 
const STRK_FUNDING_AMOUNT = process.env.STRK_FUNDING_AMOUNT || '2000000000000000'; 
const FUNDER_PRIVATE_KEY = process.env.FUNDER_PRIVATE_KEY; 
const FUNDER_ADDRESS = process.env.FUNDER_ADDRESS; 
const ETH_CONTRACT = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
const STRK_CONTRACT = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"; 

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
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [
      {
        "name": "account",
        "type": "core::starknet::contract_address::ContractAddress"
      }
    ],
    "outputs": [
      {
        "type": "core::integer::u256"
      }
    ],
    "state_mutability": "view"
  }
];

// Function to fund the account with ETH or STRK
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
    const provider = new RpcProvider({ nodeUrl: NODE_URL });
    const funderAccount = new Account(provider, FUNDER_ADDRESS, FUNDER_PRIVATE_KEY);
    let fundingSuccess = true;

    // Fund with ETH 
    if (tokenType === 'all' || tokenType === 'eth') {
      console.log(`Attempting to fund account ${accountAddress} with ${Number(ETH_FUNDING_AMOUNT) / 1e18} ETH...`);

      const ethContract = new Contract(tokenAbi, ETH_CONTRACT, provider);
      ethContract.connect(funderAccount);

      const ethBalanceResponse = await ethContract.balanceOf(FUNDER_ADDRESS);
      const ethBalance = BigInt(ethBalanceResponse.toString());

      if (ethBalance < BigInt(ETH_FUNDING_AMOUNT)) {
        console.log(`❌ Funder account has insufficient ETH: ${Number(ethBalance) / 1e18} ETH`);
        console.log(`Required: ${Number(ETH_FUNDING_AMOUNT) / 1e18} ETH`);
        fundingSuccess = false;
      } else {
        const ethAmount = {
          low: BigInt(ETH_FUNDING_AMOUNT) & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'),
          high: BigInt(ETH_FUNDING_AMOUNT) >> BigInt(128),
        };

        console.log(`Transferring ${Number(ETH_FUNDING_AMOUNT) / 1e18} ETH to ${accountAddress}...`);

        // Generate hash signature
        const txHash = hash.computeHashOnElements([
          FUNDER_ADDRESS,
          ETH_CONTRACT,
          'transfer',
          accountAddress,
          ethAmount.low,
          ethAmount.high,
        ]);
        const signature = ec.starkCurve.sign(txHash, FUNDER_PRIVATE_KEY);

        const ethTx = await funderAccount.execute([
          {
            contractAddress: ETH_CONTRACT,
            entrypoint: 'transfer',
            calldata: [accountAddress, ethAmount.low, ethAmount.high],
          },
        ], undefined, {
          maxFee: '0x100000', 
          nonce: await funderAccount.getNonce(),
          signature: [signature.r.toString(), signature.s.toString()], 
        });

        console.log('ETH funding transaction hash:', ethTx.transaction_hash);
        console.log('Waiting for ETH transaction confirmation...');

        await provider.waitForTransaction(ethTx.transaction_hash);
        console.log('✅ ETH funding transaction confirmed!');
      }
    }

    // Similar logic for STRK funding...

    return fundingSuccess;
  } catch (error) {
    console.error('Error funding account:', error);
    return false;
  }
}

// Function to create and deploy an Argent account
async function createAndDeployArgentAccount() {
  try {
    console.log('=== Creating and Deploying Argent Wallet ===');

    // Step 1: Create the wallet
    console.log('Creating Argent wallet...');
    const provider = new RpcProvider({ nodeUrl: NODE_URL });

    const privateKey = stark.randomAddress();
    const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);

    console.log('\n--- Keys Generated ---');
    console.log('Private Key:', privateKey);
    console.log('Public Key:', starkKeyPub);

    const argentAccountClassHash = '0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f';

    const axSigner = new CairoCustomEnum({ Starknet: { pubkey: starkKeyPub } });
    const axGuardian = new CairoOption(CairoOptionVariant.None);
    const argentConstructorCallData = CallData.compile({
      owner: axSigner,
      guardian: axGuardian,
    });

    const contractAddress = hash.calculateContractAddressFromHash(
      starkKeyPub,
      argentAccountClassHash,
      argentConstructorCallData,
      0
    );

    console.log('\n--- Account Information ---');
    console.log('Precalculated Address:', contractAddress);

    // Save wallet info to file
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

    // Step 2: Fund the wallet
    console.log('\n=== Funding Wallet ===');
    const funded = await fundAccount(contractAddress, 'all');

    if (!funded) {
      console.log('\n⚠️ Funding failed. You need to fund this address manually before deployment.');
      console.log(`Address: ${contractAddress}`);
      console.log(`Required ETH amount: ${Number(ETH_FUNDING_AMOUNT) / 1e18} ETH`);
      console.log(`Required STRK amount: ${Number(STRK_FUNDING_AMOUNT) / 1e18} STRK`);
      return;
    }

    // Step 3: Deploy the wallet
    console.log('\n=== Deploying Wallet ===');
    const account = new Account(provider, contractAddress, privateKey);

    const deployAccountPayload = {
      classHash: argentAccountClassHash,
      constructorCalldata: argentConstructorCallData,
      contractAddress: contractAddress,
      addressSalt: starkKeyPub,
    };

    const { transaction_hash, contract_address } = await account.deployAccount(deployAccountPayload);

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
  } catch (error) {
    console.error('Error in create and deploy process:', error);
    throw error;
  }
}

// Run the script
createAndDeployArgentAccount();