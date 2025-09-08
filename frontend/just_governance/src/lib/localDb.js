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

function nowIso() { return new Date().toISOString(); }

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
    // Deduplication for legacy data compatibility
    if (db.users.find(u => u.email === email)) {
      return { ok: false, code: 'exists' };
    }
    const user = {
      id: uid(),
      email,
      email_verified_at: null, // Default unverified after registration
      password_hash: password, // Plain text storage in demo
      name: name || email.split('@')[0],
      avatar_url: null,
      first_login_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
      // 兼容旧字段
      projectOverviewSeen: false,
    };
    db.users.push(user);
    writeDB(db);
    return { ok: true };
  },
  verifyEmail(email) {
    const db = readDB();
    ensure(db, 'users', []);
    const u = db.users.find(u => u.email === email);
    if (!u) return { ok: false, code: 'no_account' };
    u.email_verified_at = nowIso();
    u.updated_at = nowIso();
    writeDB(db);
    // 可在此记录 email_verification_tokens 的 used_at，前端 mock 省略
    return { ok: true };
  },
  login(email, password) {
    const db = readDB();
    ensure(db, 'users', []);
    const u = db.users.find(u => u.email === email);
    if (!u) return { ok: false, code: 'no_account' };
    // 兼容旧字段 password
    const pass = u.password_hash ?? u.password;
    if (pass !== password) return { ok: false, code: 'wrong_password' };
    if (!u.email_verified_at) return { ok: false, code: 'unverified' };
    ensure(db, 'sessions', {});
    db.sessions.currentUserId = u.id; // 采用 userId
    db.sessions.currentUserEmail = u.email; // 兼容旧字段
    if (!u.first_login_at) u.first_login_at = Date.now();
    u.updated_at = nowIso();
    writeDB(db);
    return { ok: true, user: { id: u.id, email: u.email, name: u.name, avatar_url: u.avatar_url } };
  },
  logout() {
    const db = readDB();
    ensure(db, 'sessions', {});
    db.sessions.currentUserId = null;
    db.sessions.currentUserEmail = null; // 兼容旧字段
    writeDB(db);
  },
  currentUser() {
    const db = readDB();
    const id = db.sessions?.currentUserId || null;
    let u = null;
    if (id) {
      u = db.users?.find(x => x.id === id) || null;
    }
    if (!u) {
      const email = db.sessions?.currentUserEmail || null;
      if (email) u = db.users?.find(x => x.email === email) || null;
    }
    if (!u) return null;
    return { id: u.id, email: u.email, name: u.name, avatar_url: u.avatar_url, email_verified_at: u.email_verified_at, first_login_at: u.first_login_at, projectOverviewSeen: u.projectOverviewSeen };
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
    ensure(db, 'password_reset_tokens', {});
    ensure(db, 'password_reset_tokens_arr', []);
    const token = uid();
    const expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.password_reset_tokens[email] = { token, expires_at, used_at: null };
    // 若存在用户，则在数组表中也记录一条
    const u = db.users?.find(u => u.email === email);
    if (u) {
      db.password_reset_tokens_arr.push({ id: uid(), user_id: u.id, token, expires_at, used_at: null });
    }
    writeDB(db);
    return { ok: true, token };
  },
  resetPassword(email, token, newPassword) {
    const db = readDB();
    const rec = db.password_reset_tokens?.[email];
    if (!rec || rec.token !== token) return { ok: false, code: 'expired' };
    if (new Date(rec.expires_at).getTime() < Date.now()) return { ok: false, code: 'expired' };
    const u = db.users?.find(u => u.email === email);
    if (!u) return { ok: false, code: 'no_account' };
    u.password_hash = newPassword; // demo 中明文
    u.updated_at = nowIso();
    rec.used_at = nowIso();
    // 同步数组表
    const arrRec = (db.password_reset_tokens_arr || []).find(x => x.token === token);
    if (arrRec) arrRec.used_at = nowIso();
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
    const now = nowIso();
    const seed = [
      { email: 'test@example.com', password_hash: '123456', name: 'Test User' },
      { email: 'admin@governance.com', password_hash: 'admin123', name: 'Admin User' },
      { email: 'demo@test.com', password_hash: 'demo123', name: 'Demo User' },
    ];
    seed.forEach(s => {
      const exists = db.users.find(u => u.email === s.email);
      if (!exists) {
        db.users.push({
          id: uid(),
          email: s.email,
          email_verified_at: now,
          password_hash: s.password_hash,
          name: s.name,
          avatar_url: null,
          first_login_at: null,
          created_at: now,
          updated_at: now,
          projectOverviewSeen: false,
        });
      }
    });
    writeDB(db);
    return { ok: true, message: 'Test accounts created' };
  },
  // 创建默认测试账户并自动登录 test@example.com
  createTestAccountsAndLogin() {
    const db = readDB();
    ensure(db, 'users', []);
    const now = nowIso();
    const email = 'test@example.com';
    let u = db.users.find(x => x.email === email);
    if (!u) {
      u = {
        id: uid(),
        email,
        email_verified_at: now,
        password_hash: '123456',
        name: 'Test User',
        avatar_url: null,
        first_login_at: null,
        created_at: now,
        updated_at: now,
        projectOverviewSeen: false,
      };
      db.users.push(u);
    } else {
      u.password_hash = '123456';
      u.email_verified_at = u.email_verified_at || now;
      u.updated_at = now;
    }
    ensure(db, 'sessions', {});
    db.sessions.currentUserId = u.id;
    db.sessions.currentUserEmail = u.email; // 兼容
    if (!u.first_login_at) u.first_login_at = Date.now();
    writeDB(db);
    return { ok: true, user: { id: u.id, email: u.email, name: u.name } };
  },
  // 初始化数据库表
  initDB() {
    const db = readDB();
    // 账号与认证
    ensure(db, 'users', []);
    ensure(db, 'oauth_accounts', []);
    ensure(db, 'email_verification_tokens', []);
    ensure(db, 'password_reset_tokens', {}); // 兼容旧：按 email 存
    ensure(db, 'password_reset_tokens_arr', []); // 新：数组表
    // 学习信息架构
    ensure(db, 'boards', []);
    ensure(db, 'modules', []);
    ensure(db, 'topics', []);
    ensure(db, 'topic_contents', []);
    // 题库与测试
    ensure(db, 'questions', []);
    ensure(db, 'question_topics', []);
    ensure(db, 'assessment_sessions', []);
    ensure(db, 'assessment_items', []);
    ensure(db, 'assessment_responses', []);
    // 进度
    ensure(db, 'user_topic_progress', []);
    // AI 对话
    ensure(db, 'chat_sessions', []);
    ensure(db, 'chat_messages', []);
    // RAG 知识库
    ensure(db, 'documents', []);
    ensure(db, 'document_chunks', []);
    // 文件与通知
    ensure(db, 'user_files', []);
    ensure(db, 'notifications', []);
    // 情景模拟
    ensure(db, 'scenarios', []);
    ensure(db, 'scenario_attempts', []);
    ensure(db, 'scenario_messages', []);
    writeDB(db);
  },

  // 情景模拟（scenarios）API（前端 mock）
  listScenarios(topicId) {
    const db = readDB();
    ensure(db, 'scenarios', []);
    return topicId ? db.scenarios.filter(s => s.topic_id === topicId) : db.scenarios;
  },
  createScenario({ topic_id, title, prompt_template, rubric }) {
    const db = readDB();
    ensure(db, 'scenarios', []);
    const row = { id: uid(), topic_id, title, prompt_template: prompt_template || '', rubric: rubric || null };
    db.scenarios.push(row);
    writeDB(db);
    return { ok: true, scenario: row };
  },
  startScenarioAttempt(scenario_id) {
    const db = readDB();
    ensure(db, 'scenario_attempts', []);
    ensure(db, 'sessions', {});
    const user_id = db.sessions?.currentUserId || null;
    if (!user_id) return { ok: false, code: 'not_logged_in' };
    const attempt = { id: uid(), scenario_id, user_id, started_at: nowIso(), completed_at: null, score: null, ai_feedback: null };
    db.scenario_attempts.push(attempt);
    writeDB(db);
    return { ok: true, attempt };
  },
  addScenarioMessage(attempt_id, role, content) {
    const db = readDB();
    ensure(db, 'scenario_messages', []);
    if (!['user', 'ai'].includes(role)) role = 'user';
    const msg = { id: uid(), attempt_id, role, content, created_at: nowIso() };
    db.scenario_messages.push(msg);
    writeDB(db);
    return { ok: true, message: msg };
  },
  completeScenarioAttempt(attempt_id, { score = null, ai_feedback = null } = {}) {
    const db = readDB();
    const att = (db.scenario_attempts || []).find(a => a.id === attempt_id);
    if (!att) return { ok: false, code: 'not_found' };
    att.completed_at = nowIso();
    att.score = score;
    att.ai_feedback = ai_feedback;
    writeDB(db);
    return { ok: true, attempt: att };
  },
  listScenarioAttempts({ scenario_id, user_only = true } = {}) {
    const db = readDB();
    ensure(db, 'scenario_attempts', []);
    let rows = db.scenario_attempts;
    if (scenario_id) rows = rows.filter(r => r.scenario_id === scenario_id);
    if (user_only) {
      const uidCur = db.sessions?.currentUserId || null;
      rows = rows.filter(r => r.user_id === uidCur);
    }
    return rows;
  },
  // 创建默认测试情景
  createTestScenarios() {
    const db = readDB();
    ensure(db, 'scenarios', []);
    const seed = [
      { topic_id: '1', title: '测试情景 1', prompt_template: '你是一个乐于助人的助手。', rubric: null },
      { topic_id: '1', title: '测试情景 2', prompt_template: '你是一个严格的老师。', rubric: null },
      { topic_id: '2', title: '测试情景 3', prompt_template: '你是一个和蔼的医生。', rubric: null },
    ];
    seed.forEach(s => {
      const exists = db.scenarios.find(r => r.title === s.title && r.topic_id === s.topic_id);
      if (!exists) {
        db.scenarios.push({ id: uid(), ...s });
      }
    });
    writeDB(db);
    return { ok: true, message: 'Test scenarios created' };
  },
  // Introductory Questionnaire（前端问卷）
  saveIntroQuestionnaire(answers) {
    const db = readDB();
    ensure(db, 'intro_questionnaires', []);
    ensure(db, 'sessions', {});
    const user_id = db.sessions?.currentUserId || null;
    const user_email = db.sessions?.currentUserEmail || null;
    if (!user_id && !user_email) return { ok: false, code: 'not_logged_in' };
    // 找到用户，兼容仅 email 的旧会话
    let u = null;
    if (user_id) u = (db.users || []).find(x => x.id === user_id) || null;
    if (!u && user_email) u = (db.users || []).find(x => x.email === user_email) || null;
    if (!u) return { ok: false, code: 'no_account' };
    const row = {
      id: uid(),
      user_id: u.id,
      data: answers,
      created_at: nowIso(),
    };
    db.intro_questionnaires.push(row);
    writeDB(db);
    return { ok: true, record: row };
  },
  getLatestIntroQuestionnaire() {
    const db = readDB();
    ensure(db, 'intro_questionnaires', []);
    const uidCur = db.sessions?.currentUserId || null;
    const emailCur = db.sessions?.currentUserEmail || null;
    let u = null;
    if (uidCur) u = (db.users || []).find(x => x.id === uidCur) || null;
    if (!u && emailCur) u = (db.users || []).find(x => x.email === emailCur) || null;
    if (!u) return null;
    const list = db.intro_questionnaires.filter(r => r.user_id === u.id);
    if (!list.length) return null;
    return list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
  },
  // 更新用户基本资料（前端 mock）
  updateUserProfile(userId, patch) {
    const db = readDB();
    const u = (db.users || []).find(x => x.id === userId);
    if (!u) return { ok: false, code: 'no_account' };
    if (typeof patch.name === 'string') u.name = patch.name;
    if (typeof patch.avatar_url === 'string') u.avatar_url = patch.avatar_url;
    u.updated_at = nowIso();
    writeDB(db);
    return { ok: true, user: { id: u.id, email: u.email, name: u.name, avatar_url: u.avatar_url } };
  },

  // 第三方账号登录/绑定（若不存在则创建用户与绑定）
  oauthFindOrCreate(provider, provider_account_id, profile = {}) {
    const db = readDB();
    ensure(db, 'oauth_accounts', []);
    ensure(db, 'users', []);
    // 已有绑定 → 直接登录
    let acc = db.oauth_accounts.find(a => a.provider === provider && a.provider_account_id === provider_account_id);
    if (acc) {
      const user = db.users.find(x => x.id === acc.user_id);
      if (!user) return { ok: false, code: 'no_account' };
      ensure(db, 'sessions', {});
      db.sessions.currentUserId = user.id;
      db.sessions.currentUserEmail = user.email;
      if (!user.first_login_at) user.first_login_at = Date.now();
      writeDB(db);
      return { ok: true, isNew: false, user: { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url } };
    }

    // 未有绑定 → 判断是否需要绑定到现有本地账号
    const email = profile.email || `${provider_account_id}@${provider}.local`;
    const existingUser = db.users.find(x => x.email === email);
    if (existingUser && existingUser.password_hash) {
      // 本地账号已存在且有密码，需要进行绑定验证
      return { ok: false, code: 'bind_required', email, provider, provider_account_id };
    }

    // 新建或绑定到无密码的既有用户（先前第三方创建）
    const user = existingUser || {
      id: uid(),
      email,
      email_verified_at: profile.email ? nowIso() : null,
      password_hash: null,
      name: profile.name || (email.split('@')[0]),
      avatar_url: profile.avatar_url || null,
      first_login_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
      projectOverviewSeen: false,
    };
    if (!existingUser) db.users.push(user);

    const newAcc = { id: uid(), user_id: user.id, provider, provider_account_id };
    db.oauth_accounts.push(newAcc);

    ensure(db, 'sessions', {});
    db.sessions.currentUserId = user.id;
    db.sessions.currentUserEmail = user.email;
    if (!user.first_login_at) user.first_login_at = Date.now();
    writeDB(db);
    return { ok: true, isNew: !existingUser, user: { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url } };
  },

  // 绑定第三方到已有本地账号
  oauthBind(email, password, provider, provider_account_id) {
    const db = readDB();
    ensure(db, 'users', []);
    ensure(db, 'oauth_accounts', []);
    const u = db.users.find(x => x.email === email);
    if (!u) return { ok: false, code: 'no_account' };
    const pass = u.password_hash ?? u.password;
    if (pass !== password) return { ok: false, code: 'wrong_password' };
    // 若已存在同 provider+id 的绑定则直接登录
    let acc = db.oauth_accounts.find(a => a.provider === provider && a.provider_account_id === provider_account_id);
    if (!acc) {
      acc = { id: uid(), user_id: u.id, provider, provider_account_id };
      db.oauth_accounts.push(acc);
    }
    ensure(db, 'sessions', {});
    db.sessions.currentUserId = u.id;
    db.sessions.currentUserEmail = u.email;
    if (!u.first_login_at) u.first_login_at = Date.now();
    writeDB(db);
    return { ok: true, user: { id: u.id, email: u.email, name: u.name, avatar_url: u.avatar_url } };
  },
};
