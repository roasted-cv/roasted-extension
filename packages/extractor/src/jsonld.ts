export function jsonLdJobDescription(doc: Document): string | null {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of Array.from(scripts)) {
    const node = findJobPosting(script.textContent);
    const description = node?.["description"];
    if (typeof description === "string" && description.trim()) {
      return description;
    }
  }
  return null;
}

type JsonObject = Record<string, unknown>;

function findJobPosting(raw: string | null): JsonObject | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const queue: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    if (!item || typeof item !== "object") continue;
    const obj = item as JsonObject;
    const graph = obj["@graph"];
    if (Array.isArray(graph)) queue.push(...graph);
    if (isJobPosting(obj["@type"])) return obj;
  }
  return null;
}

function isJobPosting(type: unknown): boolean {
  return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
}
