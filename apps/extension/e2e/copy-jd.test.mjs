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

let failures = 0;
function check(condition, label, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label} ${detail === undefined ? "" : JSON.stringify(detail)}`);
  }
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

  if (liveUrl) await runLive(context, worker, liveUrl, liveNeedle);
  else await runFixtures(context, worker);
} finally {
  await context.close();
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
