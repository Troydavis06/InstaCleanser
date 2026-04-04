const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const STORAGE_KEY = "instacleanser_analysis_v1";

const els = {
  run: $("#run"),
  user: $("#user"),
  setup: $("#setup"),
  results: $("#results"),
  errorPanel: $("#error-panel"),
  errorText: $("#error-text"),
  status: $("#status"),
  runStatus: $("#run-status"),
  metaDetails: $("#meta-details"),
  listFollowers: $("#list-followers"),
  listFollowing: $("#list-following"),
  listNonfb: $("#list-nonfb"),
  unfollowAll: $("#unfollow-all"),
  foreignNote: $("#foreign-profile-note"),
  nonfbActionsWrap: $("#nonfb-actions-wrap"),
  nonfbStatLabel: $("#nonfb-stat-label"),
};

let lastInstagramTabId = null;
/** @type {{ id: string, username: string }[]} */
let nonfbAccounts = [];
/** @type {Record<string, unknown> | null} */
let lastAnalysisData = null;
let analysisIsSelf = false;

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function setStatus(msg, isError = false) {
  const resultsOpen = !els.results.classList.contains("hidden");
  const target = resultsOpen ? els.status : els.runStatus;
  if (resultsOpen) {
    els.runStatus.hidden = true;
    els.runStatus.textContent = "";
    els.runStatus.classList.remove("error");
  } else {
    els.runStatus.hidden = !msg;
  }
  target.textContent = msg || "";
  target.classList.toggle("error", Boolean(isError && msg));
}

function showError(message) {
  els.errorText.textContent = message;
  els.errorPanel.classList.remove("hidden");
  els.results.classList.add("hidden");
  els.runStatus.hidden = true;
  els.runStatus.textContent = "";
}

function hideError() {
  els.errorPanel.classList.add("hidden");
}

function activateTab(name, { persist = true } = {}) {
  $$(".tab").forEach((btn) => {
    const on = btn.dataset.tab === name;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  $$(".tab-panel").forEach((panel) => {
    const on = panel.id === `panel-${name}`;
    panel.classList.toggle("active", on);
    panel.hidden = !on;
  });
  if (persist && lastAnalysisData) {
    lastAnalysisData.ui = { ...(lastAnalysisData.ui || {}), activeTab: name };
    void saveAnalysisToStorage();
  }
}

function getActiveResultsTabName() {
  const t = $(".tab.active");
  const tab = t?.dataset?.tab;
  return ["followers", "following", "nonfb"].includes(tab) ? tab : "followers";
}

async function persistUiTabBeforeHide() {
  if (!lastAnalysisData || els.results.classList.contains("hidden")) return;
  lastAnalysisData.ui = {
    ...(lastAnalysisData.ui || {}),
    activeTab: getActiveResultsTabName(),
  };
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: lastAnalysisData });
  } catch {
    /* ignore */
  }
}

function renderAccountList(ul, accounts, { links = true, actions = false } = {}) {
  ul.innerHTML = "";
  const frag = document.createDocumentFragment();
  const sorted = [...accounts].sort((a, b) => a.username.localeCompare(b.username));
  for (const a of sorted) {
    const li = document.createElement("li");
    const handle = document.createElement("span");
    handle.className = "handle";
    if (links) {
      handle.innerHTML = `<a href="https://www.instagram.com/${escapeHtml(a.username)}/" target="_blank" rel="noopener noreferrer">@${escapeHtml(a.username)}</a>`;
    } else {
      handle.textContent = `@${a.username}`;
    }
    li.appendChild(handle);
    if (actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-unfollow";
      btn.textContent = "Unfollow";
      btn.dataset.userId = a.id;
      btn.dataset.username = a.username;
      li.appendChild(btn);
    }
    frag.appendChild(li);
  }
  ul.appendChild(frag);
}

function renderMeta(data) {
  const analyzed =
    data.analyzedAtDisplay ||
    (data.analyzedAtISO
      ? new Date(data.analyzedAtISO).toLocaleString()
      : new Date().toLocaleString());
  const rows = [
    ["Account", `@${data.username}`],
    ["User ID", data.userId],
    ["Logged in as", data.viewerUsername ? `@${data.viewerUsername}` : "—"],
    ["Unfollow allowed", data.isSelf ? "Yes (your profile)" : "No (not your profile)"],
    ["Follower pages fetched", String(data.followersPages)],
    ["Following pages fetched", String(data.followingPages)],
    ["List capped (500 pages max)", data.truncated ? "Yes — counts may be incomplete" : "No"],
    ["Analyzed at", analyzed],
  ];
  els.metaDetails.innerHTML = rows
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
    .join("");
}

function applyNonfbMode(isSelf) {
  if (isSelf) {
    els.foreignNote.classList.add("hidden");
    els.nonfbActionsWrap.classList.remove("hidden");
    els.nonfbStatLabel.textContent = "You follow · they don’t follow you back";
  } else {
    els.foreignNote.classList.remove("hidden");
    els.nonfbActionsWrap.classList.add("hidden");
    els.nonfbStatLabel.textContent = "They follow · don’t follow them back";
  }
}

async function saveAnalysisToStorage() {
  if (!lastAnalysisData) return;
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: lastAnalysisData });
  } catch {
    /* ignore */
  }
}

function buildPersistPayload(data) {
  const analyzedAtISO = data.analyzedAtISO || new Date().toISOString();
  return {
    ...data,
    analyzedAtISO,
    analyzedAtDisplay: new Date(analyzedAtISO).toLocaleString(),
  };
}

function showResults(data) {
  hideError();
  analysisIsSelf = data.isSelf === true;
  lastAnalysisData = buildPersistPayload(data);

  $("#count-tab-followers").textContent = String(data.followerCount);
  $("#count-tab-following").textContent = String(data.followingCount);
  $("#count-tab-nonfb").textContent = String(data.notFollowingBackCount);
  $("#stat-followers").textContent = String(data.followerCount);
  $("#stat-following").textContent = String(data.followingCount);
  $("#stat-nonfb").textContent = String(data.notFollowingBackCount);

  renderAccountList(els.listFollowers, data.followers, { links: true });
  renderAccountList(els.listFollowing, data.following, { links: true });

  nonfbAccounts = data.notFollowingBack || [];
  applyNonfbMode(analysisIsSelf);
  renderAccountList(els.listNonfb, nonfbAccounts, {
    links: true,
    actions: analysisIsSelf && nonfbAccounts.length > 0,
  });
  els.unfollowAll.disabled = !analysisIsSelf || nonfbAccounts.length === 0;

  renderMeta(lastAnalysisData);
  els.results.classList.remove("hidden");
  const saved = data.ui?.activeTab;
  const initialTab = ["followers", "following", "nonfb"].includes(saved) ? saved : "followers";
  activateTab(initialTab, { persist: false });
  lastAnalysisData.ui = { ...(lastAnalysisData.ui || {}), activeTab: initialTab };
  void saveAnalysisToStorage();
}

async function syncStateToStorage() {
  if (!lastAnalysisData) return;
  lastAnalysisData.notFollowingBack = [...nonfbAccounts];
  lastAnalysisData.notFollowingBackCount = nonfbAccounts.length;
  lastAnalysisData.followingCount = Number($("#stat-following").textContent) || 0;
  lastAnalysisData.followerCount = Number($("#stat-followers").textContent) || 0;
  await saveAnalysisToStorage();
}

async function runInjectedAnalysis(tabId, username) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [username],
    func: async (usernameArg) => {
      const FOLLOWERS_HASH = "37479f2b8209594dde7facb0d904896a";
      const FOLLOWING_HASH = "58712303d941c6855d4e888c5f0cd22f";

      function getCookie(name) {
        const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
        return m ? decodeURIComponent(m[1]) : "";
      }

      /**
       * Logged-in viewer id + username. IDs are the reliable way to detect "your own" profile;
       * username-only checks fail when the API omits or formats username differently.
       */
      async function fetchLoggedInViewer() {
        const csrf = getCookie("csrftoken");
        const res = await fetch("https://www.instagram.com/api/v1/accounts/current_user/", {
          credentials: "include",
          headers: {
            "x-csrftoken": csrf,
            "x-requested-with": "XMLHttpRequest",
            "x-instagram-ajax": "1",
            "x-ig-app-id": "936619743392459",
          },
        });
        const j = await res.json().catch(() => null);
        const u = j?.user;
        const id =
          u?.pk != null
            ? String(u.pk)
            : u?.id != null
              ? String(u.id)
              : null;
        const username = u?.username ? String(u.username).trim().toLowerCase() : null;
        return { id, username };
      }

      async function graphqlQuery(queryHash, variables) {
        const params = new URLSearchParams({
          query_hash: queryHash,
          variables: JSON.stringify(variables),
        });
        const url = `https://www.instagram.com/graphql/query/?${params}`;
        const csrf = getCookie("csrftoken");
        const res = await fetch(url, {
          method: "GET",
          credentials: "include",
          headers: {
            "x-csrftoken": csrf,
            "x-requested-with": "XMLHttpRequest",
            "x-instagram-ajax": "1",
            "x-ig-app-id": "936619743392459",
          },
        });
        const text = await res.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          /* ignore */
        }
        return { ok: res.ok, status: res.status, json, textHead: text.slice(0, 400) };
      }

      async function resolveUserId(handle) {
        const u = handle.replace(/^@/, "").trim().toLowerCase();
        const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(u)}`;
        const csrf = getCookie("csrftoken");
        const res = await fetch(url, {
          credentials: "include",
          headers: {
            "x-csrftoken": csrf,
            "x-requested-with": "XMLHttpRequest",
            "x-instagram-ajax": "1",
            "x-ig-app-id": "936619743392459",
          },
        });
        const json = await res.json().catch(() => null);
        const id = json?.data?.user?.id ?? json?.data?.user?.pk;
        return { ok: res.ok, status: res.status, id: id != null ? String(id) : null, raw: json };
      }

      function edgeToAccounts(edge) {
        const out = [];
        for (const e of edge?.edges || []) {
          const node = e?.node;
          const un = node?.username;
          const id = node?.id != null ? String(node.id) : null;
          if (un && id) out.push({ id, username: un.toLowerCase() });
        }
        return out;
      }

      async function paginateEdge(queryHash, userId, edgeKey) {
        const accounts = [];
        let after = null;
        let hasNext = true;
        let pages = 0;
        const maxPages = 500;

        while (hasNext && pages < maxPages) {
          const variables = { id: userId, first: 50 };
          if (after) variables.after = after;

          const { ok, status, json } = await graphqlQuery(queryHash, variables);
          if (!ok || !json) {
            return {
              error: `GraphQL request failed (${status})`,
              partial: accounts,
              jsonHead: json,
            };
          }

          if (json.status === "fail") {
            return {
              error: json.message || "GraphQL status fail",
              partial: accounts,
              json,
            };
          }

          const user = json.data?.user;
          const edge = user?.[edgeKey];
          if (!edge) {
            return {
              error: `Unexpected response shape (missing ${edgeKey})`,
              partial: accounts,
              json,
            };
          }

          accounts.push(...edgeToAccounts(edge));

          const pi = edge.page_info;
          hasNext = Boolean(pi?.has_next_page);
          after = pi?.end_cursor || null;
          pages += 1;
          await new Promise((r) => setTimeout(r, 350));
        }

        return { accounts, pages, truncated: pages >= maxPages };
      }

      const targetUsername = usernameArg.replace(/^@/, "").trim().toLowerCase();

      const uid = await resolveUserId(usernameArg);
      if (!uid.id) {
        return {
          ok: false,
          step: "resolve_user",
          error: "Could not read user id (private / wrong username / not logged in?)",
          detail: uid,
        };
      }

      const cookieViewerId = (getCookie("ds_user_id") || "").trim();
      const viewer = await fetchLoggedInViewer();

      const idMatches =
        (cookieViewerId && String(cookieViewerId) === String(uid.id)) ||
        (viewer.id && String(viewer.id) === String(uid.id));
      const nameMatches = Boolean(viewer.username && viewer.username === targetUsername);

      const isSelf = Boolean(idMatches || nameMatches);

      const viewerUsername = viewer.username || (isSelf ? targetUsername : null);

      const [followersResult, followingResult] = await Promise.all([
        paginateEdge(FOLLOWERS_HASH, uid.id, "edge_followed_by"),
        paginateEdge(FOLLOWING_HASH, uid.id, "edge_follow"),
      ]);

      if (followersResult.error) {
        return { ok: false, step: "followers", userId: uid.id, ...followersResult };
      }
      if (followingResult.error) {
        return { ok: false, step: "following", userId: uid.id, ...followingResult };
      }

      const followerNames = new Set(followersResult.accounts.map((a) => a.username));
      const notFollowingBack = followingResult.accounts.filter((a) => !followerNames.has(a.username));

      return {
        ok: true,
        username: targetUsername,
        userId: uid.id,
        viewerUsername,
        isSelf,
        followerCount: followersResult.accounts.length,
        followingCount: followingResult.accounts.length,
        notFollowingBackCount: notFollowingBack.length,
        followers: followersResult.accounts,
        following: followingResult.accounts,
        notFollowingBack,
        followersPages: followersResult.pages,
        followingPages: followingResult.pages,
        truncated: followersResult.truncated || followingResult.truncated,
      };
    },
  });
  return result;
}

async function injectUnfollow(tabId, userId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [userId],
    func: async (targetUserId) => {
      function getCookie(name) {
        const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
        return m ? decodeURIComponent(m[1]) : "";
      }
      const csrf = getCookie("csrftoken");
      const url = `https://www.instagram.com/web/friendships/${targetUserId}/unfollow/`;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "x-csrftoken": csrf,
          "x-requested-with": "XMLHttpRequest",
          "x-instagram-ajax": "1",
        },
        body: new URLSearchParams(),
      });
      let json = null;
      try {
        json = await res.json();
      } catch {
        /* ignore */
      }
      return {
        ok: res.ok && json?.status === "ok",
        status: res.status,
        json,
      };
    },
  });
  return result;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function refreshInstagramTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && tab.url?.includes("instagram.com")) {
    lastInstagramTabId = tab.id;
  }
}

els.run.addEventListener("click", async () => {
  const username = els.user.value.trim();
  if (!username) {
    setStatus("Enter a username.", true);
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("No active tab.", true);
    return;
  }
  if (!tab.url || !tab.url.includes("instagram.com")) {
    setStatus("Open instagram.com in this tab first.", true);
    return;
  }

  lastInstagramTabId = tab.id;
  hideError();
  els.results.classList.add("hidden");
  els.run.disabled = true;
  setStatus("Running analysis…");

  try {
    const result = await runInjectedAnalysis(tab.id, username);
    if (!result?.ok) {
      const msg =
        result?.error ||
        (result?.detail ? JSON.stringify(result.detail, null, 2) : JSON.stringify(result, null, 2));
      showError(msg);
      setStatus("", false);
      return;
    }
    showResults(result);
    setStatus("Done.");
  } catch (e) {
    showError(String(e));
    setStatus("", false);
  } finally {
    els.run.disabled = false;
  }
});

$$(".tab").forEach((btn) => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

els.listNonfb.addEventListener("click", async (e) => {
  if (!analysisIsSelf) return;
  const btn = e.target.closest(".btn-unfollow");
  if (!btn || btn.disabled || lastInstagramTabId == null) return;
  const userId = btn.dataset.userId;
  const uname = btn.dataset.username;
  if (!userId) return;

  await refreshInstagramTabId();
  if (lastInstagramTabId == null) {
    setStatus("Open an Instagram tab to unfollow.", true);
    return;
  }

  btn.disabled = true;
  setStatus(`Unfollowing @${uname}…`);
  try {
    const r = await injectUnfollow(lastInstagramTabId, userId);
    if (r?.ok) {
      btn.textContent = "Unfollowed";
      btn.classList.add("done");
      nonfbAccounts = nonfbAccounts.filter((a) => a.id !== userId);
      if (lastAnalysisData?.following) {
        lastAnalysisData.following = lastAnalysisData.following.filter((a) => a.id !== userId);
      }
      $("#stat-nonfb").textContent = String(nonfbAccounts.length);
      $("#count-tab-nonfb").textContent = String(nonfbAccounts.length);
      const fc = Number($("#stat-following").textContent) || 0;
      $("#stat-following").textContent = String(Math.max(0, fc - 1));
      $("#count-tab-following").textContent = String(Math.max(0, fc - 1));
      btn.closest("li")?.classList.add("muted");
      setStatus(`Unfollowed @${uname}.`);
      void syncStateToStorage();
    } else {
      btn.disabled = false;
      setStatus(`Could not unfollow @${uname} (${r?.status || "?"}).`, true);
    }
  } catch (err) {
    btn.disabled = false;
    setStatus(String(err), true);
  }
});

els.unfollowAll.addEventListener("click", async () => {
  if (!analysisIsSelf || lastInstagramTabId == null || nonfbAccounts.length === 0) return;
  await refreshInstagramTabId();
  if (lastInstagramTabId == null) {
    setStatus("Open an Instagram tab to unfollow.", true);
    return;
  }

  const toProcess = [...nonfbAccounts];
  const n = toProcess.length;
  if (!confirm(`Unfollow all ${n} accounts that do not follow you back? This cannot be undone.`)) return;

  els.unfollowAll.disabled = true;
  $$("#list-nonfb .btn-unfollow").forEach((b) => {
    b.disabled = true;
  });

  let okCount = 0;
  const unfollowedIds = new Set();
  for (let i = 0; i < toProcess.length; i++) {
    const a = toProcess[i];
    setStatus(`Unfollowing @${a.username} (${i + 1}/${toProcess.length})…`);
    try {
      const r = await injectUnfollow(lastInstagramTabId, a.id);
      if (r?.ok) {
        okCount += 1;
        unfollowedIds.add(a.id);
        nonfbAccounts = nonfbAccounts.filter((x) => x.id !== a.id);
      }
    } catch {
      /* continue */
    }
    await delay(2000 + Math.random() * 2500);
  }

  if (lastAnalysisData?.following) {
    lastAnalysisData.following = lastAnalysisData.following.filter((x) => !unfollowedIds.has(x.id));
  }

  const followingNow = Number($("#stat-following").textContent) || 0;
  const newFollowing = Math.max(0, followingNow - okCount);
  $("#stat-following").textContent = String(newFollowing);
  $("#count-tab-following").textContent = String(newFollowing);
  $("#stat-nonfb").textContent = String(nonfbAccounts.length);
  $("#count-tab-nonfb").textContent = String(nonfbAccounts.length);

  renderAccountList(els.listNonfb, nonfbAccounts, {
    links: true,
    actions: analysisIsSelf && nonfbAccounts.length > 0,
  });
  els.unfollowAll.disabled = !analysisIsSelf || nonfbAccounts.length === 0;
  setStatus(`Finished. Unfollowed ${okCount} of ${n}.`);
  void syncStateToStorage();
});

async function restoreCachedAnalysis() {
  try {
    const bag = await chrome.storage.local.get(STORAGE_KEY);
    const raw = bag[STORAGE_KEY];
    if (!raw || !raw.username || !Array.isArray(raw.followers)) return;

    els.user.value = raw.username;
    lastInstagramTabId = (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
    showResults(raw);
    setStatus("Restored last analysis.");
  } catch {
    /* ignore */
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    void persistUiTabBeforeHide();
  }
});

window.addEventListener("pagehide", () => {
  void persistUiTabBeforeHide();
});

const openSidePanelBtn = $("#open-side-panel");
if (openSidePanelBtn) {
  openSidePanelBtn.addEventListener("click", async () => {
    try {
      if (!chrome.sidePanel?.open || !chrome.sidePanel?.setOptions) {
        setStatus("Side panel needs Chrome 114 or newer.", true);
        return;
      }
      await chrome.sidePanel.setOptions({ enabled: true, path: "popup.html" });
      const win = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: win.id });
      window.close();
    } catch (e) {
      setStatus(String(e), true);
    }
  });
}

function boot() {
  void restoreCachedAnalysis();
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
