import { sanitizeRichHtml } from "lib/html/sanitize-rich-html";

type RichNode = {
  type?: string;
  value?: string;
  bold?: boolean;
  italic?: boolean;
  url?: string;
  listType?: string;
  children?: RichNode[];
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** `**phrase**` in plain text or CMS fields. */
function applyInlineMarkup(html: string): string {
  return html.replace(/\*\*([^*<]+)\*\*/g, "<strong>$1</strong>");
}

/**
 * Short labels at the start of a line, such as "Varietal:" or
 * "Taste Description:", are emphasized. Longer sentences that happen
 * to contain a colon are left alone.
 */
function emphasizeLeadingLabel(html: string): string {
  if (/^\s*<strong[\s>]/i.test(html)) return html;

  const match = html.match(/^([^<:]{1,40}):(\s*)([\s\S]*)$/);
  const label = match?.[1]?.trim() ?? "";
  if (!match || !label || label.includes(".") || label.includes("/")) {
    return html;
  }

  if (label.split(/\s+/).length > 5) return html;

  return `<strong>${match[1]}:</strong>${match[2] ?? ""}${match[3] ?? ""}`;
}

function emphasizeHtmlBlock(inner: string): string {
  return inner
    .split(/<br\s*\/?>/i)
    .map((piece) => emphasizeLeadingLabel(applyInlineMarkup(piece)))
    .join("<br>");
}

function paragraphHtml(inner: string): string {
  const marked = emphasizeHtmlBlock(inner);
  const plain = marked
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .trim();

  if (!plain) return '<p class="copy-gap"></p>';

  const className = plain.length > 80 ? ' class="copy-prose"' : "";
  return `<p${className}>${marked}</p>`;
}

function collapseBlankRuns(lines: string[]): string[] {
  const copy = [...lines];
  while (copy.length > 0 && copy[0] === "") copy.shift();
  while (copy.length > 0 && copy[copy.length - 1] === "") copy.pop();

  const collapsed: string[] = [];
  for (const line of copy) {
    if (line === "" && collapsed[collapsed.length - 1] === "") continue;
    collapsed.push(line);
  }
  return collapsed;
}

export function plainTextToHtml(text: string): string {
  const lines = collapseBlankRuns(
    text
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trim()),
  );

  if (lines.length === 0) return "";

  return lines
    .map((line) =>
      line ? paragraphHtml(escapeHtml(line)) : '<p class="copy-gap"></p>',
    )
    .join("");
}

function richChildren(node: RichNode): string {
  return (node.children ?? []).map((child) => richNodeToHtml(child)).join("");
}

function richNodeToHtml(node: RichNode): string {
  if (node.type === "text") {
    let value = applyInlineMarkup(escapeHtml(node.value ?? ""));
    if (node.bold) value = `<strong>${value}</strong>`;
    if (node.italic) value = `<em>${value}</em>`;
    return value;
  }

  const children = richChildren(node);

  if (node.type === "paragraph" || node.type === "heading") {
    return paragraphHtml(children);
  }

  if (node.type === "link") {
    const href = node.url?.trim() ?? "";
    if (!href || /^\s*(?:javascript|vbscript):/i.test(href)) return children;
    return `<a href="${escapeHtml(href)}">${children}</a>`;
  }

  if (node.type === "list") {
    const tag = node.listType === "ordered" ? "ol" : "ul";
    return `<${tag}>${children}</${tag}>`;
  }

  if (node.type === "list-item") {
    return `<li>${emphasizeHtmlBlock(children)}</li>`;
  }

  if (node.type === "root") return children;

  return children;
}

function isRichText(value: unknown): value is RichNode {
  if (!value || typeof value !== "object") return false;
  return (value as RichNode).type === "root";
}

function formatHtmlCopy(html: string): string {
  let safe = sanitizeRichHtml(html).trim();
  if (!safe) return "";

  const hasBlock = /<(p|ul|ol|h\d|div|blockquote|table)\b/i.test(safe);
  if (!hasBlock) return paragraphHtml(safe);

  safe = safe.replace(
    /<p\b[^>]*>\s*(?:<br\s*\/?>|&nbsp;|\s)*<\/p>/gi,
    '<p class="copy-gap"></p>',
  );
  safe = safe.replace(
    /(?:<br\s*\/?>\s*){2,}/gi,
    '</p><p class="copy-gap"></p><p>',
  );
  safe = safe.replace(
    /<p\b([^>]*)>([\s\S]*?)<\/p>/gi,
    (_full, attrs: string, inner: string) => {
      if (attrs.includes("copy-gap")) return '<p class="copy-gap"></p>';
      return paragraphHtml(inner);
    },
  );
  safe = safe.replace(
    /<li\b([^>]*)>([\s\S]*?)<\/li>/gi,
    (_full, attrs: string, inner: string) =>
      `<li${attrs}>${emphasizeHtmlBlock(inner)}</li>`,
  );
  safe = safe.replace(
    /(?:<p class="copy-gap"><\/p>\s*){2,}/gi,
    '<p class="copy-gap"></p>',
  );

  return safe;
}

/** Plain text, HTML, or Shopify rich text, with section gaps and highlights kept. */
export function formatCopySource(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (isRichText(parsed)) {
        const html = richNodeToHtml(parsed).trim();
        if (html) return html;
      }
    } catch {
      // Not rich-text JSON; fall through to plain text or HTML.
    }
  }

  if (/<[a-z!/]/i.test(trimmed)) return formatHtmlCopy(trimmed);
  return plainTextToHtml(trimmed);
}
