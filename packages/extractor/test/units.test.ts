import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { htmlToText, normalizeText } from "../src/text";
import { matchSite } from "../src/sites";

const doc = new JSDOM("<!doctype html><html><body></body></html>").window.document as unknown as Document;

describe("htmlToText", () => {
  it("turns list items into dashed lines and keeps paragraph breaks", () => {
    const text = htmlToText("<p>Intro line.</p><ul><li>First</li><li>Second</li></ul><p>Outro.</p>", doc);
    expect(text).toBe("Intro line.\n\n- First\n- Second\n\nOutro.");
  });

  it("treats <br> as a line break and collapses whitespace inside text nodes", () => {
    const text = htmlToText("Line one<br>Line   two\n\n\nstill", doc);
    expect(text).toBe("Line one\nLine two still");
  });

  it("drops script and style content", () => {
    const text = htmlToText("<div>Keep<script>drop()</script><style>.x{}</style> me</div>", doc);
    expect(text).toBe("Keep me");
  });

  it("returns an empty string for empty input", () => {
    expect(htmlToText("", doc)).toBe("");
    expect(htmlToText(null, doc)).toBe("");
  });
});

describe("normalizeText", () => {
  it("trims lines and caps blank-line runs at one", () => {
    expect(normalizeText("  a  \n\n\n\n  b  ")).toBe("a\n\nb");
  });
});

describe("matchSite", () => {
  it("matches known hosts case-insensitively", () => {
    expect(matchSite("WWW.INDEED.COM")?.id).toBe("indeed");
    expect(matchSite("boards.greenhouse.io")?.id).toBe("greenhouse");
    expect(matchSite("hh.ru")?.id).toBe("hh");
    expect(matchSite("kazan.hh.ru")?.id).toBe("hh");
    expect(matchSite("nvidia.wd5.myworkdayjobs.com")?.id).toBe("workday");
  });

  it("returns null for unknown hosts", () => {
    expect(matchSite("northwind.example")).toBeNull();
  });

  it("builds the Workday cxs url from a job page url", () => {
    const workday = matchSite("acme.wd1.myworkdayjobs.com");
    const url = workday?.api?.buildUrl(
      "https://acme.wd1.myworkdayjobs.com/en-US/AcmeCareers/job/Remote/Engineer_JR9",
    );
    expect(url).toBe("https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/AcmeCareers/job/Remote/Engineer_JR9");
  });

  it("returns null cxs url when there is no job segment", () => {
    const workday = matchSite("acme.wd1.myworkdayjobs.com");
    expect(workday?.api?.buildUrl("https://acme.wd1.myworkdayjobs.com/en-US/AcmeCareers")).toBeNull();
  });
});
