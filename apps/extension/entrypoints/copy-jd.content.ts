import { extract, type ExtractResult } from "@roasted/extractor";

// LinkedIn (and a few other modern SPA career pages) renders the job posting
// shell first, then fetches the actual job description over XHR/RPC. If the
// user right-clicks Copy JD between those two events the first extract pass
// finds an empty container and we'd show "Couldn't find a job description"
// even though it's about to appear. Retry briefly with a small budget so the
// usual path stays instant for ready pages but slow async loaders still win.
const RETRY_BUDGET_MS = 1500;
const RETRY_STEP_MS = 200;

export default defineContentScript({
  registration: "runtime",
  async main() {
    const selection = window.getSelection()?.toString() ?? "";
    const result = await extractWithRetry(selection);

    if (!result.ok || !result.text) {
      toast(message("notFound", "Couldn't find a job description on this page"), true);
      return { ok: false, tier: result.tier, length: 0 };
    }

    const copied = await copyText(result.text);
    toast(
      copied
        ? message("copied", "Job description copied")
        : message("notFound", "Couldn't find a job description on this page"),
      !copied,
    );
    return { ok: copied, tier: result.tier, length: result.text.length };
  },
});

async function extractWithRetry(selection: string): Promise<ExtractResult> {
  const options = {
    selection,
    fetchJson: (url: string) =>
      fetch(url, { headers: { Accept: "application/json" }, credentials: "include" }).then(
        (response) => response.json(),
      ),
  };
  const first = await extract(document, options);
  // A user selection always wins instantly; never burn retry budget for it.
  if (first.ok || selection.trim().length > 0) return first;

  // LinkedIn injects the job description after an XHR resolves, so watch for
  // DOM mutations and re-extract when the page changes. Mutations are debounced
  // by RETRY_STEP_MS to coalesce SPA churn into at most one extract per step,
  // and a hard RETRY_BUDGET_MS timeout bounds the wait so a truly empty page
  // still resolves to the "not found" toast.
  return new Promise<ExtractResult>((resolve) => {
    let last = first;
    let settled = false;
    let pending = false;
    let stepTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: ExtractResult) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(stepTimer);
      clearTimeout(budgetTimer);
      resolve(result);
    };
    const tryExtract = async () => {
      if (settled || pending) return;
      pending = true;
      try {
        last = await extract(document, options);
        if (last.ok) finish(last);
      } finally {
        pending = false;
      }
    };
    const observer = new MutationObserver(() => {
      if (settled) return;
      clearTimeout(stepTimer);
      stepTimer = setTimeout(() => void tryExtract(), RETRY_STEP_MS);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const budgetTimer = setTimeout(() => finish(last), RETRY_BUDGET_MS);
  });
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return legacyCopy(text);
  }
}

function legacyCopy(text: string): boolean {
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

type MessageKey = "copyJd" | "copied" | "notFound";

function message(key: MessageKey, fallback: string): string {
  return browser.i18n.getMessage(key) || fallback;
}

let currentToast: { node: HTMLElement; hideTimer: number; removeTimer: number } | null = null;

function toast(text: string, isError: boolean): void {
  if (currentToast) {
    clearTimeout(currentToast.hideTimer);
    clearTimeout(currentToast.removeTimer);
    currentToast.node.remove();
    currentToast = null;
  }

  const node = document.createElement("div");
  node.setAttribute("data-copy-jd-toast", "");
  node.textContent = text;
  node.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "bottom:20px",
    "left:50%",
    "transform:translateX(-50%) translateY(8px)",
    "max-width:90vw",
    "padding:10px 14px",
    "border-radius:10px",
    "font:500 13px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
    "color:#fafafa",
    isError ? "background:#3a1414" : "background:#171717",
    "border:1px solid rgba(255,255,255,0.14)",
    "box-shadow:0 8px 28px rgba(0,0,0,0.4)",
    "opacity:0",
    "transition:opacity .18s ease, transform .18s ease",
    "pointer-events:none",
  ].join(";");
  document.body.appendChild(node);
  requestAnimationFrame(() => {
    node.style.opacity = "1";
    node.style.transform = "translateX(-50%) translateY(0)";
  });
  const hideTimer = window.setTimeout(() => {
    node.style.opacity = "0";
    node.style.transform = "translateX(-50%) translateY(8px)";
  }, 2200);
  const removeTimer = window.setTimeout(() => {
    node.remove();
    if (currentToast?.node === node) currentToast = null;
  }, 2420);
  currentToast = { node, hideTimer, removeTimer };
}
