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

const DEMO_ORGANIZATIONS_ = [
  'คณะครุศาสตร์', 'คณะวิทยาศาสตร์เทคโนโลยีและการเกษตร', 'คณะมนุษยศาสตร์และสังคมศาสตร์',
  'คณะวิทยาการจัดการ', 'สำนักวิทยบริการและเทคโนโลยีสารสนเทศ', 'สำนักงานอธิการบดี'
];
const DEMO_PEOPLE_ = [
  'อาจารย์สมชาย ใจดี', 'อาจารย์นูรีดา สาและ', 'อาจารย์วิภาวรรณ ศรีสุข',
  'อาจารย์อับดุลเลาะ เจ๊ะและ', 'อาจารย์กัลยา รัตนพันธ์', 'อาจารย์มูฮัมหมัด สาแม'
];

// title, category, reason, objective, principle, process, success, future, award
const DEMO_SUBMISSIONS_ = [
  { title: 'ระบบแจ้งซ่อมอัจฉริยะสำหรับอาคารเรียน', category: 'cat1', reason: 'การแจ้งซ่อมครุภัณฑ์ในอาคารเรียนยังใช้กระดาษ ทำให้ติดตามสถานะงานซ่อมได้ยากและล่าช้า ส่งผลต่อคุณภาพการเรียนการสอน', objective: 'เพื่อลดระยะเวลาแจ้งซ่อมและให้ผู้ใช้งานตรวจสอบสถานะได้ด้วยตนเอง', principle: 'ประยุกต์แนวคิดการจัดการคำร้องออนไลน์ (Ticketing System) ร่วมกับการแจ้งเตือนอัตโนมัติ', process: 'พัฒนาแบบฟอร์มแจ้งซ่อมออนไลน์เชื่อมกับไลน์แจ้งเตือนช่างเทคนิคโดยอัตโนมัติ พร้อมระบบติดตามสถานะแบบเรียลไทม์', success: 'ลดเวลาดำเนินการแจ้งซ่อมเฉลี่ยลง 60% และผู้ใช้งานสามารถตรวจสอบสถานะงานซ่อมได้ด้วยตนเอง', future: 'ขยายผลไปยังอาคารอื่นทั้งมหาวิทยาลัยและเชื่อมกับระบบครุภัณฑ์กลาง', award: 'รางวัลที่ 1' },
  { title: 'แดชบอร์ดข้อมูลชุมชนเพื่อการตัดสินใจ', category: 'cat2', reason: 'ข้อมูลชุมชนรอบมหาวิทยาลัยกระจัดกระจายอยู่หลายหน่วยงาน ทำให้วางแผนโครงการบริการวิชาการได้ยาก', objective: 'เพื่อรวบรวมและนำเสนอข้อมูลชุมชนในภาพเดียวสำหรับใช้วางแผนโครงการ', principle: 'ใช้แนวคิดการจัดการข้อมูลเชิงพื้นที่ (GIS) ร่วมกับการวิเคราะห์แนวโน้มเชิงสถิติ', process: 'รวบรวมข้อมูลพื้นที่ วิเคราะห์แนวโน้ม และนำเสนอเป็นแดชบอร์ดภาพรวมที่ใช้งานง่าย', success: 'หน่วยงานที่เกี่ยวข้องใช้ข้อมูลชุดเดียวกันในการวางแผนโครงการ ลดความซ้ำซ้อนของการลงพื้นที่เก็บข้อมูล', future: 'เพิ่มการอัปเดตข้อมูลแบบอัตโนมัติจากหน่วยงานที่เกี่ยวข้อง', award: '' },
  { title: 'คลังสื่อการเรียนรู้แบบเปิดสำหรับครูท้องถิ่น', category: 'cat1', reason: 'ครูในพื้นที่ชายแดนใต้ขาดแหล่งรวมสื่อการสอนที่ออกแบบให้เหมาะกับบริบทท้องถิ่น', objective: 'เพื่อสร้างแหล่งเรียนรู้กลางที่ครูเข้าถึงและนำไปใช้สอนได้จริง', principle: 'ใช้แนวคิดทรัพยากรการศึกษาแบบเปิด (Open Educational Resources)', process: 'สร้างคลังสื่อการเรียนรู้แบบเปิดที่ค้นหาง่าย ใช้งานผ่านมือถือได้ และแท็กตามระดับชั้น/รายวิชา', success: 'ครูกว่า 200 คนในพื้นที่นำสื่อไปใช้สอนจริง ลดเวลาการเตรียมสื่อการสอนได้มาก', future: 'เปิดให้ครูในพื้นที่ร่วมส่งสื่อการสอนของตนเองเข้าคลังได้', award: 'รางวัลที่ 2' },
  { title: 'คิวบริการออนไลน์สำหรับสำนักงานทะเบียน', category: 'cat3', reason: 'นักศึกษาต้องรอคิวนานเมื่อมาติดต่อสำนักงานทะเบียน โดยเฉพาะช่วงเปิด-ปิดภาคเรียน', objective: 'เพื่อลดความแออัดและระยะเวลารอคอยของนักศึกษาที่มาติดต่อ', principle: 'ประยุกต์แนวคิดการจัดการคิวดิจิทัลและการแจ้งเตือนล่วงหน้า', process: 'ระบบจองคิวล่วงหน้าออนไลน์ พร้อมแจ้งเตือนอัตโนมัติและประเมินความพึงพอใจหลังรับบริการ', success: 'ลดความแออัดหน้าเคาน์เตอร์ลงกว่าครึ่ง และได้ข้อมูลความพึงพอใจไปปรับปรุงบริการต่อเนื่อง', future: 'ขยายไปยังหน่วยงานบริการอื่นที่มีปัญหาคิวหนาแน่นในลักษณะเดียวกัน', award: '' },
  { title: 'ระบบติดตามพลังงานอาคารสีเขียว', category: 'cat3', reason: 'มหาวิทยาลัยไม่มีข้อมูลเปรียบเทียบการใช้พลังงานระหว่างอาคาร ทำให้วางมาตรการประหยัดพลังงานได้ยาก', objective: 'เพื่อให้ผู้บริหารมีข้อมูลเปรียบเทียบการใช้พลังงานประกอบการตัดสินใจ', principle: 'ใช้แนวคิดการบริหารจัดการพลังงานอย่างยั่งยืน (Smart University)', process: 'เชื่อมข้อมูลมิเตอร์ไฟฟ้าและน้ำแต่ละอาคารเข้าสู่ระบบเดียว พร้อมข้อเสนอแนะเชิงปฏิบัติรายเดือน', success: 'อาคารที่นำร่องใช้ระบบสามารถลดค่าไฟฟ้าได้ประมาณ 15% ภายในหนึ่งภาคการศึกษา', future: 'ขยายผลครบทุกอาคารและเชื่อมกับเป้าหมายมหาวิทยาลัยสีเขียว', award: '' },
  { title: 'ผู้ช่วยติดตามความก้าวหน้านักศึกษา', category: 'cat1', reason: 'อาจารย์ที่ปรึกษาไม่มีเครื่องมือช่วยสังเกตสัญญาณเสี่ยงของนักศึกษาที่อาจพ้นสภาพ', objective: 'เพื่อให้อาจารย์ที่ปรึกษาเข้าถึงนักศึกษากลุ่มเสี่ยงได้เร็วขึ้น', principle: 'ใช้แนวคิดระบบเตือนภัยล่วงหน้า (Early Warning System) ทางการศึกษา', process: 'เครื่องมือสรุปผลการเรียนและการเข้าเรียนเป็นสัญญาณเตือนล่วงหน้า พร้อมช่องทางส่งต่อความช่วยเหลือ', success: 'อาจารย์ที่ปรึกษาเข้าถึงนักศึกษากลุ่มเสี่ยงได้เร็วขึ้น ช่วยลดอัตราการพ้นสภาพในกลุ่มนำร่อง', future: 'เชื่อมกับระบบทุนการศึกษาและการให้คำปรึกษาด้านจิตใจ', award: '' },
  { title: 'ตลาดดิจิทัลผลิตภัณฑ์ชุมชนยะลา', category: 'cat2', reason: 'ผลิตภัณฑ์ชุมชนรอบมหาวิทยาลัยยังขาดช่องทางเข้าถึงลูกค้ากลุ่มใหม่', objective: 'เพื่อสร้างช่องทางจำหน่ายผลิตภัณฑ์ชุมชนให้เข้าถึงลูกค้าได้กว้างขึ้น', principle: 'ใช้แนวคิดพาณิชย์อิเล็กทรอนิกส์เพื่อชุมชน (Community E-Commerce)', process: 'พื้นที่นำเสนอผลิตภัณฑ์ชุมชนพร้อมเรื่องราว แผนที่ร้าน และช่องทางติดต่อสั่งซื้อโดยตรง', success: 'ร้านค้าชุมชนที่เข้าร่วมมียอดสั่งซื้อเพิ่มขึ้นจากลูกค้านอกพื้นที่', future: 'อบรมผู้ประกอบการชุมชนให้บริหารร้านค้าออนไลน์ของตนเองต่อได้', award: 'รางวัลที่ 3' },
  { title: 'ระบบหลักฐานประกันคุณภาพแบบเชื่อมโยง', category: 'cat3', reason: 'การจัดเก็บหลักฐานประกันคุณภาพกระจัดกระจายในหลายไฟล์ ค้นหาย้อนหลังได้ยากช่วงประเมิน', objective: 'เพื่อให้ค้นหาและจัดทำรายงานหลักฐานประกันคุณภาพได้รวดเร็วขึ้น', principle: 'ใช้แนวคิดการจัดการความรู้และการแท็กข้อมูลตามตัวชี้วัด', process: 'จัดเก็บหลักฐาน แท็กตามตัวชี้วัด และสร้างรายงานสรุปประกอบการประเมินได้อัตโนมัติ', success: 'ลดเวลาการเตรียมเอกสารรับประเมินคุณภาพลงอย่างมาก และหลักฐานสืบค้นย้อนหลังได้ง่ายขึ้น', future: 'เชื่อมโยงกับระบบสารสนเทศเพื่อการบริหารของมหาวิทยาลัย', award: '' },
  { title: 'แผนที่กิจกรรมสุขภาวะในมหาวิทยาลัย', category: 'cat1', reason: 'นักศึกษาไม่ทราบว่ามีกิจกรรมส่งเสริมสุขภาพใดบ้างและจัดที่ไหน ทำให้เข้าร่วมน้อย', objective: 'เพื่อเพิ่มการเข้าถึงและการมีส่วนร่วมในกิจกรรมส่งเสริมสุขภาพของนักศึกษา', principle: 'ใช้แนวคิดการสื่อสารสุขภาวะผ่านสื่อดิจิทัล', process: 'รวบรวมกิจกรรมส่งเสริมสุขภาพ จุดบริการ และสถิติการเข้าร่วมไว้ในที่เดียว ค้นหาง่ายผ่านมือถือ', success: 'จำนวนผู้เข้าร่วมกิจกรรมสุขภาวะเพิ่มขึ้น และหน่วยงานผู้จัดวางแผนกิจกรรมได้ตรงความต้องการมากขึ้น', future: 'เพิ่มระบบแนะนำกิจกรรมตามความสนใจของผู้ใช้แต่ละคน', award: '' },
  { title: 'ระบบเอกสารเวียนแบบไร้กระดาษ', category: 'cat3', reason: 'การเวียนเอกสารระหว่างหน่วยงานยังใช้กระดาษ เสียเวลาส่งต่อและตรวจสอบสถานะไม่ได้', objective: 'เพื่อลดเวลาและกระดาษที่ใช้ในการเวียนเอกสารระหว่างหน่วยงาน', principle: 'ใช้แนวคิดสำนักงานไร้กระดาษ (Paperless Office)', process: 'ปรับกระบวนการรับส่งเอกสารให้ตรวจสอบสถานะออนไลน์ได้ ลดเวลารอคอย รองรับการอนุมัติผ่านมือถือ', success: 'ระยะเวลาเฉลี่ยของการเวียนเอกสารลดลงจากหลายวันเหลือไม่ถึงหนึ่งวัน', future: 'เพิ่มระบบลายเซ็นดิจิทัลให้ครบทุกขั้นตอนการอนุมัติ', award: '' },
  { title: 'แชตบอตตอบคำถามนักศึกษาใหม่', category: 'cat2', reason: 'ช่วงรับสมัครนักศึกษาใหม่ เจ้าหน้าที่ต้องตอบคำถามซ้ำๆ ทางไลน์เป็นจำนวนมาก', objective: 'เพื่อลดภาระงานตอบคำถามซ้ำและให้บริการข้อมูลได้ตลอด 24 ชั่วโมง', principle: 'ใช้แนวคิดแชตบอตตอบคำถามอัตโนมัติ (FAQ Chatbot)', process: 'แชตบอตตอบคำถามที่พบบ่อยเกี่ยวกับการสมัครเรียนและทุนการศึกษาโดยอัตโนมัติตลอด 24 ชั่วโมง', success: 'เจ้าหน้าที่มีเวลาดูแลกรณีซับซ้อนมากขึ้น ผู้สมัครได้รับคำตอบเร็วขึ้นแม้นอกเวลาราชการ', future: 'เพิ่มการเชื่อมต่อกับระบบรับสมัครเพื่อตอบคำถามเฉพาะบุคคล', award: '' },
  { title: 'ระบบจองห้องประชุมอัจฉริยะ', category: 'cat1', reason: 'การจองห้องประชุมของแต่ละคณะไม่เชื่อมกัน เกิดปัญหาจองซ้อนกันบ่อยครั้ง', objective: 'เพื่อให้ทุกหน่วยงานเห็นตารางการใช้ห้องประชุมร่วมกันและลดการจองซ้อน', principle: 'ใช้แนวคิดปฏิทินทรัพยากรกลาง (Shared Resource Calendar)', process: 'ระบบจองห้องกลางที่ทุกหน่วยงานเห็นตารางเดียวกัน พร้อมแจ้งเตือนก่อนถึงเวลาประชุม', success: 'ปัญหาจองห้องซ้อนกันหมดไป และใช้พื้นที่ห้องประชุมได้อย่างมีประสิทธิภาพมากขึ้น', future: 'เพิ่มข้อมูลอุปกรณ์ประจำห้องเพื่อให้จองพร้อมอุปกรณ์ได้ในคราวเดียว', award: '' },
  { title: 'เครื่องมือประเมินความพึงพอใจแบบทันที', category: 'cat3', reason: 'แบบประเมินความพึงพอใจกระดาษเก็บข้อมูลช้าและวิเคราะห์ผลได้ยาก', objective: 'เพื่อให้หน่วยงานเห็นผลประเมินความพึงพอใจได้ทันทีหลังรับบริการ', principle: 'ใช้แนวคิดการเก็บข้อมูลแบบทันที (Real-time Feedback) ผ่าน QR Code', process: 'แบบประเมินสั้นผ่าน QR Code พร้อมสรุปผลอัตโนมัติเป็นกราฟให้หน่วยงานนำไปปรับปรุงได้ทันที', success: 'อัตราการตอบแบบประเมินเพิ่มขึ้น และหน่วยงานเห็นผลสรุปได้ภายในวันเดียวกัน', future: 'ขยายใช้กับทุกจุดบริการของมหาวิทยาลัย', award: '' },
  { title: 'ระบบพี่เลี้ยงออนไลน์สำหรับนักศึกษาชั้นปีที่ 1', category: 'cat2', reason: 'นักศึกษาใหม่จำนวนมากปรับตัวลำบากในภาคเรียนแรกแต่ไม่กล้าขอความช่วยเหลือ', objective: 'เพื่อให้นักศึกษาชั้นปีที่ 1 มีที่ปรึกษาที่เข้าถึงง่ายในช่วงปรับตัว', principle: 'ใช้แนวคิดระบบพี่เลี้ยง (Mentoring System)', process: 'จับคู่รุ่นพี่พี่เลี้ยงผ่านระบบออนไลน์ พร้อมช่องทางปรึกษาที่เป็นส่วนตัวและติดตามผลได้', success: 'นักศึกษาชั้นปีที่ 1 ที่เข้าร่วมโครงการมีอัตราการคงอยู่ในระบบการศึกษาสูงขึ้น', future: 'ขยายผลไปยังทุกคณะและจัดอบรมทักษะพี่เลี้ยงเพิ่มเติม', award: '' },
  { title: 'ระบบวิเคราะห์การใช้พื้นที่จอดรถ', category: 'cat1', reason: 'พื้นที่จอดรถในมหาวิทยาลัยไม่เพียงพอในบางช่วงเวลา แต่ไม่มีข้อมูลชัดเจนว่าจุดใดหนาแน่นที่สุด', objective: 'เพื่อให้ผู้บริหารมีข้อมูลประกอบการวางแผนจัดสรรพื้นที่จอดรถ', principle: 'ใช้แนวคิดการวิเคราะห์การใช้พื้นที่เชิงสถิติ', process: 'เก็บข้อมูลการใช้พื้นที่จอดรถแต่ละจุดและนำเสนอเป็นภาพรวมเพื่อวางแผนจัดสรรพื้นที่เพิ่มเติม', success: 'ผู้บริหารมีข้อมูลประกอบการตัดสินใจขยายพื้นที่จอดรถในจุดที่หนาแน่นจริง', future: 'เชื่อมข้อมูลกับป้ายแนะนำที่จอดรถว่างแบบเรียลไทม์', award: '' }
];

/**
 * Seeds ~15 published sample submissions (full KM-form content) so the
 * public gallery has content to demo. Safe to re-run: it replaces the
 * fixed SUB-DEMO-xx rows rather than duplicating them, and re-ensures the
 * Submissions sheet has all current headers before writing. Also flips
 * allowSubmission/allowPublic on so the gallery and submission form are
 * immediately usable after seeding.
 */
function seedDemoSubmissions() {
  ensureSheetWithHeaders_(getSpreadsheet_(), SHEET_NAMES.SUBMISSIONS, SUBMISSIONS_HEADERS);

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
      organization: DEMO_ORGANIZATIONS_[index % DEMO_ORGANIZATIONS_.length],
      responsible_people: JSON.stringify([DEMO_PEOPLE_[index % DEMO_PEOPLE_.length]]),
      reason_importance: '<p>' + demo.reason + '</p>',
      objective_goal: '<p>' + demo.objective + '</p>',
      principle_theory: '<p>' + demo.principle + '</p>',
      development_process: '<p>' + demo.process + '</p>',
      success_evidence: '<p>' + demo.success + '</p>',
      future_direction: '<p>' + demo.future + '</p>',
      recognition_award: demo.award ? '<p>นำเสนอในเวที KM YRU Forum และได้รับ' + demo.award + '</p>' : '',
      knowledge_capture: '<p>สังเคราะห์เป็นแนวปฏิบัติที่ดี (Best Practice) สำหรับหน่วยงานอื่นนำไปประยุกต์ใช้ต่อ</p>',
      reference_link: '',
      images: JSON.stringify([{ fileId: '', url: DEMO_COVER_IMAGES_[index % DEMO_COVER_IMAGES_.length], name: 'cover.jpg' }]),
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
