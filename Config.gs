/**
 * Sheet + system configuration. System-wide settings (categories, judging
 * criteria, publish flag) live in Script Properties as JSON rather than a
 * 4th sheet, per spec (exactly 3 data sheets: Users, Submissions, Scores).
 */

const SHEET_NAMES = Object.freeze({
  USERS: 'Users',
  SUBMISSIONS: 'Submissions',
  SCORES: 'Scores'
});

const USERS_HEADERS = [
  'user_id', 'username', 'password_hash', 'password_salt', 'display_name',
  'email', 'role', 'assigned_category', 'organization', 'status',
  'created_at', 'updated_at', 'last_login_at'
];

// Field structure matches the official YRU "แบบฟอร์มนำเสนอผลงานนวัตกรรม"
// (KM YRU Forum) sections 1-6; section 7 (ภาคผนวก) maps to `images` (JSON
// array of {fileId,url,name}, first item is the cover) plus `reference_link`
// (section 8, added at the user's request for a Drive/website link).
// `responsible_people` is a JSON array of names (flexible add/remove list).
// The 6 narrative sections store sanitized rich-text HTML, not plain text.
const SUBMISSIONS_HEADERS = [
  'submission_id', 'user_id', 'title', 'category', 'organization',
  'responsible_people',
  'reason_importance', 'objective_goal', 'principle_theory', 'development_process',
  'success_evidence', 'future_direction', 'recognition_award', 'knowledge_capture',
  'reference_link', 'images',
  'status', 'award_status',
  'created_at', 'updated_at', 'submitted_at', 'published_at'
];

function parseJsonArray_(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

const CRITERIA_COUNT = 12;
const CRITERIA_IDS = (function () {
  const ids = [];
  for (let i = 1; i <= CRITERIA_COUNT; i++) {
    ids.push('criteria_' + i);
  }
  return ids;
})();

const SCORES_HEADERS = ['score_id', 'submission_id', 'judge_id']
  .concat(CRITERIA_IDS)
  .concat(['comment', 'total_score', 'scored_at']);

const SYSTEM_CONFIG_PROPERTY_ = 'SYSTEM_CONFIG_V1';
const SYSTEM_CONFIG_CACHE_KEY_ = 'system_config_v1';
const SYSTEM_CONFIG_CACHE_TTL_ = 120;

function defaultSystemConfig_() {
  const categories = [
    { id: 'cat1', label: 'ประเด็นที่ 1 การผลิตบัณฑิตในศตวรรษที่ 21', status: 'active' },
    { id: 'cat2', label: 'ประเด็นที่ 2 การบริหารจัดการงานวิจัยเพื่อการพัฒนาท้องถิ่นและการบริการวิชาการ หรือทำนุบำรุงศิลปวัฒนธรรมเพื่อพัฒนาชุมชนท้องถิ่นจังหวัดชายแดนภาคใต้', status: 'active' },
    { id: 'cat3', label: 'ประเด็นที่ 3 การบริหารจัดการองค์กรสู่ Smart University', status: 'active' }
  ];

  const criteriaLabels = [
    'ความคิดสร้างสรรค์และความแปลกใหม่',
    'ความเป็นไปได้ในการนำไปใช้จริง',
    'ความครบถ้วนของข้อมูลและวิธีดำเนินการ',
    'ประโยชน์และผลกระทบต่อผู้ใช้งาน',
    'ความคุ้มค่าเมื่อเทียบกับทรัพยากรที่ใช้',
    'ความสอดคล้องกับยุทธศาสตร์ของหน่วยงาน',
    'การประยุกต์ใช้เทคโนโลยีอย่างเหมาะสม',
    'ความยั่งยืนของผลงาน',
    'ศักยภาพในการต่อยอดหรือขยายผล',
    'คุณภาพของการนำเสนอผลงาน',
    'การมีส่วนร่วมของทีมงาน',
    'ความคิดริเริ่มโดยรวม'
  ];

  const criteria = CRITERIA_IDS.map(function (id, index) {
    return {
      id: id,
      label: criteriaLabels[index] || ('เกณฑ์ที่ ' + (index + 1)),
      maxScore: 10,
      active: true
    };
  });

  return {
    appName: 'YRU Innovation Portal',
    systemStatus: 'SETUP',
    allowSubmission: false,
    allowPublic: false,
    categories: categories,
    criteria: criteria
  };
}

function getSystemConfig() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(SYSTEM_CONFIG_CACHE_KEY_);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      cache.remove(SYSTEM_CONFIG_CACHE_KEY_);
    }
  }

  const raw = PropertiesService.getScriptProperties().getProperty(SYSTEM_CONFIG_PROPERTY_);
  const config = raw ? JSON.parse(raw) : defaultSystemConfig_();
  try {
    cache.put(SYSTEM_CONFIG_CACHE_KEY_, JSON.stringify(config), SYSTEM_CONFIG_CACHE_TTL_);
  } catch (error) {
    // best-effort cache; ignore quota errors
  }
  return config;
}

function saveSystemConfig(config) {
  PropertiesService.getScriptProperties().setProperty(SYSTEM_CONFIG_PROPERTY_, JSON.stringify(config));
  CacheService.getScriptCache().remove(SYSTEM_CONFIG_CACHE_KEY_);
  return config;
}

/**
 * Server-side backstop for rich-text HTML fields. The client already runs
 * DOMPurify with a strict allowlist before submitting (the real DOM-based
 * sanitization), but the server never trusts client-side sanitization
 * alone — this strips the highest-risk constructs (script/style/iframe
 * tags, event handler attributes, javascript:/data: URLs) with regexes as
 * a second layer, in case a request bypasses the browser UI entirely.
 */
function sanitizeRichTextBackstop_(html) {
  if (!html) {
    return '';
  }
  return String(html)
    .replace(/<\/?(script|style|iframe|object|embed|form|link|meta)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*(javascript|data):[^"']*\2/gi, '$1=$2#$2');
}

function normalizeForJson_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  }
  if (Array.isArray(value)) {
    return value.map(normalizeForJson_);
  }
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach(function (key) {
      out[key] = normalizeForJson_(value[key]);
    });
    return out;
  }
  return value;
}
