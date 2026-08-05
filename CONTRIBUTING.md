# Contributing

Thanks for considering a contribution to `gv-mark-read`. This is a small,
single-file utility, so the bar for contributing is low — but a few notes
will help keep it maintainable.

## Before you start

For anything beyond a small fix, open an issue first describing what you
want to change and why. This is especially useful for anything touching
the core scroll/click logic, since it was tuned against real (and
occasionally flaky) Google Voice behavior — a change that looks like an
obvious improvement can break the "give up only when scroll position
truly stops changing" behavior the README describes.

## Development setup

```bash
npm install
npx playwright install chromium   # if you don't already have a system Chrome
```

There's no automated test suite (there isn't a sandboxed Google Voice to
test against), so verification is manual:

```bash
node -c gv_mark_read.js              # syntax check
node gv_mark_read.js --help          # sanity check CLI parsing
node gv_mark_read.js --dry-run       # verify selectors still match, against a real account
```

CI (`.github/workflows/ci.yml`) runs the syntax check and `--help` on
every push/PR — it can't exercise the actual Google Voice automation,
since that requires a logged-in account.

## Pull requests

- Keep changes scoped — this is meant to stay a small, readable script,
  not grow into a framework.
- If you're changing selector logic (`div.timestamp:not(.read)`, the
  scroll-container detection, etc.), say in the PR description what
  Google Voice behavior you tested against and when, since these are the
  most likely things to silently break on Google's next deploy.
- Update `README.md` if you change CLI flags, defaults, or behavior
  described there.

## Reporting selector breakage

If the script stops finding rows or behaves unexpectedly, it's most
likely because Google shipped a UI change (see "Known limitations" in
the README). When filing an issue, include:

- What you saw (error, or just "found 0 unread rows" when you know there
  are unread voicemails)
- Output of `node gv_mark_read.js --dry-run`
- Roughly when it last worked, if known

This helps narrow down what changed on Google's end.
