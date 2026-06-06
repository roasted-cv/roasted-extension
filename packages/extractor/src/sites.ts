export interface SiteApi {
  buildUrl(pageUrl: string): string | null;
  pick(json: unknown): string | null;
}

export interface SiteRule {
  id: string;
  match: (host: string) => boolean;
  selectors?: string[];
  api?: SiteApi;
}

const workdayApi: SiteApi = {
  buildUrl(pageUrl) {
    try {
      const url = new URL(pageUrl);
      const tenant = url.hostname.split(".")[0];
      const segments = url.pathname.split("/").filter(Boolean);
      const jobIndex = segments.indexOf("job");
      if (jobIndex < 1 || !tenant) return null;
      const site = segments[jobIndex - 1];
      const jobPath = segments.slice(jobIndex).join("/");
      if (!site || !jobPath) return null;
      return `${url.origin}/wday/cxs/${tenant}/${site}/${jobPath}`;
    } catch {
      return null;
    }
  },
  pick(json) {
    const info = (json as { jobPostingInfo?: { jobDescription?: unknown } })?.jobPostingInfo;
    return typeof info?.jobDescription === "string" ? info.jobDescription : null;
  },
};

const RULES: SiteRule[] = [
  { id: "indeed", match: (h) => h.includes("indeed."), selectors: ["#jobDescriptionText"] },
  {
    id: "greenhouse",
    match: (h) => h.includes("greenhouse.io"),
    selectors: [".job__description", "[class*='_description']"],
  },
  { id: "hh", match: (h) => h === "hh.ru" || h.endsWith(".hh.ru"), selectors: ["[data-qa='vacancy-description']"] },
  {
    id: "linkedin",
    match: (h) => h.includes("linkedin.com"),
    selectors: [".show-more-less-html__markup", ".description__text", ".jobs-description__content"],
  },
  {
    id: "lever",
    match: (h) => h.includes("lever.co"),
    selectors: ["[data-qa='job-description']", ".section-wrapper.page-full-width"],
  },
  { id: "ashby", match: (h) => h.includes("ashbyhq.com"), selectors: ["[class*='_description']"] },
  {
    id: "workday",
    match: (h) => h.includes("myworkdayjobs.com"),
    selectors: ["[data-automation-id='jobPostingDescription']"],
    api: workdayApi,
  },
  {
    id: "apple",
    match: (h) => h.includes("jobs.apple.com"),
    selectors: ["[id*='jobdetails'] [class*='jobsummary']", "[id*='jobsummary-content']"],
  },
  { id: "stripe", match: (h) => h.includes("stripe.com"), selectors: ["section.JobsBodySection", ".JobsBodySection"] },
];

export function matchSite(host: string): SiteRule | null {
  const normalized = host.toLowerCase();
  return RULES.find((rule) => rule.match(normalized)) ?? null;
}
