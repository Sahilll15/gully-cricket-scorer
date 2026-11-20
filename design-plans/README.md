# Improve UI audit: Android scoring flow

Commit audited: `a67b76819288ac5ed9a56dccd4782e0c5fc80134` plus the uncommitted working tree as of 2026-11-19 (treated as the source of truth).

## Design language

- Audited surface: the Android app (`mobile/src`) flow of scoring a match. Home (`screens/Home.tsx`), Live scoring (`screens/Live.tsx`, `screens/liveSheets.tsx`, `screens/sheets.tsx`), Result (`screens/Result.tsx`), Scorecard (`screens/Scorecard.tsx`), and the shared primitives in `ui/ui.tsx` they render (`Txt`, `Num`, `Board`, `Pill`, `LivePill`, `Sheet`, `PrimaryButton`, `GhostButton`, `Card`, `Header`, `BallChip`).
- Design sources:
  - `mobile/DESIGN.md` ("Floodlights"). Partly current. The Principles, Tokens, Components list and Result/Home screen notes were revised on 2026-11-19 (commit 325e96b) and match `ui/ui.tsx` token for token, so those parts govern. The Type and Gully touches parts are stale: `Board` is now bold white Poppins (`ui.tsx:60-63`), not orange Doto, and `Beams` renders nothing (`ui.tsx:65-69`), both changed deliberately by commit 6050897 ("web-matching look"). Those stale lines were not used as contracts.
  - `mobile/PORTING.md`. Governs: the web app in `src` is the source of truth for words, order and behaviour.
  - `mobile/AGENTS.md`. Engineering only, no design decisions.
- Documented decisions used:
  - Sentence case for all text, and "No ALL CAPS" (`mobile/DESIGN.md:7`, `:10`, `:20`, `:45`).
  - `LivePill` is an orange dot plus "Live" (`mobile/DESIGN.md:26`), implemented at `ui.tsx:217-221`.
  - "Behaviour, labels, order and conditions don't change ... This is visual" (`mobile/DESIGN.md:49`). Casing fixes below keep every word and change only letter case.
- Governing owners and consumers: tokens `C` and `tw` (`ui.tsx:19-33`) consumed by every screen; `Pill` (`ui.tsx:293-300`) consumed by `WicketSheet`; `LivePill` consumed by `MatchCard` on Home and the Scorecard header.
- Explicit exceptions: the six moment's "SIX" (`mobile/DESIGN.md:32`, rendered at `Live.tsx:853`). None other documented.

## Findings

| # | Problem | Evidence | Proposed change | Scope | Confidence |
|---|---|---|---|---|---|
| 1 | Wicket kind pills are Title Case ("Run Out", "Hit Wicket", "Didn't Run") while the same sheet says "Run out by", "Caught by", "No ball: only a run out" | `mobile/src/screens/sheets.tsx:30`, `:210` vs `:199`, `:204`; web `src/sheets.tsx:152` vs `:141`, `:146` | Capitalise only the first letter of each kind, reusing the `cap` helper pattern from `nextGameUi.tsx` | Live, WicketSheet (mobile and web) | High |
| 2 | Scorecard header shows "No Ball" and "(5.2 Over)" in Title Case while the Live keypad and sheets say "No ball" | `mobile/src/screens/Scorecard.tsx:152`, `:154` vs `Live.tsx:444`, `sheets.tsx:265`; web `src/screens/Scorecard.tsx:130-131`, web keypad `src/screens/Live.tsx:317` vs `:161` | Lowercase "Ball" and "Over" (and "Bye" in the web keypad) | Scorecard header (mobile and web), web Live keypad | High |
| 3 | Home match card shows "RESULT" in capitals in the same slot where a live match shows the sentence-case "Live" pill | `mobile/src/screens/Home.tsx:43` vs `ui.tsx:217-221` | Render "Result" | `MatchCard` on Home, History and Series (mobile only; web `LivePill` is also capitals, so no contradiction there) | High |

Considered and dropped: the "Not me" dismiss on Home uses a "✕" text glyph (`Home.tsx:162`) while sheets use lucide `X`. Fourth by reach, and the web uses the same glyph in its own `Sheet`, so it fell below the cut of three. Off-token hex values (`HAIR`, `#0d0d12`, `#24242d`) equal existing tokens and change nothing visible.

## Improve first

Finding 1. The wicket sheet opens on every dismissal during live scoring, the app's primary task, and its Title Case pills sit directly beside sentence-case copy on the same sheet.

## Plans

- `design-plans/wicket-kind-sentence-case.md`
- `design-plans/scorecard-header-sentence-case.md`
- `design-plans/home-result-label-case.md`
