/* ===============================
   Infinity Flight Companion - script.js
   Responsive/adaptive JS behaviors + existing functionality preserved
=============================== */

const DEMO_USERNAME = "0123456789";
const DEMO_PASSWORD = "Ggrwmmvw@1.2";

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const fillDemo = document.getElementById("fillDemo");

const userBadge = document.getElementById("userBadge");
const badgeName = document.getElementById("badgeName");
const logoutBtn = document.getElementById("logoutBtn");

const usernameDisplay = document.getElementById("usernameDisplay");

const flightPlanEl = document.getElementById("flightPlan");
const copyPlanBtn = document.getElementById("copyPlan");

const docsListEl = document.getElementById("docsList");
const resetDocsBtn = document.getElementById("resetDocs");
const markAllDocsBtn = document.getElementById("markAllDocs");

const enableNotifsBtn = document.getElementById("enableNotifs");
const startRemindersBtn = document.getElementById("startReminders");
const reminderStatusEl = document.getElementById("reminderStatus");
const nextReminderEl = document.getElementById("nextReminder");

const remindersFeedEl = document.getElementById("remindersFeed");
const clearRemindersBtn = document.getElementById("clearReminders");

const toastEl = document.getElementById("toast");

// ===== Side Nav Elements =====
const menuBtn = document.getElementById("menuBtn");
const sideNav = document.getElementById("sideNav");
const navOverlay = document.getElementById("navOverlay");
const closeNavBtn = document.getElementById("closeNav");

// ===== Views to toggle =====
const viewIds = ["welcomeCard", "flightCard", "layoverCard", "remindersCard", "documentsCard", "conciergeCard"];
const views = viewIds.map((id) => document.getElementById(id)).filter(Boolean);

// ===== Profile Picture Elements =====
const profileAvatar = document.getElementById("profileAvatar");
const profileInput = document.getElementById("profileInput");
const avatarImage = document.getElementById("avatarImage");
const avatarPlaceholder = document.getElementById("avatarPlaceholder");

// --- Local Storage Keys ---
const LS_SESSION = "fc_session_user";
const LS_DOCS = "fc_docs_checklist";
const LS_REMINDERS = "fc_reminders_feed";
const SAVED_AVATAR_KEY = "ifc_profile_avatar";

// --- Adaptive State ---
let isNavOpen = false;
let lastFocusedEl = null;
let focusableInNav = [];
let navTrapHandler = null;
let resizeTimer = null;

// ===============================
// FLIGHT PLAN (Updated to 20/02/2026)
// ===============================
const flightPlan = [
  { dayLabel: "Fri, Feb 20", timeLabel: "11:30 PM GMT+3", route: "NBO → CDG", flight: "AF 815 (Air France)", details: "Depart Nairobi (NBO)" },
  { dayLabel: "Sat, Feb 21", timeLabel: "6:40 AM GMT+1", route: "Arrive Paris (CDG)", flight: "", details: "Layover: 7 hr 10 min in CDG" },
  { dayLabel: "Sat, Feb 21", timeLabel: "1:50 PM GMT+1", route: "CDG → RDU", flight: "AF 692 (Air France)", details: "Depart Paris (CDG)" },
  { dayLabel: "Sat, Feb 21", timeLabel: "4:45 PM EST", route: "Arrive Raleigh/Durham (RDU)", flight: "", details: "Arrival" }
];

const defaultDocs = [
  { id: "passport", title: "Passport", sub: "Check expiry date + keep copies (paper + offline digital)." },
  { id: "visa", title: "Visa(Sealed Envelope)", sub: "Hand over once you land in the US" },
  { id: "tickets", title: "Boarding pass / e-ticket", sub: "Save offline + screenshot backup." },
  { id: "insurance", title: "Travel insurance details", sub: "Policy number + hotline + claim steps." },
  { id: "hotel", title: "Hotel / accommodation confirmation", sub: "Address + booking reference + check-in time." },
  { id: "contacts", title: "Emergency contacts", sub: "Family + embassy/consulate + doctor (if relevant)." },
  { id: "payment", title: "Payment cards + some cash", sub: "Carry in separate places as backup." },
  { id: "meds", title: "Medication + prescriptions", sub: "Keep in carry-on. Bring prescription proof if needed." },
  { id: "vaccines", title: "Vaccination card / health docs (if required)", sub: "Depends on route & regulations." },
  { id: "power", title: "Power bank + adapters", sub: "Keep charged; confirm airline carry rules." }
];

// ===============================
// REMINDERS ENGINE (REAL TIMELINE)
// ===============================
let reminderTimers = [];
let scheduledReminders = [];
let tickerTimer = null;

// --- Utilities ---
function showToast(message, ms = 3500) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => toastEl.classList.add("hidden"), ms);
}

function setLoginError(msg) {
  if (!loginError) return;
  if (!msg) {
    loginError.classList.add("hidden");
    loginError.textContent = "";
    return;
  }
  loginError.textContent = msg;
  loginError.classList.remove("hidden");
}

function saveSessionUser(username) {
  localStorage.setItem(LS_SESSION, JSON.stringify({ username }));
}

function getSessionUser() {
  try {
    const raw = localStorage.getItem(LS_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSessionUser() {
  localStorage.removeItem(LS_SESSION);
}

function formatNowTime() {
  const d = new Date();
  return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDateTimeLocal(ms) {
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function pushReminderToFeed(item) {
  const feed = loadRemindersFeed();
  const entry = {
    id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    time: formatNowTime(),
    title: item.title,
    text: item.text
  };
  feed.unshift(entry);
  localStorage.setItem(LS_REMINDERS, JSON.stringify(feed));
  renderRemindersFeed();
}

function loadRemindersFeed() {
  try {
    const raw = localStorage.getItem(LS_REMINDERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function clearRemindersFeed() {
  localStorage.removeItem(LS_REMINDERS);
  renderRemindersFeed();
}

function notifyUser(title, body) {
  showToast(`${title}: ${body}`, 5000);
  if (window.Notification && Notification.permission === "granted") {
    try { new Notification(title, { body }); } catch { /* ignore */ }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function toUtcMsFromOffset(dateISO, time24, offsetMinutes) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = time24.split(":").map(Number);
  const localAsUTC = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  return localAsUTC - offsetMinutes * 60 * 1000;
}

function addMinutes(ms, minutes) { return ms + minutes * 60 * 1000; }
function addHours(ms, hours) { return ms + hours * 60 * 60 * 1000; }
function midpointMs(a, b) { return Math.floor((a + b) / 2); }

// --- Flight key timestamps ---
function getTripTimestamps() {
  const departNBO = toUtcMsFromOffset("2026-02-20", "23:30", +180);
  const arriveCDG = toUtcMsFromOffset("2026-02-21", "06:40", +60);
  const departCDG = toUtcMsFromOffset("2026-02-21", "13:50", +60);
  const arriveRDU = toUtcMsFromOffset("2026-02-21", "16:45", -300);
  return { departNBO, arriveCDG, departCDG, arriveRDU };
}

function buildRealSchedule() {
  const { departNBO, arriveCDG, departCDG, arriveRDU } = getTripTimestamps();

  const schedule = [
    { atMs: addHours(departNBO, -3), title: "Pre-departure (3 hours to go)", text: "Confirm passport, boarding pass, baggage limits, and that your essentials are in your carry-on." },
    { atMs: addMinutes(departNBO, -90), title: "Head to gate / check-in check", text: "If you haven’t checked in, do it now. Confirm gate for AF 815 (NBO → CDG)." },
    { atMs: addMinutes(departNBO, -30), title: "Boarding soon", text: "Stay near the gate. Keep passport + boarding pass in hand. Charge phone if needed." },
    { atMs: midpointMs(departNBO, arriveCDG), title: "In-flight check", text: "Hydrate, stretch when safe, and keep valuables secured. Prepare for CDG connection steps." },
    { atMs: addMinutes(arriveCDG, -20), title: "Approaching CDG", text: "On arrival: check terminal + gate for AF 692. Confirm whether you must pass immigration/security." },
    { atMs: addMinutes(arriveCDG, +25), title: "Layover plan (CDG)", text: "Check next gate first, then water + light meal. Charge devices and be near the next gate 60–90 min before boarding." },
    { atMs: addMinutes(departCDG, -45), title: "Connection boarding soon", text: "Re-check screens for gate changes. Get to the gate area early for CDG → RDU." },
    { atMs: midpointMs(departCDG, arriveRDU), title: "Second flight in-progress", text: "Rest and hydrate. Keep any arrival forms ready (address, contact info, customs)." },
    { atMs: addMinutes(arriveRDU, -30), title: "Arrival prep (RDU)", text: "Prepare for immigration/customs, then confirm baggage claim belt and ground transport." }
  ];

  schedule.sort((a, b) => a.atMs - b.atMs);
  return schedule;
}

function computeNextReminderText() {
  const now = Date.now();
  const next = scheduledReminders.find((r) => r.atMs > now);
  if (!next) return "All delivered / none upcoming";
  return `${formatDateTimeLocal(next.atMs)} — ${next.title}`;
}

// --- Flight plan rendering ---
function renderFlightPlan() {
  if (!flightPlanEl) return;
  flightPlanEl.innerHTML = "";

  flightPlan.forEach((item, idx) => {
    const el = document.createElement("div");
    el.className = "t-item";
    const flightLine = item.flight ? `<div class="tag">${escapeHtml(item.flight)}</div>` : "";

    el.innerHTML = `
      <div class="t-top">
        <div>
          <div class="t-title">${escapeHtml(item.route)}</div>
          <div class="t-sub">${escapeHtml(item.dayLabel)} • ${escapeHtml(item.timeLabel)}</div>
          <div class="t-sub">${escapeHtml(item.details)}</div>
        </div>
        <div class="t-meta">Stop ${idx + 1}/${flightPlan.length}</div>
      </div>
      <div class="t-badges">${flightLine}</div>
    `;

    flightPlanEl.appendChild(el);
  });
}

// --- Documents checklist ---
function loadDocsState() {
  try {
    const raw = localStorage.getItem(LS_DOCS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDocsState(state) {
  localStorage.setItem(LS_DOCS, JSON.stringify(state));
}

function renderDocsChecklist() {
  if (!docsListEl) return;

  const state = loadDocsState();
  docsListEl.innerHTML = "";

  defaultDocs.forEach((doc) => {
    const checked = !!state[doc.id];
    const row = document.createElement("label");
    row.className = "check";
    row.innerHTML = `
      <input type="checkbox" ${checked ? "checked" : ""} data-doc="${escapeHtml(doc.id)}" />
      <div>
        <div class="check-title">${escapeHtml(doc.title)}</div>
        <div class="check-sub">${escapeHtml(doc.sub)}</div>
      </div>
    `;
    docsListEl.appendChild(row);
  });

  docsListEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const id = e.target.getAttribute("data-doc");
      const next = loadDocsState();
      next[id] = e.target.checked;
      saveDocsState(next);
    });
  });
}

function resetDocs() {
  localStorage.removeItem(LS_DOCS);
  renderDocsChecklist();
  showToast("Documents checklist reset.");
}

function markAllDocs() {
  const all = {};
  defaultDocs.forEach((d) => (all[d.id] = true));
  saveDocsState(all);
  renderDocsChecklist();
  showToast("All documents marked.");
}

// --- Reminders feed rendering ---
function renderRemindersFeed() {
  if (!remindersFeedEl) return;

  const feed = loadRemindersFeed();
  remindersFeedEl.innerHTML = "";

  if (feed.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted small";
    empty.textContent = "No reminders yet. Click “Start Reminders” to schedule them for your trip date.";
    remindersFeedEl.appendChild(empty);
    return;
  }

  feed.forEach((item) => {
    const el = document.createElement("div");
    el.className = "feed-item";
    el.innerHTML = `
      <div class="feed-head">
        <div class="feed-title">${escapeHtml(item.title)}</div>
        <div class="feed-time">${escapeHtml(item.time)}</div>
      </div>
      <div class="feed-text">${escapeHtml(item.text)}</div>
    `;
    remindersFeedEl.appendChild(el);
  });
}

// --- Reminders engine ---
function stopReminders() {
  reminderTimers.forEach((t) => clearTimeout(t));
  reminderTimers = [];

  if (tickerTimer) {
    clearInterval(tickerTimer);
    tickerTimer = null;
  }

  scheduledReminders = [];
  if (reminderStatusEl) reminderStatusEl.textContent = "Not started";
  if (nextReminderEl) nextReminderEl.textContent = "—";
}

function startReminders() {
  stopReminders();

  const schedule = buildRealSchedule();
  const now = Date.now();

  scheduledReminders = schedule.slice();
  const upcoming = schedule.filter((r) => r.atMs > now);
  const skipped = schedule.length - upcoming.length;

  if (upcoming.length === 0) {
    if (reminderStatusEl) reminderStatusEl.textContent = "No upcoming reminders";
    if (nextReminderEl) nextReminderEl.textContent = "All delivered / none upcoming";
    showToast("All reminder times have already passed for this trip date.");
    return;
  }

  if (reminderStatusEl) reminderStatusEl.textContent = skipped > 0 ? `Running (${skipped} skipped)` : "Running";
  if (nextReminderEl) nextReminderEl.textContent = computeNextReminderText();

  upcoming.forEach((rem) => {
    const delay = rem.atMs - now;
    const timer = setTimeout(() => {
      pushReminderToFeed({ title: rem.title, text: rem.text });
      notifyUser(rem.title, rem.text);

      if (nextReminderEl) nextReminderEl.textContent = computeNextReminderText();
      if (reminderStatusEl && nextReminderEl && nextReminderEl.textContent === "All delivered / none upcoming") {
        reminderStatusEl.textContent = "Completed";
      }
    }, delay);

    reminderTimers.push(timer);
  });

  tickerTimer = setInterval(() => {
    if (nextReminderEl) nextReminderEl.textContent = computeNextReminderText();
    if (nextReminderEl && nextReminderEl.textContent === "All delivered / none upcoming") {
      clearInterval(tickerTimer);
      tickerTimer = null;
    }
  }, 1000);

  showToast(`Reminders scheduled. Upcoming: ${upcoming.length}${skipped ? ` (skipped: ${skipped})` : ""}.`);
}

// --- Notifications permission ---
async function enableNotifications() {
  if (!("Notification" in window)) {
    showToast("Notifications are not supported in this browser.");
    return;
  }
  if (Notification.permission === "granted") {
    showToast("Notifications are already enabled.");
    return;
  }
  if (Notification.permission === "denied") {
    showToast("Notifications are blocked in browser settings.");
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === "granted") showToast("Notifications enabled!");
  else showToast("Notifications not enabled (permission not granted).");
}

// --- Copy utilities ---
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard.");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast("Copied to clipboard.");
  }
}

function buildPlanText() {
  return [
    "My info on TripIt",
    "",
    "Fri, Feb 20, 2026",
    "11:30 PM GMT+3",
    "NBO → CDG",
    "AF 815 (Air France)",
    "",
    "Sat, Feb 21, 2026",
    "6:40 AM GMT+1",
    "Arrive Paris (CDG)",
    "7 hr 10 min layover in CDG",
    "",
    "Sat, Feb 21, 2026",
    "1:50 PM GMT+1",
    "CDG → RDU",
    "AF 692 (Air France)",
    "",
    "Sat, Feb 21, 2026",
    "4:45 PM EST",
    "Arrive Raleigh/Durham (RDU)"
  ].join("\n");
}

// --- Simple “concierge” buttons handler ---
function bindConciergeActions() {
  document.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.getAttribute("data-action");
      if (action === "toast") showToast(btn.getAttribute("data-toast") || "Done.");
      if (action === "copy") await copyText(btn.getAttribute("data-copy") || "");
    });
  });
}

/* ==========================================================
   Responsive/Adaptive Side Nav behaviors
========================================================== */
function getFocusableElements(container) {
  if (!container) return [];
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ];
  return Array.from(container.querySelectorAll(selectors.join(","))).filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

function lockBodyScroll(lock) {
  // prevents background scrolling behind drawer on mobile
  if (lock) {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
  } else {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
  }
}

function openSideNav() {
  if (!sideNav || !navOverlay || !menuBtn) return;
  if (isNavOpen) return;

  isNavOpen = true;
  lastFocusedEl = document.activeElement;

  sideNav.classList.remove("hidden");
  navOverlay.classList.remove("hidden");

  menuBtn.setAttribute("aria-expanded", "true");
  sideNav.setAttribute("aria-hidden", "false");
  navOverlay.setAttribute("aria-hidden", "false");

  lockBodyScroll(true);

  focusableInNav = getFocusableElements(sideNav);
  const first = focusableInNav[0] || closeNavBtn || sideNav;
  if (first && typeof first.focus === "function") first.focus();

  // Focus trap
  navTrapHandler = (e) => {
    if (!isNavOpen) return;
    if (e.key !== "Tab") return;

    focusableInNav = getFocusableElements(sideNav);
    if (focusableInNav.length === 0) return;

    const firstEl = focusableInNav[0];
    const lastEl = focusableInNav[focusableInNav.length - 1];

    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  };

  document.addEventListener("keydown", navTrapHandler, true);
}

function closeSideNav() {
  if (!sideNav || !navOverlay || !menuBtn) return;
  if (!isNavOpen) return;

  isNavOpen = false;

  sideNav.classList.add("hidden");
  navOverlay.classList.add("hidden");

  menuBtn.setAttribute("aria-expanded", "false");
  sideNav.setAttribute("aria-hidden", "true");
  navOverlay.setAttribute("aria-hidden", "true");

  lockBodyScroll(false);

  if (navTrapHandler) {
    document.removeEventListener("keydown", navTrapHandler, true);
    navTrapHandler = null;
  }

  if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
    lastFocusedEl.focus();
  }
}

function setActiveLink(targetId) {
  document.querySelectorAll(".side-link").forEach((btn) => {
    const isActive = btn.getAttribute("data-view") === targetId;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-current", isActive ? "page" : "false");
  });
}

function showView(targetId, scroll = true) {
  // toggle sections
  views.forEach((v) => {
    if (v.id === targetId) v.classList.remove("hidden");
    else v.classList.add("hidden");
  });

  setActiveLink(targetId);

  // smooth scroll for long pages; on small screens jump a bit earlier
  if (scroll) {
    const el = document.getElementById(targetId);
    if (el) {
      const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
    }
  }
}

function setDashboardDefault() {
  showView("welcomeCard", false);
}

function showAppNav() {
  if (menuBtn) menuBtn.classList.remove("hidden");
}

function hideAppNav() {
  if (menuBtn) menuBtn.classList.add("hidden");
  closeSideNav();
}

function bindSideNav() {
  if (!menuBtn || !sideNav || !navOverlay) return;

  // accessibility attrs
  menuBtn.setAttribute("aria-expanded", "false");
  menuBtn.setAttribute("aria-controls", "sideNav");
  sideNav.setAttribute("aria-hidden", "true");
  navOverlay.setAttribute("aria-hidden", "true");

  menuBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openSideNav();
  });

  if (closeNavBtn) closeNavBtn.addEventListener("click", closeSideNav);
  navOverlay.addEventListener("click", closeSideNav);

  // close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSideNav();
  });

  // event delegation for nav buttons (more stable on mobile)
  sideNav.addEventListener("click", (e) => {
    const btn = e.target.closest(".side-link");
    if (!btn) return;
    const target = btn.getAttribute("data-view");
    if (target) showView(target);
    closeSideNav();
  });

  // adaptive: when screen changes (rotate/resize), close drawer to avoid weird states
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (isNavOpen) closeSideNav();
    }, 150);
  });

  window.addEventListener("orientationchange", () => {
    if (isNavOpen) closeSideNav();
  });
}

/* ==========================================================
   Profile Picture (Upload + Persist)
========================================================== */
function loadSavedAvatar() {
  try {
    const savedAvatar = localStorage.getItem(SAVED_AVATAR_KEY);
    if (savedAvatar && avatarImage && avatarPlaceholder) {
      avatarImage.src = savedAvatar;
      avatarImage.classList.remove("hidden");
      avatarPlaceholder.classList.add("hidden");
    }
  } catch { /* ignore */ }
}

function saveAvatar(dataUrl) {
  try { localStorage.setItem(SAVED_AVATAR_KEY, dataUrl); } catch { /* ignore */ }
}

function setupProfileAvatar() {
  if (!profileAvatar || !profileInput) return;

  // ensure we don't stack listeners if showApp runs again
  if (profileAvatar._bound) return;
  profileAvatar._bound = true;

  profileAvatar.addEventListener("click", () => profileInput.click());

  profileInput.addEventListener("change", () => {
    const file = profileInput.files && profileInput.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please upload a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") return;

      if (avatarImage && avatarPlaceholder) {
        avatarImage.src = dataUrl;
        avatarImage.classList.remove("hidden");
        avatarPlaceholder.classList.add("hidden");
      }

      saveAvatar(dataUrl);
      showToast("Profile picture updated.");
    };
    reader.readAsDataURL(file);
  });

  loadSavedAvatar();
}

/* ==========================================================
   View switch (Login/App)
========================================================== */
function showApp(username) {
  if (loginView) loginView.classList.add("hidden");
  if (appView) appView.classList.remove("hidden");

  if (userBadge) userBadge.classList.remove("hidden");
  if (logoutBtn) logoutBtn.classList.remove("hidden");

  if (badgeName) badgeName.textContent = username;
  if (usernameDisplay) usernameDisplay.textContent = username;

  showAppNav();
  setDashboardDefault();

  renderFlightPlan();
  renderDocsChecklist();
  renderRemindersFeed();
  bindConciergeActions();
  setupProfileAvatar();
}

function showLogin() {
  if (appView) appView.classList.add("hidden");
  if (loginView) loginView.classList.remove("hidden");

  if (userBadge) userBadge.classList.add("hidden");
  if (logoutBtn) logoutBtn.classList.add("hidden");

  hideAppNav();
  stopReminders();
  setLoginError("");
}

/* ==========================================================
   Bind main app actions
========================================================== */
function bindActions() {
  if (loginForm && !loginForm._bound) {
    loginForm._bound = true;
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      setLoginError("");

      const u = (loginUsername?.value || "").trim();
      const p = (loginPassword?.value || "").trim();

      if (u === DEMO_USERNAME && p === DEMO_PASSWORD) {
        saveSessionUser(u);
        showApp(u);
        showToast("Welcome! Your flight plan is ready.");
      } else {
        setLoginError("Invalid username or password. Try the demo credentials.");
      }
    });
  }

  if (fillDemo && !fillDemo._bound) {
    fillDemo._bound = true;
    fillDemo.addEventListener("click", () => {
      if (loginUsername) loginUsername.value = DEMO_USERNAME;
      if (loginPassword) loginPassword.value = DEMO_PASSWORD;
      showToast("Demo credentials filled.");
    });
  }

  if (logoutBtn && !logoutBtn._bound) {
    logoutBtn._bound = true;
    logoutBtn.addEventListener("click", () => {
      clearSessionUser();
      showLogin();
      showToast("Logged out.");
    });
  }

  if (enableNotifsBtn && !enableNotifsBtn._bound) {
    enableNotifsBtn._bound = true;
    enableNotifsBtn.addEventListener("click", enableNotifications);
  }

  if (startRemindersBtn && !startRemindersBtn._bound) {
    startRemindersBtn._bound = true;
    startRemindersBtn.addEventListener("click", startReminders);
  }

  if (copyPlanBtn && !copyPlanBtn._bound) {
    copyPlanBtn._bound = true;
    copyPlanBtn.addEventListener("click", async () => copyText(buildPlanText()));
  }

  if (resetDocsBtn && !resetDocsBtn._bound) {
    resetDocsBtn._bound = true;
    resetDocsBtn.addEventListener("click", resetDocs);
  }

  if (markAllDocsBtn && !markAllDocsBtn._bound) {
    markAllDocsBtn._bound = true;
    markAllDocsBtn.addEventListener("click", markAllDocs);
  }

  if (clearRemindersBtn && !clearRemindersBtn._bound) {
    clearRemindersBtn._bound = true;
    clearRemindersBtn.addEventListener("click", () => {
      clearRemindersFeed();
      showToast("Reminders cleared.");
    });
  }
}

/* ==========================================================
   Init
========================================================== */
(function init() {
  bindSideNav();
  bindActions();
  setupProfileAvatar(); // loads saved avatar when possible

  const session = getSessionUser();
  if (session && session.username) {
    showApp(session.username);
  } else {
    showLogin();
  }
})();
