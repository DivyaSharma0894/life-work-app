# Life & Work

Your own app for the work task board and (soon) the daily diary and dashboards. It runs on your computer and saves everything in a folder called **Life & Work App** in your Google Drive. No other server sees your data.

## What works now (Phases 1 to 5)

- Google sign-in and your own Drive folder, with plain JSON files you can open without the app
- Work board: cards by status, drag a card to change its status, urgency colours from the due date
- Pending vs done pie, open tasks by urgency, "Needs attention" list
- Task editor: priority, type, project, dates, story points, link, notes, checklist, sub-tasks, delete (asks first)
- Table view with sorting, calendar view by due date, filters and search
- Settings: task types, goals, backup download, sign out and revoke access
- Demo mode to try everything without Google
- Edits from the app and from Claude are merged by task, so neither silently overwrites the other

- Diary: one record per day with the 8 questions (water, steps, mood, pages, watched something, did an activity, calories, money), plus book title, what you watched, which activity you did (asked when you answer Yes), a mood line and your diary text. Open any past day to catch up or fix it, or delete it (asks first). Unsaved text is kept if the tab refreshes.
- Stories: dated one or two line highlights in Productivity, Mental Health, Office Life and Entertainment, oldest first, with search. Add, edit or delete by hand, also from a day in the Diary.
- App lock: an optional PIN (Settings) for Diary and Stories. It locks again after inactivity. It is a privacy screen on this device, not encryption.

- Claude diary (Phase 4): connect Google Drive to Claude with the SAME Google account, paste one line into the "Instructions for Claude" box in Claude (Settings, then Account; this app's Settings shows the line, with a copy button), then say "diary time" in any new chat. Claude reads the README in your Drive folder, asks only the questions still unanswered, and leaves a small note in the folder's `inbox`. The app checks the notes whenever you open it or come back to it, saves them into your day, highlights and tasks, and deletes the note. Bad notes are rejected and shown to you, never half-saved. Month summaries written by Claude show on the Diary page.
- Why an inbox: Claude's Drive connector can read files and create new ones, but cannot edit an existing file, so it never touches your real files directly.

- Today: mood with a five-step meter and Claude's one-line read, water, steps, pages and spending against your goals, what you watched, your activity, calories eaten against your goal, tasks that need attention, and the highlights added that day. Step back through earlier days with the arrows.
- Month: the rolling summary Claude wrote, six headline numbers, mood day by day with a mood mix and best and hardest days, bar charts for money, steps, water, calories and pages with your goal lines, tasks finished this month, highlights by category, a month-by-month comparison table. Browse any earlier month with the arrows.
- Everything on these two pages is calculated each time from your daily records. Nothing is stored twice, so it can never disagree with your diary. Days you did not answer are left out of averages, not counted as zero.
- Calorie calculator: Settings has a calculator. Enter sex, age, weight (kg), height (cm), how active you are and whether you want to lose, keep or gain weight (and how fast, up to 1 kg a week). It shows your BMI, the calories you burn in a day, and a daily target, using the Mifflin-St Jeor formula. One button sets it as your daily calorie goal. It never suggests going below 1,200 kcal (women) or 1,500 kcal (men) a day. It is a general estimate, not medical advice.
- Spending allowance: in Settings set a daily allowance (for example 600). Each day you may spend that amount plus whatever earlier days left unspent, so spend 300 on day 1 and you have 900 on day 2. Overspending is taken from the following days (the balance goes negative and shows red). A day with no money answer counts as nothing spent and is flagged "not logged". Every month starts fresh, with a budget of the daily amount times the days in the month. Month shows the allowance chart, balance line and day-by-day table; Today shows what is available and what carries over. Leave it at 0 to keep the plain bar chart.

- Today, Month, Diary and Stories are all behind the PIN lock if you turn it on. The work board stays open.

## Sharing this app with a friend

Send her the zip. Everything personal stays out of it: your data lives in your Google Drive, and your sign-in is kept in your own browser, never in these files. Each person who runs the app gets her own private copy of the data in her own Google Drive, and uses her own Claude.

She needs: a Windows or Mac computer, [Node.js](https://nodejs.org), and a Google account.

1. Unzip, then double-click `start.bat` (Windows) or run `./start.sh` (Mac/Linux).
2. Open Settings once she is in: set her name, time zone and currency symbol.
3. For Google Drive she picks ONE of:
   - **Her own Client ID (recommended, private):** follow the on-screen "Set up Google Drive" guide (about 5 minutes).
   - **Your Client ID (faster):** put your Client ID in `config.json` (`{ "clientId": "..." }`) before sending the zip, and add her Gmail under Test users on your Google OAuth consent screen. She still signs in with her own account, and her data goes only to her own Drive. You cannot see it. Google limits an unverified app to 100 test users.
4. She can try "Demo mode" first if she just wants to look around.

## Run it

1. Install Node.js (version 18 or newer) from https://nodejs.org if you do not have it.
2. Windows: double-click `start.bat`. Mac or Linux: run `./start.sh`.
   Or in a terminal inside this folder: `node serve.mjs`
3. Open http://localhost:5173 (the start scripts open it for you). Keep the window open while you use the app.

Use **Try demo mode** first if you want to look around. To use Google Drive, follow the on-screen setup (about 5 minutes, once). In short: create a Google Cloud project, enable the Google Drive API, create a Web OAuth client ID with `http://localhost:5173` as an authorised JavaScript origin, add your own account as a test user, and paste the Client ID into the app.

## Using Claude with the same data

Connect Google Drive in Claude. Then say, for example:

> Read README.md in my "Life & Work App" Drive folder, then add a task "Review pipeline PR", high priority, due Friday.

The README in that folder explains the file format, so Claude can find its way in every new chat. The app picks up Claude's changes when you return to the window or press "Reload" in Settings.

## Files

- `index.html`, `styles.css`, `src/` the app (no build step)
- `src/logic.js` urgency, filters, merging, daily records
- `src/stats.js`, `src/today.js`, `src/month.js`, `src/daysCache.js` the Today and Month dashboards
- `src/inbox.js` checks and applies Claude's notes
- `src/diary.js`, `src/stories.js`, `src/highlights.js`, `src/lock.js`, `src/lockui.js` Phase 3 screens
- `src/drive.js`, `src/auth.js`, `src/storage.js` Google sign-in and Drive storage
- `vendor/` the small Preact library, included so the app works offline from your disk
- `test/` automated checks: `node --test test/logic.test.mjs test/drive.test.mjs test/lock.test.mjs test/inbox.test.mjs test/stats.test.mjs`
- `serve.mjs` the tiny local server

## Privacy

- The app can see your whole Google Drive (Google has no smaller permission that lets Claude and the app share a folder) but it only reads and writes inside its own folder.
- Your sign-in token stays in the browser tab and is gone when you close it. "Sign out and revoke access" in Settings removes the app's access.

- Daily records are saved as `days/YYYY-MM-DD.json` and highlights in `highlights.json` inside the Drive folder. Your diary text is stored as plain text there (protected by your Google account), so the PIN only guards the screen.
