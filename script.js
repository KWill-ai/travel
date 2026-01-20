/********************
 * Flight Companion Demo (Front-end only)
 * - Demo login
 * - Flight plan display (updated to 20/02/2026 trip)
 * - Documents checklist (localStorage)
 * - In-app reminders scheduled by real timestamps (multi-timezone)
 * - Optional browser notifications (if user enables)
 ********************/

// --- Demo credentials (sample only) ---
const DEMO_USERNAME = "0123456789";
const DEMO_PASSWORD = "Ggrwmmvw@1.2";

// --- DOM ---
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

// --- Local Storage Keys ---
const LS_SESSION = "fc_session_user";
const LS_DOCS = "fc_docs_checklist";
const LS_REMINDERS = "fc_reminders_feed";

// ===============================
// FLIGHT PLAN (Updated to 20/02/2026)
// ===============================
//
// Same times + timezones as your original plan, but shifted to:
// Depart: Fri, Feb 20, 2026 11:30 PM (GMT+3) from NBO
// Arrive: Sat, Feb 21, 2026 06:40 AM (GMT+1) at CDG
// Depart: Sat, Feb 21, 2026 01:50 PM (GMT+1) CDG → RDU
// Arrive: Sat, Feb 21, 2026 04:45 PM (EST, GMT-5) at RDU
//
const flightPlan = [
  {
    dayLabel: "Fri, Feb 20",
    timeLabel: "11:30 PM GMT+3",
    route: "NBO → CDG",
    flight: "AF 815 (Air France)",
    details: "Depart Nairobi (NBO)"
  },
  {
    dayLabel: "Sat, Feb 21",
    timeLabel: "6:40 AM GMT+1",
    route: "Arrive Paris (CDG)",
    flight: "",
    details: "Layover: 7 hr 10 min in CDG"
  },
  {
    dayLabel: "Sat, Feb 21",
    timeLabel: "1:50 PM GMT+1",
    route: "CDG → RDU",
    flight: "AF 692 (Air France)",
    details: "Depart Paris (CDG)"
  },
  {
    dayLabel: "Sat, Feb 21",
    timeLabel: "4:45 PM EST",
    route: "Arrive Raleigh/Durham (RDU)",
    flight: "",
    details: "Arrival"
  }
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
let scheduledReminders = []; // { atMs, title, text }
let tickerTimer = null;

// --- Utilities ---
function showToast(message, ms = 3500) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => {
    toastEl.classList.add("hidden");
  }, ms);
}

function setLoginError(msg) {
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
  // Shows in the user’s local machine timezone (fine for UI “next reminder”)
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
  if (Notification && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch {
      // ignore
    }
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

// Create a UTC timestamp from a date/time expressed in a known GMT offset.
//
// Example: "2026-02-20 23:30" at GMT+3
// offsetMinutes = +180
// UTC time = local time - offset
function toUtcMsFromOffset(dateISO, time24, offsetMinutes) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = time24.split(":").map(Number);

  // Date.UTC uses a UTC clock, so we build "local clock as if it was UTC",
  // then subtract the offset to get real UTC.
  const localAsUTC = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  return localAsUTC - offsetMinutes * 60 * 1000;
}

function addMinutes(ms, minutes) {
  return ms + minutes * 60 * 1000;
}

function addHours(ms, hours) {
  return ms + hours * 60 * 60 * 1000;
}

function midpointMs(a, b) {
  return Math.floor((a + b) / 2);
}

// --- Flight key timestamps ---
function getTripTimestamps() {
  const departNBO = toUtcMsFromOffset("2026-02-20", "23:30", +180); // GMT+3
  const arriveCDG = toUtcMsFromOffset("2026-02-21", "06:40", +60);  // GMT+1
  const departCDG = toUtcMsFromOffset("2026-02-21", "13:50", +60);  // GMT+1
  const arriveRDU  = toUtcMsFromOffset("2026-02-21", "16:45", -300); // EST (GMT-5)

  return { departNBO, arriveCDG, departCDG, arriveRDU };
}

function buildRealSchedule() {
  const { departNBO, arriveCDG, departCDG, arriveRDU } = getTripTimestamps();

  // Reminder moments (you can tweak these later)
  const schedule = [
    {
      atMs: addHours(departNBO, -3),
      title: "Pre-departure (3 hours to go)",
      text: "Confirm passport, boarding pass, baggage limits, and that your essentials are in your carry-on."
    },
    {
      atMs: addMinutes(departNBO, -90),
      title: "Head to gate / check-in check",
      text: "If you haven’t checked in, do it now. Confirm gate for AF 815 (NBO → CDG)."
    },
    {
      atMs: addMinutes(departNBO, -30),
      title: "Boarding soon",
      text: "Stay near the gate. Keep passport + boarding pass in hand. Charge phone if needed."
    },
    {
      atMs: midpointMs(departNBO, arriveCDG),
      title: "In-flight check",
      text: "Hydrate, stretch when safe, and keep valuables secured. Prepare for CDG connection steps."
    },
    {
      atMs: addMinutes(arriveCDG, -20),
      title: "Approaching CDG",
      text: "On arrival: check terminal + gate for AF 692. Confirm whether you must pass immigration/security."
    },
    {
      atMs: addMinutes(arriveCDG, +25),
      title: "Layover plan (CDG)",
      text: "Check next gate first, then water + light meal. Charge devices and be near the next gate 60–90 min before boarding."
    },
    {
      atMs: addMinutes(departCDG, -45),
      title: "Connection boarding soon",
      text: "Re-check screens for gate changes. Get to the gate area early for CDG → RDU."
    },
    {
      atMs: midpointMs(departCDG, arriveRDU),
      title: "Second flight in-progress",
      text: "Rest and hydrate. Keep any arrival forms ready (address, contact info, customs)."
    },
    {
      atMs: addMinutes(arriveRDU, -30),
      title: "Arrival prep (RDU)",
      text: "Prepare for immigration/customs, then confirm baggage claim belt and ground transport."
    }
  ];

  // Sort by time just in case
  schedule.sort((a, b) => a.atMs - b.atMs);
  return schedule;
}

function computeNextReminderText() {
  const now = Date.now();
  const next = scheduledReminders.find(r => r.atMs > now);
  if (!next) return "All delivered / none upcoming";
  return `${formatDateTimeLocal(next.atMs)} — ${next.title}`;
}

// --- Flight plan rendering ---
function renderFlightPlan() {
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
      <div class="t-badges">
        ${flightLine}
      </div>
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
  const state = loadDocsState();
  docsListEl.innerHTML = "";

  defaultDocs.forEach(doc => {
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

  docsListEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
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
  defaultDocs.forEach(d => { all[d.id] = true; });
  saveDocsState(all);
  renderDocsChecklist();
  showToast("All documents marked.");
}

// --- Reminders feed rendering ---
function renderRemindersFeed() {
  const feed = loadRemindersFeed();
  remindersFeedEl.innerHTML = "";

  if (feed.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted small";
    empty.textContent = "No reminders yet. Click “Start Reminders” to schedule them for your trip date.";
    remindersFeedEl.appendChild(empty);
    return;
  }

  feed.forEach(item => {
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

// --- Reminders engine (real schedule) ---
function stopReminders() {
  reminderTimers.forEach(t => clearTimeout(t));
  reminderTimers = [];

  if (tickerTimer) {
    clearInterval(tickerTimer);
    tickerTimer = null;
  }

  scheduledReminders = [];
  reminderStatusEl.textContent = "Not started";
  nextReminderEl.textContent = "—";
}

function startReminders() {
  stopReminders();

  const schedule = buildRealSchedule();
  const now = Date.now();

  // Keep full schedule for "Next reminder" display, but only set timers for future ones
  scheduledReminders = schedule.slice();

  const upcoming = schedule.filter(r => r.atMs > now);
  const skipped = schedule.length - upcoming.length;

  if (upcoming.length === 0) {
    reminderStatusEl.textContent = "No upcoming reminders";
    nextReminderEl.textContent = "All delivered / none upcoming";
    showToast("All reminder times have already passed for this trip date.");
    return;
  }

  reminderStatusEl.textContent = skipped > 0 ? `Running (${skipped} skipped)` : "Running";
  nextReminderEl.textContent = computeNextReminderText();

  // Schedule each upcoming reminder
  upcoming.forEach(rem => {
    const delay = rem.atMs - now;
    const timer = setTimeout(() => {
      const payload = { title: rem.title, text: rem.text };
      pushReminderToFeed(payload);
      notifyUser(rem.title, rem.text);

      // After firing, update next reminder info
      nextReminderEl.textContent = computeNextReminderText();

      // If none left, mark completed
      if (nextReminderEl.textContent === "All delivered / none upcoming") {
        reminderStatusEl.textContent = "Completed";
      }
    }, delay);

    reminderTimers.push(timer);
  });

  // Live ticker refresh
  tickerTimer = setInterval(() => {
    nextReminderEl.textContent = computeNextReminderText();
    if (nextReminderEl.textContent === "All delivered / none upcoming") {
      clearInterval(tickerTimer);
      tickerTimer = null;
    }
  }, 1000);

  showToast(`Reminders scheduled for your trip date. Upcoming: ${upcoming.length}${skipped ? ` (skipped: ${skipped})` : ""}.`);
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

// --- Simple “concierge” buttons handler (copy/toast) ---
function bindConciergeActions() {
  document.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const action = btn.getAttribute("data-action");
      if (action === "toast") {
        showToast(btn.getAttribute("data-toast") || "Done.");
      }
      if (action === "copy") {
        await copyText(btn.getAttribute("data-copy") || "");
      }
    });
  });
}

// --- View switch ---
function showApp(username) {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");

  userBadge.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");

  badgeName.textContent = username;
  usernameDisplay.textContent = username;

  renderFlightPlan();
  renderDocsChecklist();
  renderRemindersFeed();
  bindConciergeActions();
}

function showLogin() {
  appView.classList.add("hidden");
  loginView.classList.remove("hidden");

  userBadge.classList.add("hidden");
  logoutBtn.classList.add("hidden");

  stopReminders();
  setLoginError("");
}

// --- Login logic ---
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  setLoginError("");

  const u = (loginUsername.value || "").trim();
  const p = (loginPassword.value || "").trim();

  if (u === DEMO_USERNAME && p === DEMO_PASSWORD) {
    saveSessionUser(u);
    showApp(u);
    showToast("Welcome! Your flight plan is ready.");
  } else {
    setLoginError("Invalid username or password. Try the demo credentials.");
  }
});

fillDemo.addEventListener("click", () => {
  loginUsername.value = DEMO_USERNAME;
  loginPassword.value = DEMO_PASSWORD;
  showToast("Demo credentials filled.");
});

logoutBtn.addEventListener("click", () => {
  clearSessionUser();
  showLogin();
  showToast("Logged out.");
});

// --- Buttons ---
enableNotifsBtn.addEventListener("click", enableNotifications);
startRemindersBtn.addEventListener("click", startReminders);

copyPlanBtn.addEventListener("click", async () => {
  await copyText(buildPlanText());
});

resetDocsBtn.addEventListener("click", resetDocs);
markAllDocsBtn.addEventListener("click", markAllDocs);

clearRemindersBtn.addEventListener("click", () => {
  clearRemindersFeed();
  showToast("Reminders cleared.");
});

// --- Init: restore session if exists ---
(function init() {
  const session = getSessionUser();
  if (session && session.username) {
    showApp(session.username);
  } else {
    showLogin();
  }
})();
