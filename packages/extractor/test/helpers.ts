import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";

const here = dirname(fileURLToPath(import.meta.url));

export function loadDoc(fixture: string, url: string): Document {
  const html = readFileSync(join(here, "fixtures", fixture), "utf8");
  return new JSDOM(html, { url }).window.document as unknown as Document;
}
