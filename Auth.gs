/**
 * Single unified auth system for all 4 roles (participant/judge/admin use
 * the same Users sheet + login form). No dependency on Session.getActiveUser()
 * anywhere, since that is unreliable under ANYONE_ANONYMOUS access and even
 * more so once embedded in an iframe on yru-km.pages.dev.
 */

const SESSION_PREFIX_ = 'sess_';
const SESSION_TTL_SECONDS_ = 21600; // 6 hours

function normalizeUsername_(username) {
  return String(username || '').trim().toLowerCase();
}

function hashPassword_(salt, password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(salt || '') + ':' + String(password || ''),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function (byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function register(payload) {
  payload = payload || {};
  const username = normalizeUsername_(payload.username);
  const password = String(payload.password || '');
  const displayName = String(payload.displayName || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const organization = String(payload.organization || '').trim();

  if (!username || username.length < 4) {
    throw new Error('Username ต้องมีอย่างน้อย 4 ตัวอักษร');
  }
  if (!displayName) {
    throw new Error('กรุณากรอกชื่อ-นามสกุลผู้ส่งผลงาน');
  }
  if (password.length < 8) {
    throw new Error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
  }
  if (findRow_(SHEET_NAMES.USERS, 'username', username)) {
    throw new Error('Username นี้ถูกใช้แล้ว กรุณาเลือกชื่ออื่น');
  }

  const salt = Utilities.getUuid();
  const userId = 'USR-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  const now = new Date();

  upsertRow_(SHEET_NAMES.USERS, 'user_id', {
    user_id: userId,
    username: username,
    password_hash: hashPassword_(salt, password),
    password_salt: salt,
    display_name: displayName,
    email: email,
    role: 'participant',
    assigned_category: '',
    organization: organization,
    status: 'active',
    created_at: now,
    updated_at: now,
    last_login_at: ''
  });

  return login({ username: username, password: password });
}

function login(payload) {
  payload = payload || {};
  const username = normalizeUsername_(payload.username);
  const password = String(payload.password || '');
  const user = findRow_(SHEET_NAMES.USERS, 'username', username);

  if (!user || String(user.status || 'active').toLowerCase() !== 'active') {
    throw new Error('Username หรือรหัสผ่านไม่ถูกต้อง');
  }
  if (hashPassword_(user.password_salt, password) !== user.password_hash) {
    throw new Error('Username หรือรหัสผ่านไม่ถูกต้อง');
  }

  upsertRow_(SHEET_NAMES.USERS, 'user_id', {
    user_id: user.user_id,
    last_login_at: new Date(),
    updated_at: new Date()
  });

  const session = sessionFromUser_(user);
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put(SESSION_PREFIX_ + token, JSON.stringify(session), SESSION_TTL_SECONDS_);

  return { token: token, user: session };
}

function logout(token) {
  if (token) {
    CacheService.getScriptCache().remove(SESSION_PREFIX_ + token);
  }
  return { ok: true };
}

function resumeSession(token) {
  return { user: requireSession_(token) };
}

function sessionFromUser_(user) {
  return {
    userId: user.user_id,
    username: user.username,
    displayName: user.display_name || user.username,
    email: user.email || '',
    role: String(user.role || 'participant').toLowerCase(),
    assignedCategory: user.assigned_category || '',
    organization: user.organization || ''
  };
}

function requireSession_(token) {
  const raw = token ? CacheService.getScriptCache().get(SESSION_PREFIX_ + token) : null;
  if (!raw) {
    throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }
  return JSON.parse(raw);
}

function requireRole_(token, roles) {
  const session = requireSession_(token);
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (allowed.indexOf(session.role) === -1) {
    throw new Error('ไม่มีสิทธิ์เข้าถึงส่วนนี้');
  }
  return session;
}
