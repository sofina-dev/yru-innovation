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

const DEMO_COVER_IMAGES_ = [
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1200&q=80'
];

const DEMO_SUBMISSIONS_ = [
  { title: 'ระบบแจ้งซ่อมอัจฉริยะสำหรับอาคารเรียน', category: 'cat1', problem: 'การแจ้งซ่อมครุภัณฑ์ในอาคารเรียนยังใช้กระดาษ ทำให้ติดตามสถานะงานซ่อมได้ยากและล่าช้า', solution: 'พัฒนาแบบฟอร์มแจ้งซ่อมออนไลน์เชื่อมกับไลน์แจ้งเตือนช่างเทคนิคโดยอัตโนมัติ พร้อมระบบติดตามสถานะแบบเรียลไทม์', impact: 'ลดเวลาดำเนินการแจ้งซ่อมเฉลี่ยลง 60% และผู้ใช้งานสามารถตรวจสอบสถานะงานซ่อมได้ด้วยตนเอง', award: 'รางวัลที่ 1' },
  { title: 'แดชบอร์ดข้อมูลชุมชนเพื่อการตัดสินใจ', category: 'cat2', problem: 'ข้อมูลชุมชนรอบมหาวิทยาลัยกระจัดกระจายอยู่หลายหน่วยงาน ทำให้วางแผนโครงการบริการวิชาการได้ยาก', solution: 'รวบรวมข้อมูลพื้นที่ วิเคราะห์แนวโน้ม และนำเสนอเป็นแดชบอร์ดภาพรวมที่ใช้งานง่าย', impact: 'หน่วยงานที่เกี่ยวข้องใช้ข้อมูลชุดเดียวกันในการวางแผนโครงการ ลดความซ้ำซ้อนของการลงพื้นที่เก็บข้อมูล', award: '' },
  { title: 'คลังสื่อการเรียนรู้แบบเปิดสำหรับครูท้องถิ่น', category: 'cat3', problem: 'ครูในพื้นที่ชายแดนใต้ขาดแหล่งรวมสื่อการสอนที่ออกแบบให้เหมาะกับบริบทท้องถิ่น', solution: 'สร้างคลังสื่อการเรียนรู้แบบเปิดที่ค้นหาง่าย ใช้งานผ่านมือถือได้ และแท็กตามระดับชั้น/รายวิชา', impact: 'ครูกว่า 200 คนในพื้นที่นำสื่อไปใช้สอนจริง ลดเวลาการเตรียมสื่อการสอนได้มาก', award: 'รางวัลที่ 2' },
  { title: 'คิวบริการออนไลน์สำหรับสำนักงานทะเบียน', category: 'cat1', problem: 'นักศึกษาต้องรอคิวนานเมื่อมาติดต่อสำนักงานทะเบียน โดยเฉพาะช่วงเปิด-ปิดภาคเรียน', solution: 'ระบบจองคิวล่วงหน้าออนไลน์ พร้อมแจ้งเตือนอัตโนมัติและประเมินความพึงพอใจหลังรับบริการ', impact: 'ลดความแออัดหน้าเคาน์เตอร์ลงกว่าครึ่ง และได้ข้อมูลความพึงพอใจไปปรับปรุงบริการต่อเนื่อง', award: '' },
  { title: 'ระบบติดตามพลังงานอาคารสีเขียว', category: 'cat2', problem: 'มหาวิทยาลัยไม่มีข้อมูลเปรียบเทียบการใช้พลังงานระหว่างอาคาร ทำให้วางมาตรการประหยัดพลังงานได้ยาก', solution: 'เชื่อมข้อมูลมิเตอร์ไฟฟ้าและน้ำแต่ละอาคารเข้าสู่ระบบเดียว พร้อมข้อเสนอแนะเชิงปฏิบัติรายเดือน', impact: 'อาคารที่นำร่องใช้ระบบสามารถลดค่าไฟฟ้าได้ประมาณ 15% ภายในหนึ่งภาคการศึกษา', award: '' },
  { title: 'ผู้ช่วยติดตามความก้าวหน้านักศึกษา', category: 'cat3', problem: 'อาจารย์ที่ปรึกษาไม่มีเครื่องมือช่วยสังเกตสัญญาณเสี่ยงของนักศึกษาที่อาจพ้นสภาพ', solution: 'เครื่องมือสรุปผลการเรียนและการเข้าเรียนเป็นสัญญาณเตือนล่วงหน้า พร้อมช่องทางส่งต่อความช่วยเหลือ', impact: 'อาจารย์ที่ปรึกษาเข้าถึงนักศึกษากลุ่มเสี่ยงได้เร็วขึ้น ช่วยลดอัตราการพ้นสภาพในกลุ่มนำร่อง', award: '' },
  { title: 'ตลาดดิจิทัลผลิตภัณฑ์ชุมชนยะลา', category: 'cat2', problem: 'ผลิตภัณฑ์ชุมชนรอบมหาวิทยาลัยยังขาดช่องทางเข้าถึงลูกค้ากลุ่มใหม่', solution: 'พื้นที่นำเสนอผลิตภัณฑ์ชุมชนพร้อมเรื่องราว แผนที่ร้าน และช่องทางติดต่อสั่งซื้อโดยตรง', impact: 'ร้านค้าชุมชนที่เข้าร่วมมียอดสั่งซื้อเพิ่มขึ้นจากลูกค้านอกพื้นที่', award: 'รางวัลที่ 3' },
  { title: 'ระบบหลักฐานประกันคุณภาพแบบเชื่อมโยง', category: 'cat1', problem: 'การจัดเก็บหลักฐานประกันคุณภาพกระจัดกระจายในหลายไฟล์ ค้นหาย้อนหลังได้ยากช่วงประเมิน', solution: 'จัดเก็บหลักฐาน แท็กตามตัวชี้วัด และสร้างรายงานสรุปประกอบการประเมินได้อัตโนมัติ', impact: 'ลดเวลาการเตรียมเอกสารรับประเมินคุณภาพลงอย่างมาก และหลักฐานสืบค้นย้อนหลังได้ง่ายขึ้น', award: '' },
  { title: 'แผนที่กิจกรรมสุขภาวะในมหาวิทยาลัย', category: 'cat3', problem: 'นักศึกษาไม่ทราบว่ามีกิจกรรมส่งเสริมสุขภาพใดบ้างและจัดที่ไหน ทำให้เข้าร่วมน้อย', solution: 'รวบรวมกิจกรรมส่งเสริมสุขภาพ จุดบริการ และสถิติการเข้าร่วมไว้ในที่เดียว ค้นหาง่ายผ่านมือถือ', impact: 'จำนวนผู้เข้าร่วมกิจกรรมสุขภาวะเพิ่มขึ้น และหน่วยงานผู้จัดวางแผนกิจกรรมได้ตรงความต้องการมากขึ้น', award: '' },
  { title: 'ระบบเอกสารเวียนแบบไร้กระดาษ', category: 'cat1', problem: 'การเวียนเอกสารระหว่างหน่วยงานยังใช้กระดาษ เสียเวลาส่งต่อและตรวจสอบสถานะไม่ได้', solution: 'ปรับกระบวนการรับส่งเอกสารให้ตรวจสอบสถานะออนไลน์ได้ ลดเวลารอคอย รองรับการอนุมัติผ่านมือถือ', impact: 'ระยะเวลาเฉลี่ยของการเวียนเอกสารลดลงจากหลายวันเหลือไม่ถึงหนึ่งวัน', award: '' },
  { title: 'แชตบอตตอบคำถามนักศึกษาใหม่', category: 'cat3', problem: 'ช่วงรับสมัครนักศึกษาใหม่ เจ้าหน้าที่ต้องตอบคำถามซ้ำๆ ทางไลน์เป็นจำนวนมาก', solution: 'แชตบอตตอบคำถามที่พบบ่อยเกี่ยวกับการสมัครเรียนและทุนการศึกษาโดยอัตโนมัติตลอด 24 ชั่วโมง', impact: 'เจ้าหน้าที่มีเวลาดูแลกรณีซับซ้อนมากขึ้น ผู้สมัครได้รับคำตอบเร็วขึ้นแม้นอกเวลาราชการ', award: '' },
  { title: 'ระบบจองห้องประชุมอัจฉริยะ', category: 'cat1', problem: 'การจองห้องประชุมของแต่ละคณะไม่เชื่อมกัน เกิดปัญหาจองซ้อนกันบ่อยครั้ง', solution: 'ระบบจองห้องกลางที่ทุกหน่วยงานเห็นตารางเดียวกัน พร้อมแจ้งเตือนก่อนถึงเวลาประชุม', impact: 'ปัญหาจองห้องซ้อนกันหมดไป และใช้พื้นที่ห้องประชุมได้อย่างมีประสิทธิภาพมากขึ้น', award: '' },
  { title: 'เครื่องมือประเมินความพึงพอใจแบบทันที', category: 'cat2', problem: 'แบบประเมินความพึงพอใจกระดาษเก็บข้อมูลช้าและวิเคราะห์ผลได้ยาก', solution: 'แบบประเมินสั้นผ่าน QR Code พร้อมสรุปผลอัตโนมัติเป็นกราฟให้หน่วยงานนำไปปรับปรุงได้ทันที', impact: 'อัตราการตอบแบบประเมินเพิ่มขึ้น และหน่วยงานเห็นผลสรุปได้ภายในวันเดียวกัน', award: '' },
  { title: 'ระบบพี่เลี้ยงออนไลน์สำหรับนักศึกษาชั้นปีที่ 1', category: 'cat3', problem: 'นักศึกษาใหม่จำนวนมากปรับตัวลำบากในภาคเรียนแรกแต่ไม่กล้าขอความช่วยเหลือ', solution: 'จับคู่รุ่นพี่พี่เลี้ยงผ่านระบบออนไลน์ พร้อมช่องทางปรึกษาที่เป็นส่วนตัวและติดตามผลได้', impact: 'นักศึกษาชั้นปีที่ 1 ที่เข้าร่วมโครงการมีอัตราการคงอยู่ในระบบการศึกษาสูงขึ้น', award: '' },
  { title: 'ระบบวิเคราะห์การใช้พื้นที่จอดรถ', category: 'cat2', problem: 'พื้นที่จอดรถในมหาวิทยาลัยไม่เพียงพอในบางช่วงเวลา แต่ไม่มีข้อมูลชัดเจนว่าจุดใดหนาแน่นที่สุด', solution: 'เก็บข้อมูลการใช้พื้นที่จอดรถแต่ละจุดและนำเสนอเป็นภาพรวมเพื่อวางแผนจัดสรรพื้นที่เพิ่มเติม', impact: 'ผู้บริหารมีข้อมูลประกอบการตัดสินใจขยายพื้นที่จอดรถในจุดที่หนาแน่นจริง', award: '' }
];

/**
 * Seeds ~15 published sample submissions so the public gallery has content
 * to demo. Safe to re-run: it replaces the fixed SUB-DEMO-xx rows rather
 * than duplicating them. Also flips allowSubmission/allowPublic on so the
 * gallery and submission form are immediately usable after seeding.
 */
function seedDemoSubmissions() {
  DEMO_SUBMISSIONS_.forEach(function (_, index) {
    removeRow_(SHEET_NAMES.SUBMISSIONS, 'submission_id', 'SUB-DEMO-' + (index + 1));
  });

  const now = new Date();
  const records = DEMO_SUBMISSIONS_.map(function (demo, index) {
    return {
      submission_id: 'SUB-DEMO-' + (index + 1),
      user_id: 'USR-DEMO',
      title: demo.title,
      category: demo.category,
      problem_statement: demo.problem,
      solution_description: demo.solution,
      impact_benefit: demo.impact,
      attachment_file_id: '',
      attachment_url: DEMO_COVER_IMAGES_[index % DEMO_COVER_IMAGES_.length],
      attachment_name: 'cover.jpg',
      status: 'published',
      award_status: demo.award,
      created_at: now,
      updated_at: now,
      submitted_at: now,
      published_at: now
    };
  });

  batchAppendRows_(SHEET_NAMES.SUBMISSIONS, records);

  const config = getSystemConfig();
  config.allowPublic = true;
  config.allowSubmission = true;
  config.systemStatus = 'PUBLIC';
  saveSystemConfig(config);
  clearPublicCache_();

  const result = { seeded: records.length, allowPublic: true, allowSubmission: true };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
