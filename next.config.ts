import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
