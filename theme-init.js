/* Applies the stored theme before first paint, so the popup never opens in the
   wrong theme and repaints.

   This has to be an external file, not an inline <script>: MV3 extension pages
   run under script-src 'self', which blocks inline execution outright. A
   classic (non-deferred) external script in <head> still runs before the body
   is parsed, so the no-flash property is unchanged.

   localStorage rather than chrome.storage, because only localStorage can be
   read synchronously. Keep the key in sync with popup.js. */
try {
  var t = localStorage.getItem("instacleanser_theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {
  /* ignore */
}
