import { defineConfig } from "wxt";

export default defineConfig({
  manifestVersion: 3,
  manifest: ({ mode }) => ({
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "en",
    permissions: ["contextMenus", "scripting", "activeTab"],
    ...(mode === "e2e" ? { host_permissions: ["<all_urls>"] } : {}),
  }),
});
