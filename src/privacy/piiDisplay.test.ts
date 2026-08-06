import { describe, expect, it } from "vitest";
import { displayRedactedText } from "./piiDisplay";

describe("displayRedactedText", () => {
  it("never renders the broken PNR your booking phrase", () => {
    expect(displayRedactedText(
      "PNR [AIR-PNR-REDACTED] is confirmed.",
      "assistant",
    )).toBe("your booking reference is confirmed.");
  });

  it("renders a leading redacted booking as a readable answer", () => {
    expect(displayRedactedText(
      "[AIR-PNR-REDACTED]: UA404 DEL-LHR.",
      "assistant",
    )).toBe("Your booking: UA404 DEL-LHR.");
  });

  it("does not repeat your for a possessive labelled booking reference", () => {
    expect(displayRedactedText(
      "Your PNR is [AIR-PNR-REDACTED].",
      "assistant",
    )).toBe("Your booking reference.");
  });

  it("removes a hidden PNR clause without leaving broken grammar", () => {
    expect(displayRedactedText(
      "Your PNR is [AIR-PNR-REDACTED], and your fare is Economy.",
      "assistant",
    )).toBe("Your fare is Economy.");
  });
});
