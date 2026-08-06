import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./client";

describe("API response boundary", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("reports an HTML route fallback as an API routing error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      "<!doctype html><html><body>UnitedAir AI</body></html>",
      {
        status: 200,
        headers: { "Content-Type": "text/html" },
      },
    )));

    await expect(api.staffRefundCases()).rejects.toEqual(
      expect.objectContaining<ApiError>({
        name: "ApiError",
        status: 502,
        message: expect.stringContaining("API route"),
      }),
    );
  });
});
