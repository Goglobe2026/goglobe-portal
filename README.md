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

Dashboard, Leads, Campaigns, Cases (full case file with color-coded document
checklist, discounts, manager review), Appointments (calendar booking view),
Pricing by country, HR Department (employee directory, full onboarding form,
PIN reset, appreciation/fines, leave requests), Attendance, Accounts, Reports
& Finance (weekly comparison, monthly trend, expense breakdown, bank
accounts, journal vouchers), and My Portal (employee self-service).

## Running it locally

```bash
npm install
npm run seed      # populates starter data — safe to run once
cp .env.example .env.local
# edit .env.local: set a real SESSION_SECRET
npm run build
npm start
```

Default CEO PIN after seeding: **9999** — change it immediately from
Reports & Finance → Owner PIN, same as before.

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
automatically pushes every new row into the portal — no manual copying, no
missed follow-ups. Full setup instructions are written as comments at the top
of that file. Short version:

1. Open your Google Sheet → Extensions → Apps Script.
2. Paste in the contents of `scripts/google-sheets-lead-sync.gs`.
3. Edit the CONFIG section at the top: set `PORTAL_URL` to your real deployed
   address, and make `COLUMN_MAP` match your sheet's actual column headers.
4. Run the `createTrigger` function once (you'll need to authorize it —
   that's normal, it's just your script talking to your own portal).
5. Done. Every 5 minutes, any new row gets sent automatically, and a
   "Portal Status" column shows "Synced ..." or "Failed ..." next to each
   row so your team can see at a glance whether it worked.

Leads that arrive this way are tagged with source "Facebook" (editable in
the script) and, if your sheet has a campaign column, attributed to the
specific ad that generated them — which feeds straight into the existing
cost-per-lead numbers on the Campaigns page. Every new lead also gets an
automatic "follow up today" reminder, so it shows up immediately under
Leads → Follow-ups due.

## Honest limitations, carried over from before

- PINs are a convenience gate for a trusted small team, not a public account
  system with password recovery, 2FA, etc.
- Data lives in JSON files, not a full relational database — fine at your
  current scale, a contained migration if you outgrow it.
- No live bank feed — balances in Reports & Finance are entered manually.
- WhatsApp messages still open with one tap to send, not fully automatic —
  that still needs the WhatsApp Business API / BSP connection discussed
  separately.
