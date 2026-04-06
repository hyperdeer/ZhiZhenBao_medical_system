/**
 * 医疗助手 Web：侧栏会话 + DeepSeek 式输入条（无深度思考开关）
 */

const MAX_USER_TURNS = 10;

const SIDEBAR_COLLAPSED_KEY = "medqa_sidebar_collapsed";

/** 医疗相关短问题池（≥20），每次随机展示 5 条 */
const MEDICAL_SUGGESTION_POOL = [
  "感冒发烧了要注意什么？",
  "如何预防过敏性鼻炎？",
  "长期熬夜有哪些危害？",
  "饭后多久运动更合适？",
  "维生素C能长期吃吗？",
  "眼睛干涩怎么缓解？",
  "怎样科学控制体重？",
  "颈椎病日常如何养护？",
  "高血压患者饮食注意啥？",
  "失眠了可以怎么调整？",
  "胃不舒服该做哪些检查？",
  "春季过敏怎么防护？",
  "小朋友发烧何时该就医？",
  "高血脂生活中注意什么？",
  "糖尿病前期能逆转吗？",
  "便秘怎么改善更安全？",
  "备孕需要补充叶酸吗？",
  "体检报告异常怎么看？",
  "甲减要终身服药吗？",
  "尿酸高饮食上忌什么？",
  "偏头痛发作时怎么办？",
  "慢性胃炎如何调理？",
  "肩痛要警惕什么问题？",
  "皮肤瘙痒可能原因？",
];

function pickRandomSuggestions(count) {
  const copy = MEDICAL_SUGGESTION_POOL.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function renderWelcomeSuggestions() {
  const root = document.getElementById("welcomeSuggestions");
  if (!root) return;
  root.innerHTML = "";
  pickRandomSuggestions(5).forEach((text) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suggestion-chip";
    btn.textContent = text;
    btn.addEventListener("click", () => {
      els.inputText.value = text;
      els.inputText.dispatchEvent(new Event("input", { bubbles: true }));
      if (typeof autoResize === "function") autoResize();
      void sendMessage();
    });
    root.appendChild(btn);
  });
}

const els = {
  app: document.querySelector(".app"),
  btnNewChat: document.getElementById("btnNewChat"),
  chatHistory: document.getElementById("chatHistory"),
  welcomeStage: document.getElementById("welcomeStage"),
  threadWrap: document.getElementById("threadWrap"),
  threadScroll: document.getElementById("threadScroll"),
  main: document.querySelector(".main"),
  mainTitle: document.getElementById("mainTitle"),
  inputText: document.getElementById("inputText"),
  btnSend: document.getElementById("btnSend"),
  btnAttach: document.getElementById("btnAttach"),
  fileInput: document.getElementById("fileInput"),
  imagePreviewRow: document.getElementById("imagePreviewRow"),
  imageThumb: document.getElementById("imageThumb"),
  btnRemoveImage: document.getElementById("btnRemoveImage"),
  btnOpenSidebar: document.getElementById("btnOpenSidebar"),
  sidebarBackdrop: document.getElementById("sidebarBackdrop"),
  sidebar: document.querySelector(".sidebar"),
  btnCollapseSidebar: document.getElementById("btnCollapseSidebar"),
  btnExpandSidebar: document.getElementById("btnExpandSidebar"),
  btnNewChatCompact: document.getElementById("btnNewChatCompact"),
  collapsedToolbar: document.getElementById("collapsedToolbar"),
};

function isDesktopLayout() {
  return typeof window.matchMedia === "function" && window.matchMedia("(min-width: 769px)").matches;
}

function applySidebarCollapsedUi(collapsed) {
  const tb = els.collapsedToolbar;
  if (tb) {
    tb.setAttribute("aria-hidden", collapsed ? "false" : "true");
  }
}

function setSidebarCollapsed(collapsed) {
  if (!els.app) return;
  if (!isDesktopLayout()) {
    els.app.classList.remove("sidebar-collapsed");
    applySidebarCollapsedUi(false);
    return;
  }
  els.app.classList.toggle("sidebar-collapsed", collapsed);
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch (_) {
    /* ignore */
  }
  applySidebarCollapsedUi(collapsed);
}

function readInitialSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch (_) {
    return false;
  }
}

/** @type {{ id: string, title: string, messages: {role: string, content: string, image?: string|null}[] }[]} */
let sessions = [];
let activeId = null;
let pendingImageDataUrl = null;
/** @type {Map<string, { startedAt: number }>} */
const inflightBySession = new Map();
let shouldAutoFollow = true;

function uid() {
  return "s_" + Math.random().toString(36).slice(2, 12);
}

function getActiveSession() {
  return sessions.find((s) => s.id === activeId) || null;
}

function saveSessions() {
  try {
    const slim = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      messages: s.messages.map((m) => ({
        role: m.role,
        content: m.content,
        image: m.image || undefined,
      })),
    }));
    localStorage.setItem("medqa_sessions", JSON.stringify(slim));
    localStorage.setItem("medqa_active", activeId || "");
  } catch (_) {
    /* ignore */
  }
}

function loadSessions() {
  try {
    const raw = localStorage.getItem("medqa_sessions");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      sessions = parsed.map((s) => ({
        id: s.id || uid(),
        title: s.title || "新对话",
        messages: Array.isArray(s.messages) ? s.messages : [],
      }));
    }
    activeId = localStorage.getItem("medqa_active") || null;
    if (activeId && !sessions.some((s) => s.id === activeId)) activeId = null;
  } catch (_) {
    sessions = [];
    activeId = null;
  }
}

function renderHistoryList() {
  els.chatHistory.innerHTML = "";
  sessions.forEach((s) => {
    const li = document.createElement("li");
    li.className = "chat-history-item";
    li.dataset.id = s.id;
    if (s.id === activeId) li.classList.add("active");

    const titleEl = document.createElement("span");
    titleEl.className = "chat-history-title";
    titleEl.textContent = s.title;

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "chat-history-del";
    delBtn.title = "删除对话";
    delBtn.setAttribute("aria-label", "删除对话");
    delBtn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"/></svg>';
    delBtn.addEventListener("click", (e) => deleteSession(s.id, e));

    li.appendChild(titleEl);
    li.appendChild(delBtn);
    li.addEventListener("click", () => selectSession(s.id));
    els.chatHistory.appendChild(li);
  });
}

function deleteSession(id, ev) {
  if (ev) ev.stopPropagation();
  if (!confirm("确定删除这条对话？无法恢复。")) return;

  const wasActive = activeId === id;
  sessions = sessions.filter((s) => s.id !== id);

  if (sessions.length === 0) {
    newSession();
    return;
  }

  if (wasActive) {
    selectSession(sessions[0].id);
  } else {
    renderHistoryList();
    saveSessions();
  }
}

function updateMainTitle() {
  const s = getActiveSession();
  els.mainTitle.textContent = s ? s.title : "医疗助手";
}

function refreshComposerState() {
  const s = getActiveSession();
  const busy = !!(s && inflightBySession.has(s.id));
  els.btnSend.disabled = busy;
  els.inputText.placeholder = busy ? "该会话正在生成回复，可切换到其他会话继续提问" : "给 医疗助手 发送消息";
}

function setChattingLayout(on) {
  els.welcomeStage.classList.toggle("hidden", on);
  els.threadWrap.classList.toggle("hidden", !on);
  els.main.classList.toggle("chatting", on);
  if (!on) renderWelcomeSuggestions();
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

/**
 * 去掉行首 Markdown ATX 标题标记（# ～ ######），避免界面显示字面 ###。
 */
function stripAtxHeadingLine(line) {
  const m = line.match(/^\s{0,3}(#{1,6})(?:\s+(.*))?$/);
  if (!m) return line;
  if (m[2] != null) return m[2];
  return "";
}

/** 流式开始前：占位三点，提示模型正在工作 */
function setTypingIndicator(bubble) {
  bubble.innerHTML =
    '<div class="typing-indicator" role="status" aria-live="polite" aria-busy="true" aria-label="正在生成回复">' +
    "<span class=\"typing-dot\"></span><span class=\"typing-dot\"></span><span class=\"typing-dot\"></span>" +
    "</div>";
}

/** 极简 markdown：换行、**粗体**、去掉标题前缀 # */
function formatAssistantText(text) {
  const lines = text.split("\n");
  return lines
    .map((line) => {
      const plain = stripAtxHeadingLine(line);
      let h = escapeHtml(plain);
      h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      return `<p class="md-p">${h || "&nbsp;"}</p>`;
    })
    .join("");
}

function isThreadNearBottom() {
  const gap = els.threadScroll.scrollHeight - (els.threadScroll.scrollTop + els.threadScroll.clientHeight);
  return gap <= 24;
}

function renderThread(options = {}) {
  const forceScroll = !!options.forceScroll;
  const s = getActiveSession();
  const prevTop = els.threadScroll.scrollTop;
  els.threadScroll.innerHTML = "";
  if (!s || !s.messages.length) return;

  const inner = document.createElement("div");
  inner.className = "thread-inner";

  s.messages.forEach((m) => {
    const row = document.createElement("div");
    row.className = "msg " + (m.role === "user" ? "msg-user" : "msg-assistant");
    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";

    if (m.role === "user") {
      if (m.image) {
        const img = document.createElement("img");
        img.src = m.image;
        img.className = "msg-user-img";
        img.alt = "用户上传";
        bubble.appendChild(img);
      }
      bubble.appendChild(document.createTextNode(m.content || ""));
    } else {
      if (m.streaming && !m.content) {
        setTypingIndicator(bubble);
      } else {
        bubble.innerHTML = formatAssistantText(m.content || "");
      }
    }

    row.appendChild(bubble);
    inner.appendChild(row);
  });

  els.threadScroll.appendChild(inner);
  if (forceScroll || shouldAutoFollow) {
    els.threadScroll.scrollTop = els.threadScroll.scrollHeight;
  } else {
    els.threadScroll.scrollTop = prevTop;
  }
}

function selectSession(id) {
  activeId = id;
  pendingImageDataUrl = null;
  els.imagePreviewRow.classList.add("hidden");
  renderHistoryList();
  updateMainTitle();
  const s = getActiveSession();
  if (s && s.messages.length) {
    setChattingLayout(true);
    renderThread({ forceScroll: true });
  } else {
    setChattingLayout(false);
  }
  refreshComposerState();
  closeSidebarMobile();
  saveSessions();
}

function newSession() {
  const id = uid();
  sessions.unshift({ id, title: "新对话", messages: [] });
  selectSession(id);
  saveSessions();
}

function ensureSession() {
  if (!activeId) newSession();
  return getActiveSession();
}

function bumpTitleFromText(text) {
  const s = getActiveSession();
  if (!s || s.title !== "新对话") return;
  const t = text.replace(/\s+/g, " ").trim().slice(0, 18);
  if (t) s.title = t + (text.length > 18 ? "…" : "");
}

async function sendMessage() {
  const text = els.inputText.value.trim();
  if (!text && !pendingImageDataUrl) return;

  const s = ensureSession();
  if (inflightBySession.has(s.id)) {
    alert("当前会话正在生成回复，请稍后再发，或切换到其他会话继续。");
    return;
  }
  if (s.messages.filter((m) => m.role === "user").length >= MAX_USER_TURNS) {
    alert(`已达到 ${MAX_USER_TURNS} 次提问上限，请点击「新对话」。`);
    return;
  }

  bumpTitleFromText(text || "图片消息");
  const userMsg = {
    role: "user",
    content: text || "（见附图）",
    image: pendingImageDataUrl || undefined,
  };
  s.messages.push(userMsg);
  pendingImageDataUrl = null;
  els.imagePreviewRow.classList.add("hidden");
  els.inputText.value = "";
  autoResize();

  setChattingLayout(true);
  renderHistoryList();
  updateMainTitle();
  const payload = {
    messages: s.messages.map((m) => ({
      role: m.role,
      content: m.content,
      image: m.image || null,
    })),
  };
  const assistantMsg = { role: "assistant", content: "", streaming: true };
  s.messages.push(assistantMsg);
  inflightBySession.set(s.id, { startedAt: Date.now() });
  shouldAutoFollow = true;
  renderThread({ forceScroll: true });
  refreshComposerState();
  let activeStreamingBubble = null;
  if (activeId === s.id) {
    const bubbles = els.threadScroll.querySelectorAll(".msg-assistant .msg-bubble");
    activeStreamingBubble = bubbles.length ? bubbles[bubbles.length - 1] : null;
  }

  let full = "";
  let streamOk = true;
  /** @type {boolean} 是否为 HTTP 4xx（与读流无关，一律 [请求失败]） */
  let http4xx = false;
  /** @type {boolean} 是否在读响应体（SSE）时连接/读流异常 */
  let streamReadInterrupted = false;
  try {
    const res = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      if (res.status >= 400 && res.status < 500) {
        http4xx = true;
      }
      const errText = await res.text();
      throw new Error(errText || res.statusText);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";

    while (true) {
      let chunk;
      try {
        chunk = await reader.read();
      } catch (readErr) {
        streamReadInterrupted = true;
        throw readErr;
      }
      const { done, value } = chunk;
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() || "";

      for (const block of parts) {
        const line = block.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const j = JSON.parse(data);
          if (j.error) throw new Error(j.error);
          if (j.delta) {
            full += j.delta;
            assistantMsg.content = full;
            if (activeId === s.id) {
              if (activeStreamingBubble && activeStreamingBubble.isConnected) {
                activeStreamingBubble.innerHTML = formatAssistantText(full);
                if (shouldAutoFollow) {
                  els.threadScroll.scrollTop = els.threadScroll.scrollHeight;
                }
              } else {
                renderThread();
                const bubbles = els.threadScroll.querySelectorAll(".msg-assistant .msg-bubble");
                activeStreamingBubble = bubbles.length ? bubbles[bubbles.length - 1] : null;
              }
            }
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  } catch (e) {
    streamOk = false;
    const errText = String(e.message || e);
    if (http4xx) {
      assistantMsg.content = "[请求失败] " + errText;
    } else if (streamReadInterrupted && full.trim()) {
      assistantMsg.content = full + "\n\n（回复中断：" + errText + "）";
    } else if (full.trim()) {
      assistantMsg.content = full + "\n\n[请求失败] " + errText;
    } else {
      assistantMsg.content = "[请求失败] " + errText;
    }
    assistantMsg.streaming = false;
    if (activeId === s.id) renderThread();
    alert(errText);
  } finally {
    assistantMsg.streaming = false;
    inflightBySession.delete(s.id);
    if (activeId === s.id) {
      refreshComposerState();
    }
  }

  if (streamOk) {
    if (full) {
      assistantMsg.content = full;
    } else {
      const emptyMsg = "（模型未返回内容）";
      assistantMsg.content = emptyMsg;
      if (activeId === s.id) renderThread();
    }
  }
  saveSessions();
}

function autoResize() {
  const ta = els.inputText;
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
}

els.inputText.addEventListener("input", autoResize);
els.threadScroll.addEventListener("scroll", () => {
  shouldAutoFollow = isThreadNearBottom();
});
els.inputText.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

els.btnSend.addEventListener("click", sendMessage);
els.btnNewChat.addEventListener("click", () => {
  newSession();
  els.inputText.focus();
});

els.btnAttach.addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", () => {
  const f = els.fileInput.files && els.fileInput.files[0];
  els.fileInput.value = "";
  if (!f || !f.type.startsWith("image/")) return;
  const r = new FileReader();
  r.onload = () => {
    pendingImageDataUrl = r.result;
    els.imageThumb.src = pendingImageDataUrl;
    els.imagePreviewRow.classList.remove("hidden");
  };
  r.readAsDataURL(f);
});

els.btnRemoveImage.addEventListener("click", () => {
  pendingImageDataUrl = null;
  els.imagePreviewRow.classList.add("hidden");
});

function openSidebarMobile() {
  els.sidebar.classList.add("open");
  els.sidebarBackdrop.classList.remove("hidden");
}
function closeSidebarMobile() {
  els.sidebar.classList.remove("open");
  els.sidebarBackdrop.classList.add("hidden");
}

els.btnOpenSidebar.addEventListener("click", openSidebarMobile);
els.sidebarBackdrop.addEventListener("click", closeSidebarMobile);

if (els.btnCollapseSidebar) {
  els.btnCollapseSidebar.addEventListener("click", () => setSidebarCollapsed(true));
}
if (els.btnExpandSidebar) {
  els.btnExpandSidebar.addEventListener("click", () => setSidebarCollapsed(false));
}
if (els.btnNewChatCompact) {
  els.btnNewChatCompact.addEventListener("click", () => {
    newSession();
    els.inputText.focus();
  });
}

window.addEventListener("resize", () => {
  if (!isDesktopLayout()) {
    els.app.classList.remove("sidebar-collapsed");
    applySidebarCollapsedUi(false);
  }
});

if (isDesktopLayout() && readInitialSidebarCollapsed()) {
  setSidebarCollapsed(true);
} else {
  applySidebarCollapsedUi(false);
}

loadSessions();
if (sessions.length === 0) {
  newSession();
} else {
  if (!activeId) activeId = sessions[0].id;
  renderHistoryList();
  updateMainTitle();
  const s = getActiveSession();
  if (s && s.messages.length) {
    setChattingLayout(true);
    renderThread();
  } else {
    setChattingLayout(false);
  }
}
refreshComposerState();
