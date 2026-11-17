# Gully Cricket Scorer: manual test cases

Platforms: **Both** = run on web and on the Android app. **Web** = web only. **App** = Android app only. Where a screen is still changing, the expected result is the intended behaviour from the engine and README.

## Test data to prepare

Before starting, save two teams under Teams: **Mumbai Mavericks** (Aarav, Bunty, Chintu, Dev, Eshan, Farhan) and **Pune Pirates** (Gopal, Hari, Imran, Jatin, Kabir, Laxman). Keep a seventh name, **Monu**, as the common player for odd-number games. Also create one player with a very long name (Venkatasubramaniam Raghunathan-Iyer), one with a Hindi name, and a two-player team pair (Raj, Sim) for double wicket and solo. Play and finish about six matches across a few days, mixing limited overs, one Test and one solo, so Book, records, streaks, profiles and tournaments have data. Have a second phone or browser for live sharing, a UPI id such as `sahil@okhdfc`, a Supabase project configured for live and cloud backup (and one build with it unset), an Android 13 or newer device with notifications allowed, and a 360pt-wide phone or emulator for layout checks. Reset app data between big areas when a case says "fresh install".

Shorthand: "score" means tap the run buttons on the Live screen. "Sheet" means any bottom sheet or dialog.

---

## 1. Navigation and Back (NAV)

| ID | Title | Steps | Expected | Plat |
|---|---|---|---|---|
| NAV-01 | Bottom tabs switch | 1. Open Home. 2. Tap Cups, Teams, Stats, History in turn. 3. Tap Home. | Each tab opens with the active tab highlighted. | Both |
| NAV-02 | Back from a tab goes Home then exits | 1. Open Home. 2. Tap Stats. 3. Press Android Back. 4. Press Back again. | First Back lands on Home, second leaves the app (or goes to the previous browser page on web). | App |
| NAV-03 | Tab to tab does not stack | 1. Home, Cups, Teams, Stats, History. 2. Press Back once. | Lands on Home, not on Teams. | App |
| NAV-04 | Back from Setup | 1. Tap Start new match. 2. Press Back. | Returns to Home, no half-created match saved. | Both |
| NAV-05 | Setup is replaced by Live | 1. Fill Setup, toss, start. 2. On Live press Back. | Back never returns to the stale Setup form. Goes to Home. | App |
| NAV-06 | Back closes a sheet first | 1. On Live open Change overs. 2. Press Back. | Sheet closes, still on Live. A second Back leaves Live. | App |
| NAV-07 | Back from every sheet | 1. On Live open in turn: More, Retire, Correct this ball, New batter, Change bowler, Share live, Move scoring. 2. Press Back on each. | Each sheet dismisses without losing typed state elsewhere or ending the innings. | App |
| NAV-08 | Back on a confirm sheet | 1. Open Stop the match. 2. Press Back. | Confirm closes, match unchanged. | App |
| NAV-09 | Back from Scorecard, Result, Player | 1. Open each from Live, Result and Teams. 2. Press Back. | Returns to the screen it was opened from. | App |
| NAV-10 | Live to Result replaces | 1. Finish a match. 2. On Result press Back. | Goes Home, not back into a finished Live screen. | App |
| NAV-11 | Relaunch resumes mid-match | 1. Score 2 overs. 2. Close the app fully (swipe away) or close the tab. 3. Reopen. | Home offers the live match or opens it. Score, striker, bowler and balls identical. | Both |
| NAV-12 | Resume after process death | 1. Score a few balls. 2. Put the app in background, kill it from Recents. 3. Reopen and tap the match. | Same score; undo still steps back through the earlier balls. | App |
| NAV-13 | Deep link opens Watch | 1. Open a `?watch=CODE` link on the phone. | Watch screen opens for that code; Back leaves to Home. | Both |

---

## 2. Team match setup and scoring (SCORE)

| ID | Title | Steps | Expected | Plat |
|---|---|---|---|---|
| SCORE-01 | Setup with saved teams | 1. Start new match. 2. Pick Mumbai Mavericks and Pune Pirates from saved teams. 3. Set 5 overs. | Teams fill with all six players each; Start is enabled. | Both |
| SCORE-02 | Toss and choice | 1. Tap Flip the coin. 2. Choose Bat first or Bowl first. | Coin shows a winner; the batting side matches the choice. | Both |
| SCORE-03 | Need two players per side | 1. Leave Team B with 1 player. 2. Try to start. | Blocked with a "Need two players" message. | Both |
| SCORE-04 | Every run value | 1. Tap 0, 1, 2, 3, 4, 6 on six separate balls. | Score adds 0,1,2,3,4,6 = 16. Strike changes after 1 and 3 only. Ball chips show each value. | Both |
| SCORE-05 | Five runs | 1. Use the More or 5 option on a ball. | 5 added, strike changes (odd). | Both |
| SCORE-06 | Wide | 1. Tap Wide with default rules. | 1 run added, ball not counted, over not advanced. | Both |
| SCORE-07 | Wide with extra run off | 1. Turn Wide and no-ball give 1 run off in Setup. 2. Bowl a wide. | No run added, ball still re-bowled if re-bowl is on. | Both |
| SCORE-08 | No-ball | 1. Tap No ball. 2. Next ball tap 4. | No-ball adds 1 and is re-bowled; next ball's 4 counts to batter. | Both |
| SCORE-09 | Byes and leg byes | 1. Tap Bye 2, then Leg bye 1. | Runs go to extras, not to the batter; both are legal balls; strike changes on the odd one. | Both |
| SCORE-10 | Wicket: bowled | 1. Tap Out, choose Bowled. 2. Pick the new batter. | Wicket recorded to bowler, new batter walks in, scorecard says "b Bowler". | Both |
| SCORE-11 | Wicket: caught with fielder | 1. Out, Caught, type or pick the fielder. | Scorecard says "c Fielder b Bowler"; fielder gets a catch in MVP. | Both |
| SCORE-12 | Wicket: stumped, lbw, hit wicket | 1. Take each in turn. | Each credited to the bowler with the right dismissal text. | Both |
| SCORE-13 | Wicket: run out, choose who is out | 1. Out, Run out, pick the non-striker, with 1 run completed. | Non-striker removed, runs counted, bowler not credited. | Both |
| SCORE-14 | Undo last ball | 1. Score 3 balls and a wicket. 2. Tap Undo four times. | Each undo restores score, wickets, batter, bowler and strike exactly. | Both |
| SCORE-15 | Redo | 1. Undo two balls. 2. Tap Redo twice. | Balls return identically. A new ball after undo clears redo. | Both |
| SCORE-16 | Edit an old ball | 1. Open Correct this ball on a ball from over 1. 2. Change 1 to 4. | Totals, batter and bowler figures recompute. Change appears in the change log. | Both |
| SCORE-17 | Edit a ball to a wide | 1. Correct an earlier legal ball into a Wide. | Over now needs one more legal ball; totals recompute; no crash. | Both |
| SCORE-18 | Swap strike | 1. Tap Swap mid-over. | Striker and non-striker exchange, no runs added. | Both |
| SCORE-19 | Change overs | 1. Open Change overs. 2. Cut 5 overs to 3. | Innings limit changes. Cutting below balls already bowled is refused. | Both |
| SCORE-20 | Retire a batter | 1. Retire a batter, choose a new one. | Shown as "retired not out", can come back later. | Both |
| SCORE-21 | Retired hurt | 1. Retire with the hurt option. 2. Later bring the batter back. | Shown as retired hurt, never out; returns to the same place in the order. | Both |
| SCORE-22 | Over end and bowler change | 1. Finish an over. | Prompts for a new bowler; the same bowler is blocked back to back. | Both |
| SCORE-23 | Innings break | 1. All out or finish overs in innings 1. | Break screen shows score and target, Start the chase. | Both |
| SCORE-24 | Chase to a win | 1. Chase a small target to a win. | Match ends the ball the target is passed; result "won by N wickets" with balls left. | Both |
| SCORE-25 | Chase falls short | 1. Let the chasing side run out of overs. | Result "won by N runs" for the first side. | Both |
| SCORE-26 | Tie then super over | 1. Make scores level. 2. Tap Play a super over. | One over each, wicket limit as in the super over rules; a winner is named. | Both |
| SCORE-27 | Tied super over | 1. Make the super over level too. | Result shows a tie, no infinite loop. | Both |
| SCORE-28 | Last wicket all out | 1. Dismiss all but one with last man stands off. | Innings ends all out. | Both |
| SCORE-29 | Scorecard from Live | 1. Tap Scorecard during a match. | Batting and bowling tables, extras, fall of wickets match the live score. | Both |
| SCORE-30 | Match saves without a network | 1. Airplane mode. 2. Score a full match. | Everything works, result and history saved. | Both |

---

## 3. Test matches (TEST)

| ID | Title | Steps | Expected | Plat |
|---|---|---|---|---|
| TEST-01 | Test setup | 1. Setup, choose Test match. | No overs field for innings; a total overs cap field is offered. | Both |
| TEST-02 | Innings order A, B, A, B | 1. Finish four innings. | Order is A, B, A, B and no super over is ever offered. | Both |
| TEST-03 | Declare and undo | 1. In an innings tap Declare innings. 2. Undo it. | Innings closes as declared with its score; undo reopens it. | Both |
| TEST-04 | Follow-on offered only when leading | 1. Finish innings 2 trailing by a margin, then trailing by less. | Follow-on offered only when the first side leads by enough; hidden otherwise. | Both |
| TEST-05 | Follow-on enforced | 1. Enforce it. | Second side bats again as innings 3; if they fail to level, loss by an innings. | Both |
| TEST-06 | Follow-on not enforced | 1. Decline. | The side that batted first bats again as innings 3. | Both |
| TEST-07 | Fourth innings chase result | 1. Chase to a win, then repeat losing and tying. | Win by wickets left, loss by runs, tie when all out level. | Both |
| TEST-08 | Stop as draw | 1. Mid-match tap Stop the match, call it a draw. | Match ends as a draw; undo reopens it. | Both |
| TEST-09 | Overs cap draw | 1. Set total overs to 6 and bowl them. | Match ends as a draw when the cap is hit. | Both |
| TEST-10 | Live lead text | 1. Watch the header in innings 3. | Shows the current lead or deficit correctly. | Both |

---

## 4. Gully rule toggles and presets (RULE)

| ID | Title | Steps | Expected | Plat |
|---|---|---|---|---|
| RULE-01 | Extra run on wide and no-ball | 1. Toggle "wide and no-ball give 1 run" on, bowl both. 2. Toggle off, repeat. | On adds 1 each; off adds 0. | Both |
| RULE-02 | Re-bowl | 1. Turn re-bowl off. 2. Bowl a wide. | Wide counts as a legal ball; on, it is bowled again. | Both |
| RULE-03 | Free hit | 1. Turn Free hit on. 2. Bowl a no-ball, then try Out, Bowled on the next ball. | Next ball is flagged Free hit; only run out is allowed as a dismissal. | Both |
| RULE-04 | Last man stands | 1. Turn on. 2. Lose all wickets but one. | Last batter bats on alone; innings ends only when he is out. | Both |
| RULE-05 | Last man runs two | 1. Turn on, last batter runs 2 on a ball. | Counts 1 run per two run; fours and sixes count in full; nothing changes while two batters remain. | Both |
| RULE-06 | One-tip catch | 1. Turn on. 2. Take a wicket "One-tip catch". | Option available only when on; dismissal credited as a catch. | Both |
| RULE-07 | Wall: four | 1. Wall = Four. 2. Record a wall hit. | 4 runs, not counted as a boundary stat. | Both |
| RULE-08 | Wall: six | 1. Wall = Six. 2. Record a wall hit. | 6 runs. | Both |
| RULE-09 | Wall: out | 1. Wall = Out. 2. Record a wall hit. | Batter is out "wall out". | Both |
| RULE-10 | Wall values per surface | 1. Choose Box walls: side 1, back 4, roof 0, full back 6. 2. Hit each surface with 0 and with 1 run taken. | Score equals wall value plus runs taken. Edit a value and re-test. | Both |
| RULE-11 | Hit out of the ground is out | 1. Turn Hit out on. 2. Record "hit out". | Batter out; a lost ball is recorded against him for the kitty. | Both |
| RULE-12 | No LBW | 1. Turn No LBW on. | LBW is hidden from dismissal choices. | Both |
| RULE-13 | Retire at N | 1. Retire at 20. 2. Score 20 runs for a batter. | Batter retires not out on reaching 20; everyone gets a turn. | Both |
| RULE-14 | Max overs per bowler | 1. Set 2. 2. Let one bowler bowl 2 overs. | He is blocked in the picker, which shows overs left. | Both |
| RULE-15 | Common player and can't bowl | 1. Add Monu as common. 2. Turn "can't bowl" on. | Monu bats for both sides and is greyed out in the bowler picker. | Both |
| RULE-16 | Must run: touch | 1. Choose Tip and run. 2. Bowl a 0 on a touched ball. | Prompts "did he run"; a 0 on an untouched ball is plain. | Both |
| RULE-17 | Must run: every hit | 1. Choose Compulsory run. 2. Bowl a 0. | Asked on every ball; "didn't run" puts the striker out, no bowler credit. | Both |
| RULE-18 | Didn't run not on byes | 1. With must run on, record a bye. | Didn't run is not offered. | Both |
| RULE-19 | No running | 1. Turn No running on. 2. Score 2 on the ground. | Counts 0, batters never cross; wall and boundary runs still score. | Both |
| RULE-20 | Sixes only | 1. Use the Sixes only preset. 2. Score 2, then 4, then a wall. | Ground runs 0; only fours, sixes and walls count. | Both |
| RULE-21 | Dot balls out | 1. Dot balls out = 3. 2. Three dots in a row. | Batter out on the third; a scoring ball or a wide resets nothing wrongly (wide is not a dot). | Both |
| RULE-22 | Dot out for sixes only | 1. Turn Dot is out on. 2. Bowl a single. | Any ball that scores nothing is out, including a run taken. | Both |
| RULE-23 | Misses out | 1. Set 3. 2. Mark Play and miss three times in a turn. | Batter out on the third miss. | Both |
| RULE-24 | Wicket penalty | 1. Penalty 5, take 2 wickets. | Batting side loses 5 per dismissal, batter stays on if not all out. | Both |
| RULE-25 | Golden ball | 1. Golden ball over 2 ball 3. 2. Score 4 on it; later take a wicket on it. | Runs double (8); a wicket costs 6 runs. | Both |
| RULE-26 | Power ball | 1. Power ball = 4. 2. Score 2 on ball 4 of each over, and a wide on it. | Runs double on that ball every over; a wide on it also doubles. | Both |
| RULE-27 | Joker over | 1. Joker over = 3. 2. Score through over 3. | Every run in over 3 doubles. | Both |
| RULE-28 | Multipliers stack | 1. Joker over 3 and Power ball 2 and golden ball 3.2. | Doubles combine as 2x, 4x etc. as the rules card says. | Both |
| RULE-29 | Protected player | 1. Protect Aarav. 2. Dismiss him twice (once per innings test). | First dismissal each innings costs wicket penalty (5 if unset) and he stays; the second is out. | Both |
| RULE-30 | Overthrows | 1. On a ball enter 1 run and 2 overthrows. | 3 added to the batter, strike crosses on the total; overthrows off byes are extras. | Both |
| RULE-31 | Penalty runs to batting side | 1. Award 5 penalty to the batting side. | Added to score now, reason shown, undo removes it. | Both |
| RULE-32 | Penalty to fielding side | 1. Award 5 to the fielding side before it bats, then during a chase. | First goes on its next innings; in a chase it raises the target. | Both |
| RULE-33 | Balls per over 3 to 8 | 1. Set 3, then 8, then 5. | Over ends after that many balls; overs display in that length; below 3 or above 8 is clamped. | Both |
| RULE-34 | Balls per over locked after start | 1. Start a match. 2. Try Change rules. | Balls per over cannot be changed mid-match. | Both |
| RULE-35 | 100-ball innings | 1. Choose the 100 balls preset. | 20 five-ball overs, innings ends at 100 balls; max 4 overs a bowler. | Both |
| RULE-36 | Cut overs in 100-ball innings | 1. Change overs to 10. | Balls set to 50 as well. | Both |
| RULE-37 | Preset: Gully classic | 1. Pick it. | 6 overs, one-tip catch, last man stands, hit out is out all on. | Both |
| RULE-38 | Preset: Tip and run, Compulsory run | 1. Pick each. | Must run set to touch, then every-hit; 5 overs. | Both |
| RULE-39 | Preset: Box, Pairs box | 1. Pick each. | Walls 1/4/6, wicket costs 5, 3 dots out (box); pairs format with 4-over pairs (pairs box). | Both |
| RULE-40 | Preset: Tape ball, Office | 1. Pick each. | Tape ball: 8 overs, free hit, no LBW. Office: wall = four, retire at 20, no LBW, 4 overs. | Both |
| RULE-41 | Preset switching leaves nothing behind | 1. Pick Box, then Gully classic, then Solo. | Box walls and dot-ball rule vanish; the preset card stays lit only while rules match it exactly. | Both |
| RULE-42 | Rules card matches rules | 1. After any combination open Rules card. | Short sentences list every rule that is on, nothing that is off. | Both |

---

## 5. Formats (FMT)

| ID | Title | Steps | Expected | Plat |
|---|---|---|---|---|
| FMT-01 | Solo with 2 players | 1. Solo preset, add Raj and Sim. 2. Play. | Turns alternate; the only other player bowls every over; start needs 2 players. | Both |
| FMT-02 | Solo with 5 players | 1. Add five players, play a round. | Each bats in order; bowling rotates each over, skipping the batter. | Both |
| FMT-03 | Solo ball cap | 1. Ball cap 12. 2. Bowl 12 legal balls incl. a wide. | Turn ends after 12 legal balls; the wide is bowled again and not counted. | Both |
| FMT-04 | Solo custom or no cap | 1. Cap 6, then no limit. | Turn ends at 6; with no limit only an out ends it. | Both |
| FMT-05 | Solo lives | 1. Lives = 3. 2. Get out once, then twice more. | Batter stays in until the last life; a batter with a life left when balls run out is not out. | Both |
| FMT-06 | Solo rounds | 1. Rounds = 2. | Everyone bats twice; labels show round; runs add across rounds. | Both |
| FMT-07 | Solo no strike change | 1. Score odd runs and end an over. | Strike never changes. | Both |
| FMT-08 | Solo standings and tie-break | 1. Finish a match with equal runs but different balls. | Ranked by runs, then fewer balls faced; result names the winner and the tie-break. | Both |
| FMT-09 | Solo true tie | 1. Make runs and balls level. | Result is a tie. | Both |
| FMT-10 | Solo undo across turns | 1. Undo past a turn change and past a finished match. | Previous turn and life restored; finished match reopens. | Both |
| FMT-11 | Solo three misses | 1. Misses out = 3 in solo. | Third miss is out. | Both |
| FMT-12 | Pairs cricket | 1. Pairs box preset, 8 players. | Pairs formed in order, rotate every 4 overs, a dismissal costs 5 and the batter bats on, never all out. | Both |
| FMT-13 | Pairs standings and chase | 1. Finish a pairs match. | Per-pair standings shown; chase bats its full overs; result by runs. | Both |
| FMT-14 | Double wicket | 1. Double wicket preset, 2 per side. | Each side bats all 4 overs as one pair; forced outs cost runs. | Both |
| FMT-15 | French cricket | 1. French preset with 4 players. | No overs; only caught or hit legs are dismissals; nobody asked for a bowler per over. | Both |
| FMT-16 | French next batter | 1. Get the batter out caught by Dev. 2. Get another out hit legs. | Dev bats next; for hit legs the bowler bats next; last batter bowls first. | Both |
| FMT-17 | French stop | 1. Stop mid-turn. 2. Undo the stop. | Most runs wins; stopping ends the match there; undo restores. | Both |
| FMT-18 | Start from a target | 1. Setup, choose Start from a target, enter 62 for 3 wickets. | Match starts at the break with innings 1 given as 62/3; chase works as normal and can be lost. | Both |
| FMT-19 | Target default | 1. Leave wickets empty. | Defaults to no wickets fallen. | Both |

---

## 6. Fair play and match day (FAIR)

| ID | Title | Steps | Expected | Plat |
|---|---|---|---|---|
| FAIR-01 | Who's playing today | 1. Setup, Who's playing today, tick 10 names. | Pool built from teams and match history. | Both |
| FAIR-02 | Fair teams | 1. Tap Shuffle teams with ratings available. | Two balanced teams; rating difference shown small; odd number makes a common player. | Both |
| FAIR-03 | Reshuffle | 1. Tap Shuffle again several times. | Different splits each time, always balanced. | Both |
| FAIR-04 | Fair teams with no history | 1. Fresh install, add 8 new names, shuffle. | Splits evenly with no crash or NaN ratings. | Both |
| FAIR-05 | Umpire rotation on | 1. Turn Umpires rotate on. 2. Bowl 3 overs. | Banner names an umpire from the fielding side, moves each over, never the bowler or a batting common player. | Both |
| FAIR-06 | Umpire skips absentees | 1. Mark a player as left. | Never picked as umpire. | Both |
| FAIR-07 | Umpire in solo | 1. Solo match with rotation on. | Skips the batter and the bowler. | Both |
| FAIR-08 | Rules locked after toss | 1. Start the first innings. 2. Open Change rules. | Change requires agreement. | Both |
| FAIR-09 | Change rules with agreement | 1. Turn Free hit on, tick who agreed. | Applies only from the next ball; shown on the change log with time and names. | Both |
| FAIR-10 | Undo and redo a rule change | 1. Undo, then Redo the change. | Old rules return; redo reapplies. | Both |
| FAIR-11 | Rule change between innings | 1. Change a rule at the break. 2. Undo. | Applies to the next innings only; undo removes it before reopening the innings. | Both |
| FAIR-12 | Last man stands added mid-match | 1. Turn it on mid-innings. | Batting side gets one more wicket. | Both |
| FAIR-13 | Change log of edits | 1. Edit two old balls. 2. Open the change log. | Each edit lists when, where, from and to; a no-op edit is not logged. | Both |
| FAIR-14 | Bowler picker | 1. Open Change bowler. | Shows overs bowled and overs left under cap, marks who just bowled, blocks batter in solo. | Both |
| FAIR-15 | Nudges: everyone gets a go | 1. With 6 players a side, check the nudge during the innings. | Lists players yet to bat or bowl; leaves out those who went home and a can't-bowl common player. | Both |
| FAIR-16 | Ball lost | 1. Tap Ball lost with a reason. | Dead ball, nothing counted, shown in ball-by-ball; undo and redo work; only while the innings is live. | Both |
| FAIR-17 | Add player mid-match | 1. Add a new name to the batting side. | Side gets one more wicket; in solo the name joins the batting order. | Both |
| FAIR-18 | Player left | 1. Mark a batter as left. | He cannot bat or bowl again; past balls unchanged; his side loses that wicket if he was yet to bat; retired batters who left cannot return. | Both |
| FAIR-19 | Stop now, leader wins | 1. Both sides faced a ball. 2. Choose Stop now. | The side ahead on runs per ball wins and result says so; level is a tie; undo restores; not offered in a Test. | Both |
| FAIR-20 | Rematch | 1. On Result tap Play again, same teams. | Same teams, rules and players, toss and innings reset. | Both |
| FAIR-21 | Evening tally | 1. Play 3 rematches today. | This evening shows wins per team for the day only; older matches and unfinished ones are not counted. | Both |
| FAIR-22 | Quick match | 1. Tap Quick match or the quick start. | Starts with last used teams and rules, one tap to toss. | Both |

---

## 7. Live sharing (LIVE)

| ID | Title | Steps | Expected | Plat |
|---|---|---|---|---|
| LIVE-01 | Start live sharing | 1. On Live tap Start live sharing. | Six character code and link shown, "You're live" pill. | Both |
| LIVE-02 | Watch by link on web | 1. Open the link in another browser. | Score updates ball by ball within a couple of seconds. | Both |
| LIVE-03 | Watch by code | 1. Home, Watch a live match, type the code. | Opens the same live view; wrong code shows a clear message. | Both |
| LIVE-04 | App as scorer, web as watcher | 1. Score on the app. 2. Watch on web. | Watcher mirrors every ball, undo and edit. | App |
| LIVE-05 | Web as scorer, app as watcher | 1. Score on web. 2. Join by code in the app. | Same as above; Back from Watching live goes Home. | Both |
| LIVE-06 | Stop sharing | 1. Tap Stop sharing. | Watchers see the match as no longer live; the scorer keeps scoring. | Both |
| LIVE-07 | Watcher cannot score | 1. As watcher, look for scoring controls. | None; only a view and Stop watching. | Both |
| LIVE-08 | Fake update ignored | 1. Open the room link in a third device and try to push an update (or tamper the fingerprint in the link). | Viewers ignore updates not signed by the scorer key. | Web |
| LIVE-09 | Move scoring to another phone | 1. On phone A tap Move scoring to another phone. 2. Open the link on phone B. 3. Tap Move scoring here. | Phone B can score; phone A shows "Scoring is on another phone". | Both |
| LIVE-10 | Take scoring back | 1. On phone A tap Take scoring back. | A scores again; B is blocked. Used link no longer works a second time. | Both |
| LIVE-11 | Watch drops and reconnects | 1. Turn the watcher offline for 30 s, then online. | Watcher catches up to the current score. | Both |
| LIVE-12 | Live not configured | 1. Run a build without Supabase keys. | Live buttons are hidden; app otherwise fully works. | Both |
| LIVE-13 | WhatsApp link | 1. Tap Send link on WhatsApp. | WhatsApp opens with the watch link text. | Both |

---

## 8. Tournaments, points table, NRR, series (CUP)

| ID | Title | Steps | Expected | Plat |
|---|---|---|---|---|
| CUP-01 | Create league | 1. Cups, New Tournament, 4 teams, league only. | Every team plays every other; no team plays twice in one round. | Both |
| CUP-02 | Play a fixture | 1. Tap Play on fixture 1. | Opens Setup prefilled with the two teams and tournament rules; the result posts to the table. | Both |
| CUP-03 | Points table | 1. Finish 3 fixtures. | Points, played, won, lost, tied and NRR correct; ranked by points then NRR. | Both |
| CUP-04 | NRR, all out | 1. Have a team all out in 3 of 5 overs. | NRR counts the full 5 overs for that team. | Both |
| CUP-05 | NRR with 8-ball overs | 1. Tournament with 8 balls per over. 2. Finish a match. | Overs for NRR are counted in 8-ball overs; an all-out side uses its full quota in 8-ball overs. | Both |
| CUP-06 | Top 2 final | 1. Finish the league with a final. | Final created between the top two; winner crowned Champions. | Both |
| CUP-07 | IPL playoffs | 1. Choose IPL style with 4+ teams. | Qualifier 1, Eliminator, Qualifier 2, Final in order. | Both |
| CUP-08 | Semi-finals | 1. Choose semis. | 1 v 4 and 2 v 3, then the final. | Both |
| CUP-09 | Playoffs with 3 teams | 1. IPL or semis with 3 teams. | Falls back to a top-2 final. | Both |
| CUP-10 | Tied playoff | 1. Tie a playoff, finish with a super over off. | Team higher in the table advances, noted in the result. | Both |
| CUP-11 | Knockout | 1. Knockout with 4, 5 and 2 teams. | 4: two semis then final. 5: top 3 seeds get a bye and 4 v 5 plays first. 2: just the final. | Both |
| CUP-12 | Delete tournament | 1. Delete tournament, confirm. | Gone from Cups; its matches stay in History. | Both |
| CUP-13 | Series | 1. New series, Team A vs Team B, best of 3. | Score starts level, match 1 next; leader named; a side that cannot be caught is declared the winner while remaining matches can still be played. | Both |
| CUP-14 | Series drawn | 1. Finish a series level, and one with Tests draws. | Level series reads drawn; tests drawn count as drawn. | Both |
| CUP-15 | Unfinished series match | 1. Leave match 2 unfinished, reopen the series. | It offers to carry on that match, not start a new one. | Both |

---

## 9. Teams, profiles, skill card, merge (TEAMS)

| ID | Title | Steps | Expected | Plat |
|---|---|---|---|---|
| TEAMS-01 | Create and edit a team | 1. Teams, new team, add 6 names, save. 2. Edit it. | Saved and editable; duplicate names within a team are refused or merged. | Both |
| TEAMS-02 | Save two teams first | 1. Fresh install, Setup, try to use saved teams. | "Save two teams first" prompt, with a link to Teams. | Both |
| TEAMS-03 | Delete team | 1. Delete team, confirm. | Removed; past matches unaffected. | Both |
| TEAMS-04 | Player profile | 1. Tap Aarav. | Matches, runs, average, strike rate, wickets, economy, fielding appear. | Both |
| TEAMS-05 | Profile filters by kind | 1. Choose Limited overs, Test, Solo in turn. | Only kinds he played are offered; stats change per kind. | Both |
| TEAMS-06 | Profile filter by year | 1. Pick a year. | Stats cover only that year; "N matches" line matches. | Both |
| TEAMS-07 | Skill card | 1. Open a player's skill card. | Score 0 to 99, tier (Bronze, Silver, Gold, Icon), role, stats; score 0 with no matches, no NaN. | Both |
| TEAMS-08 | Skill card share | 1. Tap share on the card. | Image or text shares through the share sheet or WhatsApp. | Both |
| TEAMS-09 | Edit player details | 1. Edit player details, set role. | Saved and shown on the card. | Both |
| TEAMS-10 | Merge players | 1. Merge Dev into Devendra. | Matches, teams and kitty entries move; reach counts shown before confirm; stats combine. | Both |
| TEAMS-11 | Undo merge | 1. Tap Undo merge right after. | Everything returns to how it was, including kitty entries. | Both |
| TEAMS-12 | Merge validations | 1. Merge a name into itself, or an unknown name. | Blocked with "No one by that name" style message. | Both |
| TEAMS-13 | Stats leaderboard | 1. Stats tab. | Leaderboards sorted; limited and Test shown separately via the format switch. | Both |
| TEAMS-14 | Player card text | 1. Open Gully Scorer player card. | Card shows name, tier and headline stats without clipping. | Both |

---

## 10. Gully Book (BOOK)

| ID | Title | Steps | Expected | Plat |
|---|---|---|---|---|
| BOOK-01 | Empty book | 1. Fresh install, open Gully Book. | "The book is empty" state, no errors. | Both |
| BOOK-02 | Overview | 1. With data open Overview. | Played, completed, runs, wickets, sixes, fours, ducks, first and last match dates correct. | Both |
| BOOK-03 | Records | 1. Open Records. | Highest score, best bowling, most sixes in an innings, highest total, lowest all out, closest finish, biggest wins, most runs in an over, biggest collapse, each links to its match. | Both |
| BOOK-04 | Record accuracy | 1. Score a known 50 and 5-wicket haul. | Appear as record candidates with correct text. | Both |
| BOOK-05 | Milestones | 1. Open Milestones. | 25, 50, 100, 3w, 5w, hat-trick, five sixes in an over, 30 in an over, golden duck, maiden show for the right players. | Both |
| BOOK-06 | Hat-trick detection | 1. Take three wickets in consecutive legal balls by one bowler. | Hat-trick milestone credited; a wide in between does not break it unexpectedly. | Both |
| BOOK-07 | Hall of shame | 1. Open Hall of shame. | Ducks, golden ducks, run outs suffered and caused, extras bowled, expensive over listed, top 5 each. | Both |
| BOOK-08 | Nothing to tease | 1. With one tiny match. | "Nothing to tease anyone about" empty state. | Both |
| BOOK-09 | Streaks | 1. Open Streaks. | Player streaks of 10s and wickets, team win streaks show current and best. | Both |
| BOOK-10 | Head to head | 1. Pick Aarav and Gopal. | Both batter-vs-bowler duels with runs, balls, dismissals, strike rate. | Both |
| BOOK-11 | Rivalry | 1. Pick two teams or players. | Played, wins each, ties, draws, last five results, biggest wins. | Both |
| BOOK-12 | Format filter | 1. Switch limited and Test. | All sections recompute and solo matches are excluded where not relevant. | Both |
| BOOK-13 | Share the book | 1. Tap Share the book. | Shares a text or image summary via WhatsApp or the share sheet. | Both |

---

## 11. Kitty (KITTY)

| ID | Title | Steps | Expected | Plat |
|---|---|---|---|---|
| KITTY-01 | Add expense | 1. Kitty, Add expense: 300, Ball, paid by Aarav, split with 5. | Shares 60 each; Aarav is owed 240. | Both |
| KITTY-02 | Split rounding | 1. Add 100 split among 3. | Shares add to exactly 100 (34, 33, 33 or similar); payer share handled. | Both |
| KITTY-03 | Expense kinds | 1. Add one of each kind: ball, tape, bat, turf, chai, other. | All saved with the right kind label. | Both |
| KITTY-04 | Balances and who pays whom | 1. With 3 expenses open Balances. | Net per player sums to 0; Who pays whom lists the fewest transfers. | Both |
| KITTY-05 | Settle and mark paid | 1. Mark paid on a transfer. | A settlement is recorded; balances update; "Everyone is square" when zero. | Both |
| KITTY-06 | Turf split | 1. After a match tap Split turf fee, enter 1200. | Splits across the players of the match equally; payer chosen. | Both |
| KITTY-07 | Turf split with common player | 1. Match with Monu on both sides. | Monu counted once. | Both |
| KITTY-08 | Lost-ball ledger from hit out | 1. Hit out of the ground is out, then open Kitty. | A "Lost balls" debt exists against the batter; Who paid for the ball? lets someone resolve it. | Both |
| KITTY-09 | Lost-ball from ball lost | 1. Record Ball lost with a striker. | Debt for that striker appears in the ledger. | Both |
| KITTY-10 | Resolve a ball debt | 1. Tap Got a new ball, choose who paid. | Debt marked resolved; an expense is added. | Both |
| KITTY-11 | Losers pay | 1. Add a "Losers pay" item "loser buys chai" for a match. 2. Finish the match. | Losers listed automatically; Settled turns it off. | Both |
| KITTY-12 | Stake on a tie or draw | 1. Finish the match tied. | No losers named; stake stays open. | Both |
| KITTY-13 | UPI QR | 1. Save a UPI id. 2. Tap Show QR on a transfer. | QR opens a UPI app with exact payee, amount and note. | App |
| KITTY-14 | UPI id validation | 1. Enter `sahil@@bad` and `sahil@okhdfc`. | First is rejected, second accepted (case and spaces ignored). | Both |
| KITTY-15 | QR on web | 1. Show QR on web. | QR renders; scanning from another phone opens the UPI app. | Web |
| KITTY-16 | Delete entries | 1. Delete an expense, a payment and a stake. | Each removal confirmed, balances recompute; deletion syncs via backup. | Both |
| KITTY-17 | Kitty survives merge | 1. Merge names, check kitty. | Entries renamed to the new name. | Both |

---

## 12. Charts, MVP, awards, exports, posters, sharing (SHARE)

| ID | Title | Steps | Expected | Plat |
|---|---|---|---|---|
| SHARE-01 | Worm chart | 1. Result, Charts, Worm. | Both innings plotted ball-by-ball; ends match totals. | Both |
| SHARE-02 | Manhattan | 1. Open Manhattan for innings 1. | Bar per over with runs and wicket markers; 5-ball overs use their own length. | Both |
| SHARE-03 | Run rates | 1. Open run rate chart in a chase. | Run rate line and required rate line present. | Both |
| SHARE-04 | Partnerships | 1. Open Partnerships. | Each partnership with runs and balls; adds up to innings total. | Both |
| SHARE-05 | Solo turns chart | 1. Open charts on a solo match. | Bar per turn with batter, runs, balls, outs. | Both |
| SHARE-06 | MVP | 1. Open MVP. | Rows sorted by points; catches, run outs, stumpings count; minimum balls rule respected. | Both |
| SHARE-07 | Awards | 1. Open Awards. | Player of the match, best hitter, wickets, economy, catches each named with a line. | Both |
| SHARE-08 | PDF scoresheet | 1. Tap Print or PDF scoresheet. | Scoresheet with both innings, extras and result prints or saves as PDF. | Web |
| SHARE-09 | PDF scoresheet on app | 1. Same on the app. | A share or print sheet opens with the scoresheet. | App |
| SHARE-10 | CSV export | 1. Stats, Export CSV. | File downloads or shares, opens in a spreadsheet with correct columns, no stray commas from names. | Both |
| SHARE-11 | Posters | 1. Result, Posters: Match poster, Winner poster. | Image generated with scores and players; no clipped text with the long name. | Both |
| SHARE-12 | Highlights card | 1. Tap Send highlights. | Card with the top moments for the match renders and shares. | Both |
| SHARE-13 | WhatsApp text | 1. Tap Share, choose WhatsApp text. | Plain summary text opens in WhatsApp with correct result line. | Both |
| SHARE-14 | Full scorecard image | 1. Send full scorecard on WhatsApp. | A tall image with batting and bowling tables for each innings. | Both |
| SHARE-15 | Solo sharing | 1. Finish a solo match and share. | Text and images show standings, not team scores. | Both |
| SHARE-16 | Super over in share | 1. Share after a super over match. | Super over listed and result correct. | Both |
| SHARE-17 | Share cancelled | 1. Open the share sheet and cancel. | No crash, still on Result. | App |

---

## 13. Next game card, reminders, calendar (NEXT)

| ID | Title | Steps | Expected | Plat |
|---|---|---|---|---|
| NEXT-01 | Plan the next game | 1. Home, Plan the next game. 2. Pick Sunday, 7 am, place "Lane 4". | Card shows "Sunday 7 am at Lane 4". | Both |
| NEXT-02 | Day and time labels | 1. Pick today, tomorrow and 9 days out. | Labels read today, tomorrow, weekday name within the week, otherwise "Sun 30 Nov". | Both |
| NEXT-03 | Who is in | 1. Tap names from Played before. | Count updates ("8 in so far"); empty reads "who's in?". | Both |
| NEXT-04 | Past time refused | 1. Pick today with a time already gone. | "That time has passed. Pick a later one." | Both |
| NEXT-05 | Share text | 1. Share the card. | Text has day, time, place, who is in and the note. | Both |
| NEXT-06 | Reminder notification | 1. Save a game 2 hours ahead with Reminder an hour before on. 2. Wait. | Permission asked only at save; notification fires one hour before. No reminder offered if the hour has passed. | App |
| NEXT-07 | Reminder cancelled | 1. Remove this game. | The scheduled notification is cancelled. | App |
| NEXT-08 | Permission denied | 1. Deny notifications. 2. Save the game. | Game still saved, no crash, no reminder. | App |
| NEXT-09 | Calendar file | 1. Tap Add to calendar. | .ics downloads; opens with a 2-hour event, location, note and a 1-hour alarm. | Web |
| NEXT-10 | Card hides after the game | 1. Check 3 hours after start. | Card no longer shown on Home. | Both |

---

## 14. Backup and account (BACK)

| ID | Title | Steps | Expected | Plat |
|---|---|---|---|---|
| BACK-01 | App works signed out | 1. Never sign in. 2. Use everything. | No gate; Backup prompt "Don't lose your matches" is dismissible. | Both |
| BACK-02 | Sign in new number | 1. Enter country code and number. 2. Set a 6-digit passcode twice. | Account created; "Signed in as" shown; mismatch gives "The two passcodes don't match." | Both |
| BACK-03 | Bad number | 1. Enter 123. | "That doesn't look like a mobile number." | Both |
| BACK-04 | Cloud sync pushes | 1. Sign in, score a match. | Sync status reaches saved; Try saving again works after an error. | Both |
| BACK-05 | Sign in on another phone merges | 1. Sign in with the same number on phone B with its own matches. | Both sets merge, nothing lost on either side. | Both |
| BACK-06 | Sign out keeps data | 1. Sign out. | Data stays on this phone. | Both |
| BACK-07 | Save a backup file | 1. Tap Save a backup file. | File named gully-backup-YYYY-MM-DD.json saved or shared. | Both |
| BACK-08 | Restore from a file | 1. Fresh install. 2. Restore from a file. | Matches, teams, cups, series, kitty return; message says "Added N matches, ...". | Both |
| BACK-09 | Restore merges | 1. Restore the same file again. | "Nothing new in that file." and nothing duplicated. | Both |
| BACK-10 | Bad file | 1. Restore from a random JSON or text file. | Clear error, no change to data. | Both |
| BACK-11 | Partial old file | 1. Restore a file missing kitty and series. | Missing parts read as empty, no crash. | Both |
| BACK-12 | Accounts off | 1. Build without the accounts flag. | Sign in section hidden; file backup still works. | Both |

---

## 15. Voice, commentary, wagon wheel, turf timer, screen awake (VOICE)

| ID | Title | Steps | Expected | Plat |
|---|---|---|---|---|
| VOICE-01 | Voice runs | 1. Tap mic. 2. Say "four", then "six", "one". | Each scored as heard, shown on the ball chips. | Both |
| VOICE-02 | Voice extras and wickets | 1. Say "wide", "no ball", "out". | Wide and no-ball recorded; "out" opens the dismissal prompt. | Both |
| VOICE-03 | Hindi words | 1. Say "chauka", "galat". | Chauka scores 4; galat is treated as the matching command. | Both |
| VOICE-04 | Voice undo | 1. Say "undo". | Last ball removed. | Both |
| VOICE-05 | Unrecognised speech | 1. Say nonsense. | Nothing scored, gentle feedback. | Both |
| VOICE-06 | Mic permission denied | 1. Deny mic. 2. Tap mic. | Clear message, tap scoring unaffected. | Both |
| VOICE-07 | Unsupported browser | 1. Open in a browser without speech support. | Mic button hidden or disabled. | Web |
| VOICE-08 | Spoken commentary | 1. Turn commentary on. 2. Score a four and a wicket. | The phone speaks a line for each; mute silences it. | Both |
| VOICE-09 | Wagon wheel | 1. Tap a direction when scoring a four. 2. Open the wagon wheel. | Shot plotted in the right zone; display only, no effect on score. | Both |
| VOICE-10 | Turf timer | 1. Start a turf timer for 30 minutes. | Alerts at 10 and 5 minutes left and at time up. | Both |
| VOICE-11 | Keep screen awake | 1. Open Live and leave the phone idle for 3 minutes. | Screen stays on during Live; sleeps normally on other screens. | App |
| VOICE-12 | Keep awake on web | 1. Same on mobile browser. | Screen stays on where the Wake Lock API exists; no error otherwise. | Web |

---

## 16. Ads and analytics (ADS)

| ID | Title | Steps | Expected | Plat |
|---|---|---|---|---|
| ADS-01 | Test banner on Home | 1. Open Home on the app build with no real ad unit id. | Google test banner shows. | App |
| ADS-02 | Banner on Result and Lists | 1. Open Result and History or Cups. | Banner in the same spots as web; collapses cleanly if it fails to load. | Both |
| ADS-03 | Never on Live | 1. Score a full match. | No ad on Live, Scorecard during live, or any sheet. | Both |
| ADS-04 | Offline ads | 1. Airplane mode, open Home. | No empty gap where the ad would be. | Both |
| ADS-05 | Non personalised only | 1. Check ad request settings (in build). | Non-personalised requests only. | App |
| ADS-06 | No Firebase config | 1. Run a build with no Firebase keys. | App launches and runs, track calls are silent no-ops, no crash. | App |
| ADS-07 | Analytics with Firebase | 1. Add keys, open screens. | Page views logged without blocking the UI. | Both |

---

## 17. Look and feel (UI)

| ID | Title | Steps | Expected | Plat |
|---|---|---|---|---|
| UI-01 | 360pt width, every screen | 1. Open Home, Setup, Live, Scorecard, Result, Teams, Book, Kitty, Cups on a 360pt phone. | Floodlights look throughout, no horizontal scroll, buttons at least thumb size. | Both |
| UI-02 | Long names | 1. Use Venkatasubramaniam Raghunathan-Iyer in a team, scorecard, poster and kitty. | Truncated with an ellipsis or wrapped, never clipped or overlapping scores. | Both |
| UI-03 | Hindi names and emoji | 1. Add a Devanagari name. | Renders in all screens and images. | Both |
| UI-04 | Dark theme contrast | 1. Review all screens in dark theme. | Text readable, orange and lime accents pass visually, nothing disappears on dark glow. | Both |
| UI-05 | Large font setting | 1. Set Android font size to largest. | Live run buttons stay tappable, no text hidden. | App |
| UI-06 | Landscape | 1. Rotate the phone on Live. | Layout adapts, no state lost. | Both |
| UI-07 | Small phone Live screen | 1. Use a 320pt-high window. | All run buttons reachable by scroll or compact layout. | Both |
| UI-08 | Sheets on short screens | 1. Open More, Retire and Change overs. | Sheets scroll, primary buttons visible above the keyboard. | Both |
| UI-09 | Keyboard handling | 1. Type in New batter's name and Amount fields. | Field stays above keyboard. | App |
| UI-10 | Install and offline on web | 1. Install the PWA. 2. Go offline and open it. | App loads and scores offline. | Web |
