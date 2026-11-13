# Open-world Step 1 — World foundation

## Audit

The current world is a 20 × 20 open intersection grid. All 400 intersections belong to exactly one of the seven districts; there are no district gaps, overlaps or duplicate landmark coordinates. All 22 landmarks are reachable from the configured starting position at the safehouse (2, 7). There are no blocked-road tiles in the current data model, so no invented road closures or map layout changes were needed.

## Changes

- Fresh city entry now uses `city.start`, rather than the uninitialised (0, 0) default.
- Old save coordinates and marker coordinates must be integer positions inside the map. Invalid positions fall back to the configured start; invalid markers are cleared. Valid saved positions remain unchanged.
- City data is validated before use: grid dimensions, street/avenue names, spawn, district coverage, district IDs, landmark IDs and landmark placement. Invalid editor overrides fall back to the shipped city map. A failed map load leaves the menu available and announces the problem instead of opening a broken city.
- Bonnie still travels up to three blocks, but stops at the first landmark, destination marker or district transition. This prevents skipped destinations and skipped intermediate districts.
- Boundary narration now says the player is *at* the map edge rather than one block away.
- Entry clears stale landmark narration state and starts a breadcrumb trail at the restored position.
- The city build label now reads v5.4. Entry help explains Bonnie's stopping rules.

No new quests, locations, blocked roads or districts were added. General navigation expansion remains Step 2; complete world-state persistence remains Step 4.

## Verification

Run `node tests/city-foundation.test.cjs` from the repository root. No dependencies are needed.

Result: **5,525 assertions passed**, including all 1,600 directional walking cases, all 1,600 directional riding cases, 150 directed district crossings, complete graph reachability, corrupted-save recovery, map validation and invalid-override fallback. The harness runs the actual city module with stubbed DOM/audio services; it does not validate real browser speech, WebGL rendering or the subjective audio experience.

All source JavaScript files passed Node syntax checks. The standalone HTML's embedded city module was synchronised with `src/city.js`.

## Hands-on review

Use a fresh browser profile to check that free roam starts at the safehouse without deleting an existing player's save. Try walking beyond each map edge. Ride Bonnie toward a landmark, a district boundary and a nearby marker; each should stop the ride at the first relevant intersection. Leave and re-enter the city, then check Backspace returns along the new trail. Browser/audio and blind-player review are still required; the automated results above do not replace them.
