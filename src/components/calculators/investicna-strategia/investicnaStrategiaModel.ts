/**
 * Investičná stratégia – výpočtový model nad skutočnými dennými dátami (čisté funkcie, bez UI).
 *
 * Tri zložky portfólia: akcie, dlhopisy a peňažný fond. Dáta sú denné celkové výnosy (s dividendami a kupónmi):
 *  - súbor „eur“ od 4. 1. 1999: akcie rozvinutých trhov v eurách, nemecké štátne dlhopisy 7–10 r., eurový peňažný trh,
 *  - súbor „usd“ od 2. 1. 1962: americký akciový trh, 10-ročné štátne dlhopisy USA, pokladničné poukážky.
 *
 * Pravidlá výpočtu:
 *  - obdobie = posledných N rokov dát, alebo presne zvolené dni; prvý vklad (jednorazový + mesačný) sa investuje v deň
 *    začiatku, ďalšie mesačné vklady v rovnaký deň každého mesiaca (ak sa neobchodovalo, v najbližší obchodný deň),
 *    v posledný deň obdobia sa už nevkladá;
 *  - zloženie portfólia je dané pre každý rok investovania (brzda): nový vklad sa rozdelí podľa zloženia daného roka
 *    a celé portfólio sa naň vracia raz ročne alebo každý mesiac;
 *  - ročné náklady sa strhávajú denne z hodnoty; pri reálnych výnosoch sú sumy v cenách z posledného dňa obdobia.
 *
 * Výnos stratégie (časovo vážený) meria samotnú stratégiu, výnos vkladov (vnútorné výnosové percento) zohľadňuje, kedy peniaze prišli.
 */

import type { RawCrisis, RawSet, SetId } from "./investicnaStrategiaData";

export type { SetId };

/** podiel akcií, dlhopisov a peňažného fondu v %, súčet 100 */
export type Weights = [number, number, number];

export type Rebalance = "yearly" | "monthly";

/** brzda: ako sa zloženie mení počas rokov investovania */
export type Brake = "none" | "goal" | "rent" | "custom";

export type Inputs = {
  set: SetId;
  /** dĺžka investovania v rokoch; platí, keď nie je zadaný začiatok */
  years: number;
  /** ISO dátum, prázdny reťazec = posledných `years` rokov pred koncom */
  start: string;
  /** ISO dátum, prázdny reťazec = posledný deň dát */
  end: string;
  initial: number;
  monthly: number;
  /** zloženie v prvom roku */
  alloc: Weights;
  brake: Brake;
  /** vlastné zloženie pre každý rok (platí pri brzde „custom“) */
  custom: Weights[];
  rebalance: Rebalance;
  /** ročné náklady v % z hodnoty */
  cost: number;
  /** reálne výnosy (po inflácii) */
  real: boolean;
};

/** najkratšie obdobie v obchodných dňoch */
export const MIN_DAYS = 21;
export const MAX_YEARS = 64;

export const GOAL_TARGET: Weights = [20, 40, 40];
export const RENT_TARGET: Weights = [50, 30, 20];
/** koľko posledných rokov trvá brzdenie pri predvoľbách „na cieľ“ a „na rentu“ */
export const BRAKE_YEARS = 10;

export const ALLOC_PRESETS: { id: string; label: string; w: Weights }[] = [
  { id: "dynamicka", label: "Dynamická", w: [100, 0, 0] },
  { id: "vyvazena", label: "Vyvážená", w: [60, 20, 20] },
  { id: "konzervativna", label: "Konzervatívna", w: [30, 40, 30] },
];

export const BRAKES: { id: Brake; label: string }[] = [
  { id: "none", label: "Bez brzdy" },
  { id: "goal", label: "Na cieľ" },
  { id: "rent", label: "Na rentu" },
  { id: "custom", label: "Vlastná" },
];

export const DEFAULT_INPUTS: Inputs = {
  set: "eur",
  years: 20,
  start: "",
  end: "",
  initial: 5000,
  monthly: 150,
  alloc: [60, 20, 20],
  brake: "none",
  custom: [],
  rebalance: "yearly",
  cost: 0,
  real: false,
};

export type NumKey = "initial" | "monthly" | "years" | "cost";

export const LIMITS: Record<NumKey, { min: number; max: number; step: number }> = {
  initial: { min: 0, max: 5000000, step: 500 },
  monthly: { min: 0, max: 50000, step: 50 },
  years: { min: 1, max: MAX_YEARS, step: 1 },
  cost: { min: 0, max: 3, step: 0.1 },
};

/* ------------------------------------------------------------------ dátumy */

const DAY_MS = 86400000;

/** poradové číslo dňa od 1. 1. 1970 z ISO dátumu; NaN, ak dátum neexistuje */
export const dayOf = (iso: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return NaN;
  /* setUTCFullYear namiesto Date.UTC: roky 0–99 by sa inak brali ako 1900–1999 */
  const t = new Date(0);
  t.setUTCFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const day = Math.round(t.getTime() / DAY_MS);
  return isoOf(day) === iso ? day : NaN;
};

export const isoOf = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);

export const ymdOf = (day: number): { y: number; m: number; d: number } => {
  const t = new Date(day * DAY_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};

/** rovnaký deň o k mesiacov neskôr; ak mesiac taký deň nemá, jeho posledný deň */
export const addMonths = (day: number, k: number): number => {
  const { y, m, d } = ymdOf(day);
  const t = y * 12 + (m - 1) + k;
  const yy = Math.floor(t / 12);
  const mm = t - yy * 12;
  const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
  return Math.round(Date.UTC(yy, mm, Math.min(d, last)) / DAY_MS);
};

/** roky medzi dvoma dňami */
export const yearsBetween = (a: number, b: number): number => (b - a) / 365.25;

/** počet rokov investovania (riadkov brzdy) pre obdobie */
export const rowsBetween = (a: number, b: number): number => Math.max(1, Math.ceil(yearsBetween(a, b) - 0.02));

/* ------------------------------------------------------------------ dáta */

export type Dataset = {
  id: SetId;
  currency: string;
  n: number;
  /** obchodné dni ako poradové čísla dní */
  day: Int32Array;
  stock: Float64Array;
  bond: Float64Array;
  cash: Float64Array;
  /** rok × 12 + mesiac (0–11) prvého údaja o cenovej hladine */
  cpiFirst: number;
  cpi: number[];
  /** cenová hladina v každý obchodný deň */
  level: Float64Array;
  crises: RawCrisis[];
};

/** cenová hladina v daný deň: lineárne medzi stredmi mesiacov (mesačný index patrí 15. dňu) */
export const cpiAt = (ds: Dataset, day: number): number => {
  const { y, m, d } = ymdOf(day);
  const last = ds.cpi.length - 1;
  const pos = Math.max(0, Math.min(last, y * 12 + (m - 1) - ds.cpiFirst + (d - 15) / 30));
  const lo = Math.floor(pos);
  const hi = Math.min(last, lo + 1);
  return ds.cpi[lo] + (ds.cpi[hi] - ds.cpi[lo]) * (pos - lo);
};

const bytesOf = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const returnsOf = (b64: string, unit: number, n: number): Float64Array => {
  const b = bytesOf(b64);
  if (b.length !== n * 2) throw new Error("Historické dáta majú nečakanú dĺžku.");
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let v = b[2 * i] | (b[2 * i + 1] << 8);
    if (v >= 32768) v -= 65536;
    out[i] = v * unit;
  }
  return out;
};

export const decodeSet = (id: SetId, raw: RawSet, unit: { stock: number; bond: number; cash: number }): Dataset => {
  const gaps = bytesOf(raw.gaps);
  if (gaps.length !== raw.n) throw new Error("Historické dáta majú nečakanú dĺžku.");
  const day = new Int32Array(raw.n);
  let d = dayOf(raw.start);
  for (let i = 0; i < raw.n; i++) {
    d += gaps[i];
    day[i] = d;
  }
  if (isoOf(day[raw.n - 1]) !== raw.end) throw new Error("Historické dáta nesedia s kalendárom.");
  const [fy, fm] = raw.cpiFirst.split("-").map(Number);
  const ds: Dataset = {
    id,
    currency: raw.currency,
    n: raw.n,
    day,
    stock: returnsOf(raw.stock, unit.stock, raw.n),
    bond: returnsOf(raw.bond, unit.bond, raw.n),
    cash: returnsOf(raw.cash, unit.cash, raw.n),
    cpiFirst: fy * 12 + (fm - 1),
    cpi: raw.cpi,
    level: new Float64Array(raw.n),
    crises: raw.crises,
  };
  for (let i = 0; i < raw.n; i++) ds.level[i] = cpiAt(ds, day[i]);
  return ds;
};

/** index prvého obchodného dňa v deň `target` alebo po ňom (n, ak taký nie je) */
export const firstOnOrAfter = (day: Int32Array, target: number): number => {
  let lo = 0;
  let hi = day.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (day[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

/** index posledného obchodného dňa v deň `target` alebo pred ním (-1, ak taký nie je) */
export const lastOnOrBefore = (day: Int32Array, target: number): number => firstOnOrAfter(day, target + 1) - 1;

/** koľko celých rokov dát je k dispozícii */
export const yearsAvailable = (ds: Dataset): number => Math.floor(yearsBetween(ds.day[0], ds.day[ds.n - 1]) + 1e-9);

/* ------------------------------------------------------------------ vstupy */

const num = (v: unknown, k: NumKey, fallback: number): number => {
  const n = Number(v);
  const lim = LIMITS[k];
  return Number.isFinite(n) ? Math.min(lim.max, Math.max(lim.min, n)) : fallback;
};

/** tri celé čísla 0–100 so súčtom 100: celé časti a zvyšné body podľa najväčších zvyškov (pri zhode nižší index) */
export const normalizeWeights = (w: unknown, fallback: Weights = [60, 20, 20]): Weights => {
  if (!Array.isArray(w) || w.length !== 3) return [...fallback];
  const v = w.map((x) => (Number.isFinite(Number(x)) ? Math.max(0, Number(x)) : 0));
  const sum = v[0] + v[1] + v[2];
  if (sum <= 0) return [...fallback];
  const scaled = v.map((x) => (x / sum) * 100);
  const out = scaled.map((x) => Math.floor(x + 1e-9));
  let rest = 100 - (out[0] + out[1] + out[2]);
  const order = [0, 1, 2].sort((i, j) => scaled[j] - out[j] - (scaled[i] - out[i]) || i - j);
  for (const i of order) {
    if (rest <= 0) break;
    out[i]++;
    rest--;
  }
  return [out[0], out[1], out[2]];
};

export const sameWeights = (a: readonly number[], b: readonly number[]): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

export function sanitize(x: Partial<Inputs>): Inputs {
  const out: Inputs = { ...DEFAULT_INPUTS, alloc: [...DEFAULT_INPUTS.alloc], custom: [] };
  out.set = x.set === "usd" ? "usd" : "eur";
  out.years = Math.round(num(x.years, "years", DEFAULT_INPUTS.years));
  out.start = typeof x.start === "string" && Number.isFinite(dayOf(x.start)) ? x.start : "";
  out.end = typeof x.end === "string" && Number.isFinite(dayOf(x.end)) ? x.end : "";
  if (out.start && out.end && dayOf(out.end) <= dayOf(out.start)) out.end = "";
  out.initial = Math.round(num(x.initial, "initial", DEFAULT_INPUTS.initial));
  out.monthly = Math.round(num(x.monthly, "monthly", DEFAULT_INPUTS.monthly));
  out.cost = Math.round(num(x.cost, "cost", DEFAULT_INPUTS.cost) * 100) / 100;
  out.rebalance = x.rebalance === "monthly" ? "monthly" : "yearly";
  out.real = x.real === true;
  out.alloc = normalizeWeights(x.alloc, DEFAULT_INPUTS.alloc);
  out.brake = x.brake === "goal" || x.brake === "rent" || x.brake === "custom" ? x.brake : "none";
  out.custom = (Array.isArray(x.custom) ? x.custom : []).slice(0, MAX_YEARS).map((w) => normalizeWeights(w, out.alloc));
  if (out.brake === "custom" && !out.custom.length) out.brake = "none";
  if (out.brake === "custom") out.alloc = [...out.custom[0]];
  return out;
}

/**
 * Zmena jednej zložky v editore: súčet ostáva 100. Rozdiel vyrovná zložka, ktorej sa používateľ dotkol najdávnejšie,
 * naposledy upravená ostáva, kým sa zmestí. `order` = zložky od najdávnejšie po naposledy upravenú.
 */
export const adjustWeights = (w: Weights, asset: number, value: number, order: number[]): Weights => {
  const v = Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
  const others = order.filter((i) => i !== asset && i >= 0 && i <= 2);
  for (const i of [0, 1, 2]) if (i !== asset && !others.includes(i)) others.unshift(i);
  const [absorb, keep] = others;
  const rest = 100 - v;
  const next: Weights = [...w];
  next[asset] = v;
  next[keep] = Math.min(w[keep], rest);
  next[absorb] = rest - next[keep];
  return next;
};

/** zloženie portfólia pre každý rok investovania podľa brzdy (dĺžka = počet rokov) */
export const rowsFor = (a: Pick<Inputs, "alloc" | "brake" | "custom">, rows: number): Weights[] => {
  const n = Math.max(1, rows);
  const alloc: Weights = [...a.alloc];
  if (a.brake === "custom") {
    const src = a.custom.length ? a.custom : [alloc];
    return Array.from({ length: n }, (_, k) => normalizeWeights(src[Math.min(k, src.length - 1)], alloc));
  }
  if (a.brake === "goal" || a.brake === "rent") {
    const target = a.brake === "goal" ? GOAL_TARGET : RENT_TARGET;
    const len = Math.min(BRAKE_YEARS, n);
    return Array.from({ length: n }, (_, k) => {
      if (k < n - len) return [...alloc];
      const x = (k - (n - len) + 1) / len;
      return normalizeWeights([alloc[0] + (target[0] - alloc[0]) * x, alloc[1] + (target[1] - alloc[1]) * x, alloc[2] + (target[2] - alloc[2]) * x], alloc);
    });
  }
  return Array.from({ length: n }, () => [...alloc]);
};

/** scenár ako parametre odkazu (bez osobných údajov, len nastavenie nástroja) */
export const encodeScenario = (a: Inputs): string => {
  const q = new URLSearchParams();
  q.set("s", a.set);
  q.set("y", String(a.years));
  if (a.start) q.set("od", a.start);
  if (a.end) q.set("do", a.end);
  q.set("v", String(a.initial));
  q.set("m", String(a.monthly));
  q.set("a", a.alloc.join("-"));
  if (a.brake !== "none") q.set("b", a.brake);
  if (a.brake === "custom") q.set("c", a.custom.map((w) => w.join("-")).join("_"));
  if (a.rebalance === "monthly") q.set("r", "m");
  if (a.cost > 0) q.set("n", String(a.cost));
  if (a.real) q.set("i", "1");
  return q.toString();
};

/** null, ak odkaz scenár neobsahuje */
export const decodeScenario = (search: string): Inputs | null => {
  const q = new URLSearchParams(search);
  const alloc = q.get("a");
  if (!alloc || !q.get("s")) return null;
  const triple = (s: string): number[] => s.split("-").map(Number);
  const w = triple(alloc);
  if (w.length !== 3 || !w.every(Number.isFinite)) return null;
  const custom = (q.get("c") ?? "")
    .split("_")
    .filter(Boolean)
    .map(triple)
    .filter((t) => t.length === 3 && t.every(Number.isFinite)) as Weights[];
  return sanitize({
    set: q.get("s") === "usd" ? "usd" : "eur",
    years: Number(q.get("y") ?? DEFAULT_INPUTS.years),
    start: q.get("od") ?? "",
    end: q.get("do") ?? "",
    initial: Number(q.get("v") ?? DEFAULT_INPUTS.initial),
    monthly: Number(q.get("m") ?? DEFAULT_INPUTS.monthly),
    alloc: w as Weights,
    brake: (q.get("b") ?? "none") as Brake,
    custom,
    rebalance: q.get("r") === "m" ? "monthly" : "yearly",
    cost: Number(q.get("n") ?? 0),
    real: q.get("i") === "1",
  });
};

/* ------------------------------------------------------------------ obdobie */

export type Range = { i0: number; i1: number; startMoved: boolean; endMoved: boolean };

/** zvolené dni prevedené na obchodné dni v rozsahu dát, vždy aspoň MIN_DAYS dní */
export const resolveRange = (ds: Dataset, a: Pick<Inputs, "years" | "start" | "end">): Range => {
  const first = ds.day[0];
  const last = ds.day[ds.n - 1];
  const e0 = a.end ? dayOf(a.end) : last;
  const endDay = Math.min(last, Math.max(first, Number.isFinite(e0) ? e0 : last));
  let s = a.start ? dayOf(a.start) : addMonths(endDay, -12 * Math.max(1, Math.round(a.years || DEFAULT_INPUTS.years)));
  if (!Number.isFinite(s)) s = first;
  const from = Math.min(last, Math.max(first, s));
  /* koniec, ktorý neleží za začiatkom, sa berie ako nezadaný */
  let e = endDay;
  if (!(e > from)) e = last;
  let i1 = lastOnOrBefore(ds.day, e);
  let i0 = firstOnOrAfter(ds.day, from);
  i1 = Math.max(i1, Math.min(ds.n - 1, MIN_DAYS));
  if (i0 > i1 - MIN_DAYS) i0 = Math.max(0, i1 - MIN_DAYS);
  return { i0, i1, startMoved: !!a.start && ds.day[i0] !== s, endMoved: !!a.end && ds.day[i1] !== dayOf(a.end) };
};

/* ------------------------------------------------------------------ simulácia */

type Params = {
  i0: number;
  i1: number;
  initial: number;
  monthly: number;
  every: 1 | 12;
  cost: number;
  real: boolean;
};

type Core = {
  final: number;
  deposits: number;
  unitEnd: number;
  /** dvojice (roky do konca obdobia, suma) */
  flows: number[];
  depositCount: number;
  value: Float64Array | null;
  paid: Float64Array | null;
  unit: Float64Array | null;
  shareStock: Float32Array | null;
  shareBond: Float32Array | null;
};

const simulate = (ds: Dataset, p: Params, rows: Weights[], keep: boolean): Core => {
  const { i0, i1 } = p;
  const n = i1 - i0 + 1;
  const startDay = ds.day[i0];
  const endDay = ds.day[i1];
  const cpi0 = p.real ? ds.level[i0] : 1;
  const cpi1 = p.real ? ds.level[i1] : 1;
  const value = keep ? new Float64Array(n) : null;
  const paid = keep ? new Float64Array(n) : null;
  const unit = keep ? new Float64Array(n) : null;
  const shareStock = keep ? new Float32Array(n) : null;
  const shareBond = keep ? new Float32Array(n) : null;
  const flows: number[] = [];
  /* bez vkladov sa stratégia meria na pomyselnom vklade 1, sumy ostávajú nulové */
  const notional = p.initial + p.monthly > 0 ? 0 : 1;

  let hs = 0;
  let hb = 0;
  let hc = 0;
  let u = 1;
  let deposits = 0;
  let depositCount = 0;
  let k = 0;
  let nextIdx = i0;
  let lastValue = 0;
  let lastUnit = 1;

  for (let i = i0; i <= i1; i++) {
    const d = ds.day[i];
    if (i > i0) {
      const before = hs + hb + hc;
      const fee = 1 - ((p.cost / 100) * (d - ds.day[i - 1])) / 365.25;
      hs = hs * (1 + ds.stock[i]) * fee;
      hb = hb * (1 + ds.bond[i]) * fee;
      hc = hc * (1 + ds.cash[i]) * fee;
      if (before > 0) u *= (hs + hb + hc) / before;
    }
    if (i === nextIdx) {
      const w = rows[Math.min(rows.length - 1, Math.floor(k / 12))];
      const amount = (k === 0 ? p.initial + notional : 0) + p.monthly;
      if (amount > 0) {
        hs += (amount * w[0]) / 100;
        hb += (amount * w[1]) / 100;
        hc += (amount * w[2]) / 100;
      }
      if (amount > 0 && !notional) {
        const shown = p.real ? amount * (cpi1 / ds.level[i]) : amount;
        deposits += shown;
        depositCount++;
        flows.push(yearsBetween(d, endDay), shown);
      }
      if (k % p.every === 0) {
        const total = hs + hb + hc;
        hs = (total * w[0]) / 100;
        hb = (total * w[1]) / 100;
        hc = (total * w[2]) / 100;
      }
      k++;
      nextIdx = firstOnOrAfter(ds.day, addMonths(startDay, k));
      if (nextIdx >= i1) nextIdx = -1;
    }
    const total = hs + hb + hc;
    const level = p.real ? ds.level[i] : 1;
    lastValue = notional ? 0 : p.real ? total * (cpi1 / level) : total;
    lastUnit = p.real ? u * (cpi0 / level) : u;
    if (value && paid && unit && shareStock && shareBond) {
      const j = i - i0;
      value[j] = lastValue;
      paid[j] = deposits;
      unit[j] = lastUnit;
      shareStock[j] = total > 0 ? hs / total : rows[0][0] / 100;
      shareBond[j] = total > 0 ? hb / total : rows[0][1] / 100;
    }
  }
  return { final: lastValue, deposits, unitEnd: lastUnit, flows, depositCount, value, paid, unit, shareStock, shareBond };
};

/** vnútorné výnosové percento vkladov (ročné), null bez vkladov */
const irrOf = (flows: number[], final: number): number | null => {
  if (!flows.length) return null;
  let lo = -0.99;
  let hi = 10;
  for (let it = 0; it < 100; it++) {
    const mid = (lo + hi) / 2;
    let v = -final;
    for (let j = 0; j < flows.length; j += 2) v += flows[j + 1] * Math.pow(1 + mid, flows[j]);
    if (v > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
};

export type Drawdown = {
  /** hĺbka prepadu, záporné číslo (0 = bez prepadu) */
  depth: number;
  /** indexy dní v rámci obdobia */
  peak: number;
  trough: number;
  /** deň návratu na pôvodné maximum, null = do konca obdobia sa nevrátilo */
  recovery: number | null;
};

/** najhlbší prepad jednotkovej hodnoty v okne [from, to] */
export const drawdownOf = (unit: Float64Array, from = 0, to = unit.length - 1): Drawdown => {
  let peak = from;
  let best = 0;
  let bp = from;
  let bt = from;
  for (let j = from; j <= to; j++) {
    if (unit[j] > unit[peak]) peak = j;
    const dd = unit[j] / unit[peak] - 1;
    if (dd < best) {
      best = dd;
      bp = peak;
      bt = j;
    }
  }
  let recovery: number | null = null;
  if (best < 0) {
    for (let j = bt; j <= to; j++) {
      if (unit[j] >= unit[bp]) {
        recovery = j;
        break;
      }
    }
  }
  return { depth: best, peak: bp, trough: bt, recovery };
};

const volatilityOf = (unit: Float64Array): number => {
  const n = unit.length - 1;
  if (n < 2) return 0;
  let mean = 0;
  for (let j = 1; j <= n; j++) mean += Math.log(unit[j] / unit[j - 1]);
  mean /= n;
  let s = 0;
  for (let j = 1; j <= n; j++) {
    const x = Math.log(unit[j] / unit[j - 1]) - mean;
    s += x * x;
  }
  return Math.sqrt(s / (n - 1)) * Math.sqrt(252);
};

/* ------------------------------------------------------------------ výsledok */

export type Line = {
  final: number;
  deposits: number;
  gain: number;
  /** ročný výnos stratégie (časovo vážený) */
  twr: number;
  /** ročný výnos vkladov (vnútorné výnosové percento) */
  irr: number | null;
  drawdown: Drawdown;
  volatility: number;
  value: Float64Array;
  paid: Float64Array;
  unit: Float64Array;
  /** ročný výnos zložiek za celé obdobie (pred nákladmi) a ročná inflácia */
  assets: { stock: number; bond: number; cash: number; inflation: number };
};

export type YearRow = {
  year: number;
  /** rok nie je v období celý */
  partial: boolean;
  /** indexy prvého a posledného dňa roka v rámci obdobia */
  from: number;
  to: number;
  /** výnos stratégie za rok v zvolenom režime (nominálne alebo reálne) */
  strategy: number;
  stock: number;
  bond: number;
  cash: number;
  /** zisk za rok = zmena hodnoty mínus vklady v roku */
  profitNominal: number;
  profitReal: number;
  /** výnos stratégie za rok v oboch režimoch */
  returnNominal: number;
  returnReal: number;
  value: number;
  paid: number;
  /** skutočný podiel zložiek na konci roka (0–1) */
  share: [number, number, number];
};

export type CrisisRow = {
  id: string;
  name: string;
  /** indexy dní v rámci obdobia */
  peak: number;
  trough: number;
  strategy: number;
  stocks: number;
};

export type Markets = {
  /** hodnota 1 investovaného na začiatku (nominálne) */
  stock: Float64Array;
  bond: Float64Array;
  cash: Float64Array;
  /** cenová hladina, 1 na začiatku */
  inflation: Float64Array;
};

export type Result = {
  /** vstupy po úprave */
  inputs: Inputs;
  currency: string;
  i0: number;
  i1: number;
  n: number;
  startDay: number;
  endDay: number;
  years: number;
  /** počet rokov investovania = riadkov brzdy */
  rows: number;
  /** zloženie pre každý rok investovania */
  allocation: Weights[];
  /** začiatok alebo koniec sa posunul na obchodný deň alebo do rozsahu dát */
  startMoved: boolean;
  endMoved: boolean;
  depositCount: number;
  /** výsledok v zvolenom režime (nominálne alebo reálne) */
  strategy: Line;
  nominal: Line;
  real: Line;
  /** len akcie pri rovnakých vkladoch, v zvolenom režime */
  stocks: Line;
  shareStock: Float32Array;
  shareBond: Float32Array;
  yearly: YearRow[];
  bestYear: YearRow | null;
  worstYear: YearRow | null;
  crises: CrisisRow[];
  markets: Markets;
};

const lineOf = (ds: Dataset, p: Params, core: Core): Line => {
  const unit = core.unit as Float64Array;
  const years = yearsBetween(ds.day[p.i0], ds.day[p.i1]);
  let as = 1;
  let ab = 1;
  let ac = 1;
  for (let i = p.i0 + 1; i <= p.i1; i++) {
    as *= 1 + ds.stock[i];
    ab *= 1 + ds.bond[i];
    ac *= 1 + ds.cash[i];
  }
  const lv = p.real ? ds.level[p.i0] / ds.level[p.i1] : 1;
  return {
    final: core.final,
    deposits: core.deposits,
    gain: core.final - core.deposits,
    twr: Math.pow(core.unitEnd, 1 / years) - 1,
    irr: irrOf(core.flows, core.final),
    drawdown: drawdownOf(unit),
    volatility: volatilityOf(unit),
    value: core.value as Float64Array,
    paid: core.paid as Float64Array,
    unit,
    assets: {
      stock: Math.pow(as * lv, 1 / years) - 1,
      bond: Math.pow(ab * lv, 1 / years) - 1,
      cash: Math.pow(ac * lv, 1 / years) - 1,
      inflation: Math.pow(ds.level[p.i1] / ds.level[p.i0], 1 / years) - 1,
    },
  };
};

const STOCKS_ONLY: Weights[] = [[100, 0, 0]];

export function compute(ds: Dataset, raw: Inputs): Result {
  const a = sanitize(raw);
  const range = resolveRange(ds, a);
  const { i0, i1 } = range;
  const n = i1 - i0 + 1;
  const startDay = ds.day[i0];
  const endDay = ds.day[i1];
  const years = yearsBetween(startDay, endDay);
  const rows = rowsBetween(startDay, endDay);
  const allocation = rowsFor(a, rows);
  const base = { i0, i1, initial: a.initial, monthly: a.monthly, every: (a.rebalance === "monthly" ? 1 : 12) as 1 | 12, cost: a.cost };
  const pNom: Params = { ...base, real: false };
  const pReal: Params = { ...base, real: true };
  const pMode = a.real ? pReal : pNom;

  const coreNom = simulate(ds, pNom, allocation, true);
  const coreReal = simulate(ds, pReal, allocation, true);
  const nominal = lineOf(ds, pNom, coreNom);
  const real = lineOf(ds, pReal, coreReal);
  const strategy = a.real ? real : nominal;
  const stocks = lineOf(ds, pMode, simulate(ds, pMode, STOCKS_ONLY, true));
  const core = a.real ? coreReal : coreNom;
  const shareStock = core.shareStock as Float32Array;
  const shareBond = core.shareBond as Float32Array;

  /* roky */
  const cpi0 = a.real ? ds.level[i0] : 1;
  const level = (i: number) => (a.real ? cpi0 / ds.level[i] : 1);
  const yearly: YearRow[] = [];
  let from = 0;
  let prevN = 1;
  let prevR = 1;
  let prevValueN = nominal.value[0] - nominal.paid[0];
  let prevValueR = real.value[0] - real.paid[0];
  let prevPaidN = 0;
  let prevPaidR = 0;
  let as = 1;
  let ab = 1;
  let ac = 1;
  let ps = 1;
  let pb = 1;
  let pc = 1;
  for (let j = 0; j < n; j++) {
    const i = i0 + j;
    if (j > 0) {
      as *= 1 + ds.stock[i];
      ab *= 1 + ds.bond[i];
      ac *= 1 + ds.cash[i];
    }
    const { y: year, m: month, d: dom } = ymdOf(ds.day[i]);
    const lastOfYear = j === n - 1 || ymdOf(ds.day[i + 1]).y !== year;
    if (!lastOfYear) continue;
    const lv = level(i);
    /* celý rok: obdobie sa začína prvým obchodným dňom roka a končí posledným (dáta môžu končiť uprostred roka) */
    const startsYear = from > 0 || firstOnOrAfter(ds.day, dayOf(`${year}-01-01`)) === i0;
    const endsYear = j < n - 1 || (month === 12 && dom >= 24 && lastOnOrBefore(ds.day, dayOf(`${year}-12-31`)) === i1);
    const returnNominal = nominal.unit[j] / prevN - 1;
    const returnReal = real.unit[j] / prevR - 1;
    yearly.push({
      year,
      partial: !(startsYear && endsYear),
      from,
      to: j,
      strategy: a.real ? returnReal : returnNominal,
      stock: (as * lv) / ps - 1,
      bond: (ab * lv) / pb - 1,
      cash: (ac * lv) / pc - 1,
      profitNominal: nominal.value[j] - prevValueN - (nominal.paid[j] - prevPaidN),
      profitReal: real.value[j] - prevValueR - (real.paid[j] - prevPaidR),
      returnNominal,
      returnReal,
      value: strategy.value[j],
      paid: strategy.paid[j],
      share: [shareStock[j], shareBond[j], Math.max(0, 1 - shareStock[j] - shareBond[j])],
    });
    prevN = nominal.unit[j];
    prevR = real.unit[j];
    prevValueN = nominal.value[j];
    prevValueR = real.value[j];
    prevPaidN = nominal.paid[j];
    prevPaidR = real.paid[j];
    ps = as * lv;
    pb = ab * lv;
    pc = ac * lv;
    from = j + 1;
  }
  const whole = yearly.filter((y) => !y.partial);
  const pool = whole.length ? whole : yearly;
  const bestYear = pool.reduce<YearRow | null>((b, y) => (!b || y.strategy > b.strategy ? y : b), null);
  const worstYear = pool.reduce<YearRow | null>((b, y) => (!b || y.strategy < b.strategy ? y : b), null);

  /* krízy: od vrcholu po dno akciového trhu */
  const crises: CrisisRow[] = [];
  for (const c of ds.crises) {
    const ip = firstOnOrAfter(ds.day, dayOf(c.peak));
    const it = firstOnOrAfter(ds.day, dayOf(c.trough));
    if (ip < i0 || it > i1) continue;
    const pj = ip - i0;
    const tj = it - i0;
    crises.push({ id: c.id, name: c.name, peak: pj, trough: tj, strategy: strategy.unit[tj] / strategy.unit[pj] - 1, stocks: stocks.unit[tj] / stocks.unit[pj] - 1 });
  }

  /* trhy: hodnota 1 investovaného na začiatku */
  const markets: Markets = { stock: new Float64Array(n), bond: new Float64Array(n), cash: new Float64Array(n), inflation: new Float64Array(n) };
  let ms = 1;
  let mb = 1;
  let mc = 1;
  for (let j = 0; j < n; j++) {
    const i = i0 + j;
    if (j > 0) {
      ms *= 1 + ds.stock[i];
      mb *= 1 + ds.bond[i];
      mc *= 1 + ds.cash[i];
    }
    markets.stock[j] = ms;
    markets.bond[j] = mb;
    markets.cash[j] = mc;
    markets.inflation[j] = ds.level[i] / ds.level[i0];
  }

  return {
    inputs: { ...a, start: isoOf(startDay), end: isoOf(endDay) },
    currency: ds.currency,
    i0,
    i1,
    n,
    startDay,
    endDay,
    years,
    rows,
    allocation,
    startMoved: range.startMoved,
    endMoved: range.endMoved,
    depositCount: core.depositCount,
    strategy,
    nominal,
    real,
    stocks,
    shareStock,
    shareBond,
    yearly,
    bestYear,
    worstYear,
    crises,
    markets,
  };
}

/* ------------------------------------------------------------------ všetky možné začiatky */

export type RollingRow = {
  /** deň začiatku */
  start: number;
  /** ročný výnos stratégie */
  ann: number;
  final: number;
  deposits: number;
};

export type Rolling = {
  horizon: number;
  rows: RollingRow[];
  annMin: number;
  annMedian: number;
  annMax: number;
  finalMin: number;
  finalMedian: number;
  finalMax: number;
  /** vklady pri typickom (strednom) výsledku */
  depositsMedian: number;
  /** podiel začiatkov, ktoré skončili nad vkladmi */
  positive: number;
  worst: RollingRow;
  best: RollingRow;
};

const medianOf = (v: number[]): number => {
  const s = [...v].sort((x, y) => x - y);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

/**
 * Rovnaká stratégia a vklady od prvého obchodného dňa každého mesiaca v histórii, vždy na `horizon` rokov.
 * Vráti null, ak sa do dát nezmestí ani jedno také obdobie.
 */
export function rolling(ds: Dataset, raw: Inputs, horizon: number): Rolling | null {
  const a = sanitize(raw);
  const rows: RollingRow[] = [];
  const last = ds.day[ds.n - 1];
  let seen = -1;
  for (let i = 0; i < ds.n; i++) {
    const { y, m } = ymdOf(ds.day[i]);
    const ym = y * 12 + m;
    if (ym === seen) continue;
    seen = ym;
    const target = addMonths(ds.day[i], horizon * 12);
    if (target > last) break;
    const i1 = lastOnOrBefore(ds.day, target);
    if (i1 - i < MIN_DAYS) continue;
    const p: Params = { i0: i, i1, initial: a.initial, monthly: a.monthly, every: a.rebalance === "monthly" ? 1 : 12, cost: a.cost, real: a.real };
    const core = simulate(ds, p, rowsFor(a, rowsBetween(ds.day[i], ds.day[i1])), false);
    rows.push({ start: ds.day[i], ann: Math.pow(core.unitEnd, 1 / yearsBetween(ds.day[i], ds.day[i1])) - 1, final: core.final, deposits: core.deposits });
  }
  if (!rows.length) return null;
  const ann = rows.map((r) => r.ann);
  const fin = rows.map((r) => r.final);
  return {
    horizon,
    rows,
    annMin: Math.min(...ann),
    annMedian: medianOf(ann),
    annMax: Math.max(...ann),
    finalMin: Math.min(...fin),
    finalMedian: medianOf(fin),
    finalMax: Math.max(...fin),
    depositsMedian: medianOf(rows.map((r) => r.deposits)),
    positive: rows.filter((r) => r.final >= r.deposits).length / rows.length,
    worst: rows.reduce((b, r) => (r.ann < b.ann ? r : b)),
    best: rows.reduce((b, r) => (r.ann > b.ann ? r : b)),
  };
}

/* ------------------------------------------------------------------ pomocné pre graf */

/** pekný krok osi */
export const niceStep = (raw: number): number => {
  if (!(raw > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
};

/**
 * Indexy bodov pre kreslenie dlhej série: z každého úseku prvý bod, minimum a maximum, aby ostali viditeľné
 * všetky prepady aj vrcholy. Vždy obsahuje prvý a posledný bod.
 */
export const sampleIndexes = (series: Float64Array, buckets: number): number[] => {
  const n = series.length;
  if (n <= buckets * 3) return Array.from({ length: n }, (_, i) => i);
  const out: number[] = [];
  const size = n / buckets;
  for (let b = 0; b < buckets; b++) {
    const lo = Math.floor(b * size);
    const hi = Math.min(n, Math.floor((b + 1) * size));
    let mn = lo;
    let mx = lo;
    for (let i = lo; i < hi; i++) {
      if (series[i] < series[mn]) mn = i;
      if (series[i] > series[mx]) mx = i;
    }
    const picks = [lo, Math.min(mn, mx), Math.max(mn, mx)];
    for (const i of picks) if (out[out.length - 1] !== i) out.push(i);
  }
  if (out[out.length - 1] !== n - 1) out.push(n - 1);
  return out;
};
