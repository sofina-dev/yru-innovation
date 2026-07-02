/**
 * One-time bootstrap. Run setupDatabase() once from the Apps Script editor
 * (or `clasp run setupDatabase`) after the first `clasp push`. It creates a
 * brand-new Spreadsheet, the 3 required sheets with headers, seeds default
 * system config, and seeds one Admin account. Safe to re-run: it will not
 * duplicate sheets, config, or the admin account if they already exist.
 */
function setupDatabase() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty('SPREADSHEET_ID');
  let spreadsheet;

  if (existingId) {
    spreadsheet = SpreadsheetApp.openById(existingId);
  } else {
    spreadsheet = SpreadsheetApp.create('YRU Innovation Portal - Database');
    props.setProperty('SPREADSHEET_ID', spreadsheet.getId());
  }

  ensureSheetWithHeaders_(spreadsheet, SHEET_NAMES.USERS, USERS_HEADERS);
  ensureSheetWithHeaders_(spreadsheet, SHEET_NAMES.SUBMISSIONS, SUBMISSIONS_HEADERS);
  ensureSheetWithHeaders_(spreadsheet, SHEET_NAMES.SCORES, SCORES_HEADERS);

  const leftoverDefaultSheet = spreadsheet.getSheetByName('Sheet1');
  if (leftoverDefaultSheet && spreadsheet.getSheets().length > 3) {
    spreadsheet.deleteSheet(leftoverDefaultSheet);
  }

  if (!props.getProperty(SYSTEM_CONFIG_PROPERTY_)) {
    saveSystemConfig(defaultSystemConfig_());
  }

  const result = {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl()
  };

  const adminUsername = 'admin';
  const existingAdmin = findRow_(SHEET_NAMES.USERS, 'username', adminUsername);

  if (existingAdmin) {
    result.adminUsername = adminUsername;
    result.note = 'บัญชี admin มีอยู่แล้ว รหัสผ่านเดิมไม่เปลี่ยนแปลง';
  } else {
    const password = generateTempPassword_();
    const salt = Utilities.getUuid();
    const now = new Date();

    upsertRow_(SHEET_NAMES.USERS, 'user_id', {
      user_id: 'USR-ADMIN01',
      username: adminUsername,
      password_hash: hashPassword_(salt, password),
      password_salt: salt,
      display_name: 'ผู้ดูแลระบบ',
      email: '',
      role: 'admin',
      assigned_category: '',
      organization: 'YRU',
      status: 'active',
      created_at: now,
      updated_at: now,
      last_login_at: ''
    });

    result.adminUsername = adminUsername;
    result.adminPassword = password;
    result.note = 'บันทึกรหัสผ่านนี้ไว้ทันที — ระบบจะไม่แสดงอีกครั้ง (เปลี่ยนได้ในหน้า Admin > ตั้งค่า)';
  }

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function generateTempPassword_() {
  return 'Yru' + Math.floor(100000 + Math.random() * 900000) + '!';
}
