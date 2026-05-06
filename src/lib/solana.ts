
import { Connection, PublicKey, LAMPORTS_PER_SOL, AccountInfo } from "@solana/web3.js";

const RPC_ENDPOINTS = [
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  "https://rpc.ankr.com/solana",
  "https://solana-api.projectserum.com",
  "https://api.mainnet-beta.solana.com",
].filter(Boolean) as string[];

const RPC_ENDPOINT = RPC_ENDPOINTS[0];

export const getConnection = (): Connection => {
    return new Connection(RPC_ENDPOINT, "confirmed");
};

const getConnectionByIndex = (index: number): Connection => {
    return new Connection(RPC_ENDPOINTS[index % RPC_ENDPOINTS.length], "confirmed");
};

function isRetryableRpcError(error: any): boolean {
    const msg = error?.message ?? String(error);
    return (
        msg.includes("403") ||
        msg.includes("429") ||
        msg.includes("Access forbidden") ||
        msg.includes("Too Many Requests") ||
        msg.includes("fetch failed") ||
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("ENOTFOUND") ||
        error?.code === 403 ||
        error?.code === 429
    );
}

export async function withRpcFallback<T>(
    fn: (connection: Connection) => Promise<T>,
    maxRetries: number = RPC_ENDPOINTS.length
): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        const connection = getConnectionByIndex(i);
        try {
            return await fn(connection);
        } catch (error: any) {
            lastError = error;
            if (isRetryableRpcError(error)) {
                console.warn(`[RPC] Endpoint ${i} failed (403/429), trying fallback...`);
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

export async function getAccountSafe(
    publicKey: PublicKey
): Promise<AccountInfo<Buffer> | null> {
    try {
        return await withRpcFallback(async (conn) => {
            const info = await conn.getAccountInfo(publicKey, "confirmed");
            if (!info) throw new Error(`Account not found: ${publicKey.toBase58()}`);
            return info;
        });
    } catch (e: any) {
        const provider = typeof window !== "undefined" ? (window as any)?.solana : null;
        if (provider?.request) {
            const raw: any = await provider.request({
                method: "getAccountInfo",
                params: [publicKey.toBase58(), { commitment: "confirmed", encoding: "base64" }],
            });
            const buf = raw?.value?.data?.[0]
                ? Buffer.from(raw.value.data[0], "base64")
                : null;
            if (buf) {
                return {
                    executable: raw.value.executable ?? false,
                    owner: new PublicKey(raw.value.owner),
                    lamports: raw.value.lamports ?? 0,
                    data: buf,
                    rentEpoch: raw.value.rentEpoch ?? 0,
                } as AccountInfo<Buffer>;
            }
        }
        throw e;
    }
}

export async function getBalanceSafe(publicKey: PublicKey): Promise<number> {
    return withRpcFallback(async (conn) => {
        return conn.getBalance(publicKey, "confirmed");
    });
}

export async function getLatestBlockhashSafe() {
    return withRpcFallback(async (conn) => {
        return conn.getLatestBlockhash("finalized");
    });
}

export async function getMinimumBalanceForRentExemptionSafe(size: number): Promise<number> {
    return withRpcFallback(async (conn) => {
        return conn.getMinimumBalanceForRentExemption(size, "confirmed");
    });
}

const SPL_ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

export function findAta(mint: PublicKey, owner: PublicKey): PublicKey {
    const [ata] = PublicKey.findProgramAddressSync(
        [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        SPL_ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return ata;
}

export async function getTokenAccountBalanceSafe(mint: PublicKey, owner: PublicKey): Promise<{ amount: bigint; uiAmount: number | null }> {
    const ata = findAta(mint, owner);

    const tryDirectBalance = async (): Promise<{ amount: bigint; uiAmount: number | null }> => {
        return withRpcFallback(async (conn) => {
            const result = await conn.getTokenAccountBalance(ata, "confirmed");
            return { amount: BigInt(result.value.amount), uiAmount: result.value.uiAmount };
        });
    };

    const tryReadBytes = (bytes: Buffer): { amount: bigint; uiAmount: number | null } => {
        if (bytes.length >= 72) {
            const amount = bytes.readBigUInt64LE(64);
            return { amount, uiAmount: Number(amount) / 1e6 };
        }
        throw new Error(`Token account ${ata.toBase58()} too short to parse (${bytes.length} bytes)`);
    };

    const tryFromAccountData = async (): Promise<{ amount: bigint; uiAmount: number | null }> => {
        try {
            const info = await getAccountSafe(ata);
            if (info && info.data.length >= 72) {
                return tryReadBytes(info.data);
            }
        } catch { /* fall through to Phantom provider */ }

        const provider = typeof window !== "undefined" ? (window as any)?.solana : null;
        if (provider?.request) {
            const raw: any = await provider.request({
                method: "getAccountInfo",
                params: [ata.toBase58(), { commitment: "confirmed", encoding: "base64" }],
            });
            const buf = raw?.value?.data?.[0] ? Buffer.from(raw.value.data[0], "base64") : null;
            if (buf && buf.length >= 72) {
                return tryReadBytes(buf);
            }
        }
        throw new Error(`Cannot read token account ${ata.toBase58()}`);
    };

    try {
        return await tryDirectBalance();
    } catch {
        return tryFromAccountData();
    }
}

export async function confirmTransactionSafe(
    signature: string,
    blockhashInfo: { blockhash: string; lastValidBlockHeight: number }
) {
    return withRpcFallback(async (conn) => {
        const res = await conn.confirmTransaction(
            { signature, blockhash: blockhashInfo.blockhash, lastValidBlockHeight: blockhashInfo.lastValidBlockHeight },
            "confirmed"
        );
        if (res.value.err) {
            throw new Error(typeof res.value.err === "string" ? res.value.err : JSON.stringify(res.value.err));
        }
        return res;
    });
}

export async function getSignatureStatusesSafe(signature: string) {
    return withRpcFallback(async (conn) => {
        return conn.getSignatureStatuses([signature], { searchTransactionHistory: true });
    });
}

export async function getSolanaBalance(address: string): Promise<number> {
    try {
        const connection = getConnection();
        const publicKey = new PublicKey(address);
        const balance = await connection.getBalance(publicKey);
        
        // Convert Lamports to SOL
        return balance / LAMPORTS_PER_SOL;
    } catch (error) {
        console.error("Failed to fetch SOL balance:", error);
        return 0;
    }
}

export async function getSplTokenBalance(address: string, mintAddress: string): Promise<number> {
    try {
        const owner = new PublicKey(address);
        const mint = new PublicKey(mintAddress);
        
        console.log(`[getSplTokenBalance] Checking ${mintAddress} for ${address}`);
        
        const balanceInfo = await getTokenAccountBalanceSafe(mint, owner);
        return balanceInfo.uiAmount ?? 0;
    } catch (error: any) {
        console.error("Failed to fetch SPL token balance:", error);
        return 0;
    }
}

export const DEFAULT_USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

// Devnet USDT Mint for testing (if you want to test on Devnet)
const DEVNET_USDT_MINT = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";

export async function getUSDTBalance(address: string): Promise<number> {
    // 透過我們統一的 getSplTokenBalance 來獲取餘額，它已經包含了錯誤處理
    // 強制在主網查詢時直接使用真正的 USDT MINT
    const isDevnet = RPC_ENDPOINT.includes("devnet");
    const mint = isDevnet ? DEVNET_USDT_MINT : DEFAULT_USDT_MINT;
    
    // 如果有自訂環境變數，優先使用，否則使用預設 MINT
    const finalMint = process.env.NEXT_PUBLIC_USDT_MINT || mint;
    
    console.log(`[Balance Check] Fetching USDT balance for ${address} using mint ${finalMint} on ${RPC_ENDPOINT}`);
    
    return getSplTokenBalance(address, finalMint);
}

// 獲取體驗金 (Trial USDT) 的餘額
export async function getTrialUSDTBalance(address: string): Promise<number> {
    try {
        // 從我們建立的真實 referral API 獲取使用者的體驗金餘額
        const res = await fetch(`/api/referral?address=${address}`);
        if (res.ok) {
            const result = await res.json();
            if (result.data && result.data.balances && typeof result.data.balances.bonus === 'number') {
                return result.data.balances.bonus;
            }
        }
        return 0;
    } catch (error) {
        console.error("Failed to fetch trial balance:", error);
        return 0;
    }
}

// 模擬鑄造體驗金 (Mint Trial Tokens) - $100 Bonus
export async function mintTrialTokens(
    walletPublicKey: PublicKey,
    signTransaction: any, // or (tx: Transaction) => Promise<Transaction>
    amount: number
): Promise<string> {
    try {
        console.log(`[Mint] Requesting mint of ${amount} Trial Tokens for ${walletPublicKey.toBase58()}`);
        
        // 1. In a real dApp, you would construct a Transaction here calling your smart contract
        // const tx = new Transaction().add(
        //     createMintToInstruction(mint, tokenAccount, authority, amount * 10**decimals)
        // );
        // const signedTx = await signTransaction(tx);
        // const signature = await connection.sendRawTransaction(signedTx.serialize());
        
        // 2. We simulate a successful transaction delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 3. Return a fake signature
        const mockSignature = `mock_tx_${Math.random().toString(36).substring(2, 15)}`;
        console.log(`[Mint] Success! Signature: ${mockSignature}`);
        
        return mockSignature;
    } catch (error) {
        console.error("Failed to mint trial tokens:", error);
        throw new Error("Failed to mint bonus tokens. Please try again.");
    }
}
