import { NextRequest, NextResponse } from "next/server";
import https from "https";
import http from "http";

const RPC_HOSTS = [
  { hostname: "rpc.ankr.com", path: "/solana" },
  { hostname: "api.mainnet-beta.solana.com" },
  { hostname: "solana-api.projectserum.com" },
  { hostname: "solana-rpc.publicnode.com" },
  { hostname: "mainnet.helius-rpc.com", path: "/?api-key=2c0a4b88-b8f9-4ef8-82e5-7e2f4e7e5a3d" },
];

function rpcPost(hostname: string, path: string, body: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path: path || "/",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          if (res.statusCode === 403 || res.statusCode === 429) {
            reject(new Error(`HTTP ${res.statusCode}`));
          } else if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          } else {
            resolve(data);
          }
        });
        res.on("error", reject);
      }
    );
    req.on("timeout", () => { req.destroy(); reject(new Error("ETIMEDOUT")); });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function rpcProxy(body: string): Promise<string> {
  let lastErr: any;
  for (let i = 0; i < RPC_HOSTS.length; i++) {
    const host = RPC_HOSTS[i];
    try {
      console.log(`[RPC Proxy] Trying ${i + 1}/${RPC_HOSTS.length}: ${host.hostname}`);
      const result = await rpcPost(host.hostname, host.path || "/", body, 10000);
      console.log(`[RPC Proxy] Success from ${host.hostname}`);
      return result;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e);
      console.error(`[RPC Proxy] ${host.hostname} failed:`, msg);
      if (msg.includes("403") || msg.includes("429") || msg.includes("ETIMEDOUT") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
        continue;
      }
    }
  }
  throw lastErr || new Error("All RPC endpoints failed");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const result = await rpcProxy(body);
    return new NextResponse(result, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[RPC Proxy] Final error:", e);
    return NextResponse.json(
      { error: { message: String(e?.message || e) } },
      { status: 502 }
    );
  }
}
