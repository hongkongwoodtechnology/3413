import { Keypair, PublicKey, Transaction, TransactionInstruction, ComputeBudgetProgram, SystemProgram } from "@solana/web3.js";
import https from "https";

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

const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const USDT_DECIMALS = 6;
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOC_TOKEN_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

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

export function findAta(mint: PublicKey, owner: PublicKey): PublicKey {
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

export interface TransferResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export async function sendUsdtCommission(
  adminSecretKeyStr: string,
  adminAddress: string,
  destinationAddress: string,
  amountUsdt: number
): Promise<TransferResult> {
  let secretKey: Uint8Array;
  if (adminSecretKeyStr.startsWith("[")) {
    secretKey = new Uint8Array(JSON.parse(adminSecretKeyStr));
  } else {
    secretKey = base58ToBytes(adminSecretKeyStr);
  }
  const adminKeypair = Keypair.fromSecretKey(secretKey);
  const adminPubkey = adminKeypair.publicKey;

  if (adminPubkey.toBase58() !== adminAddress) {
    return {
      success: false,
      error: `ADMIN_SECRET_KEY does not match admin address. Expected: ${adminAddress}, Got: ${adminPubkey.toBase58()}`,
    };
  }

  const usdtMint = new PublicKey(USDT_MINT);
  const adminAta = findAta(usdtMint, adminPubkey);
  const destPubkey = new PublicKey(destinationAddress);
  const destAta = findAta(usdtMint, destPubkey);

  const rawAmount = BigInt(Math.round(amountUsdt * Math.pow(10, USDT_DECIMALS)));
  if (rawAmount <= BigInt(0)) {
    return { success: false, error: "Invalid transfer amount" };
  }

  try {
    const destAtaExists = await checkAtaExists(destAta);
    const blockhash = await getBlockhash();

    const tx = new Transaction();
    tx.feePayer = adminPubkey;
    tx.recentBlockhash = blockhash;
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 }));

    if (!destAtaExists) {
      tx.add(createAtaInstruction(adminPubkey, destAta, destPubkey, usdtMint));
    }
    tx.add(splTransferInstruction(adminAta, destAta, adminPubkey, rawAmount));

    const signature = await sendAndConfirm(adminKeypair, tx, "commission_withdraw");
    return { success: true, signature };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}
