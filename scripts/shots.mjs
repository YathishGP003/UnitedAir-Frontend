// Screenshot harness for the UnitedAir AI frontend.
//
// Drives the *running* dev server (http://localhost:5173) with the system Chrome
// via puppeteer-core, signs in through the one-click demo accounts, and captures
// every route for each role so the redesign can be reviewed as real pixels.
//
//   node scripts/shots.mjs                 # all roles, all pages, desktop
//   node scripts/shots.mjs passenger       # only one role
//   node scripts/shots.mjs --mobile        # 390px viewport
//   node scripts/shots.mjs passenger:chat  # a single target by name
//
// Output: frontend/screenshots/<role>-<name>.png
import { launch } from "puppeteer-core";
import { mkdir, readdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "screenshots");
const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const args = process.argv.slice(2);
const requestedWidth = Number(
  args.find((arg) => arg.startsWith("--width="))?.split("=")[1],
);
if (Number.isFinite(requestedWidth) && (requestedWidth < 320 || requestedWidth > 2560)) {
  throw new Error("--width must be between 320 and 2560 pixels.");
}
const MOBILE = args.includes("--mobile") || (requestedWidth > 0 && requestedWidth <= 480);
const AUDIT = args.includes("--audit");
const filters = args.filter((a) => !a.startsWith("--"));
const VIEWPORT = {
  width: requestedWidth || (MOBILE ? 390 : 1440),
  height: MOBILE ? 844 : 900,
  deviceScaleFactor: 1,
};
const VIEWPORT_SUFFIX = requestedWidth ? `-${VIEWPORT.width}px` : MOBILE ? "-mobile" : "";

// role -> demo account data-role attribute on the login screen
const ROLE_ATTR = {
  passenger: "PASSENGER",
  staff: "AIRLINE_STAFF",
  admin: "ADMIN",
};

// role -> [ { name, path, prep? } ]  (prep runs after navigation, before the shot)
const TARGETS = {
  passenger: [
    { name: "chat", path: "/passenger" },
    {
      name: "chat-booking",
      path: "/passenger",
      prep: async (p) => {
        const ask = async (question) => {
          const before = await p.$$eval(".msg-assistant", (nodes) => nodes.length);
          await p.focus(".composer textarea");
          await p.type(".composer textarea", question);
          await p.keyboard.press("Enter");
          await p.waitForFunction(
            (count) => {
              const turns = [...document.querySelectorAll(".msg-assistant")];
              return turns.length > count
                && Boolean(turns.at(-1)?.querySelector(".message-actions"));
            },
            { timeout: 30000 },
            before,
          );
        };
        await ask("I want to book tickets");
        await ask("Bengaluru to Delhi");
        await ask("tomorrow");
        await p.waitForSelector(".chat-flight .chat-fares button", { timeout: 15000 });
        await p.click(".chat-flight .chat-fares button");
        await p.waitForFunction(
          () => document.querySelector(".checkout-seat-grid button")
            || document.querySelector(".checkout .alert"),
          { timeout: 15000 },
        );
        const checkoutError = await p.$eval(
          ".checkout .alert",
          (node) => node.textContent?.trim(),
        ).catch(() => null);
        if (checkoutError) throw new Error(`Chat checkout failed: ${checkoutError}`);
        await sleep(350);
      },
    },
    {
      name: "chat-collapsed",
      path: "/passenger",
      prep: async (p) => {
        const selector = 'button[aria-label="Hide conversations"]';
        const isVisible = await p.$eval(selector, (button) => {
          const rect = button.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }).catch(() => false);
        if (isVisible) await p.click(selector);
        await sleep(500);
      },
    },
    { name: "search", path: "/passenger/search" },
    {
      name: "checkout",
      path: "/passenger/search",
      prep: async (p) => {
        await p.click(".search-go");
        await p.waitForSelector(".flight-card .fare-book:not([disabled])", { timeout: 15000 });
        await p.click(".flight-card .fare-book:not([disabled])");
        await p.waitForSelector(".checkout", { timeout: 15000 });
        await p.waitForFunction(
          () => document.querySelector(".checkout-seat-grid button")
            || document.querySelector(".checkout .alert"),
          { timeout: 15000 },
        );
        const checkoutError = await p.$eval(
          ".checkout .alert",
          (node) => node.textContent?.trim(),
        ).catch(() => null);
        if (checkoutError) throw new Error(`Checkout failed: ${checkoutError}`);
        await sleep(350);
      },
    },
    { name: "bookings", path: "/passenger/bookings" },
    { name: "status", path: "/passenger/status" },
    { name: "baggage", path: "/passenger/baggage" },
    {
      name: "baggage-excess",
      path: "/passenger/baggage",
      prep: async (p) => {
        await p.select("#bag-cabin", "BUSINESS");
        await p.$eval("#bag-weight", (input) => {
          const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          )?.set;
          setter?.call(input, "190");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await sleep(250);
      },
    },
  ],
  staff: [
    { name: "chat", path: "/staff" },
    { name: "operations", path: "/staff/operations" },
    { name: "escalations", path: "/staff/escalations" },
    { name: "audit", path: "/staff/audit" },
  ],
  admin: [
    { name: "documents", path: "/governance" },
    { name: "jobs", path: "/governance/jobs" },
    { name: "retrieval", path: "/governance/retrieval" },
    { name: "quality", path: "/governance/quality" },
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let contrastFailures = 0;
let layoutFailures = 0;
let runtimeFailures = 0;

async function auditContrast(page, label) {
  const issues = await page.evaluate(() => {
    const parse = (value) => {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [];
      if (parts.length < 3) return null;
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
    };
    const channel = (value) => {
      const normalized = value / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (color) =>
      0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
    const contrast = (foreground, background) => {
      const high = Math.max(luminance(foreground), luminance(background));
      const low = Math.min(luminance(foreground), luminance(background));
      return (high + 0.05) / (low + 0.05);
    };
    const effectiveBackground = (element) => {
      let node = element;
      while (node) {
        const color = parse(getComputedStyle(node).backgroundColor);
        if (color && color.a > 0.95) return color;
        node = node.parentElement;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };

    return [...document.querySelectorAll("body *")].flatMap((element) => {
      const ownText = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!ownText) return [];
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (
        style.visibility === "hidden"
        || style.display === "none"
        || Number(style.opacity) < 0.9
        || rect.width < 1
        || rect.height < 1
      ) return [];
      const foreground = parse(style.color);
      if (!foreground) return [];
      const ratio = contrast(foreground, effectiveBackground(element));
      const fontSize = Number.parseFloat(style.fontSize);
      const isBold = Number.parseInt(style.fontWeight, 10) >= 700;
      const threshold = fontSize >= 24 || (isBold && fontSize >= 18.66) ? 3 : 4.5;
      if (ratio >= threshold) return [];
      return [{
        selector: element.className
          ? `${element.tagName.toLowerCase()}.${String(element.className).trim().replace(/\s+/g, ".")}`
          : element.tagName.toLowerCase(),
        text: ownText.slice(0, 72),
        ratio: ratio.toFixed(2),
        threshold,
      }];
    });
  });

  if (!issues.length) {
    console.log(`  contrast ✓ ${label}`);
    return;
  }
  contrastFailures += issues.length;
  console.error(`  contrast ✗ ${label}: ${issues.length} issue(s)`);
  for (const issue of issues.slice(0, 12)) {
    console.error(`    ${issue.ratio}:1 < ${issue.threshold}:1 ${issue.selector} — ${issue.text}`);
  }
}

async function auditLayout(page, label) {
  const issues = await page.evaluate(() => {
    const failures = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 1) {
      failures.push(
        `horizontal body overflow ${document.documentElement.scrollWidth}px > ${window.innerWidth}px`,
      );
    }
    const bodyText = document.body.innerText;
    for (const marker of [
      "Unexpected token '<'",
      "<!doctype",
      "is not valid JSON",
      "Request failed (502)",
    ]) {
      if (bodyText.includes(marker)) failures.push(`raw error rendered: ${marker}`);
    }
    for (const dialog of document.querySelectorAll('[role="dialog"]')) {
      const rect = dialog.getBoundingClientRect();
      if (rect.left < -1 || rect.right > window.innerWidth + 1) {
        failures.push(`dialog exceeds viewport: ${dialog.getAttribute("aria-label") ?? dialog.className}`);
      }
    }
    for (const control of document.querySelectorAll("button, a[href], input, textarea, select")) {
      const rect = control.getBoundingClientRect();
      const style = getComputedStyle(control);
      if (
        style.display === "none"
        || style.visibility === "hidden"
        || rect.width < 2
        || rect.height < 2
        || rect.bottom <= 0
        || rect.top >= window.innerHeight
        || rect.right <= 0
        || rect.left >= window.innerWidth
      ) continue;
      if (rect.left < -1 || rect.right > window.innerWidth + 1) {
        failures.push(`control clipped horizontally: ${control.getAttribute("aria-label") ?? control.textContent?.trim().slice(0, 40)}`);
        continue;
      }
      const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
      const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      let clippedAtCenter = false;
      for (let parent = control.parentElement; parent; parent = parent.parentElement) {
        const overflow = getComputedStyle(parent);
        if (
          !["auto", "scroll", "hidden", "clip"].includes(overflow.overflow)
          && !["auto", "scroll", "hidden", "clip"].includes(overflow.overflowY)
          && !["auto", "scroll", "hidden", "clip"].includes(overflow.overflowX)
        ) continue;
        const clip = parent.getBoundingClientRect();
        if (x < clip.left || x > clip.right || y < clip.top || y > clip.bottom) {
          clippedAtCenter = true;
          break;
        }
      }
      if (clippedAtCenter) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && hit !== control && !control.contains(hit) && !hit.contains(control)) {
        failures.push(`control covered: ${control.getAttribute("aria-label") ?? control.textContent?.trim().slice(0, 40)}`);
      }
    }
    return failures;
  });
  if (!issues.length) {
    console.log(`  layout ✓ ${label} @ ${VIEWPORT.width}px`);
    return;
  }
  layoutFailures += issues.length;
  console.error(`  layout ✗ ${label}: ${issues.length} issue(s)`);
  for (const issue of issues.slice(0, 12)) console.error(`    ${issue}`);
}

async function shot(page, file) {
  await page.screenshot({ path: join(OUT, file) });
  console.log("  ✓", file);
}

async function signIn(page, role) {
  const attr = ROLE_ATTR[role];
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  const sel = `button.demo-btn[data-role="${attr}"]`;
  await page.waitForSelector(sel, { timeout: 15000 });
  await page.click(sel);
  if (role === "passenger") {
    const account = ".passenger-demo-accounts button";
    await page.waitForSelector(account, { timeout: 10000 });
    await page.click(account);
  }
  await page.waitForFunction(
    () => {
      const email = document.querySelector("#email");
      const password = document.querySelector("#password");
      return email?.value?.includes("@unitedair.demo") && password?.value === "Demo!2026";
    },
    { timeout: 10000 },
  );
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
    page.click(".login-submit"),
  ]);
  // SPA route swap may not fire a navigation event; wait for the shell instead.
  await page.waitForSelector(".topbar", { timeout: 15000 });
  await sleep(500);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  // Clear stale shots for the roles we're about to capture.
  const wanted = filters.length
    ? filters.map((f) => f.split(":")[0])
    : Object.keys(TARGETS);
  for (const f of await readdir(OUT).catch(() => [])) {
    const sameViewport = requestedWidth
      ? f.endsWith(`${VIEWPORT_SUFFIX}.png`)
      : MOBILE
        ? f.endsWith("-mobile.png")
        : !f.endsWith("-mobile.png") && !/-\d+px\.png$/.test(f);
    const matchingRole = wanted.some((r) => r !== "login" && f.startsWith(`${r}-`));
    const matchingLogin = wanted.includes("login") && f.startsWith("login");
    if (sameViewport && (matchingRole || matchingLogin)) {
      await unlink(join(OUT, f)).catch(() => {});
    }
  }

  const browser = await launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
    defaultViewport: VIEWPORT,
  });

  try {
    // Login screen (no auth needed)
    if (!filters.length || filters.some((f) => f.startsWith("login"))) {
      const page = await browser.newPage();
      await page.setViewport(VIEWPORT);
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
      await page.waitForSelector(".login-card", { timeout: 15000 });
      const showAccounts = filters.includes("login:accounts");
      if (showAccounts) {
        await page.click('button.demo-btn[data-role="PASSENGER"]');
        await page.waitForSelector(".passenger-demo-accounts button", { timeout: 10000 });
      }
      await sleep(400);
      if (AUDIT) await auditContrast(page, showAccounts ? "login:accounts" : "login");
      if (AUDIT) await auditLayout(page, showAccounts ? "login:accounts" : "login");
      await shot(page, `login${showAccounts ? "-accounts" : ""}${VIEWPORT_SUFFIX}.png`);
      await page.close();
    }

    for (const [role, targets] of Object.entries(TARGETS)) {
      const roleFilters = filters.filter((f) => f.startsWith(role));
      if (filters.length && !roleFilters.length) continue;

      const page = await browser.newPage();
      let runtimeAuditActive = false;
      page.on("pageerror", (error) => {
        if (!runtimeAuditActive) return;
        runtimeFailures++;
        console.error(`[${role}] page error:`, error.message);
      });
      page.on("response", (response) => {
        if (
          runtimeAuditActive
          && response.status() >= 400
          && !response.url().endsWith("/favicon.ico")
        ) {
          runtimeFailures++;
          console.error(`[${role}] HTTP ${response.status()} ${response.url()}`);
        }
      });
      await page.setViewport(VIEWPORT);
      await signIn(page, role);
      // Clearing a previous role's local storage can race with that shell's final
      // in-flight requests. Start runtime auditing only after the new role has
      // authenticated so those expected transition 401s are not false positives.
      runtimeAuditActive = true;
      console.log(role, "signed in");

      for (const t of targets) {
        const named = roleFilters.map((f) => f.split(":")[1]).filter(Boolean);
        if (named.length && !named.includes(t.name)) continue;
        await page.goto(`${BASE}${t.path}`, { waitUntil: "networkidle2" });
        try {
          await page.waitForSelector(".shell", { timeout: 15000 });
        } catch (error) {
          console.error(`Failed at ${page.url()}:`, await page.evaluate(() => document.body.innerText));
          throw error;
        }
        await sleep(700);
        if (t.prep) await t.prep(page);
        if (AUDIT) {
          await auditContrast(page, `${role}:${t.name}`);
          await auditLayout(page, `${role}:${t.name}`);
        }
        await shot(page, `${role}-${t.name}${VIEWPORT_SUFFIX}.png`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  if (AUDIT && (contrastFailures > 0 || layoutFailures > 0 || runtimeFailures > 0)) {
    throw new Error(
      `UI audit failed: contrast=${contrastFailures}, layout=${layoutFailures}, runtime=${runtimeFailures}.`,
    );
  }
  console.log("\nDone →", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
