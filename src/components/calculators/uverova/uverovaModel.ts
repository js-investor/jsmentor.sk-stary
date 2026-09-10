/**
 * Úverová kalkulačka – výpočtový model (čistá funkcia, bez UI).
 * Anuitný úver: suma, úrok, splatnosť → mesačná splátka, preplatenie, RPMN (s poplatkami),
 * rozpis po rokoch a efekt mimoriadnej splátky (koľko mesiacov skôr, koľko ušetríš na úrokoch).
 */

export type Inputs = {
  /** výška úveru € */
  amount: number;
  /** úrok % p. a. */
  rate: number;
  /** splatnosť v rokoch */
  years: number;
  /** jednorazový poplatok za poskytnutie € */
  feeUpfront: number;
  /** mesačný poplatok (vedenie úveru, poistenie) € */
  feeMonthly: number;
  /** mimoriadna splátka navyše každý mesiac € */
  extra: number;
};

export const DEFAULT_INPUTS: Inputs = { amount: 100000, rate: 4, years: 30, feeUpfront: 0, feeMonthly: 0, extra: 0 };

export const LIMITS: Record<keyof Inputs, { min: number; max: number; step: number }> = {
  amount: { min: 500, max: 1000000, step: 500 },
  rate: { min: 0.1, max: 25, step: 0.05 },
  years: { min: 1, max: 40, step: 1 },
  feeUpfront: { min: 0, max: 10000, step: 10 },
  feeMonthly: { min: 0, max: 200, step: 1 },
  extra: { min: 0, max: 2000, step: 10 },
};

export function sanitize(x: Partial<Inputs>): Inputs {
  const out = { ...DEFAULT_INPUTS };
  (Object.keys(LIMITS) as (keyof Inputs)[]).forEach((k) => {
    const v = Number(x[k]);
    out[k] = Number.isFinite(v) ? Math.min(LIMITS[k].max, Math.max(LIMITS[k].min, v)) : DEFAULT_INPUTS[k];
  });
  out.years = Math.round(out.years);
  return out;
}

/** Anuitná mesačná splátka. */
export function annuity(P: number, ratePct: number, months: number): number {
  const r = ratePct / 100 / 12;
  if (P <= 0 || months <= 0) return 0;
  return r > 0 ? (P * r) / (1 - Math.pow(1 + r, -months)) : P / months;
}

export type YearRow = {
  year: number;
  /** zaplatené istiny v roku */
  principal: number;
  /** zaplatené úroky v roku */
  interest: number;
  /** zostatok na konci roka */
  balance: number;
};

export type Schedule = {
  months: number;
  totalInterest: number;
  totalPaid: number;
  rows: YearRow[];
  /** zostatok po mesiacoch 0..months */
  balance: number[];
};

/** Splátkový kalendár; `extra` sa každý mesiac pripočíta k splátke a ide celý do istiny. */
export function schedule(P: number, ratePct: number, payment: number, extra: number, maxMonths: number): Schedule {
  const r = ratePct / 100 / 12;
  let bal = P;
  let totalInterest = 0;
  let totalPaid = 0;
  let m = 0;
  const balance = [bal];
  const rows: YearRow[] = [];
  let yPrincipal = 0;
  let yInterest = 0;
  const cap = Math.max(maxMonths, 1) + 1200; // poistka proti nekonečnu pri nulovej splátke
  while (bal > 0.005 && m < cap) {
    m++;
    const interest = bal * r;
    let pay = payment + extra;
    if (pay > bal + interest) pay = bal + interest; // posledná splátka len do výšky zostatku
    const principal = pay - interest;
    bal -= principal;
    if (bal < 0.005) bal = 0;
    totalInterest += interest;
    totalPaid += pay;
    yPrincipal += principal;
    yInterest += interest;
    balance.push(bal);
    if (m % 12 === 0 || bal === 0) {
      rows.push({ year: Math.ceil(m / 12), principal: yPrincipal, interest: yInterest, balance: bal });
      yPrincipal = 0;
      yInterest = 0;
    }
  }
  return { months: m, totalInterest, totalPaid, rows, balance };
}

/** RPMN: ročná percentuálna miera nákladov z reálnych tokov (čistá suma po poplatku vs. splátky + mesačné poplatky). */
export function rpmn(P: number, feeUpfront: number, monthlyOut: number, months: number): number {
  const net = P - feeUpfront;
  if (net <= 0 || monthlyOut <= 0 || months <= 0) return 0;
  const pv = (i: number) => (i === 0 ? monthlyOut * months : (monthlyOut * (1 - Math.pow(1 + i, -months))) / i);
  let lo = 0;
  let hi = 1; // 100 % mesačne – horná hranica bisekcie
  if (pv(lo) < net) return 0;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > net) lo = mid;
    else hi = mid;
  }
  const i = (lo + hi) / 2;
  return (Math.pow(1 + i, 12) - 1) * 100;
}

export type Result = {
  d: Inputs;
  months: number;
  payment: number;
  /** splátka + mesačný poplatok */
  monthlyOut: number;
  base: Schedule;
  withExtra: Schedule | null;
  totalPaid: number;
  totalInterest: number;
  totalFees: number;
  totalCost: number;
  rpmn: number;
  /** o koľko mesiacov skôr s mimoriadnou splátkou */
  monthsSaved: number;
  /** ušetrené úroky s mimoriadnou splátkou */
  interestSaved: number;
};

export function compute(inp: Inputs): Result {
  const d = sanitize(inp);
  const months = d.years * 12;
  const payment = annuity(d.amount, d.rate, months);
  const base = schedule(d.amount, d.rate, payment, 0, months);
  const withExtra = d.extra > 0 ? schedule(d.amount, d.rate, payment, d.extra, months) : null;
  const totalFees = d.feeUpfront + d.feeMonthly * base.months;
  const totalPaid = base.totalPaid;
  return {
    d,
    months,
    payment,
    monthlyOut: payment + d.feeMonthly,
    base,
    withExtra,
    totalPaid,
    totalInterest: base.totalInterest,
    totalFees,
    totalCost: base.totalInterest + totalFees,
    rpmn: rpmn(d.amount, d.feeUpfront, payment + d.feeMonthly, base.months),
    monthsSaved: withExtra ? base.months - withExtra.months : 0,
    interestSaved: withExtra ? base.totalInterest - withExtra.totalInterest : 0,
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
