/**
 * Maximálna hypotéka 2.0 – výpočtový model (čistá funkcia, bez UI).
 *
 * Pravidlá NBS: DSTI 60 % z čistého príjmu po odpočítaní životného minima domácnosti, DTI 8× ročného čistého príjmu
 * (nad 40 rokov klesá o 0,25 za každý rok, ak úver presahuje 65. rok veku, najmenej 3×), stres test +2 p. b.
 * Uznaný príjem podľa typu: zamestnanec = čistý príjem; živnostník a spoločník s.r.o. = časť tržieb podľa metodiky
 * konkrétnej banky (orientačné koeficienty, september 2026). Pri rozpätí koeficientov vraciame rozpätie „od – do“.
 */

export type NumKey =
  | "incomeType"
  | "income"
  | "turnover"
  | "taxBase"
  | "freelance"
  | "share"
  | "partner"
  | "partnerIncome"
  | "children"
  | "age"
  | "monthlyDebt"
  | "totalDebt"
  | "creditLimits"
  | "years"
  | "rate";

export type Inputs = Record<NumKey, number>;

/** 0 = zamestnanec, 1 = živnostník (SZČO), 2 = spoločník / konateľ s.r.o. */
export const TYPE_LABEL = ["zamestnanec", "živnostník", "spoločník s.r.o."] as const;

export const DEFAULT_INPUTS: Inputs = {
  incomeType: 0,
  income: 1800,
  turnover: 40000,
  taxBase: 0,
  freelance: 0,
  share: 100,
  partner: 0,
  partnerIncome: 1500,
  children: 0,
  age: 35,
  monthlyDebt: 0,
  totalDebt: 0,
  creditLimits: 0,
  years: 30,
  rate: 3.8,
};

export const LIMITS: Record<NumKey, { min: number; max: number; step: number }> = {
  incomeType: { min: 0, max: 2, step: 1 },
  income: { min: 0, max: 10000, step: 50 },
  turnover: { min: 0, max: 1000000, step: 1000 },
  taxBase: { min: 0, max: 1000000, step: 500 },
  freelance: { min: 0, max: 1, step: 1 },
  share: { min: 1, max: 100, step: 1 },
  partner: { min: 0, max: 1, step: 1 },
  partnerIncome: { min: 0, max: 10000, step: 50 },
  children: { min: 0, max: 6, step: 1 },
  age: { min: 18, max: 75, step: 1 },
  monthlyDebt: { min: 0, max: 5000, step: 10 },
  totalDebt: { min: 0, max: 500000, step: 1000 },
  creditLimits: { min: 0, max: 50000, step: 100 },
  years: { min: 1, max: 40, step: 1 },
  rate: { min: 0.5, max: 15, step: 0.1 },
};

export function sanitize(x: Partial<Inputs>): Inputs {
  const out = { ...DEFAULT_INPUTS };
  (Object.keys(LIMITS) as NumKey[]).forEach((k) => {
    const n = Number(x[k]);
    const lim = LIMITS[k];
    out[k] = Number.isFinite(n) ? Math.min(lim.max, Math.max(lim.min, n)) : DEFAULT_INPUTS[k];
  });
  (["incomeType", "freelance", "partner", "children", "age", "years", "share"] as NumKey[]).forEach((k) => {
    out[k] = Math.round(out[k]);
  });
  return out;
}

/* ------------------------------------------------------------------ NBS */

/** Životné minimum (sumy platné od 1. 7. 2026 do 30. 6. 2027). */
export const ZM = { adult: 295.22, adult2: 205.96, child: 134.8, validFrom: "1. 7. 2026" };
/** Stres test NBS: sadzba vyššia o 2 p. b. */
export const STRESS = 2;

/** Anuitná mesačná splátka. */
export function annuity(P: number, ratePct: number, months: number): number {
  const r = ratePct / 100 / 12;
  if (P <= 0 || months <= 0) return 0;
  return r > 0 ? (P * r) / (1 - Math.pow(1 + r, -months)) : P / months;
}

export type Nbs = {
  /** uznaný príjem žiadateľa + partnera */
  total: number;
  living: number;
  /** najvyššia celková mesačná splátka podľa DSTI */
  maxPayTotal: number;
  obligations: number;
  /** priestor pre splátku novej hypotéky */
  availPay: number;
  dtiLimit: number;
  /** priestor pre nový dlh podľa DTI */
  availDebt: number;
  byDsti: number;
  max: number;
  /** splátka maximálnej hypotéky pri zadanom úroku (bez stresu) */
  payment: number;
  limitedBy: "dsti" | "dti" | "stop";
  /** čo ostane domácnosti po všetkých splátkach pri maximálnej hypotéke */
  leftover: number;
};

export function nbs(monthlyIncome: number, d: Inputs): Nbs {
  const partnerIncome = d.partner === 1 ? d.partnerIncome : 0;
  const total = Math.max(0, monthlyIncome) + partnerIncome;
  const living = ZM.adult + (d.partner === 1 ? ZM.adult2 : 0) + d.children * ZM.child;
  const afterMin = Math.max(0, total - living);
  const maxPayTotal = afterMin * 0.6;
  const obligations = d.monthlyDebt + d.creditLimits * 0.03;
  const availPay = Math.max(0, maxPayTotal - obligations);
  const dtiLimit = d.age > 40 && d.age + d.years > 65 ? Math.max(3, 8 - 0.25 * (d.age - 40)) : 8;
  const availDebt = Math.max(0, total * 12 * dtiLimit - d.totalDebt);
  const n = d.years * 12;
  const rs = (d.rate + STRESS) / 100 / 12;
  const byDsti = rs > 0 ? (availPay * (1 - Math.pow(1 + rs, -n))) / rs : availPay * n;
  const max = Math.max(0, Math.min(byDsti, availDebt));
  const payment = annuity(max, d.rate, n);
  const limitedBy: Nbs["limitedBy"] = availPay <= 0 ? "stop" : byDsti > availDebt ? "dti" : "dsti";
  return { total, living, maxPayTotal, obligations, availPay, dtiLimit, availDebt, byDsti, max, payment, limitedBy, leftover: total - obligations - payment };
}

/* ------------------------------------------------------------------ banky */

export type Range = [number, number];
type Pct = number | Range;
type BankCalc = { range: Range | null; needs?: string };

const isRange = (p: Pct): p is Range => Array.isArray(p);
const times = (base: number, p: Pct): Range => (isRange(p) ? [base * p[0], base * p[1]] : [base * p, base * p]);
const add = (a: Range, b: Range): Range => [a[0] + b[0], a[1] + b[1]];
const scale = (a: Range, k: number): Range => [a[0] * k, a[1] * k];
const capAt = (a: Range, annualCap: number): Range => [Math.min(a[0], annualCap), Math.min(a[1], annualCap)];
/** pásmo: `pct` do sumy `upTo`, `above` z časti nad ňou */
const tiers = (T: number, upTo: number, pct: Pct, above: Pct): Range => add(times(Math.min(T, upTo), pct), times(Math.max(0, T - upTo), above));
/** skok: `pct` z celých tržieb, ak neprevyšujú `upTo`, inak `otherwise` z celých tržieb */
const cliff = (T: number, upTo: number, pct: Pct, otherwise: Pct): Range => (T <= upTo ? times(T, pct) : times(T, otherwise));
const ok = (range: Range): BankCalc => ({ range });
const needs = (text: string): BankCalc => ({ range: null, needs: text });

export type BankDef = {
  id: string;
  name: string;
  /** živnostník: ročné tržby, základ dane − daň (0 = nezadané), slobodné povolanie / komorová činnosť */
  szco: (T: number, Z: number, free: boolean) => BankCalc;
  szcoNote: string;
  /** spoločník s.r.o.: ročné tržby firmy, čistý zisk (0 = nezadané), podiel 0–1 */
  sro: (T: number, P: number, share: number) => BankCalc;
  sroNote: string;
};

/** Orientačné koeficienty uznania príjmu, september 2026. Ročné sumy. */
export const BANKS: BankDef[] = [
  {
    id: "slsp",
    name: "SLSP",
    szco: (T) => ok(tiers(T, 35000, 0.6, [0.2, 0.4])),
    szcoNote: "60 % z tržieb do 35 000 €, zvyšok 20 až 40 % podľa segmentu",
    sro: (T, _P, s) => ok(capAt(scale(tiers(T, 35000, 0.6, [0.2, 0.4]), s), 5000 * 12)),
    sroNote: "60 % do 35 000 €, nad tým 20 až 40 % podľa segmentu, najviac 5 000 € mesačne",
  },
  {
    id: "vub",
    name: "VÚB",
    szco: (T) => ok(cliff(T, 88000, 0.55, 0.12)),
    szcoNote: "55 % z tržieb pri obrate do 88 000 €, pri vyššom obrate 12 %",
    sro: (T, _P, s) => ok(scale(cliff(T, 80000, 0.55, 0.12), s)),
    sroNote: "55 % z tržieb pri obrate do 80 000 €, pri vyššom obrate 12 %",
  },
  {
    id: "365",
    name: "365.bank",
    szco: (T, _Z, free) => ok(free ? times(T, 0.6) : tiers(T, 60000, 0.6, 0.2)),
    szcoNote: "60 % z tržieb do 60 000 €, nad tým 20 %; slobodné povolania 60 % bez limitu",
    sro: (T, _P, s) => ok(scale(times(T, 0.2), s)),
    sroNote: "20 % z tržieb firmy",
  },
  {
    id: "csob",
    name: "ČSOB",
    szco: (T) => ok(tiers(T, 50000, 0.5, 0.4)),
    szcoNote: "50 % z tržieb do 50 000 €, nad tým 40 %; nepočíta zo základu dane",
    sro: (T, _P, s) => ok(scale(tiers(T, 50000, 0.5, 0.3), s)),
    sroNote: "50 % z tržieb do 50 000 €, nad tým 30 %",
  },
  {
    id: "unicredit",
    name: "UniCredit",
    szco: (_T, Z) => (Z > 0 ? ok([Z, Z]) : needs("doplň základ dane − daň")),
    szcoNote: "základ dane po odpočítaní dane; výnimka 50 % tržieb pri mandátnej zmluve pre jedného odberateľa",
    sro: (_T, P, s) => (s < 1 ? needs("len jednoosobové s.r.o.") : P > 0 ? ok(times(P, 0.5)) : needs("doplň čistý zisk firmy")),
    sroNote: "50 % zo zisku po zdanení, len jednoosobové s.r.o.",
  },
  {
    id: "tatra",
    name: "Tatra banka",
    szco: (T, _Z, free) => ok(free ? times(T, [0.2, 0.5]) : times(T, 0.2)),
    szcoNote: "20 % z tržieb, komorové činnosti až 50 %",
    sro: (T, _P, s) => ok(capAt(scale(times(T, [0.2, 0.5]), s), 5500 * 12)),
    sroNote: "20 % z tržieb, podľa odvetvia až 50 %, najviac 5 500 € mesačne",
  },
  {
    id: "mbank",
    name: "mBank",
    szco: (T) => ok(times(T, [0.4, 0.7])),
    szcoNote: "40 až 70 % z tržieb podľa segmentu",
    sro: (_T, P, s) => (P > 0 ? ok(scale(times(P, 1), s)) : needs("doplň čistý zisk firmy")),
    sroNote: "len reálne vyplatený zisk podľa podielu",
  },
  {
    id: "prima",
    name: "Prima banka",
    szco: (T) => ok(times(T, 0.3)),
    szcoNote: "30 % z tržieb",
    sro: (_T, P, s) => (P > 0 ? ok(scale(times(P, 1), s)) : needs("doplň čistý zisk firmy")),
    sroNote: "len zisk firmy podľa podielu",
  },
];

/* ------------------------------------------------------------------ výsledok */

export type BankResult = {
  id: string;
  name: string;
  note: string;
  /** uznaný mesačný príjem */
  income: Range | null;
  /** maximálna hypotéka */
  mortgage: Range | null;
  needs?: string;
};

export type Result = {
  d: Inputs;
  type: number;
  /** zamestnanec: jeden výpočet */
  main: Nbs;
  /** živnostník a s.r.o.: výpočet podľa bánk, zoradený od najvyššej hypotéky */
  banks: BankResult[];
  /** rozpätie uznaného mesačného príjmu a hypotéky naprieč bankami */
  incomeRange: Range | null;
  overall: Range | null;
  /** banky s najvyššou hypotékou */
  best: BankResult[];
  living: number;
  dtiLimit: number;
  stressRate: number;
};

export function compute(inp: Inputs): Result {
  const d = sanitize(inp);
  const main = nbs(d.income, d);
  let banks: BankResult[] = [];
  if (d.incomeType !== 0) {
    banks = BANKS.map((b) => {
      const c = d.incomeType === 1 ? b.szco(d.turnover, d.taxBase, d.freelance === 1) : b.sro(d.turnover, d.taxBase, d.share / 100);
      const note = d.incomeType === 1 ? b.szcoNote : b.sroNote;
      if (!c.range) return { id: b.id, name: b.name, note, income: null, mortgage: null, needs: c.needs };
      const income: Range = [c.range[0] / 12, c.range[1] / 12];
      const mortgage: Range = [nbs(income[0], d).max, nbs(income[1], d).max];
      return { id: b.id, name: b.name, note, income, mortgage };
    }).sort((a, b) => (b.mortgage?.[1] ?? -1) - (a.mortgage?.[1] ?? -1) || (b.mortgage?.[0] ?? -1) - (a.mortgage?.[0] ?? -1));
  }
  const withNum = banks.filter((b) => b.mortgage && b.income);
  const overall: Range | null = withNum.length ? [Math.min(...withNum.map((b) => b.mortgage![0])), Math.max(...withNum.map((b) => b.mortgage![1]))] : null;
  const incomeRange: Range | null = withNum.length ? [Math.min(...withNum.map((b) => b.income![0])), Math.max(...withNum.map((b) => b.income![1]))] : null;
  const topValue = withNum.length ? Math.max(...withNum.map((b) => b.mortgage![1])) : 0;
  const best = withNum.filter((b) => b.mortgage![1] >= topValue - 0.5 && topValue > 0);
  return { d, type: d.incomeType, main, banks, incomeRange, overall, best, living: main.living, dtiLimit: main.dtiLimit, stressRate: d.rate + STRESS };
}
