# Design: Floodlights

A gully match under street lights, with the scoreboard in your pocket. Our own design; Dribbble shots were only a reference for restraint and hierarchy. The approved mockup is `design/floodlights.html` (open it in a browser): match it.

## Principles

- **Calm until it matters.** Charcoal surfaces, hairline borders, small sentence-case text. Lime appears only for live state, the current batter, boundaries and the one primary action on a screen.
- **The score is the hero.** The live score is the only big thing, in the dot-matrix `Board` face. Everything else is quiet.
- **One thumb.** During play everything you tap is in the bottom half: extras row, 4x2 keypad, undo as a key.
- **Never shout.** No ALL CAPS, no emoji as icons, no gradients except the street lamp and the faint lime wash on score cards, no glow except on the live score and live dot.
- **One peak.** A six fills the screen in lime (the six moment). A wicket gets a short red flash. Fours get a lime pop on the score only.

## Tokens (`src/ui/ui.tsx`)

`C.cream` page `#0b0d0c`, `C.panel` card `#141716`, `C.key` `#1c201e`, `C.raised`/`C.line` `#232825`, `C.fg` `#eef1ec`, `C.teal` secondary text `#aab2ac`, `C.mute` labels `#7e8680`, `C.sun` lime accent `#d6ff63`, `C.sunSoft` lime-tinted surface `#1c2416`, `C.out` `#ff6b57`, `C.ink` text on lime `#0b0d0c`.
The twrnc names are unchanged (`bg-sun` is lime, `text-teal` is secondary grey).

## Type

- `Txt`: Inter. Body 15, labels 12 to 13 medium, titles 20 to 26 semibold. Sentence case.
- `Num`: JetBrains Mono for every number (runs, overs, figures, codes, dates as digits). `Display` is an alias of `Num`.
- `Board`: Doto dot-matrix, lime, glowing. Only the main live or final score (40 to 60pt).

## Components

`Beams` (one street lamp behind each `Page`), `ScoreHero` (score card), `ChaseRing` (runs still needed), `RunWorm` (runs per over bars), `Card`, `SectionTitle` (small sentence-case label), `Pill`, `PrimaryButton` (lime, one per screen), `GhostButton` (outlined), `IconButton` (round, outlined), `Badge` (initials), `BallChip` (dot ball and runs on `key`, 4 lime outline, 6 lime fill, wicket ringed in red chalk, wide and no-ball dashed), `LivePill` (lime dot plus "Live"), `BottomNav`, `Sheet`, `Toggle`, `Segmented`, `Stepper`. Icons: `lucide-react-native`, size 18 to 22, strokeWidth 2.

## Screens (see the mockup)

- **Home:** greeting line plus avatar stack; live card (`LivePill`, team, `Board` score, overs and CRR in `Num`, `RunWorm`); a lime "New match" tile next to a "Watch live" tile; leaders list with rank in `Num`.
- **Live:** top row back, "X chasing N" or "X batting", mic as a lime round button. Score block: `ChaseRing` with runs needed when chasing, `Board` score, overs and rates in `Num`. Batters in one card (current batter has a lime dot). "This over" track: six slots, filled with `BallChip`s, the next slot outlined in lime, extras added inline. Bottom sheet area: extras pills, 4x2 keys 62 to 72pt tall (0 1 2 3 / 4 6 Out Undo); 4 key lime text, 6 key lime fill, Out red tint.
- **Six moment:** full-screen lime, dotted arc, `Board`-style "SIX" in ink, who hit it and their score, "Undo if it was caught". 1.2 s then fades.
- **Result:** trophy circle, "<Team> win" title, margin line, both scores (winner in `Board`), player of the match card on lime-tinted surface, best bowling and sixes tiles, "Send to group" lime button with WhatsApp icon plus a rematch icon button.
- Every other screen: same parts. Lists are hairline rows, not boxes. Tables use `Num`.

## Gully touches (`src/ui/gully.tsx`)

A street-lit gully at night, not a stadium. Each touch stays faint and never adds a colour beyond lime and the wicket red.

- **Street lamp.** `Beams` renders `StreetLamp`, a single warm-white cone from the top right with a faint sodium tint near the bulb. Peak opacity is about 12 percent.
- **Brick wall.** `ScoreHero wall` lays `BrickWall` behind the card, mortar lines at about 4 percent that fade toward the bottom. Use it on the Home live card and the Result score card only.
- **Chalk.** `BallChip` rings a wicket in rough red chalk (`ChalkRing`) on a dark red tint, in the over track and the ball-by-ball scorecard. `ChalkStumps` (three stumps, bails and a crease) sits above empty-state text on History, the leaderboard and an empty ball-by-ball card.
- **Tape ball.** `TapeBall` is the app's ball icon: a tennis ball with a band of insulation tape. Use `ink` on lime (the Home "Start new match" tile) and `mute` in empty states (Home with no matches). Keep it off `LivePill`.
- **Crease.** `Crease` is a thin chalk-white dashed divider. It sits under the Live score block and above the bowling table on the scorecard.
- Labels stay in English sentence case. No Hindi slang in the UI, no new icons on the keypad.

## Rules for screen work

Behaviour, labels, order and conditions don't change (see `PORTING.md`). This is visual. Ads: `AdBanner` from `src/ui/AdBanner.tsx` goes exactly where the web app shows `AdBox` (Home, History, Stats, Result), never on Live.
