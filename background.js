chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setOptions) {
    chrome.sidePanel.setOptions({
      enabled: true,
      path: "popup.html",
    });
  }
});
