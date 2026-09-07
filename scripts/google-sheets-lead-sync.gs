/**
 * GoGlobe Lead Sync — pushes new rows from this Google Sheet into the
 * GoGlobe Ops portal automatically, every 5 minutes.
 *
 * SETUP (do this once):
 * 1. Open your Google Sheet.
 * 2. Extensions -> Apps Script. Delete anything in the editor and paste
 *    this whole file in.
 * 3. Edit the CONFIG section right below — set PORTAL_URL to your real
 *    deployed address, and make COLUMN_MAP match your sheet's actual
 *    column headers exactly (case matters).
 * 4. In the toolbar, select the function dropdown, choose "createTrigger",
 *    and click Run once. Google will ask you to authorize the script the
 *    first time — this is normal; it's just your own script talking to
 *    your own portal, nothing else can see this.
 * 5. Done. From now on, any new row gets checked every 5 minutes and sent
 *    automatically. A "Portal Status" column appears on the right side of
 *    your sheet showing "Synced ..." or "Failed ..." for every row, so your
 *    team can see at a glance whether it worked.
 */

// ====================== CONFIGURATION ======================

// Replace with your real deployed address once you've completed deployment.
// It must end in /api/leads exactly like this.
const PORTAL_URL = 'https://YOUR-DEPLOYED-URL.onrender.com/api/leads';

// What every new lead from this sheet is tagged as inside the portal.
// Change to whatever makes sense — e.g. 'Facebook' if this sheet only
// ever holds Facebook Lead Ads submissions.
const LEAD_SOURCE = 'Facebook';

// Map each portal field to the EXACT header text used in row 1 of your
// sheet. Only "name" and "phone" are required — leave the others as ''
// (empty string) if your sheet doesn't have that column.
const COLUMN_MAP = {
  name: 'Full Name',
  phone: 'Phone Number',
  destination: 'Country',        // which country/visa they're asking about — optional
  visaType: 'Visa Type',          // optional
  message: 'Message',             // optional, any free-text query
  campaign: 'Campaign Name',      // optional — which Facebook ad this lead came from
};

// This column gets created automatically — don't need to add it yourself.
const STATUS_COLUMN = 'Portal Status';

// =================== END OF CONFIGURATION ===================

function syncLeadsToPortal() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return; // header row only, nothing to sync yet

  const headers = data[0];
  let statusColIndex = headers.indexOf(STATUS_COLUMN);
  if (statusColIndex === -1) {
    sheet.getRange(1, headers.length + 1).setValue(STATUS_COLUMN);
    statusColIndex = headers.length;
  }

  const nameIdx = headers.indexOf(COLUMN_MAP.name);
  const phoneIdx = headers.indexOf(COLUMN_MAP.phone);
  const destIdx = COLUMN_MAP.destination ? headers.indexOf(COLUMN_MAP.destination) : -1;
  const visaIdx = COLUMN_MAP.visaType ? headers.indexOf(COLUMN_MAP.visaType) : -1;
  const msgIdx = COLUMN_MAP.message ? headers.indexOf(COLUMN_MAP.message) : -1;
  const campaignIdx = COLUMN_MAP.campaign ? headers.indexOf(COLUMN_MAP.campaign) : -1;

  if (nameIdx === -1 || phoneIdx === -1) {
    Logger.log('STOPPED: could not find your Name or Phone column. Check that COLUMN_MAP.name and COLUMN_MAP.phone exactly match the header text in row 1 of your sheet (including capitalization).');
    return;
  }

  let sentCount = 0;

  for (let row = 1; row < data.length; row++) {
    const alreadyProcessed = data[row][statusColIndex];
    if (alreadyProcessed) continue;

    const name = data[row][nameIdx];
    const phone = data[row][phoneIdx];
    if (!name || !phone) continue; // incomplete row — leave unmarked, will retry next run in case it gets filled in

    const payload = {
      name: String(name),
      phone: String(phone),
      destination: destIdx > -1 ? String(data[row][destIdx] || '') : '',
      visaType: visaIdx > -1 ? String(data[row][visaIdx] || '') : '',
      message: msgIdx > -1 ? String(data[row][msgIdx] || '') : '',
      source: LEAD_SOURCE,
      campaign: campaignIdx > -1 ? String(data[row][campaignIdx] || '') : '',
    };

    try {
      const response = UrlFetchApp.fetch(PORTAL_URL, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
      const code = response.getResponseCode();
      if (code === 201) {
        sheet.getRange(row + 1, statusColIndex + 1).setValue('Synced ' + new Date().toLocaleString());
        sentCount++;
      } else {
        sheet.getRange(row + 1, statusColIndex + 1).setValue('Failed (' + code + '): ' + response.getContentText().slice(0, 100));
      }
    } catch (e) {
      sheet.getRange(row + 1, statusColIndex + 1).setValue('Error: ' + e.message);
    }
  }

  if (sentCount > 0) Logger.log('Synced ' + sentCount + ' new lead(s) to the portal.');
}

// Run this ONCE from the function dropdown to turn on automatic syncing
// every 5 minutes. You never need to run it again after that.
function createTrigger() {
  // Remove any existing sync triggers first, so running this twice
  // doesn't create duplicates that would send every lead multiple times.
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'syncLeadsToPortal') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncLeadsToPortal')
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log('Automatic sync is now on — checking for new leads every 5 minutes.');
}
