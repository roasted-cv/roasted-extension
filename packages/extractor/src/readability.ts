import { Readability } from "@mozilla/readability";
import { htmlToText, normalizeText } from "./text";

export function readabilityText(doc: Document): string {
  try {
    const clone = doc.cloneNode(true) as Document;
    const article = new Readability(clone).parse();
    if (!article) return "";
    if (article.content) {
      const text = htmlToText(article.content, doc);
      if (text) return text;
    }
    return normalizeText(article.textContent ?? "");
  } catch {
    return "";
  }
}
