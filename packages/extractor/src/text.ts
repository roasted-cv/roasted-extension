const BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DD",
  "DIV",
  "DL",
  "DT",
  "FIELDSET",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TR",
  "UL",
]);

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);

export function htmlToText(source: string | Element | null | undefined, doc: Document): string {
  if (!source) return "";
  let root: Node;
  if (typeof source === "string") {
    const container = doc.createElement("div");
    container.innerHTML = source;
    root = container;
  } else {
    root = source;
  }
  const parts: string[] = [];
  collect(root, parts);
  return normalizeText(parts.join(""));
}

function collect(node: Node, out: string[]): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) {
      out.push((child.textContent ?? "").replace(/\s+/g, " "));
      continue;
    }
    if (child.nodeType !== 1) continue;
    const el = child as Element;
    const tag = el.tagName;
    if (tag === "BR") {
      out.push("\n");
      continue;
    }
    if (SKIP_TAGS.has(tag)) continue;
    if (tag === "LI") {
      out.push("\n- ");
      collect(el, out);
      continue;
    }
    const block = BLOCK_TAGS.has(tag);
    if (block) out.push("\n");
    collect(el, out);
    if (block) out.push("\n");
  }
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
