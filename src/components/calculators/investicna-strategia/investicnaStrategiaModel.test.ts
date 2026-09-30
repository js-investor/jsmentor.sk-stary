import { describe, expect, it } from "vitest";
import { DATA_END, RAW, UNIT } from "./investicnaStrategiaData";
import { CASES } from "./investicnaStrategia.cases";
import {
  DEFAULT_INPUTS,
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
  presetsFor,
  resolveRange,
  rolling,
  samePhases,
  sampleIndexes,
  sanitize,
  weightsAt,
  type Dataset,
  type Inputs,
  type SetId,
} from "./investicnaStrategiaModel";

const SETS: Record<SetId, Dataset> = { eur: decodeSet("eur", RAW.eur, UNIT), usd: decodeSet("usd", RAW.usd, UNIT) };
const near = (actual: number, expected: number, rel = 1e-9) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(expected)));
const base: Inputs = { ...DEFAULT_INPUTS, phases: [{ from: 0, w: [60, 20, 20] }], transition: 0 };

describe("historické dáta", () => {
  it("majú správny rozsah a dĺžku", () => {
    expect(isoOf(SETS.eur.day[0])).toBe("1999-01-04");
    expect(isoOf(SETS.usd.day[0])).toBe("1962-01-02");
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
    const y2008 = compute(usd, { ...base, set: "usd", start: "2008-01-02", end: "2008-12-31", phases: [{ from: 0, w: [100, 0, 0] }] }).yearly[0];
    expect(y2008.stock).toBeLessThan(-0.35);
    expect(y2008.stock).toBeGreaterThan(-0.39);
    expect(y2008.bond).toBeGreaterThan(0.15);
    /* záporné sadzby v eurozóne: peňažný trh bol v roku 2021 v miernom mínuse */
    const y2021 = compute(SETS.eur, { ...base, start: "2021-01-04", end: "2021-12-31", phases: [{ from: 0, w: [0, 0, 100] }] }).yearly[0];
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

describe("dátumy", () => {
  it("prevod tam a späť", () => {
    expect(isoOf(dayOf("2000-02-29"))).toBe("2000-02-29");
    expect(Number.isNaN(dayOf("2001-02-29"))).toBe(true);
    expect(Number.isNaN(dayOf("hocičo"))).toBe(true);
  });

  it("posun o mesiace drží deň a rešpektuje koniec mesiaca", () => {
    expect(isoOf(addMonths(dayOf("2015-01-31"), 1))).toBe("2015-02-28");
    expect(isoOf(addMonths(dayOf("2015-01-31"), 13))).toBe("2016-02-29");
    expect(isoOf(addMonths(dayOf("1999-01-04"), 12 * 27))).toBe("2026-01-04");
    expect(isoOf(addMonths(dayOf("2020-11-15"), 2))).toBe("2021-01-15");
  });

  it("víkend sa posunie na obchodný deň", () => {
    const ds = SETS.eur;
    const r = resolveRange(ds, "2008-03-15", "2020-03-22");
    expect(isoOf(ds.day[r.i0])).toBe("2008-03-17");
    expect(isoOf(ds.day[r.i1])).toBe("2020-03-20");
    expect(r.startMoved).toBe(true);
    expect(r.endMoved).toBe(true);
    expect(lastOnOrBefore(ds.day, dayOf("1990-01-01"))).toBe(-1);
  });

  it("obdobie mimo dát sa oreže a má aspoň mesiac", () => {
    const ds = SETS.eur;
    /* celé obdobie pred začiatkom dát: počíta sa od prvého dňa, koniec sa berie ako nezadaný */
    const before = resolveRange(ds, "1950-01-01", "1960-01-01");
    expect(before).toMatchObject({ i0: 0, i1: ds.n - 1, startMoved: true, endMoved: true });
    expect(resolveRange(ds, "", "1998-05-05")).toMatchObject({ i0: 0, i1: ds.n - 1, endMoved: true });
    expect(resolveRange(ds, "2010-06-01", "2010-06-01")).toMatchObject({ i1: ds.n - 1 });
    const short = resolveRange(ds, "", "1999-01-08");
    expect(short.i0).toBe(0);
    expect(short.i1).toBe(21);
    const after = resolveRange(ds, "2090-01-01", "2095-01-01");
    expect(after.i1).toBe(ds.n - 1);
    expect(after.i1 - after.i0).toBeGreaterThanOrEqual(21);
    const whole = resolveRange(ds, "", "");
    expect(whole).toMatchObject({ i0: 0, i1: ds.n - 1, startMoved: false, endMoved: false });
  });
});

describe("vstupy", () => {
  it("váhy majú vždy súčet 100", () => {
    expect(normalizeWeights([60, 20, 20])).toEqual([60, 20, 20]);
    expect(normalizeWeights([1, 1, 1])).toEqual([34, 33, 33]);
    expect(normalizeWeights([200, 0, 0])).toEqual([100, 0, 0]);
    expect(normalizeWeights([0, 0, 0])).toEqual([60, 20, 20]);
    expect(normalizeWeights([-5, 50, 50])).toEqual([0, 50, 50]);
    expect(normalizeWeights("x")).toEqual([60, 20, 20]);
    for (const w of [[33.3, 33.3, 33.4], [12, 7, 3], [0.4, 0.3, 0.3]]) {
      const n = normalizeWeights(w);
      expect(n[0] + n[1] + n[2]).toBe(100);
    }
  });

  it("fázy sú zoradené, prvá od začiatku a najviac štyri", () => {
    const a = sanitize({ phases: [{ from: 20, w: [30, 40, 30] }, { from: 5, w: [100, 0, 0] }, { from: 20, w: [50, 25, 25] }, { from: 30, w: [10, 10, 80] }, { from: 40, w: [0, 0, 100] }] });
    expect(a.phases.map((p) => p.from)).toEqual([0, 20, 21, 30]);
    expect(a.phases[0].w).toEqual([100, 0, 0]);
  });

  it("nezmysly nahradí rozumnými hodnotami", () => {
    const a = sanitize({ set: "gbp" as SetId, start: "2001-02-30", end: "zajtra", initial: -5, monthly: Number.NaN, cost: 99, transition: 50, rebalance: "weekly" as Inputs["rebalance"], phases: [] });
    expect(a).toMatchObject({ set: "eur", start: "", end: "", initial: 0, monthly: 300, cost: 3, transition: 10, rebalance: "yearly", real: false });
    expect(a.phases).toEqual(DEFAULT_INPUTS.phases);
    expect(sanitize({ start: "2020-01-01", end: "2019-01-01" }).end).toBe("");
  });
});

describe("editor stratégie", () => {
  it("rozdiel vyrovná najdávnejšie upravená zložka", () => {
    expect(adjustWeights([60, 20, 20], 0, 80, [2, 1, 0])).toEqual([80, 20, 0]);
    expect(adjustWeights([80, 20, 0], 1, 10, [2, 1, 0])).toEqual([80, 10, 10]);
    expect(adjustWeights([80, 10, 10], 2, 30, [0, 1, 2])).toEqual([60, 10, 30]);
    /* naposledy upravená ustúpi, až keď sa nezmestí */
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

  it("predvoľby sú platné a životný cyklus sa prispôsobí dĺžke obdobia", () => {
    for (const years of [0.2, 1, 5, 10, 27.66, 64.7]) {
      const presets = presetsFor(years);
      expect(presets.map((p) => p.id)).toEqual(["dynamicka", "vyvazena", "konzervativna", "zivotny-cyklus"]);
      for (const p of presets) expect(samePhases(sanitize({ phases: p.phases }).phases, p.phases)).toBe(true);
    }
    expect(presetsFor(27.66)[3].phases.map((p) => p.from)).toEqual([0, 15, 22]);
    expect(presetsFor(10)[3].phases.map((p) => p.from)).toEqual([0, 6, 8]);
    /* desať kalendárnych rokov je o pár hodín menej ako 10 × 365,25 dňa */
    expect(presetsFor(3652 / 365.25)[3].phases.map((p) => p.from)).toEqual([0, 6, 8]);
    expect(samePhases(presetsFor(27.66)[3].phases, DEFAULT_INPUTS.phases)).toBe(true);
  });

  it("scenár prežije cestu cez odkaz", () => {
    const a = sanitize({ set: "usd", start: "1987-08-25", end: "2020-03-23", initial: 25000, monthly: 450, transition: 4, rebalance: "monthly", cost: 0.35, real: true, phases: [{ from: 0, w: [100, 0, 0] }, { from: 12, w: [55, 30, 15] }] });
    expect(decodeScenario(`?${encodeScenario(a)}`)).toEqual(a);
    expect(decodeScenario(encodeScenario(DEFAULT_INPUTS))).toEqual(DEFAULT_INPUTS);
    expect(decodeScenario("")).toBeNull();
    expect(decodeScenario("?utm_source=instagram")).toBeNull();
    expect(decodeScenario("?s=eur&f=0-abc-10-0")).toBeNull();
    /* poškodený odkaz sa opraví na platné hodnoty */
    const broken = decodeScenario("?s=xyz&f=0-500-0-0_3-10-10-10&v=-4&m=1e9&od=2001-13-45");
    expect(broken).toMatchObject({ set: "eur", start: "", initial: 0, monthly: 50000 });
    expect(broken?.phases).toEqual([{ from: 0, w: [100, 0, 0] }, { from: 3, w: [34, 33, 33] }]);
  });
});

describe("cieľový pomer", () => {
  const phases = [
    { from: 0, w: [90, 10, 0] as [number, number, number] },
    { from: 10, w: [60, 30, 10] as [number, number, number] },
    { from: 12, w: [30, 40, 30] as [number, number, number] },
  ];

  it("zmena naraz platí od prvého dňa fázy", () => {
    expect(weightsAt(phases, 0, 9.99)).toEqual([0.9, 0.1, 0]);
    expect(weightsAt(phases, 0, 10)).toEqual([0.6, 0.3, 0.1]);
    expect(weightsAt(phases, 0, 50)).toEqual([0.3, 0.4, 0.3]);
  });

  it("postupný prechod sa začína v prvom roku fázy a skončí najneskôr pri ďalšej", () => {
    expect(weightsAt(phases, 4, 10)).toEqual([0.9, 0.1, 0]);
    const half = weightsAt(phases, 4, 11);
    near(half[0], 0.75);
    near(half[1], 0.2);
    near(half[2], 0.05);
    /* druhá fáza má na prechod len 2 roky, potom sa začína tretia */
    expect(weightsAt(phases, 4, 12)).toEqual([0.6, 0.3, 0.1]);
    const late = weightsAt(phases, 4, 14);
    near(late[0], 0.45);
    near(late[1], 0.35);
    near(late[2], 0.2);
    expect(weightsAt(phases, 4, 16)).toEqual([0.3, 0.4, 0.3]);
    for (const t of [0, 3.5, 10.25, 11.9, 13, 40]) {
      const w = weightsAt(phases, 4, t);
      near(w[0] + w[1] + w[2], 1);
    }
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
      for (const y of r.yearly) near(y.strategy, e.yearly[String(y.year)]);
      near(r.stocks.final, e.stocksFinal);
      near(r.stocks.twr, e.stocksTwr);
      near(r.stocks.drawdown.depth, e.stocksMaxDrawdown);
      if (r.flat) {
        near(r.flat.final, e.flatFinal);
        near(r.flat.twr, e.flatTwr);
        near(r.flat.drawdown.depth, e.flatMaxDrawdown);
      } else {
        near(r.strategy.final, e.flatFinal);
      }
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
        expect(isoOf(roll.rows[0].start)).toBe(e.rolling.firstStart);
        expect(isoOf(roll.rows[roll.rows.length - 1].start)).toBe(e.rolling.lastStart);
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
    expect(r.paid[0]).toBe(5200);
    expect(r.strategy.value[0]).toBe(5200);
    expect(r.strategy.unit[0]).toBe(1);
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
    /* pri ročnom vyvažovaní nové vklady mierne doťahujú pomer k cieľu, rozdiel je v stotinách percenta */
    const c = compute(SETS.eur, { ...base, initial: 50000, monthly: 0 });
    expect(Math.abs(c.strategy.twr - a.strategy.twr)).toBeLessThan(0.001);
    /* pri mesačnom vyvažovaní je zloženie v každom okamihu rovnaké, výnos stratégie je totožný */
    const d = compute(SETS.eur, { ...base, initial: 10000, monthly: 300, rebalance: "monthly" });
    const e = compute(SETS.eur, { ...base, initial: 50000, monthly: 0, rebalance: "monthly" });
    near(d.strategy.twr, e.strategy.twr);
  });

  it("stopercentné akcie sú totožné s porovnaním „len akcie“", () => {
    const r = compute(SETS.eur, { ...base, phases: [{ from: 0, w: [100, 0, 0] }], cost: 0.4 });
    near(r.strategy.final, r.stocks.final);
    for (const y of r.yearly) expect(Math.abs(y.strategy - y.stock)).toBeLessThan(0.006);
    expect(r.flat).toBeNull();
    expect(r.afterChange).toBeNull();
  });

  it("náklady znižujú výnos približne o svoju výšku", () => {
    const free = compute(SETS.usd, { ...base, set: "usd", cost: 0 });
    const paid = compute(SETS.usd, { ...base, set: "usd", cost: 1 });
    expect(free.strategy.twr - paid.strategy.twr).toBeGreaterThan(0.0095);
    expect(free.strategy.twr - paid.strategy.twr).toBeLessThan(0.0115);
    expect(paid.strategy.final).toBeLessThan(free.strategy.final);
  });

  it("po očistení o infláciu je výnos nižší a vklady v dnešných cenách vyššie", () => {
    const nominal = compute(SETS.eur, { ...base, real: false });
    const real = compute(SETS.eur, { ...base, real: true });
    near(real.strategy.final, nominal.strategy.final);
    expect(real.strategy.deposits).toBeGreaterThan(nominal.strategy.deposits);
    expect(real.strategy.twr).toBeLessThan(nominal.strategy.twr);
    const inflation = Math.pow(cpiAt(SETS.eur, nominal.endDay) / cpiAt(SETS.eur, nominal.startDay), 1 / nominal.years) - 1;
    near((1 + nominal.strategy.twr) / (1 + inflation) - 1, real.strategy.twr, 1e-9);
  });

  it("zmena stratégie sa prejaví v skutočnom zložení portfólia", () => {
    const r = compute(SETS.eur, { ...base, start: "2000-01-03", end: "2026-08-31", transition: 0, phases: [{ from: 0, w: [100, 0, 0] }, { from: 10, w: [20, 50, 30] }] });
    const change = r.phaseStarts[1] as number;
    expect(isoOf(SETS.eur.day[r.i0 + change])).toBe("2010-01-04");
    expect(r.shareStock[change - 1]).toBeGreaterThan(0.999);
    near(r.shareStock[change], 0.2, 1e-6);
    near(r.shareBond[change], 0.5, 1e-6);
    expect(r.afterChange).not.toBeNull();
    /* po preklopení sú prepady plytšie ako pri čistých akciách */
    expect(Math.abs(r.afterChange!.strategy.depth)).toBeLessThan(Math.abs(r.afterChange!.flat.depth));
    /* fáza po konci obdobia sa neuplatní */
    const short = compute(SETS.eur, { ...base, start: "2015-01-05", end: "2020-01-03", phases: [{ from: 0, w: [80, 20, 0] }, { from: 10, w: [20, 50, 30] }] });
    expect(short.phaseStarts).toEqual([0, null]);
    expect(short.afterChange).toBeNull();
    near(short.strategy.final, short.flat!.final);
  });

  it("postupný prechod mení zloženie plynulo", () => {
    const r = compute(SETS.eur, { ...base, start: "2000-01-03", end: "2026-08-31", transition: 5, rebalance: "monthly", phases: [{ from: 0, w: [100, 0, 0] }, { from: 10, w: [50, 50, 0] }] });
    const at = (iso: string) => r.shareStock[firstOnOrAfter(SETS.eur.day, dayOf(iso)) - r.i0];
    near(at("2010-01-04"), 1, 1e-6);
    near(at("2012-07-03"), 0.75, 1e-6);
    near(at("2015-01-05"), 0.5, 1e-6);
    near(at("2020-01-03"), 0.5, 1e-6);
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

  it("výnosy zložiek za obdobie sedia so stratégiou z jedinej zložky", () => {
    const period = { start: "2003-03-12", end: "2019-11-29" };
    const mix = compute(SETS.eur, { ...base, ...period });
    const only = (w: [number, number, number], real = false) => compute(SETS.eur, { ...base, ...period, real, phases: [{ from: 0, w }] });
    near(only([100, 0, 0]).strategy.twr, mix.assets.stock);
    near(only([0, 100, 0]).strategy.twr, mix.assets.bond);
    near(only([0, 0, 100]).strategy.twr, mix.assets.cash);
    const real = compute(SETS.eur, { ...base, ...period, real: true });
    near(only([0, 100, 0], true).strategy.twr, real.assets.bond);
    near((1 + mix.assets.bond) / (1 + mix.assets.inflation) - 1, real.assets.bond);
    expect(mix.assets.inflation).toBeGreaterThan(0.01);
    expect(mix.assets.inflation).toBeLessThan(0.03);
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
    near(none.shareStock[3000], lump.shareStock[3000], 1e-6);
    const roll = rolling(SETS.eur, { ...base, initial: 0, monthly: 0 }, 10)!;
    const rollLump = rolling(SETS.eur, { ...base, initial: 500, monthly: 0 }, 10)!;
    near(roll.annMedian, rollLump.annMedian);
    expect(roll.finalMax).toBe(0);
  });

  it("peňažný fond nemá veľké prepady", () => {
    const r = compute(SETS.usd, { ...base, set: "usd", phases: [{ from: 0, w: [0, 0, 100] }] });
    expect(r.strategy.drawdown.depth).toBeGreaterThan(-0.001);
    expect(r.strategy.volatility).toBeLessThan(0.01);
  });

  it("predvolené nastavenie dáva zmysluplný výsledok v oboch súboroch", () => {
    for (const id of ["eur", "usd"] as const) {
      const r = compute(SETS[id], { ...DEFAULT_INPUTS, set: id });
      expect(r.strategy.final).toBeGreaterThan(r.strategy.deposits);
      expect(r.strategy.twr).toBeGreaterThan(0.02);
      expect(r.strategy.twr).toBeLessThan(0.12);
      expect(r.flat).not.toBeNull();
      expect(r.yearly.length).toBeGreaterThan(20);
      expect(r.inputs.start).toBe(isoOf(SETS[id].day[0]));
      expect(r.inputs.end).toBe(DATA_END);
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
