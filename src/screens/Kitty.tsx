import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Match } from "../engine/types";
import { useStore } from "../store";
import { track } from "../track";
import { EV } from "../events";
import {
  balances, matchPlayers, newExpense, newSettlement, newStake, openDebts, settleUp, turfExpense, turfSplit, uniqueNames,
  type ExpenseKind, type Stake, type Transfer,
} from "../kitty";
import { cleanUpi, upiLink, validUpi } from "../upi";
import { QrCode } from "../qr";
import {
  expenseTitle, history, inr, isEmpty, KINDS, knownNames, liveStakes, matchTitle, pickableMatches, pot, shortDate, STAKE_IDEAS, type HistoryItem,
} from "../kittyView";
import { Card, ConfirmSheet, cx, Header, PrimaryButton, Sheet } from "../ui";

const rs = (n: number) => `₹${inr(n)}`;
const field = "min-h-12 w-full rounded-2xl border-2 border-line bg-panel px-4 text-fg outline-none focus:border-sun";

function Chip({ on, children, onClick }: { on?: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className={cx("press min-h-11 rounded-full border px-4 text-sm font-semibold", on ? "border-sun bg-sun text-ink" : "border-line bg-key text-fg")}>{children}</button>
  );
}

const Label = ({ children }: { children: ReactNode }) => <p className="mb-2 mt-5 text-sm font-semibold text-teal first:mt-0">{children}</p>;

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="pt-3">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold text-teal">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

const Row = ({ children }: { children: ReactNode }) => <div className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">{children}</div>;

function MatchPicker({ matches, value, set }: { matches: Match[]; value: string | null; set: (m: Match | null) => void }) {
  if (!matches.length) return <p className="text-sm text-mute">No matches yet. Score one first.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {matches.map((m) => (
        <Chip key={m.id} on={value === m.id} onClick={() => set(value === m.id ? null : m)}>{matchTitle(m)}, {shortDate(m.createdAt)}</Chip>
      ))}
    </div>
  );
}

const money = (v: string) => v.replace(/\D/g, "").slice(0, 7);

function ExpenseSheet({ names, onClose }: { names: string[]; onClose: () => void }) {
  const { matches, addExpense } = useStore();
  const [what, setWhat] = useState<ExpenseKind>("ball");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [split, setSplit] = useState<string[]>([]);
  const [match, setMatch] = useState<Match | null>(null);
  const [extra, setExtra] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const people = uniqueNames([...(match ? matchPlayers(match) : []), ...names, ...extra]);
  const has = (n: string) => split.some((x) => x.toLowerCase() === n.toLowerCase());
  const toggle = (n: string) => setSplit(has(n) ? split.filter((x) => x.toLowerCase() !== n.toLowerCase()) : [...split, n]);
  const addName = () => {
    const n = typed.trim();
    if (!n) return;
    setExtra([...extra, n]);
    if (!has(n)) setSplit([...split, n]);
    setTyped("");
  };
  const amt = Number(amount) || 0;
  const ok = amt > 0 && paidBy.trim() && split.length > 0 && (what !== "other" || label.trim());
  const each = split.length ? Math.floor(amt / split.length) : 0;
  const odd = amt - each * split.length;
  const save = () => {
    track(EV.kitty_expense, { kind: what, split: split.length });
    addExpense(newExpense({ what, label, amount: amt, paidBy, split, matchId: match?.id }));
    onClose();
  };
  return (
    <Sheet title="Add expense" onClose={onClose}
      footer={<PrimaryButton onClick={save} disabled={!ok}>{amt > 0 ? `Add ${rs(amt)}` : "Add expense"}</PrimaryButton>}>
      <Label>What</Label>
      <div className="flex flex-wrap gap-2">{KINDS.map((k) => <Chip key={k.v} on={what === k.v} onClick={() => setWhat(k.v)}>{k.label}</Chip>)}</div>
      <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={30} className={cx(field, "mt-3")}
        placeholder={what === "other" ? "What was it? e.g. Stumps" : "Label (optional), e.g. Cosco ball"} />
      <Label>Amount</Label>
      <div className="flex items-center gap-2 rounded-2xl border-2 border-line bg-panel px-4 focus-within:border-sun">
        <span className="text-xl font-bold text-mute">₹</span>
        <input value={amount} onChange={(e) => setAmount(money(e.target.value))} inputMode="numeric" placeholder="0"
          className="min-h-14 flex-1 bg-transparent text-2xl font-extrabold tabular-nums text-fg outline-none" />
      </div>
      <Label>From a match (picks its players)</Label>
      <MatchPicker matches={pickableMatches(matches)} value={match?.id ?? null} set={(m) => { setMatch(m); if (m) setSplit(matchPlayers(m)); }} />
      <Label>Paid by</Label>
      {people.length ? (
        <div className="flex flex-wrap gap-2">{people.map((n) => <Chip key={n} on={paidBy === n} onClick={() => setPaidBy(n)}>{n}</Chip>)}</div>
      ) : <p className="text-sm text-mute">Add a name below.</p>}
      <div className="mb-2 mt-5 flex items-center justify-between">
        <p className="text-sm font-semibold text-teal">Split among ({split.length})</p>
        <div className="flex gap-3 text-sm font-semibold">
          <button className="text-sun" onClick={() => setSplit(people)}>Everyone</button>
          <button className="text-mute" onClick={() => setSplit([])}>Clear</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">{people.map((n) => <Chip key={n} on={has(n)} onClick={() => toggle(n)}>{n}</Chip>)}</div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); addName(); }}>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Someone else" maxLength={20} className={cx(field, "flex-1")} />
        <button className="press min-h-12 rounded-2xl bg-raised px-5 font-semibold text-white">Add</button>
      </form>
      {amt > 0 && split.length > 0 && (
        <p className="mt-4 text-sm text-mute">
          {split.length === 1 ? `${split[0]} owes all of it.` : `${rs(each)} each for ${split.length} players.`}
          {odd > 0 && split.length > 1 ? ` ${paidBy || "The payer"} covers the extra ${rs(odd)}.` : ""}
        </p>
      )}
    </Sheet>
  );
}

function TurfSheet({ onClose }: { onClose: () => void }) {
  const { matches, addExpense } = useStore();
  const list = pickableMatches(matches);
  const [match, setMatch] = useState<Match | null>(list[0] ?? null);
  const [fee, setFee] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const amt = Number(fee) || 0;
  const plan = match ? turfSplit(amt, match, paidBy) : null;
  const ok = match && amt > 0 && paidBy;
  const save = () => { if (match) { track(EV.kitty_turf_split); addExpense(turfExpense(amt, match, paidBy)); } onClose(); };
  return (
    <Sheet title="Split the turf fee" onClose={onClose}
      footer={<PrimaryButton onClick={save} disabled={!ok}>Split {amt > 0 ? rs(amt) : "fee"}</PrimaryButton>}>
      <Label>Match</Label>
      <MatchPicker matches={list} value={match?.id ?? null} set={(m) => { setMatch(m); setPaidBy(""); }} />
      <Label>Turf fee</Label>
      <div className="flex items-center gap-2 rounded-2xl border-2 border-line bg-panel px-4 focus-within:border-sun">
        <span className="text-xl font-bold text-mute">₹</span>
        <input value={fee} onChange={(e) => setFee(money(e.target.value))} inputMode="numeric" placeholder="0"
          className="min-h-14 flex-1 bg-transparent text-2xl font-extrabold tabular-nums text-fg outline-none" />
      </div>
      {match && <>
        <Label>Paid by</Label>
        <div className="flex flex-wrap gap-2">{matchPlayers(match).map((n) => <Chip key={n} on={paidBy === n} onClick={() => setPaidBy(n)}>{n}</Chip>)}</div>
        {plan && amt > 0 && <p className="mt-4 text-sm text-mute">{rs(plan.each)} each for {plan.players.length} players. Everyone in the match is in the split.</p>}
      </>}
    </Sheet>
  );
}

function StakeSheet({ onClose }: { onClose: () => void }) {
  const { matches, addStake } = useStore();
  const list = pickableMatches(matches);
  const [match, setMatch] = useState<Match | null>(list[0] ?? null);
  const [label, setLabel] = useState("");
  const ok = match && label.trim();
  const save = () => { if (match) { track(EV.kitty_stake); addStake(newStake(match.id, label)); } onClose(); };
  return (
    <Sheet title="Losers pay" onClose={onClose} footer={<PrimaryButton onClick={save} disabled={!ok}>Add</PrimaryButton>}>
      <Label>Match</Label>
      <MatchPicker matches={list} value={match?.id ?? null} set={setMatch} />
      <Label>What the losers do</Label>
      <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="Losers buy chai" className={field} />
      <div className="mt-3 flex flex-wrap gap-2">{STAKE_IDEAS.map((s) => <Chip key={s} on={label === s} onClick={() => setLabel(s)}>{s}</Chip>)}</div>
      <p className="mt-4 text-sm text-mute">Once the match has a result, the losing side shows up here.</p>
    </Sheet>
  );
}

/** QR for one "X pays Y" row. The payer scans it with their own UPI app; nothing is paid through here. */
function UpiSheet({ t, onClose }: { t: Transfer; onClose: () => void }) {
  const { infos, setInfo, addSettlement } = useStore();
  const info = infos[t.to.trim().toLowerCase()] ?? {};
  const [editing, setEditing] = useState(!info.upi);
  const [v, setV] = useState(info.upi ?? "");
  const ok = validUpi(v);
  if (editing || !info.upi) return (
    <Sheet title={`${t.to}'s UPI ID`} onClose={onClose}
      footer={<PrimaryButton disabled={!ok} onClick={() => { track(EV.kitty_qr_show); setInfo(t.to, { ...info, upi: cleanUpi(v) }); setEditing(false); }}>Save and show QR</PrimaryButton>}>
      <p className="text-[15px] text-fg/85">Add it once and the kitty can show a QR for anyone paying {t.to}.</p>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="name@okaxis" autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false}
        maxLength={60} className={cx(field, "mt-4")} />
      {v.trim() && !ok && <p className="mt-2 text-xs text-out">A UPI ID looks like name@bank.</p>}
      <p className="mt-3 text-xs text-mute">Saved on this phone with {t.to}'s player details.</p>
    </Sheet>
  );
  return (
    <Sheet title={`${t.from} pays ${t.to} ${rs(t.amount)}`} onClose={onClose}
      footer={<PrimaryButton onClick={() => { track(EV.kitty_mark_paid); addSettlement(newSettlement(t.from, t.to, t.amount)); onClose(); }}>Mark paid</PrimaryButton>}>
      <div className="flex justify-center"><QrCode value={upiLink(info.upi, t.to, t.amount)} /></div>
      <p className="mt-4 text-center text-[15px] text-fg">{t.from}, scan this with any UPI app. It asks for exactly <b className="tabular-nums">{rs(t.amount)}</b> to {t.to}.</p>
      <div className="mt-3 flex items-center justify-center gap-2 text-sm">
        <span className="text-mute">{info.upi}</span>
        <button onClick={() => setEditing(true)} className="font-semibold text-sun">Change</button>
      </div>
      <p className="mt-3 text-center text-xs text-mute">The app never sees the money. Mark it paid once it goes through.</p>
    </Sheet>
  );
}

type Del = { kind: "item"; it: HistoryItem } | { kind: "stake"; s: Stake };

export default function Kitty() {
  const { go, kitty, matches, teams, scanKitty, addSettlement, resolveDebt, settleStake, removeKittyItem } = useStore();
  const [sheet, setSheet] = useState<"expense" | "turf" | "stake" | null>(null);
  const [del, setDel] = useState<Del | null>(null);
  const [qr, setQr] = useState<Transfer | null>(null);
  useEffect(() => { scanKitty(); }, [matches, scanKitty]);
  const bal = useMemo(() => balances(kitty.expenses, kitty.settlements), [kitty.expenses, kitty.settlements]);
  const transfers = useMemo(() => settleUp(bal), [bal]);
  const names = useMemo(() => knownNames(teams, matches, kitty), [teams, matches, kitty]);
  const byId = new Map(matches.map((m) => [m.id, m]));
  const where = (id?: string) => { const m = id ? byId.get(id) : undefined; return m ? `${matchTitle(m)}, ${shortDate(m.createdAt)}` : null; };
  const debts = Object.entries(openDebts(kitty.debts));
  const stakes = liveStakes(kitty);
  const items = history(kitty);
  const spent = pot(kitty), count = kitty.expenses.filter((e) => !e.deleted).length;

  const sheets = <>
    {sheet === "expense" && <ExpenseSheet names={names} onClose={() => setSheet(null)} />}
    {sheet === "turf" && <TurfSheet onClose={() => setSheet(null)} />}
    {sheet === "stake" && <StakeSheet onClose={() => setSheet(null)} />}
    {qr && <UpiSheet t={qr} onClose={() => setQr(null)} />}
    {del?.kind === "item" && (del.it.kind === "expense"
      ? <ConfirmSheet title={`Delete ${expenseTitle(del.it.x)}, ${rs(del.it.x.amount)}?`} body="It comes off everyone's balance." yes="Delete" danger
          onYes={() => removeKittyItem("expenses", del.it.x.id)} onClose={() => setDel(null)} />
      : <ConfirmSheet title="Delete this payment?" body={`${del.it.x.from} will owe ${del.it.x.to} ${rs(del.it.x.amount)} again.`} yes="Delete" danger
          onYes={() => removeKittyItem("settlements", del.it.x.id)} onClose={() => setDel(null)} />)}
    {del?.kind === "stake" && <ConfirmSheet title={`Delete "${del.s.label}"?`} yes="Delete" danger
      onYes={() => removeKittyItem("stakes", del.s.id)} onClose={() => setDel(null)} />}
  </>;

  if (isEmpty(kitty)) {
    return (
      <div className="min-h-screen pb-10">
        <Header title="Kitty" back={() => go("home")} />
        <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-6">
          <Card className="text-center">
            <p className="text-4xl">🪙</p>
            <h2 className="mt-3 text-xl font-bold text-fg">Who paid for the ball?</h2>
            <p className="mt-2 text-[15px] text-fg/80">
              Note down what the game costs: balls, tape, the turf, chai after. Say who paid and who it was for, and the kitty works out who owes whom.
            </p>
            <p className="mt-2 text-sm text-mute">It only keeps count. No money moves through the app.</p>
          </Card>
          <PrimaryButton onClick={() => setSheet("expense")}>Add expense</PrimaryButton>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setSheet("turf")} className="press min-h-14 rounded-2xl border-2 border-line font-semibold text-fg">Split turf fee</button>
            <button onClick={() => setSheet("stake")} className="press min-h-14 rounded-2xl border-2 border-line font-semibold text-fg">Losers pay</button>
          </div>
          <p className="pt-2 text-center text-sm text-mute">Balls hit out of the ground in your matches show up here as lost balls.</p>
        </main>
        {sheets}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <Header title="Kitty" back={() => go("home")} />
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <Card>
          <p className="text-sm font-semibold text-teal">Spent on the game</p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums text-fg">{rs(spent)}</p>
          <p className="mt-1 text-sm text-mute">{count} expense{count === 1 ? "" : "s"}, {bal.length} player{bal.length === 1 ? "" : "s"}</p>
        </Card>
        <PrimaryButton onClick={() => setSheet("expense")}>Add expense</PrimaryButton>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setSheet("turf")} className="press min-h-12 rounded-2xl border-2 border-line font-semibold text-fg">Split turf fee</button>
          <button onClick={() => setSheet("stake")} className="press min-h-12 rounded-2xl border-2 border-line font-semibold text-fg">Losers pay</button>
        </div>

        <Section title="Who pays whom">
          <Card className="py-1">
            {transfers.length ? transfers.map((t) => (
              <Row key={`${t.from}>${t.to}`}>
                <p className="flex-1 text-[15px] text-fg"><b>{t.from}</b> pays <b>{t.to}</b> <span className="font-bold tabular-nums">{rs(t.amount)}</span></p>
                <button onClick={() => { if (useStore.getState().infos[t.to.trim().toLowerCase()]?.upi) track(EV.kitty_qr_show); setQr(t); }} className="press min-h-10 shrink-0 rounded-full border border-line px-3 text-sm font-semibold text-fg">Show QR</button>
                <button onClick={() => { track(EV.kitty_mark_paid); addSettlement(newSettlement(t.from, t.to, t.amount)); }}
                  className="press min-h-10 shrink-0 rounded-full border border-sun/70 px-3 text-sm font-semibold text-fg">Mark paid</button>
              </Row>
            )) : <p className="py-3 text-sm text-mute">Everyone is square.</p>}
          </Card>
        </Section>

        {bal.length > 0 && (
          <Section title="Balances">
            <Card className="py-1">
              {bal.map((b) => (
                <Row key={b.name}>
                  <span className="flex-1 font-semibold text-fg">{b.name}</span>
                  <span className={cx("text-sm font-bold tabular-nums", b.net > 0 ? "text-sun" : b.net < 0 ? "text-fg" : "text-mute")}>
                    {b.net > 0 ? `gets ${rs(b.net)}` : b.net < 0 ? `owes ${rs(-b.net)}` : "square"}
                  </span>
                </Row>
              ))}
            </Card>
          </Section>
        )}

        {debts.length > 0 && (
          <Section title="Lost balls">
            <Card className="py-1">
              {debts.map(([player, ds]) => (
                <Row key={player}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-fg">{player} owes {ds.length === 1 ? "a ball" : `${ds.length} balls`}</span>
                    <span className="block truncate text-xs text-mute">{uniqueNames(ds.map((d) => where(d.matchId) ?? "Deleted match")).join("; ")}</span>
                  </span>
                  <button onClick={() => { track(EV.ball_debt_resolve); resolveDebt(ds[ds.length - 1].id); }}
                    className="press min-h-10 shrink-0 rounded-full border border-line px-4 text-sm font-semibold text-fg">Got a new ball</button>
                </Row>
              ))}
            </Card>
          </Section>
        )}

        <Section title="Losers pay" action={<button onClick={() => setSheet("stake")} className="text-sm font-semibold text-sun">Add</button>}>
          <Card className="py-1">
            {stakes.length ? stakes.map((s) => (
              <Row key={s.id}>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-fg">{s.label}</span>
                  <span className="block truncate text-xs text-mute">{where(s.matchId) ?? "Deleted match"}</span>
                  <span className="mt-1 block text-sm text-fg/80">
                    {s.losers === null ? "Waiting for the result" : s.losers.length ? `Losers: ${s.losers.join(", ")}` : "No losers, it was a tie"}
                  </span>
                </span>
                {s.settled ? <span className="text-sm font-semibold text-mute">Settled ✓</span>
                  : s.losers?.length ? <button onClick={() => { track(EV.kitty_settle); settleStake(s.id); }} className="press min-h-10 rounded-full border border-line px-4 text-sm font-semibold text-fg">Settled</button> : null}
                <button onClick={() => setDel({ kind: "stake", s })} aria-label={`Delete ${s.label}`} className="press h-10 w-8 text-mute">✕</button>
              </Row>
            )) : <p className="py-3 text-sm text-mute">Set what the losing side owes, like "Losers buy chai".</p>}
          </Card>
        </Section>

        {items.length > 0 && (
          <Section title="History">
            <Card className="py-1">
              {items.map((it) => (
                <Row key={it.x.id}>
                  <span className="min-w-0 flex-1">
                    {it.kind === "expense" ? <>
                      <span className="block font-semibold text-fg">{expenseTitle(it.x)}</span>
                      <span className="block truncate text-xs text-mute">
                        {it.x.paidBy} paid, {it.x.split.length === 1 ? `for ${it.x.split[0]}` : `split ${it.x.split.length} ways`}, {shortDate(it.x.createdAt)}
                      </span>
                    </> : <>
                      <span className="block font-semibold text-fg">{it.x.from} paid {it.x.to}</span>
                      <span className="block text-xs text-mute">Settled up, {shortDate(it.x.createdAt)}</span>
                    </>}
                  </span>
                  <span className="font-bold tabular-nums text-fg">{rs(it.x.amount)}</span>
                  <button onClick={() => setDel({ kind: "item", it })} aria-label="Delete" className="press h-10 w-8 text-mute">✕</button>
                </Row>
              ))}
            </Card>
          </Section>
        )}
      </main>
      {sheets}
    </div>
  );
}
