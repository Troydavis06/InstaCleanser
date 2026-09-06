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

function setCount(name, n) {
  const el = $(`#count-tab-${name}`);
  el.dataset.value = String(n);
  el.textContent = Number(n).toLocaleString();
}

function getCount(name) {
  return Number($(`#count-tab-${name}`).dataset.value) || 0;
}

function lastRunLabel() {
  const iso = lastAnalysisData?.analyzedAtISO;
  if (!iso) return "";
  return `Last run ${new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

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

function applyNonfbMode(isSelf) {
  if (isSelf) {
    els.foreignNote.classList.add("hidden");
    els.nonfbActionsWrap.classList.remove("hidden");
    els.nonfbStatLabel.textContent = "You follow them, they don’t follow you back";
  } else {
    els.foreignNote.classList.remove("hidden");
    els.nonfbActionsWrap.classList.add("hidden");
    els.nonfbStatLabel.textContent = "They follow these accounts, which don’t follow back";
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

  setCount("followers", data.followerCount);
  setCount("following", data.followingCount);
  setCount("nonfb", data.notFollowingBackCount);

  renderAccountList(els.listFollowers, data.followers, { links: true });
  renderAccountList(els.listFollowing, data.following, { links: true });

  nonfbAccounts = data.notFollowingBack || [];
  applyNonfbMode(analysisIsSelf);
  renderAccountList(els.listNonfb, nonfbAccounts, {
    links: true,
    actions: analysisIsSelf && nonfbAccounts.length > 0,
  });
  els.unfollowAll.disabled = !analysisIsSelf || nonfbAccounts.length === 0;

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
  lastAnalysisData.followingCount = getCount("following");
  lastAnalysisData.followerCount = getCount("followers");
  await saveAnalysisToStorage();
}

async function runInjectedAnalysis(tabId, username) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [username],
    func: async (usernameArg) => {
      const IG_APP_ID = "936619743392459";
      const ASBD_ID = "198387";
      const WWW_CLAIM_KEY = "www-claim-v2";
      const FOLLOWERS_HASH = "37479f2b8209594dde7facb0d904896a";
      const FOLLOWING_HASH = "58712303d941c6855d4e888c5f0cd22f";

      function getCookie(name) {
        const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
        return m ? decodeURIComponent(m[1]) : "";
      }

      function jitter(base, spread) {
        return new Promise((r) => setTimeout(r, base + Math.random() * spread));
      }

      let cachedRollout = null;
      function rolloutHash() {
        if (cachedRollout === null) {
          const m = document.documentElement.innerHTML.match(/"rollout_hash":"([A-Za-z0-9]+)"/);
          cachedRollout = m ? m[1] : "";
        }
        return cachedRollout;
      }

      /**
       * instagram.com carries a claim token between its own XHRs; requests that never
       * echo one back read as scripted. The page keeps it in sessionStorage, and every
       * response can hand back a newer one.
       */
      function readWwwClaim() {
        try {
          return sessionStorage.getItem(WWW_CLAIM_KEY) || "0";
        } catch {
          return "0";
        }
      }

      function storeWwwClaim(res) {
        const c = res.headers.get("x-ig-set-www-claim");
        if (!c) return;
        try {
          sessionStorage.setItem(WWW_CLAIM_KEY, c);
        } catch {
          /* ignore */
        }
      }

      /**
       * x-instagram-ajax must be the page's current rollout_hash. The literal "1" this
       * used to send is what gets read requests answered with 400 feedback_required,
       * the same way it broke the unfollow POST. When the page exposes no hash the
       * header is dropped rather than faked.
       */
      function igHeaders() {
        const h = {
          "x-csrftoken": getCookie("csrftoken"),
          "x-requested-with": "XMLHttpRequest",
          "x-ig-app-id": IG_APP_ID,
          "x-asbd-id": ASBD_ID,
          "x-ig-www-claim": readWwwClaim(),
        };
        const r = rolloutHash();
        if (r) h["x-instagram-ajax"] = r;
        return h;
      }

      async function igFetch(url, init = {}) {
        const res = await fetch(url, {
          credentials: "include",
          ...init,
          headers: { ...igHeaders(), ...(init.headers || {}) },
        });
        storeWwwClaim(res);
        return res;
      }

      const targetUsername = usernameArg.replace(/^@/, "").trim().toLowerCase();

      async function fetchLoggedInViewer() {
        const res = await igFetch("https://www.instagram.com/api/v1/accounts/current_user/");
        const j = await res.json().catch(() => null);
        const u = j?.user;
        const id = u?.pk != null ? String(u.pk) : u?.id != null ? String(u.id) : null;
        const un = u?.username ? String(u.username).trim().toLowerCase() : null;
        return { id, username: un, status: res.status };
      }

      /**
       * Fallback for when current_user/ is itself rate limited. The session cookie
       * gives the viewer's id for free, so that id is used to find the matching
       * username inside whatever payload the page already shipped with.
       */
      function viewerUsernameFromPage(viewerId) {
        const html = document.documentElement.innerHTML;
        const patterns = [
          /"viewer"\s*:\s*\{[^{}]*"username"\s*:\s*"([^"]+)"/,
          /"viewer_username"\s*:\s*"([^"]+)"/,
        ];
        const id = (viewerId || "").replace(/[^0-9]/g, "");
        if (id) {
          patterns.push(
            new RegExp(`"(?:id|pk)"\\s*:\\s*"?${id}"?[^{}]{0,240}?"username"\\s*:\\s*"([^"]+)"`),
            new RegExp(`"username"\\s*:\\s*"([^"]+)"[^{}]{0,240}?"(?:id|pk)"\\s*:\\s*"?${id}"?`),
          );
        }
        for (const p of patterns) {
          const m = html.match(p);
          if (m) return m[1].toLowerCase();
        }
        return null;
      }

      /** Instagram's anti-automation refusal, as opposed to a genuine "no such user". */
      function isRateLimited(r) {
        return Boolean(
          r && (r.status === 400 || r.status === 429) && r.raw?.message === "feedback_required",
        );
      }

      async function resolveUserId(handle) {
        const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`;
        const res = await igFetch(url);
        const json = await res.json().catch(() => null);
        const id = json?.data?.user?.id ?? json?.data?.user?.pk;
        return { ok: res.ok, status: res.status, id: id != null ? String(id) : null, raw: json };
      }

      /** The endpoints instagram.com's own follower/following modals call. */
      async function paginateFriendships(kind, uid) {
        const accounts = [];
        let maxId = null;
        let pages = 0;
        const maxPages = 500;

        while (pages < maxPages) {
          const params = new URLSearchParams({ count: "50" });
          if (maxId) params.set("max_id", maxId);
          const res = await igFetch(
            `https://www.instagram.com/api/v1/friendships/${encodeURIComponent(uid)}/${kind}/?${params}`,
          );
          const json = await res.json().catch(() => null);

          if (!res.ok || !json || json.status === "fail") {
            return {
              error: json?.message || `${kind} request failed (${res.status})`,
              status: res.status,
              partial: accounts,
              raw: json,
            };
          }
          if (!Array.isArray(json.users)) {
            return {
              error: `Unexpected ${kind} response shape (no users array)`,
              status: res.status,
              partial: accounts,
              raw: json,
            };
          }

          for (const u of json.users) {
            const un = u?.username;
            const id = u?.pk ?? u?.id;
            if (un && id != null) accounts.push({ id: String(id), username: String(un).toLowerCase() });
          }

          pages += 1;
          maxId = json.next_max_id ? String(json.next_max_id) : null;
          if (!maxId) break;
          await jitter(900, 900);
        }

        return { accounts, pages, truncated: pages >= maxPages && Boolean(maxId) };
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

      async function paginateEdge(queryHash, uid, edgeKey) {
        const accounts = [];
        let after = null;
        let hasNext = true;
        let pages = 0;
        const maxPages = 500;

        while (hasNext && pages < maxPages) {
          const variables = { id: uid, first: 50 };
          if (after) variables.after = after;
          const params = new URLSearchParams({
            query_hash: queryHash,
            variables: JSON.stringify(variables),
          });
          const res = await igFetch(`https://www.instagram.com/graphql/query/?${params}`);
          const json = await res.json().catch(() => null);

          if (!res.ok || !json || json.status === "fail") {
            return {
              error: json?.message || `GraphQL request failed (${res.status})`,
              status: res.status,
              partial: accounts,
              raw: json,
            };
          }

          const edge = json.data?.user?.[edgeKey];
          if (!edge) {
            return {
              error: `Unexpected response shape (missing ${edgeKey})`,
              status: res.status,
              partial: accounts,
              raw: json,
            };
          }

          accounts.push(...edgeToAccounts(edge));
          hasNext = Boolean(edge.page_info?.has_next_page);
          after = edge.page_info?.end_cursor || null;
          pages += 1;
          if (hasNext) await jitter(900, 900);
        }

        return { accounts, pages, truncated: pages >= maxPages };
      }

      async function collect(kind, uid, queryHash, edgeKey) {
        const primary = await paginateFriendships(kind, uid);
        if (!primary.error) return primary;
        const fallback = await paginateEdge(queryHash, uid, edgeKey);
        if (!fallback.error) return fallback;
        return { ...primary, fallbackError: fallback.error, fallbackStatus: fallback.status };
      }

      const cookieViewerId = (getCookie("ds_user_id") || "").trim();
      const viewer = await fetchLoggedInViewer();
      const viewerName = viewer.username || viewerUsernameFromPage(cookieViewerId);

      /**
       * Your own id is already in the session cookie, so analysing your own account
       * never has to touch web_profile_info - the lookup most likely to come back
       * rate limited.
       */
      let userId = null;
      let isSelf = false;
      let assumedSelf = false;
      let lookup = null;

      if (viewerName && viewerName === targetUsername) {
        userId = viewer.id || cookieViewerId || null;
        isSelf = Boolean(userId);
      }

      if (!userId) {
        lookup = await resolveUserId(targetUsername);
        userId = lookup.id;
        isSelf = Boolean(
          userId &&
            ((cookieViewerId && cookieViewerId === userId) ||
              (viewer.id && viewer.id === userId) ||
              (viewerName && viewerName === targetUsername)),
        );
      }

      /**
       * Last resort: the lookup was refused rather than answered, so the typed handle
       * can neither be confirmed nor denied. The cookie id is the one thing Instagram
       * cannot withhold, so it is used and the guess is reported back.
       */
      if (!userId && cookieViewerId && isRateLimited(lookup)) {
        userId = cookieViewerId;
        isSelf = true;
        assumedSelf = true;
      }

      if (!userId) {
        return {
          ok: false,
          step: "resolve_user",
          error: "Could not read user id (private / wrong username / not logged in?)",
          detail: {
            lookup,
            viewerStatus: viewer.status,
            viewerName: viewerName || null,
            cookieViewerId: cookieViewerId || null,
            rolloutHash: rolloutHash() || null,
          },
        };
      }

      const followersResult = await collect("followers", userId, FOLLOWERS_HASH, "edge_followed_by");
      if (followersResult.error) {
        return { ok: false, step: "followers", userId, ...followersResult };
      }

      await jitter(1200, 800);

      const followingResult = await collect("following", userId, FOLLOWING_HASH, "edge_follow");
      if (followingResult.error) {
        return { ok: false, step: "following", userId, ...followingResult };
      }

      const followerNames = new Set(followersResult.accounts.map((a) => a.username));
      const notFollowingBack = followingResult.accounts.filter((a) => !followerNames.has(a.username));

      return {
        ok: true,
        username: targetUsername,
        userId,
        viewerUsername: viewerName || (isSelf ? targetUsername : null),
        isSelf,
        assumedSelf,
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
      const ROLLOUT_CACHE_KEY = "__instacleanser_rollout_v1";
      const ROLLOUT_TTL_MS = 4 * 60 * 1000;
      const IG_APP_ID = "936619743392459";

      function getCookie(name) {
        const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
        return m ? decodeURIComponent(m[1]) : "";
      }

      function rolloutFromHtml(html) {
        const m = html.match(/"rollout_hash":"([A-Za-z0-9]+)"/);
        return m ? m[1] : null;
      }

      function readCachedRollout() {
        try {
          const c = window[ROLLOUT_CACHE_KEY];
          if (c && typeof c.h === "string" && Date.now() - c.t < ROLLOUT_TTL_MS) {
            return c.h;
          }
        } catch {
          /* ignore */
        }
        return null;
      }

      function writeCachedRollout(h) {
        try {
          window[ROLLOUT_CACHE_KEY] = { h, t: Date.now() };
        } catch {
          /* ignore */
        }
      }

      function clearCachedRollout() {
        try {
          delete window[ROLLOUT_CACHE_KEY];
        } catch {
          /* ignore */
        }
      }

      /**
       * Instagram expects x-instagram-ajax to match the current rollout_hash from page HTML,
       * not the literal "1". POST /web/friendships/.../unfollow/ often starts returning 400
       * after a few calls if the header stays wrong.
       */
      async function resolveRolloutHash({ forceHomeFetch } = {}) {
        if (!forceHomeFetch) {
          const cached = readCachedRollout();
          if (cached) return cached;
          const fromDoc = rolloutFromHtml(document.documentElement.innerHTML);
          if (fromDoc) {
            writeCachedRollout(fromDoc);
            return fromDoc;
          }
        }
        clearCachedRollout();
        const res = await fetch("https://www.instagram.com/", {
          credentials: "include",
          cache: "no-store",
        });
        const text = await res.text();
        const h = rolloutFromHtml(text) || "1";
        writeCachedRollout(h);
        return h;
      }

      async function postUnfollow(rollout) {
        const csrf = getCookie("csrftoken");
        const id = String(targetUserId).trim();
        if (!csrf || !id) {
          return { ok: false, status: 0, json: null };
        }
        const url = `https://www.instagram.com/web/friendships/${encodeURIComponent(id)}/unfollow/`;
        const res = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: {
            "x-csrftoken": csrf,
            "x-requested-with": "XMLHttpRequest",
            "x-instagram-ajax": rollout,
            "x-ig-app-id": IG_APP_ID,
            "x-asbd-id": "198387",
            Accept: "application/json",
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
      }

      let rollout = await resolveRolloutHash({ forceHomeFetch: false });
      let out = await postUnfollow(rollout);
      if (out.ok) return out;
      if (out.status === 400 || out.status === 429 || out.status === 403) {
        rollout = await resolveRolloutHash({ forceHomeFetch: true });
        await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));
        out = await postUnfollow(rollout);
      }
      return out;
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
      const detail = result?.detail ?? result;
      const msg = `${result?.error || "Request failed"}\n\n${JSON.stringify(detail, null, 2)}`;
      showError(msg);
      setStatus("", false);
      return;
    }
    showResults(result);
    setStatus(
      result.assumedSelf
        ? "Instagram refused the profile lookup, so your logged-in account was used."
        : lastRunLabel(),
    );
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
      setCount("nonfb", nonfbAccounts.length);
      setCount("following", Math.max(0, getCount("following") - 1));
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
    await delay(3500 + Math.random() * 4000);
  }

  if (lastAnalysisData?.following) {
    lastAnalysisData.following = lastAnalysisData.following.filter((x) => !unfollowedIds.has(x.id));
  }

  setCount("following", Math.max(0, getCount("following") - okCount));
  setCount("nonfb", nonfbAccounts.length);

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
    setStatus(lastRunLabel());
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

/* Theme: system -> light -> dark. The stored choice is also read by an inline
   script in popup.html so the first paint is already correct; localStorage is
   used rather than chrome.storage because only it can be read synchronously. */
const THEME_KEY = "instacleanser_theme";
const THEME_CYCLE = ["system", "light", "dark"];

function readThemeChoice() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function applyThemeChoice(choice) {
  if (choice === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = choice;
  }

  const btn = $("#theme-toggle");
  if (btn) {
    btn.dataset.choice = choice;
    btn.title = `Theme: ${choice}`;
    btn.setAttribute("aria-label", `Theme: ${choice}`);
  }

  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* ignore */
  }
}

const themeToggle = $("#theme-toggle");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const i = THEME_CYCLE.indexOf(readThemeChoice());
    applyThemeChoice(THEME_CYCLE[(i + 1) % THEME_CYCLE.length]);
  });
}

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
  applyThemeChoice(readThemeChoice());
  void restoreCachedAnalysis();
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
