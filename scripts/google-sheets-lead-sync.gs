/**
 * GoGlobe Lead Sync — pushes new rows from your Facebook/Instagram Lead
 * Ads export sheet into the GoGlobe Ops portal automatically, every 5
 * minutes. Written to match your actual sheet's real column headers
 * ("full_name", "phone_number", "please_select_desired_country_?", etc.)
 * — the ones from your Facebook Lead Ads form, not a generic guess.
 *
 * SETUP (do this once):
 * 1. Open your Google Sheet.
 * 2. Extensions -> Apps Script. Delete anything in the editor and paste
 *    this whole file in.
 * 3. Set PORTAL_URL below to your real deployed address.
 * 4. In the toolbar, select the function dropdown, choose "createTrigger",
 *    and click Run once. Google will ask to authorize — that's normal,
 *    it's just your own script talking to your own portal.
 * 5. Done. Every new row gets checked every 5 minutes and sent
 *    automatically. A "Portal Status" column appears showing "Synced ..."
 *    or "Failed ..." for every row.
 *
 * IMPORTANT — read this once:
 * Your sheet has columns like "Lead Status", "Assigned Consultant", and
 * "Deal Value" that your team has been filling in by hand. This script
 * does NOT read or sync those — once a lead is in the portal, all of
 * that tracking (stage, who it's assigned to, follow-ups) should happen
 * INSIDE the portal from then on, not in this sheet. Otherwise you end
 * up with two different places showing two different statuses for the
 * same client, and nobody knows which one is true. Think of this sheet
 * as the intake point only — the portal is where the real work happens
 * after that.
 */

// ====================== CONFIGURATION ======================

const PORTAL_URL = 'https://YOUR-DEPLOYED-URL.onrender.com/api/leads';

// Your sheet's exact real column headers (from row 1), matched already —
// you shouldn't need to touch this section unless Facebook changes your
// form's field names.
const COLUMN_MAP = {
  name: 'full_name',
  phone: 'phone_number',
  email: 'email',
  country: 'please_select_desired_country_?',
  travelHistory: 'do_you_have_any_travel_history_before_?',
  platform: 'platform',           // fb / ig
  campaign: 'campaign_name',
  city: 'city',
  createdTime: 'created_time',
};

// Maps whatever country name your form collects to the destination
// categories your portal actually uses. Schengen-area countries all
// bucket into "Schengen" since that's how your rate card is organised.
// Add more lines here any time your ad targets a new country.
const COUNTRY_MAP = {
  'uk': 'UK', 'united kingdom': 'UK',
  'usa': 'USA', 'us': 'USA', 'united states': 'USA',
  'canada': 'Canada',
  'australia': 'Australia',
  'schengen': 'Schengen', 'belgium': 'Schengen', 'spain': 'Schengen',
  'switzerland': 'Schengen', 'norway': 'Schengen', 'france': 'Schengen',
  'germany': 'Schengen', 'italy': 'Schengen', 'netherlands': 'Schengen',
  'turkiye': 'Türkiye', 'turkey': 'Türkiye',
  'new zealand': 'New Zealand', 'nz': 'New Zealand',
  'uae': 'UAE', 'dubai': 'UAE',
  'saudi arabia': 'Saudi Arabia', 'ksa': 'Saudi Arabia', 'saudi': 'Saudi Arabia',
  'azerbaijan': 'Azerbaijan',
  'morocco': 'Morocco',
  'malaysia': 'Malaysia',
};

function normalizeCountry(raw) {
  const first = String(raw || '').split('|')[0].trim().toLowerCase();
  return COUNTRY_MAP[first] || (first ? first.charAt(0).toUpperCase() + first.slice(1) : '');
}

function normalizePlatform(raw) {
  const p = String(raw || '').trim().toLowerCase();
  if (p === 'fb' || p === 'facebook') return 'Facebook';
  if (p === 'ig' || p === 'instagram') return 'Instagram';
  return 'Facebook'; // sensible default for this form
}

function normalizePhone(raw) {
  // Strips a leading "p:" that Facebook's export adds, e.g. "p:+923127391451"
  return String(raw || '').replace(/^p:/i, '').trim();
}

const STATUS_COLUMN = 'Portal Status';

// =================== END OF CONFIGURATION ===================

function syncLeadsToPortal() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  const headers = data[0];
  let statusColIndex = headers.indexOf(STATUS_COLUMN);
  if (statusColIndex === -1) {
    sheet.getRange(1, headers.length + 1).setValue(STATUS_COLUMN);
    statusColIndex = headers.length;
  }

  const idx = {};
  for (const key in COLUMN_MAP) idx[key] = headers.indexOf(COLUMN_MAP[key]);

  if (idx.name === -1 || idx.phone === -1) {
    Logger.log('STOPPED: could not find the "' + COLUMN_MAP.name + '" or "' + COLUMN_MAP.phone + '" column. Check row 1 of your sheet still has these exact headers.');
    return;
  }

  let sentCount = 0;

  for (let row = 1; row < data.length; row++) {
    if (data[row][statusColIndex]) continue; // already processed

    const name = data[row][idx.name];
    const phone = normalizePhone(data[row][idx.phone]);
    if (!name || !phone) continue; // incomplete row — retry next run in case it fills in

    const rawCountry = idx.country > -1 ? String(data[row][idx.country] || '') : '';
    const allCountries = rawCountry.split('|').map(s => s.trim()).filter(Boolean);
    const primaryDestination = normalizeCountry(rawCountry);

    const noteParts = [];
    if (idx.email > -1 && data[row][idx.email]) noteParts.push('Email: ' + data[row][idx.email]);
    if (idx.city > -1 && data[row][idx.city]) noteParts.push('City: ' + data[row][idx.city]);
    if (idx.travelHistory > -1 && data[row][idx.travelHistory]) noteParts.push('Travel history: ' + data[row][idx.travelHistory]);
    if (allCountries.length > 1) noteParts.push('Also mentioned: ' + allCountries.slice(1).join(', '));

    const payload = {
      name: String(name),
      phone: phone,
      destination: primaryDestination,
      visaType: '',
      message: noteParts.join(' · '),
      source: idx.platform > -1 ? normalizePlatform(data[row][idx.platform]) : 'Facebook',
      campaign: idx.campaign > -1 ? String(data[row][idx.campaign] || '') : '',
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

function createTrigger() {
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
