/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { fetchLiveMatches } from "@/lib/api";
import { getTrialUSDTBalance, getUSDTBalance } from "@/lib/solana";
import Home from "./page";

let mockedLanguage = "en";
let mockedConnected = false;
let mockedPublicKey: { toBase58: () => string } | null = null;
let mockedSendTransaction = jest.fn();
let mockedSkipChainProgress = false;
const mockedSplitBetAmount = jest.fn(() => ({ pool: 4, house: 0, commission: 0, support: 0 }));

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

const ZERO_POOL_MATCH_FIXTURE = [
  {
    ...MATCH_FIXTURE[0],
    pools: { home: 0, draw: 0, away: 0 },
    marketData: {
      ...MATCH_FIXTURE[0].marketData,
      realTotalPool: 0,
      pools: { home: 0, draw: 0, away: 0 },
    },
  },
];

const ONE_SIDED_POOL_MATCH_FIXTURE = [
  {
    ...MATCH_FIXTURE[0],
    pools: { home: 25, draw: 0, away: 0 },
    marketData: {
      ...MATCH_FIXTURE[0].marketData,
      realTotalPool: 25,
      pools: { home: 25, draw: 0, away: 0 },
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

function mockClosedMatchBetFailure() {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.startsWith("/api/balance?address=")) {
      return makeJsonResponse({ success: true, balance: 100 });
    }
    if (url.startsWith("/api/bets?address=")) {
      return makeJsonResponse({ success: true, data: [] });
    }
    if (url === "/api/bets" && init?.method === "POST") {
      return makeJsonResponse({ success: false, error: "賽事已結束，無法投注。" }, false);
    }

    return makeJsonResponse({ success: true, data: [] });
  }) as jest.Mock;
}

async function openTrialPredictionModal() {
  await waitFor(() => {
    expect(screen.getByText("Alpha FC")).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.click(screen.getByRole("button", { name: "label.trial_funds" }));
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /btn\.confirm/ }).textContent).not.toContain("NaN");
  });

  return screen.getByRole("button", { name: /btn\.confirm/ });
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

    calculatePhaseAwareDisplayOdds({
      pools,
    }: {
      pools: { home: number; draw: number; away: number };
    }) {
      return {
        home: Number((pools.home / 10).toFixed(2)),
        draw: Number((pools.draw / 10).toFixed(2)),
        away: Number((pools.away / 10).toFixed(2)),
      };
    }

    calculatePhaseAwareLockedOdds({ betAmount }: { betAmount: number }) {
      return { odds: 1.5 + betAmount / 100, riskLevel: "normal" };
    }

    calculateAllDisplayOdds(pools: { home: number; draw: number; away: number }) {
      return {
        home: Number((pools.home / 10).toFixed(2)),
        draw: Number((pools.draw / 10).toFixed(2)),
        away: Number((pools.away / 10).toFixed(2)),
      };
    }

    calculateDynamicOdds(_: unknown, __: unknown, betAmount: number) {
      return { odds: 1.5 + betAmount / 100, riskLevel: "normal" };
    }

    getMaxBetAmount() {
      return 999999;
    }

    getMaxPositionRatio() {
      return 0.3;
    }

    getFeeFundedThreshold() {
      return 0.5;
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
  splitBetAmount: (...args: unknown[]) => mockedSplitBetAmount(...args),
  getCombinedPlatformFeeAmount: ({ house, commission }: { house: number; commission: number }) =>
    house + commission,
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

describe("Home referral landing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLanguage = "en";
    mockedConnected = false;
    mockedPublicKey = null;
    mockedSendTransaction = jest.fn().mockResolvedValue("sig-111");
    mockedSkipChainProgress = true;
    (fetchLiveMatches as jest.Mock).mockResolvedValue([]);
    (getUSDTBalance as jest.Mock).mockResolvedValue(0);
    (getTrialUSDTBalance as jest.Mock).mockResolvedValue(0);
    window.history.replaceState({}, "", "/?ref=AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq");
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
    mockedPublicKey = { toBase58: () => "wallet-111" };
    window.history.replaceState({}, "", "/?ref=AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq");
    render(<Home />);
    await waitFor(() => {
      expect(screen.queryByTestId("referral-landing")).toBeNull();
    });
    await waitFor(() => {
      expect(fetchLiveMatches).toHaveBeenCalled();
    });
  });

  it("disables confirm when trial funds would open an empty pool", async () => {
    mockedConnected = true;
    mockedPublicKey = { toBase58: () => "wallet-111" };
    (fetchLiveMatches as jest.Mock).mockResolvedValue(ZERO_POOL_MATCH_FIXTURE);
    (getUSDTBalance as jest.Mock).mockResolvedValue(100);
    (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
    window.history.replaceState({}, "", "/");

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
    });

    const confirmButton = await openTrialPredictionModal();
    expect(confirmButton).toBeDisabled();
  });

  it("keeps confirm enabled when trial funds are used on a non-zero pool match", async () => {
    mockedConnected = true;
    mockedPublicKey = { toBase58: () => "wallet-111" };
    (fetchLiveMatches as jest.Mock).mockResolvedValue(MATCH_FIXTURE);
    (getUSDTBalance as jest.Mock).mockResolvedValue(100);
    (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
    window.history.replaceState({}, "", "/");

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
    });

    const confirmButton = await openTrialPredictionModal();
    expect(confirmButton).toBeEnabled();
  });

  it("keeps confirm enabled when real money opens an empty pool", async () => {
    mockedConnected = true;
    mockedPublicKey = { toBase58: () => "wallet-111" };
    (fetchLiveMatches as jest.Mock).mockResolvedValue(ZERO_POOL_MATCH_FIXTURE);
    (getUSDTBalance as jest.Mock).mockResolvedValue(100);
    (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
    window.history.replaceState({}, "", "/");

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Alpha FC")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /2\.5/ })[0]);
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "4" },
    });

    expect(screen.getByRole("button", { name: /btn\.confirm/ })).toBeEnabled();
  });

  it("updates all outcome buttons immediately using net pool contribution for real money", async () => {
    mockedConnected = true;
    mockedPublicKey = { toBase58: () => "wallet-111" };
    mockedSplitBetAmount.mockReturnValue({ pool: 3.68, house: 0.16, commission: 0.16, support: 0 });
    (fetchLiveMatches as jest.Mock).mockResolvedValue(MATCH_FIXTURE);
    (getUSDTBalance as jest.Mock).mockResolvedValue(100);
    (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
    window.history.replaceState({}, "", "/");

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Alpha FC")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /2\.5/ })[0]);
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "4" },
    });

    await waitFor(() => {
      const buttonTexts = screen.getAllByRole("button").map((button) => button.textContent);
      expect(buttonTexts).toContain("outcome.home2.87");
      expect(buttonTexts).toContain("outcome.draw2");
      expect(buttonTexts).toContain("outcome.away1.5");
    });

    expect(mockedSplitBetAmount).toHaveBeenCalledWith(4, expect.any(Number), 60);
  });

  it("keeps initial odds stable while typing on a first-bet pool", async () => {
    mockedConnected = true;
    mockedPublicKey = { toBase58: () => "wallet-111" };
    mockedSplitBetAmount.mockReturnValue({ pool: 3.68, house: 0.16, commission: 0.16, support: 0 });
    (fetchLiveMatches as jest.Mock).mockResolvedValue(ZERO_POOL_MATCH_FIXTURE);
    (getUSDTBalance as jest.Mock).mockResolvedValue(100);
    window.history.replaceState({}, "", "/");

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Alpha FC")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /2\.5/ })[0]);
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "4" },
    });

    const buttonTexts = screen.getAllByRole("button").map((button) => button.textContent);
    expect(buttonTexts).toContain("outcome.home1.5");
    expect(buttonTexts).toContain("outcome.draw2.5");
    expect(buttonTexts).toContain("outcome.away3.5");
  });

  it("updates all outcome buttons immediately for trial funds on a non-zero pool", async () => {
    mockedConnected = true;
    mockedPublicKey = { toBase58: () => "wallet-111" };
    mockedSplitBetAmount.mockReturnValue({ pool: 3.68, house: 0.16, commission: 0.16, support: 0 });
    (fetchLiveMatches as jest.Mock).mockResolvedValue(MATCH_FIXTURE);
    (getUSDTBalance as jest.Mock).mockResolvedValue(100);
    (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
    window.history.replaceState({}, "", "/");

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /2\.5/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: "label.trial_funds" }));
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "4" },
    });

    await waitFor(() => {
      const buttonTexts = screen.getAllByRole("button").map((button) => button.textContent);
      expect(buttonTexts).toContain("outcome.home2.9");
      expect(buttonTexts).toContain("outcome.draw2");
      expect(buttonTexts).toContain("outcome.away1.5");
    });
  });

  it("updates odds while typing when the pool already has a first bet but is still single-sided", async () => {
    mockedConnected = true;
    mockedPublicKey = { toBase58: () => "wallet-111" };
    mockedSplitBetAmount.mockReturnValue({ pool: 3.68, house: 0.16, commission: 0.16, support: 0 });
    (fetchLiveMatches as jest.Mock).mockResolvedValue(ONE_SIDED_POOL_MATCH_FIXTURE);
    (getUSDTBalance as jest.Mock).mockResolvedValue(100);
    window.history.replaceState({}, "", "/");

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Alpha FC")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /2\.5/ })[0]);
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "4" },
    });

    await waitFor(() => {
      const buttonTexts = screen.getAllByRole("button").map((button) => button.textContent);
      expect(buttonTexts).toContain("outcome.home2.87");
      expect(buttonTexts).toContain("outcome.draw0");
      expect(buttonTexts).toContain("outcome.away0");
    });
  });

  it("does not leave a fake successful bet in the UI when /api/bets persistence fails", async () => {
    mockedConnected = true;
    mockedPublicKey = { toBase58: () => "wallet-111" };
    (fetchLiveMatches as jest.Mock).mockResolvedValue(MATCH_FIXTURE);
    (getUSDTBalance as jest.Mock).mockResolvedValue(100);
    (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
    window.history.replaceState({}, "", "/");

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/balance?address=")) {
        return makeJsonResponse({ success: true, balance: 100 });
      }
      if (url.startsWith("/api/bets?address=")) {
        return makeJsonResponse({ success: true, data: [] });
      }
      if (url === "/api/bets" && init?.method === "POST") {
        return makeJsonResponse({ success: false, error: "backend rejected" }, false);
      }
      return makeJsonResponse({ success: true, data: [] });
    }) as jest.Mock;

    window.alert = jest.fn();
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
    });

    const confirmButton = await openTrialPredictionModal();
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalled();
    });

    expect(screen.queryByText("btn.success")).not.toBeInTheDocument();
    expect(screen.getByText("No bets found for this period")).toBeInTheDocument();
  });

  it("shows a stale-match toast when /api/bets rejects a closed match", async () => {
    mockedConnected = true;
    mockedPublicKey = { toBase58: () => "wallet-111" };
    mockedSkipChainProgress = true;
    (fetchLiveMatches as jest.Mock).mockResolvedValue(MATCH_FIXTURE);
    (getUSDTBalance as jest.Mock).mockResolvedValue(100);
    (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
    window.history.replaceState({}, "", "/");
    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
    mockClosedMatchBetFailure();

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
    });

    const confirmButton = await openTrialPredictionModal();
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText("賽事已結束")).toBeInTheDocument();
    });

    expect(screen.getByText("請刷新頁面後再試")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "立即刷新" })).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalledWith(expect.stringContaining("賽事已結束"));
  });

  it("refreshes matches and closes the stale-match toast after clicking 立即刷新", async () => {
    mockedConnected = true;
    mockedPublicKey = { toBase58: () => "wallet-111" };
    mockedSkipChainProgress = true;
    (fetchLiveMatches as jest.Mock)
      .mockResolvedValueOnce(MATCH_FIXTURE)
      .mockResolvedValueOnce(MATCH_FIXTURE);
    (getUSDTBalance as jest.Mock).mockResolvedValue(100);
    (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
    window.history.replaceState({}, "", "/");
    mockClosedMatchBetFailure();

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
    });

    const confirmButton = await openTrialPredictionModal();
    fireEvent.click(confirmButton);

    const refreshButton = await screen.findByRole("button", { name: "立即刷新" });
    const initialFetchCount = (fetchLiveMatches as jest.Mock).mock.calls.length;
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect((fetchLiveMatches as jest.Mock).mock.calls.length).toBeGreaterThan(initialFetchCount);
    });

    await waitFor(() => {
      expect(screen.queryByText("賽事已結束")).not.toBeInTheDocument();
    });
  });
});
