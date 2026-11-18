import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TextInput, View } from "react-native";
import { Check, Coins, Plus, X } from "lucide-react-native";
import type { Match } from "@shared/engine/types";
import {
  balances, matchPlayers, newExpense, newSettlement, newStake, openDebts, settleUp, turfExpense, turfSplit, uniqueNames,
  type ExpenseKind, type Stake, type Transfer,
} from "@shared/kitty";
import QRCode from "react-native-qrcode-svg";
import { cleanUpi, upiLink, validUpi } from "@shared/upi";
import {
  expenseTitle, history, inr, isEmpty, KINDS, knownNames, liveStakes, matchTitle, pickableMatches, pot, shortDate, STAKE_IDEAS, type HistoryItem,
} from "@shared/kittyView";
import { useStore } from "@/lib/store";
import { track } from "@/lib/track";
import { EV } from "@shared/events";
import { Board, C, ConfirmSheet, GhostButton, Header, Num, Page, Press, PrimaryButton, ScoreHero, SectionTitle, Sheet, tw, Txt } from "@/ui/ui";
import { TextField } from "./Teams";

const rs = (n: number) => `₹${inr(n)}`;
const money = (v: string) => v.replace(/\D/g, "").slice(0, 7);

/** Selection chip. Selected is a raised outline with a tick, so lime stays for the one primary action. */
function Chip({ on, children, onPress }: { on?: boolean; children: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityState={{ selected: !!on }}
      style={[tw`min-h-10 flex-row items-center gap-1.5 rounded-full border px-3.5`, { borderColor: on ? C.teal : C.line, backgroundColor: on ? C.raised : "transparent" }]}>
      {on && <Check size={14} color={C.fg} strokeWidth={2.4} />}
      <Txt style={tw`text-[14px] font-medium ${on ? "text-fg" : "text-teal"}`}>{children}</Txt>
    </Press>
  );
}

const Chips = ({ children }: { children: ReactNode }) => <View style={tw`flex-row flex-wrap gap-2`}>{children}</View>;
const Label = ({ children, first }: { children: string; first?: boolean }) => <View style={first ? null : tw`mt-5`}><SectionTitle>{children}</SectionTitle></View>;

/** Small outlined action on a list row. */
function RowAction({ children, onPress }: { children: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} style={tw`min-h-9 rounded-full border border-line px-3.5 items-center justify-center`}>
      <Txt style={tw`text-[13px] font-medium text-fg`}>{children}</Txt>
    </Press>
  );
}

const DeleteBtn = ({ onPress, label }: { onPress: () => void; label: string }) => (
  <Press onPress={onPress} accessibilityLabel={label} style={tw`h-9 w-8 items-center justify-center`}><X size={16} color={C.mute} strokeWidth={2} /></Press>
);

/** Hairline-separated row; the first in a list has no line above it. */
const Row = ({ first, children }: { first: boolean; children: ReactNode }) => (
  <View style={tw`flex-row items-center gap-3 py-3 ${first ? "" : "border-t border-line"}`}>{children}</View>
);

function AmountField({ value, set, label }: { value: string; set: (v: string) => void; label: string }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[tw`flex-row items-center gap-2 rounded-[16px] border bg-panel px-4`, { borderColor: focus ? C.sun : C.line }]}>
      <Txt style={tw`text-[20px] font-semibold text-mute`}>₹</Txt>
      <TextInput value={value} onChangeText={(v) => set(money(v))} keyboardType="number-pad" placeholder="0" accessibilityLabel={label}
        placeholderTextColor={C.mute} selectionColor={C.sun} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={[tw`min-h-14 flex-1 text-[24px]`, { color: C.fg, fontFamily: "Poppins_700Bold" }]} />
    </View>
  );
}

function MatchPicker({ matches, value, set }: { matches: Match[]; value: string | null; set: (m: Match | null) => void }) {
  if (!matches.length) return <Txt style={tw`text-[14px] text-mute`}>No matches yet. Score one first.</Txt>;
  return (
    <Chips>
      {matches.map((m) => <Chip key={m.id} on={value === m.id} onPress={() => set(value === m.id ? null : m)}>{`${matchTitle(m)}, ${shortDate(m.createdAt)}`}</Chip>)}
    </Chips>
  );
}

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
  const ok = amt > 0 && !!paidBy.trim() && split.length > 0 && (what !== "other" || !!label.trim());
  const each = split.length ? Math.floor(amt / split.length) : 0;
  const odd = amt - each * split.length;
  const save = () => { track(EV.kitty_expense, { kind: what, split: split.length }); addExpense(newExpense({ what, label, amount: amt, paidBy, split, matchId: match?.id })); onClose(); };
  return (
    <Sheet title="Add expense" onClose={onClose}
      footer={<PrimaryButton onPress={save} disabled={!ok}>{amt > 0 ? `Add ${rs(amt)}` : "Add expense"}</PrimaryButton>}>
      <Label first>What</Label>
      <Chips>{KINDS.map((k) => <Chip key={k.v} on={what === k.v} onPress={() => setWhat(k.v)}>{k.label}</Chip>)}</Chips>
      <TextField value={label} onChangeText={setLabel} maxLength={30} outline style={tw`mt-3 min-h-12`}
        placeholder={what === "other" ? "What was it? e.g. Stumps" : "Label (optional), e.g. Cosco ball"} />
      <Label>Amount</Label>
      <AmountField value={amount} set={setAmount} label="Amount" />
      <Label>From a match (picks its players)</Label>
      <MatchPicker matches={pickableMatches(matches)} value={match?.id ?? null} set={(m) => { setMatch(m); if (m) setSplit(matchPlayers(m)); }} />
      <Label>Paid by</Label>
      {people.length
        ? <Chips>{people.map((n) => <Chip key={n} on={paidBy === n} onPress={() => setPaidBy(n)}>{n}</Chip>)}</Chips>
        : <Txt style={tw`text-[14px] text-mute`}>Add a name below.</Txt>}
      <View style={tw`mt-5`}>
        <SectionTitle action={
          <View style={tw`flex-row gap-4`}>
            <Press onPress={() => setSplit(people)}><Txt style={tw`text-[13px] font-medium text-fg`}>Everyone</Txt></Press>
            <Press onPress={() => setSplit([])}><Txt style={tw`text-[13px] font-medium text-mute`}>Clear</Txt></Press>
          </View>
        }>{`Split among (${split.length})`}</SectionTitle>
      </View>
      <Chips>{people.map((n) => <Chip key={n} on={has(n)} onPress={() => toggle(n)}>{n}</Chip>)}</Chips>
      <View style={tw`mt-3 flex-row gap-2`}>
        <TextField value={typed} onChangeText={setTyped} placeholder="Someone else" maxLength={20} outline
          onSubmitEditing={addName} submitBehavior="submit" returnKeyType="done" style={tw`min-h-12 flex-1`} />
        <Press onPress={addName} style={tw`min-h-12 rounded-[16px] border border-line bg-panel px-5 items-center justify-center`}>
          <Txt style={tw`font-semibold`}>Add</Txt>
        </Press>
      </View>
      {amt > 0 && split.length > 0 && (
        <Txt style={tw`mt-4 text-[14px] text-mute`}>
          {split.length === 1 ? `${split[0]} owes all of it.` : <><Num style={tw`text-[14px] text-teal`}>{rs(each)}</Num>{` each for ${split.length} players.`}</>}
          {odd > 0 && split.length > 1 ? ` ${paidBy || "The payer"} covers the extra ${rs(odd)}.` : ""}
        </Txt>
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
  const save = () => { if (match) { track(EV.kitty_turf_split); addExpense(turfExpense(amt, match, paidBy)); } onClose(); };
  return (
    <Sheet title="Split the turf fee" onClose={onClose}
      footer={<PrimaryButton onPress={save} disabled={!match || amt <= 0 || !paidBy}>{`Split ${amt > 0 ? rs(amt) : "fee"}`}</PrimaryButton>}>
      <Label first>Match</Label>
      <MatchPicker matches={list} value={match?.id ?? null} set={(m) => { setMatch(m); setPaidBy(""); }} />
      <Label>Turf fee</Label>
      <AmountField value={fee} set={setFee} label="Turf fee" />
      {match && <>
        <Label>Paid by</Label>
        <Chips>{matchPlayers(match).map((n) => <Chip key={n} on={paidBy === n} onPress={() => setPaidBy(n)}>{n}</Chip>)}</Chips>
        {plan && amt > 0 && (
          <Txt style={tw`mt-4 text-[14px] text-mute`}>
            <Num style={tw`text-[14px] text-teal`}>{rs(plan.each)}</Num>{` each for ${plan.players.length} players. Everyone in the match is in the split.`}
          </Txt>
        )}
      </>}
    </Sheet>
  );
}

function StakeSheet({ onClose }: { onClose: () => void }) {
  const { matches, addStake } = useStore();
  const list = pickableMatches(matches);
  const [match, setMatch] = useState<Match | null>(list[0] ?? null);
  const [label, setLabel] = useState("");
  const save = () => { if (match) { track(EV.kitty_stake); addStake(newStake(match.id, label)); } onClose(); };
  return (
    <Sheet title="Losers pay" onClose={onClose} footer={<PrimaryButton onPress={save} disabled={!match || !label.trim()}>Add</PrimaryButton>}>
      <Label first>Match</Label>
      <MatchPicker matches={list} value={match?.id ?? null} set={setMatch} />
      <Label>What the losers do</Label>
      <TextField value={label} onChangeText={setLabel} maxLength={40} placeholder="Losers buy chai" outline style={tw`min-h-12`} />
      <View style={tw`mt-3`}><Chips>{STAKE_IDEAS.map((s) => <Chip key={s} on={label === s} onPress={() => setLabel(s)}>{s}</Chip>)}</Chips></View>
      <Txt style={tw`mt-4 text-[14px] text-mute`}>Once the match has a result, the losing side shows up here.</Txt>
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
  const saveId = () => { if (ok) { track(EV.kitty_qr_show); setInfo(t.to, { ...info, upi: cleanUpi(v) }); setEditing(false); } };
  if (editing || !info.upi) return (
    <Sheet title={`${t.to}'s UPI ID`} onClose={onClose} footer={<PrimaryButton disabled={!ok} onPress={saveId}>Save and show QR</PrimaryButton>}>
      <Txt style={tw`text-[15px] leading-6 text-teal`}>Add it once and the kitty can show a QR for anyone paying {t.to}.</Txt>
      <TextField value={v} onChangeText={setV} placeholder="name@okaxis" autoFocus autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
        maxLength={60} outline onSubmitEditing={saveId} returnKeyType="done" style={tw`mt-4 min-h-12`} />
      {!!v.trim() && !ok && <Txt style={tw`mt-2 text-xs text-out`}>A UPI ID looks like name@bank.</Txt>}
      <Txt style={tw`mt-3 text-xs text-mute`}>Saved on this phone with {t.to}'s player details.</Txt>
    </Sheet>
  );
  return (
    <Sheet title={`${t.from} pays ${t.to} ${rs(t.amount)}`} onClose={onClose}
      footer={<PrimaryButton onPress={() => { track(EV.kitty_mark_paid); addSettlement(newSettlement(t.from, t.to, t.amount)); onClose(); }}>Mark paid</PrimaryButton>}>
      <View style={tw`items-center`}>
        <View style={tw`rounded-[20px] bg-white p-4`}><QRCode value={upiLink(info.upi, t.to, t.amount)} size={220} color="#000" backgroundColor="#fff" ecl="M" /></View>
      </View>
      <Txt style={tw`mt-4 text-center text-[15px] leading-6 text-fg`}>
        {t.from}, scan this with any UPI app. It asks for exactly <Num style={tw`text-[15px]`}>{rs(t.amount)}</Num> to {t.to}.
      </Txt>
      <View style={tw`mt-3 flex-row items-center justify-center gap-3`}>
        <Txt style={tw`text-[13px] text-mute`}>{info.upi}</Txt>
        <Press onPress={() => setEditing(true)} style={tw`min-h-9 justify-center px-1`}><Txt style={tw`text-[13px] font-semibold text-sun`}>Change</Txt></Press>
      </View>
      <Txt style={tw`mt-3 text-center text-xs text-mute`}>The app never sees the money. Mark it paid once it goes through.</Txt>
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
  const where = (id?: string) => { const m = id ? byId.get(id) : undefined; return m ? `${matchTitle(m)}, ${shortDate(m.createdAt)}` : "Deleted match"; };
  const debts = Object.entries(openDebts(kitty.debts));
  const stakes = liveStakes(kitty);
  const items = history(kitty);
  const count = kitty.expenses.filter((e) => !e.deleted).length;

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

  const actions = (
    <View style={tw`gap-2`}>
      <PrimaryButton onPress={() => setSheet("expense")}>Add expense</PrimaryButton>
      <View style={tw`flex-row gap-2`}>
        <View style={tw`flex-1`}><GhostButton onPress={() => setSheet("turf")}>Split turf fee</GhostButton></View>
        <View style={tw`flex-1`}><GhostButton onPress={() => setSheet("stake")}>Losers pay</GhostButton></View>
      </View>
    </View>
  );

  if (isEmpty(kitty)) {
    return (
      <Page>
        <Header title="Kitty" back={() => go("home")} />
        <View style={tw`px-4 pt-6 gap-6`}>
          <View style={tw`items-center px-2`}>
            <View style={tw`h-16 w-16 rounded-full border border-line bg-panel items-center justify-center`}><Coins size={26} color={C.fg} strokeWidth={2} /></View>
            <Txt style={tw`mt-5 text-[22px] font-semibold text-center`}>Who paid for the ball?</Txt>
            <Txt style={tw`mt-2 text-[15px] leading-6 text-teal text-center`}>
              Note down what the game costs: balls, tape, the turf, chai after. Say who paid and who it was for, and the kitty works out who owes whom.
            </Txt>
            <Txt style={tw`mt-2 text-[13px] text-mute text-center`}>It only keeps count. No money moves through the app.</Txt>
          </View>
          {actions}
          <Txt style={tw`text-[13px] text-mute text-center`}>Balls hit out of the ground in your matches show up here as lost balls.</Txt>
        </View>
        {sheets}
      </Page>
    );
  }

  return (
    <Page>
      <Header title="Kitty" back={() => go("home")} />
      <View style={tw`px-4 pt-2 gap-6`}>
        <ScoreHero>
          <Txt style={tw`text-[12px] font-medium text-mute`}>Spent on the game</Txt>
          <View style={tw`mt-2 flex-row items-end gap-1.5`}>
            <Txt style={tw`mb-1.5 text-[22px] font-semibold text-teal`}>₹</Txt>
            <Board style={{ fontSize: 50, lineHeight: 56 }} numberOfLines={1} adjustsFontSizeToFit>{inr(pot(kitty))}</Board>
          </View>
          <Txt style={tw`mt-1 text-[13px] text-teal`}>
            <Num style={tw`text-[13px] text-teal`}>{count}</Num>{` expense${count === 1 ? "" : "s"}, `}
            <Num style={tw`text-[13px] text-teal`}>{bal.length}</Num>{` player${bal.length === 1 ? "" : "s"}`}
          </Txt>
        </ScoreHero>
        {actions}

        <View>
          <SectionTitle>Who pays whom</SectionTitle>
          {transfers.length ? transfers.map((t, i) => (
            <Row key={`${t.from}>${t.to}`} first={i === 0}>
              <View style={tw`flex-1 min-w-0`}>
                <Txt style={tw`text-[15px] text-teal`} numberOfLines={1}><Txt style={tw`font-semibold text-fg`}>{t.from}</Txt>{" pays "}<Txt style={tw`font-semibold text-fg`}>{t.to}</Txt></Txt>
                <Num style={tw`mt-0.5 text-[16px]`}>{rs(t.amount)}</Num>
              </View>
              <RowAction onPress={() => { if (useStore.getState().infos[t.to.trim().toLowerCase()]?.upi) track(EV.kitty_qr_show); setQr(t); }}>Show QR</RowAction>
              <RowAction onPress={() => { track(EV.kitty_mark_paid); addSettlement(newSettlement(t.from, t.to, t.amount)); }}>Mark paid</RowAction>
            </Row>
          )) : <Txt style={tw`py-2 text-[14px] text-mute`}>Everyone is square.</Txt>}
        </View>

        {bal.length > 0 && (
          <View>
            <SectionTitle>Balances</SectionTitle>
            {bal.map((b, i) => (
              <Row key={b.name} first={i === 0}>
                <Txt style={tw`flex-1 text-[15px] font-medium`} numberOfLines={1}>{b.name}</Txt>
                <Txt style={tw`text-[12px] text-mute`}>{b.net > 0 ? "gets back" : b.net < 0 ? "owes" : "square"}</Txt>
                {b.net !== 0 && <Num style={tw`w-20 text-right text-[16px] ${b.net > 0 ? "text-sun" : "text-fg"}`}>{rs(Math.abs(b.net))}</Num>}
              </Row>
            ))}
          </View>
        )}

        {debts.length > 0 && (
          <View>
            <SectionTitle>Lost balls</SectionTitle>
            {debts.map(([player, ds], i) => (
              <Row key={player} first={i === 0}>
                <View style={tw`flex-1 min-w-0`}>
                  <Txt style={tw`text-[15px] font-medium`} numberOfLines={1}>
                    {`${player} owes `}{ds.length === 1 ? "a ball" : <><Num style={tw`text-[15px]`}>{ds.length}</Num>{" balls"}</>}
                  </Txt>
                  <Txt style={tw`text-xs text-mute`} numberOfLines={1}>{uniqueNames(ds.map((d) => where(d.matchId))).join("; ")}</Txt>
                </View>
                <RowAction onPress={() => { track(EV.ball_debt_resolve); resolveDebt(ds[ds.length - 1].id); }}>Got a new ball</RowAction>
              </Row>
            ))}
          </View>
        )}

        <View>
          <SectionTitle action={
            <Press onPress={() => setSheet("stake")} accessibilityLabel="Add what the losers pay" style={tw`flex-row items-center gap-1`}>
              <Plus size={15} color={C.fg} strokeWidth={2.2} /><Txt style={tw`text-[13px] font-medium`}>Add</Txt>
            </Press>
          }>Losers pay</SectionTitle>
          {stakes.length ? stakes.map((s, i) => (
            <Row key={s.id} first={i === 0}>
              <View style={tw`flex-1 min-w-0`}>
                <Txt style={tw`text-[15px] font-medium`}>{s.label}</Txt>
                <Txt style={tw`text-xs text-mute`} numberOfLines={1}>{where(s.matchId)}</Txt>
                <Txt style={tw`mt-1 text-[13px] text-teal`}>
                  {s.losers === null ? "Waiting for the result" : s.losers.length ? `Losers: ${s.losers.join(", ")}` : "No losers, it was a tie"}
                </Txt>
              </View>
              {s.settled
                ? <View style={tw`flex-row items-center gap-1`}><Check size={14} color={C.mute} strokeWidth={2.4} /><Txt style={tw`text-[13px] text-mute`}>Settled</Txt></View>
                : s.losers?.length ? <RowAction onPress={() => { track(EV.kitty_settle); settleStake(s.id); }}>Settled</RowAction> : null}
              <DeleteBtn onPress={() => setDel({ kind: "stake", s })} label={`Delete ${s.label}`} />
            </Row>
          )) : <Txt style={tw`py-2 text-[14px] text-mute`}>Set what the losing side owes, like "Losers buy chai".</Txt>}
        </View>

        {items.length > 0 && (
          <View>
            <SectionTitle>History</SectionTitle>
            {items.map((it, i) => (
              <Row key={it.x.id} first={i === 0}>
                <View style={tw`flex-1 min-w-0`}>
                  {it.kind === "expense" ? <>
                    <Txt style={tw`text-[15px] font-medium`} numberOfLines={1}>{expenseTitle(it.x)}</Txt>
                    <Txt style={tw`text-xs text-mute`} numberOfLines={1}>
                      {`${it.x.paidBy} paid, ${it.x.split.length === 1 ? `for ${it.x.split[0]}` : `split ${it.x.split.length} ways`}, ${shortDate(it.x.createdAt)}`}
                    </Txt>
                  </> : <>
                    <Txt style={tw`text-[15px] font-medium`} numberOfLines={1}>{`${it.x.from} paid ${it.x.to}`}</Txt>
                    <Txt style={tw`text-xs text-mute`}>{`Settled up, ${shortDate(it.x.createdAt)}`}</Txt>
                  </>}
                </View>
                <Num style={tw`text-[16px]`}>{rs(it.x.amount)}</Num>
                <DeleteBtn onPress={() => setDel({ kind: "item", it })} label="Delete" />
              </Row>
            ))}
          </View>
        )}
      </View>
      {sheets}
    </Page>
  );
}
