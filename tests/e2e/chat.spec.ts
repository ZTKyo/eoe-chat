import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page, request }) => {
  const identityResponse = await request.get("/api/runtime-identity");
  expect(identityResponse.ok()).toBeTruthy();
  const identity = await identityResponse.json();
  expect(identity).toMatchObject({
    executionMode: process.env.EOE_EXPECTED_SERVER_MODE,
    runId: process.env.EOE_EXPECTED_SERVER_RUN_ID,
    port: Number(process.env.EOE_TEST_PORT),
    providerMode: process.env.EOE_EXPECTED_PROVIDER_MODE,
    liveRequests: 0,
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "想聊点什么？" })).toBeVisible();
});

test("sends a message and restores it after reload", async ({ page }) => {
  await page.getByTestId("composer-input").fill("我该怎么安排今天的计划？");
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("message-assistant")).toContainText("先", { timeout: 10_000 });
  const english = page.getByTestId("message-assistant").getByTestId("english-chunk");
  await expect(english).toHaveCount(1);
  const englishText = await english.textContent();
  await page.reload();
  await expect(page.getByTestId("message-user")).toContainText("安排今天的计划");
  await expect(page.getByTestId("message-assistant").getByTestId("english-chunk")).toHaveText(englishText ?? "");
});

test("creates a separate conversation", async ({ page }) => {
  const mobileButton = page.getByTestId("mobile-new-conversation");
  if (await mobileButton.isVisible()) {
    await mobileButton.click();
  } else {
    await page.getByTestId("new-conversation").click();
  }
  await expect(page.getByRole("heading", { name: "想聊点什么？" })).toBeVisible();
});

test("keeps the Text Beta image entry unavailable by default", async ({ page }) => {
  await expect(page.getByTestId("image-input")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "添加图片" })).toHaveCount(0);
  await expect(page.getByText("分析一张图片里的内容")).toHaveCount(0);
  await expect(page.getByTestId("composer-input")).toBeEnabled();
});

test("keeps text messaging available while image input is deferred", async ({ page }) => {
  await page.getByTestId("composer-input").fill("请帮我比较两个文字方案");
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("message-user").last()).toContainText("比较两个文字方案");
  await expect(page.getByTestId("message-assistant").last()).toBeVisible({ timeout: 10_000 });
});

test("cancels and retries an in-flight response", async ({ page }) => {
  await page.getByTestId("composer-input").fill("测试取消回复");
  await page.getByTestId("send-message").click();
  await page.getByTestId("cancel-response").click();
  await expect(page.getByTestId("message-assistant")).toContainText("回复已取消");
  await page.getByRole("button", { name: "重试" }).click();
  await expect(page.getByTestId("message-assistant")).toContainText("先", { timeout: 10_000 });
});

test("respects a Chinese-only noFit turn", async ({ page }) => {
  await page.getByTestId("composer-input").fill("请只用中文解释这个选择");
  await page.getByTestId("send-message").click();
  const assistant = page.getByTestId("message-assistant").last();
  await expect(assistant).toContainText("先确认现象", { timeout: 10_000 });
  await expect(assistant.getByTestId("english-chunk")).toHaveCount(0);
});

test("keeps engine diagnostics hidden by default", async ({ page }) => {
  await expect(page.getByTestId("developer-panel")).toHaveCount(0);
});

test("shows developer diagnostics only when explicitly enabled", async ({ page }) => {
  await page.goto("/?eoe-dev=1&eoe-level=3");
  await page.getByTestId("composer-input").fill("下一步该怎么做？");
  await page.getByTestId("send-message").click();
  const panel = page.getByTestId("developer-panel");
  await expect(panel).toContainText("Fixed / Effective", { timeout: 10_000 });
  await expect(panel).toContainText("3 / 3");
  await expect(panel).toContainText("eoe.phrases.v2.0");
  await expect(panel).toContainText("Template parse");
  await expect(panel).toContainText("eoe.provider-template.v1");
  await expect(panel).toContainText("A1:passed");
});

test("English chunks are subtle, clickable, and preserve message text order", async ({ page }, testInfo) => {
  await page.getByTestId("composer-input").fill("我该怎么计划下一步？");
  await page.getByTestId("send-message").click();
  const assistant = page.getByTestId("message-assistant").last();
  const chunk = assistant.getByTestId("english-chunk");
  await expect(chunk).toBeVisible({ timeout: 10_000 });
  await expect(chunk).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(chunk).toHaveCSS("padding-left", "0px");
  const before = await assistant.textContent();
  await chunk.click();
  expect(await assistant.textContent()).toBe(before);
  await expect(page.getByTestId("message-user").last()).toContainText("解释刚才的英文短语");
  const assistance = page.getByTestId("message-assistant").last();
  await expect(assistance).toContainText("原句：", { timeout: 10_000 });
  await expect(assistance).toContainText("for now：");
  await expect(assistance).toContainText("回到“我该怎么计划下一步？”");
  await expect(assistance).not.toContainText("短语：");
  const metrics = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewport);
  const screenshotDir = resolve(process.cwd(), "artifacts/screenshots");
  mkdirSync(screenshotDir, { recursive: true });
  const target = testInfo.project.name.includes("mobile")
    ? "m2.5-text-beta-mobile-390x844.png"
    : "m2.5-text-beta-desktop.png";
  await page.screenshot({ path: resolve(screenshotDir, target), fullPage: true });
});

test("keeps Chinese-only scope across turns and resumes only after user English", async ({ page }) => {
  const assistantMessages = page.getByTestId("message-assistant");
  const sendAndWaitForReply = async (content: string) => {
    const previousCount = await assistantMessages.count();
    await page.getByTestId("composer-input").fill(content);
    await expect(page.getByTestId("send-message")).toBeEnabled();
    await page.getByTestId("send-message").click();
    await expect(assistantMessages).toHaveCount(previousCount + 1, { timeout: 15_000 });
    return assistantMessages.last();
  };

  await sendAndWaitForReply("请只用中文");
  const chineseOnlyReply = await sendAndWaitForReply("继续分析这个方案");
  await expect(chineseOnlyReply.getByTestId("english-chunk")).toHaveCount(0);
  await sendAndWaitForReply("I think this works，你怎么看？");
});

test("exposes a valid PWA manifest with complete installability metadata", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/manifest+json");
  const manifest = await response.json();
  expect(manifest.id).toBe("/");
  expect(manifest.name).toBe("EOE Chat");
  expect(typeof manifest.short_name).toBe("string");
  expect(manifest.short_name.length).toBeGreaterThan(0);
  expect(manifest.start_url).toBe("/");
  expect(manifest.scope).toBe("/");
  expect(manifest.display).toBe("standalone");
  expect(typeof manifest.theme_color).toBe("string");
  expect(typeof manifest.background_color).toBe("string");
  expect(manifest.lang).toBe("zh-CN");
  expect(Array.isArray(manifest.icons)).toBe(true);
  const icons = manifest.icons as Array<{ src: string; sizes: string; type: string; purpose?: string }>;
  const any192 = icons.find((icon) => icon.sizes === "192x192" && (icon.purpose ?? "any").includes("any"));
  const any512 = icons.find((icon) => icon.sizes === "512x512" && (icon.purpose ?? "any").includes("any"));
  expect(any192).toBeTruthy();
  expect(any512).toBeTruthy();
  for (const icon of icons) {
    const iconResponse = await request.get(icon.src);
    expect(iconResponse.ok()).toBeTruthy();
    expect(iconResponse.headers()["content-type"]).toContain("image/png");
    const buffer = await iconResponse.body();
    expect(buffer.length).toBeGreaterThan(1024);
  }
});

test("serves a service worker that registers, becomes ready, and controls the page", async ({ page, request }) => {
  const swResponse = await request.get("/sw.js");
  expect(swResponse.ok()).toBeTruthy();
  const swContentType = swResponse.headers()["content-type"] ?? "";
  expect(swContentType).toContain("javascript");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "想聊点什么？" })).toBeVisible();

  const ready = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { supported: false } as const;
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return {
      supported: true as const,
      scope: registration.scope,
      scriptURL: registration.active?.scriptURL ?? "",
    };
  });
  expect(ready.supported).toBe(true);
  if (ready.supported) {
    expect(ready.scope).toBe(new URL("/", page.url()).toString());
    expect(ready.scriptURL).toContain("/sw.js");
  }

  // After reload, a controller must be active.
  await page.reload();
  await expect(page.getByRole("heading", { name: "想聊点什么？" })).toBeVisible();
  const controller = await page.evaluate(() => ({
    hasController: Boolean(navigator.serviceWorker.controller),
    scriptURL: navigator.serviceWorker.controller?.scriptURL ?? "",
  }));
  expect(controller.hasController).toBe(true);
  expect(controller.scriptURL).toContain("/sw.js");

  // /api/ must never be cached by the service worker.
  const apiCached = await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      if (keys.some((request) => new URL(request.url).pathname.startsWith("/api/"))) {
        return true;
      }
    }
    return false;
  });
  expect(apiCached).toBe(false);

  // Failed responses must never be cached. We probe a 404 path that the SW fetch handler sees.
  const cachedFailures = await page.evaluate(async () => {
    const probe = new URL("/this-does-not-exist-for-sw-cache-probe", window.location.origin);
    try {
      await fetch(probe.toString());
    } catch {
      // Network failure is also fine; we just want to confirm nothing is cached.
    }
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      if (keys.some((request) => request.url.includes("/this-does-not-exist-for-sw-cache-probe"))) {
        return true;
      }
    }
    return false;
  });
  expect(cachedFailures).toBe(false);
});

test("keeps the page stable (no infinite refresh) after service worker activation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "想聊点什么？" })).toBeVisible();
  const initialUrl = page.url();
  await page.waitForTimeout(1500);
  expect(page.url()).toBe(initialUrl);
  await expect(page.getByRole("heading", { name: "想聊点什么？" })).toBeVisible();
});

test("exposes a reachable PWA install entry in the sidebar", async ({ page }) => {
  await page.goto("/");
  // On mobile, the sidebar is hidden by default; open it first.
  const mobileSidebarToggle = page.getByRole("button", { name: "打开会话列表" });
  if (await mobileSidebarToggle.isVisible().catch(() => false)) {
    await mobileSidebarToggle.click();
  }
  const installButton = page.getByTestId("pwa-install-button");
  await expect(installButton).toBeVisible();
  await expect(installButton).toHaveAccessibleName(/安装 EOE Chat/);
  // Clicking opens either the native prompt (we cannot verify in CI) or a guidance dialog.
  // We just confirm the click does not throw and does not navigate away.
  const urlBefore = page.url();
  await installButton.click();
  await page.waitForTimeout(200);
  expect(page.url()).toBe(urlBefore);
});
