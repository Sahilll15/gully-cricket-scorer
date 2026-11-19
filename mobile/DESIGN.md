# Design: Floodlights

A gully match under street lights, with the scoreboard in your pocket. Our own design; Dribbble shots were only a reference for restraint and hierarchy. The approved mockup is `design/floodlights.html` (open it in a browser): match it.

## Principles

- **Calm until it matters.** Charcoal surfaces, hairline borders, small sentence-case text. Orange appears only for live state, the current batter, boundaries, rank 1 and the one primary action on a screen.
- **The score is the hero.** The live score is the only big thing, in the dot-matrix `Board` face. Everything else is quiet.
- **One thumb.** During play everything you tap is in the bottom half: extras row, 4x2 keypad, undo as a key.
- **Never shout.** No ALL CAPS, no emoji as icons, no gradients except the street lamp and the faint orange wash on score cards, no glow except on the live score and live dot.
- **One peak.** A six fills the screen in orange (the six moment). A wicket gets a short red flash. Fours get an orange pop on the score only.

## Tokens (`src/ui/ui.tsx`)

`C.cream` page `#050507`, `C.panel` card `#0d0d12`, `C.key` `#17171f`, `C.raised` `#1f1f29`, `C.line` `#24242d`, `C.fg` `#ffffff`, `C.teal` secondary text `#f1ece4`, `C.mute` labels `#9a9aa5`, `C.sun` orange accent `#ff8a3d`, `C.sunSoft` orange-tinted surface `#2a1a0f`, `C.out` `#ff4d4d`, `C.ink` text on orange `#111111`.
The twrnc names are the same (`bg-sun` is orange, `text-teal` is warm off-white).

## Type

- `Txt`: Poppins. Body 15, labels 12 to 13 medium, titles 20 to 26 semibold. Sentence case.
- `Num`: bold Poppins for every number (runs, overs, figures, codes, dates as digits). `Display` is an alias of `Num`.
- `Board`: Doto dot-matrix, orange, glowing. Only the main live or final score (40 to 60pt).

## Components

`Beams` (one street lamp behind each `Page`), `ScoreHero` (score card), `ChaseRing` (runs still needed), `RunWorm` (runs per over bars), `Card`, `SectionTitle` (small sentence-case label), `Pill`, `PrimaryButton` (orange, one per screen), `GhostButton` (outlined), `IconButton` (round, outlined), `Badge` (initials), `BallChip` (dot ball and runs on `key`, 4 off-white outline, 6 orange fill, wicket ringed in red chalk, wide and no-ball dashed), `LivePill` (orange dot plus "Live"), `BottomNav`, `Sheet`, `Toggle`, `Segmented`, `Stepper`. Icons: `lucide-react-native`, size 18 to 22, strokeWidth 2.

## Screens (see the mockup)

- **Home:** greeting line plus avatar stack; live card (`LivePill`, team, `Board` score, overs and CRR in `Num`, `RunWorm`); a orange "New match" tile next to a "Watch live" tile; leaders list with rank in `Num`.
- **Live:** top row back, "X chasing N" or "X batting", mic as a orange round button. Score block: `ChaseRing` with runs needed when chasing, `Board` score, overs and rates in `Num`. Batters in one card (current batter has a orange dot). "This over" track: six slots, filled with `BallChip`s, the next slot outlined in orange, extras added inline. Bottom sheet area: extras pills, 4x2 keys 62 to 72pt tall (0 1 2 3 / 4 6 Out Undo); 4 key orange text, 6 key orange fill, Out red tint.
- **Six moment:** full-screen orange, dotted arc, `Board`-style "SIX" in ink, who hit it and their score, "Undo if it was caught". 1.2 s then fades.
- **Result:** trophy circle, "<Team> win" title, margin line, both scores (winner in `Board`), player of the match card on orange-tinted surface, best bowling and sixes tiles, "Send to group" orange button with WhatsApp icon plus a rematch icon button.
- Every other screen: same parts. Lists are hairline rows, not boxes. Tables use `Num`.

## Gully touches (`src/ui/gully.tsx`)

A street-lit gully at night, not a stadium. Each touch stays faint and never adds a colour beyond orange and the wicket red.

- **Street lamp.** `Beams` renders `StreetLamp`, a single warm-white cone from the top right with a faint sodium tint near the bulb. Peak opacity is about 12 percent.
- **Brick wall.** `ScoreHero wall` lays `BrickWall` behind the card, mortar lines at about 4 percent that fade toward the bottom. Use it on the Home live card and the Result score card only.
- **Chalk.** `BallChip` rings a wicket in rough red chalk (`ChalkRing`) on a dark red tint, in the over track and the ball-by-ball scorecard. `ChalkStumps` (three stumps, bails and a crease) sits above empty-state text on History, the leaderboard and an empty ball-by-ball card.
- **Tape ball.** `TapeBall` is the app's ball icon: a tennis ball with a band of insulation tape. Use `ink` on orange (the Home "Start new match" tile) and `mute` in empty states (Home with no matches). Keep it off `LivePill`.
- **Crease.** `Crease` is a thin chalk-white dashed divider. It sits under the Live score block and above the bowling table on the scorecard.
- Labels stay in English sentence case. No Hindi slang in the UI, no new icons on the keypad.

## Rules for screen work

Behaviour, labels, order and conditions don't change (see `PORTING.md`). This is visual. Ads: `AdBanner` from `src/ui/AdBanner.tsx` goes exactly where the web app shows `AdBox` (Home, History, Stats, Result), never on Live.
