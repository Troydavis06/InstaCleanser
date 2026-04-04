# InstaCleanser

Chrome extension that compares your Instagram followers and following **in your browser** (same cookies as a normal instagram.com tab), lists people you follow who do not follow you back, and lets you unfollow individually or in bulk when you are viewing **your own** profile.

## Requirements

- Google Chrome or Microsoft Edge (Chromium), **114+** (for the optional side panel).
- Stay logged in on [instagram.com](https://www.instagram.com) in the tab you use for analysis.

## Install (developer / unpacked)

1. Clone or download this repository.
2. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
3. Enable **Developer mode**.
4. Click **Load unpacked** and choose this folder (the repo root — the one that contains `manifest.json`).

## Usage

1. Open Instagram in a normal tab and log in.
2. Click the InstaCleanser toolbar icon.
3. Enter a **username to analyze** (yours or someone else’s). For unfollow actions, the username must be **yours**; for other profiles, lists are read-only.
4. Click **Run analysis**. Large accounts take a while.
5. Use **Side panel** to dock the UI so it stays open while you switch tabs; the toolbar popup closes automatically when you open the side panel.

Data from the last successful run is stored locally in `chrome.storage` and restored when you reopen the popup or side panel.

## Permissions

- **instagram.com** — run fetches in the page context with your session.
- **activeTab**, **scripting** — inject analysis/unfollow on the active Instagram tab.
- **storage** — cache last run and UI state.
- **sidePanel** — optional docked panel.

## Disclaimer

Instagram does not offer a public API for this workflow. The extension uses the same undocumented endpoints the website uses; behavior may change. Use unfollow features responsibly and at your own risk.

## License

See [LICENSE](LICENSE).
