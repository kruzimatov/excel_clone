const WORKBOOK_SYNC_SECRET = PropertiesService.getScriptProperties().getProperty('WORKBOOK_SYNC_SECRET');
const TARGET_SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('WORKBOOK_TARGET_SPREADSHEET_ID');

function doPost(event) {
  const payload = JSON.parse(event.postData.contents || '{}');

  if (WORKBOOK_SYNC_SECRET && payload.secret !== WORKBOOK_SYNC_SECRET) {
    return jsonResponse({ ok: false, error: 'Invalid sync secret.' });
  }

  const spreadsheet = getTargetSpreadsheet(payload);

  payload.sheets.forEach((sheetPayload) => {
    const sheet = getOrCreateSheet(spreadsheet, `${payload.title || payload.currentFileName || payload.id} - ${sheetPayload.name}`);
    sheet.clearContents();

    if (!sheetPayload.csv) {
      return;
    }

    const values = Utilities.parseCsv(sheetPayload.csv);
    if (values.length > 0 && values[0].length > 0) {
      sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
    }
  });

  return jsonResponse({
    ok: true,
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
  });
}

function getTargetSpreadsheet(payload) {
  if (TARGET_SPREADSHEET_ID) {
    return SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  }

  // Fallback for first-time setup: create a single shared export spreadsheet.
  const spreadsheet = SpreadsheetApp.create(payload.title || payload.currentFileName || 'Workbook export');
  PropertiesService.getScriptProperties().setProperty('WORKBOOK_TARGET_SPREADSHEET_ID', spreadsheet.getId());
  return spreadsheet;
}

function getOrCreateSheet(spreadsheet, sheetName) {
  const safeName = sanitizeSheetName(sheetName);
  return spreadsheet.getSheetByName(safeName) || spreadsheet.insertSheet(safeName);
}

function sanitizeSheetName(value) {
  return String(value || 'Sheet')
    .replace(/[\\/?*[\]:]/g, '_')
    .slice(0, 100);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
