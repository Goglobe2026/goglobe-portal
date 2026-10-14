/**
 * GoGlobe Lead Sync — sends every new row of a Facebook / Instagram Lead Ads
 * sheet to the GoGlobe Ops portal automatically, every 5 minutes.
 *
 * It sends the WHOLE ROW exactly as it is in the sheet. The portal works out
 * the name, phone number, country, profession, campaign and the answers to
 * your form questions by itself — so the same script works for the Schengen
 * sheet, the UK sheet, or any new Facebook form, without changing columns.
 *
 * The portal also protects you from double entries: a lead that is already in
 * the portal (same Facebook lead id, or same phone number) is simply marked
 * "Synced" and not added twice. Rows without a phone number are left alone
 * and marked "Skipped — no phone".
 *
 * SETUP (do this once per sheet):
 * 1. Open the Google Sheet that receives your Facebook leads.
 * 2. Extensions -> Apps Script. Delete anything in the editor and paste this
 *    whole file in.
 * 3. Set PORTAL_URL below to your portal address (keep /api/leads at the end).
 * 4. If the leads are NOT on the first tab of the sheet, set TAB_NAME or
 *    TAB_GID (the number after "gid=" in the browser address bar).
 * 5. In the toolbar choose the function "createTrigger" and click Run once.
 *    Google asks you to authorize — normal, it is your own script talking to
 *    your own portal.
 * 6. Done. A "Portal Status" column appears on the right: "Synced ..." for
 *    every row that reached the portal, "Failed ..." if something went wrong
 *    (it retries on the next run).
 *
 * Optional: run "syncLeadsToPortal" once by hand to send everything now.
 *
 * Only the intake happens here. Stage, follow-ups, assignment and notes are
 * managed inside the portal from then on.
 *
 * OLD ROWS: the first run would send every row already in the sheet. To skip
 * old leads, set ONLY_NEWER_THAN_DAYS (for example 30). Older rows are marked
 * "Skipped — older than 30 days" and are never sent.
 */

// ====================== CONFIGURATION ======================

const PORTAL_URL = 'https://YOUR-DEPLOYED-URL.onrender.com/api/leads';

// Leave both empty to use the first tab. Set ONE of them for another tab.
const TAB_NAME = '';
const TAB_GID = '';          // e.g. '754438' for the UK sheet

// 0 = send every row. 30 = ignore rows older than 30 days.
const ONLY_NEWER_THAN_DAYS = 30;

// The column where Facebook's creation time is kept (used for the age check).
const CREATED_COLUMN_HINTS = ['created_time', 'created time', 'timestamp'];

const STATUS_COLUMN = 'Portal Status';

// =================== END OF CONFIGURATION ===================

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (TAB_NAME) {
    const s = ss.getSheetByName(TAB_NAME);
    if (s) return s;
    throw new Error('No tab called "' + TAB_NAME + '"');
  }
  if (TAB_GID) {
    const s = ss.getSheets().filter(function (x) { return String(x.getSheetId()) === String(TAB_GID); })[0];
    if (s) return s;
    throw new Error('No tab with gid ' + TAB_GID);
  }
  return ss.getSheets()[0];
}

function syncLeadsToPortal() {
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  const headers = data[0].map(function (h) { return String(h); });
  let statusCol = headers.indexOf(STATUS_COLUMN);
  if (statusCol === -1) {
    sheet.getRange(1, headers.length + 1).setValue(STATUS_COLUMN);
    statusCol = headers.length;
  }

  let createdCol = -1;
  headers.forEach(function (h, i) {
    if (createdCol === -1 && CREATED_COLUMN_HINTS.indexOf(h.trim().toLowerCase()) > -1) createdCol = i;
  });
  const cutoff = ONLY_NEWER_THAN_DAYS > 0 ? Date.now() - ONLY_NEWER_THAN_DAYS * 86400000 : 0;

  let sent = 0;
  for (let r = 1; r < data.length; r++) {
    if (data[r][statusCol]) continue; // already handled

    const rowObj = {};
    let hasAny = false;
    headers.forEach(function (h, c) {
      if (c === statusCol || !h) return;
      let v = data[r][c];
      if (v instanceof Date) v = Utilities.formatDate(v, 'Asia/Karachi', "yyyy-MM-dd'T'HH:mm:ssXXX");
      v = (v === null || v === undefined) ? '' : String(v);
      if (v !== '') hasAny = true;
      rowObj[h] = v;
    });
    if (!hasAny) continue;

    if (cutoff && createdCol > -1) {
      const t = new Date(data[r][createdCol]).getTime();
      if (t && t < cutoff) {
        sheet.getRange(r + 1, statusCol + 1).setValue('Skipped — older than ' + ONLY_NEWER_THAN_DAYS + ' days');
        continue;
      }
    }

    try {
      const res = UrlFetchApp.fetch(PORTAL_URL, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ row: rowObj }),
        muteHttpExceptions: true,
      });
      const code = res.getResponseCode();
      const body = res.getContentText();
      let note = '';
      if (code === 201) { note = 'Synced ' + new Date().toLocaleString(); sent++; }
      else if (code === 200 && /duplicate/.test(body)) note = 'Synced (already in portal) ' + new Date().toLocaleString();
      else if (code === 400 && /phone/i.test(body)) note = 'Skipped — no phone';
      else note = 'Failed (' + code + '): ' + body.slice(0, 100);
      sheet.getRange(r + 1, statusCol + 1).setValue(note);
    } catch (e) {
      sheet.getRange(r + 1, statusCol + 1).setValue('Error: ' + e.message);
    }
  }
  if (sent) Logger.log('Sent ' + sent + ' new lead(s) to the portal.');
}

function createTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncLeadsToPortal') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncLeadsToPortal').timeBased().everyMinutes(5).create();
  Logger.log('Automatic sync is on — checking for new leads every 5 minutes.');
}
