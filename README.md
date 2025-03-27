# Starknet Account Deployment Toolkit

## Overview

This project provides a set of tools for creating and deploying Argent wallets on the Starknet network, specifically targeting the Sepolia testnet. It includes scripts for:
- Checking token balances
- Funding new accounts
- Creating and deploying Argent wallet accounts

## Prerequisites

- Node.js (v18 or later)
- npm
- A Starknet Sepolia testnet account with some funds for initial deployment

## Installation

1. Clone the repository:
```bash
git clone https://github.com/web3normad/stark-account-deploy.git
cd stark-account-deploy
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the project root with the following configurations:
```
# Starknet RPC Node URL
STARKNET_NODE_URL=https://free-rpc.nethermind.io/sepolia-juno/v0_8

# Funding Account Details (Optional)
FUND_ACCOUNT=true
FUNDER_PRIVATE_KEY=your_private_key
FUNDER_ADDRESS=your_funder_account_address

# Funding Amounts (in wei)
ETH_FUNDING_AMOUNT=2000000000000000
STRK_FUNDING_AMOUNT=2000000000000000
```

## Scripts

### Check Balance
Checks the STRK and ETH balances for a given Starknet address:
```bash
node check-balance.js <your_address>
```

### Create and Deploy Argent Wallet
Creates a new Argent wallet, funds it, and deploys it to the Sepolia testnet:
```bash
node create-wallet.js
```

## Features

- Automatic RPC provider fallback
- Flexible funding mechanism
- Support for both ETH and STRK tokens
- Detailed logging and error handling
- Wallet information saved to `wallet-info.json`

## Environment Variables

- `STARKNET_NODE_URL`: RPC endpoint for Starknet Sepolia
- `FUND_ACCOUNT`: Enable/disable automatic account funding
- `FUNDER_PRIVATE_KEY`: Private key of the account funding new wallets
- `FUNDER_ADDRESS`: Address of the funding account
- `ETH_FUNDING_AMOUNT`: Amount of ETH to fund (in wei)
- `STRK_FUNDING_AMOUNT`: Amount of STRK to fund (in wei)

## Troubleshooting

- Ensure your funder account has sufficient ETH and STRK balances
- Check network connectivity
- Verify RPC endpoint availability
- Confirm .env file configurations

## Security Notes

- Never commit your private keys to version control
- Use environment variables or secure key management
- This is a testnet tool - do not use with mainnet funds

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

## License

MIT License

## Disclaimer

This tool is for educational and development purposes on the Starknet Sepolia testnet. Use at your own risk.
