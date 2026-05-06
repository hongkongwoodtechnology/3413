import { NextResponse } from "next/server";
import { Keypair, PublicKey, Transaction, TransactionInstruction, ComputeBudgetProgram, SystemProgram } from "@solana/web3.js";
import https from "https";
import fs from "fs";
import path from "path";

const ADMIN_ADDRESS = "2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const USDT_DECIMALS = 6;
const PLATFORM_FEE_RATE = 0.08;
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOC_TOKEN_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58ToBytes(b58: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < b58.length; i++) {
    let c = BASE58_ALPHABET.indexOf(b58[i]);
    if (c < 0) throw new Error("Invalid base58 char: " + b58[i]);
    for (let j = 0; j < bytes.length; j++) {
      c += bytes[j] * 58;
      bytes[j] = c & 0xff;
      c >>= 8;
    }
    while (c > 0) {
      bytes.push(c & 0xff);
      c >>= 8;
    }
  }
  for (let i = 0; i < b58.length && b58[i] === "1"; i++) {
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

const RPC_HOSTS = [
  { hostname: "rpc.ankr.com", path: "/solana" },
  { hostname: "api.mainnet-beta.solana.com" },
  { hostname: "solana-api.projectserum.com" },
  { hostname: "solana-rpc.publicnode.com" },
];

function rpcPost(hostname: string, rpcPath: string, body: string, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path: rpcPath || "/", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      timeout: timeoutMs,
    }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        if (res.statusCode === 403 || res.statusCode === 429) reject(new Error(`HTTP ${res.statusCode}`));
        else if (res.statusCode !== 200) reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        else resolve(data);
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("ETIMEDOUT")); });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function rpcCall(body: any, label = "rpc"): Promise<any> {
  const payload = JSON.stringify(body);
  let lastErr: any;
  for (let i = 0; i < RPC_HOSTS.length; i++) {
    try {
      const h = RPC_HOSTS[i];
      const raw = await rpcPost(h.hostname, h.path || "/", payload, 15000);
      const json = JSON.parse(raw);
      if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
      return json;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e);
      if (msg.includes("403") || msg.includes("429") || msg.includes("ETIMEDOUT") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) continue;
      throw e;
    }
  }
  throw lastErr || new Error(`All RPC failed: ${label}`);
}

function findAta(mint: PublicKey, owner: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), mint.toBuffer()],
    ASSOC_TOKEN_PROGRAM
  );
  return ata;
}

function splTransferInstruction(source: PublicKey, dest: PublicKey, owner: PublicKey, amount: bigint): TransactionInstruction {
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0);
  data.writeBigUInt64LE(amount, 1);
  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM,
    data,
  });
}

function createAtaInstruction(payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
    ],
    programId: ASSOC_TOKEN_PROGRAM,
    data: Buffer.alloc(0),
  });
}

async function getBlockhash(): Promise<string> {
  const res = await rpcCall({
    jsonrpc: "2.0", id: 1, method: "getLatestBlockhash",
    params: [{ commitment: "finalized" }],
  }, "blockhash");
  return res.result.value.blockhash;
}

async function getTokenBalance(ata: PublicKey): Promise<bigint> {
  try {
    const res = await rpcCall({
      jsonrpc: "2.0", id: 1, method: "getTokenAccountBalance",
      params: [ata.toBase58(), { commitment: "confirmed" }],
    }, "token_balance");
    return BigInt(res?.result?.value?.amount || "0");
  } catch { return 0n; }
}

async function checkAtaExists(ata: PublicKey): Promise<boolean> {
  try {
    const res = await rpcCall({
      jsonrpc: "2.0", id: 1, method: "getAccountInfo",
      params: [ata.toBase58(), { commitment: "confirmed", encoding: "base64" }],
    }, "ata_check");
    const dataArr = res?.result?.value?.data;
    if (!dataArr) return false;
    const b64 = Array.isArray(dataArr) ? dataArr[0] : dataArr;
    if (!b64 || typeof b64 !== "string") return false;
    return Buffer.from(b64, "base64").length >= 72;
  } catch { return false; }
}

async function sendAndConfirm(adminKeypair: Keypair, tx: Transaction, label: string): Promise<string> {
  tx.partialSign(adminKeypair);
  const rawTx = tx.serialize();
  const sendRes = await rpcCall({
    jsonrpc: "2.0", id: 1, method: "sendTransaction",
    params: [Buffer.from(rawTx).toString("base64"), { encoding: "base64", skipPreflight: false }],
  }, `send_${label}`);
  const signature = sendRes.result;

  for (let i = 0; i < 45; i++) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const statusRes = await rpcCall({
        jsonrpc: "2.0", id: 1, method: "getSignatureStatuses",
        params: [[signature], { searchTransactionHistory: true }],
      }, `confirm_${label}`);
      const s = statusRes.result.value[0];
      if (s?.err) throw new Error(typeof s.err === "string" ? s.err : JSON.stringify(s.err));
      if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") {
        return signature;
      }
    } catch (e: any) {
      if (!String(e).includes("403") && !String(e).includes("429")) throw e;
    }
  }
  throw new Error(`Confirmation timeout: ${signature}`);
}

function loadDb(file: string): any {
  const p = path.join(process.cwd(), "data", file);
  try { if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8")); } catch {}
  return {};
}

function saveDb(file: string, data: any) {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), JSON.stringify(data, null, 2), "utf-8");
}

interface BetRecord {
  id: string; userAddress: string; matchId: number; matchName: string;
  outcome: string; amount: number; odds?: number; signature?: string | null;
  status?: string; useBonus: boolean; timestamp: number; paidOut?: boolean;
}

interface SplitEntry {
  userAddress: string;
  betId: string;
  matchId: number;
  matchName: string;
  type: "refund" | "win";
  amount: number;
  rawAmount: bigint;
}

async function processSplits(
  adminKeypair: Keypair,
  adminAta: PublicKey,
  adminPubkey: PublicKey,
  usdtMint: PublicKey,
  splits: SplitEntry[],
  betsDb: Record<string, BetRecord[]>,
): Promise<{ success: number; failed: number; totalUsdt: number; errors: string[] }> {
  const errors: string[] = [];
  let success = 0;
  let failed = 0;
  let totalUsdt = 0;

  for (const entry of splits) {
    try {
      const destPubkey = new PublicKey(entry.userAddress);
      const destAta = findAta(usdtMint, destPubkey);
      const destAtaExists = await checkAtaExists(destAta);

      const blockhash = await getBlockhash();

      const tx = new Transaction();
      tx.feePayer = adminPubkey;
      tx.recentBlockhash = blockhash;
      tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 }));

      if (!destAtaExists) {
        tx.add(createAtaInstruction(adminPubkey, destAta, destPubkey, usdtMint));
      }
      tx.add(splTransferInstruction(adminAta, destAta, adminPubkey, entry.rawAmount));

      const signature = await sendAndConfirm(adminKeypair, tx, `${entry.type}_${entry.betId}`);
      const label = entry.type === "refund" ? "↩ REFUND" : "✅ WIN";
      console.log(`[AutoPayout] ${label} ${entry.amount.toFixed(4)} USDT → ${entry.userAddress.slice(0, 8)}... | ${entry.matchName} | tx: ${signature}`);

      if (betsDb[entry.userAddress]) {
        for (const bet of betsDb[entry.userAddress]) {
          if (bet.id === entry.betId) { bet.paidOut = true; break; }
        }
      }
      success++;
      totalUsdt += entry.amount;
    } catch (e: any) {
      failed++;
      const errMsg = String(e?.message || e);
      errors.push(`${entry.type} failed ${entry.userAddress}: ${errMsg}`);
      console.error(`[AutoPayout] ❌ ${entry.type} failed: ${entry.userAddress} ${entry.amount}USDT - ${errMsg}`);
    }
  }

  return { success, failed, totalUsdt, errors };
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const logs: string[] = [];

  try {
    const secretKeyStr = process.env.ADMIN_SECRET_KEY?.trim();
    if (!secretKeyStr) {
      return NextResponse.json({
        success: false, error: "ADMIN_SECRET_KEY not set",
        message: "請在 .env.local 中設定 ADMIN_SECRET_KEY",
      }, { status: 400 });
    }

    let secretKey: Uint8Array;
    if (secretKeyStr.startsWith("[")) {
      secretKey = new Uint8Array(JSON.parse(secretKeyStr));
    } else {
      secretKey = base58ToBytes(secretKeyStr);
    }
    const adminKeypair = Keypair.fromSecretKey(secretKey);
    const adminPubkey = new PublicKey(ADMIN_ADDRESS);

    if (adminKeypair.publicKey.toBase58() !== ADMIN_ADDRESS) {
      return NextResponse.json({
        success: false,
        error: "ADMIN_SECRET_KEY does not match ADMIN_ADDRESS",
        expected: ADMIN_ADDRESS,
        actual: adminKeypair.publicKey.toBase58(),
        message: "私鑰對應的錢包地址與 Admin 地址不符，請檢查 ADMIN_SECRET_KEY 是否正確。",
      }, { status: 400 });
    }

    const usdtMint = new PublicKey(USDT_MINT);
    const adminAta = findAta(usdtMint, adminPubkey);

    const betsDb = loadDb("bets_db.json") as Record<string, BetRecord[]>;
    const referralDb = loadDb("referral_db.json");

    // === 情況1：單邊投注 → 退還全額本金（不扣手續費） ===
    const refunds: SplitEntry[] = [];
    for (const [, bets] of Object.entries(betsDb)) {
      for (const bet of bets) {
        if (bet.status === "refunded" && !bet.paidOut && !bet.useBonus && bet.amount > 0) {
          const rawAmt = BigInt(Math.floor(bet.amount * Math.pow(10, USDT_DECIMALS)));
          refunds.push({
            userAddress: bet.userAddress,
            betId: bet.id,
            matchId: bet.matchId,
            matchName: bet.matchName,
            type: "refund",
            amount: bet.amount,
            rawAmount: rawAmt,
          });
        }
      }
    }
    logs.push(`Case1 Refunds (單邊投注全額退回): ${refunds.length}`);

    // === 情況2：多邊投注 → 贏家拿賠率倍數，剩餘歸管理員 ===
    const wins: SplitEntry[] = [];
    for (const [, bets] of Object.entries(betsDb)) {
      for (const bet of bets) {
        if (bet.status === "win" && !bet.paidOut && !bet.useBonus && bet.amount > 0) {
          const winAmount = Math.round(bet.amount * (bet.odds || 1) * 1e6) / 1e6;
          const rawAmt = BigInt(Math.floor(winAmount * Math.pow(10, USDT_DECIMALS)));
          wins.push({
            userAddress: bet.userAddress,
            betId: bet.id,
            matchId: bet.matchId,
            matchName: bet.matchName,
            type: "win",
            amount: winAmount,
            rawAmount: rawAmt,
          });
        }
      }
    }
    logs.push(`Case2 Wins (贏家派彩): ${wins.length}`);

    const allSplits = [...refunds, ...wins];

    // === 佣金 ===
    interface PendingCommission { referrerAddress: string; earnedValue: number; refId: string; }
    const commissions: PendingCommission[] = [];
    for (const [address, data] of Object.entries(referralDb || {}) as [string, any][]) {
      if (data?.referees) {
        for (const ref of data.referees) {
          if ((ref.earnedCommissionValue || 0) > 0.000001 && !ref.commissionPaid) {
            commissions.push({
              referrerAddress: ref.address || address,
              earnedValue: ref.earnedCommissionValue,
              refId: ref.id,
            });
          }
        }
      }
    }
    logs.push(`Commissions (佣金): ${commissions.length}`);

    // === Admin ATA 餘額檢查 ===
    const adminAtaBalance = await getTokenBalance(adminAta);
    const totalNeededRaw = allSplits.reduce((sum, s) => sum + s.rawAmount, 0n);
    const commissionsNeededRaw = commissions.reduce((sum, c) =>
      sum + BigInt(Math.floor(c.earnedValue * Math.pow(10, USDT_DECIMALS))), 0n
    );
    const grandTotalNeeded = totalNeededRaw + commissionsNeededRaw;
    const adminBalanceUi = Number(adminAtaBalance) / Math.pow(10, USDT_DECIMALS);
    const totalNeededUi = Number(grandTotalNeeded) / Math.pow(10, USDT_DECIMALS);

    logs.push(`Admin ATA balance: ${adminBalanceUi.toFixed(4)} USDT`);
    logs.push(`Total needed: ${totalNeededUi.toFixed(4)} USDT (payouts + commissions)`);

    if (adminAtaBalance < grandTotalNeeded) {
      const shortfall = (Number(grandTotalNeeded - adminAtaBalance) / Math.pow(10, USDT_DECIMALS)).toFixed(4);
      return NextResponse.json({
        success: false,
        error: "Admin ATA 餘額不足",
        balance: adminBalanceUi,
        needed: totalNeededUi,
        shortfall: Number(shortfall),
        pendingRefunds: refunds.length,
        pendingWins: wins.length,
        pendingCommissions: commissions.length,
        message: `Admin ATA (${adminAta.toBase58()}) 只有 ${adminBalanceUi.toFixed(4)} USDT，但需支付 ${totalNeededUi.toFixed(4)} USDT。\n\n請確保所有投注資金已轉到 Admin ATA（舊投注在 Pool ATA 9FfHYyK... 的需手動轉移）。`,
        elapsed: Date.now() - startTime,
        logs,
      }, { status: 402 });
    }

    if (allSplits.length === 0 && commissions.length === 0) {
      return NextResponse.json({
        success: true, refunds: 0, wins: 0, commissions: 0, elapsed: Date.now() - startTime,
        logs, message: "No pending payouts",
      });
    }

    // === 處理派彩 + 退款 ===
    const splitResult = await processSplits(adminKeypair, adminAta, adminPubkey, usdtMint, allSplits, betsDb);
    const refundDone = refunds.filter(r => betsDb[r.userAddress]?.find(b => b.id === r.betId)?.paidOut).length;
    const winDone = wins.filter(w => betsDb[w.userAddress]?.find(b => b.id === w.betId)?.paidOut).length;
    logs.push(`Splits: refunds=${refundDone}/${refunds.length} wins=${winDone}/${wins.length} (${splitResult.totalUsdt.toFixed(4)} USDT total)`);

    // === 處理佣金 ===
    let commSuccess = 0;
    let commFailed = 0;
    for (const comm of commissions) {
      try {
        const refPubkey = new PublicKey(comm.referrerAddress);
        const refAta = findAta(usdtMint, refPubkey);
        const rawAmt = BigInt(Math.floor(comm.earnedValue * Math.pow(10, USDT_DECIMALS)));
        if (rawAmt <= 0n) continue;

        const refAtaExists = await checkAtaExists(refAta);
        const blockhash = await getBlockhash();

        const tx = new Transaction();
        tx.feePayer = adminPubkey;
        tx.recentBlockhash = blockhash;
        tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 }));
        if (!refAtaExists) tx.add(createAtaInstruction(adminPubkey, refAta, refPubkey, usdtMint));
        tx.add(splTransferInstruction(adminAta, refAta, adminPubkey, rawAmt));

        const sig = await sendAndConfirm(adminKeypair, tx, `comm_${comm.refId}`);
        console.log(`[AutoPayout] 💰 Commission ${comm.earnedValue.toFixed(6)} USDT → ${comm.referrerAddress.slice(0, 8)}... | tx: ${sig}`);

        if (referralDb) {
          const userData = referralDb[comm.referrerAddress];
          if (userData?.referees) {
            for (const ref of userData.referees) {
              if (ref.id === comm.refId || ref.address === comm.referrerAddress) {
                ref.commissionPaid = true;
                ref.earnedCommissionValue = 0;
                break;
              }
            }
          }
        }
        commSuccess++;
      } catch (e: any) {
        commFailed++;
        console.error(`[AutoPayout] ❌ Commission failed: ${comm.referrerAddress} - ${e.message}`);
      }
    }
    logs.push(`Commissions: ${commSuccess}/${commissions.length} success`);

    saveDb("bets_db.json", betsDb);
    if (referralDb) saveDb("referral_db.json", referralDb);

    return NextResponse.json({
      success: true,
      refunds: refundDone,
      wins: winDone,
      commissions: commSuccess,
      totalUsdtPaid: Math.round(splitResult.totalUsdt * 1e6) / 1e6,
      failed: splitResult.failed + commFailed,
      errors: splitResult.errors,
      elapsed: Date.now() - startTime,
      logs,
    });
  } catch (e: any) {
    console.error("[AutoPayout] Fatal:", e);
    return NextResponse.json({
      success: false, error: String(e?.message || e),
      elapsed: Date.now() - startTime, logs,
    }, { status: 500 });
  }
}
