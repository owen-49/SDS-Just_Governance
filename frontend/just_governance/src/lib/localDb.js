// Simple localStorage-based mock backend for frontend-only demo

const LS_KEY = 'jg_local_db_v1';

function readDB() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {};
  } catch {
    return {};
  }
}

function writeDB(db) {
  localStorage.setItem(LS_KEY, JSON.stringify(db));
}

function ensure(db, key, defVal) {
  if (!(key in db)) db[key] = defVal;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Users: { email, password, name, verified, firstLoginAt, projectOverviewSeen }
// Sessions: { currentUserEmail }
// Global conversations per user: { [email]: [{id, title, messages:[{role:'user'|'ai', text, ts}], updatedAt}] }
// Topic chat single per topic: { [email]: { [topicId]: { messages: [...], updatedAt } } }
// Topic quiz results: { [email]: { [topicId]: { lastScore, eligible, completed } } }
// Assessment history: { [email]: [ { id, score, date, breakdown, advice, details } ] }
// Left nav UI state: { expanded: { sectionId:bool, moduleId:bool }, collapsed:false }

export const dbApi = {
  register(email, password, name) {
    const db = readDB();
    ensure(db, 'users', []);
    if (db.users.find(u => u.email === email)) {
      return { ok: false, code: 'exists' };
    }
    // 自动验证用户，简化流程
    db.users.push({ email, password, name: name || email.split('@')[0], verified: true, firstLoginAt: null, projectOverviewSeen: false });
    writeDB(db);
    return { ok: true };
  },
  verifyEmail(email) {
    const db = readDB();
    ensure(db, 'users', []);
    const u = db.users.find(u => u.email === email);
    if (!u) return { ok: false, code: 'no_account' };
    u.verified = true;
    writeDB(db);
    return { ok: true };
  },
  login(email, password) {
    const db = readDB();
    ensure(db, 'users', []);
    const u = db.users.find(u => u.email === email);
    if (!u) return { ok: false, code: 'no_account' };
    if (u.password !== password) return { ok: false, code: 'wrong_password' };
    if (!u.verified) return { ok: false, code: 'unverified' };
    ensure(db, 'sessions', {});
    db.sessions.currentUserEmail = email;
    if (!u.firstLoginAt) u.firstLoginAt = Date.now();
    writeDB(db);
    return { ok: true, user: { email: u.email, name: u.name } };
  },
  logout() {
    const db = readDB();
    ensure(db, 'sessions', {});
    db.sessions.currentUserEmail = null;
    writeDB(db);
  },
  currentUser() {
    const db = readDB();
    const email = db.sessions?.currentUserEmail || null;
    if (!email) return null;
    const u = db.users?.find(u => u.email === email);
    if (!u) return null;
    return { email: u.email, name: u.name, verified: u.verified, firstLoginAt: u.firstLoginAt, projectOverviewSeen: u.projectOverviewSeen };
  },
  setProjectOverviewSeen(email) {
    const db = readDB();
    const u = db.users?.find(u => u.email === email);
    if (u) {
      u.projectOverviewSeen = true;
      writeDB(db);
    }
  },
  resendVerification(email) {
    const db = readDB();
    const u = db.users?.find(u => u.email === email);
    if (!u) return { ok: false };
    // No-op, pretend email sent
    return { ok: true };
  },
  forgotPassword(email) {
    const db = readDB();
    ensure(db, 'passwordResets', {});
    const token = uid();
    db.passwordResets[email] = { token, ts: Date.now() };
    writeDB(db);
    return { ok: true, token };
  },
  resetPassword(email, token, newPassword) {
    const db = readDB();
    const rec = db.passwordResets?.[email];
    if (!rec || rec.token !== token) return { ok: false, code: 'expired' };
    const u = db.users?.find(u => u.email === email);
    if (!u) return { ok: false, code: 'no_account' };
    u.password = newPassword;
    delete db.passwordResets[email];
    writeDB(db);
    return { ok: true };
  },
  navUi(email) {
    const db = readDB();
    ensure(db, 'navUi', {});
    if (!db.navUi[email]) db.navUi[email] = { expanded: {}, collapsed: false };
    writeDB(db);
    return db.navUi[email];
  },
  saveNavUi(email, ui) {
    const db = readDB();
    ensure(db, 'navUi', {});
    db.navUi[email] = ui;
    writeDB(db);
  },
  globalConvs(email) {
    const db = readDB();
    ensure(db, 'globalConvs', {});
    if (!db.globalConvs[email]) db.globalConvs[email] = [];
    writeDB(db);
    return db.globalConvs[email];
  },
  saveGlobalConvs(email, list) {
    const db = readDB();
    ensure(db, 'globalConvs', {});
    db.globalConvs[email] = list;
    writeDB(db);
  },
  topicChat(email, topicId) {
    const db = readDB();
    ensure(db, 'topicChats', {});
    if (!db.topicChats[email]) db.topicChats[email] = {};
    if (!db.topicChats[email][topicId]) db.topicChats[email][topicId] = { messages: [], updatedAt: 0 };
    writeDB(db);
    return db.topicChats[email][topicId];
  },
  saveTopicChat(email, topicId, chat) {
    const db = readDB();
    ensure(db, 'topicChats', {});
    if (!db.topicChats[email]) db.topicChats[email] = {};
    db.topicChats[email][topicId] = chat;
    writeDB(db);
  },
  topicProgress(email, topicId) {
    const db = readDB();
    ensure(db, 'topicProgress', {});
    if (!db.topicProgress[email]) db.topicProgress[email] = {};
    if (!db.topicProgress[email][topicId]) db.topicProgress[email][topicId] = { lastScore: null, eligible: false, completed: false };
    writeDB(db);
    return db.topicProgress[email][topicId];
  },
  saveTopicProgress(email, topicId, prog) {
    const db = readDB();
    ensure(db, 'topicProgress', {});
    if (!db.topicProgress[email]) db.topicProgress[email] = {};
    db.topicProgress[email][topicId] = prog;
    writeDB(db);
  },
  assessmentHistory(email) {
    const db = readDB();
    ensure(db, 'assessmentHistory', {});
    if (!db.assessmentHistory[email]) db.assessmentHistory[email] = [];
    writeDB(db);
    return db.assessmentHistory[email];
  },
  addAssessmentRecord(email, record) {
    const db = readDB();
    ensure(db, 'assessmentHistory', {});
    if (!db.assessmentHistory[email]) db.assessmentHistory[email] = [];
    db.assessmentHistory[email].unshift({ id: uid(), date: Date.now(), ...record });
    writeDB(db);
  },
  // 创建默认测试账户
  createTestAccounts() {
    const db = readDB();
    ensure(db, 'users', []);
    
    const testUsers = [
      { email: 'test@example.com', password: '123456', name: 'Test User', verified: true },
      { email: 'admin@governance.com', password: 'admin123', name: 'Admin User', verified: true },
      { email: 'demo@test.com', password: 'demo123', name: 'Demo User', verified: true }
    ];
    
    testUsers.forEach(user => {
      if (!db.users.find(u => u.email === user.email)) {
        db.users.push({ ...user, firstLoginAt: null, projectOverviewSeen: false });
      }
    });
    
    writeDB(db);
    return { ok: true, message: 'Test accounts created' };
  },
};
