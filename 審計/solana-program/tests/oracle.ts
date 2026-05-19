import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ProphecyArena } from "../target/types/prophecy_arena";
import { assert } from "chai";

describe("Oracle Resolution Logic", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ProphecyArena as Program<ProphecyArena>;

  let marketId = new anchor.BN(Date.now() % 100000);
  let admin = anchor.web3.Keypair.generate();
  let oracle = anchor.web3.Keypair.generate();
  let marketPda: anchor.web3.PublicKey;

  before(async () => {
    // Airdrop SOL to admin and oracle
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(admin.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL),
      "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(oracle.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL),
      "confirmed"
    );

    // Derive market PDA
    [marketPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("market"), marketId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
  });

  it("should create a market with an oracle authority", async () => {
    // Simulate start time 10 seconds ago so we can resolve it immediately
    const startTime = new anchor.BN(Math.floor(Date.now() / 1000) - 10);

    await program.methods
      .createMarket(marketId, startTime, oracle.publicKey)
      .accounts({
        market: marketPda,
        authority: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const marketState = await program.account.market.fetch(marketPda);
    assert.ok(marketState.authority.equals(admin.publicKey));
    assert.ok(marketState.oracleAuthority.equals(oracle.publicKey));
  });

  it("should reject resolution from a random unauthorized key", async () => {
    const maliciousUser = anchor.web3.Keypair.generate();
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(maliciousUser.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL),
      "confirmed"
    );

    try {
      await program.methods
        .resolveMarket({ home: {} })
        .accounts({
          market: marketPda,
          authority: maliciousUser.publicKey,
        })
        .signers([maliciousUser])
        .rpc();
      assert.fail("Should have failed with UnauthorizedOracle");
    } catch (error) {
      assert.include(error.toString(), "Unauthorized oracle signer");
    }
  });

  it("should successfully resolve the market using the oracle authority", async () => {
    await program.methods
      .resolveMarket({ away: {} })
      .accounts({
        market: marketPda,
        authority: oracle.publicKey,
      })
      .signers([oracle])
      .rpc();

    const marketState = await program.account.market.fetch(marketPda);
    assert.deepEqual(marketState.result, { away: {} });
    // Status 1 is Resolved
    assert.deepEqual(marketState.status, { resolved: {} });
  });
});
