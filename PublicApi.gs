/**
 * Public-facing API. This file deliberately never reads SHEET_NAMES.SCORES
 * — evaluation scores cannot leak to the public gallery by construction,
 * not just by UI omission.
 */

const PUBLIC_CACHE_KEY_ = 'public_gallery_v1';
const PUBLIC_CACHE_TTL_ = 180;

function getGallery() {
  return getCachedPublicData_();
}

function getDetail(submissionId) {
  const data = getCachedPublicData_();
  const item = data.submissions.find(function (row) {
    return String(row.submissionId) === String(submissionId);
  });
  if (!item) {
    throw new Error('ไม่พบผลงานนี้ หรือยังไม่ได้เผยแพร่');
  }
  return item;
}

function getCachedPublicData_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(PUBLIC_CACHE_KEY_);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      cache.remove(PUBLIC_CACHE_KEY_);
    }
  }

  const data = normalizeForJson_(buildPublicData_());
  try {
    cache.put(PUBLIC_CACHE_KEY_, JSON.stringify(data), PUBLIC_CACHE_TTL_);
  } catch (error) {
    // best-effort cache; ignore quota errors
  }
  return data;
}

function buildPublicData_() {
  const config = getSystemConfig();
  const categoryLabels = {};
  config.categories.forEach(function (category) {
    categoryLabels[category.id] = category.label;
  });

  let submissions = [];
  if (config.allowPublic) {
    submissions = readRows_(SHEET_NAMES.SUBMISSIONS)
      .filter(function (row) { return String(row.status) === 'published'; })
      .sort(function (a, b) {
        return new Date(b.published_at || b.updated_at || 0) - new Date(a.published_at || a.updated_at || 0);
      })
      .map(function (row) {
        return {
          submissionId: row.submission_id,
          title: row.title,
          category: row.category,
          categoryLabel: categoryLabels[row.category] || row.category,
          problemStatement: row.problem_statement,
          solutionDescription: row.solution_description,
          impactBenefit: row.impact_benefit,
          attachmentUrl: row.attachment_url,
          attachmentName: row.attachment_name,
          awardStatus: row.award_status || '',
          publishedAt: row.published_at
        };
      });
  }

  return {
    appName: config.appName,
    systemStatus: config.systemStatus,
    allowPublic: config.allowPublic,
    allowSubmission: config.allowSubmission,
    categories: config.categories,
    submissions: submissions
  };
}

function clearPublicCache_() {
  CacheService.getScriptCache().remove(PUBLIC_CACHE_KEY_);
}
