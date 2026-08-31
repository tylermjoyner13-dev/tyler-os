# Tyler OS Mobile V1

Local-first PWA prototype based on the tested Tyler OS web app.

## What is included

- 15-workout / 12-week Tyler OS program
- Calendar-based program progression (missed workouts do not hold the program back)
- Profiles (Tyler and Benjamin included; more can be added)
- Workout logging with partial sessions
- Reactive workout volume: the total is recalculated from the current inputs every time weight/reps change
- Per-exercise volume multipliers (for per-hand/per-side dumbbell/unilateral loading)
- Previous same-workout reference
- Compact superset handling
- Rest timer with Next cue
- Guided warm-up
- Guided phase/slot core
- Weekly Review screen with all workout comments visible together
- Completed / Partial / Skipped / derived Missed status
- JSON backup/restore
- Import of the existing Google Sheets Workout Log CSV
- Offline app shell when installed as a PWA

## Fast desktop test

1. Extract the ZIP.
2. Open `index.html` in Chrome/Edge.
3. Tyler is preset with a program start date of 2026-08-10.
4. Use Settings to set another profile's start date.

Opening the file directly is fine for testing. Installation/offline caching requires HTTPS hosting.

## Move the current web-app history into Mobile V1

From the Google Sheet used by the web app, export the **Workout Log** sheet as CSV. In Mobile V1:

Settings → Import Web Workout Log CSV

The importer expects the current Tyler OS columns such as Date, Workout, Exercise, Set, Weight, Reps, Notes, Profile, Session Status, Warm-Up Status, and Core Status. It groups rows into workout sessions and keeps profiles separate.

## Install on a phone

Host this folder on any HTTPS static host (GitHub Pages, Netlify, Cloudflare Pages, Firebase Hosting, etc.). Then open the site on the phone and use **Add to Home Screen / Install App**.

## Data behavior

Workout interaction is local-first: entering sets, calculating volume, switching screens, warm-up/core, and timers do not call Google Sheets. This is what removes the loading delay from the Apps Script version.

This V1 stores data in the browser/device. Export a JSON backup before clearing site data or switching phones. Cross-device cloud sync is intentionally not part of this first build; it should be added only after this local-first version is validated.

## Volume rule

Each exercise has a `volumeMultiplier` in `program-data.js`.

Example: a 30-lb dumbbell press entered as `30 × 10` with multiplier `2` contributes **600 lb** of training volume. If 30 was a typo and is changed to 35, it becomes **700 lb**—the old 600 is not retained or added.

## Program progression rule

The active week is derived from each profile's Program Start Date. Completion history is separate from the program calendar. A missed Saturday can remain missed while Monday automatically begins the next program week.


## V1.0.1 migration compatibility
The Web Workout Log importer accepts both `Exercise` and the legacy `Excercise` header and preserves pre-program workout history as historical sessions.


## V1.2 migration fixes
- Historical sessions are matched to program weeks by actual logged workout, not scheduled weekday.
- Re-importing the Web Workout Log CSV replaces the exact Profile + Date + Workout session, preventing duplicates and removing same-day mobile test copies when the CSV contains the real workout.


## V1.3 workout experience
- Rest starts automatically when a set's reps are committed; supersets rest only after the second movement in the pair.
- Final sets/rounds show the next movement instead of starting an unnecessary rest.
- Active rest timer includes Pause/Resume, Reset, and Skip controls.
- Coaching notes are surfaced on each exercise card.
- Set-by-set progression suggestions use the comparable set from the prior completed workout.
- A successful set is recognized when reps improve at the same weight, or weight increases while at least the programmed minimum reps are achieved.
- Hitting the top of the rep range earns the next programmed load increase when an increment is assigned.

## V1.4 bodyweight + alternating-week + protected-repeat update
- Pull-ups and dips that use bodyweight loading now ask for current body weight on each new applicable workout.
- Enter `0` for bodyweight, a negative value for assistance (for example `-60`), or a positive value for added weight. Volume uses effective load: body weight + entered adjustment.
- A ± control is included on bodyweight set rows so negative assistance is practical on iPhone numeric entry.
- Phase 1 Slot 1 now resolves the final movement as Cable Fly in Phase Weeks 1/3 and Straight-Arm Pulldown in Phase Weeks 2/4. Previous-set progression compares each variant only with itself.
- Completed workouts are protected read-only records. Re-entering one creates a separate editable session and never overwrites the completed sets.
