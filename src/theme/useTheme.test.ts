import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useTheme } from "./useTheme";

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("always uses the light theme and clears a stored dark preference", () => {
    localStorage.setItem("unitedair.theme", "dark");
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(localStorage.getItem("unitedair.theme")).toBeNull();
  });
});
