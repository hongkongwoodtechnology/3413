import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_HOUSE_WALLET: process.env.NEXT_PUBLIC_HOUSE_WALLET,
    NEXT_PUBLIC_COMMISSION_WALLET: process.env.NEXT_PUBLIC_COMMISSION_WALLET,
    NEXT_PUBLIC_POOL_WALLET: process.env.NEXT_PUBLIC_POOL_WALLET,
    NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    NEXT_PUBLIC_USDT_MINT: process.env.NEXT_PUBLIC_USDT_MINT,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve("crypto-browserify"),
        stream: require.resolve("stream-browserify"),
        buffer: require.resolve("buffer/"),
        os: false,
        path: false,
        fs: false,
        net: false,
        tls: false,
        zlib: false,
        http: false,
        https: false,
        dns: false,
        child_process: false,
      };
    }
    return config;
  },
};

export default nextConfig;
