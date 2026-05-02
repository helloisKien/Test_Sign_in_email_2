function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function withInlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function markdownToHtml(value: string): string {
  const lines = value.replace(/\r/g, "").split("\n");
  const html: string[] = [];
  let listMode: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listMode) {
      html.push(`</${listMode}>`);
      listMode = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }
    if (/^---+$/.test(trimmed)) {
      closeList();
      html.push("<hr>");
      continue;
    }
    if (trimmed.startsWith("### ")) {
      closeList();
      html.push(`<h3>${withInlineMarkdown(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeList();
      html.push(`<h2>${withInlineMarkdown(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      closeList();
      html.push(`<h1>${withInlineMarkdown(trimmed.slice(2))}</h1>`);
      continue;
    }
    const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      if (listMode !== "ul") {
        closeList();
        listMode = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${withInlineMarkdown(unorderedMatch[1] || "")}</li>`);
      continue;
    }
    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (listMode !== "ol") {
        closeList();
        listMode = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${withInlineMarkdown(orderedMatch[1] || "")}</li>`);
      continue;
    }
    closeList();
    html.push(`<p>${withInlineMarkdown(trimmed)}</p>`);
  }

  closeList();
  return html.join("");
}

export function plainTextToHtml(value: string): string {
  return value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => `<p>${withInlineMarkdown(line)}</p>`)
    .join("");
}

export function renderPreviewHtml(value: string, format: "markdown" | "text" = "markdown"): string {
  return format === "text" ? plainTextToHtml(value) : markdownToHtml(value);
}
