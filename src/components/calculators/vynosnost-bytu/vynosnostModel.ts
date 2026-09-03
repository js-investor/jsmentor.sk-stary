/**
 * Výnosnosť investičného bytu — model.
 * Ročná simulácia s mesačnou amortizáciou hypotéky, refixáciou po fixácii,
 * rastom nájmu a ceny, opakovanými a jednorazovými nákladmi.
 */

export type Jedno = { id: string; n: string; a: number; y: number; on: boolean };
export type Opak = { id: string; n: string; a: number; g: number; on: boolean };

export type State = {
  cena: number;
  /** Nájom celkom, čo platí nájomník, vrátane energií a služieb. */
  najom: number;
  /** Z nájmu energie a služby, ktoré vlastník posiela ďalej (prechodná položka). */
  energie: number;
  obsad: 12 | 11 | 10;
  gN: number;
  gC: number;
  vlastne: number;
  hypo: number;
  urok: number;
  roky: number;
  fix: number;
  urok2: number;
  jedno: Jedno[];
  opak: Opak[];
};

export type Row = {
  y: number;
  hodnota: number;
  dlh: number;
  najomM: number;
  naklM: number;
  cfM: number;
  spl: number;
  jednoY: number;
  kum: number;
  cisty: number;
  /** Doplatky z vlastného vrecka do začiatku roka (záporný cashflow + neskoršie jednorazové výdavky). */
  doplatky: number;
  /** Vložené vlastné zdroje spolu do začiatku roka: počiatočný kapitál + doplatky. */
  vlozene: number;
};

export const uid = () => Math.random().toString(36).slice(2, 8);

export const DEFAULT_STATE: State = {
  cena: 150000,
  najom: 800,
  energie: 150,
  obsad: 11,
  gN: 3,
  gC: 3,
  vlastne: 10000,
  hypo: 140000,
  urok: 3.5,
  roky: 30,
  fix: 5,
  urok2: 3.5,
  jedno: [
    { id: "j1", n: "Znalecký posudok", a: 300, y: 0, on: true },
    { id: "j2", n: "Provízia RK — nákup", a: 3000, y: 0, on: true },
    { id: "j3", n: "Počiatočné investície do bytu", a: 3000, y: 0, on: true },
    { id: "j4", n: "Poplatok za vybavenie hypo", a: 300, y: 0, on: true },
  ],
  opak: [
    { id: "o1", n: "Fond opráv a správa (platí vlastník)", a: 60, g: 3, on: true },
    { id: "o2", n: "Rezerva na údržbu", a: 50, g: 3, on: true },
    { id: "o3", n: "Daň z príjmu", a: 10, g: 3, on: true },
    { id: "o4", n: "Poistenie nehnuteľnosti", a: 10, g: 3, on: true },
  ],
};

export function anuita(H: number, r: number, n: number): number {
  if (n <= 0 || H <= 0) return 0;
  const i = r / 12;
  if (i <= 0) return H / n;
  return (H * i) / (1 - Math.pow(1 + i, -n));
}

export type Sim = {
  rows: Row[];
  roky: number;
  fix: number;
  spl1: number;
  spl2: number;
  kapital: number;
  jedno0: number;
  ltv: number;
  hruby: number;
  cistyVynos: number;
  prvyPlus: Row | undefined;
  nasobenie: number;
  cagr: number;
  rezerva: number;
  etf: number;
  /** Rok, v ktorom čistý majetok prvýkrát prekoná ETF alternatívu (null = nikdy). */
  etfCrossYear: number | null;
  etfSeries: number[];
};

export const ETF_RATE = 0.1;

export function simulate(S: State): Sim {
  const roky = Math.max(5, Math.min(40, Math.round(S.roky) || 30));
  const fix = Math.max(1, Math.min(15, Math.round(S.fix) || 5));
  const spl1 = anuita(S.hypo, S.urok / 100, roky * 12);
  const obsad = S.obsad / 12;
  const energie = Math.max(0, Math.min(S.najom, S.energie || 0));

  const jedno0 = S.jedno.reduce((a, o) => a + (o.on && o.y === 0 ? o.a : 0), 0);
  const kapital = S.vlastne + jedno0;
  const rows: Row[] = [];
  let dlh = S.hypo;
  let kum = 0;
  let doplatky = 0;
  let spl2: number | null = null;

  for (let y = 0; y <= roky; y++) {
    const splY = y < fix ? spl1 : (spl2 ?? spl1);
    const hodnota = S.cena * Math.pow(1 + S.gC / 100, y);
    // Príjem: nájom vrátane energií podľa obsadenosti. Náklady: energie (aj pri neobsadení) + opakované výdavky.
    const najomM = S.najom * obsad * Math.pow(1 + S.gN / 100, y);
    const naklM = energie * Math.pow(1 + S.gN / 100, y) + S.opak.reduce((a, o) => a + (o.on ? o.a * Math.pow(1 + (o.g || 0) / 100, y) : 0), 0);
    const jednoY = S.jedno.reduce((a, o) => a + (o.on && o.y === y ? o.a : 0), 0);
    const cfM = najomM - splY - naklM;
    rows.push({ y, hodnota, dlh, najomM, naklM, cfM, spl: splY, jednoY, kum, cisty: hodnota - dlh + kum, doplatky, vlozene: kapital + doplatky });

    if (y < roky) {
      for (let m = 0; m < 12; m++) {
        const mes = y * 12 + m;
        const rr = (mes < fix * 12 ? S.urok : S.urok2) / 100;
        const splM = mes < fix * 12 ? spl1 : (spl2 ?? spl1);
        const ur = (dlh * rr) / 12;
        dlh = Math.max(0, dlh - (splM - ur));
        if (mes + 1 === fix * 12) spl2 = anuita(dlh, S.urok2 / 100, roky * 12 - fix * 12);
      }
      kum += cfM * 12 - (y > 0 ? jednoY : 0);
      doplatky += Math.max(0, -cfM) * 12 + (y > 0 ? jednoY : 0);
    }
  }

  const R0 = rows[0];
  const RL = rows[roky];
  const ltv = S.cena > 0 ? (S.hypo / S.cena) * 100 : 0;
  const hruby = S.cena > 0 ? (((S.najom - energie) * 12) / S.cena) * 100 : 0;
  const cistyVynos = S.cena + jedno0 > 0 ? (((R0.najomM - R0.naklM) * 12) / (S.cena + jedno0)) * 100 : 0;
  const prvyPlus = rows.find((o) => o.y > 0 && o.cfM > 0);
  const nasobenie = kapital > 0 ? RL.cisty / kapital : 0;
  const cagr = kapital > 0 && RL.cisty > 0 ? (Math.pow(RL.cisty / kapital, 1 / roky) - 1) * 100 : 0;
  const rezerva = (R0.spl + R0.naklM) * 6;
  // ETF alternatíva: rovnaké vlastné peniaze (počiatočný kapitál aj každý doplatok) investované pri ETF_RATE
  const etfSeries: number[] = [kapital];
  for (let y = 1; y <= roky; y++) {
    const prev = rows[y - 1];
    const added = Math.max(0, -prev.cfM) * 12 + (y - 1 > 0 ? prev.jednoY : 0);
    etfSeries.push(etfSeries[y - 1] * (1 + ETF_RATE) + added);
  }
  const etf = etfSeries[roky];
  let etfCrossYear: number | null = null;
  for (let y = 1; y <= roky; y++) {
    if (rows[y].cisty > etfSeries[y]) {
      etfCrossYear = y;
      break;
    }
  }

  return { rows, roky, fix, spl1, spl2: spl2 ?? spl1, kapital, jedno0, ltv, hruby, cistyVynos, prvyPlus, nasobenie, cagr, rezerva, etf, etfCrossYear, etfSeries };
}

/* ------------------------------------------------------------------ stres test */

export type StressId = "urok" | "najom" | "cena";

export const STRESS: { id: StressId; label: string; desc: string; apply: (s: State) => State }[] = [
  { id: "urok", label: "Úrok po fixácii +2 p. b.", desc: "Refixácia pri vyšších sadzbách.", apply: (s) => ({ ...s, urok2: s.urok2 + 2 }) },
  { id: "najom", label: "Výpadok nájmu: 10 mesiacov", desc: "Dva mesiace ročne bez nájomcu.", apply: (s) => ({ ...s, obsad: 10 }) },
  { id: "cena", label: "Ceny bytov stagnujú (0 %)", desc: "Žiadny rast ceny nehnuteľnosti.", apply: (s) => ({ ...s, gC: 0 }) },
];

export function applyStress(S: State, active: StressId[]): State {
  return STRESS.filter((t) => active.includes(t.id)).reduce((s, t) => t.apply(s), S);
}

/* ------------------------------------------------------------------ deal skóre a verdikt */

const lerp = (x: number, pts: [number, number][]) => {
  if (x <= pts[0][0]) return pts[0][1];
  if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
};

export type DealScore = {
  total: number;
  parts: { key: "cagr" | "yield" | "cashflow" | "risk"; label: string; pts: number; max: number; note: string }[];
};

/**
 * Deal skóre 0–100: výnos na vlastný kapitál (35), čistý výnos z nájmu (25),
 * cashflow v prvom roku (20) a riziko páky/refixácie/obsadenosti (20).
 */
export function dealScore(sim: Sim, S: State): DealScore {
  const R0 = sim.rows[0];
  const cagr = Math.round(lerp(sim.cagr, [[0, 0], [4, 10], [8, 25], [12, 35]]));
  const yld = Math.round(lerp(sim.cistyVynos, [[1, 0], [3, 10], [5, 20], [7, 25]]));
  const cfRatio = R0.najomM > 0 ? R0.cfM / R0.najomM : -1;
  const cashflow = Math.round(lerp(cfRatio, [[-0.5, 0], [-0.2, 8], [0, 14], [0.2, 20]]));
  let risk = 20;
  const riskNotes: string[] = [];
  if (sim.ltv > 90) {
    risk -= 10;
    riskNotes.push("LTV nad 90 %");
  } else if (sim.ltv > 85) {
    risk -= 6;
    riskNotes.push("LTV nad 85 %");
  }
  const refix = sim.spl1 > 0 ? (sim.spl2 - sim.spl1) / sim.spl1 : 0;
  if (refix > 0.25) {
    risk -= 10;
    riskNotes.push("refixácia +25 % splátky");
  } else if (refix > 0.1) {
    risk -= 5;
    riskNotes.push("refixácia +10 % splátky");
  }
  if (S.obsad === 12) {
    risk -= 4;
    riskNotes.push("obsadenosť 12/12");
  }
  risk = Math.max(0, risk);
  const parts: DealScore["parts"] = [
    { key: "cagr", label: "Výnos na vlastný kapitál", pts: cagr, max: 35, note: `${sim.cagr.toFixed(1).replace(".", ",")} % p. a.` },
    { key: "yield", label: "Čistý výnos z nájmu", pts: yld, max: 25, note: `${sim.cistyVynos.toFixed(1).replace(".", ",")} % p. a.` },
    { key: "cashflow", label: "Cashflow od začiatku", pts: cashflow, max: 20, note: `${Math.round(R0.cfM) >= 0 ? "+" : "−"}${Math.abs(Math.round(R0.cfM))} € / mes.` },
    { key: "risk", label: "Riziko páky a refixácie", pts: risk, max: 20, note: riskNotes.length ? riskNotes.join(", ") : "bez väčších rizík" },
  ];
  return { total: cagr + yld + cashflow + risk, parts };
}

export type Verdict = { id: "dobry" | "priemer" | "slaby"; label: string; text: string };

export function verdict(score: number): Verdict {
  if (score >= 75) return { id: "dobry", label: "Dáva zmysel", text: "Výnos na vlastný kapitál prekonáva bežné investície a byt sa prakticky platí sám." };
  if (score >= 55) return { id: "priemer", label: "Ujde, s rezervou", text: "Investícia funguje, ale závisí od rastu nájmu a refixácie. Drž rezervu a sleduj úroky." };
  return { id: "slaby", label: "Prepočítaj to", text: "Čísla sú tenké: nízky výnos, drahá kúpa alebo vysoké doplácanie. Skús vyjednať cenu alebo nájom." };
}

/* ------------------------------------------------------------------ odolnosť voči stresu */

export type Resilience = { id: StressId; label: string; ok: boolean; minCf: number; cagr: number }[];

/**
 * Byt „prežije“ stres test, ak CAGR ostane aspoň 3 % a najhorší mesačný cashflow neklesne
 * o viac než 150 € pod najhorší cashflow základného scenára (a nie pod −150 €, ak je základ kladný).
 */
export function resilience(S: State): Resilience {
  const baseMin = Math.min(...simulate(S).rows.map((r) => r.cfM));
  const floor = Math.min(-150, baseMin - 150);
  return STRESS.map((t) => {
    const sim = simulate(t.apply(S));
    const minCf = Math.min(...sim.rows.map((r) => r.cfM));
    return { id: t.id, label: t.label, ok: minCf >= floor && sim.cagr >= 3, minCf, cagr: sim.cagr };
  });
}
