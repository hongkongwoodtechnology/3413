import {
  shouldShowMatchesLoading,
  shouldStartMatchesLoading,
} from "@/lib/live-matches-loading";

describe("live matches loading policy", () => {
  it("starts full-screen loading only when there are no matches yet", () => {
    expect(shouldStartMatchesLoading(0)).toBe(true);
    expect(shouldStartMatchesLoading(3)).toBe(false);
  });

  it("renders the loading screen only for the initial empty-state fetch", () => {
    expect(shouldShowMatchesLoading(true, 0)).toBe(true);
    expect(shouldShowMatchesLoading(true, 4)).toBe(false);
    expect(shouldShowMatchesLoading(false, 0)).toBe(false);
  });
});
