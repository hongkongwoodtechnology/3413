#!/bin/bash

# Prophecy Arena Oracle Node Deployment Script
# ---------------------------------------------
# 1. Update system and install dependencies
# 2. Setup Node.js 18
# 3. Install pm2 globally
# 4. Build and start the oracle service

set -e

echo "Starting Oracle Node Deployment..."

# Install dependencies
sudo apt-get update
sudo apt-get install -y curl build-essential

# Install Node.js
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install PM2
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# Go to the oracle node directory
cd "$(dirname "$0")"

# Install NPM packages
echo "Installing Node modules..."
npm install

# Compile TypeScript
echo "Building Oracle Node..."
npm run build

# Generate a default oracle keypair if not exists (for demo purposes)
if [ ! -f "./oracle-keypair.json" ]; then
    echo "Generating a new Oracle Keypair..."
    npx ts-node -e "const { Keypair } = require('@solana/web3.js'); const fs = require('fs'); const kp = Keypair.generate(); fs.writeFileSync('./oracle-keypair.json', JSON.stringify(Array.from(kp.secretKey))); console.log('Generated Oracle Pubkey:', kp.publicKey.toBase58());"
fi

# Setup environment variables
if [ ! -f ".env" ]; then
    echo "SOLANA_RPC_URL=https://api.mainnet-beta.solana.com" > .env
    echo "ORACLE_PRIVATE_KEY_PATH=./oracle-keypair.json" >> .env
    echo "SPORTS_API_KEY=YOUR_API_FOOTBALL_KEY" >> .env
    echo "Created default .env file. Please update SPORTS_API_KEY."
fi

# Start with PM2
echo "Starting service with PM2..."
pm2 start dist/index.js --name "prophecy-oracle-node"

# Save PM2 process list to start on boot
pm2 save
pm2 startup

echo "Oracle Node deployed and running!"
pm2 status
