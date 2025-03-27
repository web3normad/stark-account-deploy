import { Account, RpcProvider } from 'starknet';


const providerUrls = [
  'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/o1lEX0VBV5svBnSxttojbhEM0_p6uy4_', 
  'https://sepolia-rpc.starknet.io',
  'https://starknet-sepolia.g.alchemy.com/v2/demo'
];

async function deployAccount() {
  let provider;
  let connectedProvider = false;
  
 
  for (const url of providerUrls) {
    try {
      provider = new RpcProvider({ nodeUrl: url });
      await provider.getBlockNumber();
      console.log(`Connected to ${url}`);
      connectedProvider = true;
      break;
    } catch (error) {
      console.warn(`Failed to connect to ${url}`, error.message);
    }
  }
  
  if (!connectedProvider) {
    console.error("Failed to connect to any provider. Check your internet connection.");
    return;
  }
  
  try {
    
    const privateKey = '0x0091d40126b16a9e7ee4cac7ba7879466a355123ee2c82d54b6a2dc1ab2c6be0';
    const accountAddress = '0x04e3cf1c178def1efe7cc912e0ad45949ee10fe4cfd03afd6ec7e63381493097';
    
    
    const account = new Account(provider, accountAddress, privateKey);
    
    console.log("Attempting to deploy account...");
    console.log("Account address:", accountAddress);
    
   
    const deployResponse = await account.deployAccount({
      classHash: '0x36078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f',
      constructorCalldata: ['0x0', '0x7fb2c771926ef69ebd6f12af37976978301ae5e1f3025d67618f144f89e8ace', '0x1'],
      addressSalt: '0x7fb2c771926ef69ebd6f12af37976978301ae5e1f3025d67618f144f89e8ace',
      maxFee: '0x38D7EA4C68000' 
    });
    
    console.log('Deployment transaction hash:', deployResponse.transaction_hash);
    console.log('Waiting for transaction to be confirmed...');
    
    
    await provider.waitForTransaction(deployResponse.transaction_hash);
    
    console.log('Account successfully deployed!');
    
  } catch (error) {
    console.error('Error deploying account:', error);
    console.error('Error details:', error.message);
    
    if (error.message.includes('Max fee')) {
      console.log("Try lowering the maxFee value in the script");
    } else if (error.message.includes('fetch failed')) {
      console.log("Network connectivity issue. Check your internet connection.");
    }
  }
}

deployAccount();