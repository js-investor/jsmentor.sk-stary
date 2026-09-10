/**
 * Úverová kalkulačka 2.0 – výpočtový model (čistá funkcia, bez UI).
 *
 * Anuitný úver s mesačnou simuláciou: suma, úrok, splatnosť, začiatok splácania, voliteľná zmena úroku po fixácii,
 * mimoriadne splátky (mesačne navyše, raz ročne v zvolenom mesiaci, jednorazové v konkrétnom roku a mesiaci),
 * režim mimoriadnych splátok (skrátiť splatnosť alebo znížiť splátku), poplatky (poskytnutie, mesačný, % z mimoriadnej
 * splátky) a RPMN z reálnych peňažných tokov. Vždy sa počíta aj základný scenár bez mimoriadnych splátok na porovnanie.
 */

export type ExtraMode = "term" | "payment";

export type OneTime = {
  id: string;
  /** suma € */
  amount: number;
  /** rok splácania (1 = prvý rok) */
  year: number;
  /** mesiac v roku (1–12) */
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
  /** mimoriadna splátka navyše každý mesiac € */
  extraMonthly: number;
  /** mimoriadna splátka raz ročne € */
  extraYearly: number;
  /** mesiac ročnej mimoriadnej splátky (1–12) */
  extraYearlyMonth: number;
  /** jednorazové mimoriadne splátky */
  oneTimes: OneTime[];
  /** čo urobí mimoriadna splátka: skráti splatnosť alebo zníži splátku */
  extraMode: ExtraMode;
  /** poplatok za poskytnutie € */
  feeUpfront: number;
  /** mesačný poplatok € */
  feeMonthly: number;
  /** poplatok z mimoriadnej splátky % */
  feeExtraPct: number;
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
  extraMonthly: 0,
  extraYearly: 0,
  extraYearlyMonth: 12,
  oneTimes: [],
  extraMode: "term",
  feeUpfront: 0,
  feeMonthly: 0,
  feeExtraPct: 0,
};

export type NumKey = "amount" | "rate" | "years" | "startMonth" | "startYear" | "fixYears" | "rateAfter" | "extraMonthly" | "extraYearly" | "extraYearlyMonth" | "feeUpfront" | "feeMonthly" | "feeExtraPct";

export const LIMITS: Record<NumKey, { min: number; max: number; step: number }> = {
  amount: { min: 500, max: 1000000, step: 500 },
  rate: { min: 0.1, max: 25, step: 0.05 },
  years: { min: 1, max: 40, step: 1 },
  startMonth: { min: 1, max: 12, step: 1 },
  startYear: { min: 2000, max: 2100, step: 1 },
  fixYears: { min: 0, max: 30, step: 1 },
  rateAfter: { min: 0.1, max: 25, step: 0.05 },
  extraMonthly: { min: 0, max: 5000, step: 10 },
  extraYearly: { min: 0, max: 100000, step: 100 },
  extraYearlyMonth: { min: 1, max: 12, step: 1 },
  feeUpfront: { min: 0, max: 20000, step: 10 },
  feeMonthly: { min: 0, max: 200, step: 1 },
  feeExtraPct: { min: 0, max: 5, step: 0.1 },
};

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
  out.extraYearlyMonth = Math.round(out.extraYearlyMonth);
  out.extraMode = x.extraMode === "payment" ? "payment" : "term";
  out.oneTimes = (Array.isArray(x.oneTimes) ? x.oneTimes : [])
    .map((o, i) => ({
      id: typeof o?.id === "string" && o.id ? o.id : `ot-${i}`,
      amount: Math.max(0, Math.min(1000000, Number(o?.amount) || 0)),
      year: Math.max(1, Math.min(out.years, Math.round(Number(o?.year) || 1))),
      month: Math.max(1, Math.min(12, Math.round(Number(o?.month) || 1))),
    }))
    .slice(0, 12);
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
  totalExtraFees: number;
  rows: YearRow[];
  all: MonthRow[];
  /** zostatok po mesiacoch 0..months */
  balance: number[];
  /** splátka po skončení fixácie (ak sa mení), inak null */
  paymentAfterFix: number | null;
  /** posledná bežná splátka (po znížení mimoriadnymi splátkami v režime „znížiť splátku“) */
  paymentEnd: number;
};

function calMonth(d: Inputs, m: number): { year: number; month: number } {
  const idx = d.startMonth - 1 + (m - 1);
  return { year: d.startYear + Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** Mesačná simulácia; `withExtras = false` dáva základný scenár bez mimoriadnych splátok. */
export function simulate(d: Inputs, withExtras: boolean): Schedule {
  const N = d.years * 12;
  const fixEnd = d.fixYears > 0 && d.fixYears < d.years ? d.fixYears * 12 : 0;
  let rate = d.rate;
  let payment = annuity(d.amount, rate, N);
  let bal = d.amount;
  let totalInterest = 0;
  let totalPaid = 0;
  let totalExtra = 0;
  let totalExtraFees = 0;
  let paymentAfterFix: number | null = null;
  const all: MonthRow[] = [];
  const balance = [bal];
  const oneTimeAt = new Map<number, number>();
  if (withExtras) for (const o of d.oneTimes) { const m = (o.year - 1) * 12 + o.month; oneTimeAt.set(m, (oneTimeAt.get(m) ?? 0) + o.amount); }
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
    let principal = pay - interest;
    bal -= principal;
    let extra = 0;
    if (withExtras && bal > 0.005) {
      const cm = calMonth(d, m);
      extra += d.extraMonthly;
      if (d.extraYearly > 0 && cm.month === d.extraYearlyMonth) extra += d.extraYearly;
      extra += oneTimeAt.get(m) ?? 0;
      extra = Math.min(extra, bal);
      if (extra > 0) {
        bal -= extra;
        totalExtra += extra;
        totalExtraFees += extra * (d.feeExtraPct / 100);
        if (d.extraMode === "payment" && bal > 0.005) payment = annuity(bal, rate, N - m);
      }
    }
    if (bal < 0.005) bal = 0;
    totalInterest += interest;
    totalPaid += pay + extra;
    principal = pay - interest;
    const cm = calMonth(d, m);
    all.push({ m, year: cm.year, month: cm.month, payment: pay, interest, principal, extra, balance: bal, rate });
    balance.push(bal);
    // v režime „znížiť splátku“ bez mimoriadnych splátok sa splátka nemení; posledná splátka býva nižšia
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
  return { months: m, totalInterest, totalPaid, totalExtra, totalExtraFees, rows, all, balance, paymentAfterFix, paymentEnd };
}

/** RPMN z tokov: čistá suma po poplatku vs. mesačné odlivy (splátka + mimoriadna + poplatky). */
export function rpmnFromFlows(net: number, outflows: number[]): number {
  if (net <= 0 || !outflows.length) return 0;
  const pv = (i: number) => outflows.reduce((s, c, k) => s + c / Math.pow(1 + i, k + 1), 0);
  if (pv(0) <= net) return 0;
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > net) lo = mid;
    else hi = mid;
  }
  return (Math.pow(1 + (lo + hi) / 2, 12) - 1) * 100;
}

export type Result = {
  d: Inputs;
  payment: number;
  monthlyOut: number;
  base: Schedule;
  extras: Schedule;
  hasExtras: boolean;
  /** celkové poplatky v scenári s mimoriadnymi splátkami */
  totalFees: number;
  rpmn: number;
  rpmnBase: number;
  monthsSaved: number;
  interestSaved: number;
  /** dátum poslednej splátky (základ / s mimoriadnymi) */
  endBase: { year: number; month: number };
  endExtras: { year: number; month: number };
  /** citlivosť na úrok: splátka a úroky pri iných sadzbách */
  sensitivity: { rate: number; payment: number; interest: number }[];
};

export function compute(inp: Inputs): Result {
  const d = sanitize(inp);
  const N = d.years * 12;
  const payment = annuity(d.amount, d.rate, N);
  const base = simulate(d, false);
  const hasExtras = d.extraMonthly > 0 || d.extraYearly > 0 || d.oneTimes.some((o) => o.amount > 0);
  const extras = hasExtras ? simulate(d, true) : base;
  const feesBase = d.feeUpfront + d.feeMonthly * base.months;
  const totalFees = d.feeUpfront + d.feeMonthly * extras.months + extras.totalExtraFees;
  const flows = (s: Schedule) => s.all.map((x) => x.payment + x.extra + d.feeMonthly + x.extra * (d.feeExtraPct / 100));
  const rpmnBase = rpmnFromFlows(d.amount - d.feeUpfront, flows(base));
  const rpmn = hasExtras ? rpmnFromFlows(d.amount - d.feeUpfront, flows(extras)) : rpmnBase;
  const sens = [-1, -0.5, 0, 0.5, 1]
    .map((delta) => Math.round((d.rate + delta) * 100) / 100)
    .filter((r) => r >= LIMITS.rate.min && r <= LIMITS.rate.max)
    .map((r) => {
      const p = annuity(d.amount, r, N);
      return { rate: r, payment: p, interest: p * N - d.amount };
    });
  return {
    d,
    payment,
    monthlyOut: payment + d.feeMonthly,
    base,
    extras,
    hasExtras,
    totalFees: hasExtras ? totalFees : feesBase,
    rpmn,
    rpmnBase,
    monthsSaved: base.months - extras.months,
    interestSaved: base.totalInterest - extras.totalInterest,
    endBase: calMonth(d, base.months),
    endExtras: calMonth(d, extras.months),
    sensitivity: sens,
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
