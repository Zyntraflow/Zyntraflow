import { describe, expect, it, vi } from "vitest";
import { publishJson } from "../src/publishing/ipfsPublisher";

describe("ipfs publisher", () => {
  it("throws when upload URL is missing", async () => {
    await expect(
      publishJson({ hello: "world" }, { uploadUrl: "", fetchImpl: vi.fn() as unknown as typeof fetch }),
    ).rejects.toThrow("IPFS upload is not configured");
  });

  it("publishes JSON and returns cid/url", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ cid: "bafy123", url: "https://example.gateway/ipfs/bafy123" }), {
        status: 200,
      });
    });

    const result = await publishJson(
      { reportHash: "0x" + "ab".repeat(32) },
      {
        uploadUrl: "https://example.upload/api",
        authToken: "token123",
        fetchImpl: fetchMock as unknown as typeof fetch,
      },
    );

    expect(result.cid).toBe("bafy123");
    expect(result.url).toBe("https://example.gateway/ipfs/bafy123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request?.method).toBe("POST");
    expect((request?.headers as Record<string, string>).authorization).toBe("Bearer token123");
  });

  it("supports IpfsHash responses", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ IpfsHash: "QmHash" }), { status: 200 });
    });

    const result = await publishJson(
      { id: "summary-1" },
      {
        uploadUrl: "https://example.upload/api",
        fetchImpl: fetchMock as unknown as typeof fetch,
      },
    );

    expect(result.cid).toBe("QmHash");
    expect(result.url).toBe("https://ipfs.io/ipfs/QmHash");
  });
});
