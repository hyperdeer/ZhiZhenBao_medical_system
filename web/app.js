/**
 * 医疗助手 Web：侧栏会话 + DeepSeek 式输入条（无深度思考开关）
 */

const MAX_USER_TURNS = 10;
const MAX_SESSIONS_PER_USER = 20;

const SIDEBAR_COLLAPSED_KEY = "medqa_sidebar_collapsed";
const SETTINGS_HOME_PATH = "/settings";
const SETTINGS_NICKNAME_PATH = "/settings/nickname";
const SETTINGS_PASSWORD_PATH = "/settings/password";
const SETTINGS_CLEAR_PATH = "/settings/clear-history";
const SETTINGS_DELETE_PATH = "/settings/delete-account";
const LOGIN_TABS = {
  LOGIN: "login",
  REGISTER: "register",
};
const DEFAULT_AVATAR_DATA_URI =
  "/assets/picture.webp";

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
  btnLogin: document.getElementById("btnLogin"),
  authUserWrap: document.getElementById("authUserWrap"),
  authUserMenu: document.getElementById("authUserMenu"),
  authAvatar: document.getElementById("authAvatar"),
  authName: document.getElementById("authName"),
  btnOpenSettings: document.getElementById("btnOpenSettings"),
  btnLogout: document.getElementById("btnLogout"),
  authModal: document.getElementById("authModal"),
  authBackdrop: document.getElementById("authBackdrop"),
  btnCloseAuthModal: document.getElementById("btnCloseAuthModal"),
  settingsRoute: document.getElementById("settingsRoute"),
  settingsHomePage: document.getElementById("settingsHomePage"),
  settingsProfileAvatar: document.getElementById("settingsProfileAvatar"),
  settingsProfileName: document.getElementById("settingsProfileName"),
  settingsProfileUsername: document.getElementById("settingsProfileUsername"),
  btnNicknameSettings: document.getElementById("btnNicknameSettings"),
  btnPasswordSettings: document.getElementById("btnPasswordSettings"),
  btnClearChatHistory: document.getElementById("btnClearChatHistory"),
  btnDeleteAccount: document.getElementById("btnDeleteAccount"),
  btnBackToChatFromHome: document.getElementById("btnBackToChatFromHome"),
  btnBackFromNickname: document.getElementById("btnBackFromNickname"),
  btnBackFromPassword: document.getElementById("btnBackFromPassword"),
  btnBackFromClear: document.getElementById("btnBackFromClear"),
  btnBackFromDelete: document.getElementById("btnBackFromDelete"),
  settingsClearPage: document.getElementById("settingsClearPage"),
  settingsDeletePage: document.getElementById("settingsDeletePage"),
  btnConfirmClearChatHistory: document.getElementById("btnConfirmClearChatHistory"),
  btnConfirmDeleteAccount: document.getElementById("btnConfirmDeleteAccount"),
  settingsNicknameForm: document.getElementById("settingsNicknameForm"),
  settingsPasswordForm: document.getElementById("settingsPasswordForm"),
  settingsNickname: document.getElementById("settingsNickname"),
  settingsAvatarPreview: document.getElementById("settingsAvatarPreview"),
  settingsAvatarFile: document.getElementById("settingsAvatarFile"),
  btnPickSettingsAvatar: document.getElementById("btnPickSettingsAvatar"),
  settingsOldPassword: document.getElementById("settingsOldPassword"),
  settingsNewPassword: document.getElementById("settingsNewPassword"),
  settingsConfirmNewPassword: document.getElementById("settingsConfirmNewPassword"),
  settingsCaptchaInput: document.getElementById("settingsCaptchaInput"),
  settingsCaptchaImage: document.getElementById("settingsCaptchaImage"),
  btnRefreshCaptchaSettings: document.getElementById("btnRefreshCaptchaSettings"),
  tabLogin: document.getElementById("tabLogin"),
  tabRegister: document.getElementById("tabRegister"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  loginUsername: document.getElementById("loginUsername"),
  loginPassword: document.getElementById("loginPassword"),
  loginCaptchaInput: document.getElementById("loginCaptchaInput"),
  loginCaptchaImage: document.getElementById("loginCaptchaImage"),
  btnRefreshCaptchaLogin: document.getElementById("btnRefreshCaptchaLogin"),
  registerUsername: document.getElementById("registerUsername"),
  registerNickname: document.getElementById("registerNickname"),
  registerPassword: document.getElementById("registerPassword"),
  registerConfirmPassword: document.getElementById("registerConfirmPassword"),
  registerCaptchaInput: document.getElementById("registerCaptchaInput"),
  registerCaptchaImage: document.getElementById("registerCaptchaImage"),
  btnRefreshCaptchaRegister: document.getElementById("btnRefreshCaptchaRegister"),
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

async function apiJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.error || "请求失败");
  }
  return data;
}

function renderAuthState() {
  const loggedIn = !!currentUser;
  els.btnLogin.classList.toggle("hidden", loggedIn);
  els.authUserWrap.classList.toggle("hidden", !loggedIn);
  if (!loggedIn) {
    refreshSettingsProfileHero();
    return;
  }
  const nick = currentUser.nickname || currentUser.username || "用户";
  els.authName.textContent = nick;
  els.authAvatar.textContent = (nick[0] || "U").toUpperCase();
  const avatarUrl = (currentUser.avatar_url || "").trim() || DEFAULT_AVATAR_DATA_URI;
  if (avatarUrl) {
    els.authAvatar.style.backgroundImage = `url("${avatarUrl}")`;
    els.authAvatar.style.backgroundSize = "cover";
    els.authAvatar.style.backgroundPosition = "center";
    els.authAvatar.style.color = "transparent";
  } else {
    els.authAvatar.style.backgroundImage = "";
    els.authAvatar.style.color = "";
  }
  els.authUserMenu.classList.add("hidden");
  refreshSettingsProfileHero();
}

function refreshSettingsProfileHero() {
  if (!els.settingsProfileName || !els.settingsProfileAvatar || !els.settingsProfileUsername) return;
  const nick = (currentUser && (currentUser.nickname || currentUser.username)) || "用户";
  const uname = (currentUser && currentUser.username) || "username";
  const avatarUrl = (currentUser && (currentUser.avatar_url || "").trim()) || DEFAULT_AVATAR_DATA_URI;
  els.settingsProfileName.textContent = nick;
  els.settingsProfileUsername.textContent = "@" + uname;
  els.settingsProfileAvatar.textContent = (nick[0] || "U").toUpperCase();
  els.settingsProfileAvatar.style.backgroundImage = `url("${avatarUrl}")`;
  els.settingsProfileAvatar.style.backgroundSize = "cover";
  els.settingsProfileAvatar.style.backgroundPosition = "center";
  els.settingsProfileAvatar.style.color = "transparent";
}

function setFieldInvalid(inputEl, invalid) {
  if (!inputEl) return;
  inputEl.classList.toggle("input-invalid", !!invalid);
}

function markFieldTouched(inputEl) {
  if (!inputEl) return;
  inputEl.dataset.touched = "1";
}

function isFieldTouched(inputEl) {
  return !!(inputEl && inputEl.dataset.touched === "1");
}

function applyFieldValidation(inputEl, isValid) {
  if (!inputEl) return;
  if (!isFieldTouched(inputEl)) {
    setFieldInvalid(inputEl, false);
    return;
  }
  setFieldInvalid(inputEl, !isValid);
}

function validateLoginFields() {
  const usernameOk = !!els.loginUsername.value.trim();
  const passwordOk = !!els.loginPassword.value.trim();
  const captchaOk = !!els.loginCaptchaInput.value.trim();
  applyFieldValidation(els.loginUsername, usernameOk);
  applyFieldValidation(els.loginPassword, passwordOk);
  applyFieldValidation(els.loginCaptchaInput, captchaOk);
  return usernameOk && passwordOk && captchaOk;
}

function validateRegisterFields() {
  const username = els.registerUsername.value.trim();
  const nickname = els.registerNickname.value.trim();
  const password = els.registerPassword.value;
  const confirmPassword = els.registerConfirmPassword.value;
  const captcha = els.registerCaptchaInput.value.trim();

  const usernameOk = !!username;
  const nicknameOk = !!nickname;
  const passwordOk = password.length >= 6;
  const confirmOk = !!confirmPassword && confirmPassword === password;
  const captchaOk = !!captcha;

  applyFieldValidation(els.registerUsername, usernameOk);
  applyFieldValidation(els.registerNickname, nicknameOk);
  applyFieldValidation(els.registerPassword, passwordOk);
  applyFieldValidation(els.registerConfirmPassword, confirmOk);
  applyFieldValidation(els.registerCaptchaInput, captchaOk);

  return usernameOk && nicknameOk && passwordOk && confirmOk && captchaOk;
}

function setAuthTab(tab) {
  if (currentAuthTab === LOGIN_TABS.LOGIN && tab !== LOGIN_TABS.LOGIN) {
    resetLoginForm();
  }
  if (currentAuthTab === LOGIN_TABS.REGISTER && tab !== LOGIN_TABS.REGISTER) {
    resetRegisterForm();
  }
  currentAuthTab = tab;
  const loginOn = tab === LOGIN_TABS.LOGIN;
  els.tabLogin.classList.toggle("active", loginOn);
  els.tabRegister.classList.toggle("active", !loginOn);
  els.loginForm.classList.toggle("hidden", !loginOn);
  els.registerForm.classList.toggle("hidden", loginOn);
}

function openAuthModal(tab = LOGIN_TABS.LOGIN) {
  setAuthTab(tab);
  els.authBackdrop.classList.remove("hidden");
  els.authModal.classList.remove("hidden");
}

function closeAuthModal() {
  els.authBackdrop.classList.add("hidden");
  els.authModal.classList.add("hidden");
  resetLoginForm();
  resetRegisterForm();
}

function resetLoginForm() {
  els.loginUsername.value = "";
  els.loginPassword.value = "";
  els.loginCaptchaInput.value = "";
  [els.loginUsername, els.loginPassword, els.loginCaptchaInput].forEach((el) => {
    if (!el) return;
    setFieldInvalid(el, false);
    delete el.dataset.touched;
  });
}

function resetRegisterForm() {
  els.registerUsername.value = "";
  els.registerNickname.value = "";
  els.registerPassword.value = "";
  els.registerConfirmPassword.value = "";
  els.registerCaptchaInput.value = "";
  [els.registerUsername, els.registerNickname, els.registerPassword, els.registerConfirmPassword, els.registerCaptchaInput].forEach(
    (el) => {
      if (!el) return;
      setFieldInvalid(el, false);
      delete el.dataset.touched;
    }
  );
}

function normalizePath(path) {
  const clean = String(path || "/").split("?")[0];
  if (clean.length > 1 && clean.endsWith("/")) return clean.slice(0, -1);
  return clean || "/";
}

function getSettingsPageByPath(pathname) {
  const p = normalizePath(pathname);
  if (p === SETTINGS_HOME_PATH) return "home";
  if (p === SETTINGS_NICKNAME_PATH) return "nickname";
  if (p === SETTINGS_PASSWORD_PATH) return "password";
  if (p === SETTINGS_CLEAR_PATH) return "clear";
  if (p === SETTINGS_DELETE_PATH) return "delete";
  return null;
}

function navigateTo(path, replace = false) {
  const target = normalizePath(path);
  const current = normalizePath(window.location.pathname);
  if (target !== current) {
    if (replace) {
      window.history.replaceState({}, "", target);
    } else {
      window.history.pushState({}, "", target);
    }
  }
  renderRoute();
}

function openSettingsModal() {
  if (!currentUser) return;
  navigateTo(SETTINGS_HOME_PATH);
  els.settingsNickname.value = currentUser.nickname || "";
  settingsAvatarDataUrl = (currentUser.avatar_url || "").trim() || DEFAULT_AVATAR_DATA_URI;
  if (els.settingsAvatarPreview) {
    els.settingsAvatarPreview.src = settingsAvatarDataUrl;
  }
  els.settingsOldPassword.value = "";
  els.settingsNewPassword.value = "";
  els.settingsConfirmNewPassword.value = "";
}

function switchSettingsPage(page) {
  const showHome = page === "home";
  const showNickname = page === "nickname";
  const showPassword = page === "password";
  const showClear = page === "clear";
  const showDelete = page === "delete";
  els.settingsHomePage.classList.toggle("hidden", !showHome);
  els.settingsNicknameForm.classList.toggle("hidden", !showNickname);
  els.settingsPasswordForm.classList.toggle("hidden", !showPassword);
  els.settingsClearPage.classList.toggle("hidden", !showClear);
  els.settingsDeletePage.classList.toggle("hidden", !showDelete);
  if (showPassword) {
    settingsCaptchaId = "";
    els.settingsCaptchaInput.value = "";
    void refreshSettingsCaptcha();
  }
}

function closeSettingsModal() {
  navigateTo("/", true);
}

function renderRoute() {
  const settingsPage = getSettingsPageByPath(window.location.pathname);
  const inSettings = !!settingsPage;
  els.settingsRoute.classList.toggle("hidden", !inSettings);
  if (!inSettings) return;
  if (!currentUser) {
    navigateTo("/", true);
    showMessage("请先登录后再进入设置", "warning");
    void openAuthModalWithCaptcha(LOGIN_TABS.LOGIN);
    return;
  }
  switchSettingsPage(settingsPage);
}

async function refreshCaptcha(tab = LOGIN_TABS.LOGIN) {
  const data = await apiJson("/api/auth/captcha");
  if (tab === LOGIN_TABS.LOGIN) {
    loginCaptchaId = data.captcha_id || "";
    els.loginCaptchaImage.src = data.image_data || "";
  } else {
    registerCaptchaId = data.captcha_id || "";
    els.registerCaptchaImage.src = data.image_data || "";
  }
}

async function refreshSettingsCaptcha() {
  const data = await apiJson("/api/auth/captcha");
  settingsCaptchaId = data.captcha_id || "";
  els.settingsCaptchaImage.src = data.image_data || "";
}

async function loadAuthMe() {
  try {
    const data = await apiJson("/api/auth/me");
    currentUser = data.logged_in ? data.user : null;
  } catch (_) {
    currentUser = null;
  }
  renderAuthState();
  if (currentUser) {
    await loadServerSessions();
  } else {
    clearChatForLogout();
    refreshComposerState();
  }
}

function clearChatForLogout() {
  sessions = [];
  activeId = null;
  pendingImageDataUrl = null;
  els.imagePreviewRow.classList.add("hidden");
  els.threadScroll.innerHTML = "";
  renderHistoryList();
  updateMainTitle();
  setChattingLayout(false);
}

async function loadServerSessions() {
  const data = await apiJson("/api/chat/sessions");
  const list = Array.isArray(data.sessions) ? data.sessions : [];
  sessions = list.map((s) => ({
    id: s.id || uid(),
    title: s.title || "新对话",
    messages: [],
    hydrated: false,
  }));
  if (sessions.length === 0) {
    newSession();
    return;
  }
  activeId = sessions[0].id;
  renderHistoryList();
  await selectSession(activeId);
}

async function hydrateSessionIfNeeded(s) {
  if (!s || s.hydrated) return;
  try {
    const data = await apiJson(`/api/chat/session/${encodeURIComponent(s.id)}`);
    s.messages = Array.isArray(data.messages) ? data.messages : [];
    s.hydrated = true;
  } catch (_) {
    s.messages = [];
    s.hydrated = true;
  }
}

async function submitLogin(ev) {
  ev.preventDefault();
  if (!validateLoginFields()) {
    showMessage("请完善登录信息后再提交", "warning");
    return;
  }
  const username = els.loginUsername.value.trim();
  const password = els.loginPassword.value;
  const captchaAnswer = els.loginCaptchaInput.value.trim();
  if (!username || !password || !captchaAnswer || !loginCaptchaId) {
    showMessage("请填写完整登录信息", "warning");
    return;
  }
  try {
    const data = await apiJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        captcha_id: loginCaptchaId,
        captcha_answer: captchaAnswer,
      }),
    });
    currentUser = data.user || null;
    renderAuthState();
    refreshComposerState();
    closeAuthModal();
    await loadServerSessions();
  } catch (e) {
    showMessage(String(e.message || e), "error");
    await refreshCaptcha(LOGIN_TABS.LOGIN);
  }
}

async function submitRegister(ev) {
  ev.preventDefault();
  if (!validateRegisterFields()) {
    showMessage("请检查注册信息是否完整且正确", "warning");
    return;
  }
  const username = els.registerUsername.value.trim();
  const nickname = els.registerNickname.value.trim();
  const password = els.registerPassword.value;
  const confirmPassword = els.registerConfirmPassword.value;
  const captchaAnswer = els.registerCaptchaInput.value.trim();
  if (!username || !nickname || !password || !confirmPassword || !captchaAnswer || !registerCaptchaId) {
    showMessage("请完整填写注册信息", "warning");
    return;
  }
  try {
    await apiJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        nickname,
        password,
        confirm_password: confirmPassword,
        captcha_id: registerCaptchaId,
        captcha_answer: captchaAnswer,
      }),
    });
    showMessage("注册成功，请登录", "success");
    setAuthTab(LOGIN_TABS.LOGIN);
    resetRegisterForm();
    await refreshCaptcha(LOGIN_TABS.LOGIN);
  } catch (e) {
    showMessage(String(e.message || e), "error");
    await refreshCaptcha(LOGIN_TABS.REGISTER);
  }
}

async function openAuthModalWithCaptcha(tab = LOGIN_TABS.LOGIN) {
  openAuthModal(tab);
  await refreshCaptcha(tab);
}

async function submitNicknameSettings(ev) {
  ev.preventDefault();
  if (!currentUser) return;
  try {
    const data = await apiJson("/api/auth/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname: els.settingsNickname.value.trim(),
        avatar_url: settingsAvatarDataUrl,
      }),
    });
    currentUser = data.user || currentUser;
    renderAuthState();
    showMessage("个人资料已保存", "success");
    navigateTo(SETTINGS_HOME_PATH, true);
  } catch (e) {
    showMessage(String(e.message || e), "error");
  }
}

async function submitPasswordSettings(ev) {
  ev.preventDefault();
  if (!currentUser) return;
  const captchaAnswer = els.settingsCaptchaInput.value.trim();
  if (!settingsCaptchaId || !captchaAnswer) {
    showMessage("请先填写验证码", "warning");
    await refreshSettingsCaptcha();
    return;
  }
  try {
    await apiJson("/api/auth/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname: currentUser.nickname || "",
        avatar_url: currentUser.avatar_url || "",
        old_password: els.settingsOldPassword.value,
        new_password: els.settingsNewPassword.value,
        confirm_new_password: els.settingsConfirmNewPassword.value,
        captcha_id: settingsCaptchaId,
        captcha_answer: captchaAnswer,
      }),
    });
    els.settingsOldPassword.value = "";
    els.settingsNewPassword.value = "";
    els.settingsConfirmNewPassword.value = "";
    els.settingsCaptchaInput.value = "";
    settingsCaptchaId = "";
    showMessage("密码已修改", "success");
    navigateTo(SETTINGS_HOME_PATH, true);
  } catch (e) {
    showMessage(String(e.message || e), "error");
    await refreshSettingsCaptcha();
  }
}

async function clearChatHistory() {
  if (!currentUser) return;
  const ok = await showConfirm({
    title: "清空对话记录",
    message: "确定清空全部对话记录吗？",
    confirmText: "清空",
    danger: true,
  });
  if (!ok) return;
  try {
    await apiJson("/api/chat/clear", { method: "POST" });
    sessions = [];
    activeId = null;
    els.threadScroll.innerHTML = "";
    setChattingLayout(false);
    renderHistoryList();
    updateMainTitle();
    showMessage("对话记录已清空", "success");
    navigateTo(SETTINGS_HOME_PATH, true);
  } catch (e) {
    showMessage(String(e.message || e), "error");
  }
}

async function deleteAccountAndLogout() {
  if (!currentUser) return;
  const ok = await showConfirm({
    title: "删除账号",
    message: "账号一经删除无法恢复，是否继续？",
    confirmText: "删除账号",
    danger: true,
  });
  if (!ok) return;
  try {
    await apiJson("/api/auth/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    closeSettingsModal();
    currentUser = null;
    renderAuthState();
    clearChatForLogout();
    refreshComposerState();
    showMessage("账号已删除并退出登录", "success");
  } catch (e) {
    showMessage(String(e.message || e), "error");
  }
}

/** @type {{ id: string, title: string, messages: {role: string, content: string, image?: string|null}[], hydrated?: boolean }[]} */
let sessions = [];
let activeId = null;
let pendingImageDataUrl = null;
/** @type {Map<string, { startedAt: number }>} */
const inflightBySession = new Map();
let shouldAutoFollow = true;
let currentUser = null;
let loginCaptchaId = "";
let registerCaptchaId = "";
let settingsCaptchaId = "";
let currentAuthTab = LOGIN_TABS.LOGIN;
let toastTimer = null;
let settingsAvatarDataUrl = DEFAULT_AVATAR_DATA_URI;

function uid() {
  return "s_" + Math.random().toString(36).slice(2, 12);
}

function getActiveSession() {
  return sessions.find((s) => s.id === activeId) || null;
}

function saveSessions() {
  // 历史记录改为后端按用户隔离存储，前端不再落 localStorage。
}

function loadSessions() {
  sessions = [];
  activeId = null;
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
    li.addEventListener("click", () => {
      void selectSession(s.id);
    });
    els.chatHistory.appendChild(li);
  });
}

async function deleteSession(id, ev) {
  if (ev) ev.stopPropagation();
  const ok = await showConfirm({
    title: "删除对话",
    message: "确定删除这条对话？无法恢复。",
    confirmText: "删除",
    danger: true,
  });
  if (!ok) return;

  const wasActive = activeId === id;
  sessions = sessions.filter((s) => s.id !== id);

  if (sessions.length === 0) {
    newSession();
    return;
  }

  if (wasActive) {
    void selectSession(sessions[0].id);
  } else {
    renderHistoryList();
    saveSessions();
  }
}

function updateMainTitle() {
  const s = getActiveSession();
  els.mainTitle.textContent = s ? s.title : "智诊宝";
}

function refreshComposerState() {
  const s = getActiveSession();
  const busy = !!(s && inflightBySession.has(s.id));
  const lockedByAuth = !currentUser;
  els.btnSend.disabled = busy || lockedByAuth;
  els.inputText.disabled = lockedByAuth;
  els.btnAttach.disabled = lockedByAuth;
  if (lockedByAuth) {
    els.inputText.placeholder = "请先登录后再开始使用";
  } else {
    els.inputText.placeholder = busy ? "该会话正在生成回复，可切换到其他会话继续提问" : "给 智诊宝 发送消息";
  }
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

const MESSAGE_SVG = {
  error:
    '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#f56c6c"/><path d="M6.5 6.5l7 7M13.5 6.5l-7 7" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  warning:
    '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#e6a23c"/><path d="M10 5.8v5.8M10 14.2h.01" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/></svg>',
  success:
    '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#67c23a"/><path d="M5.8 10.1l2.8 2.8 5.6-5.7" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function hideMessage() {
  const host = document.getElementById("globalMessageHost");
  if (host) host.classList.remove("show");
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

/**
 * 顶部非阻塞提示：error 红色、warning 黄色、success 绿色（完成类反馈）。
 * @param {string} message
 * @param {"error"|"warning"|"success"} [type]
 * @param {number} [durationMs]
 */
function showMessage(message, type = "success", durationMs) {
  const defaults = { error: 4500, warning: 4000, success: 2800 };
  const dur = durationMs ?? defaults[type];
  let host = document.getElementById("globalMessageHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "globalMessageHost";
    host.className = "global-message-host";
    document.body.appendChild(host);
  }
  host.setAttribute("role", type === "error" ? "alert" : "status");
  host.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
  host.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = `global-message global-message--${type}`;
  const iconWrap = document.createElement("span");
  iconWrap.className = "global-message__icon";
  iconWrap.innerHTML = MESSAGE_SVG[type] || MESSAGE_SVG.success;
  const textEl = document.createElement("span");
  textEl.className = "global-message__text";
  textEl.textContent = message;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "global-message__close";
  btn.setAttribute("aria-label", "关闭");
  btn.textContent = "×";
  btn.addEventListener("click", () => hideMessage());
  wrap.appendChild(iconWrap);
  wrap.appendChild(textEl);
  wrap.appendChild(btn);
  host.appendChild(wrap);
  void host.offsetWidth;
  host.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => hideMessage(), dur);
}

/**
 * @param {{ message: string, title?: string, confirmText?: string, cancelText?: string, danger?: boolean }} opts
 * @returns {Promise<boolean>}
 */
function showConfirm(opts) {
  const message = opts.message;
  const title = opts.title != null ? opts.title : "请确认";
  const confirmText = opts.confirmText != null ? opts.confirmText : "确定";
  const cancelText = opts.cancelText != null ? opts.cancelText : "取消";
  const danger = !!opts.danger;
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML =
      '<div class="confirm-dialog">' +
      `<h3 class="confirm-dialog-title">${escapeHtml(title)}</h3>` +
      `<p class="confirm-dialog-body">${escapeHtml(message)}</p>` +
      '<div class="confirm-dialog-actions">' +
      `<button type="button" class="confirm-btn" data-act="cancel">${escapeHtml(cancelText)}</button>` +
      `<button type="button" class="confirm-btn ${danger ? "confirm-btn-danger" : "confirm-btn-primary"}" data-act="ok">${escapeHtml(
        confirmText
      )}</button>` +
      "</div></div>";
    const finish = (v) => {
      overlay.classList.remove("show");
      setTimeout(() => {
        overlay.remove();
        resolve(v);
      }, 200);
    };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) finish(false);
    });
    overlay.querySelector('[data-act="cancel"]')?.addEventListener("click", () => finish(false));
    overlay.querySelector('[data-act="ok"]')?.addEventListener("click", () => finish(true));
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));
  });
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

/**
 * 过滤 markdown 分隔线（--- / *** / ___），避免界面出现无意义横线文本。
 */
function isHorizontalRuleLine(line) {
  return /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
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
      if (isHorizontalRuleLine(plain)) return "";
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
  let lastAssistantIndex = -1;
  let lastUserIndex = -1;
  s.messages.forEach((msg, idx) => {
    if (msg.role === "assistant") lastAssistantIndex = idx;
    if (msg.role === "user") lastUserIndex = idx;
  });

  s.messages.forEach((m, idx) => {
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
    const actions = document.createElement("div");
    actions.className = "msg-actions";
    let actionCount = 0;

    const appendAction = (title, action, iconSvg) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "msg-action-btn";
      btn.setAttribute("aria-label", title);
      btn.title = title;
      btn.dataset.tip = title;
      btn.dataset.action = action;
      btn.innerHTML = iconSvg;
      actions.appendChild(btn);
      actionCount += 1;
    };

    const copyIcon =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    const refreshIcon =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10"></path><path d="M20.49 15a9 9 0 0 1-14.13 3.36L1 14"></path></svg>';
    const editIcon =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>';

    if (m.role === "assistant") {
      appendAction("复制回复", "copy", copyIcon);
      if (idx === lastAssistantIndex) {
        appendAction("重新生成回复", "regenerate", refreshIcon);
      }
    } else {
      appendAction("复制消息", "copy", copyIcon);
      if (idx === lastUserIndex) {
        appendAction("修改该消息", "edit", editIcon);
      }
    }
    actions.dataset.reserve = actionCount > 1 ? "double" : "single";
    actions.dataset.role = m.role;
    actions.dataset.index = String(idx);
    row.appendChild(actions);
    inner.appendChild(row);
  });

  els.threadScroll.appendChild(inner);
  if (forceScroll || shouldAutoFollow) {
    els.threadScroll.scrollTop = els.threadScroll.scrollHeight;
  } else {
    els.threadScroll.scrollTop = prevTop;
  }
}

async function copyText(text) {
  const value = String(text || "");
  if (!value) {
    showMessage("没有可复制的内容", "warning");
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
  } catch (_) {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "readonly");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
  showMessage("复制成功", "success");
}

function cropImageToSquare(file, size = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const srcW = img.width;
        const srcH = img.height;
        const side = Math.min(srcW, srcH);
        const sx = Math.floor((srcW - side) / 2);
        const sy = Math.floor((srcH - side) / 2);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("头像处理失败"));
          return;
        }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("头像读取失败"));
      img.src = String(reader.result || "");
    };
    reader.onerror = () => reject(new Error("头像读取失败"));
    reader.readAsDataURL(file);
  });
}

async function editLastUserMessage(index) {
  const s = getActiveSession();
  if (!s || index < 0 || index >= s.messages.length) return;
  const msg = s.messages[index];
  if (!msg || msg.role !== "user") return;
  if (inflightBySession.has(s.id)) {
    showMessage("当前会话正在生成回复，请稍后再修改。", "warning");
    return;
  }
  const tail = s.messages.slice(index + 1);
  const hasAssistantAfter = tail.some((item) => item.role === "assistant");
  if (
    hasAssistantAfter &&
    !(await showConfirm({
      title: "修改消息",
      message: "修改后将移除该问题之后的回复，是否继续？",
      confirmText: "继续",
    }))
  ) {
    return;
  }
  s.messages = s.messages.slice(0, index);
  els.inputText.value = msg.content || "";
  pendingImageDataUrl = msg.image || null;
  if (pendingImageDataUrl) {
    els.imageThumb.src = pendingImageDataUrl;
    els.imagePreviewRow.classList.remove("hidden");
  } else {
    els.imagePreviewRow.classList.add("hidden");
  }
  autoResize();
  if (s.messages.length) {
    setChattingLayout(true);
    renderThread({ forceScroll: false });
  } else {
    setChattingLayout(false);
  }
  refreshComposerState();
  saveSessions();
  els.inputText.focus();
}

async function regenerateLastAssistant(index) {
  const s = getActiveSession();
  if (!s || index < 0 || index >= s.messages.length) return;
  if (inflightBySession.has(s.id)) {
    showMessage("当前会话正在生成回复，请稍后再试。", "warning");
    return;
  }
  const msg = s.messages[index];
  if (!msg || msg.role !== "assistant") return;

  const requestMessages = s.messages
    .slice(0, index)
    .map((item) => ({ role: item.role, content: item.content, image: item.image || null }));

  s.messages = s.messages.slice(0, index);
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
  let http4xx = false;
  let streamReadInterrupted = false;
  try {
    const res = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: s.id,
        messages: requestMessages,
      }),
    });
    if (!res.ok) {
      if (res.status === 401) {
        currentUser = null;
        renderAuthState();
        refreshComposerState();
      }
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
    showMessage(errText, "error");
  } finally {
    assistantMsg.streaming = false;
    inflightBySession.delete(s.id);
    if (activeId === s.id) {
      refreshComposerState();
    }
  }
  if (streamOk) {
    assistantMsg.content = full || "（模型未返回内容）";
    if (activeId === s.id) renderThread();
  }
  saveSessions();
}

async function selectSession(id) {
  activeId = id;
  pendingImageDataUrl = null;
  els.imagePreviewRow.classList.add("hidden");
  await hydrateSessionIfNeeded(getActiveSession());
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
  if (!currentUser && sessions.length >= 1) {
    showMessage("未登录状态下最多保留 1 条对话记录。", "warning");
    return;
  }
  if (currentUser && sessions.length >= MAX_SESSIONS_PER_USER) {
    showMessage(`对话记录最多可保存 ${MAX_SESSIONS_PER_USER} 条，请先删除旧对话后再创建。`, "warning");
    return;
  }
  const id = uid();
  sessions.unshift({ id, title: "新对话", messages: [], hydrated: true });
  void selectSession(id);
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
  if (!currentUser) {
    showMessage("请先登录后再使用", "warning");
    await openAuthModalWithCaptcha(LOGIN_TABS.LOGIN);
    return;
  }
  const text = els.inputText.value.trim();
  if (!text && !pendingImageDataUrl) return;

  const s = ensureSession();
  if (inflightBySession.has(s.id)) {
    showMessage("当前会话正在生成回复，请稍后再发，或切换到其他会话继续。", "warning");
    return;
  }
  if (s.messages.filter((m) => m.role === "user").length >= MAX_USER_TURNS) {
    showMessage(`已达到 ${MAX_USER_TURNS} 次提问上限，请点击「新对话」。`, "warning");
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
    session_id: s.id,
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
      if (res.status === 401) {
        currentUser = null;
        renderAuthState();
        refreshComposerState();
      }
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
    showMessage(errText, "error");
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
els.threadScroll.addEventListener("click", (e) => {
  const btn = e.target.closest(".msg-action-btn");
  if (!btn) return;
  const actions = btn.closest(".msg-actions");
  if (!actions) return;
  const index = Number(actions.dataset.index);
  const s = getActiveSession();
  if (!s || Number.isNaN(index) || index < 0 || index >= s.messages.length) return;
  const msg = s.messages[index];
  if (!msg) return;
  const action = btn.dataset.action;
  if (action === "copy") {
    void copyText(msg.content || "");
    return;
  }
  if (action === "regenerate") {
    void regenerateLastAssistant(index);
    return;
  }
  if (action === "edit") {
    void editLastUserMessage(index);
  }
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
els.btnLogin.addEventListener("click", async () => {
  await openAuthModalWithCaptcha(LOGIN_TABS.LOGIN);
});
els.authUserWrap.addEventListener("click", () => {
  els.authUserMenu.classList.toggle("hidden");
});
els.btnOpenSettings.addEventListener("click", (e) => {
  e.stopPropagation();
  els.authUserMenu.classList.add("hidden");
  openSettingsModal();
});
els.btnLogout.addEventListener("click", async () => {
  els.authUserMenu.classList.add("hidden");
  try {
    await apiJson("/api/auth/logout", { method: "POST" });
  } catch (_) {
    /* ignore */
  }
  currentUser = null;
  renderAuthState();
  clearChatForLogout();
  refreshComposerState();
  if (getSettingsPageByPath(window.location.pathname)) {
    navigateTo("/", true);
  }
  resetLoginForm();
  resetRegisterForm();
});
els.authBackdrop.addEventListener("click", () => {
  closeAuthModal();
});
els.btnCloseAuthModal.addEventListener("click", closeAuthModal);
els.btnNicknameSettings.addEventListener("click", () => navigateTo(SETTINGS_NICKNAME_PATH));
els.btnPasswordSettings.addEventListener("click", () => navigateTo(SETTINGS_PASSWORD_PATH));
els.btnClearChatHistory.addEventListener("click", () => navigateTo(SETTINGS_CLEAR_PATH));
els.btnDeleteAccount.addEventListener("click", () => navigateTo(SETTINGS_DELETE_PATH));
els.btnBackToChatFromHome.addEventListener("click", closeSettingsModal);
els.btnBackFromNickname.addEventListener("click", () => navigateTo(SETTINGS_HOME_PATH));
els.btnBackFromPassword.addEventListener("click", () => navigateTo(SETTINGS_HOME_PATH));
els.btnBackFromClear.addEventListener("click", () => navigateTo(SETTINGS_HOME_PATH));
els.btnBackFromDelete.addEventListener("click", () => navigateTo(SETTINGS_HOME_PATH));
els.btnConfirmClearChatHistory.addEventListener("click", () => {
  void clearChatHistory();
});
els.btnConfirmDeleteAccount.addEventListener("click", () => {
  void deleteAccountAndLogout();
});
els.settingsNicknameForm.addEventListener("submit", submitNicknameSettings);
els.settingsPasswordForm.addEventListener("submit", submitPasswordSettings);
els.btnPickSettingsAvatar.addEventListener("click", () => {
  els.settingsAvatarFile.click();
});
els.settingsAvatarFile.addEventListener("change", async () => {
  const file = els.settingsAvatarFile.files && els.settingsAvatarFile.files[0];
  els.settingsAvatarFile.value = "";
  if (!file || !file.type.startsWith("image/")) return;
  try {
    const cropped = await cropImageToSquare(file, 256);
    settingsAvatarDataUrl = cropped;
    els.settingsAvatarPreview.src = settingsAvatarDataUrl;
  } catch (e) {
    showMessage(String(e.message || e), "error");
  }
});
document.addEventListener("click", (e) => {
  if (!els.authUserWrap.contains(e.target)) {
    els.authUserMenu.classList.add("hidden");
  }
});
els.tabLogin.addEventListener("click", async () => {
  setAuthTab(LOGIN_TABS.LOGIN);
  await refreshCaptcha(LOGIN_TABS.LOGIN);
});
els.tabRegister.addEventListener("click", async () => {
  setAuthTab(LOGIN_TABS.REGISTER);
  await refreshCaptcha(LOGIN_TABS.REGISTER);
});
els.btnRefreshCaptchaLogin.addEventListener("click", () => refreshCaptcha(LOGIN_TABS.LOGIN));
els.btnRefreshCaptchaRegister.addEventListener("click", () => refreshCaptcha(LOGIN_TABS.REGISTER));
els.btnRefreshCaptchaSettings.addEventListener("click", () => refreshSettingsCaptcha());
els.loginForm.addEventListener("submit", submitLogin);
els.registerForm.addEventListener("submit", submitRegister);
[
  els.loginUsername,
  els.loginPassword,
  els.loginCaptchaInput,
  els.registerUsername,
  els.registerNickname,
  els.registerPassword,
  els.registerConfirmPassword,
  els.registerCaptchaInput,
].forEach((el) => {
  if (!el) return;
  el.addEventListener("input", () => setFieldInvalid(el, false));
  el.addEventListener("focus", () => markFieldTouched(el));
});
els.loginUsername.addEventListener("blur", validateLoginFields);
els.loginPassword.addEventListener("blur", validateLoginFields);
els.loginCaptchaInput.addEventListener("blur", validateLoginFields);
els.registerUsername.addEventListener("blur", validateRegisterFields);
els.registerNickname.addEventListener("blur", validateRegisterFields);
els.registerPassword.addEventListener("blur", validateRegisterFields);
els.registerConfirmPassword.addEventListener("blur", validateRegisterFields);
els.registerCaptchaInput.addEventListener("blur", validateRegisterFields);

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
window.addEventListener("popstate", renderRoute);

if (isDesktopLayout() && readInitialSidebarCollapsed()) {
  setSidebarCollapsed(true);
} else {
  applySidebarCollapsedUi(false);
}

loadSessions();
setChattingLayout(false);
renderHistoryList();
updateMainTitle();
refreshComposerState();
void loadAuthMe().then(() => {
  renderRoute();
});
