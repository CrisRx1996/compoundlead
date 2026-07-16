# CompoundLead

Prescriber prospecting for **QCRx (Quality Compounding Rx)**.

Pick a licensed state → pick a city → check the services you compound → get a scored, exportable list of clinics that likely write those scripts.

Built for one job: **find practices worth calling, and get them into a spreadsheet.**

---

## Quick start (2 minutes, no accounts needed)

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

It runs in **Demo mode** out of the box with realistic sample clinics — no Google account, no API key, no credit card. This is what you show George first.

---

## The two modes

| | Demo mode | Live mode |
|---|---|---|
| **Trigger** | No API key set (default) | `GOOGLE_PLACES_API_KEY` is set |
| **Data** | ~21 invented clinics per city | Real Google Places listings |
| **Cost** | $0 | Free up to ~1,600 searches/mo, then metered |
| **Banner** | Orange "Demo data" | Green "Live data" |

Everything else — scoring, filtering, dedupe, export — is identical. Flip the key and the same app becomes real.

---

## Going live with Google

George needs a Google Cloud account for this part. He does **not** need one to see the demo.

1. Go to <https://console.cloud.google.com/> → create a project (name it anything, e.g. "QCRx Leads").
2. **APIs & Services → Library** → search **"Places API (New)"** → **Enable**.
   - ⚠️ It must be **Places API (New)**, not the old "Places API". The app uses the new endpoint.
3. **APIs & Services → Credentials** → **Create credentials → API key** → copy it.
4. Recommended: click the key → **Restrict key** → under API restrictions, select only *Places API (New)*.
5. Create a file called `.env.local` in this folder:
   ```
   GOOGLE_PLACES_API_KEY=paste_the_key_here
   ```
6. Restart (`npm run dev`). The banner should turn green and read **Live data**.

Billing must be enabled on the Google project even to use the free allowance — Google requires a card on file. New accounts also get a $300 / 90-day credit.

### What it costs

Google's Text Search gives **5,000 free calls per month**, then $32 per 1,000.

One city + one service ≈ 3 calls (it pages through results to get ~60 clinics). So:

> **5,000 free calls ÷ ~3 per search ≈ 1,600 searches/month, free.**

Realistic prospecting volume stays inside the free tier. The app requests only the fields the table needs, to keep billing on the cheapest applicable tier.

**Before quoting George a number, confirm current pricing in the Cloud Console billing estimator.** Google bills Places at the *highest* tier among the fields requested, and they've changed this pricing before (the old $200/mo pooled credit ended Feb 2025).

---

## Deploying to Netlify

This won't disturb any site already on the account — it's a separate site.

1. Push this folder to a new GitHub repo.
2. Netlify → **Add new site → Import an existing project** → pick the repo.
3. Build settings are read automatically from `netlify.toml`. Leave them alone.
4. To run live: **Site configuration → Environment variables → Add** `GOOGLE_PLACES_API_KEY`.
   - Skip this and the deployed site stays in demo mode — which is a fine way to let George click around before he sets up Google.
5. Deploy.

Free tier is sufficient. Searches run server-side in ~5-15 seconds and stay under Netlify's function timeout.

---

## How it works

```
State + City + Services
        ↓
Google Places Text Search  (or mock data)
        ↓
Dedupe   — same clinic found by 3 keywords collapses to 1 row
        ↓
Score    — 0-100, every point explained
        ↓
Enrich   — visit clinic's own site, look for a public email
        ↓
Table → CSV / Excel
```

### The score

Transparent by design. Click any row and it shows exactly why it got the number.

| Band | Range | Meaning |
|---|---|---|
| **HOT** | 80-100 | Multiple target services, reachable, established |
| **QUALIFIED** | 60-79 | Good fit, worth the call |
| **REVIEW** | 40-59 | Maybe — read the reasons |
| **LOW** | 0-39 | Probably skip |

Points come from: service match (0-45), name signals (0-12), contactability (phone +10, website +8, email +7), market presence (0-18), minus disqualifiers (permanently closed −40).

To retune what George cares about, edit the weights in `src/lib/keywords.ts` — no other file needs to change.

### About emails

Google does not hand out email addresses. The app takes each clinic's website and looks for an email publicly posted on their own contact/about page.

**Expect ~30-40% to have one.** Nearly every row will have a phone and website; a minority will have email. That's the honest ceiling without buying a data vendor. It respects `robots.txt` and identifies itself with a real User-Agent.

---

## Configuring it for George

| What | Where |
|---|---|
| Licensed states + cities | `src/lib/territory.ts` |
| Services / keywords / weights | `src/lib/keywords.ts` |
| Score formula | `src/lib/score.ts` |
| Excluded businesses (vet, chains) | `EXCLUDE_TERMS` in `src/lib/keywords.ts` |
| Demo clinics | `src/lib/mock.ts` |

**Territory is currently the 18 states QCRx lists as licensed:**
AZ, CO, FL, GA, ID, IA, ME, MN, MO, MT, NM, NY, NV, NC, UT, WA, WI, WY.

Verify against <https://www.qcrxusa.com/licensed-states> before George uses it in anger — if the pharmacy adds a state, add it here or those leads never surface.

Veterinary practices are filtered out by default, per George's formulary.

---

## What this deliberately does not do

Cut to keep it simple and cheap. Each is a straightforward add later if George pays for it:

- No database — results live in the browser session; export is the save button
- No login / user accounts
- No CRM pipeline or contact-status tracking
- No scheduled re-checking of old leads
- No AI calls — **the app itself never calls an LLM, so there is no per-use AI cost, ever**

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · `xlsx`. No database, no auth.

```
src/lib/        territory, keywords, scoring, places client, mock data, dedupe, email
src/app/api/    search, enrich, export
src/components/ ScoreChip, ResultsTable
```
