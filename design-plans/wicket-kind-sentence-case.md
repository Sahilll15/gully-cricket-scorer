# Wicket kind pills in sentence case

- Status: Done
- Commit: `a67b76819288ac5ed9a56dccd4782e0c5fc80134` plus the uncommitted working tree as of 2026-11-19. Re-check the line numbers below before editing; other agents have uncommitted changes in these files.

## Problem

When the scorer taps Out, the "How out?" sheet lists dismissal kinds as pills. Every word is capitalised: "Run Out", "Hit Wicket", "One-tip Catch", "Wall Out", "Hit Out", "Didn't Run", "Dot Balls", "Hit Legs". The same sheet's other copy is sentence case: the field label "Run out by (optional)", "Caught by", "Stumped by", and the sheet title "No ball: only a run out".

## Evidence

Mobile (`mobile/src/screens/sheets.tsx`):
- Line 30: `const capitalize = (s: string) => s.replace(/(^|\s)\w/g, (c) => c.toUpperCase());` capitalises every word.
- Line 210: `{kinds.map((k) => <Pill key={k} active={kind === k} onPress={() => setKind(k)}>{capitalize(k)}</Pill>)}`
- Line 199: `byLabel` is "Caught by" / "Stumped by" / "Run out by" (sentence case).
- Line 204: sheet title "Free hit: only a run out" / "No ball: only a run out" (sentence case).
- `capitalize` has no other caller in the file.

Kinds come from `wicketKinds()` in `src/engine/engine.ts:107-121`, all lowercase strings (type at `src/engine/types.ts:3-5`).

Web (`src/sheets.tsx`), same contradiction:
- Line 152: `<span className="capitalize">{k}</span>`. CSS `text-transform: capitalize` title-cases every word.
- Line 141: `byLabel` sentence case; line 146: sentence-case title.

## Rule enforced

`mobile/DESIGN.md` line 20: "`Txt`: Poppins ... Sentence case." Line 7: "small sentence-case text". Line 45: "Labels stay in English sentence case." On web, the rule is the direct contradiction inside one sheet. Words do not change (`mobile/DESIGN.md:49`, `mobile/PORTING.md`), only letter case.

## Reuse

The existing first-letter helper, already used in both apps:
- `mobile/src/screens/nextGameUi.tsx:48`: `const cap = (s: string) => s[0].toUpperCase() + s.slice(1);`
- `src/nextGameUi.tsx:15`: same.

No new primitive. `Pill` (`mobile/src/ui/ui.tsx:293-300`, web `src/ui.tsx:90-96`) stays as is.

## Changes

1. `mobile/src/screens/sheets.tsx`
   - Line 30: replace the `capitalize` definition with the sentence-case helper:
     `const cap = (s: string) => s[0].toUpperCase() + s.slice(1);`
   - Line 210: change `{capitalize(k)}` to `{cap(k)}`.
   - Grep the file for `capitalize` afterwards; there must be no remaining reference.
2. `src/sheets.tsx`
   - Add near the top-level helpers: `const cap = (s: string) => s[0].toUpperCase() + s.slice(1);`
   - Line 152: replace `<span className="capitalize">{k}</span>` with `{cap(k)}`.

Do not touch `wicketKinds`, the WicketKind strings, `howOut`, or any stored data. The pill labels are display only.

## Affected surfaces

- Mobile Live screen, "How out?" sheet (`WicketSheet`), opened from the Out key (`Live.tsx:457`), from voice "out" (`Live.tsx:159`) and from the did-you-run sheet (`Live.tsx:493`).
- Web Live screen, same sheet.
- No other screen renders these pills.

## Acceptance checks

- On the How out sheet the pills read "Bowled", "Caught", "Run out", "Stumped", "Lbw", "Hit wicket", and when the rules enable them "One-tip catch", "Wall out", "Hit out", "Didn't run", "Dot balls", "Misses", "Hit legs".
- "Lbw" is unchanged from today (it was already "Lbw").
- Selecting a pill still records the same kind; the "Run out by" / "Caught by" fields still appear for the same kinds.
- No other text in the sheet changes.

## Verification

```bash
cd /Users/sahil.chalke/chalkesahil.ai/gully-cricket-scorer && npx tsc --noEmit -p . && npx vitest run
cd mobile && npx tsc --noEmit -p . && npx vitest run
grep -n "capitalize" mobile/src/screens/sheets.tsx src/sheets.tsx   # expect no output
```

Then open a match on Android, tap Out, and check the pill labels. On web, run the dev server and do the same.

## Out of scope

- The engine's `howOut` strings shown in the scorecard (already lowercase).
- Any change to `Pill` styling or layout.
- Updating `mobile/DESIGN.md`.
