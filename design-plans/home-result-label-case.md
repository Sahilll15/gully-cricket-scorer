# Home match card: "Result" in sentence case

- Status: Done
- Commit: `a67b76819288ac5ed9a56dccd4782e0c5fc80134` plus the uncommitted working tree as of 2026-11-19. Re-check the line number before editing.

## Problem

Each match card on Home has a status tag at the top right. A live match shows the `LivePill`: an orange dot and "Live" in sentence case. A finished match shows "RESULT" in capitals in the same slot. The two states of one tag use different casing, and capitals are banned by the design doc.

## Evidence

- `mobile/src/screens/Home.tsx:43`: `{live ? <LivePill /> : <Txt style={tw`text-[11px] font-semibold text-mute`}>RESULT</Txt>}`
- `mobile/src/ui/ui.tsx:217-221`: `LivePill` renders `<Txt ... style={tw`text-[12px] font-medium text-sun`}>Live</Txt>`.
- `MatchCard` is rendered on Home for "Live now" (`Home.tsx:78`, via `LiveRow`) and "Recent matches" (`Home.tsx:130`), and is imported by History (`mobile/src/screens/Lists.tsx:49`) and Series (`mobile/src/screens/Series.tsx:168`). Those inherit the fix.

Web is not affected: the web `LivePill` is itself "LIVE" in capitals (`src/ui.tsx:24-28`) and web `Home.tsx:38` "RESULT" matches it. Leave the web unchanged.

## Rule enforced

`mobile/DESIGN.md` line 10: "Never shout. No ALL CAPS". Line 7 and line 20: sentence case. `LivePill` (`mobile/DESIGN.md:26`, "orange dot plus Live") is the exemplar for this slot. The word stays "Result"; only the casing changes (`mobile/DESIGN.md:49`).

## Reuse

Keep the existing `Txt` and its classes. Only the string literal changes.

## Changes

1. `mobile/src/screens/Home.tsx`
   - Line 43: replace `RESULT` with `Result`. Keep `tw`text-[11px] font-semibold text-mute`` as is.

## Affected surfaces

- Mobile Home, "Recent matches" cards (finished matches).
- Mobile History (`Lists.tsx`) and Series (`Series.tsx`) match lists, which render the same `MatchCard`.
- "Live now" cards are unchanged (they show `LivePill`).

## Acceptance checks

- A finished match card shows "Result" at the top right, muted grey, same size and position as before.
- A live match card still shows the orange dot and "Live".
- `grep -n "RESULT" mobile/src/screens/Home.tsx` returns nothing.

## Verification

```bash
cd /Users/sahil.chalke/chalkesahil.ai/gully-cricket-scorer/mobile && npx tsc --noEmit -p . && npx vitest run
cd .. && npx tsc --noEmit -p . && npx vitest run
```

Then open Home on Android with at least one finished match and one live match.

## Out of scope

- Restyling the tag to match `LivePill` size or weight.
- The web Home card and web `LivePill`.
- Updating `mobile/DESIGN.md`.
