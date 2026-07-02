/**
 * Participant-facing API. Every read is filtered server-side to the
 * signed-in user's own rows — the client is never trusted with a user id
 * filter, which is what enforces the "hide other orgs' entries" privacy
 * rule during the competition window.
 */

function getMyWorkspace(token) {
  const session = requireRole_(token, ['participant', 'admin']);
  const config = getSystemConfig();
  const mine = readRows_(SHEET_NAMES.SUBMISSIONS).filter(function (row) {
    return String(row.user_id) === String(session.userId);
  });

  return {
    user: session,
    config: config,
    submissions: mine.map(mapSubmissionForOwner_)
  };
}

function saveSubmission(token, payload) {
  const session = requireRole_(token, ['participant', 'admin']);
  const config = getSystemConfig();
  payload = payload || {};

  const submissionId = payload.submissionId || ('SUB-' + Utilities.getUuid().slice(0, 8).toUpperCase());
  const existing = findRow_(SHEET_NAMES.SUBMISSIONS, 'submission_id', submissionId);

  if (existing && String(existing.user_id) !== String(session.userId) && session.role !== 'admin') {
    throw new Error('ไม่มีสิทธิ์แก้ไขผลงานนี้');
  }
  if (!existing && !config.allowSubmission) {
    throw new Error('ขณะนี้ปิดรับผลงานแล้ว');
  }
  if (existing && !config.allowSubmission && session.role !== 'admin') {
    throw new Error('ขณะนี้ปิดการแก้ไขผลงานแล้ว สามารถดูข้อมูลได้อย่างเดียว');
  }
  if (!payload.title || !payload.category) {
    throw new Error('กรุณากรอกชื่อผลงานและเลือกประเด็นการประกวด');
  }

  const status = payload.isDraft ? 'draft' : 'submitted';
  const now = new Date();
  const responsiblePeople = Array.isArray(payload.responsiblePeople)
    ? payload.responsiblePeople.map(function (name) { return String(name || '').trim(); }).filter(Boolean)
    : parseJsonArray_(existing ? existing.responsible_people : '[]');
  const images = Array.isArray(payload.images)
    ? payload.images.filter(function (img) { return img && img.url; })
    : parseJsonArray_(existing ? existing.images : '[]');

  upsertRow_(SHEET_NAMES.SUBMISSIONS, 'submission_id', {
    submission_id: submissionId,
    user_id: existing ? existing.user_id : session.userId,
    title: payload.title || '',
    category: payload.category || '',
    organization: payload.organization || '',
    responsible_people: JSON.stringify(responsiblePeople),
    reason_importance: sanitizeRichTextBackstop_(payload.reasonImportance),
    objective_goal: sanitizeRichTextBackstop_(payload.objectiveGoal),
    principle_theory: sanitizeRichTextBackstop_(payload.principleTheory),
    development_process: sanitizeRichTextBackstop_(payload.developmentProcess),
    success_evidence: sanitizeRichTextBackstop_(payload.successEvidence),
    future_direction: sanitizeRichTextBackstop_(payload.futureDirection),
    recognition_award: sanitizeRichTextBackstop_(payload.recognitionAward),
    knowledge_capture: sanitizeRichTextBackstop_(payload.knowledgeCapture),
    reference_link: String(payload.referenceLink || '').trim(),
    images: JSON.stringify(images),
    status: status,
    award_status: existing ? existing.award_status : '',
    created_at: existing ? existing.created_at : now,
    updated_at: now,
    submitted_at: status === 'submitted' ? ((existing && existing.submitted_at) || now) : (existing ? existing.submitted_at : ''),
    published_at: existing ? existing.published_at : ''
  });

  clearPublicCache_();
  return getMyWorkspace(token);
}

function deleteSubmission(token, submissionId) {
  const session = requireRole_(token, ['participant', 'admin']);
  const config = getSystemConfig();
  const existing = findRow_(SHEET_NAMES.SUBMISSIONS, 'submission_id', submissionId);
  if (!existing) {
    return getMyWorkspace(token);
  }
  if (String(existing.user_id) !== String(session.userId) && session.role !== 'admin') {
    throw new Error('ไม่มีสิทธิ์ลบผลงานนี้');
  }
  if (String(existing.status) !== 'draft' && !config.allowSubmission && session.role !== 'admin') {
    throw new Error('ขณะนี้ปิดรับ/ปิดแก้ไขผลงานแล้ว จึงลบผลงานที่ส่งแล้วไม่ได้');
  }

  removeRow_(SHEET_NAMES.SUBMISSIONS, 'submission_id', submissionId);
  clearPublicCache_();
  return getMyWorkspace(token);
}

function mapSubmissionForOwner_(row) {
  return {
    submissionId: row.submission_id,
    title: row.title,
    category: row.category,
    organization: row.organization,
    responsiblePeople: parseJsonArray_(row.responsible_people),
    reasonImportance: row.reason_importance,
    objectiveGoal: row.objective_goal,
    principleTheory: row.principle_theory,
    developmentProcess: row.development_process,
    successEvidence: row.success_evidence,
    futureDirection: row.future_direction,
    recognitionAward: row.recognition_award,
    knowledgeCapture: row.knowledge_capture,
    referenceLink: row.reference_link,
    images: parseJsonArray_(row.images),
    status: row.status,
    awardStatus: row.award_status || '',
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at
  };
}
