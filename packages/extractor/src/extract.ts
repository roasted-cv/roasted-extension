import { jsonLdJobDescription } from "./jsonld";
import { withHeader } from "./meta";
import { readabilityText } from "./readability";
import { matchSite } from "./sites";
import { htmlToText } from "./text";

export type ExtractTier = "selection" | "site-api" | "jsonld" | "site-dom" | "readability" | "none";

export interface ExtractResult {
  ok: boolean;
  tier: ExtractTier;
  text: string;
}

export interface ExtractOptions {
  url?: string;
  selection?: string | null;
  fetchJson?: (url: string) => Promise<unknown>;
  minLength?: number;
}

export async function extract(doc: Document, options: ExtractOptions = {}): Promise<ExtractResult> {
  const minLength = options.minLength ?? 40;

  const selection = (options.selection ?? "").trim();
  if (selection) return { ok: true, tier: "selection", text: selection };

  const url = options.url ?? readDocumentUrl(doc);
  const host = hostOf(url);
  const site = host ? matchSite(host) : null;

  if (site?.api && options.fetchJson && url) {
    const apiUrl = site.api.buildUrl(url);
    if (apiUrl) {
      try {
        const json = await options.fetchJson(apiUrl);
        const text = htmlToText(site.api.pick(json), doc);
        if (text.length >= minLength) return { ok: true, tier: "site-api", text: withHeader(text, doc, site) };
      } catch {}
    }
  }

  const jsonLd = jsonLdJobDescription(doc);
  if (jsonLd) {
    const text = htmlToText(jsonLd, doc);
    if (text.length >= minLength) return { ok: true, tier: "jsonld", text };
  }

  for (const selector of site?.selectors ?? []) {
    const element = doc.querySelector(selector);
    if (element) {
      const text = htmlToText(element, doc);
      if (text.length >= minLength) return { ok: true, tier: "site-dom", text: withHeader(text, doc, site) };
    }
  }

  if (!site?.disableReadability) {
    const readable = readabilityText(doc);
    if (readable.length >= minLength) return { ok: true, tier: "readability", text: readable };
  }

  return { ok: false, tier: "none", text: "" };
}

function readDocumentUrl(doc: Document): string {
  try {
    return doc.location?.href ?? doc.documentURI ?? "";
  } catch {
    return "";
  }
}

function hostOf(url: string): string {
  try {
    return url ? new URL(url).hostname : "";
  } catch {
    return "";
  }
}

