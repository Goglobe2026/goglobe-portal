# GoGlobe Ops — Next.js Edition

A full rebuild of the GoGlobe visa consultancy portal in Next.js, React, and
TypeScript — a modern, standard stack that's easy to hand to future developers.
This replaces the earlier single-HTML-file version.

## What changed from the old version

- **Real server-side sessions.** Login now sets a signed, httpOnly cookie
  instead of embedding an API key in the page itself. That key was a known
  weak point in the old version — this is a genuine security improvement,
  not just a different look.
- **One codebase, one deployment.** The old setup had a separate Express
  backend and a static HTML file. This is now a single Next.js app: pages,
  API routes, and the database layer all live together.
- **Same JSON-file storage approach** as the backend you already deployed —
  proven, simple, no database server to manage. Swappable for Postgres later
  if you outgrow it.

## Every module is here

Dashboard, Leads, Campaigns (budgets and ad spend), Cases (full case file with
color-coded document checklist, discounts, quality check, manager review),
Appointments (calendar booking view), Pricing by country, HR Department
(employee directory, full onboarding form, PIN reset, appreciation/fines,
leave requests), Attendance, Payroll, Accounts, Monthly Closing, Reports &
Finance (weekly comparison, monthly trend, expense breakdown, bank accounts,
journal vouchers), Quality Control, Team Messages, and My Portal (employee
self-service).

The sidebar groups every module under small headings (Marketing, Cases &
Clients, HR, Finance, Quality & Team). Click a heading for that group's
overview, or use the ◀ button at the top to shrink the sidebar to an icon
strip — the choice is remembered on that computer.

## Family files, closings and payroll (how the numbers work)

- **Family / group file.** In Cases, "+ Add case" has a *Single client* /
  *Family / group file* switch. A family is one case with many applicants,
  one fee, one ledger and one invoice. Add members one by one, or paste a list
  (`Name, Relation, Passport, Age` — one per line). Visa and appointment fees
  are charged per applicant; the consultation fee once per family unless you
  tick the box. Each member can get their own document checklist.
- **Entering older cases.** The case form takes a closing date, money already
  received (with its date) and an optional bonus, so past cases land in the
  right month without editing anything afterwards.
- **Closed by.** Every case has a *Closed by* employee and a *Closing date*.
  That one entry feeds the employee's monthly performance, targets, the
  Monthly Closing report and payroll. A family file counts as one closed case.
  "Closed" means the deal is booked, not that the visa was approved.
- **Case bonus.** On any case you can give a bonus to one or more employees and
  choose the payroll month. It appears as its own "Case bonus" line on the
  payslip and is marked paid when that pay run is paid, so it never repeats.
- **Payroll.** Salaries are paid on the **5th of the following month**
  (September salary on 5 October). The Payroll page shows the countdown and
  whether the run was on time. Joiners and leavers are paid only for the days
  they worked: working days are Monday to Saturday, pro-rated from the
  employee's joining date and last working day, and the "Days paid" figure can
  be adjusted per employee before approval. Commission is calculated on money
  collected in the pay month on the employee's own closed cases, and needs the
  monthly case quota to be met.
- **Employees** see only their own targets, case bonuses and issued payslips in
  My Portal. They cannot change them.

## Campaigns: budgets, dollar payments and closing

- **One record per campaign** — name, platform, start date, optional monthly
  budget (in dollars or rupees) and, if it differs, the campaign's name in
  Facebook Ads Manager. Campaign names that arrive with leads from the sheet
  or the website are created automatically as *Running* campaigns, ready for a
  budget.
- **Log every ad payment.** Enter the dollars charged, the rate (PKR per $1) and
  the tax / bank-charge %, and the portal works out the rupee cost
  (`$ × rate + tax`). If you know the exact rupee amount on your bank or card
  statement, type it and it overrides the calculation. Rupee payments can be
  entered directly. Each payment is added to **Accounts as an expense in the
  category "Marketing"** on the date paid, so it flows into Reports and the
  Monthly Closing automatically. Editing or removing a payment keeps Accounts in
  step.
- **Several campaigns at once.** Each has its own budget bar, spend, leads,
  cost per lead and cost per client. The tiles on top show this month's ad
  spend, total budget of the running campaigns and what is left or over.
- **Pause / Close / Re-open.** Closing a campaign records its last day; it stops
  counting in future months' budget, keeps all its history, and disappears from
  the lead form's campaign list. Deleting a campaign never deletes the
  expenses already booked.
- **Monthly Closing** shows an *Advertising by campaign* table (USD and PKR
  including tax, against budget) under the expenses.

## Facebook / Google Sheet lead sync

There are two ways in, both safe to use together:

1. **"Sync from Google Sheet" button** (Leads page). Paste one sheet link per
   line (the normal address-bar link works; the sheet must be shared as
   *Anyone with the link → Viewer*). Choose how far back to bring leads
   (default: last 30 days). Different forms with different columns — for
   example the Schengen sheet and the UK sheet — are understood automatically:
   name, phone (Pakistani numbers are repaired to +92 format), country,
   profession, campaign and the answers to the form questions are kept on the
   lead.
2. **Automatic push** with `scripts/google-sheets-lead-sync.gs` (every 5 min,
   described in its header). It sends each row as it is and the portal does
   the mapping.

A lead already in the portal (same Facebook lead id or same phone number) is
never added twice.

## Saving and sharing safely

Everyone on the team can have the portal open at the same time. Saves are
merged record by record, so one person's change can't wipe out another's, a
lead that arrives from the sheet while someone is editing is kept, and the
screen refreshes itself every few seconds with other people's changes.

## Quality Control and Team Messages

- **Quality Control** — before the manager can approve a file, it needs a
  *passing* quality check: ten standard points (passport, matching names,
  photos, forms, financial proof, ...). Any point not ticked needs a written
  reason and the check is recorded as Failed. Every check is kept with who did
  it and when; the page shows pass rate and files still waiting.
- **Team Messages** — private one-to-one chat between any two people (including
  the Head Manager). The server only ever sends you the messages you sent or
  received, so even an admin cannot read someone else's chat, and no one can
  write a message in another person's name. Employees chat from *My Portal*.

## Daily report on WhatsApp

Every evening the Head Manager receives one WhatsApp message with the whole business: new leads and where they came from, follow-ups due and overdue, cases closed, money in and out, ad spend against budget, who is present / late / absent, and a "needs your attention" list (overdue salaries, month closing due, escalated leads, overdue client balances, missed appointments, over-budget campaigns, files failing quality control).

Open **Daily Report** in the sidebar (Head Manager only). It has four tabs: **Report** (today's report as it will look on WhatsApp, any date, *Send now*), **Settings**, **Setup guide** and **History**.

**Default:** off until you finish the setup and tick *Send the daily report automatically*. Then it is sent at **8:00 PM Pakistan time**, covering that same day. You can change the time, or choose a morning report about the day before.

**How it is sent** — pick one under Settings:

* **WhatsApp Business (official, recommended).** One-time setup in Meta's developer site (about 30 minutes): create an app with the WhatsApp product, copy the *Phone number ID*, create a permanent token with a System User, and create one *Utility* message template (the exact text is on the Setup guide tab, ready to copy). Paste the ID and token into Settings. Meta bills business-started template messages per message; one a day is small.
* **CallMeBot (free).** A free third-party hobby service. Fine to try, but its server sees your report; use the official option for real figures.

**Where the token lives.** Saved on the server disk and never sent to the browser again, not even to the Head Manager (only its last four characters are shown). To keep it out of the portal's data completely, set `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` in Render's Environment tab; they then win over anything saved on the page.

**If something fails** (wrong token, number not allowed, template not approved…) the page says why in plain words and tries again every 10 minutes, up to 3 times a day, sending only to the numbers that have not received it yet. A number that already got today's report never gets a second copy. If the server was off at 8 PM, the report goes out as soon as it is back, the same day.

**Render and sleeping.** The sender runs inside the portal and checks the clock every minute. A paid Render service (the portal needs one anyway for its persistent disk) stays awake. If your plan ever lets it sleep, use the *Backup start link* at the bottom of Settings: add it to a free cron website (for example cron-job.org) every 5 minutes. It does nothing unless the report is due.

**Optional settings** (environment variables): `REPORT_TICK_MS` (how often the clock is checked, default 60000), `WHATSAPP_API_BASE` and `CALLMEBOT_BASE` (only for testing against a stand-in server).

## Running it locally

```bash
npm install
npm run seed      # populates starter data — safe to run once
cp .env.example .env.local
# edit .env.local: set a real SESSION_SECRET
npm run build
npm start
```

Default Head Manager PIN after seeding: **9999** — change it immediately from
Reports & Finance → Head Manager PIN. Starter employee PINs are 1001–1008.

## Deploying it live

This runs as a normal Node.js web service — deploy it exactly like the
backend you already set up (Render, Railway, or similar):

1. Push this folder to a GitHub repository.
2. Create a new Web Service, connect the repo.
3. Build command: `npm install && npm run build`
   Start command: `npm start`
4. Environment variables:
   - `SESSION_SECRET` — a long random string (e.g. generate one with
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
     This signs login sessions — treat it like a password, and never reuse
     the placeholder value from `.env.example`.
5. **Attach a persistent disk mounted at `/data`** (or wherever your platform
   places the app's working directory + `/data`) — same reasoning as before:
   free-tier ephemeral filesystems will silently lose your leads, cases, and
   everything else on every restart.
6. After the first deploy, run `npm run seed` once via your host's console/shell
   feature (most platforms offer a "Shell" or "Console" tab) to populate
   starter data. Skip this if you'd rather start completely empty.
7. Visit your service URL — you should land on the sign-in screen.

## Putting a login link on your website

Same as before — add this anywhere in your site's navigation:

```html
<a href="https://your-service-url.onrender.com/">Staff Login</a>
```

## Connecting your website's contact form

Point your form's submit handler at `POST /api/leads` on this same service —
see the earlier backend's README for the exact fetch snippet; the endpoint
signature is identical (`name`, `phone`, `destination`, `visaType`, `message`).

## Connecting your Facebook lead sheet (Google Sheets)

If your Facebook ad leads land in a Google Sheet, `scripts/google-sheets-lead-sync.gs`
pushes every new row into the portal automatically — no manual copying, no
missed follow-ups. Full setup instructions are at the top of that file. Short
version, once per sheet:

1. Open the Google Sheet → Extensions → Apps Script.
2. Paste in the contents of `scripts/google-sheets-lead-sync.gs`.
3. Set `PORTAL_URL` to your real address (ending in `/api/leads`). If the leads
   are not on the first tab, set `TAB_GID` (the number after `gid=` in the
   address bar) — e.g. `754438` for the UK sheet.
4. Run the `createTrigger` function once and authorize it (normal — it is your
   own script talking to your own portal).
5. Done. Every 5 minutes new rows are sent, and a "Portal Status" column shows
   "Synced ...", "Skipped — no phone" or "Failed ..." beside each row.

The script sends the row as it is; the portal does the mapping, so Schengen,
UK or any new Facebook form works without changing columns. Campaign names are
matched to (or create) campaigns on the Campaigns page, which feeds the
cost-per-lead numbers. Every new lead also gets an automatic "follow up today"
reminder under Leads → Follow-ups due.

## Honest limitations, carried over from before

- PINs are a convenience gate for a trusted small team, not a public account
  system with password recovery, 2FA, etc.
- Data lives in JSON files, not a full relational database — fine at your
  current scale, a contained migration if you outgrow it.
- No live bank feed — balances in Reports & Finance are entered manually.
- WhatsApp messages still open with one tap to send, not fully automatic —
  that still needs the WhatsApp Business API / BSP connection discussed
  separately.
