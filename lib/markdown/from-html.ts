import DOMPurify from "dompurify";

function escapeText(value: string): string {
  return value.replace(/\s+/g, " ").replace(/[\\`*_[\]<>]/g, "\\$&");
}

function wrapInline(value: string, wrap: (text: string) => string): string {
  const trimmed = value.trim();
  if (!trimmed) return value;
  return (value.match(/^\s*/)?.[0] ?? "") + wrap(trimmed) + (value.match(/\s*$/)?.[0] ?? "");
}

function safeUrl(value: string, image = false): string | null {
  const url = value.trim();
  if (/^https?:\/\//i.test(url) || (!image && /^mailto:/i.test(url))) {
    return url.replace(/[<>()\s]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  }
  if (image && /^data:image\/(png|jpeg|webp|gif);base64,[a-z\d+/=]+$/i.test(url)) return url;
  return null;
}

/** Clipboard HTML is read as inert markup; only Markdown semantics survive. */
export function htmlToMarkdown(html: string): string {
  const fragment = DOMPurify.sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
  });
  const codeFragments: string[] = [];
  const protectCode = (value: string) => `\u0000${codeFragments.push(value) - 1}\u0000`;
  const children = (node: Node): string => Array.from(node.childNodes).map(convert).join("");
  const block = (value: string) => `\n\n${value.trim()}\n\n`;
  const list = (element: Element, depth = 0): string => {
    const ordered = element.tagName === "OL";
    const start = Number.parseInt(element.getAttribute("start") ?? "1", 10) || 1;
    return Array.from(element.children)
      .map((item, index) => {
        const prefix = ordered ? `${start + index}. ` : "- ";
        let body = "";
        let nested = "";
        for (const node of Array.from(item.childNodes)) {
          if (node instanceof Element && /^(UL|OL)$/.test(node.tagName)) {
            nested += `\n${list(node, depth + 1)}`;
          } else body += convert(node);
        }
        const indent = "    ".repeat(depth);
        return `${indent}${prefix}${body.trim().replace(/\n+/g, `\n${indent}    `)}${nested}`;
      })
      .join("\n");
  };
  function convert(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent ?? "");
    if (!(node instanceof Element)) return "";
    const tag = node.tagName;
    if (tag === "BR") return "\n";
    if (tag === "HR") return block("---");
    if (tag === "PRE") {
      const code = node.textContent?.replace(/\n$/, "") ?? "";
      const fence = "`".repeat(
        Math.max(3, ...Array.from(code.matchAll(/`+/g), (m) => m[0].length + 1)),
      );
      return block(protectCode(`${fence}\n${code}\n${fence}`));
    }
    if (tag === "UL" || tag === "OL") return block(list(node));
    if (tag === "IMG") {
      const url = safeUrl(node.getAttribute("src") ?? "", true);
      const alt = escapeText(node.getAttribute("alt") ?? "");
      return url ? `![${alt}](${url})` : alt;
    }
    if (tag === "TABLE") {
      const rows = Array.from(node.querySelectorAll("tr")).map((row) =>
        Array.from(row.children).map((cell) =>
          children(cell).trim().replace(/\|/g, "\\|").replace(/\n+/g, " "),
        ),
      );
      if (!rows.length) return "";
      const width = Math.max(...rows.map((row) => row.length));
      const rowText = (row: string[]) =>
        `| ${Array.from({ length: width }, (_, i) => row[i] ?? "").join(" | ")} |`;
      return block(
        [rowText(rows[0]), rowText(Array(width).fill("---")), ...rows.slice(1).map(rowText)].join(
          "\n",
        ),
      );
    }
    const value = children(node);
    if (/^H[1-6]$/.test(tag)) return block(`${"#".repeat(Number(tag[1]))} ${value.trim()}`);
    if (tag === "BLOCKQUOTE")
      return block(
        value
          .trim()
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n"),
      );
    if (tag === "A") {
      const url = safeUrl(node.getAttribute("href") ?? "");
      return url ? wrapInline(value, (text) => `[${text}](${url})`) : value;
    }
    if (tag === "CODE") {
      const text = node.textContent ?? "";
      const fence = "`".repeat(
        Math.max(1, ...Array.from(text.matchAll(/`+/g), (m) => m[0].length + 1)),
      );
      return protectCode(`${fence} ${text} ${fence}`);
    }
    const style = node.getAttribute("style") ?? "";
    const bold = tag === "STRONG" || tag === "B" || /font-weight\s*:\s*(bold|[6-9]00)/i.test(style);
    const italic = tag === "EM" || tag === "I" || /font-style\s*:\s*italic/i.test(style);
    let inline = value;
    if (bold) inline = wrapInline(inline, (text) => `**${text}**`);
    if (italic) inline = wrapInline(inline, (text) => `*${text}*`);
    if (tag === "DEL" || tag === "S" || tag === "STRIKE")
      inline = wrapInline(inline, (text) => `~~${text}~~`);
    return /^(P|DIV|SECTION|ARTICLE|HEADER|FOOTER)$/.test(tag) ? block(inline) : inline;
  }
  return children(fragment)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/\u0000(\d+)\u0000/g, (_match, index: string) => codeFragments[Number(index)] ?? "");
}
