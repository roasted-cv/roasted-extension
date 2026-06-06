export interface SiteApi {
  buildUrl(pageUrl: string): string | null;
  pick(json: unknown): string | null;
}

export interface HeaderSelectors {
  title?: string[];
  company?: string[];
  location?: string[];
}

export interface SiteRule {
  id: string;
  match: (host: string) => boolean;
  selectors?: string[];
  api?: SiteApi;
  /**
   * Per-host selectors for the job title / company / location shown above the
   * description. When present, extract() prepends a short header block to the
   * site-dom / site-api result so the copied JD carries the title and company,
   * not just the body text.
   */
  header?: HeaderSelectors;
  /**
   * When true, the readability fallback is skipped for this host. Use this on
   * sites whose generic chrome (sidebar prompts, empty-state cards, search
   * filters) reliably tricks Readability into picking up non-JD content.
   * LinkedIn is the canonical case: when no JD selector matches we'd rather
   * report failure than copy the right-rail "Search for jobs" prompt.
   */
  disableReadability?: boolean;
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
    // Order matters: prefer the tightest container holding only the JD text so
    // we don't pull in the "About the company" / criteria sidebars sitting in
    // the larger wrappers. Guest selectors come last (they only exist on
    // logged-out pages, where the larger auth ones are absent).
    selectors: [
      "#job-details",
      ".jobs-description-content__text",
      ".jobs-box__html-content",
      "article.jobs-description__container",
      ".jobs-description__content",
      ".jobs-description",
      ".show-more-less-html__markup",
      ".description__text",
    ],
    // Title/company/location live in the top card above #job-details (authed)
    // or the top-card-layout block (guest). The obfuscated wrapper classes
    // change often, so we lead with the stable BEM-ish names and fall back to
    // a scoped h1 (plus the aria-label trick handled in meta.ts).
    header: {
      title: [
        ".job-details-jobs-unified-top-card__job-title",
        ".jobs-unified-top-card__job-title",
        ".topcard__title",
        ".top-card-layout__title",
        ".jobs-search__job-details--container h1",
        ".job-view-layout h1",
      ],
      company: [
        ".job-details-jobs-unified-top-card__company-name",
        ".jobs-unified-top-card__company-name",
        ".topcard__org-name-link",
        ".top-card-layout__card .topcard__flavor",
      ],
      location: [
        ".job-details-jobs-unified-top-card__primary-description-container",
        ".job-details-jobs-unified-top-card__tertiary-description-container",
        ".jobs-unified-top-card__primary-description",
        ".topcard__flavor--bullet",
        ".top-card-layout__second-subline",
      ],
    },
    disableReadability: true,
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
