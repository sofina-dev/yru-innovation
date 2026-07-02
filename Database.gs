/**
 * Lean Sheets data-access layer.
 *
 * Perf rules that fix the v1 slowness:
 *  - Each sheet is read at most ONCE per request (memoized in __sheetCache_).
 *  - Single-record writes are exactly ONE getRange().setValues() call for the
 *    whole row (never a per-field loop).
 *  - Bulk writes (many rows) use ONE getDataRange()/setValues() round trip
 *    via batchUpdateRows_, never a loop of per-row calls.
 */

var __ss_ = null;
var __sheetCache_ = {};

function getSpreadsheetId_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error('ยังไม่ได้ตั้งค่าฐานข้อมูล กรุณารันฟังก์ชัน setupDatabase() ก่อนใช้งาน');
  }
  return id;
}

function getSpreadsheet_() {
  if (!__ss_) {
    __ss_ = SpreadsheetApp.openById(getSpreadsheetId_());
  }
  return __ss_;
}

function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) {
    throw new Error('ไม่พบชีท: ' + name);
  }
  return sheet;
}

function getSheetHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) {
    return [];
  }
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(function (header) { return String(header || '').trim(); });
}

function readRows_(name) {
  if (__sheetCache_[name]) {
    return __sheetCache_[name];
  }

  const sheet = getSheet_(name);
  const values = sheet.getDataRange().getValues();
  const rows = [];
  if (values.length > 1) {
    const headers = values[0].map(function (header) { return String(header || '').trim(); });
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row.every(function (cell) { return cell === ''; })) {
        continue;
      }
      const record = { _row: i + 1 };
      headers.forEach(function (header, columnIndex) {
        if (header) {
          record[header] = row[columnIndex];
        }
      });
      rows.push(record);
    }
  }

  __sheetCache_[name] = rows;
  return rows;
}

function invalidateCache_(name) {
  delete __sheetCache_[name];
}

function findRow_(name, keyField, keyValue) {
  return readRows_(name).find(function (row) {
    return String(row[keyField]) === String(keyValue);
  }) || null;
}

function upsertRow_(name, keyField, record) {
  const sheet = getSheet_(name);
  const headers = getSheetHeaders_(sheet);
  const existing = findRow_(name, keyField, record[keyField]);

  const rowArray = headers.map(function (header) {
    if (Object.prototype.hasOwnProperty.call(record, header)) {
      return record[header];
    }
    return existing ? existing[header] : '';
  });

  if (existing) {
    sheet.getRange(existing._row, 1, 1, headers.length).setValues([rowArray]);
  } else {
    sheet.appendRow(rowArray);
  }

  invalidateCache_(name);
  return record[keyField];
}

function batchAppendRows_(name, records) {
  if (!records || records.length === 0) {
    return;
  }
  const sheet = getSheet_(name);
  const headers = getSheetHeaders_(sheet);
  const matrix = records.map(function (record) {
    return headers.map(function (header) {
      return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
    });
  });
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, matrix.length, headers.length).setValues(matrix);
  invalidateCache_(name);
}

/**
 * Bulk-mutate every row of a sheet in a single read + single write.
 * updater(record) should return a partial object of changed fields, or a
 * falsy value to leave the row untouched.
 */
function batchUpdateRows_(name, updater) {
  const sheet = getSheet_(name);
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length < 2) {
    return;
  }

  const headers = values[0].map(function (header) { return String(header || '').trim(); });
  let changed = false;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(function (cell) { return cell === ''; })) {
      continue;
    }
    const record = {};
    headers.forEach(function (header, columnIndex) {
      if (header) {
        record[header] = row[columnIndex];
      }
    });

    const patch = updater(record);
    if (patch) {
      changed = true;
      headers.forEach(function (header, columnIndex) {
        if (Object.prototype.hasOwnProperty.call(patch, header)) {
          row[columnIndex] = patch[header];
        }
      });
    }
  }

  if (changed) {
    range.setValues(values);
    invalidateCache_(name);
  }
}

function removeRow_(name, keyField, keyValue) {
  const existing = findRow_(name, keyField, keyValue);
  if (!existing) {
    return false;
  }
  getSheet_(name).deleteRow(existing._row);
  invalidateCache_(name);
  return true;
}

function ensureSheetWithHeaders_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}
