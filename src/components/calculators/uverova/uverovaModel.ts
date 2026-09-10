/**
 * Úverová kalkulačka 3.0 – výpočtový model (čistá funkcia, bez UI).
 *
 * Anuitný úver s mesačnou simuláciou: suma, úrok, splatnosť, začiatok splácania, voliteľná zmena úroku po fixácii
 * a jednorazové mimoriadne splátky v konkrétnom roku a mesiaci splácania. Pre mimoriadne splátky sa počítajú oba
 * dôsledky naraz: skrátenie splatnosti (splátka ostáva) aj zníženie splátky (splatnosť ostáva), vždy oproti základnému
 * scenáru bez mimoriadnych splátok.
 */

export type ExtraMode = "term" | "payment";

export type OneTime = {
  id: string;
  /** suma € */
  amount: number;
  /** rok splácania (1 = prvý rok) */
  year: number;
  /** kalendárny mesiac (1–12), prvý výskyt v danom roku splácania */
  month: number;
};

export type Inputs = {
  amount: number;
  rate: number;
  years: number;
  /** začiatok splácania: mesiac 1–12 a rok */
  startMonth: number;
  startYear: number;
  /** dĺžka fixácie v rokoch (0 = bez zmeny úroku) */
  fixYears: number;
  /** úrok po skončení fixácie % p. a. */
  rateAfter: number;
  /** jednorazové mimoriadne splátky */
  oneTimes: OneTime[];
};

const now = new Date();
export const DEFAULT_INPUTS: Inputs = {
  amount: 100000,
  rate: 4,
  years: 30,
  startMonth: ((now.getMonth() + 1) % 12) + 1,
  startYear: now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(),
  fixYears: 0,
  rateAfter: 4,
  oneTimes: [],
};

export type NumKey = "amount" | "rate" | "years" | "startMonth" | "startYear" | "fixYears" | "rateAfter";

export const LIMITS: Record<NumKey, { min: number; max: number; step: number }> = {
  amount: { min: 500, max: 1000000, step: 500 },
  rate: { min: 0.1, max: 25, step: 0.05 },
  years: { min: 1, max: 40, step: 1 },
  startMonth: { min: 1, max: 12, step: 1 },
  startYear: { min: 2000, max: 2100, step: 1 },
  fixYears: { min: 0, max: 30, step: 1 },
  rateAfter: { min: 0.1, max: 25, step: 0.05 },
};

export const MAX_ONE_TIMES = 6;

const clampNum = (k: NumKey, v: unknown, fallback: number) => {
  const n = Number(v);
  const lim = LIMITS[k];
  return Number.isFinite(n) ? Math.min(lim.max, Math.max(lim.min, n)) : fallback;
};

export function sanitize(x: Partial<Inputs>): Inputs {
  const out: Inputs = { ...DEFAULT_INPUTS, oneTimes: [] };
  (Object.keys(LIMITS) as NumKey[]).forEach((k) => {
    out[k] = clampNum(k, x[k], DEFAULT_INPUTS[k]);
  });
  out.years = Math.round(out.years);
  out.startMonth = Math.round(out.startMonth);
  out.startYear = Math.round(out.startYear);
  out.fixYears = Math.round(Math.min(out.fixYears, out.years));
  out.oneTimes = (Array.isArray(x.oneTimes) ? x.oneTimes : [])
    .map((o, i) => ({
      id: typeof o?.id === "string" && o.id ? o.id : `ot-${i}`,
      amount: Math.max(0, Math.min(1000000, Number(o?.amount) || 0)),
      year: Math.max(1, Math.min(out.years, Math.round(Number(o?.year) || 1))),
      month: Math.max(1, Math.min(12, Math.round(Number(o?.month) || 1))),
    }))
    .slice(0, MAX_ONE_TIMES);
  return out;
}

/** Anuitná mesačná splátka. */
export function annuity(P: number, ratePct: number, months: number): number {
  const r = ratePct / 100 / 12;
  if (P <= 0 || months <= 0) return 0;
  return r > 0 ? (P * r) / (1 - Math.pow(1 + r, -months)) : P / months;
}

export type MonthRow = {
  /** poradie mesiaca od 1 */
  m: number;
  /** kalendárny rok a mesiac */
  year: number;
  month: number;
  payment: number;
  interest: number;
  principal: number;
  extra: number;
  balance: number;
  rate: number;
};

export type YearRow = {
  /** poradový rok splácania (1 = prvý) */
  n: number;
  /** kalendárny rok, v ktorom sa tento rok splácania končí */
  calYear: number;
  payment: number;
  interest: number;
  principal: number;
  extra: number;
  balance: number;
  months: MonthRow[];
};

export type Schedule = {
  months: number;
  totalInterest: number;
  totalPaid: number;
  totalExtra: number;
  rows: YearRow[];
  all: MonthRow[];
  /** zostatok po mesiacoch 0..months */
  balance: number[];
  /** splátka po skončení fixácie (ak sa mení), inak null */
  paymentAfterFix: number | null;
  /** posledná bežná splátka (po znížení mimoriadnymi splátkami v režime „znížiť splátku“) */
  paymentEnd: number;
};

export function calMonth(d: Inputs, m: number): { year: number; month: number } {
  if (m <= 0) return { year: d.startYear, month: d.startMonth };
  const idx = d.startMonth - 1 + (m - 1);
  return { year: d.startYear + Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** Poradie mesiaca splácania, v ktorom sa uskutoční jednorazová splátka: prvý výskyt zvoleného kalendárneho mesiaca v danom roku splácania. */
export function oneTimeIndex(d: Inputs, o: Pick<OneTime, "year" | "month">): number {
  const yearStart = (o.year - 1) * 12 + 1;
  const first = calMonth(d, yearStart);
  return yearStart + ((o.month - first.month + 12) % 12);
}

/** Mesačná simulácia; `mode = null` dáva základný scenár bez mimoriadnych splátok. */
export function simulate(d: Inputs, mode: ExtraMode | null): Schedule {
  const N = d.years * 12;
  const fixEnd = d.fixYears > 0 && d.fixYears < d.years ? d.fixYears * 12 : 0;
  let rate = d.rate;
  let payment = annuity(d.amount, rate, N);
  let bal = d.amount;
  let totalInterest = 0;
  let totalPaid = 0;
  let totalExtra = 0;
  let paymentAfterFix: number | null = null;
  const all: MonthRow[] = [];
  const balance = [bal];
  const oneTimeAt = new Map<number, number>();
  if (mode) for (const o of d.oneTimes) { const m = oneTimeIndex(d, o); oneTimeAt.set(m, (oneTimeAt.get(m) ?? 0) + o.amount); }
  const cap = N + 1;
  let m = 0;
  while (bal > 0.005 && m < cap) {
    m++;
    if (fixEnd && m === fixEnd + 1) {
      rate = d.rateAfter;
      payment = annuity(bal, rate, N - fixEnd);
      paymentAfterFix = payment;
    }
    const r = rate / 100 / 12;
    const interest = bal * r;
    const pay = Math.min(payment, bal + interest);
    const principal = pay - interest;
    bal -= principal;
    let extra = 0;
    if (mode && bal > 0.005) {
      extra = Math.min(oneTimeAt.get(m) ?? 0, bal);
      if (extra > 0) {
        bal -= extra;
        totalExtra += extra;
        if (mode === "payment" && bal > 0.005) payment = annuity(bal, rate, N - m);
      }
    }
    if (bal < 0.005) bal = 0;
    totalInterest += interest;
    totalPaid += pay + extra;
    const cm = calMonth(d, m);
    all.push({ m, year: cm.year, month: cm.month, payment: pay, interest, principal, extra, balance: bal, rate });
    balance.push(bal);
  }
  const rows: YearRow[] = [];
  for (let i = 0; i < all.length; i += 12) {
    const chunk = all.slice(i, i + 12);
    const last = chunk[chunk.length - 1];
    rows.push({
      n: i / 12 + 1,
      calYear: last.year,
      payment: chunk.reduce((s, x) => s + x.payment, 0),
      interest: chunk.reduce((s, x) => s + x.interest, 0),
      principal: chunk.reduce((s, x) => s + x.principal, 0),
      extra: chunk.reduce((s, x) => s + x.extra, 0),
      balance: last.balance,
      months: chunk,
    });
  }
  const regular = all.filter((x) => x.balance > 0.005);
  const paymentEnd = regular.length ? regular[regular.length - 1].payment : payment;
  return { months: m, totalInterest, totalPaid, totalExtra, rows, all, balance, paymentAfterFix, paymentEnd };
}

export type Result = {
  d: Inputs;
  payment: number;
  base: Schedule;
  /** scenár „splátka ostáva, úver sa splatí skôr“ (rovný base, ak nie sú mimoriadne splátky) */
  term: Schedule;
  /** scenár „splatnosť ostáva, splátka klesne“ */
  reduced: Schedule;
  hasExtras: boolean;
  /** o koľko mesiacov skôr sa úver splatí (skrátenie splatnosti) */
  monthsSaved: number;
  /** ušetrené úroky pri skrátení splatnosti */
  interestSaved: number;
  /** ušetrené úroky pri znížení splátky */
  interestSavedReduced: number;
  endBase: { year: number; month: number };
  endTerm: { year: number; month: number };
};

export function compute(inp: Inputs): Result {
  const d = sanitize(inp);
  const N = d.years * 12;
  const payment = annuity(d.amount, d.rate, N);
  const base = simulate(d, null);
  const hasExtras = d.oneTimes.some((o) => o.amount > 0);
  const term = hasExtras ? simulate(d, "term") : base;
  const reduced = hasExtras ? simulate(d, "payment") : base;
  return {
    d,
    payment,
    base,
    term,
    reduced,
    hasExtras,
    monthsSaved: base.months - term.months,
    interestSaved: base.totalInterest - term.totalInterest,
    interestSavedReduced: base.totalInterest - reduced.totalInterest,
    endBase: calMonth(d, base.months),
    endTerm: calMonth(d, term.months),
  };
}

/** „Pekný“ krok pre mriežku grafu (1 / 2 / 5 × 10^k). */
export function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const k = rough / pow;
  const s = k < 1.5 ? 1 : k < 3 ? 2 : k < 7 ? 5 : 10;
  return s * pow;
}
