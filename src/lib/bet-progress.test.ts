import { shouldSkipChainProgressForBet } from "@/lib/bet-progress";

describe("shouldSkipChainProgressForBet", () => {
  it("skips fake chain progress for trial funds bets", () => {
    expect(shouldSkipChainProgressForBet(true)).toBe(true);
  });

  it("keeps chain progress for real money bets", () => {
    expect(shouldSkipChainProgressForBet(false)).toBe(false);
  });
});
