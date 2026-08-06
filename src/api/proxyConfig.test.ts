import type { UserConfig } from "vite";
import { describe, expect, it } from "vitest";

import viteConfig from "../../vite.config";

describe("development API proxy", () => {
  it("forwards answer feedback to the backend", () => {
    const config = viteConfig as UserConfig;
    const proxy = config.server?.proxy;

    expect(proxy).toBeDefined();
    expect(proxy).toHaveProperty("/feedback");
  });
});
