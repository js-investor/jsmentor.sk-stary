/**
 * Inteligentná hypotéka – výpočtový model (čistá funkcia, bez UI).
 * Matematika zodpovedá prototypu: anuitná splátka, mesačné úročenie rezervy, rast nehnuteľnosti,
 * prienik rezervy so zostatkom hypotéky a porovnanie so zrýchleným splácaním pri rovnakom rozpočte.
 */

export type Inputs = {
  /** výška hypotéky € */
  P: number;
  /** úrok % p. a. */
  rate: number;
  /** splatnosť v rokoch */
  years: number;
  /** mesačne do rezervy € */
  C: number;
  /** výnos rezervy % p. a. */
  yieldPct: number;
  /** rast ceny nehnuteľnosti % p. a. */
  growth: number;
};

export const DEFAULT_INPUTS: Inputs = { P: 123000, rate: 3.6, years: 25, C: 100, yieldPct: 7.5, growth: 4 };

export const LIMITS: Record<keyof Inputs, { min: number; max: number; step: number }> = {
  P: { min: 20000, max: 600000, step: 1000 },
  rate: { min: 0.5, max: 8, step: 0.05 },
  years: { min: 5, max: 40, step: 1 },
  C: { min: 0, max: 1000, step: 10 },
  yieldPct: { min: 0, max: 12, step: 0.1 },
  growth: { min: 0, max: 10, step: 0.1 },
};

export type Result = {
  N: number;
  n: number;
  /** mesačná splátka */
  M: number;
  /** zostatok hypotéky po mesiacoch 0..n */
  mort: number[];
  /** rezerva po mesiacoch 0..n */
  res: number[];
  /** hodnota nehnuteľnosti po mesiacoch 0..n */
  house: number[];
  /** kumulované úroky po mesiacoch 0..n */
  cumInt: number[];
  /** celkové úroky pri klasickom splácaní */
  interest: number;
  /** celkové úroky pri zrýchlenom splácaní (splátka + rezerva do hypotéky) */
  interestA: number;
  /** mesiac, v ktorom rezerva prvýkrát pokryje zostatok; -1 = nikdy */
  crossM: number;
  reserveAtCross: number;
  debtAtCross: number;
  /** úroky, ktoré by si už nezaplatil, keby si pri prieniku doplatil */
  interestSaved: number;
  /** o koľko mesiacov skôr než klasická splatnosť */
  monthsEarlier: number;
  reserveEnd: number;
  houseEnd: number;
  /** majetok na konci: inteligentná (nehnuteľnosť + rezerva) */
  netSmart: number;
  /** majetok na konci: zrýchlené splácanie (nehnuteľnosť + investované splátky po doplatení) */
  netOverpay: number;
  diff: number;
  /** mesiac doplatenia pri zrýchlenom splácaní */
  payoffM: number;
  /** investované splátky po doplatení (zrýchlený scenár) */
  fvA: number;
};

export function compute(inp: Inputs): Result {
  const P = Math.max(0, inp.P);
  const N = Math.max(1, Math.round(inp.years));
  const n = N * 12;
  const r = inp.rate / 100 / 12;
  const g = inp.yieldPct / 100 / 12;
  const a = inp.growth / 100;
  const C = Math.max(0, inp.C);
  const M = r > 0 ? (P * r) / (1 - Math.pow(1 + r, -n)) : P / n;

  const mort = [P];
  const res = [0];
  const house = [P];
  const cumInt = [0];
  let bal = P;
  let interest = 0;
  let resv = 0;
  for (let m = 1; m <= n; m++) {
    const i = bal * r;
    interest += i;
    bal = bal + i - M;
    if (bal < 0.005) bal = 0;
    mort.push(bal);
    resv = resv * (1 + g) + C;
    res.push(resv);
    house.push(P * Math.pow(1 + a, m / 12));
    cumInt.push(interest);
  }

  let crossM = -1;
  for (let m = 0; m <= n; m++) {
    if (mort[m] > 0 && res[m] >= mort[m]) {
      crossM = m;
      break;
    }
  }

  // Zrýchlené splácanie: rovnaký rozpočet (splátka + rezerva) ide do hypotéky, po doplatení sa investuje.
  const pay = M + C;
  let balA = P;
  let interestA = 0;
  let payoffM = n;
  let done = false;
  for (let m = 1; m <= n; m++) {
    if (balA <= 0) {
      done = true;
      payoffM = m - 1;
      break;
    }
    const i = balA * r;
    interestA += i;
    balA = balA + i - pay;
    if (balA <= 0) {
      balA = 0;
      payoffM = m;
      done = true;
      break;
    }
  }
  if (!done) payoffM = n;
  let fvA = 0;
  for (let m = payoffM + 1; m <= n; m++) fvA = fvA * (1 + g) + pay;

  const reserveEnd = res[n];
  const houseEnd = house[n];
  const netSmart = houseEnd + reserveEnd;
  const netOverpay = houseEnd + fvA;

  return {
    N,
    n,
    M,
    mort,
    res,
    house,
    cumInt,
    interest,
    interestA,
    crossM,
    reserveAtCross: crossM >= 0 ? res[crossM] : 0,
    debtAtCross: crossM >= 0 ? mort[crossM] : 0,
    interestSaved: crossM >= 0 ? Math.max(0, interest - cumInt[crossM]) : 0,
    monthsEarlier: crossM >= 0 ? n - crossM : 0,
    reserveEnd,
    houseEnd,
    netSmart,
    netOverpay,
    diff: netSmart - netOverpay,
    payoffM,
    fvA,
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
