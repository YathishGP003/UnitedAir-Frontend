export type DisplayContext = "user" | "assistant";

const PNR_TOKEN = "[AIR-PNR-REDACTED]";

/** Human-readable rendering of already-redacted API/audit content. */
export function displayRedactedText(
  text: string,
  context: DisplayContext,
): string {
  if (!text.includes(PNR_TOKEN)) return text;
  const reference = context === "user"
    ? "my booking reference"
    : "your booking reference";
  const possessiveReference = context === "user"
    ? "My booking reference"
    : "Your booking reference";
  const leading = context === "user" ? "My booking:" : "Your booking:";

  return text
    .replace(
      /\b(?:your|my)\s+(?:PNR|booking\s+reference|record\s+locator)\s*(?:is\s*)?[:#-]?\s*\[AIR-PNR-REDACTED\]\s*,\s*and\s+(?:your|my)\s+/gi,
      context === "user" ? "My " : "Your ",
    )
    .replace(
      /\b(?:your|my)\s+(?:PNR|booking\s+reference|record\s+locator)\s*(?:is\s*)?[:#-]?\s*\[AIR-PNR-REDACTED\]/gi,
      possessiveReference,
    )
    .replace(
      /\b(?:PNR|booking\s+reference|record\s+locator)\s*(?:is\s*)?[:#-]?\s*\[AIR-PNR-REDACTED\]/gi,
      reference,
    )
    .replace(
      /\b(?:your|my)\s+\[AIR-PNR-REDACTED\]/gi,
      possessiveReference,
    )
    .replace(/booking\s+\[AIR-PNR-REDACTED\]/gi, reference)
    .replace(/\[AIR-PNR-REDACTED\]\s*:/g, leading)
    .replaceAll(PNR_TOKEN, reference);
}
