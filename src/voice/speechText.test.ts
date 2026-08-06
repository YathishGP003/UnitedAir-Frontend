import { describe, expect, it } from "vitest";
import { cleanSpeechText } from "./speechText";

describe("cleanSpeechText", () => {
  it("removes citations and markdown before native speech", () => {
    expect(cleanSpeechText("## Baggage\n**Cabin:** 7 kg [E1]\n- One bag"))
      .toBe("Baggage. Cabin: 7 kg. One bag");
  });

  it("does not speak code blocks or raw link targets", () => {
    expect(cleanSpeechText("Read [the policy](https://example.test).\n```js\nalert(1)\n```"))
      .toBe("Read the policy.");
  });
});
