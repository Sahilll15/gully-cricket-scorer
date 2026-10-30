# Gully Cricket Scorer

Score a gully cricket match by tapping or by voice, let friends who couldn't come watch it live, and send the scorecard to your group. I built it with Claude Code in 25 minutes for the "1 spin, 1 hour" series on Instagram, [@chalkesahil.ai](https://www.instagram.com/chalkesahil.ai/).

Try it: [ai.sahilchalke.com/score](https://ai.sahilchalke.com/score/)

## What it does

- Tap scoring with gully rules you switch on per match: wide and no-ball runs, free hit, last man stands, one-tip one-hand catch, ball hitting the wall.
- Voice scoring. Tap the mic and say "four", "wide", "out" or "undo". Hindi words like "chauka" and "galat" work too.
- A common player who plays for both teams when you have an odd number.
- Live sharing. Friends open a link and see every ball as it happens.
- A scorecard image to send to the group.
- Saved teams, small tournaments and player stats.
- Installs as an app on your phone and works with no signal. Matches stay on your phone; there is no login.

## Run it

```bash
npm install
npm run dev
```

Tests:

```bash
npm test
```

Live sharing is optional. Without it the app works fully and the live buttons are hidden. To turn it on, create a free [Supabase](https://supabase.com) project, copy `.env.example` to `.env.local` and fill in the project URL and publishable key. No tables are needed: it uses Supabase Realtime broadcast.

## How it works

The app never saves the score. It saves every ball as an event and replays them to work out the total, wickets, overs and every player's figures. That is why undo and fixing an old ball always add up. The engine is `src/engine/engine.ts`, with its tests next to it.

For live sharing, the scorer's phone is the source of truth. Each update is signed with a key that only the scorer's phone holds, and the share link carries that key's fingerprint, so a viewer ignores any update someone else tries to push into the same room.

## License

MIT. Use it, change it, ship it. A link back is appreciated.
