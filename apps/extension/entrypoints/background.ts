export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: "copy-jd",
      title: browser.i18n.getMessage("copyJd") || "Copy JD",
      contexts: ["page", "selection"],
    });
  });

  async function runCopyJD(tabId?: number) {
    let id = tabId;
    if (id == null) {
      const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
      id = tab?.id;
    }
    if (id == null) return { ok: false, tier: "none", length: 0 };

    const [injection] = await browser.scripting.executeScript({
      target: { tabId: id },
      files: ["/content-scripts/copy-jd.js"],
    });
    return injection?.result ?? { ok: false, tier: "none", length: 0 };
  }

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "copy-jd") void runCopyJD(tab?.id);
  });

  (globalThis as Record<string, unknown>).runCopyJD = runCopyJD;
  (globalThis as Record<string, unknown>).__copyJdReady = true;
});
