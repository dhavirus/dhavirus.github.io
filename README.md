# Private diary + calorie/macro tracker

Plain HTML/CSS/JS, no build step. Backend is Supabase (Postgres + Auth, free
tier). Single-user site — only one account will ever exist.

## Pages

- `index.html` — public cover page. Shows a "Log in" button when signed out,
  or links to Diary / Food log / Profile when signed in.
- `login.html` — public, email + password form.
- `diary.html` — blog-style board of entries with a mini calendar sidebar (protected).
- `entry.html` — the entry editor: title, date, pin, font, thumbnail, rich content with images/code blocks (protected).
- `profile.html` — BMR/TDEE/macro targets (protected).
- `log.html` — daily food log (protected).

## Supabase project setup

1. Create/open the project at supabase.com. This site is already configured
   to point at `https://kmnonsjbawulpsditiwy.supabase.co` (see
   `js/supabaseClient.js`).
2. **SQL Editor** → New query → paste and run all of `supabase/schema.sql`.
   This creates the four tables (`profile`, `diary_entries`, `custom_foods`,
   `food_logs`), enables Row Level Security on each, and creates the private
   `diary-images` storage bucket (for entry thumbnails/inline images) with
   owner-only access policies — no separate dashboard step needed for that.
   The whole file is safe to paste and run again any time this project adds
   new columns/tables/policies — every statement is a no-op if it's already
   applied.
3. **Authentication → Users** → Add user → create your own email, with
   "Auto Confirm User" checked (do this *before* the next step).
4. **Set a password for that user**: open the user's detail page — most
   Supabase dashboards let you set a password directly there. If yours
   doesn't, use "Send password recovery" once to set it via email instead.
5. **Authentication → Providers → Email** → turn **off** "Allow new users to
   sign up." This is what keeps the site single-user: the login page is
   public, but only the pre-created account can ever get a session.
6. **Authentication → URL Configuration** → set Site URL to
   `https://dhavirus.github.io` (harmless to also add `http://localhost:8000`
   for local testing, though password login doesn't strictly need a redirect
   URL the way the earlier magic-link flow did).

## RLS policy summary

Every table has the same four policies: a row is only selectable, insertable,
updatable, or deletable when `auth.uid() = user_id`. `user_id` defaults to
`auth.uid()` on insert, so the client never sets it explicitly, and the
`with check` clause stops it from being spoofed to another user's id. Since
sign-up is disabled and only one account exists, in practice this means only
the site owner, signed in, can ever read or write any row.

Images work the same way but as files, not rows: the `diary-images` bucket is
private, and its objects live at `<user_id>/<filename>` — the storage
policies check that the first path segment matches `auth.uid()`. Because the
bucket is private, images are never served by a permanent public URL; the app
requests a short-lived signed URL each time it displays one.

## Adding foods

- **Seed foods** (available to everyone, shipped with the site): edit
  `data/foods.seed.json`, add an entry with the same shape as the existing
  ones (`name`, `kcal`, `protein_g`, `fat_g`, `carbs_g` per 100g), commit and
  push. Seed values are approximate reference figures in the spirit of
  日本食品標準成分表(八訂) cooked values — adjust a food's numbers (or add it
  as a custom food instead) if you want a more precise match for something
  you eat often.
- **Custom foods** (private, per-account): use "Add food" on the daily log
  page. It writes to the `custom_foods` table and is immediately searchable —
  no deploy needed.

## Local development

No build step — just serve the files:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. (ES module imports require `http://`, not
`file://`.)

## Running the calc self-check

Open `test/calc.test.html` in a browser (via the local server above) to see
BMR/TDEE/macro calculations checked against hand-verified examples.

## ponytail-review findings and what changed

A pre-delivery over-engineering pass found and fixed:

- `js/foods.js` had a manual cache + invalidation around `loadFoods()` for a
  function called at most twice per page load against a ~20-row dataset.
  Removed — it now always fetches fresh.
- `js/log.js` kept a module-level `foods` variable that nothing outside
  `refreshFoods()` ever read. Made local.
- `js/dateUtils.js` hand-rolled a 12-entry month-name array for a single call
  site. Replaced with `date.toLocaleDateString('en', {month:'long'})`.
- The chart helper (`js/svgChart.js`) accepted a shared-scale option that no
  caller passed, so the 15 activity×goal small-multiple charts on the profile
  page were each silently scaling to their own max — making bar heights
  visually incomparable across the grid. Rather than deleting the unused
  option, `js/profile.js` now computes one shared max across all 15 combos
  and passes it in, so the grid is actually comparable cell to cell.
