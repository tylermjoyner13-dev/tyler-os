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
