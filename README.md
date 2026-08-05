<!-- glowup:hero start -->
<div align="center">
<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/banner.svg">
    <img src="docs/assets/banner-light.svg" alt="gv-mark-read" width="880">
  </picture>
</h1>

[![License](https://img.shields.io/github/license/bearyjd/gv-mark-read?style=for-the-badge)](LICENSE)
![Last commit](https://img.shields.io/github/last-commit/bearyjd/gv-mark-read?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)
![Chrome](https://img.shields.io/badge/Chrome-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
</div>
<!-- glowup:hero end -->

Bulk-marks unread Google Voice voicemails as read, by driving a real,
logged-in Chrome profile with [Playwright](https://playwright.dev/).

## Why this exists

Google Voice has no official bulk "mark all as read" feature for
voicemails, and no public API for personal (non-Google Workspace)
accounts. If you have hundreds or thousands of old unread voicemails
piled up, there's no supported way to clear them in bulk. This has
been a documented, years-old complaint in Google's own support
forums, with no fix in sight.

This script works around that gap by driving a real browser session
against the Google Voice web app (`voice.google.com`) and clicking
each unread voicemail row to mark it read, scrolling through the
virtualized list as needed.

This is UI automation of your own account, not an API. It is not
affiliated with or endorsed by Google, and automating a Google
product's UI like this may run against Google's Terms of Service for
automated access. Use it only against your own account, and at your
own risk.

## How it works

1. Launches a persistent Chrome context (so you stay logged in
   between runs) pointed at `https://voice.google.com/u/0/voicemail`.
2. Looks for `div.timestamp:not(.read)` — the selector Google Voice's
   Angular app currently uses for an unread voicemail's timestamp —
   and clicks it, which marks that voicemail read.
3. If no unread row is currently rendered, scrolls the virtual list
   (Google Voice only renders a window of rows at a time) and looks
   again.
4. Keeps going until either it hits `--max-total` marked, or the
   scroll position itself stops changing across several consecutive
   attempts (true end of the list) — it does **not** give up just
   because no unread row is visible on screen, since there may be
   years of already-read voicemails to scroll past first.

## Setup

### 1. Install Node and dependencies

Requires Node.js 18+.

```bash
npm install
npx playwright install chromium   # only needed if you don't have a system Chrome (see Troubleshooting)
```

### 2. Set up a dedicated Chrome profile

**Do not point this at your daily-driver Chrome profile.** This
script drives a real, logged-in browser profile, and while it's
running headed you'll want to be able to watch it and intervene if
needed, without it colliding with a browser window you're also using.

Recommended approach — make a copy of a profile that's already logged
into your Google account, rather than reusing your main one:

```bash
cp -r ~/.config/google-chrome/Default /tmp/gv-profile-seed
mkdir -p ~/.gv-mark-read
mv /tmp/gv-profile-seed ~/.gv-mark-read/chrome-profile
```

(Exact source path varies by OS — see your browser's profile location
docs. You can also skip this and just let the script create a fresh,
empty profile directory, then log in by hand the first time it opens
a browser window.)

By default the script uses `~/.gv-mark-read/chrome-profile`. Override
with `--profile-dir <path>` or `GV_PROFILE_DIR`.

### 3. Run it

```bash
# Dry run first: finds and logs unread rows, but doesn't click anything
node gv_mark_read.js --dry-run

# Then run for real, headed, so you can watch the first run
node gv_mark_read.js
```

The browser stays open when the script finishes (or is interrupted)
so you can inspect state. Press Ctrl+C in the terminal when you're
done.

## CLI options

```
--profile-dir <path>    Persistent Chrome profile directory
                         (default: ~/.gv-mark-read/chrome-profile, or $GV_PROFILE_DIR)
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
-h, --help              Show help and exit
```

Every flag has a matching environment variable (see `--help`); CLI
flags take precedence.

Headed mode (the default) is intentional — Google's automation
detection has been an issue during development, and running headed
lets you see what's happening and intervene if the flow breaks.

## Known limitations / how this can break

- **Fragile selector.** Google Voice's Angular app uses generated,
  non-semantic class names (`div.timestamp:not(.read)`, etc.) that
  can change with any Google deploy, with no warning. If the script
  stops finding rows, this selector is the first thing to check —
  open devtools on the voicemail list and see what's changed.
- **First-load bounce to marketing page.** A cold first navigation to
  `/voicemail` can land on Google's public marketing page
  (`workspace.google.com`) instead of the actual app. The script
  navigates twice to work around this; if you still land on the
  marketing page, the account may not be logged in in that profile.
- **Rapid clicking can trigger a forced logout.** In testing,
  clicking through unread voicemails too aggressively has triggered
  Google to force-logout the account, presumably as an automation
  countermeasure. Run headed, watch the first run closely, and don't
  set `--click-delay` too low if you hit this.
- **Not an API — a UI automation.** Anything from a CAPTCHA challenge
  to a layout change to a 2FA re-prompt can stop this outright. It's
  meant for occasional bulk cleanup, not as a reliable background
  job.

## Troubleshooting

**"Profile is already in use" / context launch error**
Another Chrome window (or a previous, still-running instance of this
script) has that profile directory open. Close it, or point
`--profile-dir` at a different directory.

**No Chrome binary found**
The script auto-detects common install locations on Linux, macOS, and
Windows. If none match, either install Chrome/Chromium, or pass
`--chrome-path /path/to/your/browser` explicitly.

**Fedora / Bazzite / other non-Debian Linux**
Playwright's bundled Chromium download
(`npx playwright install chromium`) only reliably supports
Ubuntu/Debian-based distros — on Fedora, Bazzite, and similar it may
fail to install or fail to launch missing shared libraries. On these
systems, install your distro's system Chrome/Chromium package instead
and either let auto-detection find it or pass `--chrome-path`
explicitly (e.g. `--chrome-path /usr/bin/google-chrome` or
`/usr/bin/chromium`).

## Disclaimer

Not affiliated with or endorsed by Google. This automates the Google
Voice web UI on your own account; it does not use any official or
public API. Automated access to Google products may be restricted by
Google's Terms of Service — you are responsible for how you use this
tool. Use at your own risk, against your own account only.

## License

MIT — see [LICENSE](LICENSE).
