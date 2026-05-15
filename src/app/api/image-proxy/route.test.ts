/**
 * @jest-environment node
 */

describe("image proxy hardening", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("rejects non-allowlisted hosts before making an outbound request", async () => {
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/image-proxy?url=https://evil.example.com/payload.png") as any);
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toMatch(/disallowed image host/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects non-image upstream responses from allowlisted hosts", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      arrayBuffer: async () => new TextEncoder().encode("<html></html>").buffer,
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/image-proxy?url=https://lsm-static-prod.livescore.com/test/not-an-image"
      ) as any
    );
    const body = await response.text();

    expect(response.status).toBe(415);
    expect(body).toMatch(/invalid upstream content-type/i);
  });
});
