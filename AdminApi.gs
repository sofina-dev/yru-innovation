/**
 * Admin-facing API: dashboard, award selection, the single global
 * publish switch, user management, and settings (categories/criteria).
 */

function getDashboard(token) {
  const session = requireRole_(token, ['admin']);
  const config = getSystemConfig();

  const users = readRows_(SHEET_NAMES.USERS).map(sanitizeUserForAdmin_);
  const submissions = readRows_(SHEET_NAMES.SUBMISSIONS);
  const scores = readRows_(SHEET_NAMES.SCORES);

  const scoresBySubmission = {};
  scores.forEach(function (score) {
    (scoresBySubmission[score.submission_id] = scoresBySubmission[score.submission_id] || []).push(score);
  });

  const categoryLabels = {};
  config.categories.forEach(function (category) {
    categoryLabels[category.id] = category.label;
  });

  const items = submissions.map(function (row) {
    const rowScores = scoresBySubmission[row.submission_id] || [];
    const average = rowScores.length
      ? rowScores.reduce(function (sum, s) { return sum + Number(s.total_score || 0); }, 0) / rowScores.length
      : null;
    return {
      submissionId: row.submission_id,
      title: row.title,
      category: row.category,
      categoryLabel: categoryLabels[row.category] || row.category,
      status: row.status,
      awardStatus: row.award_status || '',
      updatedAt: row.updated_at,
      submittedAt: row.submitted_at,
      judgeCount: rowScores.length,
      averageScore: average,
      scores: rowScores.map(function (s) { return { judgeId: s.judge_id, totalScore: s.total_score }; })
    };
  });

  return {
    user: session,
    config: config,
    users: users,
    submissions: items,
    counts: {
      users: users.length,
      judges: users.filter(function (u) { return u.role === 'judge'; }).length,
      submissions: submissions.length,
      submitted: submissions.filter(function (r) { return r.status === 'submitted'; }).length,
      published: submissions.filter(function (r) { return r.status === 'published'; }).length
    }
  };
}

function sanitizeUserForAdmin_(user) {
  return {
    userId: user.user_id,
    username: user.username,
    displayName: user.display_name,
    email: user.email,
    role: user.role,
    assignedCategory: user.assigned_category || '',
    organization: user.organization || '',
    status: user.status || 'active',
    lastLoginAt: user.last_login_at || ''
  };
}

function manageUser(token, payload) {
  requireRole_(token, ['admin']);
  payload = payload || {};

  const role = String(payload.role || '').toLowerCase();
  if (['participant', 'judge', 'admin'].indexOf(role) === -1) {
    throw new Error('บทบาทไม่ถูกต้อง');
  }
  const username = normalizeUsername_(payload.username);
  if (!username || username.length < 4) {
    throw new Error('Username ต้องมีอย่างน้อย 4 ตัวอักษร');
  }
  if (role === 'judge' && !payload.assignedCategory) {
    throw new Error('กรุณาระบุประเด็นที่กรรมการรับผิดชอบ');
  }

  const existing = findRow_(SHEET_NAMES.USERS, 'username', username);
  const userId = existing ? existing.user_id : 'USR-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  const now = new Date();

  const record = {
    user_id: userId,
    username: username,
    display_name: payload.displayName || (existing ? existing.display_name : username),
    email: String(payload.email || (existing ? existing.email : '') || '').trim().toLowerCase(),
    role: role,
    assigned_category: role === 'judge' ? payload.assignedCategory : '',
    organization: payload.organization || (existing ? existing.organization : ''),
    status: payload.status || (existing ? existing.status : 'active'),
    created_at: existing ? existing.created_at : now,
    updated_at: now,
    last_login_at: existing ? existing.last_login_at : ''
  };

  if (payload.password) {
    if (String(payload.password).length < 8) {
      throw new Error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
    }
    const salt = Utilities.getUuid();
    record.password_salt = salt;
    record.password_hash = hashPassword_(salt, payload.password);
  } else if (!existing) {
    throw new Error('กรุณาตั้งรหัสผ่านเริ่มต้นสำหรับผู้ใช้ใหม่');
  }

  upsertRow_(SHEET_NAMES.USERS, 'user_id', record);
  return getDashboard(token);
}

function setAward(token, submissionId, awardStatus) {
  requireRole_(token, ['admin']);
  if (!findRow_(SHEET_NAMES.SUBMISSIONS, 'submission_id', submissionId)) {
    throw new Error('ไม่พบผลงานนี้');
  }
  upsertRow_(SHEET_NAMES.SUBMISSIONS, 'submission_id', {
    submission_id: submissionId,
    award_status: awardStatus || '',
    updated_at: new Date()
  });
  clearPublicCache_();
  return getDashboard(token);
}

function setSubmissionStatus(token, submissionId, status) {
  requireRole_(token, ['admin']);
  const allowed = ['draft', 'submitted', 'published'];
  if (allowed.indexOf(status) === -1) {
    throw new Error('สถานะไม่ถูกต้อง');
  }
  const existing = findRow_(SHEET_NAMES.SUBMISSIONS, 'submission_id', submissionId);
  if (!existing) {
    throw new Error('ไม่พบผลงานนี้');
  }

  upsertRow_(SHEET_NAMES.SUBMISSIONS, 'submission_id', {
    submission_id: submissionId,
    status: status,
    updated_at: new Date(),
    published_at: status === 'published' ? new Date() : existing.published_at
  });
  clearPublicCache_();
  return getDashboard(token);
}

/**
 * The single "ปิดบัง -> เผยแพร่สู่สาธารณะ" switch: flips the global publish
 * flag and, when turning on, publishes every submitted item in ONE batched
 * sheet write (batchUpdateRows_), not a loop of per-row calls.
 */
function setPublishState(token, isOn) {
  requireRole_(token, ['admin']);
  const on = !!isOn;

  if (on) {
    const now = new Date();
    batchUpdateRows_(SHEET_NAMES.SUBMISSIONS, function (record) {
      if (record.status === 'submitted') {
        return { status: 'published', published_at: record.published_at || now, updated_at: now };
      }
      return null;
    });
  }

  const config = getSystemConfig();
  config.allowPublic = on;
  config.systemStatus = on ? 'PUBLIC' : config.systemStatus;
  saveSystemConfig(config);
  clearPublicCache_();
  return getDashboard(token);
}

function saveSystemSettings(token, payload) {
  requireRole_(token, ['admin']);
  const config = getSystemConfig();
  payload = payload || {};

  if (payload.appName != null) {
    config.appName = String(payload.appName);
  }
  if (payload.systemStatus != null) {
    config.systemStatus = String(payload.systemStatus);
  }
  if (typeof payload.allowSubmission === 'boolean') {
    config.allowSubmission = payload.allowSubmission;
  }
  if (Array.isArray(payload.categories)) {
    config.categories = payload.categories.map(function (category, index) {
      const existing = config.categories[index] || {};
      return {
        id: existing.id || category.id || ('cat' + (index + 1)),
        label: String(category.label || existing.label || ''),
        status: category.status || existing.status || 'active'
      };
    });
  }
  if (Array.isArray(payload.criteria)) {
    config.criteria = config.criteria.map(function (criterion, index) {
      const incoming = payload.criteria[index];
      if (!incoming) {
        return criterion;
      }
      return {
        id: criterion.id,
        label: String(incoming.label != null ? incoming.label : criterion.label),
        maxScore: Number(incoming.maxScore != null ? incoming.maxScore : criterion.maxScore),
        active: incoming.active != null ? !!incoming.active : criterion.active
      };
    });
  }

  saveSystemConfig(config);
  clearPublicCache_();
  return getDashboard(token);
}
