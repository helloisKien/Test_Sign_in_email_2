/**
 * Best-effort extract of the "specific remediation" section from a QA markdown report.
 * Headings vary by language/template; returns "" when not found.
 */
export function extractRemediationSection(source: string): string {
  const text = (source || "").replace(/\r/g, "");
  if (!text.trim()) {
    return "";
  }

  const headingPatterns = [
    /^##\s*Đề xuất khắc phục cụ thể\s*$/im,
    /^##\s*Đề xuất khắc phục\s*$/im,
    /^##\s*Specific remediation(?:\s+actions)?\s*$/im,
    /^##\s*Remediation\s*$/im,
  ];

  for (const heading of headingPatterns) {
    const match = heading.exec(text);
    if (!match || match.index === undefined) {
      continue;
    }
    const start = match.index + match[0].length;
    const rest = text.slice(start);
    const nextHeading = rest.search(/\n##\s+/);
    const body = (nextHeading >= 0 ? rest.slice(0, nextHeading) : rest).trim();
    if (body) {
      return body;
    }
  }
  return "";
}
