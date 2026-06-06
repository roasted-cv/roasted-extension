import { describe, expect, it, vi } from "vitest";
import { extract } from "../src/extract";
import { loadDoc } from "./helpers";

describe("extract tier order", () => {
  it("returns the user selection above everything else", async () => {
    const doc = loadDoc("jsonld.html", "https://careers.acme.com/jobs/1");
    const result = await extract(doc, { selection: "  hand picked snippet  " });
    expect(result.ok).toBe(true);
    expect(result.tier).toBe("selection");
    expect(result.text).toBe("hand picked snippet");
  });

  it("reads JobPosting description from JSON-LD", async () => {
    const doc = loadDoc("jsonld.html", "https://careers.acme.com/jobs/1");
    const result = await extract(doc);
    expect(result.ok).toBe(true);
    expect(result.tier).toBe("jsonld");
    expect(result.text).toContain("Senior Backend Engineer");
    expect(result.text).toContain("- Design and own resilient APIs");
    expect(result.text).toContain("Go, Postgres and Kubernetes");
  });

  it("finds JobPosting inside a @graph array", async () => {
    const doc = loadDoc("graph-jsonld.html", "https://example.org/jobs/ds");
    const result = await extract(doc);
    expect(result.tier).toBe("jsonld");
    expect(result.text).toContain("Data Scientist");
    expect(result.text).toContain("- Build forecasting models");
  });

  it("prefers JSON-LD over a known site selector", async () => {
    const doc = loadDoc("indeed.html", "https://www.indeed.com/viewjob?jk=abc");
    const result = await extract(doc);
    expect(result.tier).toBe("jsonld");
    expect(result.text).toContain("canonical JSON-LD description");
    expect(result.text).not.toContain("should not be selected");
  });
});

describe("site-dom selectors", () => {
  it("uses the Greenhouse selector when JSON-LD is absent", async () => {
    const doc = loadDoc("greenhouse.html", "https://boards.greenhouse.io/acme/jobs/123");
    const result = await extract(doc);
    expect(result.tier).toBe("site-dom");
    expect(result.text).toContain("Research Engineer");
    expect(result.text).toContain("- Run large-scale training experiments");
  });

  it("uses the hh.ru data-qa selector", async () => {
    const doc = loadDoc("hh.html", "https://hh.ru/vacancy/123");
    const result = await extract(doc);
    expect(result.tier).toBe("site-dom");
    expect(result.text).toContain("бэкенд-разработчика");
  });

  it("uses the Stripe section selector", async () => {
    const doc = loadDoc("stripe.html", "https://stripe.com/jobs/listing/software-engineer/123");
    const result = await extract(doc);
    expect(result.tier).toBe("site-dom");
    expect(result.text).toContain("Payments team");
  });

  it("copies the JD from a LinkedIn guest job page", async () => {
    const doc = loadDoc("linkedin-guest.html", "https://www.linkedin.com/jobs/view/4406118990/");
    const result = await extract(doc);
    expect(result.tier).toBe("site-dom");
    expect(result.text).toContain("Software Engineer");
    expect(result.text).toContain("- Ship product surfaces");
    // The sidebar empty-state prompt must never leak into the JD.
    expect(result.text).not.toContain("Start a search and we'll share opportunities");
  });

  it("prepends title + company + location on a LinkedIn guest page", async () => {
    const doc = loadDoc("linkedin-guest.html", "https://www.linkedin.com/jobs/view/4406118990/");
    const result = await extract(doc);
    expect(result.text.startsWith("Software Engineer, New Grad")).toBe(true);
    expect(result.text).toContain("Notion · San Francisco, CA");
    // Header sits above the body.
    expect(result.text.indexOf("Notion")).toBeLessThan(result.text.indexOf("Who We Are"));
  });

  it("copies #job-details from the logged-in LinkedIn jobs UI", async () => {
    const doc = loadDoc(
      "linkedin-auth.html",
      "https://www.linkedin.com/jobs/search/?currentJobId=12345",
    );
    const result = await extract(doc);
    expect(result.tier).toBe("site-dom");
    expect(result.text).toContain("Senior Backend Engineer");
    expect(result.text).toContain("- Own services in Go and Postgres");
    expect(result.text).not.toContain("Search for jobs");
  });

  it("prepends title + company + clean location on the authed LinkedIn UI", async () => {
    const doc = loadDoc(
      "linkedin-auth.html",
      "https://www.linkedin.com/jobs/search/?currentJobId=12345",
    );
    const result = await extract(doc);
    expect(result.text.startsWith("Senior Backend Engineer")).toBe(true);
    expect(result.text).toContain("Acme Corp · San Francisco, CA · 2 weeks ago");
    // Title appears once (header only), and the body still follows it.
    expect(result.text.indexOf("About the role")).toBeGreaterThan(result.text.indexOf("Acme Corp"));
    // Applicant/social noise from the meta line is stripped.
    expect(result.text).not.toContain("87 people clicked apply");
    expect(result.text).not.toContain("managed off LinkedIn");
  });
});

describe("linkedin readability guard", () => {
  it("reports failure on a LinkedIn page with no JD instead of copying the sidebar prompt", async () => {
    const doc = loadDoc("linkedin-empty.html", "https://www.linkedin.com/jobs/");
    const result = await extract(doc);
    expect(result.ok).toBe(false);
    expect(result.tier).toBe("none");
    expect(result.text).toBe("");
  });
});

describe("readability fallback", () => {
  it("extracts a coherent JD from an unknown career site", async () => {
    const doc = loadDoc("readability.html", "https://northwind.example/careers/product-designer");
    const result = await extract(doc);
    expect(result.tier).toBe("readability");
    expect(result.text).toContain("Product Designer");
    expect(result.text).toContain("design system");
    expect(result.text.length).toBeGreaterThan(400);
  });

  it("reports failure when there is no job description", async () => {
    const doc = loadDoc("empty.html", "https://example.com/404");
    const result = await extract(doc);
    expect(result.ok).toBe(false);
    expect(result.tier).toBe("none");
    expect(result.text).toBe("");
  });
});

describe("workday cxs api", () => {
  const pageUrl =
    "https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/US-CA/Senior-Engineer_JR123";

  it("prefers the cxs JSON API for Workday hosts", async () => {
    const doc = loadDoc("workday-dom.html", pageUrl);
    const fetchJson = vi.fn().mockResolvedValue({
      jobPostingInfo: {
        jobDescription:
          "<p>Build distributed systems that power AI at planetary scale.</p><ul><li>Design fault-tolerant services</li></ul>",
      },
    });
    const result = await extract(doc, { fetchJson });
    expect(result.tier).toBe("site-api");
    expect(result.text).toContain("distributed systems");
    expect(fetchJson).toHaveBeenCalledWith(
      "https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/NVIDIAExternalCareerSite/job/US-CA/Senior-Engineer_JR123",
    );
  });

  it("falls back to the rendered Workday DOM when the api fails", async () => {
    const doc = loadDoc("workday-dom.html", pageUrl);
    const fetchJson = vi.fn().mockRejectedValue(new Error("network"));
    const result = await extract(doc, { fetchJson });
    expect(result.tier).toBe("site-dom");
    expect(result.text).toContain("Senior SRE");
  });
});
