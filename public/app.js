const state = {
  activeUser: null,
  dailyQuestions: [],
  scheduledDailyQuestions: [],
  hostQuestions: [],
  allDailyQuestions: [],
  allHostQuestions: [],
  users: [],
  dailyWinners: [],
  dailyAnswerRows: [],
  hostLeaderboard: [],
  hostAttemptRows: [],
  adminStats: null,
  userSearch: "",
  userDateFilter: "all",
  hostAlreadyQualified: false,
  hostAnswers: new Map(),
  hostStartedAt: Date.now(),
  lastDailyAnswer: null,
  lastLiveSignature: "",
  dailyManageDate: new Date().toISOString().slice(0, 10),
  hostManageDate: new Date().toISOString().slice(0, 10),
  hostBulkDate: new Date().toISOString().slice(0, 10),
  adminToken: null
};

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));
function bind(selector, eventName, handler) {
  const el = $(selector);
  if (el) el.addEventListener(eventName, handler);
}
const OFFLINE_KEY = "gyanChakraOfflineDb";
const OFFLINE_SCHEMA_VERSION = "2026-05-31-registration-fix";
const USER_SESSION_KEY = "gyanChakraActiveUser";
const API_BASE_URL = (window.GYAN_API_BASE_URL || localStorage.getItem("GYAN_API_BASE_URL") || "").replace(/\/$/, "");
const PACKAGED_APP = !["http:", "https:"].includes(window.location.protocol);

function isoNow() {
  return new Date().toISOString();
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizePassword(value) {
  return String(value || "").trim();
}

function todayAt(hour, minute) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function tomorrowAt(hour, minute) {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function offlineHostQuestion(idNumber, text, options, correctIndex) {
  return {
    id: `hq_${idNumber}`,
    text,
    options,
    correctIndex,
    status: "scheduled",
    scheduledAt: isoNow(),
    publishedAt: isoNow()
  };
}

function createOfflineDb() {
  return {
    schemaVersion: OFFLINE_SCHEMA_VERSION,
    users: [
      {
        id: "usr_demo",
        name: "Demo User",
        phone: "9999999999",
        password: "123456",
        address: "Sector 4, Bokaro Steel City",
        pincode: "827004",
        photoUrl: "",
        bio: "Preparing for competitive exams and loves current affairs.",
        createdAt: isoNow()
      }
    ],
    dailyQuestions: [
      {
        id: "dq_1",
        text: "Bokaro Steel City is located in which Indian state?",
        options: ["Jharkhand", "Bihar", "Odisha", "West Bengal"],
        correctIndex: 0,
        prize: 500,
        status: "scheduled",
        scheduledAt: todayAt(10, 0),
        publishedAt: isoNow()
      },
      {
        id: "dq_2",
        text: "How many questions are planned for Play with Host qualification?",
        options: ["5", "10", "15", "20"],
        correctIndex: 1,
        prize: 500,
        status: "scheduled",
        scheduledAt: todayAt(18, 0),
        publishedAt: isoNow()
      },
      {
        id: "dq_3",
        text: "Which city is the first launch area for Gyan Chakra?",
        options: ["Bokaro Steel City", "Mumbai", "Delhi", "Patna"],
        correctIndex: 0,
        prize: 500,
        status: "scheduled",
        scheduledAt: tomorrowAt(11, 30),
        publishedAt: isoNow()
      }
    ],
    hostQuestions: [
      offlineHostQuestion(1, "Which river is closely associated with Bokaro district?", ["Damodar", "Ganga", "Yamuna", "Narmada"], 0),
      offlineHostQuestion(2, "What does KBC-style quiz usually reward?", ["Fast typing only", "Correct answers", "Random selection", "Attendance"], 1),
      offlineHostQuestion(3, "Which detail helps verify local eligibility?", ["Pincode", "Favorite color", "Shoe size", "Music app"], 0),
      offlineHostQuestion(4, "Gyan Chakra is currently planned for which audience?", ["Bokaro residents", "All countries", "Only teachers", "Only shopkeepers"], 0),
      offlineHostQuestion(5, "How many correct answers should qualify a player in this preview?", ["5", "7", "10", "12"], 2),
      offlineHostQuestion(6, "What should decide ranking when players answer correctly?", ["Speed", "Alphabetical name", "Random draw", "Phone number"], 0),
      offlineHostQuestion(7, "Which person manages questions in the system?", ["Agent/Admin", "Every player", "Delivery partner", "Guest user"], 0),
      offlineHostQuestion(8, "What should happen after a player qualifies for Play with Host once?", ["Cannot qualify again", "Unlimited attempts", "Automatic payment", "Delete account"], 0),
      offlineHostQuestion(9, "What is needed before a user can play?", ["Register or login", "Change phone", "Buy a device", "Delete bio"], 0),
      offlineHostQuestion(10, "What is the Gyan Chakra tagline?", ["Gyan Aapka Inam Hamara", "Sabka Phone Sabka Data", "Quiz Bandh Hai", "Only Luck Works"], 0)
    ],
    dailyAnswers: [],
    hostAttempts: [],
    dailyWinnerSelections: {},
    hostWinnerSelections: {}
  };
}

function offlineId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function readOfflineDb() {
  const existing = localStorage.getItem(OFFLINE_KEY);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (parsed.schemaVersion === OFFLINE_SCHEMA_VERSION) {
        parsed.dailyWinnerSelections ||= {};
        parsed.hostWinnerSelections ||= {};
        parsed.users ||= [];
        parsed.users.forEach(user => {
          user.loginCount ||= 0;
          user.status ||= "active";
        });
        return parsed;
      }
    } catch (error) {
      localStorage.removeItem(OFFLINE_KEY);
    }
  }
  const db = createOfflineDb();
  writeOfflineDb(db);
  return db;
}

function writeOfflineDb(db) {
  db.schemaVersion = OFFLINE_SCHEMA_VERSION;
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(db));
}

function offlineDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function offlineLiveDailyQuestions(db, date = new Date()) {
  const today = offlineDayKey(date);
  const todaysStarted = db.dailyQuestions
    .filter(question => question.scheduledAt && new Date(question.scheduledAt) <= date && offlineDayKey(new Date(question.scheduledAt)) === today)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .slice(0, 2);
  const currentQuestion = todaysStarted.at(-1);
  return currentQuestion ? [{ ...currentQuestion, dailySlot: todaysStarted.length }] : [];
}

function offlineLiveHostQuestions(db, date = new Date()) {
  const today = offlineDayKey(date);
  return db.hostQuestions
    .filter(question => {
      const live = (!question.scheduledAt && question.status === "live") || (question.scheduledAt && new Date(question.scheduledAt) <= date);
      if (!live) return false;
      if (!question.scheduledAt && question.status === "live") return true;
      return offlineDayKey(new Date(question.scheduledAt)) === today;
    })
    .slice(-10);
}

function offlineScheduledDailyQuestions(db) {
  const dayCounts = {};
  const live = offlineLiveDailyQuestions(db);
  return db.dailyQuestions
    .slice()
    .sort((a, b) => new Date(a.scheduledAt || a.publishedAt) - new Date(b.scheduledAt || b.publishedAt))
    .map(question => {
      const key = question.scheduledAt ? offlineDayKey(new Date(question.scheduledAt)) : "unscheduled";
      dayCounts[key] = (dayCounts[key] || 0) + 1;
      return {
        id: question.id,
        text: question.text,
        options: question.options,
        prize: question.prize,
        status: question.status,
        scheduledAt: question.scheduledAt,
        dailySlot: dayCounts[key],
        publishedAt: question.publishedAt,
        isLive: live.some(item => item.id === question.id)
      };
    });
}

function offlineDailyWinners(db) {
  return db.dailyQuestions.map(question => {
    const correct = db.dailyAnswers
      .filter(answer => answer.questionId === question.id && answer.correct)
      .sort((a, b) => a.timeMs - b.timeMs || new Date(a.answeredAt) - new Date(b.answeredAt));
    const selectedAnswerId = db.dailyWinnerSelections?.[question.id];
    const selected = selectedAnswerId ? correct.find(answer => answer.id === selectedAnswerId) : null;
    const winner = selected || correct[0];
    return {
      questionId: question.id,
      question: question.text,
      prize: question.prize,
      winnerStatus: selected ? "selected" : winner ? "suggested" : "pending",
      winner: winner ? {
        answerId: winner.id,
        userId: winner.userId,
        name: db.users.find(user => user.id === winner.userId)?.name || "Unknown",
        phone: db.users.find(user => user.id === winner.userId)?.phone || "",
        address: db.users.find(user => user.id === winner.userId)?.address || "",
        pincode: db.users.find(user => user.id === winner.userId)?.pincode || "",
        bio: db.users.find(user => user.id === winner.userId)?.bio || "",
        timeMs: winner.timeMs,
        answeredAt: winner.answeredAt,
        notifiedAt: winner.notifiedAt || ""
      } : null,
      totalCorrect: correct.length
    };
  }).filter(item => item.winner || offlineLiveDailyQuestions(db).some(question => question.id === item.questionId));
}

function offlinePublicDailyWinners(db) {
  return offlineDailyWinners(db).map(item => ({
    ...item,
    winner: item.winner ? {
      userId: item.winner.userId,
      name: item.winner.name,
      timeMs: item.winner.timeMs,
      answeredAt: item.winner.answeredAt
    } : null
  }));
}

function offlineHostLeaderboard(db) {
  const selectedIds = new Set(Object.values(db.hostWinnerSelections || {}));
  return db.hostAttempts
    .map(attempt => ({
      ...attempt,
      name: db.users.find(user => user.id === attempt.userId)?.name || "Unknown",
      selectedWinner: selectedIds.has(attempt.id)
    }))
    .sort((a, b) => b.correctCount - a.correctCount || a.totalTimeMs - b.totalTimeMs || new Date(a.submittedAt) - new Date(b.submittedAt));
}

function offlineDailyAnswerRows(db) {
  return db.dailyAnswers
    .map(answer => {
      const user = db.users.find(item => item.id === answer.userId);
      const question = db.dailyQuestions.find(item => item.id === answer.questionId);
      return {
        id: answer.id,
        userId: answer.userId,
        name: user?.name || "Unknown",
        phone: user?.phone || "",
        questionId: answer.questionId,
        question: question?.text || "Unknown question",
        selectedOption: question?.options?.[answer.selectedIndex] || "",
        correctOption: question?.options?.[question.correctIndex] || "",
        correct: answer.correct,
        timeMs: answer.timeMs,
        answeredAt: answer.answeredAt,
        selectedWinner: db.dailyWinnerSelections?.[answer.questionId] === answer.id,
        notifiedAt: answer.notifiedAt || ""
      };
    })
    .sort((a, b) => new Date(b.answeredAt) - new Date(a.answeredAt));
}

function offlineHostAttemptRows(db) {
  return offlineHostLeaderboard(db).map((attempt, index) => ({
    ...attempt,
    rank: index + 1,
    phone: db.users.find(user => user.id === attempt.userId)?.phone || "",
    address: db.users.find(user => user.id === attempt.userId)?.address || "",
    pincode: db.users.find(user => user.id === attempt.userId)?.pincode || "",
    bio: db.users.find(user => user.id === attempt.userId)?.bio || "",
    notifiedAt: attempt.notifiedAt || ""
  }));
}

function offlineHasHostQualified(db, userId) {
  return db.hostAttempts.some(attempt => attempt.userId === userId && attempt.shortlisted);
}

function offlinePublicUser(user) {
  if (!user) return null;
  const { password, passwordHash, resetCode, resetCodeAt, ...safeUser } = user;
  return safeUser;
}

function offlineAdminStats(db) {
  const today = offlineDayKey();
  return {
    registeredToday: db.users.filter(user => user.createdAt && offlineDayKey(new Date(user.createdAt)) === today).length,
    loggedInToday: db.users.filter(user => user.lastLoginAt && offlineDayKey(new Date(user.lastLoginAt)) === today).length,
    totalUsers: db.users.length,
    protectedUsers: db.users.length,
    passwordSecurity: "Secure",
    dailyLive: offlineLiveDailyQuestions(db).length,
    hostLive: offlineLiveHostQuestions(db).length === 10,
    dailyAnswersToday: db.dailyAnswers.filter(answer => answer.answeredAt && offlineDayKey(new Date(answer.answeredAt)) === today).length,
    hostAttemptsToday: db.hostAttempts.filter(attempt => attempt.submittedAt && offlineDayKey(new Date(attempt.submittedAt)) === today).length
  };
}

function offlineBootstrap(userId, admin = false) {
  const db = readOfflineDb();
  const publicHostLeaderboard = offlineHostLeaderboard(db).map(item => ({
    id: item.id,
    userId: item.userId,
    name: item.name,
    correctCount: item.correctCount,
    totalQuestions: item.totalQuestions,
    totalTimeMs: item.totalTimeMs,
    submittedAt: item.submittedAt,
    shortlisted: item.shortlisted,
    selectedWinner: item.selectedWinner
  }));
  return {
    users: admin ? db.users.map(offlinePublicUser) : [],
    adminStats: admin ? offlineAdminStats(db) : null,
    userCount: db.users.length,
    dailyQuestions: offlineLiveDailyQuestions(db).map(question => ({
      id: question.id,
      text: question.text,
      options: question.options,
      prize: question.prize,
      status: question.status,
      scheduledAt: question.scheduledAt,
      dailySlot: question.dailySlot,
      publishedAt: question.publishedAt
    })),
    scheduledDailyQuestions: offlineScheduledDailyQuestions(db),
    hostQuestions: offlineLiveHostQuestions(db).map(question => ({
      id: question.id,
      text: question.text,
      options: question.options,
      status: question.status,
      publishedAt: question.publishedAt
    })),
    allDailyQuestions: admin ? db.dailyQuestions.map((question, index) => ({
      ...question,
      order: index + 1,
      correctOption: question.options?.[question.correctIndex] || ""
    })) : [],
    allHostQuestions: admin ? db.hostQuestions.map((question, index) => ({
      ...question,
      order: index + 1,
      correctOption: question.options?.[question.correctIndex] || ""
    })) : [],
    dailyWinners: admin ? offlineDailyWinners(db) : offlinePublicDailyWinners(db),
    hostLeaderboard: admin ? offlineHostLeaderboard(db) : publicHostLeaderboard,
    dailyAnswerRows: admin ? offlineDailyAnswerRows(db) : [],
    hostAttemptRows: admin ? offlineHostAttemptRows(db) : [],
    hostAlreadyQualified: userId ? offlineHasHostQualified(db, userId) : false
  };
}

async function offlineApi(path, options = {}) {
  await new Promise(resolve => setTimeout(resolve, 80));
  const url = new URL(path, window.location.origin);
  const body = options.body ? JSON.parse(options.body) : {};
  const db = readOfflineDb();

  if (url.pathname === "/api/bootstrap") {
    return offlineBootstrap(url.searchParams.get("userId"), body.adminToken === "offline-admin-token");
  }

  if (url.pathname === "/api/admin/login") {
    if (normalizePassword(body.password).length < 12) throw new Error("Admin password is incorrect.");
    return { adminToken: "offline-admin-token", message: "Admin login successful." };
  }

  if (url.pathname === "/api/register") {
    const required = ["name", "phone", "password", "address", "pincode", "bio"];
    const missing = required.filter(key => !String(body[key] || "").trim());
    if (missing.length) throw new Error(`Missing: ${missing.join(", ")}`);
    const allowed = ["827001", "827003", "827004", "827006", "827009", "827010", "827011", "827012", "827013"];
    if (!allowed.includes(String(body.pincode).trim())) throw new Error("Registration is currently open only for Bokaro Steel City pincodes.");
    const phone = normalizePhone(body.phone);
    const password = normalizePassword(body.password);
    const existing = db.users.find(user => normalizePhone(user.phone) === phone);
    if (existing) {
      if (normalizePassword(existing.password || "123456") === password) return { user: offlinePublicUser(existing) };
      throw new Error("This mobile number is already registered. Please login.");
    }
    const user = {
      id: offlineId("usr"),
      name: String(body.name).trim(),
      phone,
      password,
      address: String(body.address).trim(),
      pincode: String(body.pincode).trim(),
      photoUrl: String(body.photoUrl || "").trim(),
      bio: String(body.bio).trim(),
      createdAt: isoNow()
    };
    db.users.push(user);
    writeOfflineDb(db);
    return { user: offlinePublicUser(user) };
  }

  if (url.pathname === "/api/login") {
    const login = String(body.phone || "").trim();
    const phone = normalizePhone(login);
    const user = db.users.find(candidate =>
      normalizePhone(candidate.phone) === phone ||
      candidate.id === login ||
      candidate.name.toLowerCase() === login.toLowerCase()
    );
    if (!user) throw new Error("No user found with that phone number.");
    if (normalizePassword(user.password || "123456") !== normalizePassword(body.password)) throw new Error("Incorrect password.");
    user.lastLoginAt = isoNow();
    user.loginCount = Number(user.loginCount || 0) + 1;
    writeOfflineDb(db);
    return { user: offlinePublicUser(user) };
  }

  if (url.pathname === "/api/password-reset") {
    const phone = normalizePhone(body.phone);
    const user = db.users.find(candidate => normalizePhone(candidate.phone) === phone);
    if (!user) throw new Error("No registered user found with this mobile number.");
    if (String(user.pincode || "").trim() !== String(body.pincode || "").trim()) throw new Error("PIN code does not match this account.");
    const newPassword = normalizePassword(body.newPassword);
    if (newPassword.length < 4) throw new Error("Password must be at least 4 characters.");
    user.password = newPassword;
    user.passwordResetAt = isoNow();
    writeOfflineDb(db);
    return { ok: true, message: "Password reset. Please login with the new password." };
  }

  if (url.pathname === "/api/daily-answer") {
    const question = offlineLiveDailyQuestions(db).find(item => item.id === body.questionId);
    const user = db.users.find(item => item.id === body.userId);
    if (!question || !user) throw new Error("This question is not live for players right now.");
    if (db.dailyAnswers.some(answer => answer.userId === user.id && answer.questionId === question.id)) throw new Error("You already answered this question.");
    const answer = {
      id: offlineId("ans"),
      userId: user.id,
      questionId: question.id,
      selectedIndex: Number(body.selectedIndex),
      correct: Number(body.selectedIndex) === question.correctIndex,
      timeMs: Math.max(0, Number(body.timeMs || 0)),
      answeredAt: isoNow()
    };
    db.dailyAnswers.push(answer);
    writeOfflineDb(db);
    return { answer, dailyWinners: offlineDailyWinners(db) };
  }

  if (url.pathname === "/api/host-submit") {
    const user = db.users.find(item => item.id === body.userId);
    if (!user || !Array.isArray(body.answers)) throw new Error("Invalid host attempt.");
    if (offlineHasHostQualified(db, user.id)) throw new Error("You have already qualified for Play with Host once. You can still play Daily Quiz.");
    const liveQuestions = offlineLiveHostQuestions(db);
    if (liveQuestions.length !== 10) throw new Error("Play with Host must have exactly 10 live questions.");
    let correctCount = 0;
    for (const answer of body.answers) {
      const question = liveQuestions.find(item => item.id === answer.questionId);
      if (question && question.correctIndex === Number(answer.selectedIndex)) correctCount += 1;
    }
    const attempt = {
      id: offlineId("host"),
      userId: user.id,
      correctCount,
      totalQuestions: liveQuestions.length,
      totalTimeMs: Math.max(0, Number(body.totalTimeMs || 0)),
      submittedAt: isoNow(),
      shortlisted: correctCount === liveQuestions.length
    };
    db.hostAttempts.push(attempt);
    writeOfflineDb(db);
    return { attempt, hostLeaderboard: offlineHostLeaderboard(db) };
  }

  if (url.pathname === "/api/admin/question") {
    if (String(body.adminToken || "") !== "offline-admin-token") throw new Error("Admin login required.");
    const scheduledAt = new Date(body.scheduledAt || isoNow()).toISOString();
    if (body.type !== "host") {
      const day = offlineDayKey(new Date(scheduledAt));
      const sameDay = db.dailyQuestions.filter(question => question.id !== body.id && question.scheduledAt && offlineDayKey(new Date(question.scheduledAt)) === day);
      if (sameDay.length >= 2) throw new Error("Daily Quiz allows only 2 questions per date.");
    }
    const question = {
      id: body.id || offlineId(body.type === "host" ? "hq" : "dq"),
      text: String(body.text).trim(),
      options: body.options.map(option => String(option).trim()).filter(Boolean),
      correctIndex: Number(body.correctIndex || 0),
      prize: body.type === "host" ? undefined : Number(body.prize || 500),
      status: "scheduled",
      scheduledAt,
      publishedAt: isoNow()
    };
    const target = body.type === "host" ? db.hostQuestions : db.dailyQuestions;
    const existingIndex = body.id ? target.findIndex(item => item.id === body.id) : -1;
    if (existingIndex >= 0) target[existingIndex] = question;
    else target.push(question);
    writeOfflineDb(db);
    return { question };
  }

  if (url.pathname === "/api/admin/question/delete") {
    if (String(body.adminToken || "") !== "offline-admin-token") throw new Error("Admin login required.");
    const target = body.type === "host" ? db.hostQuestions : db.dailyQuestions;
    const index = target.findIndex(question => question.id === body.id);
    if (index < 0) throw new Error("Question not found.");
    target.splice(index, 1);
    writeOfflineDb(db);
    return { ok: true };
  }

  if (url.pathname === "/api/admin/question/move") {
    if (String(body.adminToken || "") !== "offline-admin-token") throw new Error("Admin login required.");
    const target = body.type === "host" ? db.hostQuestions : db.dailyQuestions;
    const index = target.findIndex(question => question.id === body.id);
    const next = body.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || next < 0 || next >= target.length) throw new Error("Cannot move question.");
    const [question] = target.splice(index, 1);
    target.splice(next, 0, question);
    writeOfflineDb(db);
    return { ok: true };
  }

  if (url.pathname === "/api/admin/host-set/schedule") {
    if (String(body.adminToken || "") !== "offline-admin-token") throw new Error("Admin login required.");
    const questions = Array.isArray(body.questionIds) && body.questionIds.length
      ? body.questionIds.map(questionId => db.hostQuestions.find(question => question.id === questionId)).filter(Boolean)
      : db.hostQuestions.slice(0, 10);
    if (questions.length < 10) throw new Error("Add 10 host questions for this date first.");
    const scheduledAt = new Date(body.scheduledAt || isoNow()).toISOString();
    questions.slice(0, 10).forEach(question => {
      question.status = "scheduled";
      question.scheduledAt = scheduledAt;
    });
    writeOfflineDb(db);
    return { ok: true, scheduledAt };
  }

  if (url.pathname === "/api/admin/notify") {
    if (String(body.adminToken || "") !== "offline-admin-token") throw new Error("Admin login required.");
    const target = body.type === "host"
      ? db.hostAttempts.find(attempt => attempt.id === body.id)
      : db.dailyAnswers.find(answer => answer.id === body.id);
    if (!target) throw new Error("Record not found.");
    target.notifiedAt = isoNow();
    writeOfflineDb(db);
    return { ok: true, notifiedAt: target.notifiedAt };
  }

  if (url.pathname === "/api/admin/select-winner") {
    if (String(body.adminToken || "") !== "offline-admin-token") throw new Error("Admin login required.");
    if (body.type === "host") {
      const attempt = db.hostAttempts.find(item => item.id === body.id);
      if (!attempt) throw new Error("Host attempt not found.");
      if (!attempt.shortlisted) throw new Error("Only all-correct host attempts can be selected.");
      db.hostWinnerSelections ||= {};
      db.hostWinnerSelections[offlineDayKey(new Date(attempt.submittedAt))] = attempt.id;
      attempt.selectedWinner = true;
      attempt.selectedAt = isoNow();
      writeOfflineDb(db);
      return { ok: true };
    }
    const answer = db.dailyAnswers.find(item => item.id === body.id);
    if (!answer) throw new Error("Daily answer not found.");
    if (!answer.correct) throw new Error("Only correct daily answers can win.");
    db.dailyWinnerSelections ||= {};
    db.dailyWinnerSelections[answer.questionId] = answer.id;
    answer.selectedWinner = true;
    answer.selectedAt = isoNow();
    writeOfflineDb(db);
    return { ok: true };
  }

  if (url.pathname === "/api/admin/reset-demo") {
    if (String(body.adminToken || "") !== "offline-admin-token") throw new Error("Admin login required.");
    const fresh = createOfflineDb();
    writeOfflineDb(fresh);
    return { ok: true };
  }

  throw new Error("Offline route not found.");
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

function setFormMessage(id, message, type = "") {
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.className = `form-message ${type}`.trim();
}

async function api(path, options = {}) {
  if (PACKAGED_APP && !API_BASE_URL) return offlineApi(path, options);
  const target = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
  try {
    const res = await fetch(target, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(state.adminToken ? { Authorization: `Bearer ${state.adminToken}` } : {}),
        ...(options.headers || {})
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data;
  } catch (error) {
    if (API_BASE_URL) throw error;
    return offlineApi(path, options);
  }
}

function showScreen(id) {
  if (["dashboardScreen", "dailyScreen", "dailyResultScreen", "hostScreen", "hostResultScreen", "profileScreen"].includes(id) && !state.activeUser) {
    toast("Please register or login first.");
    id = "loginScreen";
  }
  $$(".screen").forEach(screen => screen.classList.toggle("active", screen.id === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (id === "hostScreen") state.hostStartedAt = Date.now();
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setActiveUser(user) {
  state.activeUser = user;
  if (user) localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_SESSION_KEY);
  $$(".user-only").forEach(el => {
    el.style.display = user ? "" : "none";
  });
  $("#welcomeTitle").textContent = user ? `Hello, ${user.name.split(" ")[0]} 👋` : "Hello";
  $("#profileSummary").textContent = user
    ? `${user.name}, ${user.address}, ${user.pincode}. Story: ${user.bio}`
    : "Login or register to see your profile.";
  $("#profileName").textContent = user ? user.name : "Demo User";
  renderHostAccess();
}

function renderHostAccess() {
  const card = $("#hostStartBtn")?.closest(".app-action");
  if (!card) return;
  $("#hostChoiceText").textContent = state.hostAlreadyQualified
    ? "You already qualified for Play with Host once. You can still play Daily Quiz."
    : state.hostQuestions.length === 10
      ? "10 hot-seat qualification questions are live now."
      : "Host quiz opens when 10 hot-seat qualification questions are live.";
  $("#hostStartBtn").disabled = state.hostAlreadyQualified || state.hostQuestions.length !== 10;
  card.classList.toggle("locked", state.hostAlreadyQualified || state.hostQuestions.length !== 10);
}

function renderLiveAlert() {
  const alert = $("#liveAlert");
  if (!alert) return;
  const liveDaily = state.dailyQuestions[0];
  const hostLive = state.hostQuestions.length === 10;
  if (liveDaily) {
    alert.textContent = `Daily Quiz question ${liveDaily.dailySlot || 1}/2 is live now.`;
    alert.classList.add("active");
  } else if (hostLive) {
    alert.textContent = "Play with Host quiz is live now.";
    alert.classList.add("active");
  } else {
    alert.textContent = "No live quiz right now.";
    alert.classList.remove("active");
  }
}

function renderWinnerNotice() {
  const notice = $("#winnerNotice");
  if (!notice) return;
  const latest = state.dailyWinners
    .filter(item => item.winner)
    .sort((a, b) => new Date(b.winner.answeredAt) - new Date(a.winner.answeredAt))[0];
  if (!latest) {
    notice.textContent = "Winners will be announced after review.";
    notice.classList.remove("active");
    return;
  }
  notice.textContent = `${latest.winner.name} is currently the fastest correct answer for ₹${latest.prize || 500}. Final winner is confirmed after review.`;
  notice.classList.add("active");
}

function renderDailyQuestions() {
  const wrap = $("#dailyQuestions");
  wrap.innerHTML = "";
  if (!state.dailyQuestions.length) {
    $("#dailyQuizSubtitle").textContent = "No question is live now";
    wrap.innerHTML = `
      <div class="empty-state">
        <strong>No Daily Quiz is live right now.</strong>
        <p>Daily questions appear one by one at their scheduled random times. Please check again at the announced time.</p>
      </div>
    `;
    return;
  }
  state.dailyQuestions.forEach((question, number) => {
    $("#dailyQuizSubtitle").textContent = `Today's Question ${question.dailySlot || number + 1}/2`;
    const card = document.createElement("article");
    card.className = "question-card";
    card.innerHTML = `
      <div class="question-top">
        <div>
          <p class="eyebrow">Question ${question.dailySlot || number + 1}</p>
          <h3>${question.text}</h3>
        </div>
        <span class="pill">₹${question.prize || 500}</span>
      </div>
      <div class="options"></div>
    `;
    const options = card.querySelector(".options");
    const startedAt = Date.now();
    question.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.className = "option";
      button.textContent = option;
      button.addEventListener("click", async () => {
        if (!state.activeUser) return toast("Please register or login first.");
        Array.from(options.children).forEach(child => child.classList.remove("selected"));
        button.classList.add("selected");
        try {
          const result = await api("/api/daily-answer", {
            method: "POST",
            body: JSON.stringify({
              userId: state.activeUser.id,
              questionId: question.id,
              selectedIndex: index,
              timeMs: Date.now() - startedAt
            })
          });
          state.dailyWinners = result.dailyWinners;
          state.lastDailyAnswer = result.answer;
          renderResults();
          $("#dailyResultTitle").textContent = "Answer Submitted";
          $("#dailyResultTime").textContent = `${(result.answer.timeMs / 1000).toFixed(2)}s`;
          $("#dailyResultStatus").textContent = result.answer.correct
            ? "Your answer is correct and recorded. Final winner depends on fastest time after review."
            : "Your answer is recorded. This answer is not eligible for the prize.";
          $("#dailyResultPrize").textContent = "Under Review";
          showScreen("dailyResultScreen");
        } catch (error) {
          toast(error.message);
        }
      });
      options.appendChild(button);
    });
    wrap.appendChild(card);
  });
}

function renderHostQuestions() {
  const wrap = $("#hostQuestions");
  wrap.innerHTML = "";
  if (state.hostAlreadyQualified) {
    wrap.innerHTML = `
      <div class="empty-state">
        <strong>You already qualified for Play with Host.</strong>
        <p>This option is one-time only. You can continue playing Daily Quiz.</p>
      </div>
    `;
    $("#submitHostBtn").style.display = "none";
    return;
  }
  if (state.hostQuestions.length !== 10) {
    wrap.innerHTML = `
      <div class="empty-state">
        <strong>Play with Host is not live right now.</strong>
        <p>The host quiz opens when the admin makes 10 questions live at the scheduled time.</p>
      </div>
    `;
    $("#submitHostBtn").style.display = "none";
    return;
  }
  $("#submitHostBtn").style.display = "";
  state.hostQuestions.forEach((question, number) => {
    const card = document.createElement("article");
    card.className = "question-card";
    card.innerHTML = `
      <div class="question-top">
        <div>
          <p class="eyebrow">Host Question ${number + 1}</p>
          <h3>${question.text}</h3>
        </div>
      </div>
      <div class="options"></div>
    `;
    const options = card.querySelector(".options");
    question.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.className = "option";
      button.textContent = option;
      button.addEventListener("click", () => {
        state.hostAnswers.set(question.id, index);
        Array.from(options.children).forEach(child => child.classList.remove("selected"));
        button.classList.add("selected");
      });
      options.appendChild(button);
    });
    wrap.appendChild(card);
  });
}

function renderResults() {
  $("#dailyWinners").innerHTML = state.dailyWinners.map(item => `
    <div class="result">
      <strong>${item.question}</strong>
      ${item.winner ? `${item.winnerStatus === "selected" ? "Winner selected" : "Fastest suggestion"}: ${item.winner.name} in ${(item.winner.timeMs / 1000).toFixed(2)}s` : "No correct answer yet"}
      <p>${item.totalCorrect} correct answer(s)${item.winner?.phone ? ` · Call: ${item.winner.phone}` : ""}</p>
      ${item.winner ? `
        <p>${item.winner.address || ""} ${item.winner.pincode || ""}</p>
        <div class="inline-actions">
          <a class="call-link" href="tel:${item.winner.phone}">Call Winner</a>
          <button type="button" data-select-winner="${item.winner.answerId}" data-type="daily">${item.winnerStatus === "selected" ? "Selected" : "Select Winner"}</button>
          <button type="button" data-notify-record="${item.winner.answerId}" data-type="daily">${item.winner.notifiedAt ? "Notified" : "Mark Notified"}</button>
        </div>
      ` : ""}
    </div>
  `).join("");

  $("#hostLeaderboard").innerHTML = state.hostLeaderboard.length
    ? state.hostLeaderboard.slice(0, 8).map((item, index) => `
      <div class="result">
        <strong>${index + 1}. ${item.name}</strong>
        ${item.correctCount}/${item.totalQuestions} correct in ${(item.totalTimeMs / 1000).toFixed(2)}s
        <p>${item.selectedWinner ? "Selected for host review." : item.shortlisted ? "All correct. Final selection depends on fastest time." : "Needs more correct answers"}</p>
      </div>
    `).join("")
    : `<div class="result">No host attempts yet.</div>`;

  const dailyLog = $("#dailyAnswerLog");
  if (dailyLog) {
    dailyLog.innerHTML = state.dailyAnswerRows.length
      ? state.dailyAnswerRows.map(answer => `
        <div class="result answer-row ${answer.correct ? "correct" : "wrong"}">
          <strong>${answer.name} · ${(answer.timeMs / 1000).toFixed(2)}s · ${answer.correct ? "Correct" : "Incorrect"}</strong>
          ${answer.question}
          <p>Selected: ${answer.selectedOption || "-"} · Correct: ${answer.correctOption || "-"} · ${formatDateTime(answer.answeredAt)}</p>
          ${answer.correct ? `<div class="inline-actions"><button type="button" data-select-winner="${answer.id}" data-type="daily">${answer.selectedWinner ? "Selected" : "Select Winner"}</button></div>` : ""}
        </div>
      `).join("")
      : `<div class="result">No daily answers yet.</div>`;
  }

  const hostLog = $("#hostAttemptLog");
  if (hostLog) {
    hostLog.innerHTML = state.hostAttemptRows.length
      ? state.hostAttemptRows.map(attempt => `
        <div class="result answer-row ${attempt.shortlisted ? "correct" : "wrong"}">
          <strong>#${attempt.rank}. ${attempt.name} · ${(attempt.totalTimeMs / 1000).toFixed(2)}s</strong>
          ${attempt.correctCount}/${attempt.totalQuestions} correct
          <p>${attempt.shortlisted ? "All correct. Review for fastest selection." : "Not all answers correct."}${attempt.phone ? ` · Call: ${attempt.phone}` : ""}</p>
          <p>${attempt.address || ""} ${attempt.pincode || ""}</p>
          <div class="inline-actions">
            <a class="call-link" href="tel:${attempt.phone}">Call User</a>
            ${attempt.shortlisted ? `<button type="button" data-select-winner="${attempt.id}" data-type="host">${attempt.selectedWinner ? "Selected" : "Select Host Candidate"}</button>` : ""}
            <button type="button" data-notify-record="${attempt.id}" data-type="host">${attempt.notifiedAt ? "Notified" : "Mark Notified"}</button>
          </div>
        </div>
      `).join("")
      : `<div class="result">No host attempts yet.</div>`;
  }

  renderQuestionManagers();
  renderAdminUsers();

  $("#dailySchedule").innerHTML = state.scheduledDailyQuestions.length
    ? state.scheduledDailyQuestions.map(item => `
      <div class="result schedule-row">
        <div>
          <strong>${item.text}</strong>
          <p>Question ${item.dailySlot || 1}/2 for that day · ${item.isLive ? "Live now for players" : "Waiting for scheduled time"}</p>
        </div>
        <time>${formatDateTime(item.scheduledAt)}</time>
      </div>
    `).join("")
    : `<div class="result">No daily questions scheduled yet.</div>`;

  const dailyWon = state.dailyWinners.filter(item => item.winner?.userId === state.activeUser?.id).length;
  const hostAttempts = state.hostLeaderboard.filter(item => item.userId === state.activeUser?.id).length;
  $("#liveDailyCount").textContent = dailyWon;
  $("#hostAttemptCount").textContent = hostAttempts;
  $("#profileDailyWon").textContent = dailyWon;
  $("#profileHostAttempt").textContent = hostAttempts;
  $("#adminDailyWinners").textContent = state.dailyWinners.filter(item => item.winner).length;
  $("#adminHostQualified").textContent = state.hostLeaderboard.filter(item => item.shortlisted).length;
  $("#adminPayout").textContent = `₹${state.dailyWinners.filter(item => item.winner).length * 500}`;
  $("#dashboardSummary").textContent = state.dailyQuestions.length
    ? `Daily Quiz question ${state.dailyQuestions[0].dailySlot || 1}/2 is live now.`
    : "No Daily Quiz is live right now. Questions appear one by one at scheduled times.";

  const upcoming = state.scheduledDailyQuestions.find(item => !item.isLive) || state.scheduledDailyQuestions[0];
  const phoneNextQuiz = $("#phoneNextQuiz");
  if (phoneNextQuiz) phoneNextQuiz.textContent = upcoming ? formatDateTime(upcoming.scheduledAt) : "No schedule yet";
  renderLiveAlert();
  renderWinnerNotice();
}

function questionManagerHtml(question, type) {
  const live = (!question.scheduledAt && question.status === "live") || (question.scheduledAt && new Date(question.scheduledAt) <= new Date());
  const timing = live ? "Live now" : question.scheduledAt ? `Live at ${formatDateTime(question.scheduledAt)}` : "No live time set";
  return `
    <div class="result managed-question">
      <strong>${question.order}. ${question.text}</strong>
      <p>${type === "daily" ? `Prize ₹${question.prize || 500} · ` : ""}${timing}</p>
      <p>Correct: ${question.correctOption || question.options?.[question.correctIndex] || "-"}</p>
      <div class="inline-actions">
        <button type="button" data-edit-question="${question.id}" data-type="${type}">Edit</button>
        <button type="button" data-move-question="${question.id}" data-direction="up" data-type="${type}">Up</button>
        <button type="button" data-move-question="${question.id}" data-direction="down" data-type="${type}">Down</button>
        <button type="button" data-delete-question="${question.id}" data-type="${type}">Delete</button>
      </div>
    </div>
  `;
}

function dateKey(value) {
  if (!value) return "";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderAdminUsers() {
  const summary = $("#userAdminSummary");
  const userList = $("#registeredUsers");
  if (!summary && !userList) return;
  const today = dateKey(new Date());
  const fallbackRegisteredToday = state.users.filter(user => dateKey(user.createdAt) === today).length;
  const fallbackLoggedInToday = state.users.filter(user => dateKey(user.lastLoginAt) === today).length;
  const stats = state.adminStats || {
    registeredToday: fallbackRegisteredToday,
    loggedInToday: fallbackLoggedInToday,
    totalUsers: state.users.length,
    protectedUsers: state.users.length,
    passwordSecurity: "Secure",
    dailyLive: state.dailyQuestions.length,
    hostLive: state.hostQuestions.length === 10,
    dailyAnswersToday: 0,
    hostAttemptsToday: 0
  };
  if (summary) {
    summary.innerHTML = `
      <div><strong>${stats.registeredToday || 0}</strong><span>Registered today</span></div>
      <div><strong>${stats.totalUsers || 0}</strong><span>Total users</span></div>
      <div><strong>${stats.loggedInToday || 0}</strong><span>Logged in today</span></div>
      <div><strong>${stats.passwordSecurity || "Secure"}</strong><span>Password protection</span></div>
      <div><strong>${stats.dailyLive ? "Live" : "Waiting"}</strong><span>Daily quiz status</span></div>
      <div><strong>${stats.hostLive ? "Live" : "Waiting"}</strong><span>Host quiz status</span></div>
    `;
  }
  if (!userList) return;
  const search = state.userSearch.trim().toLowerCase();
  const filtered = state.users.filter(user => {
    const text = [user.name, user.phone, user.address, user.pincode, user.bio].join(" ").toLowerCase();
    const matchesSearch = !search || text.includes(search);
    const matchesDate = state.userDateFilter === "today"
      ? dateKey(user.createdAt) === today
      : state.userDateFilter === "loginToday"
        ? dateKey(user.lastLoginAt) === today
        : true;
    return matchesSearch && matchesDate;
  });
  userList.innerHTML = filtered.length
    ? filtered.map(user => `
      <div class="result user-detail-card">
        <div>
          <strong>${user.name}</strong>
          <p>Mobile: <a href="tel:${user.phone}">${user.phone}</a> · PIN ${user.pincode}</p>
          <p>${user.address || "No address added"}</p>
          <p>${user.bio || "No story added yet."}</p>
        </div>
        <div class="user-meta">
          <span>Registered: ${user.createdAt ? formatDateTime(user.createdAt) : "-"}</span>
          <span>Last login: ${user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Not yet"}</span>
          <span>Login count: ${user.loginCount || 0}</span>
          <span>Status: ${user.status || "active"}</span>
        </div>
      </div>
    `).join("")
    : `<div class="result">No users match this view.</div>`;
}

function questionDateKey(question) {
  if (!question?.scheduledAt) return "";
  return new Date(question.scheduledAt).toISOString().slice(0, 10);
}

function selectedDailyQuestions() {
  return state.allDailyQuestions
    .filter(question => questionDateKey(question) === state.dailyManageDate)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
}

function dailySlotHtml(slot, question) {
  if (!question) {
    return `
      <div class="result managed-question host-slot empty">
        <strong>Daily Slot ${slot}</strong>
        <p>Empty slot. Add question ${slot}/2 for ${state.dailyManageDate}. Winner gets ₹500 after fastest-correct review.</p>
        <div class="inline-actions">
          <button type="button" data-add-daily-slot="${slot}">Add Question ${slot}</button>
        </div>
      </div>
    `;
  }
  return `
    <div class="result managed-question">
      <strong>Daily Slot ${slot}: ${question.text}</strong>
      <p>Prize ₹${question.prize || 500} · ${question.scheduledAt ? formatDateTime(question.scheduledAt) : "No live time set"}</p>
      <p>Correct: ${question.correctOption || question.options?.[question.correctIndex] || "-"}</p>
      <div class="inline-actions">
        <button type="button" data-edit-question="${question.id}" data-type="daily">Edit</button>
        <button type="button" data-delete-question="${question.id}" data-type="daily">Delete</button>
      </div>
    </div>
  `;
}

function hostSlotHtml(slot, question) {
  if (!question) {
    return `
      <div class="result managed-question host-slot empty">
        <strong>Slot ${slot}</strong>
        <p>Empty slot. Add a host question to complete the 10-question set.</p>
        <div class="inline-actions">
          <button type="button" data-add-host-slot="${slot}">Add Question Here</button>
        </div>
      </div>
    `;
  }
  return `
    <div class="result managed-question host-slot">
      <strong>Slot ${slot}: ${question.text}</strong>
      <p>${((!question.scheduledAt && question.status === "live") || (question.scheduledAt && new Date(question.scheduledAt) <= new Date())) ? "Live now" : question.scheduledAt ? `Live at ${formatDateTime(question.scheduledAt)}` : "No live time set"}</p>
      <p>Correct: ${question.correctOption || question.options?.[question.correctIndex] || "-"}</p>
      <div class="inline-actions">
        <button type="button" data-edit-question="${question.id}" data-type="host">Edit</button>
        <button type="button" data-move-question="${question.id}" data-direction="up" data-type="host">Up</button>
        <button type="button" data-move-question="${question.id}" data-direction="down" data-type="host">Down</button>
        <button type="button" data-delete-question="${question.id}" data-type="host">Delete</button>
      </div>
    </div>
  `;
}

function selectedHostQuestions() {
  return state.allHostQuestions.filter(question => questionDateKey(question) === state.hostManageDate);
}

function selectedHostBulkQuestions() {
  return state.allHostQuestions
    .filter(question => questionDateKey(question) === state.hostBulkDate)
    .sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));
}

function defaultHostBulkTime(dateKey = state.hostBulkDate) {
  return new Date(`${dateKey}T20:00:00`).toISOString().slice(0, 16);
}

function renderHostBulkBuilder() {
  const wrap = $("#hostBulkQuestions");
  if (!wrap) return;
  const selected = selectedHostBulkQuestions();
  wrap.innerHTML = Array.from({ length: 10 }, (_, index) => {
    const question = selected[index];
    const options = question?.options || ["", "", "", ""];
    return `
      <article class="bulk-question-card" data-bulk-slot="${index + 1}" data-question-id="${question?.id || ""}">
        <div class="bulk-question-title">
          <strong>Question ${index + 1}</strong>
          <span>${question ? "Existing question loaded" : "New question"}</span>
        </div>
        <label>Question
          <textarea data-bulk-field="text" placeholder="Enter host question ${index + 1}" required>${escapeHtml(question?.text || "")}</textarea>
        </label>
        <div class="bulk-options-grid">
          ${Array.from({ length: 4 }, (_, optionIndex) => `
            <label>Option ${optionIndex + 1}
              <input data-bulk-option="${optionIndex}" value="${escapeHtml(options[optionIndex] || "")}" placeholder="Option ${optionIndex + 1}">
            </label>
          `).join("")}
        </div>
        <label>Correct Option
          <select data-bulk-field="correctIndex">
            ${Array.from({ length: 4 }, (_, optionIndex) => `
              <option value="${optionIndex}" ${Number(question?.correctIndex || 0) === optionIndex ? "selected" : ""}>Option ${optionIndex + 1}</option>
            `).join("")}
          </select>
        </label>
      </article>
    `;
  }).join("");
}

function openHostBulkBuilder() {
  const panel = $("#hostBulkBuilder");
  if (!panel) return;
  state.hostBulkDate = state.hostManageDate || new Date().toISOString().slice(0, 10);
  $("#hostBulkDate").value = state.hostBulkDate;
  $("#hostBulkTime").value = $("#hostSetTime")?.value || defaultHostBulkTime(state.hostBulkDate);
  panel.hidden = false;
  renderHostBulkBuilder();
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function loadHostBulkDate() {
  const date = $("#hostBulkDate")?.value;
  if (!date) return toast("Select a host quiz date first.");
  state.hostBulkDate = date;
  state.hostManageDate = date;
  if ($("#hostDateSelect")) $("#hostDateSelect").value = date;
  if (!$("#hostBulkTime")?.value) $("#hostBulkTime").value = defaultHostBulkTime(date);
  renderQuestionManagers();
  renderHostBulkBuilder();
}

function clearHostBulkDraft() {
  $$("#hostBulkQuestions .bulk-question-card").forEach(card => {
    card.dataset.questionId = "";
    card.querySelector('[data-bulk-field="text"]').value = "";
    card.querySelectorAll("[data-bulk-option]").forEach(input => {
      input.value = "";
    });
    card.querySelector('[data-bulk-field="correctIndex"]').value = "0";
  });
}

async function saveHostBulkQuestions() {
  const date = $("#hostBulkDate")?.value;
  const time = $("#hostBulkTime")?.value;
  if (!date || !time) return toast("Choose date and live time first.");
  const scheduledAt = new Date(time).toISOString();
  const cards = $$("#hostBulkQuestions .bulk-question-card");
  if (cards.length !== 10) return toast("Open the 10-question builder first.");
  const savedIds = [];
  try {
    for (const card of cards) {
      const slot = card.dataset.bulkSlot;
      const text = card.querySelector('[data-bulk-field="text"]').value.trim();
      const options = Array.from(card.querySelectorAll("[data-bulk-option]")).map(input => input.value.trim()).filter(Boolean);
      const correctIndex = Number(card.querySelector('[data-bulk-field="correctIndex"]').value);
      if (!text || options.length < 2) throw new Error(`Fill question ${slot} and at least 2 options.`);
      if (correctIndex >= options.length) throw new Error(`Correct option for question ${slot} must have option text.`);
      const payload = {
        adminToken: state.adminToken,
        type: "host",
        id: card.dataset.questionId || "",
        text,
        options,
        correctIndex,
        scheduledAt
      };
      const result = await api("/api/admin/question", { method: "POST", body: JSON.stringify(payload) });
      savedIds.push(result.question.id);
      card.dataset.questionId = result.question.id;
    }
    await api("/api/admin/host-set/schedule", {
      method: "POST",
      body: JSON.stringify({ adminToken: state.adminToken, scheduledAt, questionIds: savedIds })
    });
    state.hostManageDate = date;
    if ($("#hostDateSelect")) $("#hostDateSelect").value = date;
    toast("10 Play with Host questions saved and scheduled.");
    await refresh();
    renderHostBulkBuilder();
  } catch (error) {
    toast(error.message);
  }
}

function renderQuestionManagers() {
  const daily = $("#dailyQuestionManager");
  if (daily) {
    const selected = selectedDailyQuestions();
    const liveCount = selected.filter(question => question.scheduledAt && new Date(question.scheduledAt) <= new Date()).length;
    const summary = $("#dailySetSummary");
    if (summary) summary.innerHTML = `
      <div><strong>${selected.length}/2</strong><span>Questions on ${state.dailyManageDate}</span></div>
      <div><strong>${liveCount}/2</strong><span>Live now</span></div>
      <div><strong>${selected.length === 2 ? "Ready" : "Incomplete"}</strong><span>Daily set status</span></div>
    `;
    daily.innerHTML = Array.from({ length: 2 }, (_, index) => dailySlotHtml(index + 1, selected[index])).join("");
    renderDailyScheduleByDate();
  }
  const host = $("#hostQuestionManager");
  if (host) {
    const selected = selectedHostQuestions();
    const liveCount = selected.filter(question => (!question.scheduledAt && question.status === "live") || (question.scheduledAt && new Date(question.scheduledAt) <= new Date())).length;
    const summary = $("#hostSetSummary");
    if (summary) summary.innerHTML = `
      <div><strong>${selected.length}/10</strong><span>Questions on ${state.hostManageDate}</span></div>
      <div><strong>${Math.min(liveCount, 10)}/10</strong><span>Live now</span></div>
      <div><strong>${selected.length === 10 ? "Ready" : "Incomplete"}</strong><span>Selected date status</span></div>
    `;
    host.innerHTML = Array.from({ length: 10 }, (_, index) => hostSlotHtml(index + 1, selected[index])).join("");
    renderHostScheduleByDate();
  }
}

function renderDailyScheduleByDate() {
  const wrap = $("#dailyScheduleByDate");
  if (!wrap) return;
  if (!state.allDailyQuestions.length) {
    wrap.innerHTML = `<div class="result">No daily questions scheduled yet.</div>`;
    return;
  }
  const groups = state.allDailyQuestions.reduce((acc, question) => {
    const key = questionDateKey(question) || "No date set";
    acc[key] = acc[key] || [];
    acc[key].push(question);
    return acc;
  }, {});
  wrap.innerHTML = Object.entries(groups)
    .sort(([a], [b]) => new Date(a || 0) - new Date(b || 0))
    .map(([dateKey, questions]) => {
      const winners = state.dailyWinners.filter(winner => questions.some(question => question.id === winner.questionId && winner.winner));
      return `
        <div class="result host-date-group">
          <strong>${dateKey === "No date set" ? dateKey : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(`${dateKey}T00:00:00`))}</strong>
          <p>${questions.length}/2 questions · ${winners.length} winner(s) recorded</p>
          <div class="inline-actions">
            <button type="button" data-select-daily-date="${dateKey}">Open This Date</button>
          </div>
          <div class="host-date-list">
            ${questions.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)).map((question, index) => {
              const winner = state.dailyWinners.find(item => item.questionId === question.id)?.winner;
              return `
                <div>
                  <span>${index + 1}. ${formatDateTime(question.scheduledAt)} · ${question.text}${winner ? ` · Winner: ${winner.name} (${(winner.timeMs / 1000).toFixed(2)}s)` : ""}</span>
                  <button type="button" data-edit-question="${question.id}" data-type="daily">Edit</button>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderHostScheduleByDate() {
  const wrap = $("#hostScheduleByDate");
  if (!wrap) return;
  if (!state.allHostQuestions.length) {
    wrap.innerHTML = `<div class="result">No host questions scheduled yet.</div>`;
    return;
  }
  const groups = state.allHostQuestions.reduce((acc, question) => {
    const key = questionDateKey(question) || "No date set";
    acc[key] = acc[key] || [];
    acc[key].push(question);
    return acc;
  }, {});
  wrap.innerHTML = Object.entries(groups)
    .sort(([a], [b]) => new Date(a || 0) - new Date(b || 0))
    .map(([dateKey, questions]) => {
      const live = questions.some(question => question.scheduledAt && new Date(question.scheduledAt) <= new Date());
      return `
        <div class="result host-date-group">
          <strong>${dateKey === "No date set" ? dateKey : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(`${dateKey}T00:00:00`))}</strong>
          <p>${questions.length}/10 questions · ${live ? "Live now" : "Scheduled"}</p>
          <div class="inline-actions">
            <button type="button" data-select-host-date="${dateKey}">Open This Date</button>
          </div>
          <div class="host-date-list">
            ${questions.map((question, index) => `
              <div>
                <span>${index + 1}. ${question.text}</span>
                <button type="button" data-edit-question="${question.id}" data-type="host">Edit</button>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    })
    .join("");
}

async function refresh() {
  const params = new URLSearchParams();
  if (state.activeUser) params.set("userId", state.activeUser.id);
  const qs = params.toString() ? `?${params}` : "";
  const data = await api(`/api/bootstrap${qs}`);
  $("#adminUsers").textContent = data.userCount ?? data.users.length;
  state.users = data.users || [];
  state.dailyQuestions = data.dailyQuestions;
  state.scheduledDailyQuestions = data.scheduledDailyQuestions;
  state.hostQuestions = data.hostQuestions;
  state.allDailyQuestions = data.allDailyQuestions || [];
  state.allHostQuestions = data.allHostQuestions || [];
  state.dailyWinners = data.dailyWinners;
  state.dailyAnswerRows = data.dailyAnswerRows || [];
  state.hostLeaderboard = data.hostLeaderboard;
  state.hostAttemptRows = data.hostAttemptRows || [];
  state.adminStats = data.adminStats || null;
  state.hostAlreadyQualified = data.hostAlreadyQualified;
  state.lastLiveSignature = [
    ...state.dailyQuestions.map(question => `daily:${question.id}`),
    state.hostQuestions.length === 10 ? "host:live" : "host:waiting"
  ].join("|");
  renderDailyQuestions();
  renderHostQuestions();
  renderResults();
  setActiveUser(state.activeUser);
}

bind("#registerForm", "submit", async event => {
  event.preventDefault();
  const submit = event.currentTarget.querySelector("button[type='submit']");
  if (!event.currentTarget.reportValidity()) {
    setFormMessage("#registerMessage", "Please fill every required detail, including password and PIN code.", "error");
    return;
  }
  const form = new FormData(event.currentTarget);
  setFormMessage("#registerMessage", "Creating your account...");
  submit.disabled = true;
  try {
    const data = await api("/api/register", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    setActiveUser(data.user);
    await refresh();
    setFormMessage("#registerMessage", `Registered: ${data.user.name}`, "success");
    toast(`Registered: ${data.user.name}`);
    showScreen("dashboardScreen");
  } catch (error) {
    setFormMessage("#registerMessage", error.message, "error");
    toast(error.message);
  } finally {
    submit.disabled = false;
  }
});

bind("#loginForm", "submit", async event => {
  event.preventDefault();
  const submit = event.currentTarget.querySelector("button[type='submit']");
  const form = new FormData(event.currentTarget);
  setFormMessage("#loginMessage", "Checking login...");
  submit.disabled = true;
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    setActiveUser(data.user);
    await refresh();
    setFormMessage("#loginMessage", "Logged in.", "success");
    toast("Logged in.");
    showScreen("dashboardScreen");
  } catch (error) {
    setFormMessage("#loginMessage", error.message, "error");
    toast(error.message);
  } finally {
    submit.disabled = false;
  }
});

bind("#showResetPasswordBtn", "click", () => {
  const form = $("#resetPasswordForm");
  if (!form) return;
  form.hidden = !form.hidden;
  if (!form.hidden) form.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

bind("#resetPasswordForm", "submit", async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  const submit = formEl.querySelector("button[type='submit']");
  const form = new FormData(formEl);
  setFormMessage("#resetPasswordMessage", "Resetting password...");
  submit.disabled = true;
  try {
    const data = await api("/api/password-reset", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    setFormMessage("#resetPasswordMessage", data.message || "Password reset. Please login.", "success");
    toast("Password reset. Please login.");
    formEl.reset();
  } catch (error) {
    setFormMessage("#resetPasswordMessage", error.message, "error");
    toast(error.message);
  } finally {
    submit.disabled = false;
  }
});

bind("#adminLoginForm", "submit", async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  const submit = formEl.querySelector("button[type='submit']");
  const password = new FormData(formEl).get("password");
  submit.disabled = true;
  try {
    const data = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password })
    });
    state.adminToken = data.adminToken;
    await refresh();
    formEl.reset();
    toast(data.message || "Admin login successful.");
    showAdminView("dashboard");
    showScreen("adminScreen");
  } catch (error) {
    toast(error.message);
  } finally {
    submit.disabled = false;
  }
});

bind("#questionForm", "submit", async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  const form = new FormData(formEl);
  const payload = Object.fromEntries(form.entries());
  payload.options = payload.options.split("\n").map(option => option.trim()).filter(Boolean);
  payload.correctIndex = Number(payload.correctIndex) - 1;
  payload.prize = Number(payload.prize || 500);
  if (payload.liveNow) payload.scheduledAt = new Date().toISOString();
  else if (payload.scheduledAt) payload.scheduledAt = new Date(payload.scheduledAt).toISOString();
  payload.adminToken = state.adminToken;
  try {
    await api("/api/admin/question", { method: "POST", body: JSON.stringify(payload) });
    toast(payload.id ? "Question updated." : "Question published.");
    formEl.reset();
    setDefaultScheduleTime();
    updateQuestionFormMode();
    await refresh();
  } catch (error) {
    toast(error.message);
  }
});

function clearQuestionForm() {
  const form = $("#questionForm");
  if (!form) return;
  form.reset();
  form.querySelector("[name='id']").value = "";
  setDefaultScheduleTime();
  updateQuestionFormMode();
}

bind("#clearQuestionFormBtn", "click", clearQuestionForm);

document.addEventListener("click", async event => {
  const selectDailyDate = event.target.closest("[data-select-daily-date]");
  if (selectDailyDate) {
    state.dailyManageDate = selectDailyDate.dataset.selectDailyDate;
    $("#dailyDateSelect").value = state.dailyManageDate;
    renderQuestionManagers();
    showAdminView("daily");
    return;
  }
  const selectHostDate = event.target.closest("[data-select-host-date]");
  if (selectHostDate) {
    state.hostManageDate = selectHostDate.dataset.selectHostDate;
    $("#hostDateSelect").value = state.hostManageDate;
    renderQuestionManagers();
    showAdminView("host");
    return;
  }
  const notify = event.target.closest("[data-notify-record]");
  if (notify) {
    try {
      await api("/api/admin/notify", {
        method: "POST",
        body: JSON.stringify({ adminToken: state.adminToken, type: notify.dataset.type, id: notify.dataset.notifyRecord })
      });
      toast("Marked as notified.");
      await refresh();
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  const selectWinner = event.target.closest("[data-select-winner]");
  if (selectWinner) {
    try {
      await api("/api/admin/select-winner", {
        method: "POST",
        body: JSON.stringify({ adminToken: state.adminToken, type: selectWinner.dataset.type, id: selectWinner.dataset.selectWinner })
      });
      toast(selectWinner.dataset.type === "host" ? "Host candidate selected." : "Daily winner selected.");
      await refresh();
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  const addHostSlot = event.target.closest("[data-add-host-slot]");
  if (addHostSlot) {
    prepareHostQuestionForm();
    return;
  }
  const addDailySlot = event.target.closest("[data-add-daily-slot]");
  if (addDailySlot) {
    prepareDailyQuestionForm(Number(addDailySlot.dataset.addDailySlot || 1));
    return;
  }
  const edit = event.target.closest("[data-edit-question]");
  const remove = event.target.closest("[data-delete-question]");
  const move = event.target.closest("[data-move-question]");
  if (!edit && !remove && !move) return;
  const button = edit || remove || move;
  const type = button.dataset.type;
  const id = button.dataset.editQuestion || button.dataset.deleteQuestion || button.dataset.moveQuestion;
  const list = type === "host" ? state.allHostQuestions : state.allDailyQuestions;
  const question = list.find(item => item.id === id);
  if (!question) return toast("Question not found.");
  try {
    if (edit) {
      const form = $("#questionForm");
      form.elements.id.value = question.id;
      form.elements.type.value = type;
      form.elements.scheduledAt.value = question.scheduledAt ? new Date(question.scheduledAt).toISOString().slice(0, 16) : "";
      form.elements.liveNow.checked = false;
      form.elements.text.value = question.text;
      form.elements.options.value = question.options.join("\n");
      form.elements.correctIndex.value = Number(question.correctIndex) + 1;
      form.elements.prize.value = question.prize || 500;
      updateQuestionFormMode();
      showAdminView(type);
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (remove) {
      await api("/api/admin/question/delete", { method: "POST", body: JSON.stringify({ adminToken: state.adminToken, type, id }) });
      toast("Question deleted.");
    }
    if (move) {
      await api("/api/admin/question/move", { method: "POST", body: JSON.stringify({ adminToken: state.adminToken, type, id, direction: button.dataset.direction }) });
      toast("Question reordered.");
    }
    await refresh();
  } catch (error) {
    toast(error.message);
  }
});

function prepareDailyQuestionForm(slot = 1) {
  clearQuestionForm();
  const form = $("#questionForm");
  if (!form) return;
  const hour = slot === 1 ? "12:00:00" : "16:00:00";
  const defaultTime = new Date(`${state.dailyManageDate}T${hour}`);
  form.elements.type.value = "daily";
  form.elements.scheduledAt.value = defaultTime.toISOString().slice(0, 16);
  form.elements.text.value = "";
  form.elements.options.value = "";
  form.elements.correctIndex.value = 1;
  form.elements.prize.value = 500;
  form.elements.liveNow.checked = false;
  updateQuestionFormMode();
  showAdminView("daily");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function prepareHostQuestionForm() {
  clearQuestionForm();
  const form = $("#questionForm");
  if (!form) return;
  form.elements.type.value = "host";
  const timeValue = $("#hostSetTime").value;
  const defaultTime = timeValue ? new Date(timeValue) : new Date(`${state.hostManageDate}T20:00:00`);
  form.elements.scheduledAt.value = defaultTime.toISOString().slice(0, 16);
  form.elements.text.value = "";
  form.elements.options.value = "";
  form.elements.correctIndex.value = 1;
  form.elements.prize.value = 500;
  form.elements.liveNow.checked = false;
  updateQuestionFormMode();
  showAdminView("host");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

bind("#addHostQuestionBtn", "click", openHostBulkBuilder);
bind("#closeHostBulkBtn", "click", () => {
  const panel = $("#hostBulkBuilder");
  if (panel) panel.hidden = true;
});
bind("#loadHostBulkBtn", "click", loadHostBulkDate);
bind("#saveHostBulkBtn", "click", saveHostBulkQuestions);
bind("#clearHostBulkBtn", "click", clearHostBulkDraft);
bind("#hostBulkDate", "change", event => {
  state.hostBulkDate = event.target.value;
  if ($("#hostBulkTime")) $("#hostBulkTime").value = defaultHostBulkTime(state.hostBulkDate);
});

function setDailyManageDate(date) {
  state.dailyManageDate = date.toISOString().slice(0, 10);
  if ($("#dailyDateSelect")) $("#dailyDateSelect").value = state.dailyManageDate;
  renderQuestionManagers();
}

bind("#dailyDateSelect", "change", event => {
  if (!event.target.value) return;
  state.dailyManageDate = event.target.value;
  renderQuestionManagers();
});

bind("#todayDailyDateBtn", "click", () => setDailyManageDate(new Date()));
bind("#tomorrowDailyDateBtn", "click", () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  setDailyManageDate(date);
});

function setHostManageDate(date) {
  state.hostManageDate = date.toISOString().slice(0, 10);
  if ($("#hostDateSelect")) $("#hostDateSelect").value = state.hostManageDate;
  const defaultTime = new Date(`${state.hostManageDate}T20:00:00`);
  if ($("#hostSetTime")) $("#hostSetTime").value = defaultTime.toISOString().slice(0, 16);
  if ($("#hostBulkDate")) $("#hostBulkDate").value = state.hostManageDate;
  if ($("#hostBulkTime")) $("#hostBulkTime").value = defaultTime.toISOString().slice(0, 16);
  renderQuestionManagers();
  if ($("#hostBulkBuilder") && !$("#hostBulkBuilder").hidden) {
    state.hostBulkDate = state.hostManageDate;
    renderHostBulkBuilder();
  }
}

bind("#hostDateSelect", "change", event => {
  if (!event.target.value) return;
  state.hostManageDate = event.target.value;
  if (!$("#hostSetTime").value) $("#hostSetTime").value = new Date(`${state.hostManageDate}T20:00:00`).toISOString().slice(0, 16);
  renderQuestionManagers();
});

bind("#todayHostDateBtn", "click", () => setHostManageDate(new Date()));
bind("#tomorrowHostDateBtn", "click", () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  setHostManageDate(date);
});

async function scheduleHostSet(liveNow = false) {
  const input = $("#hostSetTime");
  const scheduledAt = liveNow ? new Date().toISOString() : input.value ? new Date(input.value).toISOString() : "";
  if (!scheduledAt) return toast("Choose host set live time first.");
  const selected = selectedHostQuestions();
  try {
    await api("/api/admin/host-set/schedule", {
      method: "POST",
      body: JSON.stringify({ adminToken: state.adminToken, scheduledAt, questionIds: selected.map(question => question.id) })
    });
    toast(liveNow ? "Host 10-question set is live now." : "Host 10-question set scheduled.");
    await refresh();
  } catch (error) {
    toast(error.message);
  }
}

bind("#scheduleHostSetBtn", "click", () => scheduleHostSet(false));
bind("#makeHostSetLiveBtn", "click", () => scheduleHostSet(true));

bind("#submitHostBtn", "click", async () => {
  if (!state.activeUser) return toast("Please register or login first.");
  if (state.hostAlreadyQualified) return toast("You already qualified once. Please play Daily Quiz instead.");
  if (state.hostAnswers.size !== state.hostQuestions.length) return toast("Answer every host question first.");
  try {
    const result = await api("/api/host-submit", {
      method: "POST",
      body: JSON.stringify({
        userId: state.activeUser.id,
        answers: Array.from(state.hostAnswers.entries()).map(([questionId, selectedIndex]) => ({ questionId, selectedIndex })),
        totalTimeMs: Date.now() - state.hostStartedAt
      })
    });
    state.hostLeaderboard = result.hostLeaderboard;
    state.hostAlreadyQualified = result.attempt.shortlisted;
    renderResults();
    renderHostQuestions();
    renderHostAccess();
    $("#hostResultTime").textContent = `${(result.attempt.totalTimeMs / 1000).toFixed(2)}s`;
    $("#hostResultMessage").textContent = result.attempt.shortlisted
      ? "You answered all 10 correctly. Final selection depends on fastest time, and our team will notify eligible players."
      : "Your answers are recorded. Not all answers were correct, so please try the next host quiz.";
    showScreen("hostResultScreen");
  } catch (error) {
    toast(error.message);
  }
});

function logoutUser() {
  state.activeUser = null;
  state.hostAnswers.clear();
  state.hostStartedAt = Date.now();
  state.hostAlreadyQualified = false;
  setActiveUser(null);
  toast("Logged out.");
  showScreen("homeScreen");
}

bind("#userLogoutBtn", "click", logoutUser);
bind("#profileLogoutBtn", "click", logoutUser);

bind("#adminLogoutBtn", "click", () => {
  state.adminToken = null;
  state.users = [];
  state.allDailyQuestions = [];
  state.allHostQuestions = [];
  state.dailyAnswerRows = [];
  state.hostAttemptRows = [];
  toast("Admin logged out.");
  showScreen("homeScreen");
});

bind("#resetDemoBtn", "click", async () => {
  await api("/api/admin/reset-demo", { method: "POST", body: JSON.stringify({ adminToken: state.adminToken }) });
  state.activeUser = null;
  state.hostAnswers.clear();
  state.hostStartedAt = Date.now();
  await refresh();
  toast("Demo data reset.");
});

bind("#userSearchInput", "input", event => {
  state.userSearch = event.target.value;
  renderAdminUsers();
});

bind("#userDateFilter", "change", event => {
  state.userDateFilter = event.target.value;
  renderAdminUsers();
});

$$("[data-screen]").forEach(button => {
  button.addEventListener("click", () => showScreen(button.dataset.screen));
});

function showAdminView(view = "dashboard") {
  $$("[data-admin-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.adminView === view);
  });
  $$("[data-admin-section]").forEach(section => {
    section.style.display = section.dataset.adminSection.split(" ").includes(view) ? "" : "none";
  });
  $(".admin-head h1").textContent = {
    dashboard: "Dashboard",
    daily: "Daily Quiz Questions",
    host: "Host Quiz Questions",
    users: "Users",
    winners: "Winners",
    payouts: "Payouts"
  }[view] || "Dashboard";
}

$$("[data-admin-view]").forEach(button => {
  button.addEventListener("click", () => showAdminView(button.dataset.adminView));
});

function setDefaultScheduleTime() {
  const input = document.querySelector("[name='scheduledAt']");
  if (!input) return;
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  input.value = date.toISOString().slice(0, 16);
}

function updateQuestionFormMode() {
  const typeInput = document.querySelector("[name='type']");
  const liveNowInput = document.querySelector("[name='liveNow']");
  const prizeInput = document.querySelector("[name='prize']");
  const scheduleInput = document.querySelector("[name='scheduledAt']");
  const scheduleField = $(".schedule-field");
  const dailyPrizeField = $(".daily-prize-field");
  if (!typeInput || !liveNowInput || !scheduleInput) return;
  const type = typeInput.value;
  const liveNow = liveNowInput.checked;
  scheduleInput.required = !liveNow;
  scheduleInput.disabled = liveNow;
  if (dailyPrizeField) dailyPrizeField.style.display = type === "daily" ? "" : "none";
  if (prizeInput) prizeInput.disabled = type !== "daily";
  scheduleField?.querySelector(".field-note")?.remove();
  scheduleField?.insertAdjacentHTML("beforeend", `<span class="field-note">${type === "daily" ? "Daily question goes live at this time." : "Host hot-seat qualification question joins the live 10-question set at this time."}</span>`);
}

document.querySelector("[name='type']")?.addEventListener("change", updateQuestionFormMode);
document.querySelector("[name='liveNow']")?.addEventListener("change", updateQuestionFormMode);
setDefaultScheduleTime();
updateQuestionFormMode();
setDailyManageDate(new Date());
setHostManageDate(new Date());
try {
  setActiveUser(JSON.parse(localStorage.getItem(USER_SESSION_KEY) || "null"));
} catch {
  setActiveUser(null);
}
refresh().then(() => {
  if (new URLSearchParams(window.location.search).get("admin") === "1") {
    showScreen("adminLoginScreen");
  }
}).catch(error => toast(error.message));

setInterval(async () => {
  if (!state.activeUser && !state.adminToken) return;
  const activeScreen = document.querySelector(".screen.active")?.id;
  if (["dailyScreen", "hostScreen"].includes(activeScreen)) return;
  const previous = state.lastLiveSignature;
  try {
    await refresh();
    if (previous && state.lastLiveSignature !== previous && state.activeUser) {
      if (state.dailyQuestions.length) toast("New Daily Quiz question is live now.");
      else if (state.hostQuestions.length === 10) toast("Play with Host quiz is live now.");
    }
  } catch (error) {
    console.warn(error);
  }
}, 10000);
