import { banyoneAuthenticatedFetch } from "./authenticated-fetch";

describe("banyoneAuthenticatedFetch", () => {
  it("merges Authorization Bearer from getIdToken", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({}),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await banyoneAuthenticatedFetch(
      "https://example.test/v1/x",
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
      async () => "token-abc",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const h = new Headers((init as RequestInit).headers);
    expect(h.get("Authorization")).toBe("Bearer token-abc");
    expect(h.get("Content-Type")).toBe("application/json");
  });
});
