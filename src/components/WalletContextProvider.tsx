"use client"

import { FC, ReactNode, useMemo, useCallback } from "react"
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react"
import { WalletModalProvider, WalletModal } from "@solana/wallet-adapter-react-ui"
import { WalletError } from "@solana/wallet-adapter-base"
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom"
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare"

const FALLBACK_RPC_ENDPOINTS = [
  "https://rpc.ankr.com/solana",
  "https://solana-api.projectserum.com",
  "https://api.mainnet-beta.solana.com",
]

export const WalletContextProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const endpoint = useMemo(() => {
    const customRpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    if (customRpcUrl) return customRpcUrl
    return FALLBACK_RPC_ENDPOINTS[0]
  }, [])

  const wallets = useMemo(() => {
    if (typeof window === "undefined") return []
    return [new PhantomWalletAdapter(), new SolflareWalletAdapter()]
  }, [])

  const onError = useCallback((error: WalletError) => {
    console.error("Wallet Error:", error.name, error.message)
  }, [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false} onError={onError}>
        <WalletModalProvider>
          {children}
          <WalletModal />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
