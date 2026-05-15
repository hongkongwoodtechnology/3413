/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { fetchLiveMatches } from "@/lib/api";
import Home from "./page";

let mockedLanguage = "en";
let mockedConnected = false;

jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    const DynamicComponent = (props: { referrerId?: string }) => (
      <div data-testid={props.referrerId ? "referral-landing" : "dynamic-component"}>
        {props.referrerId ?? null}
      </div>
    );
    return DynamicComponent;
  },
}));

jest.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => ({
    connected: mockedConnected,
    connecting: false,
    disconnecting: false,
    publicKey: null,
    wallet: null,
    sendTransaction: jest.fn(),
  }),
}));

jest.mock("@/components/LanguageProvider", () => ({
  useLanguage: () => ({
    language: mockedLanguage,
    t: (key: string) => key,
  }),
}));

jest.mock("@/components/WalletButton", () => ({
  WalletButton: () => <button>Wallet</button>,
}));

jest.mock("@/components/LocalizedLink", () => ({
  LocalizedLink: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  buttonVariants: () => "",
}));

jest.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock("lucide-react", () =>
  new Proxy(
    {},
    {
      get: () => (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
    }
  )
);

jest.mock("@/lib/api", () => ({
  fetchLiveMatches: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/odds-engine", () => ({
  DynamicOddsEngine: class {
    calculateOdds() {
      return 1.5;
    }

    calculatePhaseAwareDisplayOdds() {
      return { home: 1.5, draw: 2.5, away: 3.5 };
    }

    getMaxPositionRatio() {
      return 0.3;
    }
  },
}));

jest.mock("@/lib/analytics", () => ({
  LiquidityAnalyzer: class {
    analyzeMarketHealth() {
      return { score: 0.5, status: "healthy" };
    }
  },
}));

jest.mock("@/lib/live-matches-loading", () => ({
  shouldShowMatchesLoading: () => false,
  shouldStartMatchesLoading: () => false,
}));

jest.mock("@/lib/bet-progress", () => ({
  shouldSkipChainProgressForBet: () => false,
}));

jest.mock("@/lib/solana", () => ({
  getUSDTBalance: jest.fn().mockResolvedValue(0),
  getTrialUSDTBalance: jest.fn().mockResolvedValue(0),
  findAta: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/wallets", () => ({
  HOUSE_WALLET: "house-wallet",
  COMMISSION_WALLET: "commission-wallet",
  USDT_MINT: "mint",
  USDT_DECIMALS: 6,
  PLATFORM_FEE_RATE: 0.005,
  DEFAULT_COMMISSION_RATE: 0.3,
  POOL_ADDRESS: "pool-address",
  splitBetAmount: () => ({ houseAmount: 0n, commissionAmount: 0n, poolAmount: 0n }),
  formatMissingAtaInitializationMessage: () => "missing ata",
  getBoundReferrerStorageKey: (address: string) => `bound_referrer_${address}`,
  resolvePreferredWalletAddress: () => null,
}));

jest.mock("@/lib/bet-mode", () => ({
  getReturnRateForBetMode: () => 1,
}));

jest.mock("@/lib/market-rules", () => ({
  countActiveOutcomes: () => 3,
}));

jest.mock("@/lib/dictionaries", () => ({
  TEAM_NAMES: {},
  LEAGUES: [],
}));

jest.mock("@solana/web3.js", () => ({
  PublicKey: class {
    constructor(readonly value: string) {}
    toBase58() {
      return this.value;
    }
  },
  Transaction: class {},
  TransactionInstruction: class {},
  ComputeBudgetProgram: {
    setComputeUnitLimit: jest.fn(),
    setComputeUnitPrice: jest.fn(),
  },
  SystemProgram: {
    programId: "system-program",
  },
}));

describe("Home referral landing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLanguage = "en";
    mockedConnected = false;
    window.history.replaceState({}, "", "/?ref=AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [], balances: { usdt: 0, bonus: 0 } }),
    }) as jest.Mock;
  });

  it("does not start matches fetching while the referral landing is taking over the non-locale home page", async () => {
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByTestId("referral-landing")).toBeInTheDocument();
    });

    expect(fetchLiveMatches).not.toHaveBeenCalled();
  });

  it("skips referral landing when wallet is connected and starts matches fetching", async () => {
    jest.clearAllMocks();
    mockedConnected = true;
    window.history.replaceState({}, "", "/?ref=AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq");
    render(<Home />);
    await waitFor(() => {
      expect(screen.queryByTestId("referral-landing")).toBeNull();
    });
    await waitFor(() => {
      expect(fetchLiveMatches).toHaveBeenCalled();
    });
  });
});
