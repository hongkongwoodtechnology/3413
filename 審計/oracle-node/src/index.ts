import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as winston from 'winston';
import * as fs from 'fs';

dotenv.config();

// --- Logger Setup ---
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'oracle-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'oracle-combined.log' }),
  ],
});

// --- Configuration ---
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const ORACLE_PRIVATE_KEY_PATH = process.env.ORACLE_PRIVATE_KEY_PATH || './oracle-keypair.json';
const SPORTS_API_KEY = process.env.SPORTS_API_KEY || 'demo-key';
const PROGRAM_ID = new PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');

// Retry config
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 2000; // ms

// --- Mock IDL for Prophecy Arena ---
const IDL = {
  version: "0.1.0",
  name: "prophecy_arena",
  instructions: [
    {
      name: "resolveMarket",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "authority", isMut: false, isSigner: true }
      ],
      args: [
        {
          name: "result",
          type: {
            defined: "Outcome"
          }
        }
      ]
    }
  ],
  types: [
    {
      name: "Outcome",
      type: {
        kind: "enum",
        variants: [
          { name: "Home" },
          { name: "Draw" },
          { name: "Away" }
        ]
      }
    }
  ]
};

class OracleNode {
  private connection: Connection;
  private oracleKeypair: Keypair;
  private program: anchor.Program;

  constructor() {
    this.connection = new Connection(RPC_URL, 'confirmed');
    
    // Load Keypair
    if (fs.existsSync(ORACLE_PRIVATE_KEY_PATH)) {
      const keypairData = JSON.parse(fs.readFileSync(ORACLE_PRIVATE_KEY_PATH, 'utf-8'));
      this.oracleKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    } else {
      logger.warn('No oracle keypair found, generating a random one for dev mode.');
      this.oracleKeypair = Keypair.generate();
    }

    const wallet = new anchor.Wallet(this.oracleKeypair);
    const provider = new anchor.AnchorProvider(this.connection, wallet, { preflightCommitment: 'confirmed' });
    this.program = new anchor.Program(IDL as anchor.Idl, PROGRAM_ID, provider);

    logger.info(`Oracle Node Initialized. Public Key: ${this.oracleKeypair.publicKey.toBase58()}`);
  }

  /**
   * Fetch Match Result from API-Football
   */
  private async fetchMatchResult(matchId: number): Promise<{ homeScore: number, awayScore: number } | null> {
    try {
      // Mocking API call to sports data provider
      logger.info(`Fetching data for match ${matchId} from primary source...`);
      const response = await axios.get(`https://v3.football.api-sports.io/fixtures?id=${matchId}`, {
        headers: {
          'x-apisports-key': SPORTS_API_KEY
        }
      });

      if (response.data.errors.length > 0) {
        throw new Error(JSON.stringify(response.data.errors));
      }

      const fixture = response.data.response[0];
      if (!fixture) {
        logger.error(`Match ${matchId} not found in API.`);
        return null;
      }

      // Check if match is finished (Short: FT = Full Time)
      if (fixture.fixture.status.short !== 'FT') {
        logger.info(`Match ${matchId} has not finished yet. Status: ${fixture.fixture.status.short}`);
        return null;
      }

      return {
        homeScore: fixture.goals.home,
        awayScore: fixture.goals.away
      };
    } catch (error) {
      logger.error(`Error fetching match result: ${error}`);
      return null;
    }
  }

  /**
   * Determine Outcome Enum based on scores
   */
  private determineOutcome(homeScore: number, awayScore: number) {
    if (homeScore > awayScore) return { home: {} };
    if (homeScore === awayScore) return { draw: {} };
    return { away: {} };
  }

  /**
   * Resolve a match on-chain
   */
  public async resolveMatchOnChain(matchId: number, homeScore: number, awayScore: number) {
    const outcome = this.determineOutcome(homeScore, awayScore);
    logger.info(`Resolving Match ${matchId}. Home: ${homeScore}, Away: ${awayScore}. Outcome: ${JSON.stringify(outcome)}`);

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), new anchor.BN(matchId).toArrayLike(Buffer, 'le', 8)],
      PROGRAM_ID
    );

    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        const txHash = await this.program.methods
          .resolveMarket(outcome)
          .accounts({
            market: marketPda,
            authority: this.oracleKeypair.publicKey,
          })
          .signers([this.oracleKeypair])
          .rpc({ skipPreflight: false });

        logger.info(`Successfully resolved match ${matchId} on-chain! TxHash: ${txHash}`);
        return true;
      } catch (error) {
        attempt++;
        logger.error(`Failed to resolve match on-chain (Attempt ${attempt}/${MAX_RETRIES}): ${error}`);
        if (attempt >= MAX_RETRIES) {
          logger.error(`CRITICAL: Max retries reached for match ${matchId}. Manual intervention required.`);
          return false;
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, BASE_RETRY_DELAY * Math.pow(2, attempt - 1)));
      }
    }
  }

  /**
   * Main loop to poll pending matches
   * In a real system, this would index the blockchain or a DB for unresolved markets
   * whose start_time + 105 mins has passed.
   */
  public async processPendingMatch(matchId: number) {
    const result = await this.fetchMatchResult(matchId);
    if (result) {
      await this.resolveMatchOnChain(matchId, result.homeScore, result.awayScore);
    }
  }
}

// Entry Point
const node = new OracleNode();
// Example: Attempt to process match 718243
// setInterval(() => node.processPendingMatch(718243), 60000); // Check every minute
