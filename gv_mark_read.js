#!/usr/bin/env node
/**
 * gv-mark-read
 *
 * Bulk-marks Google Voice VOICEMAILS as read by driving a real,
 * already-logged-in Chrome profile with Playwright.
 *
 * The "give up" condition does not trigger just because no unread row
 * is visible on screen -- there can be hundreds of already-read
 * voicemails between today and the oldest unread one, so the script
 * scrolls through all of those first. It only gives up when the
 * scroll POSITION itself stops changing (true bottom-of-list /
 * end-of-render), logging scroll progress the whole way so you can
 * see it's actually working.
 *
 * See README.md for setup, known limitations, and troubleshooting.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const SELECTORS = {
  unreadRow: "div.timestamp:not(.read)",
};

const DEFAULT_PROFILE_DIR = path.join(os.homedir(), ".gv-mark-read", "chrome-profile");

function printHelp() {
  console.log(`gv-mark-read - bulk mark Google Voice voicemails as read

Usage:
  node gv_mark_read.js [options]

Options:
  --profile-dir <path>    Persistent Chrome profile directory
                           (default: ${DEFAULT_PROFILE_DIR}, or $GV_PROFILE_DIR)
  --chrome-path <path>    Path to a Chrome/Chromium executable
                           (default: auto-detected, or $GV_CHROME_PATH)
  --max-total <n>         Stop after marking this many voicemails read
                           (default: 5000, or $GV_MAX_TOTAL)
  --click-delay <ms>      Delay between clicks in milliseconds
                           (default: 350, or $GV_CLICK_DELAY_MS)
  --max-stuck-scrolls <n> Consecutive no-movement scrolls before giving up
                           (default: 5, or $GV_MAX_STUCK_SCROLLS)
  --headless              Run Chrome headless (default: false)
  --dry-run               Find and log unread rows without clicking them
  -h, --help              Show this help and exit

Environment variables mirror the flags above: GV_PROFILE_DIR,
GV_CHROME_PATH, GV_MAX_TOTAL, GV_CLICK_DELAY_MS, GV_MAX_STUCK_SCROLLS,
GV_HEADLESS, GV_DRY_RUN. CLI flags take precedence over env vars.
`);
}

function parseArgs(argv) {
  const args = {
    profileDir: process.env.GV_PROFILE_DIR || DEFAULT_PROFILE_DIR,
    chromePath: process.env.GV_CHROME_PATH || null,
    maxTotal: process.env.GV_MAX_TOTAL ? Number(process.env.GV_MAX_TOTAL) : 5000,
    clickDelayMs: process.env.GV_CLICK_DELAY_MS ? Number(process.env.GV_CLICK_DELAY_MS) : 350,
    maxStuckScrolls: process.env.GV_MAX_STUCK_SCROLLS ? Number(process.env.GV_MAX_STUCK_SCROLLS) : 5,
    headless: process.env.GV_HEADLESS === "true",
    dryRun: process.env.GV_DRY_RUN === "true",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
      case "--profile-dir":
        args.profileDir = argv[++i];
        break;
      case "--chrome-path":
        args.chromePath = argv[++i];
        break;
      case "--max-total":
        args.maxTotal = Number(argv[++i]);
        break;
      case "--click-delay":
        args.clickDelayMs = Number(argv[++i]);
        break;
      case "--max-stuck-scrolls":
        args.maxStuckScrolls = Number(argv[++i]);
        break;
      case "--headless":
        args.headless = true;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      default:
        console.error(`Unknown argument: ${arg}\n`);
        printHelp();
        process.exit(1);
    }
  }

  if (!Number.isFinite(args.maxTotal) || args.maxTotal <= 0) {
    console.error("--max-total must be a positive number");
    process.exit(1);
  }
  if (!Number.isFinite(args.clickDelayMs) || args.clickDelayMs < 0) {
    console.error("--click-delay must be a non-negative number");
    process.exit(1);
  }
  if (!Number.isFinite(args.maxStuckScrolls) || args.maxStuckScrolls <= 0) {
    console.error("--max-stuck-scrolls must be a positive number");
    process.exit(1);
  }

  return args;
}

/**
 * Best-effort Chrome/Chromium binary detection across platforms.
 * Returns the first path that exists on disk, or null if none do
 * (caller falls back to Playwright's bundled Chromium in that case).
 */
function detectChromePath() {
  const platform = os.platform();
  let candidates = [];

  if (platform === "linux") {
    candidates = [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/snap/bin/chromium",
      "/var/lib/flatpak/exports/bin/com.google.Chrome",
      path.join(os.homedir(), ".local/share/flatpak/exports/bin/com.google.Chrome"),
    ];
  } else if (platform === "darwin") {
    candidates = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
  } else if (platform === "win32") {
    const programFiles = [
      process.env["PROGRAMFILES"],
      process.env["PROGRAMFILES(X86)"],
      process.env["LOCALAPPDATA"],
    ].filter(Boolean);
    for (const base of programFiles) {
      candidates.push(path.join(base, "Google", "Chrome", "Application", "chrome.exe"));
    }
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function scrollList(page) {
  const result = await page.evaluate(() => {
    const candidates = document.querySelectorAll(
      'cdk-virtual-scroll-viewport, [class*="scroll"], [class*="viewport"], [class*="list"]'
    );
    let best = null;
    let bestArea = 0;
    for (const el of candidates) {
      if (el.scrollHeight > el.clientHeight + 10) {
        const area = el.clientWidth * el.clientHeight;
        if (area > bestArea) {
          best = el;
          bestArea = area;
        }
      }
    }
    if (best) {
      const before = best.scrollTop;
      best.scrollTop += Math.floor(best.clientHeight * 0.8);
      return {
        method: "element",
        before,
        after: best.scrollTop,
        scrollHeight: best.scrollHeight,
        clientHeight: best.clientHeight,
      };
    }
    return { method: "none" };
  });

  if (result.method === "none") {
    const viewport = page.viewportSize();
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.wheel(0, 700);
    return { method: "mouse-wheel-fallback" };
  }

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const chromePath = args.chromePath || detectChromePath();
  if (chromePath) {
    console.log(`Using Chrome binary: ${chromePath}`);
  } else {
    console.log(
      "No Chrome/Chromium binary auto-detected; falling back to Playwright's bundled " +
        "Chromium. If this fails, install Chrome/Chromium and pass --chrome-path, or " +
        "see the README troubleshooting section (e.g. Fedora/Bazzite)."
    );
  }

  fs.mkdirSync(args.profileDir, { recursive: true });
  console.log(`Using profile directory: ${args.profileDir}`);
  if (args.dryRun) {
    console.log("Dry run: unread rows will be logged but NOT clicked.");
  }

  console.log("Launching persistent Chrome context...");
  const context = await chromium.launchPersistentContext(args.profileDir, {
    headless: args.headless,
    executablePath: chromePath || undefined,
    viewport: { width: 1280, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = context.pages()[0] || (await context.newPage());

  console.log("First navigation to Voice (may bounce to marketing page)...");
  await page.goto("https://voice.google.com/u/0/voicemail", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(3000);

  console.log("Second navigation to Voice (should load the real app)...");
  await page.goto("https://voice.google.com/u/0/voicemail", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(3000);

  console.log("Current URL:", page.url());

  if (!page.url().includes("voice.google.com")) {
    console.log("Did not land on the real Voice app. Stopping.");
    return;
  }

  console.log("Scanning for unread rows (there may be years of read");
  console.log("voicemails to scroll past before reaching unread ones)...");

  let markedCount = 0;
  let consecutiveStuckScrolls = 0;
  let totalScrollAttempts = 0;

  while (markedCount < args.maxTotal) {
    const unreadRow = await page.$(SELECTORS.unreadRow);

    if (!unreadRow) {
      totalScrollAttempts++;
      const scrollResult = await scrollList(page);

      if (scrollResult.method === "element") {
        const moved = scrollResult.after !== scrollResult.before;
        console.log(
          `Scroll #${totalScrollAttempts}: ${scrollResult.before} -> ${scrollResult.after} (scrollHeight=${scrollResult.scrollHeight}) ${moved ? "" : "[NO MOVEMENT]"}`
        );
        if (moved) {
          consecutiveStuckScrolls = 0;
        } else {
          consecutiveStuckScrolls++;
        }
      } else {
        console.log(`Scroll #${totalScrollAttempts}: used mouse-wheel fallback`);
        // Can't measure position with the fallback, so just cap total attempts differently
        consecutiveStuckScrolls = 0;
      }

      await page.waitForTimeout(1200);

      if (consecutiveStuckScrolls >= args.maxStuckScrolls) {
        console.log(
          `Scroll position unchanged for ${args.maxStuckScrolls} consecutive attempts -- true end of list reached.`
        );
        break;
      }
      continue;
    }

    consecutiveStuckScrolls = 0;

    if (args.dryRun) {
      markedCount++;
      console.log(`[dry-run] Found unread row ${markedCount} (not clicking)`);
      // Dry-run still needs to make progress past the row it just found,
      // otherwise the same row matches forever and the loop never scrolls.
      await scrollList(page);
      await page.waitForTimeout(300);
      continue;
    }

    try {
      await unreadRow.click({ force: true });
      await page.waitForTimeout(args.clickDelayMs);
      markedCount++;
      console.log(`Marked read: ${markedCount}`);
    } catch (err) {
      console.warn("Click failed on this row, skipping:", err.message);
      await scrollList(page);
      await page.waitForTimeout(500);
    }
  }

  console.log(
    `\nFinished. ${args.dryRun ? "Found" : "Marked"} ${markedCount} voicemail(s) this run.`
  );
  console.log("Browser will stay open. Press Ctrl+C in this terminal when you're done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  console.log("Browser may still be open -- check manually.");
});
