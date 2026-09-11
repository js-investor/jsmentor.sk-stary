/**
 * Investičná kalkulačka 3.0 – výpočtový model (čistá funkcia, bez UI).
 *
 * Mesačná simulácia portfólia: počiatočný a mesačný vklad, výnos, udalosti v čase (zmena mesačného vkladu od
 * začiatku daného roka, jednorazový vklad na začiatku daného roka), poplatky (vstupný z každého vloženého eura,
 * ročný z majetku rozložený na mesiace, výkonnostný z kladného mesačného zhodnotenia), daň 19 % zo zisku na konci
 * a inflácia. Dopad poplatkov sa počíta ako rozdiel oproti rovnakému portfóliu bez poplatkov (vrátane ušlého
 * zhodnotenia), dopad udalostí ako rozdiel oproti rovnakému portfóliu bez udalostí.
 */

export type EventKind = "monthly" | "lump";

export type InvEvent = {
  id: string;
  /** monthly = od začiatku daného roka investujem inú sumu mesačne; lump = jednorazový vklad na začiatku roka */
  kind: EventKind;
  /** rok investovania (1 = prvý rok) */
  year: number;
  /** suma € (0 = udalosť sa nepočíta) */
  amount: number;
};

export type NumKey = "initial" | "monthly" | "years" | "rate" | "inflation" | "entryFee" | "annualFee" | "perfFee" | "tax";

export type Inputs = Record<NumKey, number> & { events: InvEvent[] };

/** Sadzba dane z kapitálového výnosu (SR). */
export const TAX_RATE = 0.19;
export const MAX_EVENTS = 6;

export const DEFAULT_INPUTS: Inputs = {
  initial: 5000,
  monthly: 200,
  years: 20,
  rate: 8,
  inflation: 2,
  entryFee: 0,
  annualFee: 0,
  perfFee: 0,
  tax: 0,
  events: [],
};

export const LIMITS: Record<NumKey, { min: number; max: number; step: number }> = {
  initial: { min: 0, max: 1000000, step: 100 },
  monthly: { min: 0, max: 10000, step: 10 },
  years: { min: 1, max: 50, step: 1 },
  rate: { min: 0, max: 20, step: 0.1 },
  inflation: { min: 0, max: 10, step: 0.1 },
  entryFee: { min: 0, max: 10, step: 0.1 },
  annualFee: { min: 0, max: 5, step: 0.05 },
  perfFee: { min: 0, max: 50, step: 1 },
  tax: { min: 0, max: 1, step: 1 },
};

export function sanitize(x: Partial<Inputs>): Inputs {
  const out: Inputs = { ...DEFAULT_INPUTS, events: [] };
  (Object.keys(LIMITS) as NumKey[]).forEach((k) => {
    const n = Number(x[k]);
    const lim = LIMITS[k];
    out[k] = Number.isFinite(n) ? Math.min(lim.max, Math.max(lim.min, n)) : DEFAULT_INPUTS[k];
  });
  out.years = Math.round(out.years);
  out.tax = out.tax >= 0.5 ? 1 : 0;
  out.events = (Array.isArray(x.events) ? x.events : [])
    .map((e, i) => ({
      id: typeof e?.id === "string" && e.id ? e.id : `ev-${i}`,
      kind: e?.kind === "lump" ? ("lump" as const) : ("monthly" as const),
      year: Math.max(1, Math.min(out.years, Math.round(Number(e?.year) || 1))),
      amount: Math.max(0, Math.min(10000000, Number(e?.amount) || 0)),
    }))
    .slice(0, MAX_EVENTS);
  return out;
}

/** Prvý mesiac daného roka investovania (1 = prvý mesiac). */
export const eventMonth = (e: Pick<InvEvent, "year">) => (e.year - 1) * 12 + 1;

type Fees = { entry: number; annual: number; perf: number };

export type Sim = {
  final: number;
  /** hodnota na konci rokov 0..years */
  series: number[];
  /** kumulatívne vložené na konci rokov 0..years */
  invested: number[];
  totalInvested: number;
  entryPaid: number;
  annualPaid: number;
  perfPaid: number;
  /** o koľko viac (alebo menej) sa vložilo kvôli udalostiam */
  eventsInvested: number;
};

export function simulate(d: Inputs, fees: Fees, withEvents: boolean): Sim {
  const r = d.rate / 100 / 12;
  const entry = fees.entry / 100;
  const annualM = fees.annual / 100 / 12;
  const perf = fees.perf / 100;
  const active = withEvents ? d.events.filter((e) => e.amount > 0) : [];
  const changes = active.filter((e) => e.kind === "monthly").sort((a, b) => a.year - b.year);
  const lumps = new Map<number, number>();
  for (const e of active) if (e.kind === "lump") { const m = eventMonth(e); lumps.set(m, (lumps.get(m) ?? 0) + e.amount); }

  let value = d.initial * (1 - entry);
  let entryPaid = d.initial * entry;
  let annualPaid = 0;
  let perfPaid = 0;
  let invested = d.initial;
  let eventsInvested = 0;
  let monthly = d.monthly;
  const series = [value];
  const investedSeries = [invested];

  for (let m = 1; m <= d.years * 12; m++) {
    for (const c of changes) if (eventMonth(c) === m) monthly = c.amount;
    const gain = value * r;
    const pf = gain > 0 ? gain * perf : 0;
    value += gain - pf;
    perfPaid += pf;
    const af = value * annualM;
    value -= af;
    annualPaid += af;
    const lump = lumps.get(m) ?? 0;
    const contrib = monthly + lump;
    value += contrib * (1 - entry);
    entryPaid += contrib * entry;
    invested += contrib;
    eventsInvested += lump + (monthly - d.monthly);
    if (m % 12 === 0) {
      series.push(value);
      investedSeries.push(invested);
    }
  }
  return { final: value, series, invested: investedSeries, totalInvested: invested, entryPaid, annualPaid, perfPaid, eventsInvested };
}

export type Mark = { id: string; kind: EventKind; year: number; amount: number; /** index v ročnej sérii (začiatok roka = koniec predchádzajúceho) */ i: number; value: number };

export type Result = {
  d: Inputs;
  gross: Sim;
  net: Sim;
  /** rovnaké poplatky, bez udalostí */
  base: Sim;
  tax: number;
  finalValue: number;
  realValue: number;
  gain: number;
  gainPct: number;
  investedPct: number;
  costTotal: number;
  costPct: number;
  annualImpact: number;
  hasFees: boolean;
  hasCosts: boolean;
  hasEvents: boolean;
  /** dopad udalostí na výslednú hodnotu po dani */
  eventsDelta: number;
  eventsInvested: number;
  endYear: number;
  marks: Mark[];
};

const taxOn = (d: Inputs, s: Sim) => (d.tax === 1 && s.final - s.totalInvested > 0 ? (s.final - s.totalInvested) * TAX_RATE : 0);

export function compute(inp: Inputs): Result {
  const d = sanitize(inp);
  const fees = { entry: d.entryFee, annual: d.annualFee, perf: d.perfFee };
  const gross = simulate(d, { entry: 0, annual: 0, perf: 0 }, true);
  const withEntry = simulate(d, { entry: d.entryFee, annual: 0, perf: 0 }, true);
  const withAnnual = simulate(d, { entry: d.entryFee, annual: d.annualFee, perf: 0 }, true);
  const net = simulate(d, fees, true);
  const base = simulate(d, fees, false);
  const tax = taxOn(d, net);
  const finalValue = net.final - tax;
  const baseFinal = base.final - taxOn(d, base);
  const gain = finalValue - net.totalInvested;
  const realValue = finalValue / Math.pow(1 + d.inflation / 100, d.years);
  const hasFees = d.entryFee > 0 || d.annualFee > 0 || d.perfFee > 0;
  const hasEvents = d.events.some((e) => e.amount > 0);
  const costTotal = gross.final - finalValue;
  const marks: Mark[] = d.events
    .filter((e) => e.amount > 0)
    .map((e) => ({ id: e.id, kind: e.kind, year: e.year, amount: e.amount, i: e.year - 1, value: net.series[e.year - 1] ?? 0 }));
  return {
    d,
    gross,
    net,
    base,
    tax,
    finalValue,
    realValue,
    gain,
    gainPct: finalValue > 0 ? (gain / finalValue) * 100 : 0,
    investedPct: finalValue > 0 ? Math.min(100, (net.totalInvested / finalValue) * 100) : 100,
    costTotal,
    costPct: gross.final > 0 ? (costTotal / gross.final) * 100 : 0,
    annualImpact: withEntry.final - withAnnual.final,
    hasFees,
    hasCosts: hasFees || tax > 0,
    hasEvents,
    eventsDelta: finalValue - baseFinal,
    eventsInvested: net.eventsInvested,
    endYear: new Date().getFullYear() + d.years,
    marks,
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
