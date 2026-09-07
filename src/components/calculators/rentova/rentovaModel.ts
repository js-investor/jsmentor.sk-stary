/**
 * Rentová kalkulačka 2.0 – výpočtový model (čistá funkcia, bez UI).
 *
 * Fáza sporenia: mesačné zhodnotenie portfólia, vklad na konci mesiaca. Voliteľne investičný byt:
 * hodnota rastie zvoleným tempom, hypotéka sa spláca anuitne, nájom rastie 3 % ročne, náklady 2 % ročne.
 * Cashflow bytu (nájom − náklady − splátka) sa investuje do portfólia, ale len keď je kladný.
 * Pri odchode do renty sa byt predá (hodnota − zostatok hypotéky) a výnos sa pripočíta ku kapitálu.
 *
 * Fáza renty: tri spôsoby čerpania (dočerpanie do cieľového veku, večná renta z reálneho výnosu,
 * pravidlo 4 %). Renta je valorizovaná o infláciu; sumy „v dnešných €“ sú deflované na dnešnú kúpnu silu.
 */

export type Strategy = "drawdown" | "perpetual" | "rule4";
export const STRATEGIES: Strategy[] = ["drawdown", "perpetual", "rule4"];

export type Inputs = {
  currentAge: number;
  retirementAge: number;
  endAge: number;
  currentSavings: number;
  monthlyInvestment: number;
  growthRate: number;
  desiredRent: number;
  otherIncome: number;
  rentRate: number;
  inflation: number;
  /** 1 = má investičný byt, 0 = nemá */
  hasFlat: number;
  flatValue: number;
  flatLoan: number;
  flatRate: number;
  flatYears: number;
  flatGrowth: number;
  flatCosts: number;
  flatRent: number;
};

/** Rast nákladov na byt (% ročne) – pevný predpoklad. */
export const COSTS_GROWTH = 2;
/** Rast nájmu (% ročne) – pevný predpoklad. */
export const RENT_GROWTH = 3;
const RULE4 = 0.04;

export const DEFAULT_INPUTS: Inputs = {
  currentAge: 35,
  retirementAge: 60,
  endAge: 90,
  currentSavings: 10000,
  monthlyInvestment: 300,
  growthRate: 7,
  desiredRent: 1500,
  otherIncome: 0,
  rentRate: 5,
  inflation: 2.5,
  hasFlat: 0,
  flatValue: 150000,
  flatLoan: 90000,
  flatRate: 3.8,
  flatYears: 25,
  flatGrowth: 3,
  flatCosts: 150,
  flatRent: 650,
};

export const LIMITS: Record<keyof Inputs, { min: number; max: number; step: number }> = {
  currentAge: { min: 18, max: 70, step: 1 },
  retirementAge: { min: 40, max: 80, step: 1 },
  endAge: { min: 70, max: 100, step: 1 },
  currentSavings: { min: 0, max: 1000000, step: 1000 },
  monthlyInvestment: { min: 0, max: 3000, step: 10 },
  growthRate: { min: 0, max: 12, step: 0.1 },
  desiredRent: { min: 0, max: 10000, step: 50 },
  otherIncome: { min: 0, max: 5000, step: 50 },
  rentRate: { min: 0, max: 10, step: 0.1 },
  inflation: { min: 0, max: 6, step: 0.1 },
  hasFlat: { min: 0, max: 1, step: 1 },
  flatValue: { min: 30000, max: 1000000, step: 5000 },
  flatLoan: { min: 0, max: 800000, step: 1000 },
  flatRate: { min: 0.5, max: 8, step: 0.05 },
  flatYears: { min: 1, max: 40, step: 1 },
  flatGrowth: { min: 0, max: 8, step: 0.1 },
  flatCosts: { min: 0, max: 1500, step: 10 },
  flatRent: { min: 0, max: 4000, step: 10 },
};

/** Orezanie na limity + logické vzťahy vekov (renta až po dnešnom veku, koniec po začiatku). */
export function sanitize(x: Partial<Inputs>): Inputs {
  const out = { ...DEFAULT_INPUTS } as Inputs;
  (Object.keys(LIMITS) as (keyof Inputs)[]).forEach((k) => {
    const v = Number(x[k]);
    const lim = LIMITS[k];
    out[k] = Number.isFinite(v) ? Math.min(lim.max, Math.max(lim.min, v)) : DEFAULT_INPUTS[k];
  });
  out.currentAge = Math.round(out.currentAge);
  out.retirementAge = Math.round(Math.max(out.currentAge + 1, out.retirementAge));
  out.endAge = Math.round(Math.max(out.retirementAge + 1, out.endAge));
  out.flatYears = Math.round(out.flatYears);
  out.hasFlat = out.hasFlat >= 0.5 ? 1 : 0;
  return out;
}

/** Anuitná mesačná splátka. */
export function mortgagePayment(P: number, ratePct: number, years: number): number {
  const n = Math.max(1, Math.round(years * 12));
  const r = ratePct / 100 / 12;
  if (P <= 0) return 0;
  return r > 0 ? (P * r) / (1 - Math.pow(1 + r, -n)) : P / n;
}

type Accumulation = {
  n: number;
  /** portfólio po mesiacoch 0..n (nominálne) */
  portfolio: number[];
  /** vlastné vklady kumulatívne po mesiacoch 0..n */
  invested: number[];
  /** hodnota bytu po mesiacoch 0..n (0 bez bytu) */
  flatVal: number[];
  /** zostatok hypotéky k bytu po mesiacoch 0..n */
  flatDebt: number[];
  /** majetok spolu: portfólio + čistá hodnota bytu */
  wealth: number[];
  /** kladný cashflow bytu investovaný do portfólia spolu */
  cfInvested: number;
  /** mesačná splátka hypotéky k bytu */
  payment: number;
  /** mesiac splatenia hypotéky (−1 = nesplatená do konca sporenia alebo bez hypotéky) */
  payoffM: number;
  /** čistý výnos z predaja bytu na konci sporenia */
  proceeds: number;
  /** kapitál na začiatku renty = portfólio + výnos z predaja */
  C: number;
};

/** Sporenie od dnešného veku do veku `toAge` (vrátane predaja bytu na konci). */
export function accumulate(d: Inputs, toAge: number): Accumulation {
  const years = Math.max(0, toAge - d.currentAge);
  const n = years * 12;
  const gm = d.growthRate / 100 / 12;
  const hasFlat = d.hasFlat === 1;
  const hasLoan = hasFlat && d.flatLoan > 0;
  const payment = hasLoan ? mortgagePayment(d.flatLoan, d.flatRate, d.flatYears) : 0;
  const rm = d.flatRate / 100 / 12;
  const loanMonths = d.flatYears * 12;
  const gv = Math.pow(1 + d.flatGrowth / 100, 1 / 12);

  let portfolio = d.currentSavings;
  let invested = d.currentSavings;
  let value = hasFlat ? d.flatValue : 0;
  let debt = hasLoan ? d.flatLoan : 0;
  let cfInvested = 0;
  let payoffM = -1;

  const P = [portfolio];
  const I = [invested];
  const V = [value];
  const D = [debt];
  const W = [portfolio + Math.max(0, value - debt)];

  for (let m = 1; m <= n; m++) {
    let cf = 0;
    if (hasFlat) {
      value = d.flatValue * Math.pow(gv, m);
      let pay = 0;
      if (debt > 0 && m <= loanMonths) {
        pay = payment;
        debt = debt * (1 + rm) - payment;
        if (debt < 0.005) {
          debt = 0;
          payoffM = m;
        }
      }
      const yr = Math.floor((m - 1) / 12);
      const rent = d.flatRent * Math.pow(1 + RENT_GROWTH / 100, yr);
      const costs = d.flatCosts * Math.pow(1 + COSTS_GROWTH / 100, yr);
      cf = rent - costs - pay;
      if (cf < 0) cf = 0; // záporný cashflow sa do majetku nepočíta (kryješ ho z príjmu)
      cfInvested += cf;
    }
    portfolio = portfolio * (1 + gm) + d.monthlyInvestment + cf;
    invested += d.monthlyInvestment;
    P.push(portfolio);
    I.push(invested);
    V.push(value);
    D.push(debt);
    W.push(portfolio + Math.max(0, value - debt));
  }

  const proceeds = hasFlat ? Math.max(0, value - debt) : 0;
  return { n, portfolio: P, invested: I, flatVal: V, flatDebt: D, wealth: W, cfInvested, payment, payoffM, proceeds, C: portfolio + proceeds };
}

/** Mesačné sadzby počas renty: nominálna, inflačná a reálna. */
function rentRates(d: Inputs) {
  const rm = d.rentRate / 100 / 12;
  const im = Math.pow(1 + d.inflation / 100, 1 / 12) - 1;
  const mr = (1 + rm) / (1 + im) - 1;
  return { rm, im, mr };
}

/** Mesačná renta (nominálna, prvý rok) z kapitálu `C` pri danej stratégii; `from` = vek začiatku renty. */
export function incomeFor(s: Strategy, C: number, d: Inputs, from = d.retirementAge): number {
  const { mr } = rentRates(d);
  const M = Math.max(1, (d.endAge - from) * 12);
  if (C <= 0) return 0;
  if (s === "drawdown") return Math.abs(mr) < 1e-12 ? C / M : (C * mr) / (1 - Math.pow(1 + mr, -M));
  if (s === "perpetual") return mr > 0 ? C * mr : 0;
  return (C * RULE4) / 12;
}

/** Kapitál potrebný na nominálnu mesačnú rentu `target` pri danej stratégii. */
export function requiredFor(s: Strategy, target: number, d: Inputs, from = d.retirementAge): number {
  const { mr } = rentRates(d);
  const M = Math.max(1, (d.endAge - from) * 12);
  if (target <= 0) return 0;
  if (s === "drawdown") return Math.abs(mr) < 1e-12 ? target * M : (target * (1 - Math.pow(1 + mr, -M))) / mr;
  if (s === "perpetual") return mr > 0 ? target / mr : Infinity;
  return (target * 12) / RULE4;
}

export type Drawdown = {
  /** kapitál na konci každého roka renty */
  capitalSeries: number[];
  /** vyplatená renta v každom roku (nominálne) */
  paidSeries: number[];
  endCapital: number;
  runsOutAge: number | null;
};

/** Čerpanie renty od veku začiatku po koncový vek; renta valorizovaná mesačne o infláciu. */
export function drawdown(C: number, income0: number, d: Inputs): Drawdown {
  const { rm, im } = rentRates(d);
  let capital = C;
  let withdraw = income0;
  let runsOutAge: number | null = null;
  const capitalSeries: number[] = [];
  const paidSeries: number[] = [];
  for (let y = 0; y < d.endAge - d.retirementAge; y++) {
    const age = d.retirementAge + y + 1;
    let paid = 0;
    for (let m = 0; m < 12; m++) {
      withdraw *= 1 + im;
      capital *= 1 + rm;
      const w = Math.min(withdraw, Math.max(0, capital));
      capital -= w;
      paid += w;
      if (capital <= 0.5 && runsOutAge === null) runsOutAge = age;
    }
    capital = Math.max(0, capital);
    capitalSeries.push(capital);
    paidSeries.push(paid);
  }
  return { capitalSeries, paidSeries, endCapital: capital, runsOutAge };
}

export type StrategyResult = {
  incomeNominal: number;
  incomeToday: number;
  sim: Drawdown;
};

export type Result = {
  d: Inputs;
  /** rokov sporenia */
  N: number;
  /** rokov renty */
  duration: number;
  acc: Accumulation;
  C: number;
  deflator: number;
  results: Record<Strategy, StrategyResult>;
  sel: StrategyResult;
  /** cieľová renta z majetku v dnešných € (cieľ − iný príjem) */
  targetToday: number;
  required: number;
  gap: number;
  totalIncomeToday: number;
  goalPct: number;
  incomeGapToday: number;
  requiredMonthly: number | null;
  goalAge: number | null;
  /** cashflow bytu dnes: nájom − náklady − splátka */
  cashflowToday: number;
  /** vek splatenia hypotéky k bytu (null = nesplatená do renty) */
  payoffAge: number | null;
  /** ročné série pre graf: vek od dnes po koniec renty */
  ages: number[];
  yearWealth: number[];
  yearInvested: (number | null)[];
  yearFlat: number[];
  yearPaid: (number | null)[];
  retirementIndex: number;
};

export function compute(d: Inputs, strategy: Strategy): Result {
  const N = d.retirementAge - d.currentAge;
  const duration = d.endAge - d.retirementAge;
  const deflator = Math.pow(1 + d.inflation / 100, N);
  const acc = accumulate(d, d.retirementAge);
  const C = acc.C;

  const results = {} as Record<Strategy, StrategyResult>;
  STRATEGIES.forEach((s) => {
    const incomeNominal = incomeFor(s, C, d);
    results[s] = { incomeNominal, incomeToday: incomeNominal / deflator, sim: drawdown(C, incomeNominal, d) };
  });
  const sel = results[strategy];

  const targetToday = Math.max(0, d.desiredRent - d.otherIncome);
  const required = requiredFor(strategy, targetToday * deflator, d);
  const gap = required - C;
  const totalIncomeToday = sel.incomeToday + d.otherIncome;
  const goalPct = d.desiredRent > 0 ? (totalIncomeToday / d.desiredRent) * 100 : 100;
  const incomeGapToday = d.desiredRent - totalIncomeToday;

  // Mesačný vklad, ktorým presne dosiahneš potrebný kapitál (kapitál je vo vklade lineárny).
  const base = accumulate({ ...d, monthlyInvestment: 0 }, d.retirementAge).C;
  const perEuro = accumulate({ ...d, monthlyInvestment: 1 }, d.retirementAge).C - base;
  const requiredMonthly = !Number.isFinite(required) ? null : perEuro > 1e-9 ? Math.max(0, (required - base) / perEuro) : null;

  // Najskorší vek, v ktorom je cieľ dosiahnuteľný (byt sa predáva v tom veku).
  let goalAge: number | null = null;
  if (targetToday > 0 && Number.isFinite(required)) {
    for (let a = d.currentAge + 1; a < d.endAge; a++) {
      const Ca = accumulate(d, a).C;
      const reqA = requiredFor(strategy, targetToday * Math.pow(1 + d.inflation / 100, a - d.currentAge), d, a);
      if (Ca >= reqA) {
        goalAge = a;
        break;
      }
    }
  } else if (targetToday === 0) {
    goalAge = d.currentAge;
  }

  const hasLoan = d.hasFlat === 1 && d.flatLoan > 0;
  const cashflowToday = d.hasFlat === 1 ? d.flatRent - d.flatCosts - (hasLoan ? acc.payment : 0) : 0;
  const payoffAge = acc.payoffM > 0 ? d.currentAge + Math.ceil(acc.payoffM / 12) : null;

  const ages: number[] = [];
  const yearWealth: number[] = [];
  const yearInvested: (number | null)[] = [];
  const yearFlat: number[] = [];
  const yearPaid: (number | null)[] = [];
  for (let a = d.currentAge; a <= d.endAge; a++) {
    const k = a - d.currentAge;
    ages.push(a);
    if (k <= N) {
      const m = k * 12;
      yearWealth.push(acc.wealth[m]);
      yearInvested.push(acc.invested[m]);
      yearFlat.push(Math.max(0, acc.flatVal[m] - acc.flatDebt[m]));
      yearPaid.push(null);
    } else {
      const j = k - N - 1;
      yearWealth.push(sel.sim.capitalSeries[j] ?? 0);
      yearInvested.push(null);
      yearFlat.push(0);
      yearPaid.push(sel.sim.paidSeries[j] ?? 0);
    }
  }

  return {
    d,
    N,
    duration,
    acc,
    C,
    deflator,
    results,
    sel,
    targetToday,
    required,
    gap,
    totalIncomeToday,
    goalPct,
    incomeGapToday,
    requiredMonthly,
    goalAge,
    cashflowToday,
    payoffAge,
    ages,
    yearWealth,
    yearInvested,
    yearFlat,
    yearPaid,
    retirementIndex: N,
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
