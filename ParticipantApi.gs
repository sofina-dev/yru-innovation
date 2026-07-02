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
  if (existing && String(existing.status) !== 'draft' && !config.allowSubmission && session.role !== 'admin') {
    throw new Error('ขณะนี้ปิดการแก้ไขผลงานแล้ว สามารถดูข้อมูลได้อย่างเดียว');
  }
  if (!payload.title || !payload.category) {
    throw new Error('กรุณากรอกชื่อผลงานและเลือกประเด็นการประกวด');
  }

  const status = payload.isDraft ? 'draft' : 'submitted';
  const now = new Date();

  upsertRow_(SHEET_NAMES.SUBMISSIONS, 'submission_id', {
    submission_id: submissionId,
    user_id: existing ? existing.user_id : session.userId,
    title: payload.title || '',
    category: payload.category || '',
    organization: payload.organization || '',
    responsible_person_1: payload.responsiblePerson1 || '',
    responsible_person_2: payload.responsiblePerson2 || '',
    responsible_person_3: payload.responsiblePerson3 || '',
    reason_importance: payload.reasonImportance || '',
    objective_goal: payload.objectiveGoal || '',
    principle_theory: payload.principleTheory || '',
    development_process: payload.developmentProcess || '',
    success_evidence: payload.successEvidence || '',
    future_direction: payload.futureDirection || '',
    recognition_award: payload.recognitionAward || '',
    knowledge_capture: payload.knowledgeCapture || '',
    attachment_file_id: payload.attachmentFileId != null ? payload.attachmentFileId : (existing ? existing.attachment_file_id : ''),
    attachment_url: payload.attachmentUrl != null ? payload.attachmentUrl : (existing ? existing.attachment_url : ''),
    attachment_name: payload.attachmentName != null ? payload.attachmentName : (existing ? existing.attachment_name : ''),
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
  const existing = findRow_(SHEET_NAMES.SUBMISSIONS, 'submission_id', submissionId);
  if (!existing) {
    return getMyWorkspace(token);
  }
  if (String(existing.user_id) !== String(session.userId) && session.role !== 'admin') {
    throw new Error('ไม่มีสิทธิ์ลบผลงานนี้');
  }
  if (String(existing.status) !== 'draft' && session.role !== 'admin') {
    throw new Error('ลบได้เฉพาะผลงานที่ยังเป็นฉบับร่างเท่านั้น');
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
    responsiblePerson1: row.responsible_person_1,
    responsiblePerson2: row.responsible_person_2,
    responsiblePerson3: row.responsible_person_3,
    reasonImportance: row.reason_importance,
    objectiveGoal: row.objective_goal,
    principleTheory: row.principle_theory,
    developmentProcess: row.development_process,
    successEvidence: row.success_evidence,
    futureDirection: row.future_direction,
    recognitionAward: row.recognition_award,
    knowledgeCapture: row.knowledge_capture,
    attachmentUrl: row.attachment_url,
    attachmentName: row.attachment_name,
    status: row.status,
    awardStatus: row.award_status || '',
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at
  };
}
