import { describe, expect, it } from "vitest";
import { DATA_END, RAW, UNIT } from "./investicnaStrategiaData";
import { CASES } from "./investicnaStrategia.cases";
import {
  BRAKE_YEARS,
  DEFAULT_INPUTS,
  GOAL_TARGET,
  RENT_TARGET,
  addMonths,
  adjustWeights,
  compute,
  cpiAt,
  dayOf,
  decodeScenario,
  decodeSet,
  drawdownOf,
  encodeScenario,
  firstOnOrAfter,
  isoOf,
  lastOnOrBefore,
  normalizeWeights,
  resolveRange,
  rolling,
  rowsBetween,
  rowsFor,
  sampleIndexes,
  sanitize,
  yearsAvailable,
  type Dataset,
  type Inputs,
  type SetId,
  type Weights,
} from "./investicnaStrategiaModel";

const SETS: Record<SetId, Dataset> = { eur: decodeSet("eur", RAW.eur, UNIT), usd: decodeSet("usd", RAW.usd, UNIT) };
const near = (actual: number, expected: number, rel = 1e-9) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(expected)));
const base: Inputs = { ...DEFAULT_INPUTS, start: "1999-01-04", end: "2026-08-31", initial: 10000, monthly: 300 };

describe("historické dáta", () => {
  it("majú správny rozsah a dĺžku", () => {
    expect(isoOf(SETS.eur.day[0])).toBe("1999-01-04");
    expect(isoOf(SETS.usd.day[0])).toBe("1962-01-02");
    expect(yearsAvailable(SETS.eur)).toBe(27);
    expect(yearsAvailable(SETS.usd)).toBe(64);
    for (const id of ["eur", "usd"] as const) {
      const ds = SETS[id];
      expect(isoOf(ds.day[ds.n - 1])).toBe(DATA_END);
      expect(ds.stock.length).toBe(ds.n);
      expect(ds.bond.length).toBe(ds.n);
      expect(ds.cash.length).toBe(ds.n);
      for (let i = 1; i < ds.n; i++) expect(ds.day[i]).toBeGreaterThan(ds.day[i - 1]);
    }
  });

  it("obsahujú známe udalosti", () => {
    const usd = SETS.usd;
    /* čierny pondelok 19. 10. 1987: americký trh stratil za deň vyše 17 % */
    const monday = firstOnOrAfter(usd.day, dayOf("1987-10-19"));
    expect(isoOf(usd.day[monday])).toBe("1987-10-19");
    expect(usd.stock[monday]).toBeLessThan(-0.17);
    expect(usd.stock[monday]).toBeGreaterThan(-0.18);
    /* rok 2008: akcie okolo −37 %, štátne dlhopisy v pluse */
    const y2008 = compute(usd, { ...base, set: "usd", start: "2008-01-02", end: "2008-12-31", alloc: [100, 0, 0] }).yearly[0];
    expect(y2008.stock).toBeLessThan(-0.35);
    expect(y2008.stock).toBeGreaterThan(-0.39);
    expect(y2008.bond).toBeGreaterThan(0.15);
    /* záporné sadzby v eurozóne: peňažný trh bol v roku 2021 v miernom mínuse */
    const y2021 = compute(SETS.eur, { ...base, start: "2021-01-04", end: "2021-12-31", alloc: [0, 0, 100] }).yearly[0];
    expect(y2021.cash).toBeLessThan(0);
    expect(y2021.cash).toBeGreaterThan(-0.01);
  });

  it("majú cenovú hladinu pre celé obdobie", () => {
    for (const id of ["eur", "usd"] as const) {
      const ds = SETS[id];
      expect(cpiAt(ds, ds.day[ds.n - 1])).toBeGreaterThan(cpiAt(ds, ds.day[0]) * 1.5);
    }
    /* október 2025 v americkom indexe chýbal, musí ležať medzi susednými mesiacmi */
    const usd = SETS.usd;
    const sep = cpiAt(usd, dayOf("2025-09-15"));
    const oct = cpiAt(usd, dayOf("2025-10-15"));
    const nov = cpiAt(usd, dayOf("2025-11-15"));
    expect(oct).toBeGreaterThan(Math.min(sep, nov));
    expect(oct).toBeLessThan(Math.max(sep, nov));
  });
});

describe("dátumy a obdobie", () => {
  it("prevod tam a späť", () => {
    expect(isoOf(dayOf("2000-02-29"))).toBe("2000-02-29");
    expect(Number.isNaN(dayOf("2001-02-29"))).toBe(true);
    expect(Number.isNaN(dayOf("hocičo"))).toBe(true);
    expect(isoOf(dayOf("0002-01-04"))).toBe("0002-01-04");
    expect(dayOf("0002-01-04")).toBeLessThan(dayOf("1999-01-04"));
  });

  it("posun o mesiace drží deň a rešpektuje koniec mesiaca", () => {
    expect(isoOf(addMonths(dayOf("2015-01-31"), 1))).toBe("2015-02-28");
    expect(isoOf(addMonths(dayOf("2015-01-31"), 13))).toBe("2016-02-29");
    expect(isoOf(addMonths(dayOf("1999-01-04"), 12 * 27))).toBe("2026-01-04");
    expect(isoOf(addMonths(dayOf("2020-11-15"), 2))).toBe("2021-01-15");
  });

  it("počet rokov investovania", () => {
    expect(rowsBetween(dayOf("2006-08-31"), dayOf("2026-08-31"))).toBe(20);
    expect(rowsBetween(dayOf("2006-08-31"), dayOf("2026-09-15"))).toBe(21);
    expect(rowsBetween(dayOf("2026-08-01"), dayOf("2026-08-31"))).toBe(1);
    expect(rowsBetween(dayOf("1999-01-04"), dayOf("2026-08-31"))).toBe(28);
  });

  it("dĺžka v rokoch = posledných N rokov dát", () => {
    const ds = SETS.eur;
    const r = resolveRange(ds, { years: 20, start: "", end: "" });
    expect(isoOf(ds.day[r.i0])).toBe("2006-08-31");
    expect(r.i1).toBe(ds.n - 1);
    expect(r.startMoved).toBe(false);
    const r30 = resolveRange(ds, { years: 30, start: "", end: "" });
    expect(r30.i0).toBe(0);
    const usd = resolveRange(SETS.usd, { years: 40, start: "", end: "" });
    expect(isoOf(SETS.usd.day[usd.i0])).toBe("1986-09-02");
    /* koniec v minulosti: začiatok sa počíta od neho */
    const past = resolveRange(ds, { years: 5, start: "", end: "2015-06-30" });
    expect(isoOf(ds.day[past.i0])).toBe("2010-06-30");
    expect(isoOf(ds.day[past.i1])).toBe("2015-06-30");
  });

  it("víkend sa posunie na obchodný deň", () => {
    const ds = SETS.eur;
    const r = resolveRange(ds, { years: 20, start: "2008-03-15", end: "2020-03-22" });
    expect(isoOf(ds.day[r.i0])).toBe("2008-03-17");
    expect(isoOf(ds.day[r.i1])).toBe("2020-03-20");
    expect(r.startMoved).toBe(true);
    expect(r.endMoved).toBe(true);
    expect(lastOnOrBefore(ds.day, dayOf("1990-01-01"))).toBe(-1);
  });

  it("obdobie mimo dát sa oreže a má aspoň mesiac", () => {
    const ds = SETS.eur;
    const before = resolveRange(ds, { years: 20, start: "1950-01-01", end: "1960-01-01" });
    expect(before).toMatchObject({ i0: 0, i1: ds.n - 1, startMoved: true, endMoved: true });
    expect(resolveRange(ds, { years: 20, start: "", end: "1998-05-05" })).toMatchObject({ i1: ds.n - 1, endMoved: true });
    expect(resolveRange(ds, { years: 20, start: "2010-06-01", end: "2010-06-01" })).toMatchObject({ i1: ds.n - 1 });
    const short = resolveRange(ds, { years: 20, start: "1999-01-04", end: "1999-01-08" });
    expect(short.i0).toBe(0);
    expect(short.i1).toBe(21);
    const whole = resolveRange(ds, { years: 20, start: "1999-01-04", end: "" });
    expect(whole).toMatchObject({ i0: 0, i1: ds.n - 1, startMoved: false, endMoved: false });
  });
});

describe("vstupy", () => {
  it("váhy majú vždy súčet 100", () => {
    expect(normalizeWeights([60, 20, 20])).toEqual([60, 20, 20]);
    expect(normalizeWeights([1, 1, 1])).toEqual([34, 33, 33]);
    expect(normalizeWeights([33.3, 33.3, 33.4])).toEqual([33, 33, 34]);
    expect(normalizeWeights([77, 16.5, 6.5])).toEqual([77, 17, 6]);
    expect(normalizeWeights([53.5, 28, 18.5])).toEqual([54, 28, 18]);
    expect(normalizeWeights([200, 0, 0])).toEqual([100, 0, 0]);
    expect(normalizeWeights([0, 0, 0])).toEqual([60, 20, 20]);
    expect(normalizeWeights([-5, 50, 50])).toEqual([0, 50, 50]);
    expect(normalizeWeights("x")).toEqual([60, 20, 20]);
    for (const w of [[33.3, 33.3, 33.4], [12, 7, 3], [0.4, 0.3, 0.3]]) {
      const n = normalizeWeights(w);
      expect(n[0] + n[1] + n[2]).toBe(100);
    }
  });

  it("nezmysly nahradí rozumnými hodnotami", () => {
    const a = sanitize({ set: "gbp" as SetId, years: 500, start: "2001-02-30", end: "zajtra", initial: -5, monthly: Number.NaN, cost: 99, rebalance: "weekly" as Inputs["rebalance"], brake: "hard" as Inputs["brake"], alloc: [0, 0, 0] });
    expect(a).toMatchObject({ set: "eur", years: 64, start: "", end: "", initial: 0, monthly: 150, cost: 3, rebalance: "yearly", brake: "none", real: false, alloc: [60, 20, 20], custom: [] });
    expect(sanitize({ start: "2020-01-01", end: "2019-01-01" }).end).toBe("");
    /* vlastná brzda bez riadkov nemá zmysel; s riadkami preberá prvý riadok ako zloženie */
    expect(sanitize({ brake: "custom", custom: [] }).brake).toBe("none");
    const c = sanitize({ brake: "custom", alloc: [90, 10, 0], custom: [[70, 20, 10], [50, 30, 20]] });
    expect(c.brake).toBe("custom");
    expect(c.alloc).toEqual([70, 20, 10]);
    expect(c.custom).toEqual([[70, 20, 10], [50, 30, 20]]);
  });
});

describe("editor zloženia", () => {
  it("rozdiel vyrovná najdávnejšie upravená zložka", () => {
    expect(adjustWeights([60, 20, 20], 0, 80, [2, 1, 0])).toEqual([80, 20, 0]);
    expect(adjustWeights([80, 20, 0], 1, 10, [2, 1, 0])).toEqual([80, 10, 10]);
    expect(adjustWeights([80, 10, 10], 2, 30, [0, 1, 2])).toEqual([60, 10, 30]);
    expect(adjustWeights([60, 30, 10], 0, 90, [2, 1, 0])).toEqual([90, 10, 0]);
    expect(adjustWeights([60, 30, 10], 0, 100, [2, 1, 0])).toEqual([100, 0, 0]);
    expect(adjustWeights([60, 30, 10], 0, 0, [2, 1, 0])).toEqual([0, 30, 70]);
  });

  it("súčet je vždy 100 a hodnoty v rozsahu", () => {
    const orders = [[0, 1, 2], [2, 1, 0], [1, 0, 2], [], [1]];
    for (const order of orders)
      for (let asset = 0; asset < 3; asset++)
        for (const v of [-10, 0, 1, 33, 50, 99, 100, 140, Number.NaN]) {
          const w = adjustWeights([45, 35, 20], asset, v, order);
          expect(w[0] + w[1] + w[2]).toBe(100);
          for (const x of w) {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(100);
          }
        }
  });
});

describe("brzda", () => {
  const a = { alloc: [60, 20, 20] as Weights, brake: "none" as const, custom: [] as Weights[] };

  it("bez brzdy je zloženie každý rok rovnaké", () => {
    const rows = rowsFor(a, 20);
    expect(rows.length).toBe(20);
    expect(rows.every((w) => w[0] === 60 && w[1] === 20 && w[2] === 20)).toBe(true);
    expect(rowsFor(a, 0).length).toBe(1);
  });

  it("na cieľ a na rentu brzdí posledných 10 rokov lineárne k cieľu", () => {
    const goal = rowsFor({ ...a, brake: "goal" }, 20);
    expect(goal.slice(0, 10).every((w) => w[0] === 60)).toBe(true);
    expect(goal[19]).toEqual(GOAL_TARGET);
    expect(goal[14]).toEqual([40, 30, 30]);
    for (let k = 10; k < 20; k++) {
      expect(goal[k][0]).toBeLessThanOrEqual(goal[k - 1][0]);
      expect(goal[k][0] + goal[k][1] + goal[k][2]).toBe(100);
    }
    const rent = rowsFor({ ...a, brake: "rent" }, 20);
    expect(rent[19]).toEqual(RENT_TARGET);
    expect(rent[9]).toEqual([60, 20, 20]);
    /* kratšie obdobie než BRAKE_YEARS: brzdí sa od prvého roka */
    const short = rowsFor({ ...a, alloc: [100, 0, 0], brake: "goal" }, 5);
    expect(short[0]).toEqual([84, 8, 8]);
    expect(short[4]).toEqual(GOAL_TARGET);
    expect(BRAKE_YEARS).toBe(10);
  });

  it("vlastné riadky sa doplnia posledným riadkom alebo orežú", () => {
    const rows = rowsFor({ ...a, brake: "custom", custom: [[70, 20, 10], [50, 30, 20]] }, 4);
    expect(rows).toEqual([[70, 20, 10], [50, 30, 20], [50, 30, 20], [50, 30, 20]]);
    expect(rowsFor({ ...a, brake: "custom", custom: [[70, 20, 10], [50, 30, 20], [10, 10, 80]] }, 2)).toEqual([[70, 20, 10], [50, 30, 20]]);
    expect(rowsFor({ ...a, brake: "custom", custom: [] }, 3)).toEqual([[60, 20, 20], [60, 20, 20], [60, 20, 20]]);
  });

  it("scenár prežije cestu cez odkaz", () => {
    const a1 = sanitize({ set: "usd", years: 40, start: "", end: "", initial: 25000, monthly: 450, alloc: [80, 15, 5], brake: "rent", rebalance: "monthly", cost: 0.35, real: true });
    expect(decodeScenario(`?${encodeScenario(a1)}`)).toEqual(a1);
    const a2 = sanitize({ set: "eur", years: 12, start: "2008-03-17", end: "2020-03-20", alloc: [70, 20, 10], brake: "custom", custom: [[70, 20, 10], [70, 20, 10], [40, 40, 20]] });
    expect(decodeScenario(encodeScenario(a2))).toEqual(a2);
    expect(decodeScenario(encodeScenario(DEFAULT_INPUTS))).toEqual(DEFAULT_INPUTS);
    expect(decodeScenario("")).toBeNull();
    expect(decodeScenario("?utm_source=instagram")).toBeNull();
    expect(decodeScenario("?s=eur&a=abc-10-0")).toBeNull();
    /* poškodený odkaz sa opraví na platné hodnoty */
    const broken = decodeScenario("?s=xyz&a=500-0-0&v=-4&m=1e9&od=2001-13-45&y=999&b=custom&c=10-10-10_x-y-z");
    expect(broken).toMatchObject({ set: "eur", start: "", initial: 0, monthly: 50000, years: 64, brake: "custom" });
    expect(broken?.custom).toEqual([[34, 33, 33]]);
    expect(broken?.alloc).toEqual([34, 33, 33]);
  });
});

describe("výpočet proti nezávislej implementácii", () => {
  for (const c of CASES) {
    it(c.name, () => {
      const ds = SETS[c.inputs.set];
      const r = compute(ds, c.inputs);
      const e = c.expected;
      expect(isoOf(r.startDay)).toBe(e.start);
      expect(isoOf(r.endDay)).toBe(e.end);
      expect(r.n).toBe(e.days);
      expect(r.rows).toBe(e.rows);
      expect(r.allocation).toEqual(e.allocation);
      expect(r.depositCount).toBe(e.depositCount);
      near(r.strategy.final, e.final);
      near(r.strategy.deposits, e.deposits);
      near(r.strategy.unit[r.n - 1], e.unit);
      near(r.strategy.twr, e.twr);
      if (e.irr === null) expect(r.strategy.irr).toBeNull();
      else near(r.strategy.irr as number, e.irr, 1e-8);
      near(r.strategy.drawdown.depth, e.maxDrawdown);
      expect(isoOf(ds.day[r.i0 + r.strategy.drawdown.peak])).toBe(e.ddPeak);
      expect(isoOf(ds.day[r.i0 + r.strategy.drawdown.trough])).toBe(e.ddTrough);
      const rec = r.strategy.drawdown.recovery;
      expect(rec === null ? null : isoOf(ds.day[r.i0 + rec])).toBe(e.ddRecovery);
      near(r.strategy.volatility, e.volatility);
      expect(r.yearly.map((y) => String(y.year))).toEqual(Object.keys(e.yearly));
      const modeProfit = c.inputs.real ? "profitReal" : "profitNominal";
      const otherProfit = c.inputs.real ? "profitNominal" : "profitReal";
      for (const y of r.yearly) {
        near(y.strategy, e.yearly[String(y.year)]);
        near(y[modeProfit], e.profit[String(y.year)], 1e-8);
        near(y[otherProfit], e.otherModeProfit[String(y.year)], 1e-8);
      }
      const other = c.inputs.real ? r.nominal : r.real;
      near(other.final, e.otherModeFinal);
      near(other.deposits, e.otherModeDeposits);
      near(other.twr, e.otherModeTwr);
      near(r.stocks.final, e.stocksFinal);
      near(r.stocks.twr, e.stocksTwr);
      near(r.stocks.drawdown.depth, e.stocksMaxDrawdown);
      expect(r.crises.map((x) => x.id)).toEqual(e.crises.map((x) => x.id));
      r.crises.forEach((x, i) => {
        near(x.strategy, e.crises[i].strategy);
        near(x.stocks, e.crises[i].stocks);
      });
      if (e.rolling) {
        const roll = rolling(ds, c.inputs, e.rolling.horizon);
        expect(roll).not.toBeNull();
        if (!roll) return;
        expect(roll.rows.length).toBe(e.rolling.count);
        near(roll.annMin, e.rolling.annMin);
        near(roll.annMedian, e.rolling.annMedian);
        near(roll.annMax, e.rolling.annMax);
        near(roll.finalMin, e.rolling.finalMin);
        near(roll.finalMedian, e.rolling.finalMedian);
        near(roll.finalMax, e.rolling.finalMax);
        near(roll.positive, e.rolling.positive);
        expect(isoOf(roll.worst.start)).toBe(e.rolling.worstStart);
        expect(isoOf(roll.best.start)).toBe(e.rolling.bestStart);
      }
    });
  }
});

describe("vlastnosti výpočtu", () => {
  it("vklady sedia s počtom mesiacov", () => {
    const r = compute(SETS.eur, { ...base, start: "2010-01-04", end: "2020-01-03", initial: 5000, monthly: 200 });
    /* 4. 1. 2010 až 4. 12. 2019 = 120 mesačných vkladov, v posledný deň sa nevkladá */
    expect(r.depositCount).toBe(120);
    expect(r.strategy.deposits).toBe(5000 + 120 * 200);
    expect(r.strategy.paid[0]).toBe(5200);
    expect(r.strategy.value[0]).toBe(5200);
    expect(r.strategy.unit[0]).toBe(1);
    expect(r.rows).toBe(10);
  });

  it("zisky po rokoch sa sčítajú na celkový zisk, v oboch režimoch", () => {
    for (const real of [false, true]) {
      const r = compute(SETS.usd, { ...base, set: "usd", start: "1986-09-02", end: "2026-08-31", brake: "rent", real, cost: 0.3 });
      near(r.yearly.reduce((s, y) => s + y.profitNominal, 0), r.nominal.gain, 1e-8);
      near(r.yearly.reduce((s, y) => s + y.profitReal, 0), r.real.gain, 1e-8);
      near(r.strategy.final, (real ? r.real : r.nominal).final);
    }
  });

  it("jednorazový vklad má výnos vkladov rovný výnosu stratégie", () => {
    const r = compute(SETS.usd, { ...base, set: "usd", start: "1990-01-02", end: "2020-01-02", initial: 10000, monthly: 0 });
    near(r.strategy.irr as number, r.strategy.twr, 1e-8);
    near(r.strategy.final, 10000 * r.strategy.unit[r.n - 1]);
  });

  it("výsledok sa škáluje s vkladmi a výnos stratégie od nich takmer nezávisí", () => {
    const a = compute(SETS.eur, { ...base, initial: 10000, monthly: 300 });
    const b = compute(SETS.eur, { ...base, initial: 20000, monthly: 600 });
    near(b.strategy.final, 2 * a.strategy.final);
    near(b.strategy.twr, a.strategy.twr);
    near(b.strategy.irr as number, a.strategy.irr as number, 1e-8);
    const c = compute(SETS.eur, { ...base, initial: 50000, monthly: 0 });
    expect(Math.abs(c.strategy.twr - a.strategy.twr)).toBeLessThan(0.001);
    const d = compute(SETS.eur, { ...base, initial: 10000, monthly: 300, rebalance: "monthly" });
    const e = compute(SETS.eur, { ...base, initial: 50000, monthly: 0, rebalance: "monthly" });
    near(d.strategy.twr, e.strategy.twr);
  });

  it("stopercentné akcie sú totožné s porovnaním „len akcie“", () => {
    const r = compute(SETS.eur, { ...base, alloc: [100, 0, 0], cost: 0.4 });
    near(r.strategy.final, r.stocks.final);
    for (const y of r.yearly) expect(Math.abs(y.strategy - y.stock)).toBeLessThan(0.006);
  });

  it("náklady znižujú výnos približne o svoju výšku", () => {
    const free = compute(SETS.usd, { ...base, set: "usd", cost: 0 });
    const paid = compute(SETS.usd, { ...base, set: "usd", cost: 1 });
    expect(free.strategy.twr - paid.strategy.twr).toBeGreaterThan(0.0095);
    expect(free.strategy.twr - paid.strategy.twr).toBeLessThan(0.0115);
    expect(paid.strategy.final).toBeLessThan(free.strategy.final);
  });

  it("reálne výnosy: výnos nižší, vklady v dnešných cenách vyššie, inflácia sedí", () => {
    const nominal = compute(SETS.eur, { ...base, real: false });
    const real = compute(SETS.eur, { ...base, real: true });
    near(real.strategy.final, nominal.strategy.final);
    expect(real.strategy.deposits).toBeGreaterThan(nominal.strategy.deposits);
    expect(real.strategy.twr).toBeLessThan(nominal.strategy.twr);
    near((1 + nominal.strategy.twr) / (1 + nominal.strategy.assets.inflation) - 1, real.strategy.twr, 1e-9);
    near(real.nominal.final, nominal.nominal.final);
    near(nominal.real.twr, real.strategy.twr);
    near((1 + nominal.strategy.assets.bond) / (1 + nominal.strategy.assets.inflation) - 1, real.strategy.assets.bond);
  });

  it("brzda sa prejaví v skutočnom zložení portfólia", () => {
    const r = compute(SETS.eur, { ...base, start: "2006-08-31", end: "2026-08-31", alloc: [100, 0, 0], brake: "goal" });
    expect(r.rows).toBe(20);
    expect(r.allocation[9]).toEqual([100, 0, 0]);
    expect(r.allocation[19]).toEqual(GOAL_TARGET);
    const at = (iso: string) => r.shareStock[firstOnOrAfter(SETS.eur.day, dayOf(iso)) - r.i0];
    near(at("2016-08-30"), 1, 1e-6);
    /* 11. rok sa začína 31. 8. 2016 s cieľom 92 % akcií, 12. rok s 84 % */
    near(at("2016-08-31"), 0.92, 1e-6);
    near(at("2017-08-31"), 0.84, 1e-6);
    near(at("2026-08-31"), 0.2, 0.08);
    /* najhlbší prepad (2007 až 2009) prišiel ešte pred brzdou, po nej sú prepady plytšie ako pri čistých akciách */
    near(r.strategy.drawdown.depth, r.stocks.drawdown.depth);
    const from = firstOnOrAfter(SETS.eur.day, dayOf("2016-08-31")) - r.i0;
    expect(drawdownOf(r.strategy.unit, from).depth).toBeGreaterThan(drawdownOf(r.stocks.unit, from).depth + 0.05);
    /* bez brzdy 100 % akcií = len akcie */
    const none = compute(SETS.eur, { ...base, start: "2006-08-31", end: "2026-08-31", alloc: [100, 0, 0] });
    near(none.strategy.final, none.stocks.final);
  });

  it("výnosy zložiek za obdobie sedia so stratégiou z jedinej zložky", () => {
    const period = { start: "2003-03-12", end: "2019-11-29" };
    const mix = compute(SETS.eur, { ...base, ...period });
    const only = (w: Weights, real = false) => compute(SETS.eur, { ...base, ...period, real, alloc: w });
    near(only([100, 0, 0]).strategy.twr, mix.strategy.assets.stock);
    near(only([0, 100, 0]).strategy.twr, mix.strategy.assets.bond);
    near(only([0, 0, 100]).strategy.twr, mix.strategy.assets.cash);
    near(only([0, 100, 0], true).strategy.twr, mix.real.assets.bond);
    expect(mix.strategy.assets.inflation).toBeGreaterThan(0.01);
    expect(mix.strategy.assets.inflation).toBeLessThan(0.03);
    /* trhy: hodnota 1 investovaného na začiatku */
    near(mix.markets.stock[mix.n - 1], Math.pow(1 + mix.strategy.assets.stock, mix.years));
    near(mix.markets.inflation[mix.n - 1], Math.pow(1 + mix.strategy.assets.inflation, mix.years));
    expect(mix.markets.cash[0]).toBe(1);
  });

  it("roky označí ako neúplné len na okrajoch obdobia", () => {
    const r = compute(SETS.eur, { ...base, start: "2019-06-03", end: "2026-08-31" });
    expect(r.yearly.map((y) => y.partial)).toEqual([true, false, false, false, false, false, false, true]);
    expect(r.bestYear?.partial).toBe(false);
    const whole = compute(SETS.eur, { ...base, start: "1999-01-04", end: "2001-12-31" });
    expect(whole.yearly.map((y) => y.partial)).toEqual([false, false, false]);
    expect(whole.yearly[0].from).toBe(0);
    expect(whole.yearly[2].to).toBe(whole.n - 1);
  });

  it("krízy mimo obdobia vynechá", () => {
    const r = compute(SETS.usd, { ...base, set: "usd", start: "2005-01-03", end: "2021-12-31" });
    expect(r.crises.map((c) => c.id)).toEqual(["financna", "covid"]);
    for (const c of r.crises) {
      expect(c.stocks).toBeLessThan(-0.3);
      expect(c.strategy).toBeGreaterThan(c.stocks);
    }
  });

  it("bez vkladov meria stratégiu na pomyselnom vklade", () => {
    const lump = compute(SETS.eur, { ...base, initial: 10000, monthly: 0 });
    const none = compute(SETS.eur, { ...base, initial: 0, monthly: 0 });
    near(none.strategy.twr, lump.strategy.twr);
    near(none.strategy.drawdown.depth, lump.strategy.drawdown.depth);
    expect(none.strategy.final).toBe(0);
    expect(none.strategy.deposits).toBe(0);
    expect(none.strategy.irr).toBeNull();
    expect(none.depositCount).toBe(0);
    expect(Math.max(...none.strategy.value)).toBe(0);
    near(none.yearly[5].strategy, lump.yearly[5].strategy);
  });

  it("peňažný fond nemá veľké prepady", () => {
    const r = compute(SETS.usd, { ...base, set: "usd", alloc: [0, 0, 100] });
    expect(r.strategy.drawdown.depth).toBeGreaterThan(-0.001);
    expect(r.strategy.volatility).toBeLessThan(0.01);
  });

  it("predvolené nastavenie dáva zmysluplný výsledok v oboch súboroch", () => {
    for (const id of ["eur", "usd"] as const) {
      const r = compute(SETS[id], { ...DEFAULT_INPUTS, set: id });
      expect(r.strategy.final).toBeGreaterThan(r.strategy.deposits);
      expect(r.strategy.twr).toBeGreaterThan(0.02);
      expect(r.strategy.twr).toBeLessThan(0.12);
      expect(r.rows).toBe(20);
      expect(r.inputs.end).toBe(DATA_END);
      expect(isoOf(r.startDay)).toBe("2006-08-31");
    }
  });
});

describe("všetky možné začiatky", () => {
  it("dlhší horizont zužuje rozptyl výsledkov", () => {
    const a = rolling(SETS.usd, { ...base, set: "usd" }, 1)!;
    const b = rolling(SETS.usd, { ...base, set: "usd" }, 20)!;
    expect(a.annMax - a.annMin).toBeGreaterThan(b.annMax - b.annMin);
    expect(a.annMin).toBeLessThan(0);
    expect(b.positive).toBe(1);
    expect(a.rows.length).toBeGreaterThan(b.rows.length);
  });

  it("vráti null, keď sa horizont do dát nezmestí", () => {
    expect(rolling(SETS.eur, base, 40)).toBeNull();
    expect(rolling(SETS.usd, { ...base, set: "usd" }, 40)).not.toBeNull();
  });
});

describe("pomocné funkcie grafu", () => {
  it("vzorkovanie zachová krajné body aj extrémy", () => {
    const n = 10000;
    const s = new Float64Array(n);
    for (let i = 0; i < n; i++) s[i] = Math.sin(i / 300) * 10 + i / 1000;
    s[4321] = -500;
    s[7777] = 900;
    const idx = sampleIndexes(s, 200);
    expect(idx[0]).toBe(0);
    expect(idx[idx.length - 1]).toBe(n - 1);
    expect(idx).toContain(4321);
    expect(idx).toContain(7777);
    expect(idx.length).toBeLessThanOrEqual(200 * 3 + 1);
    for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeGreaterThan(idx[i - 1]);
    expect(sampleIndexes(new Float64Array(50), 200).length).toBe(50);
  });

  it("prepad v okne sa meria od maxima v tom okne", () => {
    const u = Float64Array.from([1, 2, 1, 1.5, 3, 1.5, 2.9, 3.1]);
    expect(drawdownOf(u)).toEqual({ depth: -0.5, peak: 1, trough: 2, recovery: 4 });
    expect(drawdownOf(u, 3)).toEqual({ depth: -0.5, peak: 4, trough: 5, recovery: 7 });
    expect(drawdownOf(u, 5, 6)).toEqual({ depth: 0, peak: 5, trough: 5, recovery: null });
    expect(drawdownOf(Float64Array.from([1, 1.1, 1.2]))).toMatchObject({ depth: 0, recovery: null });
  });
});
