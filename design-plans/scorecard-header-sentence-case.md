# Scorecard header and web keypad in sentence case

- Status: Done
- Commit: `a67b76819288ac5ed9a56dccd4782e0c5fc80134` plus the uncommitted working tree as of 2026-11-19. Re-check the line numbers before editing.

## Problem

Under each team in the Scorecard header, the app shows "(5.2 Over)" and "Wide: 3 | No Ball: 2 | Byes: 1". "Over" and "Ball" are capitalised mid-phrase. During scoring the same extra is labelled "No ball" on the keypad and in every sheet, so one term has two casings in one flow. The web app has the same header, and its Live keypad also says "No Ball" and "Leg Bye" while its own armed strip and sheets say "No ball" and "Leg byes".

## Evidence

Mobile:
- `mobile/src/screens/Scorecard.tsx:152`: `({E.oversText(h.st.legal, h.st.bpo)} Over)`
- `mobile/src/screens/Scorecard.tsx:154`: `Wide: {h.st.extras.wd} | No Ball: {h.st.extras.nb} | Byes: {h.st.extras.b + h.st.extras.lb}`
- Exemplars of the sentence-case form in the same flow: `mobile/src/screens/Live.tsx:444` keypad `{ wd: "Wide", nb: "No ball", b: "Bye", lb: "Leg bye" }`, `Live.tsx:193` armed strip "No ball", `mobile/src/screens/sheets.tsx:265` "No ball", `sheets.tsx:204` "No ball: only a run out".

Web:
- `src/screens/Scorecard.tsx:130`: `` `${h.st.runs}/${h.st.wickets} (${E.oversText(h.st.legal, h.st.bpo)} Over)` ``
- `src/screens/Scorecard.tsx:131`: `Wide: ... | No Ball: ... | Byes: ...`
- `src/screens/Live.tsx:317`: keypad `{ wd: "Wide", nb: "No Ball", b: "Byes", lb: "Leg Bye" }`
- Same-screen contradiction: `src/screens/Live.tsx:161` armed strip `{ wd: "Wide", nb: "No ball", b: "Byes", lb: "Leg byes" }`; `src/sheets.tsx:207` "No ball", "Leg bye".

## Rule enforced

`mobile/DESIGN.md` line 20 ("Sentence case"), line 45 ("Labels stay in English sentence case"). On web, the direct contradiction between the keypad and the armed strip on one screen. Words stay the same (`mobile/DESIGN.md:49`, `mobile/PORTING.md`); only letter case changes. Do not change "Byes" to "Bye" or similar.

## Reuse

No new component. Keep the existing `Num` / `Txt` elements and classes; only the string literals change.

## Changes

1. `mobile/src/screens/Scorecard.tsx`
   - Line 152: `Over)` becomes `over)`.
   - Line 154: `No Ball:` becomes `No ball:`.
2. `src/screens/Scorecard.tsx`
   - Line 130: `Over)` becomes `over)` inside the template string.
   - Line 131: `No Ball:` becomes `No ball:`.
3. `src/screens/Live.tsx`
   - Line 317: `nb: "No Ball"` becomes `nb: "No ball"`, and `lb: "Leg Bye"` becomes `lb: "Leg bye"`. Leave `"Wide"` and `"Byes"` as they are.

Check before editing: if any test or snapshot asserts the old strings, update the assertion to the new casing.

```bash
grep -rn "No Ball\|Leg Bye\| Over)" src mobile/src
```

## Affected surfaces

- Mobile Scorecard screen header (team columns), reached from Live (Scorecard tool), Result ("Full scorecard"), and the locked follower view.
- Web Scorecard header and web Live keypad extras row.
- Mobile Live keypad is already correct and does not change.

## Acceptance checks

- Mobile and web scorecard headers read "(5.2 over)" and "Wide: 3 | No ball: 2 | Byes: 1".
- Web keypad extras read "Wide", "No ball", "Byes", "Leg bye".
- The grep above returns no matches.
- Layout, colour and size of these lines are unchanged.

## Verification

```bash
cd /Users/sahil.chalke/chalkesahil.ai/gully-cricket-scorer && npx tsc --noEmit -p . && npx vitest run
cd mobile && npx tsc --noEmit -p . && npx vitest run
```

Then open a match scorecard on Android and on web and read the header lines; on web, start scoring and read the extras row.

## Out of scope

- Rewording "Toss won by: X, elected to" or unifying "over" with the "ov" abbreviation used elsewhere. That needs a wording decision, not a casing fix.
- Updating `mobile/DESIGN.md`.
