import { launchPersistentContext } from "cloakbrowser";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const buildDir = resolve(here, "..", ".output", "chrome-mv3-e2e");
const fixturesDir = join(here, "fixtures");

const CASES = [
  { path: "/jsonld", file: "jsonld.html", tier: "jsonld", needle: "Senior Backend Engineer" },
  { path: "/readability", file: "readability.html", tier: "readability", needle: "Product Designer" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const liveIndex = args.indexOf("--url");
const liveUrl = liveIndex >= 0 ? args[liveIndex + 1] : null;
const needleIndex = args.indexOf("--needle");
const liveNeedle = needleIndex >= 0 ? args[needleIndex + 1] : null;
const linkedinFlag = args.includes("--linkedin");
const linkedinIdIndex = args.indexOf("--linkedin-id");
const linkedinId = linkedinIdIndex >= 0 ? args[linkedinIdIndex + 1] : null;

// The right-rail "Search for jobs" empty-state that historically leaked into
// the clipboard when LinkedIn selectors missed. This sentinel must never
// appear in a copied JD; kept in one place so it can't drift between checks.
const LINKEDIN_EMPTY_STATE = /Start a search and we'?ll share opportunities/i;

let failures = 0;
function check(condition, label, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label} ${detail === undefined ? "" : JSON.stringify(detail)}`);
  }
}

function assertNoEmptyState(clip, scope) {
  check(
    !LINKEDIN_EMPTY_STATE.test(clip),
    `${scope}: clipboard does not contain LinkedIn's 'Search for jobs' empty-state prompt`,
    clip.slice(0, 120),
  );
}

function startServer() {
  const server = createServer((req, res) => {
    const match = CASES.find((c) => c.path === req.url);
    if (!match) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync(join(fixturesDir, match.file), "utf8"));
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done(server)));
}

async function getWorker(context) {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 10000 });
  await sleep(800);
  return worker;
}

async function copyOnPage(context, worker, url) {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.bringToFront();
  await sleep(url.startsWith("http://127.0.0.1") ? 0 : 3500);
  await page.evaluate(() => navigator.clipboard.writeText("__CLEARED__")).catch(() => {});
  const result = await worker.evaluate(() => globalThis.runCopyJD());
  await sleep(400);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  await page.close();
  return { result, clip };
}

async function runFixtures(context, worker) {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const testCase of CASES) {
      const { result, clip } = await copyOnPage(context, worker, base + testCase.path);
      check(
        result?.ok === true && result.tier === testCase.tier,
        `${testCase.path}: runCopyJD succeeds via tier "${testCase.tier}"`,
        result,
      );
      check(clip.includes(testCase.needle), `${testCase.path}: clipboard holds the JD`, clip.slice(0, 80));
    }
  } finally {
    server.close();
  }
}

async function runLive(context, worker, url, needle) {
  const { result, clip } = await copyOnPage(context, worker, url);
  console.log(`  tier=${result?.tier} ok=${result?.ok} length=${result?.length}`);
  console.log(`  preview: ${clip.slice(0, 160).replace(/\s+/g, " ")}`);
  check(result?.ok === true && clip.length > 40, `live: copied a job description from ${url}`, result);
  if (needle) check(clip.includes(needle), `live: clipboard contains "${needle}"`);
  assertNoEmptyState(clip, "live");
}

// Resolve a LinkedIn job URL to drive in --linkedin mode. We try a few candidate
// guest job URLs in order: an explicit id, then a small built-in roster of
// long-lived public postings. Guest pages don't require login, so the test runs
// the full background -> scripting.executeScript -> content -> clipboard path
// against the live LinkedIn DOM without any session state.
async function resolveLinkedInJobUrl(context, explicitId) {
  if (explicitId) return `https://www.linkedin.com/jobs/view/${explicitId}/`;
  // The public guest jobs feed renders a list of canonical /jobs/view/{id}/
  // links without requiring login or hitting the sign-in modal that the
  // /jobs/search page throws up in headless.
  const probe = await context.newPage();
  try {
    await probe.goto(
      "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=software%20engineer&location=United%20States",
      { waitUntil: "domcontentloaded", timeout: 45000 },
    );
    await sleep(1500);
    const id = await probe.evaluate(() => {
      const link = document.querySelector("a[href*='/jobs/view/']");
      const href = link?.getAttribute("href") ?? "";
      const match = href.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)/);
      return match ? match[1] : null;
    });
    if (!id) throw new Error("could not resolve a LinkedIn job id from the guest jobs feed");
    return `https://www.linkedin.com/jobs/view/${id}/`;
  } finally {
    await probe.close().catch(() => {});
  }
}

async function runLinkedIn(context, worker, explicitId) {
  const url = await resolveLinkedInJobUrl(context, explicitId);
  console.log(`  resolved live LinkedIn job url: ${url}`);
  const { result, clip } = await copyOnPage(context, worker, url);
  console.log(`  tier=${result?.tier} ok=${result?.ok}`);
  console.log(`  preview: ${clip.slice(0, 200).replace(/\s+/g, " ")}`);
  check(result?.ok === true, `linkedin: extractor reports success`, result);
  check(result?.tier === "site-dom", `linkedin: hit the LinkedIn site-dom selectors, not Readability`, result);
  check(clip.length > 200, `linkedin: clipboard has a real JD payload`, { length: clip.length });
  assertNoEmptyState(clip, "linkedin");
}

const userDataDir = mkdtempSync(join(tmpdir(), "copyjd-e2e-"));
const context = await launchPersistentContext({ userDataDir, extensionPaths: [buildDir], headless: true });

try {
  const worker = await getWorker(context);
  const boot = await worker.evaluate(() => ({
    ready: globalThis.__copyJdReady === true,
    hasRun: typeof globalThis.runCopyJD === "function",
  }));
  check(boot.ready && boot.hasRun, "extension loads, service worker boots, runCopyJD wired", boot);

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  if (linkedinFlag || linkedinId) await runLinkedIn(context, worker, linkedinId);
  else if (liveUrl) await runLive(context, worker, liveUrl, liveNeedle);
  else await runFixtures(context, worker);
} finally {
  await context.close();
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
