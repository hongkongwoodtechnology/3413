# Solana Sports Prediction DApp

## Project Overview
A decentralized sports prediction platform on Solana designed to bridge the gap between traditional sports fans and Web3 technology.

## Design Philosophy
- **Progressive Disclosure**: Hide complex blockchain details until necessary.
- **Metaphors**: Use familiar sports betting concepts.
- **Transparency**: Clear status updates for transactions and settlements.
- **Safety**: Explicit confirmation and guidance for key actions.

## User Journey (Key Scenarios)
1. **Discovery & Connection**: Landing page with clear value prop -> Wallet connection.
2. **Education**: Onboarding guide explaining "Wallet as Account" and "Prediction Settlement".
3. **Prediction Flow**:
   - Match selection
   - Amount input (with real-time calculation of potential winnings and fees)
   - Wallet confirmation
   - Transaction status feedback

## Architecture & Navigation
- **Home**: Match discovery.
- **My Predictions**: Active, Claimable, History.
- **Leaderboard**: Top predictors (P1).
- **Stats**: Market analysis (P2).

## Key Features
- **Wallet Integration**: Phantom, Solflare.
- **Real-time Odds**: Display current odds and potential returns.
- **Transaction Feedback**: Detailed status for blockchain interactions.
- **Dispute Resolution**: Community voting mechanism for controversial results.

## Tech Stack (Proposed)
- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Blockchain Interaction**: @solana/web3.js, @solana/wallet-adapter
- **UI Components**: shadcn/ui (or similar) for accessible, consistent design.
