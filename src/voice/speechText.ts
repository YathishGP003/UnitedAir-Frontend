/** Converts a safe Markdown answer into plain text for the operating-system voice. */
export function cleanSpeechText(input: string): string {
  if (!input) return "";
  const withoutCode = input.replace(/```[\s\S]*?```/g, " ");
  const lines = withoutCode
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/\[([^\]]+)]\((?:[^)]+)\)/g, "$1")
        .replace(/\[(?:E|T)\d{1,2}]/g, "")
        .replace(/^\s{0,3}(?:#{1,6}|[-*+]|\d+[.)])\s*/g, "")
        .replace(/[*_>`~]/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  for (let index = 0; index < lines.length - 1; index++) {
    if (!/[.!?:;]$/.test(lines[index])) lines[index] += ".";
  }
  return lines.join(" ").replace(/\s+([.,:;!?])/g, "$1").trim();
}
