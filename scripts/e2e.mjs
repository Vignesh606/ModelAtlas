// End-to-end browser checks against a running server (dev or production).
// Usage: npm run e2e -- http://localhost:3000   (E2E_BROWSER=msedge|chrome, default msedge; no browser download)
// Playground checks call real free OpenRouter models; upstream rate limits can make those steps fail.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3123";
const SHOTS = "e2e-shots/";
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({ channel: process.env.E2E_BROWSER ?? "msedge", headless: true });

async function newPage({ consent = "essential", ...options } = {}) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, ...options });
  // Most sections pre-answer the cookie banner so it doesn't cover what they test.
  if (consent) await context.addCookies([{ name: "ma_consent", value: consent, url: BASE }]);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return { context, page, errors };
}

try {
  // ---------- /compare deep link in a fresh (incognito-like) context ----------
  {
    const { context, page, errors } = await newPage({ colorScheme: "dark" });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    await page.goto(`${BASE}/compare?models=openai/gpt-6.1-terra,deepseek/deepseek-v4.1-flash-uncensored`);
    await page.getByRole("heading", { name: "Technical comparison" }).waitFor();
    check("deep link renders matrix", await page.getByRole("table").isVisible());
    check("dark theme from OS preference", (await page.locator("html").getAttribute("data-theme")) === "dark");
    await page.screenshot({ path: `${SHOTS}compare-dark.png`, fullPage: true });

    // Marker survives only if there is no full reload.
    await page.evaluate(() => { window.__noReload = true; });

    // Combobox: type, arrow down, enter.
    const combo = page.getByRole("combobox", { name: "Add a model to the comparison" });
    await combo.click();
    await combo.fill("claude 3.5 sonnet sample");
    await combo.fill("claude-35");
    await page.getByRole("listbox").waitFor();
    const optionCount = await page.getByRole("option").count();
    await combo.press("Enter");
    await page.waitForFunction(() => location.search.includes("anthropic/claude-35-sonnet"), null, { timeout: 3000 });
    check("combobox adds model and URL updates via replaceState", true, `${optionCount} option(s) for "claude-35"`);
    check("no full page reload", await page.evaluate(() => window.__noReload === true));
    check("aria-expanded closes after select", (await combo.getAttribute("aria-expanded")) === "false");

    // Keyboard: open, arrow down twice, check activedescendant follows.
    await combo.fill("gemini");
    await combo.press("ArrowDown");
    const activeId = await combo.getAttribute("aria-activedescendant");
    check("arrow keys set aria-activedescendant", Boolean(activeId), activeId ?? "none");
    await combo.press("Escape");
    check("Escape closes listbox", (await combo.getAttribute("aria-expanded")) === "false");
    await combo.fill("");
    await combo.press("Escape"); // typing reopens the dropdown, which overlays the chips

    // Remove via chip.
    await page.getByRole("button", { name: "Remove Claude 3.5 Sonnet from comparison" }).first().click();
    await page.waitForFunction(() => !location.search.includes("claude-35"), null, { timeout: 3000 });
    check("remove updates URL", true);

    // Cost calculator: type 10,000,000 input tokens -> Terra = 10*1 + 1*5 = $15.00.
    const inputField = page.getByLabel("Monthly input (prompt) tokens", { exact: true });
    await inputField.fill("10000000");
    await page.getByText("$15.00", { exact: false }).first().waitFor({ timeout: 2000 });
    check("number input recalculates cost ($15.00 for Terra at 10M/1M)", true);

    // Slider via keyboard: End -> 1B tokens.
    const slider = page.getByRole("slider", { name: "Monthly input (prompt) tokens slider" });
    await slider.focus();
    await slider.press("End");
    check("slider End -> 1,000,000,000", (await inputField.inputValue()) === "1000000000", await inputField.inputValue());

    // Preset.
    await page.getByRole("button", { name: "Code agent" }).click();
    check("preset sets usage", (await inputField.inputValue()) === "200000000");
    check("preset aria-pressed", (await page.getByRole("button", { name: "Code agent" }).getAttribute("aria-pressed")) === "true");
    check("best value badge present", (await page.getByText("Best value").count()) >= 2);

    // Copy link + toast.
    await page.getByRole("button", { name: "Copy link" }).click();
    await page.getByText("Link copied to clipboard").waitFor({ timeout: 2000 });
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    check("copy link writes compare URL", clip === `${BASE}/compare?models=openai/gpt-6.1-terra,deepseek/deepseek-v4.1-flash-uncensored`, clip);

    check("no console/hydration errors on /compare", errors.length === 0, errors.join(" | ").slice(0, 300));
    await context.close();
  }

  // ---------- Home: search, cards, compare tray ----------
  {
    const { context, page, errors } = await newPage({ colorScheme: "light" });
    await page.goto(`${BASE}/`);
    await page.getByRole("table").waitFor();
    await page.screenshot({ path: `${SHOTS}home-light.png`, fullPage: false });
    await page.getByRole("searchbox", { name: "Search models" }).fill("terra");
    await page.waitForFunction(() => location.search.includes("q=terra"), null, { timeout: 3000 });
    check("debounced search writes ?q=", true);
    await page.getByRole("button", { name: "Vision" }).click();
    await page.waitForFunction(() => location.search.includes("caps=vision"), null, { timeout: 3000 });
    check("filter pill writes ?caps=", true);
    await page.getByRole("button", { name: "Cards" }).click();
    check("cards view", (await page.getByRole("button", { name: "Cards" }).getAttribute("aria-pressed")) === "true");

    // Add two models to the tray.
    await page.getByRole("button", { name: "Vision" }).click();
    await page.getByRole("searchbox", { name: "Search models" }).fill("");
    await page.getByRole("button", { name: "Table" }).click();
    const addButtons = page.getByRole("button", { name: /^Add .* to comparison$/ });
    await addButtons.nth(0).click();
    await addButtons.nth(0).click(); // the first one is now "Remove", so nth(0) is the next model
    const tray = page.getByRole("region", { name: "Comparison tray" });
    await tray.waitFor();
    const href = await tray.getByRole("link", { name: "Compare" }).getAttribute("href");
    check("tray collects models and links to /compare", /^\/compare\?models=[^,]+,[^,]+$/.test(href ?? ""), href ?? "");

    // Row click opens detail page.
    await page.locator("tbody tr").first().click({ position: { x: 600, y: 10 } });
    await page.waitForURL(/\/models\//, { timeout: 5000 });
    check("row click opens detail page", true, page.url().replace(BASE, ""));
    check("no console errors on home/detail", errors.length === 0, errors.join(" | ").slice(0, 300));
    await context.close();
  }

  // ---------- Playground ----------
  {
    const { context, page, errors } = await newPage({ colorScheme: "dark" });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    await page.goto(`${BASE}/playground`);
    await page.getByRole("log", { name: "Conversation" }).waitFor();
    check("playground defaults to a verified free model", (await page.getByText("nvidia/nemotron-3.5-super-vl:free").count()) > 0);

    // Send via a suggestion and wait for the reply to finish (Copy button appears when done).
    await page.getByRole("button", { name: "What is retrieval-augmented generation (RAG)?" }).click();
    const reply = page.getByRole("article").last();
    check("reply is aria-busy while streaming", (await reply.getAttribute("aria-busy")) === "true");
    // Wait for the reply to finish, successfully or with an error.
    await page.waitForFunction(() => document.querySelector("article[aria-busy]:last-of-type")?.getAttribute("aria-busy") === "false" || document.querySelectorAll('article[aria-busy="false"]').length > 0, null, { timeout: 90_000 });
    check("reply finishes and aria-busy clears", (await reply.getAttribute("aria-busy")) === "false");
    const box = page.getByRole("textbox", { name: "Message" });

    // Free models can be capped upstream (per minute or per day). The app must then show a
    // friendly error; checks that need a real reply are reported as SKIP instead of failing.
    const rateLimited = (await reply.getByRole("alert").count()) > 0 && /limit|allowance/i.test(await reply.getByRole("alert").innerText());
    if (rateLimited) {
      check("rate limit shows a friendly message with retry", (await reply.getByRole("button", { name: "Try again" }).count()) === 1);
      console.log("SKIP  reply-dependent playground checks (free models rate-limited upstream)");
    } else {
      const usageText = await reply.innerText();
      check("usage line shows tokens and latency", /[\d,]+ in · [\d,]+ out · [\d,]+ tokens · \d+\.\d+s/.test(usageText), usageText.split("\n").find((l) => l.includes("tokens")) ?? "");
      check("cost projection line links to compare", (await reply.getByRole("link", { name: "Compare costs" }).count()) === 1);
      check("markdown rendered (not raw asterisks)", !(await reply.locator(".chat-md").innerText()).includes("**"));
      await page.screenshot({ path: `${SHOTS}playground-dark.png`, fullPage: false });

      // Copy reply.
      await page.getByRole("button", { name: "Copy reply" }).last().click();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      check("copy reply writes text to clipboard", copied.length > 20, `${copied.length} chars`);

      // Regenerate replaces the last reply.
      const before = await page.getByRole("article").count();
      await page.getByRole("button", { name: "Regenerate reply" }).click();
      await page.getByRole("button", { name: "Copy reply" }).last().waitFor({ timeout: 90_000 });
      check("regenerate replaces (not appends) the reply", (await page.getByRole("article").count()) === before);

      // Enter sends; Escape stops.
      await box.fill("Count from 1 to 400, one number per line, no commentary.");
      await box.press("Enter");
      await page.getByRole("button", { name: "Stop generating" }).waitFor();
      await page.waitForTimeout(1500);
      await box.press("Escape");
      await page.getByText("Stopped.").waitFor({ timeout: 5000 });
      check("Escape stops a streaming reply", true);
      check("composer ready after stop", await page.getByRole("button", { name: "Send message" }).isVisible());
    }

    // Shift+Enter inserts a newline instead of sending.
    await box.fill("line one");
    await box.press("Shift+Enter");
    await box.type("line two");
    check("Shift+Enter adds a newline", (await box.inputValue()) === "line one\nline two");
    await box.fill("");

    // Bring-your-own-key: a wrong key gives a friendly 401, and the key is never persisted.
    await page.getByLabel("OpenRouter API key").fill(["sk-or", "v1", "0".repeat(64)].join("-"));
    await box.fill("hello");
    await box.press("Enter");
    const alert = page.getByRole("article").last().getByRole("alert"); // scoped: Next also renders a role=alert route announcer
    await alert.waitFor({ timeout: 20_000 });
    check("invalid user key shows friendly 401 message", (await alert.innerText()).includes("Your OpenRouter API key was rejected"));
    const leaked = await page.evaluate(() => JSON.stringify(localStorage).includes("sk-or") || document.cookie.includes("sk-or") || JSON.stringify(sessionStorage).includes("sk-or"));
    check("user key not stored in localStorage/sessionStorage/cookies", !leaked);
    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === "ma_session");
    check("session cookie is httpOnly + SameSite=Lax", Boolean(session?.httpOnly) && session?.sameSite === "Lax");
    await page.getByLabel("OpenRouter API key").fill("");

    // Clear, then side-by-side.
    await page.getByRole("button", { name: "Clear chat" }).click();
    check("clear chat empties the conversation", (await page.getByRole("article").count()) === 0);
    await page.getByRole("button", { name: "Side-by-side" }).click();
    check("side-by-side shows two panes", (await page.getByRole("log", { name: "Conversation" }).count()) === 2);
    await box.fill("Say hello in five words.");
    await box.press("Enter");
    // Both panes must finish: a reply, or a friendly error when free models are rate-limited upstream.
    await page.waitForFunction(() => { const a = [...document.querySelectorAll("article[aria-busy]")]; return a.length >= 2 && a.every((x) => x.getAttribute("aria-busy") === "false"); }, null, { timeout: 90_000 });
    check("both panes finish (reply or friendly error)", (await page.locator("article[aria-busy=false]").count()) >= 2);
    await page.screenshot({ path: `${SHOTS}playground-sbs.png`, fullPage: false });

    // Network errors for the deliberate 401 are logged by the browser; ignore only those.
    const realErrors = errors.filter((e) => !e.includes("Failed to load resource") && !e.includes("401"));
    check("no console errors on /playground", realErrors.length === 0, realErrors.join(" | ").slice(0, 300));

    // ---------- History (same browser session as the chats above) ----------
    errors.length = 0;
    await page.waitForTimeout(1500); // after() writes complete once each response has finished
    await page.goto(`${BASE}/history`);
    await page.getByRole("heading", { name: "Requests" }).waitFor();
    const requestsTile = await page.locator("dl dt", { hasText: "Requests" }).locator("xpath=following-sibling::dd[1]").innerText();
    check("analytics counts this session's requests", Number(requestsTile) >= (rateLimited ? 3 : 5), `${requestsTile} requests`);
    const statusCount = async (label) => page.locator("tbody").getByText(label, { exact: true }).count();
    const statusesOk = rateLimited
      ? (await statusCount("Error")) >= 1 // only failed requests exist while free models are capped
      : (await statusCount("Success")) >= 3 && (await statusCount("Stopped")) >= 1 && (await statusCount("Error")) >= 1;
    check("history lists this session's rows with statuses", statusesOk,
      `success ${await statusCount("Success")}, stopped ${await statusCount("Stopped")}, error ${await statusCount("Error")}`);
    await page.screenshot({ path: `${SHOTS}history-dark.png`, fullPage: true });

    // Model filter -> URL + fewer rows.
    const allRows = await page.locator("tbody tr").count();
    await page.getByRole("combobox", { name: /Model/ }).selectOption({ index: 2 });
    await page.waitForFunction(() => location.search.includes("model="), null, { timeout: 5000 });
    await page.waitForFunction((n) => document.querySelectorAll("tbody tr").length < n, allRows, { timeout: 5000 }).catch(() => {});
    check("model filter updates URL and narrows rows", (await page.locator("tbody tr").count()) < allRows, `${allRows} -> ${await page.locator("tbody tr").count()}`);

    // Search (debounced) -> URL ?q=
    await page.goto(`${BASE}/history`);
    await page.getByRole("searchbox", { name: "Search prompts and responses" }).fill("retrieval-augmented");
    await page.waitForFunction(() => location.search.includes("q=retrieval-augmented"), null, { timeout: 5000 });
    await page.waitForFunction(() => document.querySelectorAll("tbody tr").length >= 1, null, { timeout: 5000 });
    const searchRows = await page.locator("tbody tr").count();
    check("search filters by prompt text", searchRows >= 1 && searchRows < allRows, `${searchRows} row(s)`);

    // Row click -> detail page with prompt/response, copy works.
    await page.locator("tbody tr").first().click();
    await page.waitForURL(/\/history\/[0-9a-f-]{36}$/, { timeout: 5000 });
    await page.getByRole("heading", { name: "Prompt" }).waitFor();
    check("detail page shows prompt and response", (await page.getByRole("heading", { name: "Response" }).count()) === 1);
    await page.getByRole("button", { name: "Copy prompt" }).click();
    check("copy prompt on detail page", (await page.evaluate(() => navigator.clipboard.readText())).includes("retrieval-augmented"));

    // Export downloads.
    await page.goto(`${BASE}/history`);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "CSV" }).click()]);
    check("CSV export downloads a file", download.suggestedFilename().startsWith("modelatlas-history-") && download.suggestedFilename().endsWith(".csv"), download.suggestedFilename());
    check("no console errors on /history", errors.length === 0, errors.join(" | ").slice(0, 300));
    await context.close();
  }

  // ---------- Phase 6: cookie banner, consent and UTM tracking ----------
  {
    const { context, page, errors } = await newPage({ consent: null, viewport: { width: 1366, height: 900 } });
    const tracked = [];
    page.on("request", (r) => r.url().endsWith("/api/track") && tracked.push(r.method()));

    await page.goto(`${BASE}/?utm_source=newsletter&utm_medium=email&utm_campaign=e2e-launch`);
    const banner = page.getByRole("region", { name: "Cookies" });
    await banner.waitFor();
    check("cookie banner shows on first visit", await banner.isVisible());
    await page.waitForTimeout(800);
    let cookies = await context.cookies();
    check("nothing tracked or stored before consent", tracked.length === 0 && !cookies.some((c) => c.name === "ma_utm"), `track calls: ${tracked.length}`);
    // The catalog rewrites the URL on load; attribution must survive that.
    check("landing URL was rewritten by the catalog (attribution must still survive)", !page.url().includes("utm_source"));

    await banner.getByRole("button", { name: "Accept analytics" }).click();
    await page.waitForFunction(() => document.cookie.includes("ma_utm="), null, { timeout: 5000 });
    cookies = await context.cookies();
    const utm = cookies.find((c) => c.name === "ma_utm");
    const touch = JSON.parse(decodeURIComponent(utm.value));
    check("accepting writes first-touch UTM cookie from the landing URL", touch.source === "newsletter" && touch.campaign === "e2e-launch" && touch.medium === "email", JSON.stringify(touch));
    const days = Math.round((utm.expires * 1000 - Date.now()) / 86_400_000);
    check("UTM cookie lasts 30 days", days === 30, `${days} days`);
    check("banner hidden after choosing", !(await banner.isVisible()));
    await page.waitForTimeout(500);
    check("page view sent after consent", tracked.filter((m) => m === "POST").length >= 1, `${tracked.length} call(s)`);

    // Navigating sends another page view.
    const before = tracked.length;
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Compare" }).click();
    await page.waitForURL(/\/compare/);
    await page.waitForTimeout(800);
    check("each route change sends a page view", tracked.length > before);

    // Campaign shows up on the history analytics card.
    await page.goto(`${BASE}/history`);
    await page.getByRole("heading", { name: "Visits by campaign" }).waitFor();
    check("campaign count appears on /history", (await page.getByRole("cell", { name: "e2e-launch" }).count()) === 1);

    // Change of mind: Essential only -> cookie removed, visits deleted, tracking stops.
    await page.getByRole("button", { name: "Cookie settings" }).click();
    await banner.waitFor();
    await banner.getByRole("button", { name: "Essential only" }).click();
    await page.waitForTimeout(800);
    cookies = await context.cookies();
    check("revoking removes the UTM cookie", !cookies.some((c) => c.name === "ma_utm"));
    check("revoking deletes stored page views (DELETE sent)", tracked.includes("DELETE"));
    const afterRevoke = tracked.filter((m) => m === "POST").length;
    await page.goto(`${BASE}/compare`);
    await page.waitForTimeout(800);
    check("no page views after revoking", tracked.filter((m) => m === "POST").length === afterRevoke);
    await page.reload();
    check("choice persists across reloads (banner stays hidden)", !(await page.getByRole("region", { name: "Cookies" }).isVisible()));
    check("no console errors in consent flow", errors.length === 0, errors.join(" | ").slice(0, 300));
    await context.close();
  }

  // ---------- Phase 6: command palette, FAQ, back-to-top, contact, scroll progress ----------
  {
    const { context, page, errors } = await newPage({ colorScheme: "light" });
    await page.goto(`${BASE}/`);
    await page.getByRole("table").waitFor();

    // ⌘K / Ctrl+K opens the palette; search a model; Enter opens it.
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Search" });
    await palette.waitFor();
    const input = palette.getByRole("combobox", { name: "Search models, pages and FAQ" });
    check("Ctrl+K opens the command palette with focus in the input", await input.evaluate((el) => el === document.activeElement));
    await input.fill("gpt-6.1 terra");
    await palette.getByRole("option", { name: /GPT-6.1 Terra/ }).first().waitFor({ timeout: 10_000 });
    check("palette finds models", (await palette.getByRole("option", { name: /GPT-6.1 Terra/ }).count()) >= 1);
    await input.press("ArrowDown");
    check("arrow keys move the active option", Boolean(await input.getAttribute("aria-activedescendant")));
    await input.press("ArrowUp");
    // Ctrl+Enter adds the active model to compare without leaving.
    await input.press("Control+Enter");
    await palette.getByText(/Added .* to compare/).waitFor({ timeout: 3000 });
    check("Ctrl+Enter adds a model to compare", true);
    await input.press("Enter");
    await page.waitForURL(/\/models\//, { timeout: 5000 });
    check("Enter opens the model page", true, page.url().replace(BASE, ""));
    check("palette closes after navigating", !(await palette.isVisible()));
    // Next keeps the previous page mounted but hidden (<Activity>), so count visible bars only.
    // Scroll first: at the top the bar is scaleX(0), i.e. zero width, which counts as invisible.
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(200);
    check("scroll progress bar on model detail page", (await page.locator("div.fixed.h-0\\.5").filter({ visible: true }).count()) === 1);

    // Header button opens it too; search pages and FAQ.
    await page.getByRole("button", { name: "Search models, pages and FAQ" }).click();
    await palette.waitFor();
    await input.fill("estimator work");
    await palette.getByRole("option", { name: /How does the cost estimator work/ }).click();
    await page.waitForURL(/#faq-estimator/, { timeout: 5000 });
    const faqButton = page.getByRole("button", { name: "How does the cost estimator work?" });
    await page.waitForFunction(() => document.querySelector("#faq-estimator-button")?.getAttribute("aria-expanded") === "true", null, { timeout: 5000 });
    check("FAQ search result opens that answer", (await faqButton.getAttribute("aria-expanded")) === "true");
    await page.keyboard.press("Escape");

    // Accordion: multiple open, aria wiring, closed panels inert.
    const q1 = page.getByRole("button", { name: "Where does the model data come from?" });
    const q2 = page.getByRole("button", { name: "How accurate are the prices?" });
    await q1.click();
    await q2.click();
    check("FAQ allows multiple open items", (await q1.getAttribute("aria-expanded")) === "true" && (await q2.getAttribute("aria-expanded")) === "true");
    const panelId = await q1.getAttribute("aria-controls");
    check("FAQ button controls its region", (await page.locator(`#${panelId}`).getAttribute("role")) === "region");
    await q1.click();
    check("closed FAQ panel is inert", (await page.locator(`#${panelId}`).getAttribute("inert")) !== null);

    // Back to top: hidden at top, appears after 400px, returns to top.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    check("back-to-top hidden at the top", (await page.getByRole("button", { name: "Back to top" }).count()) === 0);
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.getByRole("button", { name: "Back to top" }).waitFor();
    await page.getByRole("button", { name: "Back to top" }).click();
    await page.waitForFunction(() => window.scrollY === 0, null, { timeout: 3000 });
    check("back-to-top scrolls to the top", true);

    // Contact panel.
    const contact = page.getByRole("button", { name: "Contact" });
    await contact.click();
    check("contact expands (aria-expanded)", (await contact.getAttribute("aria-expanded")) === "true");
    const region = page.getByRole("region", { name: "Contact" });
    check("contact panel has email + GitHub links", (await region.getByRole("link").count()) === 2);
    await page.keyboard.press("Escape");
    check("Escape closes contact and returns focus", !(await region.isVisible()) && (await contact.evaluate((el) => el === document.activeElement)));
    check("no scroll progress bar on /compare (not a long page)", await (async () => {
      await page.goto(`${BASE}/compare`);
      return (await page.locator("div.fixed.h-0\\.5").count()) === 0;
    })());
    check("no console errors (palette/FAQ/floating)", errors.length === 0, errors.join(" | ").slice(0, 300));
    await context.close();
  }

  // ---------- Phase 6: mobile menu + stacking on small screens ----------
  {
    const { context, page, errors } = await newPage({ consent: null, viewport: { width: 360, height: 740 } });
    await page.goto(`${BASE}/models/openai/gpt-6.1-terra`);
    const trigger = page.getByRole("button", { name: "Open menu" });
    await trigger.click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await menu.waitFor();
    check("menu button sets aria-expanded", (await trigger.getAttribute("aria-expanded")) === "true");
    check("body scroll locked while menu open", (await page.evaluate(() => document.documentElement.style.overflow)) === "hidden");
    let escaped = false;
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      // Native modal dialogs may hand focus to the browser chrome (activeElement = body)
      // between cycles; failing means landing on a page element outside the menu.
      const outside = await page.evaluate(() => {
        const a = document.activeElement;
        return Boolean(a && a !== document.body && !a.closest("#mobile-menu"));
      });
      if (outside) escaped = true;
    }
    check("focus is trapped inside the menu", !escaped);
    await page.keyboard.press("Escape");
    check("Escape closes the menu and returns focus", !(await menu.isVisible()) && (await trigger.evaluate((el) => el === document.activeElement)));
    check("scroll unlocked after closing", (await page.evaluate(() => document.documentElement.style.overflow)) === "");
    await trigger.click();
    await menu.getByRole("link", { name: "Playground" }).click();
    await page.waitForURL(/\/playground/);
    check("following a menu link navigates and closes the menu", !(await menu.isVisible()));

    // Banner, back-to-top and contact stacked without overlap on a small screen.
    await page.goto(`${BASE}/models/openai/gpt-6.1-terra`);
    await page.getByRole("region", { name: "Cookies" }).waitFor();
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.getByRole("button", { name: "Back to top" }).waitFor();
    const boxes = {
      banner: await page.getByRole("region", { name: "Cookies" }).boundingBox(),
      top: await page.getByRole("button", { name: "Back to top" }).boundingBox(),
      contact: await page.getByRole("button", { name: "Contact" }).boundingBox(),
    };
    const overlap = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    check("floating controls don't overlap on mobile", !overlap(boxes.banner, boxes.top) && !overlap(boxes.banner, boxes.contact) && !overlap(boxes.top, boxes.contact));
    await page.screenshot({ path: `${SHOTS}mobile-floating.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("no horizontal overflow with floating layer at 360px", overflow <= 0, `${overflow}px`);
    check("no console errors on mobile menu/stacking", errors.length === 0, errors.join(" | ").slice(0, 300));
    await context.close();
  }

  // ---------- Theme persistence, no flash ----------
  {
    const { context, page } = await newPage({ colorScheme: "light" });
    await page.goto(`${BASE}/history`);
    await page.getByRole("button", { name: "Dark theme" }).click();
    check("toggle applies dark", (await page.locator("html").getAttribute("data-theme")) === "dark");
    // Capture the attribute before React hydrates: the inline script must already have set it.
    await page.reload({ waitUntil: "commit" });
    await page.waitForSelector("body", { state: "attached" });
    const early = await page.evaluate(() => document.documentElement.dataset.theme);
    check("dark persists on reload before hydration (no flash)", early === "dark", String(early));
    await context.close();
  }

  // ---------- Mobile layout ----------
  {
    const { context, page, errors } = await newPage({ viewport: { width: 360, height: 780 }, colorScheme: "dark" });
    for (const path of [
      "/",
      "/?view=cards",
      "/compare",
      "/compare?models=openai/gpt-6.1-terra,deepseek/deepseek-v4.1-flash-uncensored,anthropic/claude-35-sonnet",
      "/models/openai/gpt-6.1-terra",
      "/models/deepseek/deepseek-v4.1-flash-uncensored",
      "/playground",
      "/history",
      "/models/nope/missing",
    ]) {
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(`no page-level horizontal overflow at 360px: ${path.slice(0, 40)}`, overflow <= 0, `${overflow}px`);
    }
    await page.screenshot({ path: `${SHOTS}detail-mobile.png`, fullPage: false });
    await page.goto(`${BASE}/compare?models=openai/gpt-6.1-terra,deepseek/deepseek-v4.1-flash-uncensored,anthropic/claude-35-sonnet`);
    await page.getByRole("heading", { name: "Technical comparison" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}compare-mobile.png`, fullPage: false });
    const scroller = page.locator("table").locator("xpath=..");
    const canScroll = await scroller.evaluate((el) => el.scrollWidth > el.clientWidth);
    check("matrix scrolls horizontally inside its container on mobile", canScroll);
    // The compare page synced 3 models into the tray; on mobile it shows a count and hides "Clear".
    await page.goto(`${BASE}/`);
    const tray = page.getByRole("region", { name: "Comparison tray" });
    await tray.waitFor();
    check("mobile tray hides Clear", !(await tray.getByRole("button", { name: "Clear" }).isVisible()));
    check("mobile tray shows count", (await tray.getByText("3/4").isVisible()));
    await page.screenshot({ path: `${SHOTS}tray-mobile.png`, fullPage: false });
    // The loop visits /models/nope/missing on purpose; its 404 document is logged by the browser.
    const mobileErrors = errors.filter((e) => !e.includes("status of 404"));
    check("no console errors on mobile", mobileErrors.length === 0, mobileErrors.join(" | ").slice(0, 300));
    check("missing model returns a real 404", (await page.goto(`${BASE}/models/nope/missing`))?.status() === 404);
    await context.close();
  }
} catch (error) {
  check("script completed", false, String(error).slice(0, 400));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
