const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 5292);
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_PIN = String(process.env.ADMIN_PIN || "1234");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const allowedPincodes = new Set(["827001", "827003", "827004", "827006", "827009", "827010", "827011", "827012", "827013"]);

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function now() {
  return new Date().toISOString();
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizePassword(value) {
  return String(value || "").trim();
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(normalizePassword(password)).digest("hex");
}

function verifyPassword(user, password) {
  const normalized = normalizePassword(password);
  if (user.passwordHash) return user.passwordHash === hashPassword(normalized);
  return normalizePassword(user.password || "123456") === normalized;
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function localDayKey(date = new Date()) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function scheduledAtFor(offsetDays, hour, minute) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function hostQuestion(idNumber, text, options, correctIndex) {
  return {
    id: `hq_${idNumber}`,
    text,
    options,
    correctIndex,
    status: "scheduled",
    scheduledAt: now(),
    publishedAt: now()
  };
}

const seed = {
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
      createdAt: now()
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
      scheduledAt: scheduledAtFor(0, 10, 0),
      publishedAt: now()
    },
    {
      id: "dq_2",
      text: "How many questions are planned for Play with Host qualification?",
      options: ["5", "10", "15", "20"],
      correctIndex: 1,
      prize: 500,
      status: "scheduled",
      scheduledAt: scheduledAtFor(0, 18, 0),
      publishedAt: now()
    },
    {
      id: "dq_3",
      text: "Which city is the first launch area for Gyan Chakra?",
      options: ["Bokaro Steel City", "Mumbai", "Delhi", "Patna"],
      correctIndex: 0,
      prize: 500,
      status: "scheduled",
      scheduledAt: scheduledAtFor(1, 11, 30),
      publishedAt: now()
    }
  ],
  hostQuestions: [
    hostQuestion(1, "Which river is closely associated with Bokaro district?", ["Damodar", "Ganga", "Yamuna", "Narmada"], 0),
    hostQuestion(2, "What does KBC-style quiz usually reward?", ["Fast typing only", "Correct answers", "Random selection", "Attendance"], 1),
    hostQuestion(3, "Which detail helps verify local eligibility?", ["Pincode", "Favorite color", "Shoe size", "Music app"], 0),
    hostQuestion(4, "Gyan Chakra is currently planned for which audience?", ["Bokaro residents", "All countries", "Only teachers", "Only shopkeepers"], 0),
    hostQuestion(5, "How many correct answers should qualify a player in this preview?", ["5", "7", "10", "12"], 2),
    hostQuestion(6, "What should decide ranking when players answer correctly?", ["Speed", "Alphabetical name", "Random draw", "Phone number"], 0),
    hostQuestion(7, "Which person manages questions in the system?", ["Agent/Admin", "Every player", "Delivery partner", "Guest user"], 0),
    hostQuestion(8, "What should happen after a player qualifies for Play with Host once?", ["Cannot qualify again", "Unlimited attempts", "Automatic payment", "Delete account"], 0),
    hostQuestion(9, "What is needed before a user can play?", ["Register or login", "Change phone", "Buy a device", "Delete bio"], 0),
    hostQuestion(10, "What is the Gyan Chakra tagline?", ["Gyan Aapka Inam Hamara", "Sabka Phone Sabka Data", "Quiz Bandh Hai", "Only Luck Works"], 0)
  ],
  dailyAnswers: [],
  hostAttempts: []
};

function ensureDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
  }
}

function readDb() {
  ensureDb();
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  let changed = false;
  db.users ||= [];
  db.dailyQuestions ||= [];
  db.hostQuestions ||= [];
  db.dailyAnswers ||= [];
  db.hostAttempts ||= [];
  if (!db.dailyWinnerSelections) {
    db.dailyWinnerSelections = {};
    changed = true;
  }
  if (!db.hostWinnerSelections) {
    db.hostWinnerSelections = {};
    changed = true;
  }
  db.users.forEach(user => {
    const phone = normalizePhone(user.phone);
    if (user.phone !== phone) {
      user.phone = phone;
      changed = true;
    }
    if (!user.passwordHash) {
      user.passwordHash = hashPassword(user.password || "123456");
      changed = true;
    }
    if (user.password) {
      delete user.password;
      changed = true;
    }
    if (!user.createdAt) {
      user.createdAt = now();
      changed = true;
    }
    if (user.loginCount === undefined) {
      user.loginCount = 0;
      changed = true;
    }
    if (!user.status) {
      user.status = "active";
      changed = true;
    }
  });
  if (changed) writeDb(db);
  return db;
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function send(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...headers
  });
  res.end(JSON.stringify(data));
}

function isAdminRequest(req, body = {}) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    return String(req.headers["x-admin-pin"] || body.adminPin || url.searchParams.get("adminPin") || "") === ADMIN_PIN;
  } catch {
    return String(req.headers["x-admin-pin"] || body.adminPin || "") === ADMIN_PIN;
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function publicQuestion(q) {
  return {
    id: q.id,
    text: q.text,
    options: q.options,
    prize: q.prize,
    status: q.status,
    scheduledAt: q.scheduledAt,
    dailySlot: q.dailySlot,
    publishedAt: q.publishedAt
  };
}

function publicUser(user) {
  if (!user) return null;
  const { password, passwordHash, resetCode, resetCodeAt, ...safeUser } = user;
  return safeUser;
}

function adminUser(user) {
  const safeUser = publicUser(user);
  return {
    ...safeUser,
    registeredDate: safeUser.createdAt ? todayKey(new Date(safeUser.createdAt)) : "",
    lastLoginDate: safeUser.lastLoginAt ? todayKey(new Date(safeUser.lastLoginAt)) : ""
  };
}

function adminStats(db) {
  const today = localDayKey();
  const registeredToday = db.users.filter(user => user.createdAt && localDayKey(user.createdAt) === today).length;
  const loggedInToday = db.users.filter(user => user.lastLoginAt && localDayKey(user.lastLoginAt) === today).length;
  const dailyLive = liveDailyQuestions(db).length;
  const hostLive = liveHostQuestions(db).length === 10;
  const protectedUsers = db.users.filter(user => user.passwordHash && !user.password).length;
  return {
    registeredToday,
    loggedInToday,
    totalUsers: db.users.length,
    protectedUsers,
    passwordSecurity: protectedUsers === db.users.length ? "Secure" : "Needs migration",
    dailyLive,
    hostLive,
    dailyAnswersToday: db.dailyAnswers.filter(answer => answer.answeredAt && localDayKey(answer.answeredAt) === today).length,
    hostAttemptsToday: db.hostAttempts.filter(attempt => attempt.submittedAt && localDayKey(attempt.submittedAt) === today).length
  };
}

function adminQuestion(q, index) {
  return {
    ...publicQuestion(q),
    correctIndex: q.correctIndex,
    order: index + 1,
    correctOption: q.options?.[q.correctIndex] || ""
  };
}

function isQuestionLive(question, date = new Date()) {
  if (!question.scheduledAt && question.status === "live") return true;
  return question.scheduledAt && new Date(question.scheduledAt) <= date;
}

function liveDailyQuestions(db, date = new Date()) {
  const today = todayKey(date);
  const todaysStarted = db.dailyQuestions
    .filter(question => isQuestionLive(question, date) && todayKey(new Date(question.scheduledAt)) === today)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .slice(0, 2);
  const currentQuestion = todaysStarted.at(-1);
  return currentQuestion ? [{ ...currentQuestion, dailySlot: todaysStarted.length }] : [];
}

function liveHostQuestions(db, date = new Date()) {
  const today = todayKey(date);
  return db.hostQuestions
    .filter(question => {
      if (!isQuestionLive(question, date)) return false;
      if (!question.scheduledAt && question.status === "live") return true;
      return todayKey(new Date(question.scheduledAt)) === today;
    })
    .slice(-10);
}

function scheduledDailyQuestions(db) {
  const dayCounts = {};
  return db.dailyQuestions
    .slice()
    .sort((a, b) => new Date(a.scheduledAt || a.publishedAt) - new Date(b.scheduledAt || b.publishedAt))
    .map(question => {
      const key = question.scheduledAt ? todayKey(new Date(question.scheduledAt)) : "unscheduled";
      dayCounts[key] = (dayCounts[key] || 0) + 1;
      return {
        ...publicQuestion({ ...question, dailySlot: dayCounts[key] }),
        isLive: liveDailyQuestions(db).some(live => live.id === question.id)
      };
    });
}

function dailyWinners(db) {
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
  }).filter(item => item.winner || liveDailyQuestions(db).some(question => question.id === item.questionId));
}

function publicDailyWinners(db) {
  return dailyWinners(db).map(item => ({
    ...item,
    winner: item.winner ? {
      userId: item.winner.userId,
      name: item.winner.name,
      timeMs: item.winner.timeMs,
      answeredAt: item.winner.answeredAt
    } : null
  }));
}

function dailyAnswerRows(db) {
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

function hostLeaderboard(db) {
  const selectedIds = new Set(Object.values(db.hostWinnerSelections || {}));
  return db.hostAttempts
    .map(attempt => ({
      ...attempt,
      name: db.users.find(user => user.id === attempt.userId)?.name || "Unknown",
      selectedWinner: selectedIds.has(attempt.id)
    }))
    .sort((a, b) => b.correctCount - a.correctCount || a.totalTimeMs - b.totalTimeMs || new Date(a.submittedAt) - new Date(b.submittedAt));
}

function hostAttemptRows(db) {
  return hostLeaderboard(db).map((attempt, index) => ({
    ...attempt,
    rank: index + 1,
    phone: db.users.find(user => user.id === attempt.userId)?.phone || "",
    address: db.users.find(user => user.id === attempt.userId)?.address || "",
    pincode: db.users.find(user => user.id === attempt.userId)?.pincode || "",
    bio: db.users.find(user => user.id === attempt.userId)?.bio || "",
    notifiedAt: attempt.notifiedAt || ""
  }));
}

function hasHostQualified(db, userId) {
  return db.hostAttempts.some(attempt => attempt.userId === userId && attempt.shortlisted);
}

function serveStatic(req, res) {
  const requestPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const fileName = requestPath === "/" ? "index.html" : requestPath.slice(1);
  const filePath = path.normalize(path.join(PUBLIC_DIR, fileName));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath);
  const type = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8"
  }[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host}`);
  const db = readDb();

  if (req.method === "GET" && url.pathname === "/api/health") {
    return send(res, 200, { ok: true, app: "Gyan Chakra", time: now() });
  }

  if (req.method === "GET" && url.pathname === "/api/bootstrap") {
    const userId = url.searchParams.get("userId");
    const admin = isAdminRequest(req);
    return send(res, 200, {
      users: admin ? db.users.map(adminUser) : [],
      adminStats: admin ? adminStats(db) : null,
      userCount: db.users.length,
      dailyQuestions: liveDailyQuestions(db).map(publicQuestion),
      scheduledDailyQuestions: scheduledDailyQuestions(db),
      hostQuestions: liveHostQuestions(db).map(publicQuestion),
      allDailyQuestions: admin ? db.dailyQuestions.map(adminQuestion) : [],
      allHostQuestions: admin ? db.hostQuestions.map(adminQuestion) : [],
      dailyWinners: admin ? dailyWinners(db) : publicDailyWinners(db),
      hostLeaderboard: admin ? hostLeaderboard(db) : hostLeaderboard(db).map(item => ({
        id: item.id,
        userId: item.userId,
        name: item.name,
        correctCount: item.correctCount,
        totalQuestions: item.totalQuestions,
        totalTimeMs: item.totalTimeMs,
        submittedAt: item.submittedAt,
        shortlisted: item.shortlisted,
        selectedWinner: item.selectedWinner
      })),
      dailyAnswerRows: admin ? dailyAnswerRows(db) : [],
      hostAttemptRows: admin ? hostAttemptRows(db) : [],
      hostAlreadyQualified: userId ? hasHostQualified(db, userId) : false
    });
  }

  if (req.method === "POST" && url.pathname === "/api/register") {
    const body = await parseBody(req);
    const required = ["name", "phone", "password", "address", "pincode", "bio"];
    const missing = required.filter(key => !String(body[key] || "").trim());
    if (missing.length) return send(res, 400, { error: `Missing: ${missing.join(", ")}` });
    if (!allowedPincodes.has(String(body.pincode).trim())) {
      return send(res, 400, { error: "Registration is currently open only for Bokaro Steel City pincodes." });
    }
    const phone = normalizePhone(body.phone);
    const password = normalizePassword(body.password);
    const existing = db.users.find(candidate => normalizePhone(candidate.phone) === phone);
    if (existing) {
      if (verifyPassword(existing, password)) return send(res, 200, { user: publicUser(existing) });
      return send(res, 409, { error: "This mobile number is already registered. Please login." });
    }
    const user = {
      id: id("usr"),
      name: String(body.name).trim(),
      phone,
      passwordHash: hashPassword(password),
      address: String(body.address).trim(),
      pincode: String(body.pincode).trim(),
      photoUrl: String(body.photoUrl || "").trim(),
      bio: String(body.bio).trim(),
      createdAt: now()
    };
    db.users.push(user);
    writeDb(db);
    return send(res, 201, { user: publicUser(user) });
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await parseBody(req);
    const login = String(body.phone || "").trim();
    const phone = normalizePhone(login);
    const user = db.users.find(candidate =>
      normalizePhone(candidate.phone) === phone ||
      candidate.id === login ||
      candidate.name.toLowerCase() === login.toLowerCase()
    );
    if (!user) return send(res, 404, { error: "No user found with that phone number." });
    if (!verifyPassword(user, body.password)) {
      return send(res, 401, { error: "Incorrect password." });
    }
    user.lastLoginAt = now();
    user.loginCount = Number(user.loginCount || 0) + 1;
    writeDb(db);
    return send(res, 200, { user: publicUser(user) });
  }

  if (req.method === "POST" && url.pathname === "/api/password-reset") {
    const body = await parseBody(req);
    const phone = normalizePhone(body.phone);
    const user = db.users.find(candidate => normalizePhone(candidate.phone) === phone);
    if (!user) return send(res, 404, { error: "No registered user found with this mobile number." });
    if (String(user.pincode || "").trim() !== String(body.pincode || "").trim()) {
      return send(res, 401, { error: "PIN code does not match this account." });
    }
    const newPassword = normalizePassword(body.newPassword);
    if (newPassword.length < 4) return send(res, 400, { error: "Password must be at least 4 characters." });
    user.passwordHash = hashPassword(newPassword);
    user.passwordResetAt = now();
    writeDb(db);
    return send(res, 200, { ok: true, message: "Password reset. Please login with the new password." });
  }

  if (req.method === "POST" && url.pathname === "/api/daily-answer") {
    const body = await parseBody(req);
    const question = liveDailyQuestions(db).find(q => q.id === body.questionId);
    const user = db.users.find(u => u.id === body.userId);
    if (!question || !user) return send(res, 400, { error: "This question is not live for players right now." });
    if (db.dailyAnswers.some(answer => answer.userId === user.id && answer.questionId === question.id)) {
      return send(res, 409, { error: "You already answered this question." });
    }
    const answer = {
      id: id("ans"),
      userId: user.id,
      questionId: question.id,
      selectedIndex: Number(body.selectedIndex),
      correct: Number(body.selectedIndex) === question.correctIndex,
      timeMs: Math.max(0, Number(body.timeMs || 0)),
      answeredAt: now()
    };
    db.dailyAnswers.push(answer);
    writeDb(db);
    return send(res, 201, { answer, dailyWinners: dailyWinners(db) });
  }

  if (req.method === "POST" && url.pathname === "/api/host-submit") {
    const body = await parseBody(req);
    const user = db.users.find(u => u.id === body.userId);
    if (!user || !Array.isArray(body.answers)) return send(res, 400, { error: "Invalid host attempt." });
    if (hasHostQualified(db, user.id)) {
      return send(res, 403, { error: "You have already qualified for Play with Host once. You can still play Daily Quiz." });
    }
    const liveQuestions = liveHostQuestions(db);
    if (liveQuestions.length !== 10) {
      return send(res, 400, { error: "Play with Host must have exactly 10 live questions." });
    }
    let correctCount = 0;
    for (const answer of body.answers) {
      const question = liveQuestions.find(q => q.id === answer.questionId);
      if (question && question.correctIndex === Number(answer.selectedIndex)) correctCount += 1;
    }
    const attempt = {
      id: id("host"),
      userId: user.id,
      correctCount,
      totalQuestions: liveQuestions.length,
      totalTimeMs: Math.max(0, Number(body.totalTimeMs || 0)),
      submittedAt: now(),
      shortlisted: correctCount === liveQuestions.length
    };
    db.hostAttempts.push(attempt);
    writeDb(db);
    return send(res, 201, { attempt, hostLeaderboard: hostLeaderboard(db) });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/question") {
    const body = await parseBody(req);
    if (!isAdminRequest(req, body)) return send(res, 403, { error: "Admin PIN required." });
    const target = body.type === "host" ? db.hostQuestions : db.dailyQuestions;
    if (!body.text || !Array.isArray(body.options) || body.options.length < 2) {
      return send(res, 400, { error: "Question text and at least two options are required." });
    }
    if (body.type !== "host" && (!body.scheduledAt || Number.isNaN(new Date(body.scheduledAt).getTime()))) {
      return send(res, 400, { error: "Daily Quiz questions need a scheduled date and time." });
    }
    const scheduledAt = new Date(body.scheduledAt || now()).toISOString();
    if (body.type !== "host") {
      const day = todayKey(new Date(scheduledAt));
      const sameDay = db.dailyQuestions.filter(question => question.id !== body.id && question.scheduledAt && todayKey(new Date(question.scheduledAt)) === day);
      if (sameDay.length >= 2) return send(res, 400, { error: "Daily Quiz allows only 2 questions per date." });
    }
    const question = {
      id: body.id || id(body.type === "host" ? "hq" : "dq"),
      text: String(body.text).trim(),
      options: body.options.map(option => String(option).trim()).filter(Boolean),
      correctIndex: Number(body.correctIndex || 0),
      prize: body.type === "host" ? undefined : Number(body.prize || 500),
      status: "scheduled",
      scheduledAt,
      publishedAt: now()
    };
    if (question.correctIndex < 0 || question.correctIndex >= question.options.length) {
      return send(res, 400, { error: "Correct option number is invalid." });
    }
    const existingIndex = body.id ? target.findIndex(item => item.id === body.id) : -1;
    if (existingIndex >= 0) target[existingIndex] = question;
    else target.push(question);
    writeDb(db);
    return send(res, 201, { question });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/question/delete") {
    const body = await parseBody(req);
    if (!isAdminRequest(req, body)) return send(res, 403, { error: "Admin PIN required." });
    const target = body.type === "host" ? db.hostQuestions : db.dailyQuestions;
    const index = target.findIndex(question => question.id === body.id);
    if (index < 0) return send(res, 404, { error: "Question not found." });
    target.splice(index, 1);
    writeDb(db);
    return send(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/question/move") {
    const body = await parseBody(req);
    if (!isAdminRequest(req, body)) return send(res, 403, { error: "Admin PIN required." });
    const target = body.type === "host" ? db.hostQuestions : db.dailyQuestions;
    const index = target.findIndex(question => question.id === body.id);
    const next = body.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || next < 0 || next >= target.length) return send(res, 400, { error: "Cannot move question." });
    const [question] = target.splice(index, 1);
    target.splice(next, 0, question);
    writeDb(db);
    return send(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/host-set/schedule") {
    const body = await parseBody(req);
    if (!isAdminRequest(req, body)) return send(res, 403, { error: "Admin PIN required." });
    const questions = Array.isArray(body.questionIds) && body.questionIds.length
      ? body.questionIds.map(questionId => db.hostQuestions.find(question => question.id === questionId)).filter(Boolean)
      : db.hostQuestions.slice(0, 10);
    if (questions.length < 10) return send(res, 400, { error: "Add 10 host questions for this date first." });
    const scheduledAt = new Date(body.scheduledAt || now()).toISOString();
    questions.slice(0, 10).forEach(question => {
      question.status = "scheduled";
      question.scheduledAt = scheduledAt;
    });
    writeDb(db);
    return send(res, 200, { ok: true, scheduledAt });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/notify") {
    const body = await parseBody(req);
    if (!isAdminRequest(req, body)) return send(res, 403, { error: "Admin PIN required." });
    const target = body.type === "host"
      ? db.hostAttempts.find(attempt => attempt.id === body.id)
      : db.dailyAnswers.find(answer => answer.id === body.id);
    if (!target) return send(res, 404, { error: "Record not found." });
    target.notifiedAt = now();
    writeDb(db);
    return send(res, 200, { ok: true, notifiedAt: target.notifiedAt });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/select-winner") {
    const body = await parseBody(req);
    if (!isAdminRequest(req, body)) return send(res, 403, { error: "Admin PIN required." });
    if (body.type === "host") {
      const attempt = db.hostAttempts.find(item => item.id === body.id);
      if (!attempt) return send(res, 404, { error: "Host attempt not found." });
      if (!attempt.shortlisted) return send(res, 400, { error: "Only all-correct host attempts can be selected." });
      const dateKey = todayKey(new Date(attempt.submittedAt));
      db.hostWinnerSelections[dateKey] = attempt.id;
      attempt.selectedWinner = true;
      attempt.selectedAt = now();
      writeDb(db);
      return send(res, 200, { ok: true });
    }
    const answer = db.dailyAnswers.find(item => item.id === body.id);
    if (!answer) return send(res, 404, { error: "Daily answer not found." });
    if (!answer.correct) return send(res, 400, { error: "Only correct daily answers can win." });
    db.dailyWinnerSelections[answer.questionId] = answer.id;
    answer.selectedWinner = true;
    answer.selectedAt = now();
    writeDb(db);
    return send(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/reset-demo") {
    const body = await parseBody(req);
    if (!isAdminRequest(req, body)) return send(res, 403, { error: "Admin PIN required." });
    writeDb(seed);
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: "API route not found." });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) return await handleApi(req, res);
    return serveStatic(req, res);
  } catch (error) {
    return send(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, HOST, () => {
  ensureDb();
  console.log(`Gyan Chakra preview running at http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  console.log(`For phones on the same Wi-Fi, use http://192.168.29.48:${PORT}`);
});
