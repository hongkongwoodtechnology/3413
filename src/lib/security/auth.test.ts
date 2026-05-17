/**
 * @jest-environment node
 */

describe("getAdminAddresses", () => {
  const originalAdmin = process.env.ADMIN_WALLET_ADDRESS;
  const originalHouse = process.env.NEXT_PUBLIC_HOUSE_WALLET;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.ADMIN_WALLET_ADDRESS;
    delete process.env.NEXT_PUBLIC_HOUSE_WALLET;
  });

  afterAll(() => {
    if (originalAdmin === undefined) {
      delete process.env.ADMIN_WALLET_ADDRESS;
    } else {
      process.env.ADMIN_WALLET_ADDRESS = originalAdmin;
    }

    if (originalHouse === undefined) {
      delete process.env.NEXT_PUBLIC_HOUSE_WALLET;
    } else {
      process.env.NEXT_PUBLIC_HOUSE_WALLET = originalHouse;
    }
  });

  it("returns an empty allowlist when no admin env is configured", async () => {
    const { getAdminAddresses } = await import("./auth");
    expect(getAdminAddresses()).toEqual([]);
  });

  it("returns a de-duplicated list from admin and house env values", async () => {
    process.env.ADMIN_WALLET_ADDRESS = "Admin111111111111111111111111111111111";
    process.env.NEXT_PUBLIC_HOUSE_WALLET = "Admin111111111111111111111111111111111";

    const { getAdminAddresses } = await import("./auth");

    expect(getAdminAddresses()).toEqual(["Admin111111111111111111111111111111111"]);
  });

  it("includes both env addresses when they differ", async () => {
    process.env.ADMIN_WALLET_ADDRESS = "Admin111111111111111111111111111111111";
    process.env.NEXT_PUBLIC_HOUSE_WALLET = "House111111111111111111111111111111111";

    const { getAdminAddresses } = await import("./auth");

    expect(getAdminAddresses()).toEqual([
      "Admin111111111111111111111111111111111",
      "House111111111111111111111111111111111",
    ]);
  });
});
