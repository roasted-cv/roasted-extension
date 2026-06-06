import type { SiteRule } from "./sites";

export interface JobMeta {
  title?: string;
  company?: string;
  location?: string;
}

// Collapse every run of whitespace (including newlines) into a single space so
// a multi-line heading like the LinkedIn title block becomes one clean line.
function oneLine(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function firstText(doc: Document, selectors: string[] | undefined): string {
  for (const selector of selectors ?? []) {
    const el = doc.querySelector(selector);
    const text = oneLine(el?.textContent);
    if (text) return text;
  }
  return "";
}

// The LinkedIn detail container exposes the full job title as an aria-label,
// which survives their obfuscated class renames — use it as a title fallback.
function titleFromAria(doc: Document): string {
  const el = doc.querySelector(".jobs-search__job-details--container[aria-label]");
  return oneLine(el?.getAttribute("aria-label"));
}

// LinkedIn's location/meta line is "City, Region, Country · 1 week ago ·
// 41 people clicked apply". Keep the geography and posted-date, drop the
// applicant/social noise so the copied header stays useful.
const META_NOISE =
  /(applicant|clicked apply|\bpeople\b|alumni|connection|be an early|reposted|managed off linkedin|\bresponses?\b|promoted|easy apply|actively reviewing)/i;

function cleanLocation(raw: string): string {
  if (!raw) return "";
  const parts = raw
    .split("·")
    .map((p) => p.trim())
    .filter(Boolean);
  const kept = parts.filter((p) => !META_NOISE.test(p));
  return (kept.length ? kept : parts).join(" · ");
}

export function extractMeta(doc: Document, site: SiteRule | null): JobMeta {
  const header = site?.header;
  if (!header) return {};
  const meta: JobMeta = {};
  const title = firstText(doc, header.title) || titleFromAria(doc);
  if (title) meta.title = title;
  const company = firstText(doc, header.company);
  if (company) meta.company = company;
  const location = cleanLocation(firstText(doc, header.location));
  if (location) meta.location = location;
  return meta;
}

// The company · location line shown beneath the title.
function subtitleLine(meta: JobMeta): string {
  return [meta.company, meta.location].filter(Boolean).join(" · ");
}

// Render the meta as a short header block placed above the job description:
//
//   {title}
//   {company} · {location}
//
// Either line is omitted when its data is missing.
export function formatHeader(meta: JobMeta): string {
  const lines: string[] = [];
  if (meta.title) lines.push(meta.title);
  const subtitle = subtitleLine(meta);
  if (subtitle) lines.push(subtitle);
  return lines.join("\n");
}

// Prepend the meta header to the extracted JD body. No-ops when the site has
// no header config or nothing useful was found, and avoids duplicating the
// title when the body already opens with it.
export function withHeader(body: string, doc: Document, site: SiteRule | null): string {
  const meta = extractMeta(doc, site);
  let header = formatHeader(meta);
  if (!header) return body;
  if (meta.title && body.slice(0, meta.title.length + 4).toLowerCase().includes(meta.title.toLowerCase())) {
    // Body already starts with the title; keep only the subtitle line.
    header = subtitleLine(meta);
    if (!header) return body;
  }
  return `${header}\n\n${body}`;
}
