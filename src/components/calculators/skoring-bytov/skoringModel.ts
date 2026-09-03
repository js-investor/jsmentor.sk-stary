import {
  MESTA,
  DISP,
  STAV,
  RENT_STAV_K,
  NJG,
  TIERN,
  M2RANGE,
  MAXP,
  type City,
  type DispDef,
  type StavDef,
  type CritKey,
  type Byt,
} from "./skoringData";

export const fmt = (n: number): string => Math.round(n).toLocaleString("sk-SK") + " €";
export const f1 = (n: number): string =>
  n.toLocaleString("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function lerp(x: number, pts: [number, number][]): number {
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
}

/* ---------- SKÓRE MESTA (0–15 b, automaticky z dát) ---------- */
const TIER_PTS: Record<City["t"], number> = { ba: 4, kk: 3.5, ok: 2, m: 1 };

export function scoreMesto(M: City): number {
  const size = M.pop >= 200000 ? 4 : M.pop >= 60000 ? 3.5 : M.pop >= 30000 ? 3 : M.pop >= 15000 ? 2 : M.pop >= 8000 ? 1 : 0.5;
  const tier = TIER_PTS[M.t] || 1;
  const trend = M.tr >= 3 ? 3 : M.tr >= 0 ? 2.2 : M.tr >= -4 ? 1.2 : 0;
  const nez = M.nez < 4 ? 2.5 : M.nez < 6 ? 1.8 : M.nez < 9 ? 1 : 0;
  const uni = M.uni === 2 ? 1.5 : M.uni === 1 ? 0.8 : 0;
  return size + tier + trend + nez + uni; // max 15
}

export function njgOf(M: City): number {
  return NJG[M.kr] ?? 4;
}

/* Dispozícia v kontexte mesta: garsónky žijú z univerzít a veľkých miest,
   v malých mestách vyhrávajú 2–3 izbové pre rodiny */
export function dispPts(M: City, dk: string): number {
  const big = M.uni === 2 || M.pop >= 60000;
  const mid = !big && M.pop >= 20000;
  const T: Record<string, number> = big
    ? { g: 7, i1: 9, i2: 8, i3: 6, i4: 3 }
    : mid
      ? { g: 5, i1: 8, i2: 9, i3: 7, i4: 4 }
      : { g: 3, i1: 6, i2: 9, i3: 8, i4: 5 };
  return T[dk] ?? 7; // max 9
}

export function mestoText(M: City): string {
  const parts = [
    `${TIERN[M.t]}`,
    `~${M.pop.toLocaleString("sk-SK")} obyv.`,
    `trend ${M.tr >= 0 ? "+" : ""}${M.tr} % / 10 r.`,
    `nezam. okresu ~${f1(M.nez)} %`,
  ];
  if (M.uni === 2) parts.push("univerzitné mesto");
  else if (M.uni === 1) parts.push("fakulta VŠ");
  return parts.join(", ");
}

export function popSeries(M: City): { rok: number; v: number }[] {
  const yNow = 2026;
  const start = M.pop / (1 + M.tr / 100);
  const pts: { rok: number; v: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    pts.push({ rok: yNow - 9 + i, v: Math.round((start + (M.pop - start) * t) / 100) * 100 });
  }
  return pts;
}

export type Flag = { sev: "crit" | "warn"; t: string };
export type Note = { cls: "" | "mot" | "warn"; t: string };

export type Result = {
  M: City;
  D: DispDef;
  S: StavDef;
  cistyRok: number;
  y: number;
  yRatio: number;
  m2c: number;
  benchM2: number;
  d: number;
  rentB: number;
  rr: number;
  fair: number;
  mScore: number;
  obsad: number;
  flags: Flag[];
  capped: boolean;
  total: number;
  p: Record<CritKey, number>;
  max: Record<CritKey, number>;
};

/* ---------- SPOLOČNÉ VÝPOČTY ---------- */
type BaseCalc = {
  M: City;
  D: DispDef;
  S: StavDef;
  cistyRok: number;
  y: number;
  yRatio: number;
  m2c: number;
  benchM2: number;
  d: number;
  rentB: number;
  rr: number;
  fair: number;
  mScore: number;
};

function baseCalc(b: Byt): BaseCalc {
  const M = MESTA[b.mesto] || MESTA.ine20;
  const D = DISP[b.disp];
  const S = STAV[b.stav];
  const cistyRok = (b.najom - b.mn) * 12 - b.rn;
  const y = (cistyRok / b.cena) * 100;
  const m2c = b.cena / b.m2;
  const benchM2 = M.m2 * D.k * S.k;
  const d = m2c / benchM2 - 1;
  const rentSk = RENT_STAV_K[b.stav] ?? 1;
  const rentB = M.nj * D.rk * rentSk; // typický nájom pre segment (vrátane stavu)
  const rr = rentB > 0 ? b.najom / rentB : 1; // pomer zadaného nájmu k typickému
  const fair = M.y > 0 ? cistyRok / (M.y / 100) : 0; // férová cena pre benchmark výnos
  return { M, D, S, cistyRok, y, yRatio: y / M.y, m2c, benchM2, d, rentB, rr, fair, mScore: scoreMesto(M) };
}

const ROZVOJ_PTS: Record<number, number> = { 5: 5, 3: 3, 0: 0 };

function pLokCalc(b: Byt): number {
  return +b.dopyt + +b.vyb + +b.mhd + (ROZVOJ_PTS[+b.rozvoj] ?? 3); // max 25
}

function podlMalus(b: Byt): number {
  return b.podl === "prizemie" ? 2 : b.podl === "top" ? 1 : 0;
}

const FOND_PTS: Record<string, number> = { primerany: 2, neviem: 1, nizky: 0 };
const BALK_PTS: Record<string, number> = { balkon: 2, terasa: 2, bez: 0 };
const ORIENT_PTS: Record<string, number> = { slnecna: 1, vychod: 1, sever: 0 };
const KUR_PTS: Record<string, number> = { czt: 1, plyn: 1, elektrina: 0 };
const PARK_PTS: Record<string, number> = { vlastne: 2, ulica: 1, problem: 0 };
const LIKV_PTS: Record<string, number> = { rychla: 2, ok: 1, pomala: 0 };

/* ---------- ANALÝZA (100 b + výstrahy) ---------- */
export function scoreDeep(b: Byt): Result {
  const c = baseCalc(b);
  const flags: Flag[] = [];
  const pMesto = Math.round(c.mScore); // 15
  let pLok = pLokCalc(b); // 25
  if (b.rychlost === "mesiac") pLok -= 2;
  if (b.rychlost === "dlho") pLok -= 5;
  pLok = Math.max(0, pLok);
  const obsad = +b.obsad || 11;
  const cistyRokObs = (b.najom * (obsad / 12) - b.mn) * 12 - b.rn;
  const yObs = (cistyRokObs / b.cena) * 100;
  const pYield = lerp(yObs / c.M.y, [
    [0.6, 0],
    [0.7, 3],
    [0.8, 5],
    [0.9, 8],
    [1.0, 12],
    [1.1, 14],
    [1.25, 17],
  ]); // 17
  const pCena = lerp(c.d, [
    [-0.1, 9],
    [-0.05, 7],
    [0, 6],
    [0.05, 4],
    [0.1, 3],
    [0.15, 1],
    [0.2, 0],
  ]); // 9
  const pStav = Math.min(9, Math.max(0, c.S.d - (b.inv === "ano" ? 3 : 0) - podlMalus(b))); // 9
  const oprArr = Array.isArray(b.opr) ? b.opr : [];
  const opr = Math.min(5, oprArr.length);
  const vyt = b.vytah === "ok" ? 2 : 0;
  const fnd = FOND_PTS[b.fond] ?? 1;
  const pDom = opr + vyt + fnd; // 9
  const pDisp = Math.round((dispPts(c.M, b.disp) * 4) / 9); // 4
  const pKomf = (BALK_PTS[b.balk] ?? 1) + (ORIENT_PTS[b.orient] ?? 1) + (KUR_PTS[b.kur] ?? 1) + (PARK_PTS[b.park] ?? 1); // 6
  const pExit = (LIKV_PTS[b.likvidita] ?? 1) + (b.horizont === "5plus" ? 1 : 0); // 3
  const ratio = b.najom > 0 ? b.mn / b.najom : 1;
  const pNakl = lerp(ratio, [
    [0.15, 3],
    [0.25, 2.5],
    [0.3, 2],
    [0.35, 1],
    [0.4, 0.5],
    [0.5, 0],
  ]); // 3

  // VÝSTRAHY
  if (b.lv === "tarcha")
    flags.push({
      sev: "crit",
      t: `<b>Na liste vlastníctva je ťarcha, exekúcia alebo vecné bremeno.</b> Bez právnika a jasného plánu výmazu do toho nechoď.`,
    });
  if (b.lv === "neviem")
    flags.push({
      sev: "warn",
      t: `<b>List vlastníctva si ešte neoveroval.</b> Katasterportál je zadarmo — sprav to pred rezervačkou, nie po nej.`,
    });
  if (c.rr > 1.25)
    flags.push({
      sev: "crit",
      t: `<b>Nájom ${fmt(b.najom)} je ~${Math.round((c.rr - 1) * 100)} % nad typickým nájmom pre ${c.D.n.toLowerCase()} v ${c.M.n} (~${fmt(c.rentB)} pri tomto stave bytu).</b> Ak je optimistický, celé skóre stojí na piesku — over reálne inzeráty, nie sľuby predávajúceho.`,
    });
  else if (c.rr > 1.1)
    flags.push({
      sev: "warn",
      t: `<b>Nájom ${fmt(b.najom)} je ~${Math.round((c.rr - 1) * 100)} % nad typickou úrovňou segmentu v ${c.M.n} (~${fmt(c.rentB)}).</b> Over ho oproti reálnym inzerátom — a pozor, do poľa patrí nájom bez energií.`,
    });
  if (c.M.nez >= 9)
    flags.push({
      sev: "warn",
      t: `<b>Nezamestnanosť okresu ~${f1(c.M.nez)} %.</b> Slabší nájomný dopyt, vyššie riziko neplatiča a pomalší exit. Výnos na papieri to musí výrazne kompenzovať.`,
    });
  if (c.M.pop < 12000 && c.M.tr <= -4)
    flags.push({
      sev: "warn",
      t: `<b>Malé a zmenšujúce sa mesto.</b> Hlavné riziko je likvidita — byt sa tu môže predávať mesiace. Kupuj len s výraznou zľavou.`,
    });
  if (b.planOprava === "prispevok") {
    if (b.fond !== "primerany")
      flags.push({
        sev: "crit",
        t: `<b>Dom čaká veľká oprava s jednorazovým príspevkom a fond ju nekryje.</b> Zisti sumu na vlastníka skôr, než podpíšeš — môžu to byť tisíce.`,
      });
    else
      flags.push({
        sev: "warn",
        t: `<b>Plánovaná oprava s príspevkom vlastníkov.</b> Fond vyzerá v poriadku, ale sumu si over na správe domu.`,
      });
  }
  if (b.fond === "nizky" && b.planOprava !== "prispevok")
    flags.push({
      sev: "warn",
      t: `<b>Nízky fond opráv.</b> Lacná záloha dnes = jednorazové zbierky zajtra. Pozri zápisnice zo schôdze vlastníkov.`,
    });
  if (obsad >= 12)
    flags.push({
      sev: "warn",
      t: `<b>Počítaš s obsadenosťou 12/12.</b> To nie je plán, to je optimizmus — jeden prázdny mesiac ročne je normál.`,
    });
  if (b.vytah === "bez")
    flags.push({
      sev: "warn",
      t: `<b>3.+ poschodie bez výťahu</b> zužuje okruh nájomníkov aj kupcov pri predaji.`,
    });
  const staryDom = b.era === "do1970" || b.era === "panel7093" || !b.era;
  if (staryDom && !oprArr.includes("zat"))
    flags.push({
      sev: "warn",
      t: `<b>Starší dom bez zateplenia.</b> Keď si bytovka vezme úver na zateplenie, fond opráv pokojne narastie o 30–50 €/mes na byt — a tvoj cashflow to zje. Zisti na správe, či sa o tom hlasovalo.`,
    });
  if (oprArr.length <= 1)
    flags.push({
      sev: "warn",
      t: `<b>Hotová je len ${oprArr.length === 0 ? "žiadna" : "1"} z 5 veľkých opráv domu.</b> Všetko ostatné ešte príde — jednorazové zbierky alebo úver domu. Zaráta si to do nákladov, nie do prekvapení.`,
    });
  if (b.kur === "elektrina")
    flags.push({
      sev: "warn",
      t: `<b>Elektrické vykurovanie</b> = vysoké prevádzkové náklady pre nájomníka. Byt sa prenajíma ťažšie a tlačí to na nižší nájom.`,
    });
  if (b.park === "problem")
    flags.push({
      sev: "warn",
      t: `<b>Problém s parkovaním</b> je jedna z najčastejších výhrad nájomníkov v krajských mestách. Počítaj s dlhším hľadaním nájomcu alebo nižším nájmom.`,
    });
  if (b.horizont === "menej")
    flags.push({
      sev: "warn",
      t: `<b>Predaj do 5 rokov = daň 19/25 % zo zisku + odvody.</b> Po 5 rokoch (FO, mimo obchodného majetku) je zisk oslobodený. Preruš 5-ročný test len s dôvodom.`,
    });

  let total = Math.round(pMesto + pLok + pYield + pCena + pStav + pDisp + pDom + pKomf + pExit + pNakl);
  const hasCrit = flags.some((f) => f.sev === "crit");
  let capped = false;
  if (hasCrit && total > 54) {
    total = 54;
    capped = true;
  }

  return {
    ...c,
    y: yObs,
    yRatio: yObs / c.M.y,
    cistyRok: cistyRokObs,
    flags,
    capped,
    total,
    obsad,
    p: {
      mesto: pMesto,
      lok: pLok,
      yield: Math.round(pYield),
      cena: Math.round(pCena),
      stav: pStav,
      disp: pDisp,
      dom: pDom,
      komf: pKomf,
      exit: pExit,
      nakl: Math.round(pNakl),
    },
    max: { ...MAXP },
  };
}

export function verdikt(total: number): { c: "g" | "y" | "r"; e: string; t: string } {
  if (total >= 75) return { c: "g", e: "🟢", t: "Kandidát na kúpu" };
  if (total >= 55) return { c: "y", e: "🟡", t: "Obhájiteľný — over detaily" };
  return { c: "r", e: "🔴", t: "Radšej nie" };
}

/* Investičný profil bytu — typológia z kombinácie mesta a výnosu */
export function profil(r: Result): { e: string; n: string; c: "g" | "y" | "r" | "" } {
  const ms = r.mScore;
  const yr = r.yRatio;
  if (ms >= 11 && yr >= 1.05) return { e: "💎", n: "Silné mesto + silný výnos", c: "g" };
  if (ms >= 11 && yr < 0.9) return { e: "🏛", n: "Apreciačná stávka — platíš za lokalitu", c: "y" };
  if (ms >= 11) return { e: "🧱", n: "Stabilný nájomný asset", c: "g" };
  if (ms < 7 && yr >= 1.1) return { e: "⚡", n: "Cashflow hráč — slabší exit", c: "y" };
  if (ms < 7 && yr < 0.95) return { e: "🪤", n: "Hodnotová pasca — slabé mesto aj výnos", c: "r" };
  if (ms < 7) return { e: "⚠️", n: "Slabý trh — kupuj len so zľavou", c: "y" };
  if (yr >= 1.05) return { e: "⚙️", n: "Solídny výnos, priemerné mesto", c: "g" };
  if (yr < 0.9) return { e: "💤", n: "Drahý na svoj trh", c: "y" };
  return { e: "⚖️", n: "Vyvážený profil", c: "" };
}

export function insights(b: Byt, r: Result): Note[] {
  const out: Note[] = [];
  const ms = r.mScore;
  const mCls: Note["cls"] = ms >= 11 ? "mot" : ms >= 7 ? "" : "warn";
  let mTxt = `<b>${r.M.n}:</b> ${mestoText(r.M)}.`;
  if (ms >= 11) mTxt += ` Silný nájomný trh — lokalita ťahá skóre hore.`;
  else if (ms < 7) mTxt += ` Slabší trh — dopyt po nájme si over dvakrát a počítaj s pomalším exitom.`;
  out.push({ cls: mCls, t: mTxt });
  if (r.rr < 0.85)
    out.push({
      cls: "mot",
      t: `Nájom <b>${fmt(b.najom)}</b> je pod typickou úrovňou ${r.M.n} (~${fmt(r.rentB)}) — priestor zdvihnúť po prvom nájomnom cykle.`,
    });
  // výnos
  if (r.yRatio >= 1.1)
    out.push({
      cls: "mot",
      t: `Čistý výnos <b>${f1(r.y)} % p.a.</b> — nadpriemer pre ${r.M.n} (trh ~${f1(r.M.y)} %). Toto je motor investície.`,
    });
  else if (r.yRatio >= 0.9)
    out.push({ cls: "", t: `Čistý výnos <b>${f1(r.y)} % p.a.</b> — v pásme trhu ${r.M.n} (~${f1(r.M.y)} %).` });
  else
    out.push({
      cls: "warn",
      t: `Čistý výnos <b>${f1(r.y)} % p.a.</b> — pod trhom ${r.M.n} (~${f1(r.M.y)} %). Buď je cena vysoká, alebo nájom nízky.`,
    });
  // cena + vyjednávacia kotva
  const pct = Math.abs(Math.round(r.d * 100));
  if (r.d <= -0.05)
    out.push({
      cls: "mot",
      t: `Cena <b>${fmt(r.m2c)}/m²</b> je ${pct} % pod benchmarkom segmentu (${r.S.n.toLowerCase()}, ${r.D.n.toLowerCase()}, ${r.M.n}: ~${fmt(r.benchM2)}/m²). Kupuješ pod trhom.`,
    });
  else if (r.d < 0.05)
    out.push({ cls: "", t: `Cena <b>${fmt(r.m2c)}/m²</b> sedí s benchmarkom segmentu (~${fmt(r.benchM2)}/m²).` });
  else if (r.p.yield / r.max.yield >= 0.72)
    out.push({
      cls: "",
      t: `Cena <b>${fmt(r.m2c)}/m²</b> je ${pct} % nad benchmarkom segmentu (~${fmt(r.benchM2)}/m²) — ale nájom to utiahne. Dá sa obhájiť.`,
    });
  else
    out.push({
      cls: "warn",
      t: `Cena <b>${fmt(r.m2c)}/m²</b> je ${pct} % nad benchmarkom segmentu (~${fmt(r.benchM2)}/m²) a výnos to nekryje. Vyjednávaj, alebo choď ďalej.`,
    });
  if (r.fair > 0 && b.cena > r.fair * 1.05)
    out.push({
      cls: "",
      t: `🎯 <b>Vyjednávacia kotva:</b> aby byt zarábal benchmark ${r.M.n} (~${f1(r.M.y)} %), férová cena pri tomto nájme je ~<b>${fmt(r.fair)}</b> (${Math.round((r.fair / b.cena - 1) * 100)} % od ceny).`,
    });
  // stres nájmu (hlboká analýza)
  {
    const y10 = (((b.najom * 0.9 * (r.obsad / 12) - b.mn) * 12 - b.rn) / b.cena) * 100;
    if (y10 >= r.M.y * 0.9)
      out.push({
        cls: "mot",
        t: `<b>Stres −10 % nájmu:</b> výnos ${f1(y10)} % — stále drží pásmo trhu. Byt má vankúš.`,
      });
    else
      out.push({
        cls: "warn",
        t: `<b>Stres −10 % nájmu:</b> výnos padá na ${f1(y10)} %, hlboko pod trh ${r.M.n}. Bez rastu nájmu ťa drží len apreciácia.`,
      });
  }
  if (b.orient === "slnecna" && b.klima !== "ano")
    out.push({
      cls: "warn",
      t: `<b>Slnečný byt (J/Z) bez klimatizácie${b.podl === "top" ? " na poslednom podlaží" : ""}.</b> Letné prehrievanie je dnes reálna výhrada nájomníkov — klíma za ~1 500 € sa vracia v rýchlejšom obsadení.`,
    });
  if (b.orient === "slnecna" && b.klima === "ano")
    out.push({ cls: "mot", t: `Slnečný byt <b>s klimatizáciou</b> — kombinácia, ktorá v lete prenajíma sama.` });
  if (b.era === "p2011")
    out.push({
      cls: "mot",
      t: `Dom z <b>2011+</b> — veľké opravy sú ďaleko, fond ostáva nízky. Menej prekvapení v nákladoch.`,
    });
  if (b.najom > 0 && b.mn / b.najom > 0.3)
    out.push({
      cls: "warn",
      t: `Náklady zožerú <b>${Math.round((b.mn / b.najom) * 100)} %</b> nájmu — nad zdravou hranicou 30 %.`,
    });
  const RG = M2RANGE[b.disp];
  if (RG && (b.m2 < RG[0] || b.m2 > RG[1]))
    out.push({
      cls: "warn",
      t: `Výmera <b>${b.m2} m²</b> je netypická pre ${r.D.n.toLowerCase()} (${RG[0]}–${RG[1]} m²) — over dispozíciu v inzeráte.`,
    });
  if (b.inv === "ano")
    out.push({ cls: "", t: `Počítaj s okamžitou investíciou — v skóre je malus, do cashflow si ju doplň tiež.` });
  return out;
}

export function validateByt(b: Byt): { ok: boolean; field?: "cena" | "m2" | "najom" } {
  if (b.cena <= 0) return { ok: false, field: "cena" };
  if (b.m2 <= 0) return { ok: false, field: "m2" };
  if (b.najom <= 0) return { ok: false, field: "najom" };
  return { ok: true };
}
