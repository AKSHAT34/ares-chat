/* =========================================================================
 * Ares Chat — Claude-style view layer.
 *
 * This file is a ground-up rewrite of the client. It renders the same SSE
 * event stream the server has always emitted (text_delta / tool_call /
 * tool_result / iteration / progress / context_compressed / done / error /
 * model_info / orchestrator_status / orchestrator_plan / subtask_* ) so
 * the backend did not need to change.
 *
 * Conventions:
 *   - No framework, no build step. ES modules loaded directly by the browser.
 *   - DOM built with a small `el()` helper. No innerHTML for untrusted content
 *     (markdown is sanitised through DOMPurify before insertion).
 *   - Each assistant message is a small state machine:
 *        idle → thinking → streaming → complete
 *                       ↘ interrupted / error
 *     Status is kept on the DOM node via data-status and drives CSS/aria.
 *   - Autoscroll uses a sticky-anchor pattern: if the user has scrolled up
 *     more than 80px from the bottom we leave their view alone and show a
 *     "↓ new messages" pill.
 * ======================================================================= */

// =====================================================================
// 1. Markdown pipeline
// =====================================================================

marked.use(globalThis.markedHighlight.markedHighlight({
  langPrefix: "hljs language-",
  highlight(code, lang) {
    // Defensive: hljs may be undefined if the CDN script failed to load
    // or is slow. Without this guard marked wraps the TypeError in a
    // "please report to markedjs/marked" bubble in the UI.
    if (typeof hljs === "undefined" || !hljs || typeof hljs.getLanguage !== "function") {
      return code;
    }
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return code;
    }
  },
}));
marked.setOptions({ gfm: true, breaks: false });

// F-13: force rel="noopener noreferrer" on every <a target="_blank">. The
// markdown pipeline allows model output to emit links, and DOMPurify with
// ADD_ATTR: ["target", "rel"] will keep whatever rel the model wrote
// (including no rel at all). A target="_blank" without noopener gives the
// new tab access to window.opener, which is a known CSRF/phishing surface.
// The hook runs after sanitize, so we know the node is one DOMPurify chose
// to keep; we just normalise the rel attribute.
if (typeof DOMPurify?.addHook === "function") {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.getAttribute("target") === "_blank") {
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

function renderMarkdown(text) {
  const raw = marked.parse(text || "");
  return DOMPurify.sanitize(raw, { ADD_ATTR: ["target", "rel"] });
}

// =====================================================================
// 2. Tiny DOM helpers
// =====================================================================

const $ = (id) => document.getElementById(id);

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  let hasHtml = false;
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") { node.innerHTML = v; hasHtml = true; }
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  if (!hasHtml) {
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === "object" && c.nodeType ? c : document.createTextNode(String(c)));
    }
  }
  return node;
}

// Phase U06 — inline approval card for high/medium-risk tool calls.
// Server emits `approval_required` with classification + tool args; the
// agent loop is blocked until POST /api/sessions/:sid/approve or /deny.
function renderApprovalCard(ev, sessionId) {
  const cls = ev.classification || {};
  const approvalId = ev.approvalId || null;
  const inputPretty = (() => {
    try { return JSON.stringify(ev.input, null, 2); } catch { return String(ev.input); }
  })();
  const card = el("div", {
    class: `approval-card risk-${cls.risk || "medium"}`,
  },
    el("div", { class: "approval-card-head" },
      el("span", { class: "approval-card-icon" }, cls.risk === "high" ? "⚠️" : "🟡"),
      el("div", { class: "approval-card-title" },
        cls.risk === "high" ? "High-risk tool call — confirm to run"
                            : "Confirm tool call before it runs"),
    ),
    el("div", { class: "approval-card-body" },
      el("div", { class: "approval-card-tool" }, ev.toolName || "(unknown tool)"),
      cls.reason ? el("div", { class: "approval-card-reason" }, cls.reason) : null,
      el("pre", { class: "approval-card-input" }, inputPretty),
    ),
    el("div", { class: "approval-card-actions" },
      el("button", {
        class: "approval-card-btn approve",
        onClick: async (e) => {
          e.target.disabled = true;
          try {
            await fetch(`/api/sessions/${sessionId}/approve`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ approvalId }),
            });
          } catch (err) {
            e.target.disabled = false;
            console.error("approve failed:", err);
          }
        },
      }, "Approve"),
      el("button", {
        class: "approval-card-btn deny",
        onClick: async (e) => {
          e.target.disabled = true;
          const reason = prompt("Reason for denial (optional)?") || null;
          try {
            await fetch(`/api/sessions/${sessionId}/deny`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason, approvalId }),
            });
          } catch (err) {
            e.target.disabled = false;
            console.error("deny failed:", err);
          }
        },
      }, "Deny"),
    ),
  );
  return card;
}

function fmtBytes(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(kind, mime) {
  if (kind === "image") return "🖼";
  if (kind === "pdf") return "📄";
  if (kind === "text") {
    if ((mime || "").includes("csv")) return "📊";
    if ((mime || "").includes("json")) return "{ }";
    if ((mime || "").includes("html") || (mime || "").includes("xml")) return "</>";
    if ((mime || "").includes("markdown")) return "📝";
    return "📄";
  }
  return "📎";
}

// Remove our server-side wrapper tags from user-visible text. These tags are
// synthesised when files are attached; they matter to the model, not the UI.
// Also strips <context_summary>…</context_summary> blocks (and unterminated
// remnants) plus the compressor's "Continue the conversation from here…"
// suffix, in case a synthetic user message somehow leaked through
// isSyntheticUserMessage().
function stripWrappers(text) {
  if (!text) return "";
  return text
    // Full + partial context_summary wrappers (both open and close tags).
    // The opening tag may carry attributes (pressure="0", compressed="7",
    // truncated="hard"|"emergency"); match any attrs, not just the bare tag.
    .replace(/<context_summary\b[^>]*>[\s\S]*?<\/context_summary>/gi, "")
    .replace(/<context_summary\b[^>]*>[\s\S]*$/gi, "")
    .replace(/<\/context_summary>/gi, "")
    // File/attachment synthetic wrappers we produce server-side for uploads
    .replace(/<(file|attachment)[^>]*>[\s\S]*?<\/\1>/g, "")
    .replace(/<(file|attachment)[^>]*>[\s\S]*$/g, "")
    // Trailing instructions the compressor prepends to a synthetic turn
    .replace(/^Continue the conversation from here[^\n]*$/gim, "")
    .replace(/^The recent messages below are the current context\.?$/gim, "")
    .replace(/^Compressed \d+ interstitial messages:[^\n]*$/gim, "")
    .trim();
}

function firstTextBlock(m) {
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) {
    // A user turn with attachments has MULTIPLE text blocks on disk:
    // [<file …>…</file>, <file …>…</file>, "the actual user message"].
    // Returning only the first block here meant stripWrappers() then
    // ate the file wrapper and we rendered an empty bubble — the user's
    // message vanished on reload. Join all text blocks; stripWrappers
    // will remove only the synthetic wrappers and leave the real text.
    return m.content
      .filter((b) => b && b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

function toolResultText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c) => c.text || "").join("\n");
  return "";
}

// =====================================================================
// 3. Global DOM refs
// =====================================================================

const messagesEl     = $("messages");
const composer       = $("composer");
const inputEl        = $("input");
const sendBtn        = $("sendBtn");
const stopBtn        = $("stopBtn");
const fileInput      = $("fileInput");
const attachmentChips = $("attachmentChips");
const dropOverlay    = $("dropOverlay");
const mainPane       = $("mainPane");
const chatTitle      = $("chatTitle");
const modelBadge     = $("modelBadge");
const statusBadge    = $("statusBadge");
const toolCount      = $("toolCount");
const toolsBtn       = $("toolsBtn");
const toolsModal     = $("toolsModal");
const toolsList      = $("toolsList");
const closeToolsBtn  = $("closeToolsBtn");
const newChatBtn     = $("newChatBtn");
const sessionListEl  = $("sessionList");
const mcpListEl      = $("mcpList");
const mcpSearchEl    = $("mcpSearch");
const paneTabs       = document.querySelectorAll(".pane-tab");
const paneSessions   = $("pane-sessions");
const paneMcps       = $("pane-mcps");
const lightboxEl     = $("imageLightbox");
const lightboxImg    = $("lightboxImg");
const toastEl        = $("toast");
const modelSelect    = $("modelSelect");
const modeToggle     = $("modeToggle");
const modeIcon       = $("modeIcon");
const micBtn         = $("micBtn");

// =====================================================================
// 4. App state
// =====================================================================

const state = {
  sessionId: null,
  title: "New conversation",
  // Per-session streaming state. The set tracks every session id whose run
  // is currently in flight server-side (or whose SSE stream is still live
  // in this tab). isStreaming() returns true ONLY for the currently-viewed
  // session — switching to a different session always re-derives the flag
  // so the composer reflects the right session's state.
  streamingSessions: new Set(),
  // Per-session "this tab is currently reading the SSE stream" markers.
  // Used by maybeResumeLiveProgress to avoid attaching a duplicate
  // stream-tail when we're already the producer for that session.
  activeReaders: new Set(),
  abort: null,             // AbortController for the currently-viewed session's local fetch
  pendingAttachments: [],
  selectedMode: "standard", // "standard" | "parallel"
  mcpCache: [],
  // Polling-based "live progress on refresh" when server is still streaming
  progressPoll: null,
};

// True iff the currently-viewed session has a live run.
function isStreaming() {
  return state.sessionId ? state.streamingSessions.has(state.sessionId) : false;
}
// Start tracking a session as streaming.
function setStreaming(sid, on) {
  if (!sid) return;
  if (on) state.streamingSessions.add(sid);
  else state.streamingSessions.delete(sid);
  // Repaint the sidebar so its dot/spinner stays accurate for off-screen sessions.
  updateSessionRowIndicators();
}

// Show send vs. stop button based on whether the CURRENTLY-VIEWED session
// has a run in flight. Called any time the streaming set changes OR the
// user switches sessions.
function syncComposerForCurrentSession() {
  if (!sendBtn || !stopBtn) return;
  if (isStreaming()) {
    sendBtn.classList.add("hidden");
    stopBtn.classList.remove("hidden");
  } else {
    sendBtn.classList.remove("hidden");
    stopBtn.classList.add("hidden");
  }
}

// Repaint every visible session row's "running" dot. Cheap — we just
// toggle a class. Server-driven indicators (from /api/sessions streamActive)
// are layered on by renderSessionRow during loadSessions().
function updateSessionRowIndicators() {
  const rows = document.querySelectorAll(".session-row[data-sid]");
  for (const row of rows) {
    const sid = row.getAttribute("data-sid");
    const live = state.streamingSessions.has(sid);
    row.classList.toggle("streaming", live);
  }
}

// =====================================================================
// 5. Toasts
// =====================================================================

function toast(msg, kind = "info") {
  toastEl.textContent = msg;
  toastEl.className = `toast ${kind === "error" ? "error" : kind === "success" ? "success" : ""}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.add("hidden"), 2400);
}

// =====================================================================
// 6. Scroll anchor
// =====================================================================

// H-1 (decision 5 in AUDIT-PLAN): 50 px matches the prompt spec. Pre-fix
// 80 px treated more of the upper viewport as "near bottom" and so
// auto-scrolled even when the user had nudged up to read.
const SCROLL_SLACK = 50;

function nearBottom() {
  const gap = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
  return gap <= SCROLL_SLACK;
}
function scrollToBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }
let jumpPill = null;
function showJumpPill() {
  if (jumpPill) return;
  jumpPill = el("button", {
    class: "jump-pill",
    onclick: () => { scrollToBottom(); hideJumpPill(); },
  }, "↓ new messages");
  mainPane.appendChild(jumpPill);
}
function hideJumpPill() {
  if (jumpPill) { jumpPill.remove(); jumpPill = null; }
}
function stickyScroll() {
  if (nearBottom()) { scrollToBottom(); hideJumpPill(); }
  else showJumpPill();
}
messagesEl.addEventListener("scroll", () => {
  // F-7: also SHOW the pill when the user scrolls up while a stream
  // is in flight. Pre-fix the listener only HID it on user-down-scroll;
  // a session with lots of replayed history never surfaced the pill
  // during streaming.
  if (nearBottom()) {
    hideJumpPill();
  } else if (isStreaming()) {
    showJumpPill();
  }
});

// =====================================================================
// 7. Welcome screen
// =====================================================================

function renderWelcome() {
  messagesEl.innerHTML = "";
  const wrap = el("div", { class: "welcome" });
  wrap.appendChild(el("div", { class: "hero-mark" }, "A"));
  wrap.appendChild(el("h1", {}, "Hi, I'm Ares."));
  wrap.appendChild(el("div", { class: "welcome-tagline" }, "The Orchestrator of Intelligence"));
  wrap.appendChild(el("p", {},
    "Memory → Skills → Wiki → MCP. I check what I already know before acting, read the docs when I don't, and record what I learn so next time is faster."));
  const grid = el("div", { class: "welcome-grid" });
  const samples = [
    "Read my recent memory + preferences",
    "What Company MCPs are available?",
    "Find the latest VENDOR7 report in my inbox",
    "Run shell command: df -h",
  ];
  for (const s of samples) {
    grid.appendChild(el("button", {
      class: "welcome-prompt",
      onclick: () => { inputEl.value = s; inputEl.focus(); autoResize(); },
    }, s));
  }
  wrap.appendChild(grid);
  // Phase 8a (H-5) — footer links: jobs view + slash-command listing.
  const footer = el("div", {
    class: "welcome-footer",
    style: "margin-top: 18px; display: flex; gap: 18px; justify-content: center; font-size: 12.5px; color: var(--text-3);",
  });
  footer.appendChild(el("a", {
    href: "/jobs.html", target: "_blank",
    style: "color: var(--text-2); text-decoration: none; border-bottom: 1px dashed var(--border);",
  }, "Scheduled jobs →"));
  footer.appendChild(el("a", {
    href: "#",
    style: "color: var(--text-2); text-decoration: none; border-bottom: 1px dashed var(--border);",
    onclick: (e) => { e.preventDefault(); inputEl.value = "/help"; runSlashCommand("/help"); },
  }, "See all slash commands"));
  footer.appendChild(el("a", {
    href: "#",
    style: "color: var(--text-2); text-decoration: none; border-bottom: 1px dashed var(--border);",
    onclick: (e) => { e.preventDefault(); showShortcuts(); },
  }, "Keyboard shortcuts"));
  wrap.appendChild(footer);
  const inner = el("div", { class: "messages-inner" });
  inner.appendChild(wrap);
  messagesEl.appendChild(inner);
}

// =====================================================================
// 8. Session list + sidebar
// =====================================================================

async function loadHealth() {
  try {
    const r = await fetch("/api/health");
    const h = await r.json();
    modelBadge.textContent = (h.model || "").replace(/^us\.anthropic\./, "");
    statusBadge.textContent = `${h.servers.running}/${h.servers.total} MCPs · ${h.activeTools} tools`;
    statusBadge.className = "status ok";
    toolCount.textContent = `${h.activeTools} tools`;
  } catch {
    statusBadge.textContent = "offline";
    statusBadge.className = "status err";
  }
}

// Context-window meter — shown in header during/after streaming runs.
// Color tier: green <70%, amber 70-89%, red ≥90%. Tooltip shows raw numbers.
function updateCtxMeter(tokens, max = 200000, soft = 150000, hard = 180000) {
  const meter = document.getElementById("ctxMeter");
  const fill = document.getElementById("ctxMeterFill");
  const label = document.getElementById("ctxMeterLabel");
  if (!meter || !fill || !label) return;
  if (typeof tokens !== "number" || tokens < 0) return;
  meter.classList.remove("hidden", "warn", "crit");
  const pct = Math.min(100, Math.round((tokens / max) * 100));
  fill.style.width = `${pct}%`;
  if (tokens >= hard || pct >= 90) meter.classList.add("crit");
  else if (tokens >= soft || pct >= 70) meter.classList.add("warn");
  const k = (n) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : `${n}`;
  label.textContent = `${k(tokens)} / ${k(max)}`;
  meter.title = `Estimated context: ${tokens.toLocaleString()} tokens of ${max.toLocaleString()} (${pct}%)\nSoft compress at ${soft.toLocaleString()}, hard at ${hard.toLocaleString()}.`;
}

async function loadSessions() {
  try {
    const r = await fetch("/api/sessions");
    const sessions = await r.json();
    // G-4: build the new tree in a DocumentFragment, then swap into the
    // sidebar in one mutation. Pre-fix `innerHTML = ""` followed by
    // `appendChild` per row triggered layout recalc per insertion when
    // the loop interleaved with style reads. The fragment buffers the
    // tree off-document so layout fires once.
    const frag = document.createDocumentFragment();
    if (!sessions.length) {
      frag.appendChild(el("div", {
        class: "section-label",
        style: { textAlign: "center", padding: "20px 10px", color: "var(--text-4)" },
      }, "no conversations yet"));
    } else {
      // Reconcile our local streaming-set against the server's authoritative
      // truth. Anything the server reports as live joins our set; anything
      // the server reports as inactive is removed (covers the case where a
      // stream finished while we were on a different session/tab).
      for (const s of sessions) {
        if (s.streamActive) state.streamingSessions.add(s.id);
        else if (state.streamingSessions.has(s.id) && !s.streamActive) state.streamingSessions.delete(s.id);
      }
      for (const s of sessions) frag.appendChild(renderSessionRow(s));
    }
    sessionListEl.replaceChildren(frag);
    // Composer button state may need to update if the current session
    // just changed streaming state on the server.
    syncComposerForCurrentSession();
  } catch {}
}

function renderSessionRow(s) {
  const isActive = s.id === state.sessionId;
  const isLive = !!s.streamActive || state.streamingSessions.has(s.id);
  const cls = `session-row${isActive ? " active" : ""}${isLive ? " streaming" : ""}`;
  const row = el("div", {
    class: cls,
    title: isLive ? `${s.title} · running` : s.title,
    "data-sid": s.id,
    onclick: () => openSession(s.id),
  });
  if (isLive) {
    row.appendChild(el("span", { class: "streaming-dot", title: "Run in progress" }));
  }
  if (s.pinned) row.appendChild(el("span", { class: "pin-mark" }, "◆"));
  const titleEl = el("span", {
    class: "title",
    ondblclick: (e) => { e.stopPropagation(); startInlineRename(row, s); },
  }, s.title || "Untitled");
  row.appendChild(titleEl);

  const actions = el("div", { class: "session-actions" });
  actions.appendChild(el("button", {
    class: `pin${s.pinned ? " active" : ""}`,
    title: s.pinned ? "Unpin" : "Pin",
    onclick: async (e) => {
      e.stopPropagation();
      try { await fetch(`/api/sessions/${s.id}/pin`, { method: "POST" }); await loadSessions(); }
      catch (err) { toast("Pin failed: " + err.message, "error"); }
    },
    html: s.pinned
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 2 1-2v-6h5v-2l-2-2z"/></svg>'
      : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 2 1-2v-6h5v-2l-2-2z"/></svg>',
  }));
  actions.appendChild(el("button", {
    title: "Rename",
    onclick: (e) => { e.stopPropagation(); startInlineRename(row, s); },
    html: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
  }));
  actions.appendChild(el("button", {
    class: "del",
    title: "Delete",
    onclick: async (e) => {
      e.stopPropagation();
      if (!confirm("Delete this chat?")) return;
      try {
        const r = await fetch(`/api/sessions/${s.id}`, { method: "DELETE" });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
        if (state.sessionId === s.id) { state.sessionId = null; renderWelcome(); setTitle("New conversation"); }
        await loadSessions();
        toast("Deleted", "success");
      } catch (err) { toast("Delete failed: " + err.message, "error"); }
    },
    html: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
  }));
  row.appendChild(actions);
  return row;
}

function startInlineRename(row, s) {
  const titleEl = row.querySelector(".title");
  // F-4: `done` guard. Pre-fix Enter triggered commit, Enter blurred the
  // input, blur fired commit AGAIN → duplicate PATCH and duplicate
  // "Renamed" toast. The header-rename variant has this guard already;
  // the session-row variant did not.
  let done = false;
  const inp = el("input", {
    class: "title-edit",
    value: s.title || "",
    onkeydown: async (e) => {
      if (e.key === "Enter") { e.preventDefault(); await commit(); }
      else if (e.key === "Escape") cancel();
    },
  });
  titleEl.replaceWith(inp);
  inp.select(); inp.focus();
  const cancel = () => {
    if (done) return;
    done = true;
    inp.replaceWith(titleEl);
  };
  const commit = async () => {
    if (done) return;
    done = true;
    const title = inp.value.trim();
    if (!title || title === s.title) {
      // Restore the title element since cancel guard is short-circuited.
      inp.replaceWith(titleEl);
      return;
    }
    try {
      const r = await fetch(`/api/sessions/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!r.ok) throw new Error((await r.json()).error || r.statusText);
      s.title = title;
      if (state.sessionId === s.id) setTitle(title);
      await loadSessions();
      toast("Renamed", "success");
    } catch (e) {
      toast("Rename failed: " + e.message, "error");
      inp.replaceWith(titleEl);
    }
  };
  inp.addEventListener("blur", commit);
}

async function newSession() {
  state.sessionId = null;
  localStorage.removeItem("ares_active_session");
  stopProgressPoll();
  state.pendingAttachments = [];
  renderAttachmentChips();
  renderWelcome();
  setTitle("New conversation");
  await loadSessions();
  inputEl.focus();
}

async function openSession(id) {
  state.sessionId = id;
  localStorage.setItem("ares_active_session", id);
  // Don't kill any progress poll for THIS session — it might be the same
  // tab driving a live tail. Only stop polls bound to a different session
  // (which would otherwise fight with this view's renderer).
  if (state.progressPoll && state.progressPoll.sessionId !== id) {
    stopProgressPoll();
  }
  state.pendingAttachments = [];
  renderAttachmentChips();
  const r = await fetch(`/api/sessions/${id}`);
  const data = await r.json();
  // Mirror authoritative server-side streaming state into our set so the
  // sidebar dot is right even if this tab never started the run itself.
  if (data.streamActive) setStreaming(id, true);
  renderSession(data);
  syncComposerForCurrentSession();
  await loadSessions();
  maybeResumeLiveProgress(data);
  maybeOfferCheckpointResume(data);
}

// If the session has a crash-resumable checkpoint on disk, surface a
// one-click "Resume (N iterations done)" banner. The user's choice is
// explicit — we never auto-resume because the crash could have been
// intentional (user killed a stuck run).
function maybeOfferCheckpointResume(data) {
  if (!data || !data.resumable || isStreaming()) return;
  if (data.streamActive) return; // a live stream takes precedence
  const inner = ensureMessagesInner();
  // If one is already shown, don't duplicate
  if (inner.querySelector(".resume-banner")) return;
  const banner = el("div", { class: "resume-banner" });
  banner.appendChild(el("div", { class: "resume-banner-title" },
    "🔁 Previous run was interrupted"));
  banner.appendChild(el("div", { class: "resume-banner-msg" },
    `Crashed at iteration ${data.resume?.iteration ?? "?"}${data.resume?.messageCount ? ` · ${data.resume.messageCount} messages in flight` : ""}.`));
  const actions = el("div", { class: "resume-banner-actions" });
  const resumeBtn = el("button", {
    type: "button",
    class: "cred-banner-btn primary",
    onclick: async () => {
      resumeBtn.disabled = true;
      resumeBtn.textContent = "Resuming…";
      banner.remove();
      await startCheckpointResume(data.id);
    },
  }, "Resume");
  const discardBtn = el("button", {
    type: "button",
    class: "cred-banner-btn ghost",
    onclick: async () => {
      banner.remove();
      try { await fetch(`/api/sessions/${data.id}/resume-status`, { method: "DELETE" }); } catch {}
      // No-op server side for now — checkpoint will be cleaned up on next run
      // or server restart. We just hide the banner for this page load.
    },
  }, "Start fresh");
  actions.appendChild(resumeBtn);
  actions.appendChild(discardBtn);
  banner.appendChild(actions);
  inner.appendChild(banner);
  scrollToBottom();
}

async function startCheckpointResume(sessionId) {
  setStreaming(sessionId, true);
  syncComposerForCurrentSession();
  state.abort = new AbortController();

  const inner = ensureMessagesInner();
  const turn = createAssistantTurn({ status: "thinking" });
  getOrCreateThinkingBubble(turn._body);
  inner.appendChild(turn);
  stickyScroll();

  const { handle, finalizeCaret } = makeStreamConsumer(turn);
  try {
    const res = await fetch(`/api/sessions/${sessionId}/resume-run`, {
      method: "POST",
      signal: state.abort.signal,
    });
    if (!res.ok) throw new Error("resume failed: " + res.status);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const data = line.replace(/^data:\s*/, "").trim();
        if (!data) continue;
        let ev;
        try { ev = JSON.parse(data); } catch { continue; }
        handle(ev);
      }
    }
  } catch (err) {
    finalizeCaret();
    if (err.name === "AbortError") {
      setTurnStatus(turn, "interrupted");
      turn._body.appendChild(el("div", { class: "state-pill interrupted" }, "Resume stopped."));
    } else {
      setTurnStatus(turn, "error");
      turn._body.appendChild(el("div", { class: "state-pill error" }, "⚠ " + err.message));
    }
  }

  finalizeCaret();
  setStreaming(sessionId, false);
  syncComposerForCurrentSession();
  state.abort = null;
  addFeedbackBar(turn, "(resumed run)");
  loadSessions().catch(() => {});
  loadHealth().catch(() => {});
}

async function ensureSession() {
  if (state.sessionId) return state.sessionId;
  const r = await fetch("/api/sessions", { method: "POST" });
  const s = await r.json();
  state.sessionId = s.id;
  localStorage.setItem("ares_active_session", s.id);
  return s.id;
}

function setTitle(t) { state.title = t; chatTitle.textContent = t; }

// =====================================================================
// 9. Session replay (from disk)
// =====================================================================

// Tell whether a user-role message is synthetic (server-injected context
// compression wrapper, pure tool_result blocks, or sanitizer stubs). These
// shouldn't render as their own turn in the UI — they exist to keep the
// Bedrock transcript valid and carry no user-facing meaning.
function isSyntheticUserMessage(m) {
  if (!Array.isArray(m.content)) return false;
  // Case 1: All tool_result blocks — no user-authored text.
  if (m.content.every((b) => b.type === "tool_result")) return true;
  // Case 2: Every text block starts with a synthetic marker we recognise.
  // <context_summary> opening tag may carry attributes (pressure, compressed,
  // truncated); match any attrs, not just the bare tag.
  const SYNTHETIC_RE = /^(?:<context_summary\b[^>]*>|\(result missing|\[system nudge:)/;
  for (const b of m.content) {
    if (b.type !== "text") continue;
    if (typeof b.text !== "string") continue;
    const trimmed = b.text.trimStart();
    if (!SYNTHETIC_RE.test(trimmed)) return false; // any genuine user text → not synthetic
  }
  return true;
}

// Tell whether an assistant text block is a synthetic ack we should hide.
function isSyntheticAssistantText(text) {
  if (!text) return true;
  const t = text.trimStart();
  return (
    t.startsWith("Understood. I have the conversation context") ||
    t.startsWith("Understood. Context noted")
  );
}

function renderSession(data) {
  messagesEl.innerHTML = "";
  hideJumpPill();
  setTitle(data.title || "conversation");

  const inner = el("div", { class: "messages-inner" });
  messagesEl.appendChild(inner);

  let lastAssistant = null;  // for folding tool-only assistant turns

  for (const m of data.messages || []) {
    if (m.role === "user") {
      if (isSyntheticUserMessage(m)) continue;
      const ut = renderUserTurn(m);
      if (ut) inner.appendChild(ut);
      lastAssistant = null;
    } else if (m.role === "assistant") {
      const hasText = (m.content || []).some((b) =>
        b.type === "text" && b.text && b.text.trim() &&
        !isSyntheticAssistantText(b.text));
      const hasTools = (m.content || []).some((b) => b.type === "tool_use");
      if (!hasText && !hasTools) continue;

      let turn, body;
      if (!hasText && hasTools && lastAssistant) {
        // Fold tool-only turn into the previous assistant body.
        body = lastAssistant._body;
      } else {
        turn = createAssistantTurn({ status: "complete" });
        inner.appendChild(turn);
        body = turn._body;
        if (hasText) lastAssistant = turn;
      }

      for (const b of m.content || []) {
        if (b.type === "text") {
          if (!b.text || !b.text.trim()) continue;
          if (isSyntheticAssistantText(b.text)) continue;
          appendMarkdownTo(body, b.text);
        } else if (b.type === "tool_use") {
          const card = addToolCard(body, b.name, b.input);
          card.dataset.toolId = b.id;
        }
      }

      // If this wrapper ended up empty after filtering, remove it.
      if (turn && !body.children.length) turn.remove();
    }
  }

  // Hook up tool_results to their cards.
  const matched = new Set();
  for (const m of data.messages || []) {
    if (m.role === "user" && Array.isArray(m.content)) {
      for (const b of m.content) {
        if (b.type === "tool_result") {
          matched.add(b.tool_use_id);
          const card = messagesEl.querySelector(`[data-tool-id="${b.tool_use_id}"]`);
          if (card) setToolCardResult(card, toolResultText(b.content), !!b.is_error);
        }
      }
    }
  }
  // Any cards without results → "interrupted".
  for (const card of messagesEl.querySelectorAll("[data-tool-id]")) {
    if (!matched.has(card.dataset.toolId)) {
      setToolCardResult(card, "(interrupted — no result saved)", false, "interrupted");
    }
  }

  // Update thinking-bubble labels after replay. Every replayed turn is
  // complete, so always strip the live pulsing dots.
  for (const turn of messagesEl.querySelectorAll(".turn.assistant")) {
    markThinkingDone(turn._body || turn.querySelector(".assistant-body"), { force: true });
    turn.dataset.status = "complete";
  }

  scrollToBottom();
}

// =====================================================================
// 10. User turn
// =====================================================================

function renderUserTurn(m) {
  const text = stripWrappers(firstTextBlock(m));
  const atts = m._attachments || [];
  // After stripping synthetic wrappers, if there's nothing to show AND no
  // attachments, don't render a turn at all.
  if (!text && !atts.length) return null;

  const wrap = el("div", { class: "turn user" });
  // Column gets tight max-width in CSS so long user messages wrap cleanly
  // at ~62% of the content column rather than the wider 80% default.
  const col = el("div", { class: "user-col", style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" } });
  if (atts.length) {
    const row = el("div", { class: "bubble-attachments" });
    for (const a of atts) row.appendChild(renderUserAttachment(a));
    col.appendChild(row);
  }
  if (text) col.appendChild(el("div", { class: "bubble" }, text));
  wrap.appendChild(col);
  return wrap;
}

function renderUserAttachment(a) {
  if (a.kind === "image" && a.path) {
    const filename = a.path.split("/").pop();
    const url = `/uploads/${encodeURIComponent(state.sessionId)}/${encodeURIComponent(filename)}`;
    return el("img", {
      src: url,
      style: { maxHeight: "140px", maxWidth: "240px", borderRadius: "8px", cursor: "zoom-in", objectFit: "cover" },
      onclick: () => showLightbox(url),
    });
  }
  const chip = el("div", { class: "att-chip" });
  chip.appendChild(el("span", {}, fileIcon(a.kind, a.mime)));
  const meta = el("div", { style: { display: "flex", flexDirection: "column", minWidth: 0 } });
  meta.appendChild(el("div", { class: "name" }, a.name));
  meta.appendChild(el("div", { class: "meta" }, `${a.kind} · ${fmtBytes(a.sizeBytes)}`));
  chip.appendChild(meta);
  return chip;
}

// =====================================================================
// 11. Assistant turn (state-machine driven)
// =====================================================================

/**
 * Create an assistant turn element with an avatar + body slot.
 * Status drives the avatar color and the presence of the streaming caret.
 * @param {{status?: "idle"|"thinking"|"streaming"|"complete"|"error"|"interrupted"}} opts
 */
function createAssistantTurn({ status = "thinking" } = {}) {
  const wrap = el("div", { class: "turn assistant" });
  wrap.dataset.status = status;
  const avatar = el("div", { class: `assistant-avatar${status === "thinking" ? " thinking" : ""}` }, "A");
  const body = el("div", { class: "assistant-body prose-chat" });
  wrap.appendChild(avatar);
  wrap.appendChild(body);
  wrap._body = body;
  wrap._avatar = avatar;
  return wrap;
}

function setTurnStatus(turn, status) {
  if (!turn) return;
  turn.dataset.status = status;
  const av = turn._avatar;
  if (av) {
    av.classList.remove("thinking", "error");
    if (status === "thinking") av.classList.add("thinking");
    else if (status === "error") av.classList.add("error");
  }
}

function appendMarkdownTo(body, mdText) {
  const container = el("div");
  container.innerHTML = renderMarkdown(mdText);
  // Add copy buttons to code blocks
  for (const pre of container.querySelectorAll("pre")) {
    const btn = el("button", {
      class: "code-copy",
      onclick: async (e) => {
        e.stopPropagation();
        const code = pre.querySelector("code")?.innerText || "";
        try {
          await navigator.clipboard.writeText(code);
          btn.textContent = "copied";
          setTimeout(() => (btn.textContent = "copy"), 1200);
        } catch {}
      },
    }, "copy");
    pre.style.position = "relative";
    pre.appendChild(btn);
  }
  body.appendChild(container);
}

// =====================================================================
// 12. Thinking bubble & tool cards
// =====================================================================

function getOrCreateThinkingBubble(body) {
  let wrap = body.querySelector(":scope > .thinking-wrap");
  if (wrap) return wrap;
  wrap = el("div", { class: "thinking-wrap", style: { marginBottom: "10px" } });
  const btn = el("button", {
    class: "thinking-bubble",
    type: "button",
    onclick: () => {
      const t = wrap.querySelector(".thinking-transcript");
      const ch = wrap.querySelector(".thinking-chevron");
      const open = t.classList.toggle("open");
      ch.classList.toggle("open", open);
    },
  });
  btn.appendChild(el("span", { class: "thinking-dots" }, el("span"), el("span"), el("span")));
  btn.appendChild(el("span", { class: "thinking-label" }, "Thinking"));
  btn.appendChild(el("span", { class: "thinking-chevron" }, "▼"));
  wrap.appendChild(btn);
  const transcript = el("div", { class: "thinking-transcript" });
  const inner = el("div", { class: "thinking-transcript-inner" });
  transcript.appendChild(inner);
  wrap.appendChild(transcript);
  wrap._transcript = inner;
  body.appendChild(wrap);
  return wrap;
}

function markThinkingDone(body, { force = false } = {}) {
  if (!body) return;
  const wraps = body.querySelectorAll(":scope > .thinking-wrap");
  wraps.forEach((wrap) => {
    // Skip if already marked (cheap guard).
    if (wrap.dataset.done === "1" && !force) return;
    wrap.dataset.done = "1";
    const btn = wrap.querySelector(".thinking-bubble");
    const label = wrap.querySelector(".thinking-label");
    const dots = wrap.querySelector(".thinking-dots");
    const n = wrap._transcript?.querySelectorAll(".tool-card").length || 0;
    if (btn) btn.classList.add("done");
    if (label) label.textContent = n ? `${n} step${n === 1 ? "" : "s"}` : "Thought";
    if (dots) dots.remove(); // actually remove so it collapses, not just hidden
  });
}

function addToolCard(bodyOrTranscript, name, input) {
  // Tool cards live inside the thinking bubble transcript, not in the
  // main prose flow. If caller passed `body`, we find/create a thinking
  // bubble first.
  let container = bodyOrTranscript;
  if (container.classList?.contains("prose-chat") ||
      container.classList?.contains("assistant-body")) {
    const bubble = getOrCreateThinkingBubble(container);
    container = bubble._transcript;
  } else if (!container.classList?.contains("thinking-transcript-inner")) {
    // Unknown container — fall through and append there.
  }

  const card = el("div", { class: "tool-card running" });
  const status = el("span", { class: "tool-status running" },
    el("span", { class: "dot" }), "running…");
  const head = el("div", { class: "tool-head" },
    el("span", { class: "chev" }, "▶"),
    el("span", { class: "tool-name" }, name),
    status);
  const body = el("div", { class: "tool-body" });
  const inner = el("div", { class: "tool-body-inner" });
  inner.appendChild(el("div", { class: "tool-io-label" }, "input"));
  inner.appendChild(el("pre", { class: "tool-input" }, JSON.stringify(input ?? {}, null, 2)));
  inner.appendChild(el("div", { class: "tool-io-label" }, "output"));
  const outputEl = el("pre", { class: "tool-output" }, "(waiting…)");
  inner.appendChild(outputEl);
  body.appendChild(inner);
  head.addEventListener("click", () => {
    body.classList.toggle("open");
    head.querySelector(".chev").classList.toggle("open");
  });
  card.appendChild(head);
  card.appendChild(body);
  card._status = status;
  card._output = outputEl;
  container.appendChild(card);

  // Also auto-expand the thinking bubble while streaming is live — so the
  // user sees the running tool card immediately without clicking.
  if (isStreaming()) {
    const wrap = container.closest(".thinking-wrap");
    if (wrap) {
      wrap.querySelector(".thinking-transcript")?.classList.add("open");
      wrap.querySelector(".thinking-chevron")?.classList.add("open");
    }
  }

  stickyScroll();
  return card;
}

function setToolCardResult(card, output, isError, stateName = null) {
  card.classList.remove("running");
  const st = card._status;
  const kind = stateName || (isError ? "error" : "done");
  if (st) {
    st.className = `tool-status ${kind}`;
    st.innerHTML = "";
    st.appendChild(el("span", { class: "dot" }));
    st.appendChild(document.createTextNode(
      kind === "error" ? "error" : kind === "interrupted" ? "interrupted" : "done"
    ));
  }
  if (card._output) card._output.textContent = output || "(empty)";
}

// Render an actionable credentials-expired banner. Shows: icon, human
// message, a "Check again" button that re-runs /api/aws-check, and a
// "Retry last message" button that re-sends once creds are good.
function renderCredentialError(ev) {
  const wrap = el("div", { class: "cred-banner" });
  const head = el("div", { class: "cred-banner-head" });
  head.appendChild(el("span", { class: "cred-banner-icon" }, "🔑"));
  head.appendChild(el("div", { class: "cred-banner-title" }, "AWS credentials need refresh"));
  wrap.appendChild(head);
  wrap.appendChild(el("div", { class: "cred-banner-msg" },
    ev.error || "Run `auth-init -s` in a terminal, then click Check again."));
  const steps = el("ol", { class: "cred-banner-steps" },
    el("li", {}, "Open a terminal"),
    el("li", {},
      el("code", {}, "auth-init -s"),
      " (or ",
      el("code", {}, "auth-init -o -s"),
      " if that fails)"),
    el("li", {}, "Click Check again below"));
  wrap.appendChild(steps);

  const actions = el("div", { class: "cred-banner-actions" });
  const checkBtn = el("button", {
    type: "button",
    class: "cred-banner-btn primary",
    onclick: async () => {
      checkBtn.disabled = true;
      checkBtn.textContent = "Checking…";
      try {
        const r = await fetch("/api/aws-check");
        const d = await r.json();
        if (d.ok) {
          wrap.classList.add("cred-banner-ok");
          wrap.innerHTML = "";
          wrap.appendChild(el("div", { class: "cred-banner-head" },
            el("span", { class: "cred-banner-icon" }, "✓"),
            el("div", { class: "cred-banner-title" }, "Credentials valid"),
          ));
          wrap.appendChild(el("div", { class: "cred-banner-msg" },
            d.expiresAt ? `Expire ${new Date(d.expiresAt).toLocaleTimeString()}` : "OK"));
          toast("Credentials refreshed", "success");
          setTimeout(() => wrap.remove(), 2500);
        } else {
          checkBtn.disabled = false;
          checkBtn.textContent = "Check again";
          toast(d.error || "Still expired", "error");
        }
      } catch (e) {
        checkBtn.disabled = false;
        checkBtn.textContent = "Check again";
        toast("Check failed: " + e.message, "error");
      }
    },
  }, "Check again");
  actions.appendChild(checkBtn);

  const copyBtn = el("button", {
    type: "button",
    class: "cred-banner-btn ghost",
    onclick: async () => {
      try { await navigator.clipboard.writeText("auth-init -s"); toast("Copied: auth-init -s", "success"); }
      catch { toast("Copy failed", "error"); }
    },
  }, "Copy command");
  actions.appendChild(copyBtn);

  wrap.appendChild(actions);
  return wrap;
}

// =====================================================================
// 13. Attachments
// =====================================================================

function guessKind(file) {
  const m = file.type || "";
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("text/") || m === "application/json" || m === "application/xml") return "text";
  return "file";
}

async function uploadFiles(files) {
  const sid = await ensureSession();
  const form = new FormData();
  for (const f of files) form.append("files", f);
  const r = await fetch(`/api/sessions/${sid}/upload`, { method: "POST", body: form });
  if (!r.ok) { toast("Upload failed: " + (await r.text()), "error"); return []; }
  const data = await r.json();
  return data.attachments || [];
}

async function addFilesFromInput(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const placeholders = files.map((f) => ({
    id: "_tmp_" + Math.random().toString(36).slice(2),
    kind: guessKind(f), name: f.name, mime: f.type, sizeBytes: f.size, uploading: true,
  }));
  state.pendingAttachments.push(...placeholders);
  renderAttachmentChips();
  const uploaded = await uploadFiles(files);
  state.pendingAttachments = state.pendingAttachments.filter((a) => !a.uploading).concat(uploaded);
  renderAttachmentChips();
}

function renderAttachmentChips() {
  attachmentChips.innerHTML = "";
  if (!state.pendingAttachments.length) return;
  for (const a of state.pendingAttachments) {
    const chip = el("div", { class: "att-chip" });
    if (a.kind === "image" && a.path && !a.uploading) {
      const fname = a.path.split("/").pop();
      chip.appendChild(el("img", { src: `/uploads/${encodeURIComponent(state.sessionId)}/${encodeURIComponent(fname)}` }));
    } else {
      chip.appendChild(el("span", { style: { fontSize: "13px" } }, a.uploading ? "…" : fileIcon(a.kind, a.mime)));
    }
    const meta = el("div", { style: { display: "flex", flexDirection: "column", minWidth: 0 } });
    meta.appendChild(el("div", { class: "name" }, a.name));
    meta.appendChild(el("div", { class: "meta" }, a.uploading ? "uploading…" : `${a.kind} · ${fmtBytes(a.sizeBytes)}`));
    chip.appendChild(meta);
    if (!a.uploading) {
      chip.appendChild(el("button", {
        class: "remove",
        type: "button",
        onclick: () => {
          state.pendingAttachments = state.pendingAttachments.filter((x) => x.id !== a.id);
          renderAttachmentChips();
        },
      }, "×"));
    }
    attachmentChips.appendChild(chip);
  }
}

fileInput.addEventListener("change", () => { addFilesFromInput(fileInput.files); fileInput.value = ""; });

// Drag-and-drop
["dragenter", "dragover"].forEach((evt) => {
  mainPane.addEventListener(evt, (e) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    dropOverlay.classList.add("visible");
  });
});
["dragleave", "drop"].forEach((evt) => {
  mainPane.addEventListener(evt, (e) => {
    if (evt === "drop") e.preventDefault();
    if (evt === "dragleave" && e.target !== mainPane) return;
    dropOverlay.classList.remove("visible");
  });
});
mainPane.addEventListener("drop", (e) => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault();
  addFilesFromInput(e.dataTransfer.files);
});
inputEl.addEventListener("paste", (e) => {
  const items = Array.from(e.clipboardData?.items || []);
  const files = items.filter((it) => it.kind === "file").map((it) => it.getAsFile()).filter(Boolean);
  if (files.length) { e.preventDefault(); addFilesFromInput(files); }
});

// =====================================================================
// 14. MCP pane
// =====================================================================

async function loadMcps() {
  try {
    const r = await fetch("/api/mcps");
    state.mcpCache = await r.json();
    renderMcps();
  } catch {}
}

function renderMcps() {
  const q = (mcpSearchEl?.value || "").toLowerCase();
  // G-4: same DocumentFragment treatment as loadSessions. With 49 MCPs,
  // an `innerHTML = ""` then 49 sequential appendChild calls during a
  // search keystroke produces noticeable layout work.
  const frag = document.createDocumentFragment();
  const groups = {
    "always-on":  state.mcpCache.filter((m) => m.alwaysActive),
    "running":    state.mcpCache.filter((m) => !m.alwaysActive && m.state === "running"),
    "available":  state.mcpCache.filter((m) => !m.alwaysActive && (m.state === "idle" || m.state === "starting")),
    "error":      state.mcpCache.filter((m) => m.state === "error"),
  };
  for (const [label, rows] of Object.entries(groups)) {
    const filtered = rows.filter((m) => !q || m.name.toLowerCase().includes(q));
    if (!filtered.length) continue;
    frag.appendChild(el("div", { class: "section-label" }, `${label} (${filtered.length})`));
    for (const m of filtered) frag.appendChild(renderMcpRow(m));
  }
  mcpListEl.replaceChildren(frag);
}

function renderMcpRow(m) {
  let dot = "idle";
  if (m.alwaysActive) dot = "always";
  else if (m.state === "running") dot = "running";
  else if (m.state === "starting") dot = "starting";
  else if (m.state === "error") dot = "error";
  const row = el("div", {
    class: "mcp-row",
    title: m.description || m.error || m.name,
    onclick: () => toggleMcp(m),
  },
    el("span", { class: `mcp-dot ${dot}` }),
    el("span", { class: "mcp-name" }, m.name),
    el("span", { class: "mcp-count" },
      m.state === "running" ? String(m.toolCount) :
      m.state === "starting" ? "…" : ""));
  return row;
}

async function toggleMcp(m) {
  if (m.alwaysActive) return;
  const action = m.state === "running" ? "deactivate" : "activate";
  m.state = action === "activate" ? "starting" : "idle";
  renderMcps();
  try {
    const r = await fetch(`/api/mcps/${encodeURIComponent(m.name)}/${action}`, { method: "POST" });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      toast(`${action} ${m.name} failed: ${err.error || r.statusText}`, "error");
    } else {
      toast(`${m.name} ${action}d`, "success");
    }
  } catch (e) { toast("Network error: " + e.message, "error"); }
  await loadMcps();
  await loadHealth();
}

mcpSearchEl.addEventListener("input", renderMcps);

paneTabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    paneTabs.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const which = btn.dataset.pane;
    paneSessions.classList.toggle("hidden", which !== "sessions");
    paneMcps.classList.toggle("hidden", which !== "mcps");
    if (which === "mcps") loadMcps();
  });
});

// =====================================================================
// 15. Models + mode toggle
// =====================================================================

async function loadModels() {
  try {
    const r = await fetch("/api/models");
    const models = await r.json();
    modelSelect.innerHTML = "";
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.icon || ""} ${m.name}`.trim();
      opt.title = m.description || "";
      modelSelect.appendChild(opt);
    }
  } catch {}
}

modeToggle.addEventListener("click", () => {
  if (state.selectedMode === "standard") {
    state.selectedMode = "parallel";
    modeIcon.textContent = "⚡⚡";
    modeToggle.classList.add("mode-parallel");
    modeToggle.title = "Parallel mode — tasks decomposed + run in parallel";
    toast("Parallel mode on", "info");
  } else {
    state.selectedMode = "standard";
    modeIcon.textContent = "⚡";
    modeToggle.classList.remove("mode-parallel");
    modeToggle.title = "Single agent · click to enable parallel";
  }
});

// =====================================================================
// 16. Speech-to-text
// =====================================================================

let recognition = null;
let isListening = false;
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  let finalTranscript = "";
  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += t + " ";
      else interim = t;
    }
    inputEl.value = finalTranscript + interim;
    autoResize();
  };
  recognition.onend = () => {
    if (!isListening) return;
    isListening = false;
    micBtn.classList.remove("active");
    const text = inputEl.value.trim();
    if (text && !isStreaming()) {
      inputEl.value = ""; autoResize();
      sendMessage(text);
    }
  };
  recognition.onerror = (ev) => {
    if (ev.error !== "no-speech") toast("Mic error: " + ev.error, "error");
    isListening = false;
    micBtn.classList.remove("active");
  };
  micBtn.addEventListener("click", () => {
    if (isListening) { recognition.stop(); isListening = false; micBtn.classList.remove("active"); }
    else {
      // Phase U15 — opt-in Company Transcribe path. Set
      // localStorage.aresUseAwsTranscribe = "1" to use AWS instead of
      // the browser-native webkitSpeechRecognition. AWS path is required
      // when the platform is internal-only (no public-cloud STT).
      if (localStorage.getItem("aresUseAwsTranscribe") === "1") {
        startAwsTranscribe();
        return;
      }
      finalTranscript = inputEl.value;
      recognition.start();
      isListening = true;
      micBtn.classList.add("active");
      toast("Listening… click mic again to stop & send", "info");
    }
  });
} else {
  // No webkitSpeechRecognition — wire the AWS path on click instead so
  // mic still works on Firefox / non-Chromium browsers.
  micBtn.addEventListener("click", startAwsTranscribe);
}

// Phase U15 — Company Transcribe path. Records via MediaRecorder, posts
// the audio to /api/transcribe, drops the returned transcript into the
// composer. Click mic again to stop. Heavier latency than the browser-
// native recognizer, but uses the same your-aws-profile profile + AWS region
// the rest of ares-chat does.
let _awsRecorder = null;
let _awsChunks = [];
async function startAwsTranscribe() {
  if (_awsRecorder && _awsRecorder.state === "recording") {
    _awsRecorder.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _awsChunks = [];
    _awsRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    _awsRecorder.ondataavailable = (ev) => { if (ev.data.size) _awsChunks.push(ev.data); };
    _awsRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      micBtn.classList.remove("active");
      const blob = new Blob(_awsChunks, { type: "audio/webm" });
      _awsChunks = [];
      if (!blob.size) { toast("No audio captured", "error"); return; }
      const fd = new FormData();
      // The server expects PCM/ogg-opus/flac — webm is opus; mark it as
      // ogg-opus and Transcribe will accept it for most browsers.
      fd.append("audio", blob, "memo.webm");
      fd.append("mediaEncoding", "ogg-opus");
      fd.append("mediaSampleRateHertz", "48000");
      try {
        toast("Transcribing…", "info");
        const r = await fetch("/api/transcribe", { method: "POST", body: fd });
        const j = await r.json();
        if (!r.ok || !j.transcript) {
          toast(`Transcription failed: ${j.error || r.status}`, "error");
          return;
        }
        inputEl.value = (inputEl.value ? inputEl.value + " " : "") + j.transcript;
        autoResize();
      } catch (e) {
        toast("Transcription failed: " + e.message, "error");
      }
    };
    _awsRecorder.start();
    micBtn.classList.add("active");
    toast("Recording… click mic to stop + transcribe", "info");
  } catch (e) {
    toast("Mic permission denied: " + e.message, "error");
  }
}

// =====================================================================
// 17. Tools modal + lightbox
// =====================================================================

toolsBtn.addEventListener("click", async () => {
  const r = await fetch("/api/tools");
  const tools = await r.json();
  toolsList.innerHTML = "";
  if (!tools.length) {
    toolsList.appendChild(el("div", { style: { color: "var(--text-3)", textAlign: "center", padding: "20px" } },
      "No tools active. Activate an MCP to see its tools."));
  }
  for (const t of tools) {
    toolsList.appendChild(el("div", {
      style: { padding: "8px 0", borderBottom: "1px solid var(--border-muted)" },
    },
      el("div", { style: { color: "var(--accent)", fontFamily: "ui-monospace,Menlo,monospace", fontSize: "12px" } }, t.name),
      el("div", { style: { color: "var(--text-3)", fontSize: "12px", marginTop: "3px" } }, (t.description || "").slice(0, 240))));
  }
  toolsModal.classList.remove("hidden");
});
closeToolsBtn.addEventListener("click", () => toolsModal.classList.add("hidden"));
toolsModal.addEventListener("click", (e) => { if (e.target === toolsModal) toolsModal.classList.add("hidden"); });

function showLightbox(url) { lightboxImg.src = url; lightboxEl.classList.remove("hidden"); }
lightboxEl.addEventListener("click", () => lightboxEl.classList.add("hidden"));
// F-10: Esc closes the lightbox + tools modal. Pre-fix a click-anywhere
// was the only escape hatch — if the lightbox covered keyboard focus
// the user had to tab to find it, or click on the image (which the
// click handler counts as "anywhere"). Esc is the universal modal-close
// affordance.
// Phase 8a (H-4) — shortcuts overlay handle.
const shortcutsModal = $("shortcutsModal");
const closeShortcutsBtn = $("closeShortcutsBtn");
function showShortcuts() { shortcutsModal?.classList.remove("hidden"); }
function hideShortcuts() { shortcutsModal?.classList.add("hidden"); }
closeShortcutsBtn?.addEventListener("click", hideShortcuts);
shortcutsModal?.addEventListener("click", (e) => {
  if (e.target === shortcutsModal) hideShortcuts();
});

document.addEventListener("keydown", (e) => {
  // Phase 8a (H-4) — ⌘/ (Cmd-Slash on macOS, Ctrl-/ elsewhere) toggles
  // the keyboard-shortcuts overlay. Don't fire while user is typing in
  // a real text field — they may be typing a literal slash.
  if ((e.metaKey || e.ctrlKey) && e.key === "/") {
    const tag = (e.target?.tagName || "").toUpperCase();
    if (tag !== "INPUT" && tag !== "TEXTAREA") {
      if (shortcutsModal?.classList.contains("hidden")) showShortcuts();
      else hideShortcuts();
      e.preventDefault();
      return;
    }
  }
  // ⌘N (or Ctrl-N) → new chat. Same input-element guard.
  if ((e.metaKey || e.ctrlKey) && (e.key === "n" || e.key === "N")) {
    const tag = (e.target?.tagName || "").toUpperCase();
    if (tag !== "INPUT" && tag !== "TEXTAREA") {
      if (typeof newSession === "function") {
        newSession();
        e.preventDefault();
        return;
      }
    }
  }
  if (e.key !== "Escape") return;
  if (shortcutsModal && !shortcutsModal.classList.contains("hidden")) {
    hideShortcuts();
    e.preventDefault();
    return;
  }
  if (!lightboxEl.classList.contains("hidden")) {
    lightboxEl.classList.add("hidden");
    e.preventDefault();
    return;
  }
  if (!toolsModal.classList.contains("hidden")) {
    toolsModal.classList.add("hidden");
    e.preventDefault();
  }
});

// =====================================================================
// 18. Header title double-click rename
// =====================================================================

chatTitle.addEventListener("dblclick", async () => {
  if (!state.sessionId) { toast("Send a message first to name this chat", "info"); return; }
  const cur = state.title;
  const inp = el("input", {
    class: "title-edit",
    value: cur,
    style: { maxWidth: "420px" },
    onkeydown: async (e) => {
      if (e.key === "Enter") { e.preventDefault(); await commit(); }
      else if (e.key === "Escape") cancel();
    },
  });
  chatTitle.replaceWith(inp);
  inp.select(); inp.focus();
  let done = false;
  const cancel = () => { if (done) return; done = true; inp.replaceWith(chatTitle); chatTitle.textContent = cur; };
  const commit = async () => {
    if (done) return; done = true;
    const title = inp.value.trim();
    if (!title || title === cur) { inp.replaceWith(chatTitle); chatTitle.textContent = cur; return; }
    try {
      const r = await fetch(`/api/sessions/${state.sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!r.ok) throw new Error((await r.json()).error || r.statusText);
      setTitle(title);
      inp.replaceWith(chatTitle);
      await loadSessions();
      toast("Renamed", "success");
    } catch (e) {
      toast("Rename failed: " + e.message, "error");
      inp.replaceWith(chatTitle); chatTitle.textContent = cur;
    }
  };
  inp.addEventListener("blur", commit);
});

// =====================================================================
// 19. Composer: auto-resize + submit (with duplicate debounce)
// =====================================================================

function autoResize() {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 240) + "px";
}
inputEl.addEventListener("input", autoResize);

// Parallel-mode hint (Item 7). Fires on input change, debounced so we
// don't re-detect on every keystroke.
let parallelHintDebounce = null;
inputEl.addEventListener("input", () => {
  clearTimeout(parallelHintDebounce);
  parallelHintDebounce = setTimeout(() => {
    const text = inputEl.value.trim();
    if (text.length < 20) return; // too short to be a multi-entity task
    const hit = detectListyTask(text);
    if (hit) showParallelHint(hit.reason);
  }, 800);
});
inputEl.addEventListener("keydown", (e) => {
  // Enter submits. Shift+Enter (and ⌘/Ctrl+Enter) inserts a newline.
  if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
    // Allow IME composition to finish first (Japanese / Chinese input).
    if (e.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    composer.requestSubmit();
  }
  // Keep legacy ⌘/Ctrl+Enter as an explicit send too.
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    composer.requestSubmit();
  }
});

let lastSendSig = ""; let lastSendAt = 0;

// List-like-task detector (Item 7 — parallel-mode nudge). Triggers a
// soft hint when the prompt clearly operates on N independent entities,
// prompting the user to switch to parallel mode. Heuristic — false
// positives are cheap (just a hint) and easy to dismiss.
function detectListyTask(text) {
  if (!text || state.selectedMode === "parallel") return false;
  const t = text.toLowerCase();
  // Pattern 1: N comma-separated all-caps vendor codes (≥3)
  const vendorCodes = (text.match(/\b[A-Z0-9]{4,6}\b/g) || []).filter((c) => /^[A-Z0-9]+$/.test(c));
  if (vendorCodes.length >= 3) return { reason: `${vendorCodes.length} vendor-like codes` };
  // Pattern 2: phrases like "for each", "all five", "each of these"
  if (/\b(for each|each of|all (five|ten|\d{1,3})|across all|per (vendor|asin|sku|account))\b/.test(t)) {
    return { reason: "per-item phrasing" };
  }
  // Pattern 3: comma-separated list of ≥3 distinct proper nouns
  const listItems = text.split(/[,;\n]/).map((s) => s.trim()).filter((s) => s.length > 2 && s.length < 80);
  if (listItems.length >= 4 && listItems.filter((s) => /^[A-Z]/.test(s)).length >= 3) {
    return { reason: `${listItems.length} list items` };
  }
  return false;
}

function showParallelHint(reason) {
  // Don't stack hints.
  if (document.querySelector(".parallel-hint")) return;
  const hint = el("div", { class: "parallel-hint" });
  hint.appendChild(el("span", {}, "⚡⚡ "));
  hint.appendChild(document.createTextNode(`Parallel mode likely faster (${reason}). `));
  hint.appendChild(el("button", {
    type: "button",
    class: "parallel-hint-btn",
    onclick: () => {
      if (state.selectedMode !== "parallel") modeToggle.click();
      hint.remove();
    },
  }, "Switch to parallel"));
  hint.appendChild(el("button", {
    type: "button",
    class: "parallel-hint-dismiss",
    onclick: () => hint.remove(),
    title: "Dismiss",
  }, "×"));
  composer.insertBefore(hint, composer.firstChild);
  setTimeout(() => hint.remove(), 15000);
}

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if ((!text && !state.pendingAttachments.length) || isStreaming()) return;
  // Phase U13 — slash-command interception. Lines starting with "/" are
  // routed to the command registry instead of the agent. Frontend-side
  // commands (/reset, /stop, etc.) handle locally; server-side commands
  // (/personality <name>, /usage, /personalities) hit /api/commands/run.
  if (text.startsWith("/")) {
    runSlashCommand(text);
    inputEl.value = ""; autoResize();
    return;
  }
  const sig = text + "|" + state.pendingAttachments.map((a) => a.id || a.path || a.name).join(",");
  const now = Date.now();
  if (sig === lastSendSig && now - lastSendAt < 3000) {
    toast("Already sent — waiting for a response", "info");
    return;
  }
  lastSendSig = sig; lastSendAt = now;
  inputEl.value = ""; autoResize();
  sendMessage(text);
});

// Phase U13 — slash-command runner. Keeps registry knowledge in sync
// with /api/commands by fetching the catalog once on first use; falls
// back to local command names when the network is unavailable.
let _commandCatalog = null;
async function _ensureCommandCatalog() {
  if (_commandCatalog) return _commandCatalog;
  try {
    const r = await fetch("/api/commands?scope=browser");
    if (!r.ok) throw new Error(`status ${r.status}`);
    const j = await r.json();
    _commandCatalog = j.commands || [];
  } catch (e) {
    _commandCatalog = [];
  }
  return _commandCatalog;
}

// ============================================================
// Phase 8a · H-2 — slash-command autocomplete
// ============================================================
//
// As soon as the user types `/` at the start of the composer (with
// optional partial command name after), we render a popover above the
// composer listing matching commands from /api/commands. Arrow-keys
// move the highlight; Enter selects; Esc dismisses; Tab also accepts.
// Picking a command replaces the composer text with `/<name> ` so the
// user can immediately type the args. No autocomplete fires once the
// user has typed past the first whitespace (the catalog is name-only).
//
// Designed to be cheap: catalog is fetched once and cached; filtering
// is a substring match over the in-memory list.

let _slashPop = null;
let _slashSelIdx = 0;
let _slashFiltered = [];

function _hideSlashPop() {
  if (_slashPop) { _slashPop.remove(); _slashPop = null; }
  _slashFiltered = [];
  _slashSelIdx = 0;
}

function _renderSlashPop(filtered) {
  const wrap = composer.parentElement; // .composer-wrap
  if (!_slashPop) {
    _slashPop = el("div", { class: "slash-pop", role: "listbox" });
    wrap.appendChild(_slashPop);
  }
  _slashPop.replaceChildren();
  filtered.forEach((c, i) => {
    const row = el("div", {
      class: "slash-pop-row" + (i === _slashSelIdx ? " sel" : ""),
      role: "option",
      onclick: () => _acceptSlashCommand(c),
      onmouseenter: () => {
        _slashSelIdx = i;
        for (const r of _slashPop.children) r.classList.remove("sel");
        row.classList.add("sel");
      },
    });
    row.appendChild(el("span", { class: "slash-pop-name" }, "/" + c.name));
    if (c.args) row.appendChild(el("span", { class: "slash-pop-args" }, c.args));
    if (c.description) row.appendChild(el("span", { class: "slash-pop-desc" }, c.description));
    _slashPop.appendChild(row);
  });
}

function _acceptSlashCommand(c) {
  if (!c) return;
  const argsHint = c.args ? " " : " ";
  inputEl.value = "/" + c.name + argsHint;
  inputEl.focus();
  _hideSlashPop();
  autoResize();
}

async function _maybeShowSlashPop() {
  const v = inputEl.value;
  // Only trigger when the input STARTS with `/` and contains no
  // whitespace yet (i.e. user is still typing the command name).
  const m = /^\/([\w-]*)$/.exec(v);
  if (!m) { _hideSlashPop(); return; }
  const prefix = m[1].toLowerCase();
  const catalog = await _ensureCommandCatalog();
  const filtered = catalog
    .filter((c) => !prefix || c.name.toLowerCase().startsWith(prefix))
    .slice(0, 12);
  if (!filtered.length) { _hideSlashPop(); return; }
  _slashFiltered = filtered;
  if (_slashSelIdx >= filtered.length) _slashSelIdx = 0;
  _renderSlashPop(filtered);
}

inputEl.addEventListener("input", () => { _maybeShowSlashPop().catch(() => {}); });
inputEl.addEventListener("blur", () => {
  // Defer so a click on a row still fires.
  setTimeout(_hideSlashPop, 120);
});
inputEl.addEventListener("keydown", (e) => {
  if (!_slashPop || !_slashFiltered.length) return;
  if (e.key === "Escape") { _hideSlashPop(); e.preventDefault(); return; }
  if (e.key === "ArrowDown") {
    _slashSelIdx = (_slashSelIdx + 1) % _slashFiltered.length;
    _renderSlashPop(_slashFiltered);
    e.preventDefault();
    return;
  }
  if (e.key === "ArrowUp") {
    _slashSelIdx = (_slashSelIdx - 1 + _slashFiltered.length) % _slashFiltered.length;
    _renderSlashPop(_slashFiltered);
    e.preventDefault();
    return;
  }
  if (e.key === "Enter" || e.key === "Tab") {
    _acceptSlashCommand(_slashFiltered[_slashSelIdx]);
    e.preventDefault();
    return;
  }
});

async function runSlashCommand(line) {
  const m = line.trim().match(/^\/(\w[\w-]*)\s*(.*)$/);
  if (!m) {
    toast("Bad command — use /<name> [args]", "error");
    return;
  }
  const name = m[1];
  const args = m[2] || "";
  const catalog = await _ensureCommandCatalog();
  const cmd = catalog.find((c) => c.name === name);
  // Frontend-side handlers — short-circuit before any HTTP.
  if (name === "help" || (cmd && !cmd.serverSide && name === "help")) {
    const lines = catalog.length
      ? catalog.map((c) => `  /${c.name}${c.args ? " " + c.args : ""} — ${c.description}`).join("\n")
      : "(catalog unavailable)";
    toast("Slash commands:\n" + lines, "info");
    return;
  }
  if (name === "new") {
    if (typeof newSession === "function") newSession();
    else location.reload();
    return;
  }
  if (name === "reset") {
    // F-9: if a stream is in flight, abort it BEFORE wiping the DOM.
    // Pre-fix the consumer kept holding `activeBubble` references and
    // mutating an orphaned subtree on every text_delta; the composer
    // also stayed stuck on Stop because setStreaming(false) never
    // fired. Aborting forces the catch path → finalizeCaret →
    // setStreaming(false) before we remove the turns.
    if (isStreaming() && state.abort) {
      try { state.abort.abort(); } catch {}
    }
    document.querySelectorAll(".turn").forEach((n) => n.remove());
    toast("Cleared transcript locally — server session unchanged.", "info");
    return;
  }
  if (name === "stop") {
    if (typeof stopBtn !== "undefined") stopBtn.click();
    return;
  }
  if (name === "model") {
    if (!args) { toast(`Current model: ${state.preferredModel || modelSelect?.value || "?"}`, "info"); return; }
    const sel = document.querySelector("#modelSelect");
    if (sel) {
      const matches = [...sel.options].find((o) => o.value === args || o.textContent.toLowerCase().includes(args.toLowerCase()));
      if (matches) {
        sel.value = matches.value;
        sel.dispatchEvent(new Event("change"));
        toast(`Model → ${matches.textContent}`, "info");
      } else {
        toast(`No model matched "${args}". Try haiku / sonnet / opus.`, "error");
      }
    }
    return;
  }
  if (cmd && cmd.serverSide) {
    try {
      const r = await fetch("/api/commands/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, args }),
      });
      const j = await r.json();
      if (!r.ok) toast(`/${name} failed: ${j.error || r.status}`, "error");
      else toast(`/${name}: ${JSON.stringify(j).slice(0, 240)}`, "info");
    } catch (e) {
      toast(`/${name} request failed: ${e.message}`, "error");
    }
    return;
  }
  toast(`Unknown command "/${name}". Try /help.`, "error");
}
stopBtn.addEventListener("click", async () => {
  // Fire an explicit server-side stop so the agent loop + Bedrock stream
  // + in-flight MCP tool calls are torn down. Socket close alone doesn't do
  // this anymore — that path is reserved for browser refresh / tab-close,
  // which should keep the run going so /stream-tail can resume it.
  const sid = state.sessionId;
  if (sid) {
    try {
      const r = await fetch(`/api/sessions/${sid}/stop`, { method: "POST" });
      if (r.status === 404) {
        // Phase 2: soft feedback when user clicks Stop after the run already
        // ended. Previously swallowed silently, leaving the UI unchanged.
        toast("Nothing to stop — the run already finished.", "info");
      } else if (!r.ok) {
        toast(`Stop failed (${r.status})`, "error");
      }
    } catch (e) {
      // Network blip — local abort still fires below.
    }
  }
  // Also abort the local fetch so the UI reacts instantly instead of
  // waiting for the server's `{type:"aborted"}` event to round-trip.
  if (state.abort) { state.abort.abort(); state.abort = null; }
});
newChatBtn.addEventListener("click", newSession);

// =====================================================================
// 20. Streaming pipeline (SSE)
// =====================================================================

/**
 * Build a consumer bound to a specific assistant turn. Returns a function
 * that takes one SSE event (already JSON-parsed) and mutates the turn.
 * The same consumer is used for:
 *   - Live /api/chat streams (events arrive via fetch body reader)
 *   - Resume tail (/api/sessions/:id/stream-tail) where events are replayed
 *     from the server's on-disk stream log.
 *
 * Because the consumer owns mutable local state (textBuffer, toolCards,
 * subtasks …), each assistant turn needs its own instance.
 */
function makeStreamConsumer(assistantTurn) {
  const activeBubble = assistantTurn._body;
  const activeTurn = assistantTurn;
  let textBuffer = "";
  let textContainer = null;
  const toolCards = new Map();
  let sawFirstText = false;
  const subtasks = new Map();

  const finalizeCaret = () => {
    // G-1: drain any pending rAF flush synchronously so the final
    // delta lands before the caret is removed. Without this the
    // last few tokens could remain unrendered if finalize fires in
    // the same frame as the queued rAF.
    if (flushScheduled) flushTextSync();
    if (textContainer) textContainer.classList.remove("caret");
  };

  // G-1 / G-2: rAF-throttled markdown flush. Pre-fix every text_delta
  // (~30/sec during streaming) ran the full marked → DOMPurify → hljs
  // pipeline + a `.code-copy` re-creation pass over every <pre>. With
  // long responses the main thread couldn't keep up — visible jitter
  // and dropped frames. Now we coalesce all deltas that arrived during
  // the same animation frame into a single render.
  let flushScheduled = false;
  const _doFlush = () => {
    flushScheduled = false;
    if (!textBuffer) return;
    if (!textContainer) {
      textContainer = el("div", { class: "prose-live caret" });
      activeBubble.appendChild(textContainer);
    }
    textContainer.classList.add("caret");
    textContainer.innerHTML = renderMarkdown(textBuffer);
    // G-2: only attach copy buttons to <pre>s that don't already have
    // one. The innerHTML reassignment above wipes the previous DOM, so
    // every <pre> needs a fresh button — but the loop is bounded by
    // the number of code blocks rendered this frame, not the number
    // of token deltas that arrived during this frame.
    for (const pre of textContainer.querySelectorAll("pre")) {
      if (pre.querySelector(".code-copy")) continue;
      const btn = el("button", {
        class: "code-copy",
        onclick: async (ev) => {
          ev.stopPropagation();
          const code = pre.querySelector("code")?.innerText || "";
          try {
            await navigator.clipboard.writeText(code);
            // Phase 7b — copy morph: text + checkmark + green tint via .copied.
            btn.textContent = "✓ copied";
            btn.classList.add("copied");
            setTimeout(() => {
              btn.textContent = "copy";
              btn.classList.remove("copied");
            }, 1200);
          } catch {}
        },
      }, "copy");
      pre.style.position = "relative";
      pre.appendChild(btn);
    }
    stickyScroll();
  };
  const flushText = () => {
    if (flushScheduled) return;
    flushScheduled = true;
    requestAnimationFrame(_doFlush);
  };
  // Expose a synchronous variant for finalisation paths that need the
  // last delta to land before the consumer is torn down.
  const flushTextSync = _doFlush;

  function handle(ev) {
    switch (ev.type) {
      case "model_info": {
        const modelName = (ev.model || "").replace(/^us\.anthropic\./, "") || "unknown";
        const tag = ev.resumed ? `⟲ resumed from iter ${ev.resumedFromIteration}` :
                    ev.mode === "parallel" ? "⚡⚡ parallel" : "⚡";
        activeBubble.appendChild(el("div", { class: "model-info-chip" },
          tag, " ", modelName));
        break;
      }
      case "heartbeat": {
        // Progress strip — single slot, always supersede.
        activeBubble.querySelectorAll(".heartbeat-strip").forEach((n) => n.remove());
        const mins = Math.floor((ev.elapsedSec || 0) / 60);
        const secs = (ev.elapsedSec || 0) % 60;
        const elapsed = mins > 0 ? `${mins}m${secs.toString().padStart(2,"0")}s` : `${secs}s`;
        const mcps = Array.isArray(ev.mcpsActive) ? ev.mcpsActive.filter((m) => !["memory","skills","shell-agent","filesystem-agent","ares-actions"].includes(m)) : [];
        const parts = [`iter ${ev.iteration}`, `${elapsed} elapsed`];
        if (ev.activeToolName) parts.push(`running ${ev.activeToolName}`);
        if (mcps.length) parts.push(`${mcps.length} MCP${mcps.length > 1 ? "s" : ""} active`);
        activeBubble.appendChild(el("div", { class: "heartbeat-strip" },
          el("span", { class: "heartbeat-dot" }),
          parts.join(" · ")));
        stickyScroll();
        break;
      }
      case "credentials_refreshing": {
        activeBubble.querySelectorAll(".cred-refresh-chip").forEach((n) => n.remove());
        activeBubble.appendChild(el("div", { class: "cred-refresh-chip" },
          "🔄 refreshing AWS credentials (", ev.minutesLeft, " min left)"));
        // Auto-clear after 6 s — refresh is normally sub-second.
        setTimeout(() => activeBubble.querySelectorAll(".cred-refresh-chip").forEach((n) => n.remove()), 6000);
        break;
      }
      case "stalled": {
        activeBubble.appendChild(el("div", { class: "stall-chip" },
          `⚠ stalled — no progress for ${ev.iterations} iterations. Nudging…`));
        stickyScroll();
        break;
      }
      case "tool_loop_warning": {
        // RP1-B5 — soft warn the user that the agent is stuck on the
        // same tool shape. Hard-fail comes via a later 'error' event.
        activeBubble.appendChild(el("div", { class: "stall-chip", style: "color:#d4a017" },
          `⚠ ${ev.tool} called ${ev.hits}× with same input shape; ${ev.successCount} useful results. Consider a different approach.`));
        stickyScroll();
        break;
      }
      case "text_delta": {
        sawFirstText = true;
        setTurnStatus(activeTurn, "streaming");
        markThinkingDone(activeBubble);
        textBuffer += ev.text;
        flushText();
        break;
      }
      case "tool_call": {
        setTurnStatus(activeTurn, "thinking");
        if (textContainer) {
          textContainer.classList.remove("caret");
          textContainer = null;
          textBuffer = "";
        }
        const card = addToolCard(activeBubble, ev.name, ev.input || {});
        toolCards.set(ev.id, card);
        card.__name = ev.name;
        if (/^ares_(activate|deactivate)_mcp$/.test(ev.name || "")) {
          setTimeout(() => { loadMcps().catch(() => {}); loadHealth().catch(() => {}); }, 400);
        }
        break;
      }
      case "tool_result": {
        const card = toolCards.get(ev.id);
        if (card) setToolCardResult(card, ev.output, ev.isError);
        if (/^ares_(activate|deactivate)_mcp$/.test(card?.__name || "")) {
          loadMcps().catch(() => {}); loadHealth().catch(() => {});
        }
        break;
      }
      case "iteration": {
        setTurnStatus(activeTurn, sawFirstText ? "streaming" : "thinking");
        getOrCreateThinkingBubble(activeBubble);
        break;
      }
      case "context_compressed": {
        const fmt = (n) => typeof n === "number" ? n.toLocaleString() : "?";
        let label = `📦 Context compressed: ${ev.originalCount} → ${ev.compressedCount} msgs`;
        if (typeof ev.originalTokens === "number" && typeof ev.compressedTokens === "number") {
          const max = ev.bedrockMax || 200000;
          const pct = Math.round((ev.compressedTokens / max) * 100);
          label += ` · ${fmt(ev.originalTokens)} → ${fmt(ev.compressedTokens)} tok (${pct}% of ${fmt(max)})`;
          updateCtxMeter(ev.compressedTokens, max);
        }
        if (ev.autoRecover) {
          label = `🛟 Auto-recover (attempt ${ev.attempt}): Bedrock saw ${fmt(ev.observed)} tok, recompressing... ${ev.compressedTokens != null ? "→ " + fmt(ev.compressedTokens) + " tok" : ""}`;
        } else if (ev.midRun) {
          label = `↻ ${label.slice(2)} · mid-run safety`;
        }
        const cls = ev.autoRecover ? "model-info-chip mid-run" : (ev.midRun ? "model-info-chip mid-run" : "model-info-chip");
        activeBubble.appendChild(el("div", { class: cls }, label));
        break;
      }
      case "token_budget": {
        updateCtxMeter(ev.tokens, ev.bedrockMax || 200000, ev.soft, ev.hard);
        break;
      }
      case "approval_required": {
        // Phase U06 — render an inline confirmation card. The agent loop
        // is paused waiting on POST /api/sessions/:id/approve|deny.
        // F-1: was passing `activeSessionId` (undefined) — kills the
        // SSE consumer with ReferenceError on every high-risk call.
        // B-21: forward the approvalId so the card can include it in
        // the approve/deny request body, defending against stale-tab
        // replay if the user has multiple tabs open.
        const card = renderApprovalCard(ev, state.sessionId);
        // Track by approvalId so approval_resolved can update / dispose it.
        card.dataset.approvalId = ev.approvalId;
        activeBubble.appendChild(card);
        stickyScroll();
        break;
      }
      case "approval_resolved": {
        const card = activeBubble.querySelector(`.approval-card[data-approval-id="${ev.approvalId}"]`);
        if (card) {
          card.classList.add("resolved", ev.decision);
          const stamp = el("div", { class: "approval-card-stamp" },
            ev.decision === "approve" ? "✓ Approved" : `✗ Denied${ev.reason ? ` (${ev.reason})` : ""}`);
          // Replace the action row with the stamp so the buttons disappear.
          const actions = card.querySelector(".approval-card-actions");
          if (actions) actions.replaceWith(stamp);
        }
        break;
      }
      case "session_rag_hit": {
        const seqs = Array.isArray(ev.seqs) ? ev.seqs.slice(0, 6).join(", #") : "";
        activeBubble.appendChild(el("div", { class: "model-info-chip" },
          `🔎 Recalled ${ev.count} earlier turn${ev.count === 1 ? "" : "s"} from session memory · #${seqs}`));
        break;
      }
      case "orchestrator_status": {
        const map = {
          decomposing:      "🧩 Decomposing task into subtasks…",
          executing:        "⚡ Running sub-agents in parallel…",
          synthesizing:     "🔗 Synthesizing results…",
          fallback_single:  "↩ Single-agent fallback",
        };
        activeBubble.querySelectorAll(".orch-status").forEach((n) => n.remove());
        activeBubble.appendChild(el("div", { class: "orch-status" },
          el("span", { class: "thinking-dots" }, el("span"), el("span"), el("span")),
          map[ev.status] || ev.status));
        stickyScroll();
        break;
      }
      case "orchestrator_plan": {
        const plan = el("div", { class: "orch-plan" });
        plan.appendChild(el("div", { class: "orch-plan-head" },
          `📋 Plan: ${ev.subtasks.length} parallel subtask${ev.subtasks.length > 1 ? "s" : ""}`));
        const grid = el("div", { class: "orch-plan-grid" });
        for (const st of ev.subtasks) {
          grid.appendChild(el("div", { class: "orch-plan-item" },
            el("div", { class: "t" }, st.title),
            el("div", { class: "m" }, `model: ${st.model}`)));
        }
        plan.appendChild(grid);
        activeBubble.appendChild(plan);
        stickyScroll();
        break;
      }
      case "subtask_start": {
        const section = el("div", { class: "subtask-section" });
        section.appendChild(el("div", { class: "subtask-title" },
          el("span", { class: "subtask-dot" }),
          `Agent: ${ev.title}`));
        const body = el("div", { class: "prose-chat", style: { fontSize: "14px" } });
        section.appendChild(body);
        activeBubble.appendChild(section);
        subtasks.set(ev.id, { section, body, textBuf: "", title: ev.title });
        stickyScroll();
        break;
      }
      case "subtask_event": {
        const sub = subtasks.get(ev.id);
        if (!sub) break;
        const sev = ev.event;
        if (sev?.type === "text_delta") {
          sub.textBuf += sev.text;
          // G-3: rAF-throttle the subtask body re-render. Each subtask
          // can stream hundreds of tokens; pre-fix every delta did a
          // full markdown re-parse + DOMPurify pass.
          if (!sub._flushScheduled) {
            sub._flushScheduled = true;
            requestAnimationFrame(() => {
              sub._flushScheduled = false;
              sub.body.innerHTML = renderMarkdown(sub.textBuf);
              stickyScroll();
            });
          }
        } else if (sev?.type === "tool_call") {
          sub.body.appendChild(el("div", { class: "subtask-mini" },
            el("span", { class: "dot" }),
            `→ ${sev.name}`));
          stickyScroll();
          if (/^ares_(activate|deactivate)_mcp$/.test(sev.name || "")) {
            loadMcps().catch(() => {}); loadHealth().catch(() => {});
          }
        } else if (sev?.type === "tool_result") {
          const all = sub.body.querySelectorAll(".subtask-mini");
          const last = all[all.length - 1];
          if (last) last.classList.add("done");
          if (/^ares_(activate|deactivate)_mcp$/.test(sev.name || "")) {
            loadMcps().catch(() => {}); loadHealth().catch(() => {});
          }
        } else if (sev?.type === "error") {
          if (sev.kind === "credentials" || sev.needsAuth) {
            sub.body.appendChild(renderCredentialError(sev));
          } else {
            sub.body.appendChild(el("div", { class: "state-pill error" },
              "error: " + (sev.error || "")));
          }
        }
        break;
      }
      case "subtask_done": {
        const sub = subtasks.get(ev.id);
        if (sub) sub.section.classList.add("done");
        break;
      }
      case "subtask_error": {
        activeBubble.appendChild(el("div", { class: "state-pill error" },
          "Subtask error: " + (ev.error || "")));
        break;
      }
      case "error": {
        finalizeCaret();
        setTurnStatus(activeTurn, "error");
        if (ev.kind === "credentials" || ev.needsAuth) {
          activeBubble.appendChild(renderCredentialError(ev));
        } else {
          activeBubble.appendChild(el("div", { class: "state-pill error" },
            "⚠ " + (ev.error || "error")));
        }
        break;
      }
      case "aborted": {
        finalizeCaret();
        setTurnStatus(activeTurn, "interrupted");
        activeBubble.appendChild(el("div", { class: "state-pill interrupted" },
          "Generation stopped."));
        break;
      }
      case "premature_stop": {
        // RP1-B1 — agent gave up after 3 nudges. Render a distinct
        // pill so the user knows the run is incomplete and not a
        // clean finish.
        finalizeCaret();
        setTurnStatus(activeTurn, "interrupted");
        activeBubble.querySelectorAll(".stall-chip").forEach((n) => n.remove());
        activeBubble.appendChild(el("div", { class: "state-pill interrupted" },
          "agent stopped without finishing — user action needed"));
        break;
      }
      case "done":
      case "end": {
        finalizeCaret();
        setTurnStatus(activeTurn, "complete");
        markThinkingDone(activeBubble);
        activeBubble.querySelectorAll(".orch-status").forEach((n) => n.remove());
        activeBubble.querySelectorAll(".heartbeat-strip").forEach((n) => n.remove());
        activeBubble.querySelectorAll(".cred-refresh-chip").forEach((n) => n.remove());
        activeBubble.querySelectorAll(".stall-chip").forEach((n) => n.remove());
        break;
      }
    }
  }

  return { handle, finalizeCaret };
}

async function sendMessage(text) {
  await ensureSession();
  localStorage.setItem("ares_active_session", state.sessionId);

  // Drop any pending resume-poll — this tab is driving the stream now.
  stopProgressPoll();

  // Capture the session id at run-start. The user is allowed to switch
  // sessions while this run is in flight; the run still belongs to the
  // session it was launched against, and we use runSessionId everywhere
  // below so we never accidentally end up updating a different session.
  const runSessionId = state.sessionId;
  setStreaming(runSessionId, true);
  state.activeReaders.add(runSessionId);
  syncComposerForCurrentSession();
  state.abort = new AbortController();

  // Render user turn + waiting assistant turn.
  const inner = ensureMessagesInner();
  const attsForUI = state.pendingAttachments.filter((a) => !a.uploading);
  const ut = renderUserTurn({
    role: "user",
    content: [{ type: "text", text }],
    _attachments: attsForUI,
  });
  if (ut) inner.appendChild(ut);

  const assistantTurn = createAssistantTurn({ status: "thinking" });
  inner.appendChild(assistantTurn);
  getOrCreateThinkingBubble(assistantTurn._body);
  stickyScroll();

  // F-3: register the sidebar refresh interval BEFORE the try block, but
  // clear it in `finally` so a synchronous throw before the fetch call
  // doesn't leak the timer. Pre-fix the clear was on the linear path
  // after the try/catch; if reqBody construction or any await chain
  // threw synchronously the interval kept polling.
  const sidebarRefresh = setInterval(() => loadSessions().catch(() => {}), 5000);

  const reqBody = {
    sessionId: runSessionId,
    message: text,
    attachments: attsForUI,
    model: modelSelect.value,
    mode: state.selectedMode,
    // Phase U16 — surface the platform so server.js can apply per-
    // platform tool filtering. Default "browser"; ?platform= overrides
    // (set by ares-app when loading the full window).
    platform: new URLSearchParams(location.search).get("platform") || "browser",
  };
  state.pendingAttachments = [];
  renderAttachmentChips();

  const { handle, finalizeCaret } = makeStreamConsumer(assistantTurn);

  try {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
        signal: state.abort.signal,
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const data = line.replace(/^data:\s*/, "").trim();
          if (!data) continue;
          let ev;
          try { ev = JSON.parse(data); } catch { continue; }
          handle(ev);
        }
      }
    } catch (err) {
      finalizeCaret();
      if (err.name === "AbortError") {
        setTurnStatus(assistantTurn, "interrupted");
        assistantTurn._body.appendChild(el("div", { class: "state-pill interrupted" }, "Generation stopped."));
        toast("Response stopped", "info");
      } else {
        setTurnStatus(assistantTurn, "error");
        assistantTurn._body.appendChild(el("div", { class: "state-pill error" }, "⚠ " + err.message));
        toast("Chat failed: " + err.message, "error");
      }
    }

    finalizeCaret();
    setStreaming(runSessionId, false);
    state.activeReaders.delete(runSessionId);
    syncComposerForCurrentSession();
    state.abort = null;

    addFeedbackBar(assistantTurn, text);
    maybeAutoTitle();
    loadSessions().catch(() => {});
    loadHealth().catch(() => {});
  } finally {
    clearInterval(sidebarRefresh);
  }
}

function ensureMessagesInner() {
  let inner = messagesEl.querySelector(":scope > .messages-inner");
  if (!inner) {
    messagesEl.innerHTML = "";
    inner = el("div", { class: "messages-inner" });
    messagesEl.appendChild(inner);
  } else {
    // If we're on the welcome screen, wipe it.
    if (inner.querySelector(".welcome")) inner.innerHTML = "";
  }
  return inner;
}

// =====================================================================
// 21. Feedback bar
// =====================================================================

function addFeedbackBar(assistantTurn, contextText) {
  if (!assistantTurn) return;
  const body = assistantTurn._body;
  if (!body || body.querySelector(".feedback-bar")) return;
  const bar = el("div", { class: "feedback-bar" });
  const up = el("button", {
    class: "feedback-btn up",
    type: "button",
    title: "Good response",
  }, "👍");
  const down = el("button", {
    class: "feedback-btn down",
    type: "button",
    title: "Bad response",
  }, "👎");
  async function submit(rating, which) {
    up.disabled = true; down.disabled = true;
    which.classList.add("selected");
    try {
      await fetch(`/api/sessions/${state.sessionId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, context: contextText }),
      });
      toast("Thanks for the feedback", "success");
    } catch (e) { toast("Feedback failed: " + e.message, "error"); }
  }
  up.addEventListener("click", () => submit("positive", up));
  down.addEventListener("click", () => submit("negative", down));
  bar.appendChild(up); bar.appendChild(down);
  body.appendChild(bar);
  setTimeout(() => bar.classList.add("visible"), 400);
}

async function maybeAutoTitle() {
  if (!state.sessionId) return;
  try {
    const sess = await fetch(`/api/sessions/${state.sessionId}`).then((r) => r.json());
    const userCount = (sess.messages || []).filter(
      (m) => m.role === "user" && Array.isArray(m.content) && m.content.some((b) => b.type === "text")
    ).length;
    if (userCount !== 1) return;
    const list = await fetch("/api/sessions").then((r) => r.json());
    const mine = list.find((s) => s.id === state.sessionId);
    if (mine?.hasCustomTitle) return;
    const r = await fetch(`/api/sessions/${state.sessionId}/auto-title`, { method: "POST" });
    if (!r.ok) return;
    const { title } = await r.json();
    if (title) { setTitle(title); loadSessions(); }
  } catch {}
}

// =====================================================================
// 22. Live-progress resume — SSE tail from the server's stream log
//
// When a session is opened and the server reports `streamActive: true`,
// we connect to /api/sessions/:id/stream-tail which replays every SSE
// event that has been written to the on-disk log so far, then tails the
// live emitter for newly-written events until the stream ends.
//
// The effect is: on page refresh mid-stream the client sees character-
// level text_delta events and tool_call/tool_result cards appear in real
// time, exactly as if no refresh had happened. No periodic re-renders,
// no chunked snapshots.
//
// Fallback: if we end up on a session whose stream has already finished
// AND whose log file has already been deleted (i.e. the normal case for
// completed sessions), the tail endpoint closes immediately with a
// `tail_end` sentinel and we fall back to showing whatever is already
// rendered from renderSession(data).
// =====================================================================

function stopProgressPoll() {
  if (state.progressPoll) {
    try { state.progressPoll.abort?.abort(); } catch {}
    state.progressPoll = null;
    hideReconnectTurn();
  }
}

let reconnectTurn = null;
function showReconnectTurn() {
  if (reconnectTurn) return;
  const inner = ensureMessagesInner();
  const turn = createAssistantTurn({ status: "thinking" });
  turn._body.appendChild(el("div", { class: "reconnect-pill" },
    el("span", { class: "thinking-dots" }, el("span"), el("span"), el("span")),
    "reconnected — tailing live events…"));
  inner.appendChild(turn);
  reconnectTurn = turn;
  scrollToBottom();
}
function hideReconnectTurn() {
  if (reconnectTurn) { reconnectTurn.remove(); reconnectTurn = null; }
}

async function maybeResumeLiveProgress(data) {
  if (!data || !data.id) return;
  if (!data.streamActive) return;
  // Skip ONLY if a tail/sender is already actively reading for THIS session.
  // The previous global-abort check leaked across sessions: a still-open
  // fetch reader for session A would block reconnecting tail-resume for
  // session B. Now we key on per-session producers via state.activeReaders.
  if (state.activeReaders && state.activeReaders.has(data.id)) return;
  setStreaming(data.id, true);
  syncComposerForCurrentSession();
  await startTailResume(data.id);
}

async function startTailResume(sessionId) {
  stopProgressPoll();
  state.activeReaders.add(sessionId);

  // Create a fresh placeholder turn at the bottom — the consumer will
  // populate it as events arrive. We DO NOT re-render existing session
  // history (that's already on screen from renderSession). The tail only
  // drives the in-flight turn.
  const inner = ensureMessagesInner();
  const turn = createAssistantTurn({ status: "thinking" });
  getOrCreateThinkingBubble(turn._body);
  inner.appendChild(turn);
  reconnectTurn = turn;
  scrollToBottom();

  const { handle } = makeStreamConsumer(turn);
  const abort = new AbortController();
  state.progressPoll = { sessionId, abort };

  try {
    const res = await fetch(`/api/sessions/${sessionId}/stream-tail`, { signal: abort.signal });
    if (!res.ok) throw new Error("tail " + res.status);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!state.progressPoll || state.progressPoll.sessionId !== sessionId) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const data = line.replace(/^data:\s*/, "").trim();
        if (!data) continue;
        let entry;
        try { entry = JSON.parse(data); } catch { continue; }
        // The tail endpoint emits TWO shapes:
        //   { seq, ts, event } — a replayed or live stream event
        //   { type: "tail_end" } — sentinel meaning the server closed
        if (entry && entry.type === "tail_end") {
          break;
        }
        if (entry && entry.event) {
          handle(entry.event);
        }
      }
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      console.warn("[resume] tail failed:", err.message);
    }
  }

  // Stream ended — promote the placeholder turn to "complete" and clean up.
  if (state.progressPoll && state.progressPoll.sessionId === sessionId) {
    stopProgressPoll();
  }
  // Mark this session as no-longer-streaming. If it's the currently-viewed
  // session we re-enable the composer; otherwise the sidebar dot just clears.
  setStreaming(sessionId, false);
  state.activeReaders.delete(sessionId);
  if (state.sessionId === sessionId) syncComposerForCurrentSession();
  // Refresh sidebar / health so session position + tool counts update.
  loadSessions().catch(() => {});
  loadHealth().catch(() => {});

  // One final authoritative re-render from disk so we get the persisted
  // message array (including anything the server wrote after closeStreamLog).
  try {
    const fresh = await fetch(`/api/sessions/${sessionId}`).then((r) => r.json());
    if (state.sessionId === sessionId && fresh && fresh.messages) {
      renderSession(fresh);
    }
  } catch {}
}

// =====================================================================
// 23. Init
// =====================================================================

(async () => {
  await loadHealth();
  await loadSessions();
  await loadMcps();
  await loadModels();

  // F-2: centralise poll registration so handles are clearable on
  // `pagehide` and gated by document.visibilityState. Pre-fix the same
  // three intervals were registered in TWO branches (cached path + welcome
  // path) with no clear() and no visibility gating — they kept firing
  // while the tab was hidden, and the cached-path returns left the
  // welcome-path intervals registered on top of them on certain races.
  const _polls = [];
  function registerPoll(fn, intervalMs) {
    const handle = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      try { fn(); } catch {}
    }, intervalMs);
    _polls.push(handle);
    return handle;
  }
  function clearAllPolls() {
    for (const h of _polls) { try { clearInterval(h); } catch {} }
    _polls.length = 0;
  }
  // Tear down on tab close/refresh so a navigation doesn't leave a
  // detached document with live timers (Chrome will keep firing them
  // for a few minutes in the bfcache).
  window.addEventListener("pagehide", clearAllPolls, { once: true });

  const lastSessionId = localStorage.getItem("ares_active_session");
  let resumed = false;
  if (lastSessionId) {
    try {
      const r = await fetch(`/api/sessions/${lastSessionId}`);
      if (r.ok) {
        const data = await r.json();
        if (data.messages && data.messages.length > 0) {
          state.sessionId = lastSessionId;
          if (data.streamActive) setStreaming(lastSessionId, true);
          renderSession(data);
          syncComposerForCurrentSession();
          await loadSessions();
          maybeResumeLiveProgress(data);
          maybeOfferCheckpointResume(data);
          resumed = true;
        }
      }
    } catch {}
  }

  if (!resumed) renderWelcome();

  // Single poll registration site — runs in BOTH branches now.
  registerPoll(loadHealth, 10000);
  registerPoll(() => loadSessions().catch(() => {}), 4000);
  // Keep the MCP pane live too — running list and tool counts shift when
  // the agent activates/deactivates servers mid-run. 6s feels responsive
  // without spamming the hub status check.
  registerPoll(() => loadMcps().catch(() => {}), 6000);
})();
