/**
 * Judge-facing API. Assignment is implicit: a judge's `assigned_category`
 * on their Users row determines exactly which submissions they can see or
 * score — there is no separate assignment table to keep in sync.
 *
 * saveScores() writes the whole score row (all ~12 criteria + comment +
 * total) in a single upsertRow_ call, i.e. one Sheets write — this is the
 * direct fix for the N+1-write lag judges felt in v1.
 */

function getAssignedSubmissions(token) {
  const session = requireRole_(token, ['judge', 'admin']);
  const config = getSystemConfig();

  const submissions = readRows_(SHEET_NAMES.SUBMISSIONS).filter(function (row) {
    if (String(row.status) === 'draft') {
      return false;
    }
    if (session.role === 'admin') {
      return true;
    }
    return String(row.category) === String(session.assignedCategory);
  });

  const myScores = readRows_(SHEET_NAMES.SCORES).filter(function (score) {
    return String(score.judge_id) === String(session.userId);
  });
  const scoreBySubmission = {};
  myScores.forEach(function (score) {
    scoreBySubmission[score.submission_id] = score;
  });

  const categoryLabels = {};
  config.categories.forEach(function (category) {
    categoryLabels[category.id] = category.label;
  });

  const items = submissions.map(function (row) {
    const myScore = scoreBySubmission[row.submission_id] || null;
    return {
      submissionId: row.submission_id,
      title: row.title,
      category: row.category,
      categoryLabel: categoryLabels[row.category] || row.category,
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
      isScored: !!myScore,
      myScore: myScore ? mapScoreForJudge_(myScore) : null
    };
  });

  return {
    user: session,
    config: config,
    criteria: config.criteria.filter(function (c) { return c.active; }),
    submissions: items
  };
}

function saveScores(token, payload) {
  const session = requireRole_(token, ['judge']);
  payload = payload || {};
  const submissionId = payload.submissionId;
  const submission = findRow_(SHEET_NAMES.SUBMISSIONS, 'submission_id', submissionId);

  if (!submission) {
    throw new Error('ไม่พบผลงานนี้');
  }
  if (String(submission.category) !== String(session.assignedCategory)) {
    throw new Error('ไม่มีสิทธิ์ให้คะแนนผลงานนอกประเด็นที่รับผิดชอบ');
  }

  const config = getSystemConfig();
  const criteria = config.criteria.filter(function (c) { return c.active; });
  const scoresInput = payload.scores || {};

  const record = {
    score_id: submissionId + '__' + session.userId,
    submission_id: submissionId,
    judge_id: session.userId,
    comment: payload.comment || '',
    scored_at: new Date()
  };

  let total = 0;
  criteria.forEach(function (criterion) {
    const max = Number(criterion.maxScore || 0);
    const raw = Number(scoresInput[criterion.id]);
    const value = isNaN(raw) ? 0 : Math.max(0, Math.min(max, raw));
    record[criterion.id] = value;
    total += value;
  });
  record.total_score = total;

  upsertRow_(SHEET_NAMES.SCORES, 'score_id', record);
  return getAssignedSubmissions(token);
}

function mapScoreForJudge_(score) {
  const values = {};
  CRITERIA_IDS.forEach(function (id) {
    if (Object.prototype.hasOwnProperty.call(score, id)) {
      values[id] = score[id];
    }
  });
  return {
    scores: values,
    comment: score.comment || '',
    totalScore: score.total_score,
    scoredAt: score.scored_at
  };
}
