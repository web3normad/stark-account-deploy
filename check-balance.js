import { RpcProvider, Contract, uint256 } from 'starknet';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

// Configuration
const NODE_URL = process.env.STARKNET_NODE_URL || 'https://free-rpc.nethermind.io/sepolia-juno/v0_7';
const STRK_CONTRACT = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const ETH_CONTRACT = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

// ABI
const tokenAbi = [
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
  },
  {
    "type": "function",
    "name": "balance_of",
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

async function getTokenBalance(provider, tokenAddress, address, tokenSymbol) {
  console.log(`Checking ${tokenSymbol} balance...`);
  try {
    const contract = new Contract(tokenAbi, tokenAddress, provider);
    
    try {
      const result = await contract.balanceOf(address);
      return {
        success: true,
        balance: BigInt(result.toString()),
        method: 'camelCase',
        symbol: tokenSymbol
      };
    } catch (camelErr) {
      console.log(`camelCase method failed for ${tokenSymbol}, trying snake_case...`);
      try {
        const result = await contract.balance_of(address);
        return {
          success: true,
          balance: BigInt(result.toString()),
          method: 'snake_case',
          symbol: tokenSymbol
        };
      } catch (snakeErr) {
        return {
          success: false,
          error: `Both camelCase and snake_case methods failed for ${tokenSymbol}`,
          details: snakeErr.message
        };
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `Error checking ${tokenSymbol} balance`,
      details: error.message
    };
  }
}

async function checkBalances(address) {
  try {
    console.log('Checking balances for address:', address);
    console.log('Using RPC provider:', NODE_URL);
    
    const provider = new RpcProvider({ nodeUrl: NODE_URL });
    
    // Check both token balances
    const [strkResult, ethResult] = await Promise.all([
      getTokenBalance(provider, STRK_CONTRACT, address, 'STRK'),
      getTokenBalance(provider, ETH_CONTRACT, address, 'ETH')
    ]);
    
    console.log('\n-----------------------------');
    console.log('BALANCE RESULTS');
    console.log('-----------------------------');
    
    // Display STRK balance
    if (strkResult.success) {
      const formattedBalance = Number(strkResult.balance) / 1e18;
      console.log(`STRK Balance: ${formattedBalance} STRK (${strkResult.balance} wei)`);
      console.log(`Retrieved using ${strkResult.method} method`);
      
      if (strkResult.balance === 0n) {
        console.log('⚠️ No STRK tokens found in this account.');
      } else if (strkResult.balance < BigInt(1e16)) {
        console.log('⚠️ Very low STRK balance (less than 0.01 STRK).');
      }
    } else {
      console.log('❌ Failed to retrieve STRK balance:');
      console.log(strkResult.error);
    }
    
    console.log('-----------------------------');
    
    // Display ETH balance
    if (ethResult.success) {
      const formattedBalance = Number(ethResult.balance) / 1e18;
      console.log(`ETH Balance: ${formattedBalance} ETH (${ethResult.balance} wei)`);
      console.log(`Retrieved using ${ethResult.method} method`);
      
      if (ethResult.balance === 0n) {
        console.log('⚠️ No ETH tokens found in this account.');
      } else if (ethResult.balance < BigInt(1e16)) {
        console.log('⚠️ Very low ETH balance (less than 0.01 ETH).');
      }
    } else {
      console.log('❌ Failed to retrieve ETH balance:');
      console.log(ethResult.error);
    }
    
    console.log('-----------------------------');
    
    
    if (strkResult.success && ethResult.success) {
      if (strkResult.balance === 0n && ethResult.balance === 0n) {
        console.log('⚠️ The account has no funds. You will need to add funds before deployment.');
        console.log('You can get testnet tokens from a faucet like https://starknet-faucet.vercel.app/');
      } else if (strkResult.balance < BigInt(1e16) && ethResult.balance < BigInt(1e16)) {
        console.log('⚠️ The account has very low balances, which might not be enough for deployment.');
        console.log('Consider adding more funds before deployment.');
      } else {
        console.log('✅ The account has sufficient funds for deployment.');
      }
    } else if (!strkResult.success && !ethResult.success) {
      console.log('\n❌ Could not retrieve any balances.');
      console.log('This could mean:');
      console.log('1. The account doesn\'t exist yet');
      console.log('2. There is an issue with the RPC endpoint');
      console.log('3. The network might be congested');
      console.log('4. The contracts do not expose the expected balanceOf/balance_of methods');
    }
    
    return {
      strk: strkResult.success ? strkResult.balance : null,
      eth: ethResult.success ? ethResult.balance : null
    };
  } catch (error) {
    console.error('Error checking balances:', error);
    return { strk: null, eth: null };
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const address = args[0];
    
    if (!address) {
      console.error('Please provide an address: node check-balance.js <address>');
      process.exit(1);
    }
    
    await checkBalances(address);
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

main();