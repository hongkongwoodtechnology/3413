/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { fetchLiveMatches } from "@/lib/api";
import { getTrialUSDTBalance, getUSDTBalance } from "@/lib/solana";
import Home from "./page";

let mockedLanguage = "zh-TW";
let mockedConnected = false;
let mockedPublicKey: { toBase58: () => string } | null = null;
let mockedSendTransaction = jest.fn();
let mockedSkipChainProgress = false;

const MATCH_FIXTURE = [
  {
    id: 101,
    league: "World Cup",
    category: "elite",
    home: "Alpha FC",
    away: "Beta FC",
    date: "2026-05-16 20:00",
    liveMinute: 12,
    status: "live",
    score: "0-0",
    pools: { home: 25, draw: 20, away: 15 },
    marketData: {
      realTotalPool: 60,
      liabilities: { home: 40, draw: 30, away: 20 },
      pools: { home: 25, draw: 20, away: 15 },
      attractionWindowUsed: { home: 0, draw: 0, away: 0 },
      initialOdds: { home: 1.5, draw: 2.5, away: 3.5 },
    },
  },
];

function makeJsonResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 403,
    json: async () => payload,
  } as Response;
}

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
    publicKey: mockedPublicKey,
    wallet: mockedConnected ? { adapter: { name: "Mock Wallet" } } : null,
    sendTransaction: mockedSendTransaction,
  }),
  useConnection: () => ({
    connection: {},
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

    calculatePhaseAwareLockedOdds() {
      return { odds: 1.5, riskLevel: "balanced" };
    }

    calculateAllDisplayOdds() {
      return { home: 1.5, draw: 2.5, away: 3.5 };
    }

    calculateDynamicOdds() {
      return { odds: 1.5, riskLevel: "balanced" };
    }

    getMaxBetAmount() {
      return 999999;
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
  shouldSkipChainProgressForBet: () => mockedSkipChainProgress,
}));

jest.mock("@/lib/solana", () => ({
  getUSDTBalance: jest.fn().mockResolvedValue(0),
  getTrialUSDTBalance: jest.fn().mockResolvedValue(0),
  findAta: jest.fn((_: string, owner: { toBase58?: () => string } | string) => ({
    toBase58: () =>
      typeof owner === "string"
        ? `${owner}-ata`
        : `${owner.toBase58?.() ?? "owner"}-ata`,
  })),
}));

jest.mock("@/lib/wallets", () => ({
  HOUSE_WALLET: "house-wallet",
  COMMISSION_WALLET: "commission-wallet",
  USDT_MINT: "mint",
  USDT_DECIMALS: 6,
  PLATFORM_FEE_RATE: 0.005,
  DEFAULT_COMMISSION_RATE: 0.3,
  POOL_ADDRESS: "pool-address",
  splitBetAmount: () => ({ pool: 4, house: 0, commission: 0, support: 0 }),
  formatMissingAtaInitializationMessage: () => "missing ata",
  getBoundReferrerStorageKey: (address: string) => `bound_referrer_${address}`,
  resolvePreferredWalletAddress: (walletAddress: string, phantomAddress: string | null) =>
    phantomAddress || walletAddress,
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
  Transaction: class {
    add() {
      return this;
    }
  },
  TransactionInstruction: class {
    constructor(_: unknown) {}
  },
  ComputeBudgetProgram: {
    setComputeUnitLimit: jest.fn(),
    setComputeUnitPrice: jest.fn(),
  },
  SystemProgram: {
    programId: "system-program",
  },
}));

describe("[locale] Home referral landing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLanguage = "zh-TW";
    mockedConnected = false;
    mockedPublicKey = null;
    mockedSendTransaction = jest.fn().mockResolvedValue("sig-111");
    mockedSkipChainProgress = true;
    (fetchLiveMatches as jest.Mock).mockResolvedValue([]);
    (getUSDTBalance as jest.Mock).mockResolvedValue(0);
    (getTrialUSDTBalance as jest.Mock).mockResolvedValue(0);
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/balance?address=")) {
        return makeJsonResponse({ success: true, balance: 0 });
      }
      if (url.startsWith("/api/bets?address=")) {
        return makeJsonResponse({ success: true, data: [] });
      }
      return makeJsonResponse({ success: true, data: [] });
    }) as jest.Mock;
  });

  it.each(["en", "zh-TW", "zh-CN", "es", "ar", "fr", "ru", "de", "ja", "ko", "pt", "la", "th"])(
    "renders the referral landing flow for %s without triggering the previous crash",
    async (locale) => {
      mockedLanguage = locale;
      window.history.replaceState(
        {},
        "",
        `/${locale}?ref=AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq`
      );

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByTestId("referral-landing")).toBeInTheDocument();
      });
    }
  );

  it("does not start matches fetching while the referral landing is taking over the page", async () => {
    mockedLanguage = "zh-TW";
    window.history.replaceState(
      {},
      "",
      "/zh-TW?ref=AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq"
    );

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByTestId("referral-landing")).toBeInTheDocument();
    });

    expect(fetchLiveMatches).not.toHaveBeenCalled();
  });

  it("skips referral landing for locale page when wallet is connected and starts matches fetching", async () => {
    jest.clearAllMocks();
    mockedLanguage = "zh-TW";
    mockedConnected = true;
    mockedPublicKey = { toBase58: () => "wallet-111" };
    window.history.replaceState(
      {},
      "",
      "/zh-TW?ref=AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq"
    );
    render(<Home />);
    await waitFor(() => {
      expect(screen.queryByTestId("referral-landing")).toBeNull();
    });
    await waitFor(() => {
      expect(fetchLiveMatches).toHaveBeenCalled();
    });
  });

  it("does not show localized success UI when /api/bets rejects the bet", async () => {
    mockedLanguage = "zh-TW";
    mockedConnected = true;
    mockedPublicKey = { toBase58: () => "wallet-111" };
    mockedSkipChainProgress = true;
    (fetchLiveMatches as jest.Mock).mockResolvedValue(MATCH_FIXTURE);
    (getUSDTBalance as jest.Mock).mockResolvedValue(100);
    (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
    window.history.replaceState({}, "", "/zh-TW");
    (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/balance?address=")) {
        return makeJsonResponse({ success: true, balance: 100 });
      }
      if (url.startsWith("/api/bets?address=")) {
        return makeJsonResponse({ success: true, data: [] });
      }
      if (url === "/api/bets") {
        return makeJsonResponse(
          { success: false, error: "體驗金不可作為該場賭池首注" },
          false
        );
      }
      if (url === "/api/referral") {
        return makeJsonResponse({ success: true, newBalance: 11 });
      }
      return makeJsonResponse({ success: true, data: [] });
    });

    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("Alpha FC")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: "label.trial_funds" }));
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "btn.confirm" }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining("體驗金不可作為該場賭池首注")
      );
    });

    expect(screen.queryByText("modal.prediction_placed")).toBeNull();
    expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
  });
});
