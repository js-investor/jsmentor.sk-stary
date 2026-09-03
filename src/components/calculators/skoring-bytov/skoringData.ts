/* ============ DATABÁZA MIEST ============
   t: ba=hlavné mesto, kk=krajské, ok=okresné, m=iné mesto/obec
   pop: obyvateľstvo (ŠÚ SR ~2024, orientačne)
   tr:  trend obyvateľstva % za ~10 rokov (orientačne)
   nez: nezamestnanosť okresu % (ÚPSVaR 2026, orientačne)
   uni: 2=univerzita, 1=fakulta/pobočka VŠ, 0=nie
   m2:  benchmark €/m² staršieho 2-izb. bytu (NBS/RÚ 1Q 2026;
        pri okresných mestách odhad)
   nj:  typický mesačný nájom 2-izb. bez energií € (odhad)
   y:   benchmark čistého ročného výnosu % */

export type City = {
  n: string;
  kr: string;
  t: "ba" | "kk" | "ok" | "m";
  pop: number;
  tr: number;
  nez: number;
  uni: 0 | 1 | 2;
  m2: number;
  nj: number;
  y: number;
};

export const KRAJE: Record<string, string> = {
  ba: "Bratislavský kraj",
  tt: "Trnavský kraj",
  tn: "Trenčiansky kraj",
  nr: "Nitriansky kraj",
  za: "Žilinský kraj",
  bb: "Banskobystrický kraj",
  po: "Prešovský kraj",
  ke: "Košický kraj",
  x: "Mimo zoznamu",
};

export const TIERN: Record<City["t"], string> = {
  ba: "Hlavné mesto",
  kk: "Krajské mesto",
  ok: "Okresné mesto",
  m: "Mesto / obec",
};

export const MESTA: Record<string, City> = {
  ba: { n: "Bratislava", kr: "ba", t: "ba", pop: 476000, tr: 3, nez: 3.0, uni: 2, m2: 4500, nj: 900, y: 3.6 },
  pk: { n: "Pezinok", kr: "ba", t: "ok", pop: 24000, tr: 4, nez: 4.1, uni: 0, m2: 3300, nj: 760, y: 4.1 },
  sc: { n: "Senec", kr: "ba", t: "ok", pop: 21500, tr: 15, nez: 4.0, uni: 0, m2: 3400, nj: 760, y: 4.1 },
  ma: { n: "Malacky", kr: "ba", t: "ok", pop: 18500, tr: 5, nez: 3.6, uni: 0, m2: 2900, nj: 660, y: 4.4 },
  st: { n: "Stupava", kr: "ba", t: "m", pop: 13500, tr: 18, nez: 3.6, uni: 0, m2: 3300, nj: 760, y: 4.1 },
  tt: { n: "Trnava", kr: "tt", t: "kk", pop: 64000, tr: 1, nez: 3.3, uni: 2, m2: 3150, nj: 680, y: 4.2 },
  pn: { n: "Piešťany", kr: "tt", t: "ok", pop: 26000, tr: -4, nez: 3.6, uni: 0, m2: 2800, nj: 620, y: 4.5 },
  ds: { n: "Dunajská Streda", kr: "tt", t: "ok", pop: 23500, tr: 2, nez: 4.0, uni: 0, m2: 2600, nj: 560, y: 4.7 },
  hc: { n: "Hlohovec", kr: "tt", t: "ok", pop: 20000, tr: -4, nez: 3.9, uni: 0, m2: 2400, nj: 540, y: 4.9 },
  se: { n: "Senica", kr: "tt", t: "ok", pop: 19500, tr: -4, nez: 4.3, uni: 0, m2: 2200, nj: 520, y: 5.1 },
  sd: { n: "Sereď", kr: "tt", t: "m", pop: 16000, tr: -3, nez: 3.2, uni: 0, m2: 2500, nj: 560, y: 4.8 },
  ga: { n: "Galanta", kr: "tt", t: "ok", pop: 15000, tr: -2, nez: 3.2, uni: 0, m2: 2500, nj: 560, y: 4.8 },
  si: { n: "Skalica", kr: "tt", t: "ok", pop: 14000, tr: -3, nez: 3.8, uni: 1, m2: 2300, nj: 520, y: 5.0 },
  tn: { n: "Trenčín", kr: "tn", t: "kk", pop: 54000, tr: -3, nez: 3.0, uni: 2, m2: 2700, nj: 600, y: 4.7 },
  pd: { n: "Prievidza", kr: "tn", t: "ok", pop: 43000, tr: -7, nez: 4.3, uni: 0, m2: 2200, nj: 490, y: 5.1 },
  pb: { n: "Považská Bystrica", kr: "tn", t: "ok", pop: 38000, tr: -5, nez: 3.8, uni: 0, m2: 2200, nj: 490, y: 5.1 },
  dca: { n: "Dubnica nad Váhom", kr: "tn", t: "m", pop: 23000, tr: -5, nez: 3.2, uni: 1, m2: 2300, nj: 500, y: 5.0 },
  pe: { n: "Partizánske", kr: "tn", t: "ok", pop: 21000, tr: -6, nez: 4.0, uni: 0, m2: 2000, nj: 450, y: 5.4 },
  nm: { n: "Nové Mesto nad Váhom", kr: "tn", t: "ok", pop: 19500, tr: -4, nez: 3.0, uni: 0, m2: 2500, nj: 540, y: 4.8 },
  pu: { n: "Púchov", kr: "tn", t: "ok", pop: 17000, tr: -4, nez: 2.8, uni: 1, m2: 2300, nj: 500, y: 5.0 },
  bn: { n: "Bánovce nad Bebravou", kr: "tn", t: "ok", pop: 17000, tr: -5, nez: 3.6, uni: 0, m2: 2100, nj: 460, y: 5.3 },
  my: { n: "Myjava", kr: "tn", t: "ok", pop: 11000, tr: -6, nez: 3.3, uni: 0, m2: 1900, nj: 430, y: 5.6 },
  nr: { n: "Nitra", kr: "nr", t: "kk", pop: 78000, tr: -2, nez: 2.6, uni: 2, m2: 2750, nj: 620, y: 4.8 },
  nz: { n: "Nové Zámky", kr: "nr", t: "ok", pop: 36000, tr: -5, nez: 4.3, uni: 0, m2: 2200, nj: 490, y: 5.1 },
  kn: { n: "Komárno", kr: "nr", t: "ok", pop: 32000, tr: -6, nez: 4.8, uni: 2, m2: 2000, nj: 450, y: 5.4 },
  lv: { n: "Levice", kr: "nr", t: "ok", pop: 30000, tr: -6, nez: 4.6, uni: 0, m2: 2000, nj: 450, y: 5.4 },
  to: { n: "Topoľčany", kr: "nr", t: "ok", pop: 24000, tr: -6, nez: 4.3, uni: 0, m2: 2100, nj: 470, y: 5.3 },
  sa: { n: "Šaľa", kr: "nr", t: "ok", pop: 21000, tr: -5, nez: 3.2, uni: 0, m2: 2100, nj: 480, y: 5.3 },
  zm: { n: "Zlaté Moravce", kr: "nr", t: "ok", pop: 11500, tr: -5, nez: 3.3, uni: 0, m2: 1900, nj: 430, y: 5.6 },
  za: { n: "Žilina", kr: "za", t: "kk", pop: 82000, tr: -1, nez: 3.8, uni: 2, m2: 3050, nj: 640, y: 4.3 },
  mt: { n: "Martin", kr: "za", t: "ok", pop: 52000, tr: -5, nez: 4.5, uni: 1, m2: 2500, nj: 520, y: 4.8 },
  lm: { n: "Liptovský Mikuláš", kr: "za", t: "ok", pop: 30000, tr: -4, nez: 4.5, uni: 0, m2: 2800, nj: 560, y: 4.6 },
  rk: { n: "Ružomberok", kr: "za", t: "ok", pop: 26000, tr: -4, nez: 4.5, uni: 2, m2: 2500, nj: 520, y: 4.8 },
  ca: { n: "Čadca", kr: "za", t: "ok", pop: 23000, tr: -6, nez: 4.5, uni: 0, m2: 2000, nj: 440, y: 5.4 },
  dk: { n: "Dolný Kubín", kr: "za", t: "ok", pop: 18500, tr: -4, nez: 4.0, uni: 0, m2: 2500, nj: 500, y: 4.8 },
  knm: { n: "Kysucké Nové Mesto", kr: "za", t: "ok", pop: 14500, tr: -5, nez: 4.0, uni: 0, m2: 2200, nj: 460, y: 5.1 },
  by: { n: "Bytča", kr: "za", t: "ok", pop: 11000, tr: -3, nez: 3.8, uni: 0, m2: 2300, nj: 470, y: 5.0 },
  ts: { n: "Tvrdošín", kr: "za", t: "ok", pop: 9500, tr: 2, nez: 3.8, uni: 0, m2: 2400, nj: 470, y: 4.9 },
  no: { n: "Námestovo", kr: "za", t: "ok", pop: 8000, tr: 3, nez: 4.0, uni: 0, m2: 2600, nj: 500, y: 4.7 },
  bb: { n: "Banská Bystrica", kr: "bb", t: "kk", pop: 76000, tr: -3, nez: 4.1, uni: 2, m2: 3100, nj: 620, y: 4.4 },
  zv: { n: "Zvolen", kr: "bb", t: "ok", pop: 40000, tr: -4, nez: 4.2, uni: 2, m2: 2700, nj: 560, y: 4.6 },
  lc: { n: "Lučenec", kr: "bb", t: "ok", pop: 25000, tr: -6, nez: 7.5, uni: 0, m2: 1800, nj: 420, y: 5.8 },
  rs: { n: "Rimavská Sobota", kr: "bb", t: "ok", pop: 22000, tr: -7, nez: 14.0, uni: 0, m2: 1400, nj: 350, y: 6.5 },
  br: { n: "Brezno", kr: "bb", t: "ok", pop: 20000, tr: -7, nez: 5.8, uni: 0, m2: 2000, nj: 430, y: 5.4 },
  zh: { n: "Žiar nad Hronom", kr: "bb", t: "ok", pop: 18000, tr: -6, nez: 5.0, uni: 0, m2: 2100, nj: 450, y: 5.3 },
  dt: { n: "Detva", kr: "bb", t: "ok", pop: 14000, tr: -6, nez: 5.2, uni: 0, m2: 1900, nj: 420, y: 5.6 },
  vk: { n: "Veľký Krtíš", kr: "bb", t: "ok", pop: 11500, tr: -7, nez: 6.0, uni: 0, m2: 1500, nj: 360, y: 6.3 },
  re: { n: "Revúca", kr: "bb", t: "ok", pop: 11500, tr: -8, nez: 10.0, uni: 0, m2: 1300, nj: 320, y: 6.8 },
  bs: { n: "Banská Štiavnica", kr: "bb", t: "ok", pop: 10000, tr: -4, nez: 6.0, uni: 0, m2: 2200, nj: 470, y: 5.1 },
  ku: { n: "Krupina", kr: "bb", t: "ok", pop: 8000, tr: -3, nez: 6.2, uni: 0, m2: 1800, nj: 400, y: 5.8 },
  po: { n: "Prešov", kr: "po", t: "kk", pop: 84000, tr: -4, nez: 6.5, uni: 2, m2: 2700, nj: 560, y: 5.0 },
  pp: { n: "Poprad", kr: "po", t: "ok", pop: 49000, tr: -4, nez: 5.5, uni: 1, m2: 3000, nj: 620, y: 4.5 },
  hn: { n: "Humenné", kr: "po", t: "ok", pop: 30000, tr: -6, nez: 5.5, uni: 0, m2: 1900, nj: 430, y: 5.6 },
  bj: { n: "Bardejov", kr: "po", t: "ok", pop: 30000, tr: -5, nez: 8.0, uni: 0, m2: 2100, nj: 450, y: 5.3 },
  vt: { n: "Vranov nad Topľou", kr: "po", t: "ok", pop: 21000, tr: -5, nez: 8.5, uni: 0, m2: 1700, nj: 400, y: 6.0 },
  sn: { n: "Snina", kr: "po", t: "ok", pop: 18000, tr: -8, nez: 7.0, uni: 0, m2: 1600, nj: 380, y: 6.2 },
  kk: { n: "Kežmarok", kr: "po", t: "ok", pop: 16000, tr: -2, nez: 9.5, uni: 0, m2: 2300, nj: 460, y: 5.0 },
  sl: { n: "Stará Ľubovňa", kr: "po", t: "ok", pop: 16000, tr: -1, nez: 6.0, uni: 0, m2: 2100, nj: 450, y: 5.3 },
  le: { n: "Levoča", kr: "po", t: "ok", pop: 14000, tr: -3, nez: 6.5, uni: 0, m2: 2100, nj: 450, y: 5.3 },
  sb: { n: "Sabinov", kr: "po", t: "ok", pop: 12000, tr: 1, nez: 8.5, uni: 0, m2: 2000, nj: 420, y: 5.4 },
  sk: { n: "Svidník", kr: "po", t: "ok", pop: 10000, tr: -6, nez: 7.5, uni: 0, m2: 1700, nj: 390, y: 6.0 },
  sp: { n: "Stropkov", kr: "po", t: "ok", pop: 10000, tr: -5, nez: 6.5, uni: 0, m2: 1700, nj: 390, y: 6.0 },
  ke: { n: "Košice", kr: "ke", t: "kk", pop: 229000, tr: -1, nez: 4.5, uni: 2, m2: 3500, nj: 680, y: 4.2 },
  mi: { n: "Michalovce", kr: "ke", t: "ok", pop: 36000, tr: -5, nez: 7.5, uni: 1, m2: 2100, nj: 470, y: 5.3 },
  snv: { n: "Spišská Nová Ves", kr: "ke", t: "ok", pop: 35000, tr: -4, nez: 6.5, uni: 0, m2: 2300, nj: 480, y: 5.0 },
  tv: { n: "Trebišov", kr: "ke", t: "ok", pop: 22000, tr: -4, nez: 8.5, uni: 0, m2: 1600, nj: 380, y: 6.2 },
  rv: { n: "Rožňava", kr: "ke", t: "ok", pop: 18000, tr: -5, nez: 9.5, uni: 0, m2: 1500, nj: 380, y: 6.3 },
  mo: { n: "Moldava nad Bodvou", kr: "ke", t: "m", pop: 11500, tr: 2, nez: 7.0, uni: 0, m2: 1800, nj: 420, y: 5.8 },
  kp: { n: "Krompachy", kr: "ke", t: "m", pop: 8500, tr: -4, nez: 9.0, uni: 0, m2: 1200, nj: 300, y: 7.0 },
  ine20: { n: "Iné mesto 15–40 tis.", kr: "x", t: "m", pop: 20000, tr: -4, nez: 6.0, uni: 0, m2: 2000, nj: 450, y: 5.4 },
  ine10: { n: "Iné mesto do 15 tis.", kr: "x", t: "m", pop: 10000, tr: -4, nez: 6.5, uni: 0, m2: 1800, nj: 400, y: 5.8 },
  obec: { n: "Obec / dedina", kr: "x", t: "m", pop: 3000, tr: -3, nez: 6.5, uni: 0, m2: 1600, nj: 350, y: 6.0 },
};

export type DispKey = "g" | "i1" | "i2" | "i3" | "i4";
export type DispDef = { n: string; k: number; rk: number };
export const DISP: Record<DispKey, DispDef> = {
  g: { n: "Garsónka", k: 1.15, rk: 0.7 },
  i1: { n: "1-izbový", k: 1.12, rk: 0.82 },
  i2: { n: "2-izbový", k: 1.0, rk: 1.0 },
  i3: { n: "3-izbový", k: 0.92, rk: 1.28 },
  i4: { n: "4-izbový", k: 0.88, rk: 1.5 },
};

export const M2RANGE: Record<DispKey, [number, number]> = {
  g: [18, 32],
  i1: [28, 45],
  i2: [40, 68],
  i3: [58, 90],
  i4: [75, 120],
};

export type StavKey = "povodny" | "ciastocna" | "kompletna" | "novostavba";
export type StavDef = { n: string; k: number; d: number };
export const STAV: Record<StavKey, StavDef> = {
  povodny: { n: "Pôvodný stav", k: 0.85, d: 3 },
  ciastocna: { n: "Čiastočná rekonštrukcia", k: 0.95, d: 6 },
  kompletna: { n: "Kompletná rekonštrukcia", k: 1.1, d: 8 },
  novostavba: { n: "Novostavba", k: 1.2, d: 10 },
};

/* Koeficient stavu bytu pre typický nájom segmentu */
export const RENT_STAV_K: Record<StavKey, number> = {
  povodny: 0.9,
  ciastocna: 1.0,
  kompletna: 1.1,
  novostavba: 1.2,
};

/* Rast nájmov % ročne — kraj, orientačne */
export const NJG: Record<string, number> = { ba: 6, tt: 5, tn: 4, nr: 4, za: 5, bb: 4, po: 5, ke: 5, x: 3 };

export const MAXB = 6;
export const STORAGE_KEY = "jsm_skoring_bytov";

export type CritKey = "mesto" | "lok" | "yield" | "cena" | "stav" | "disp" | "dom" | "komf" | "exit" | "nakl";

export const CRIT: { key: CritKey; label: string }[] = [
  { key: "mesto", label: "Mesto (dáta)" },
  { key: "lok", label: "Lokalita & dopyt" },
  { key: "yield", label: "Čistý výnos" },
  { key: "cena", label: "Cena vs. trh" },
  { key: "stav", label: "Stav bytu" },
  { key: "disp", label: "Dispozícia × mesto" },
  { key: "dom", label: "Dom & opravy" },
  { key: "komf", label: "Vybavenie & komfort" },
  { key: "exit", label: "Exit" },
  { key: "nakl", label: "Náklady" },
];

export const MAXP: Record<CritKey, number> = {
  mesto: 15,
  lok: 25,
  yield: 17,
  cena: 9,
  stav: 9,
  disp: 4,
  dom: 9,
  komf: 6,
  exit: 3,
  nakl: 3,
};

/* Priemery slovenských miest v databáze (na porovnávacie grafy) */
export const AVG: { nez: number; nj: number } = (() => {
  const cs = Object.values(MESTA).filter((m) => m.kr !== "x");
  return {
    nez: cs.reduce((a, m) => a + m.nez, 0) / cs.length,
    nj: cs.reduce((a, m) => a + m.nj, 0) / cs.length,
  };
})();

export type OprKey = "zat" | "str" | "stu" | "okn" | "vyt";

export const OPR_OPTIONS: { value: OprKey; label: string }[] = [
  { value: "zat", label: "Zateplenie fasády" },
  { value: "str", label: "Strecha" },
  { value: "stu", label: "Stúpačky (voda, odpad)" },
  { value: "okn", label: "Okná a vchod" },
  { value: "vyt", label: "Výťah — nový / po GO" },
];

export type Byt = {
  id: string;
  n: string;
  mesto: string;
  disp: keyof typeof DISP;
  stav: keyof typeof STAV;
  podl: "prizemie" | "std" | "top";
  balk: "balkon" | "terasa" | "bez";
  inv: "nie" | "ano";
  cena: number;
  m2: number;
  najom: number;
  mn: number;
  rn: number;
  dopyt: number;
  vyb: number;
  mhd: number;
  rozvoj: number;
  rychlost: "rychlo" | "mesiac" | "dlho";
  obsad: 10 | 11 | 12;
  lv: "cisty" | "neviem" | "tarcha";
  fond: "primerany" | "neviem" | "nizky";
  era: "do1970" | "panel7093" | "p9410" | "p2011";
  opr: OprKey[];
  planOprava: "nie" | "kryta" | "prispevok";
  vytah: "ok" | "bez";
  park: "vlastne" | "ulica" | "problem";
  orient: "slnecna" | "vychod" | "sever";
  klima: "nie" | "ano";
  kur: "czt" | "plyn" | "elektrina";
  likvidita: "rychla" | "ok" | "pomala";
  horizont: "5plus" | "menej";
};

export const DEFAULT_BYT: Byt = {
  id: "",
  n: "",
  mesto: "ba",
  disp: "i2",
  stav: "ciastocna",
  podl: "std",
  balk: "balkon",
  inv: "nie",
  cena: 0,
  m2: 0,
  najom: 0,
  mn: 0,
  rn: 0,
  dopyt: 5,
  vyb: 4,
  mhd: 3,
  rozvoj: 3,
  rychlost: "mesiac",
  obsad: 11,
  lv: "neviem",
  fond: "neviem",
  era: "panel7093",
  opr: [],
  planOprava: "nie",
  vytah: "ok",
  park: "ulica",
  orient: "vychod",
  klima: "nie",
  kur: "czt",
  likvidita: "ok",
  horizont: "5plus",
};

/* ===== Deklaratívny popis formulára ===== */
export type FieldDef = {
  key: keyof Byt;
  label: string;
  kind: "text" | "number" | "select" | "checks";
  options?: { value: string | number; label: string }[];
  placeholder?: string;
  hint?: string;
  unit?: string;
  min?: number;
  wide?: boolean;
};

export const FORM_SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Základné údaje",
    fields: [
      { key: "n", label: "Názov / adresa", kind: "text", placeholder: "napr. Vlčince, 2-izb., 5. p.", wide: true },
      { key: "mesto", label: "Mesto", kind: "select", options: [] },
      {
        key: "disp",
        label: "Dispozícia",
        kind: "select",
        options: (Object.keys(DISP) as DispKey[]).map((k) => ({ value: k, label: DISP[k].n })),
      },
      {
        key: "stav",
        label: "Stav bytu",
        kind: "select",
        options: (Object.keys(STAV) as StavKey[]).map((k) => ({ value: k, label: STAV[k].n })),
      },
      {
        key: "podl",
        label: "Podlažie",
        kind: "select",
        options: [
          { value: "prizemie", label: "Prízemie" },
          { value: "std", label: "Stredné podlažie" },
          { value: "top", label: "Posledné podlažie" },
        ],
      },
      {
        key: "balk",
        label: "Balkón / exteriér",
        kind: "select",
        options: [
          { value: "balkon", label: "Balkón / loggia" },
          { value: "terasa", label: "Terasa / predzáhradka" },
          { value: "bez", label: "Bez vonkajšieho priestoru" },
        ],
      },
      {
        key: "inv",
        label: "Vyžaduje hneď investíciu?",
        kind: "select",
        options: [
          { value: "nie", label: "Nie" },
          { value: "ano", label: "Áno (rekonštrukcia, spotrebiče…)" },
        ],
      },
    ],
  },
  {
    title: "Čísla",
    fields: [
      { key: "cena", label: "Cena bytu €", kind: "number", placeholder: "150 000", min: 1, unit: "€" },
      { key: "m2", label: "Výmera m²", kind: "number", placeholder: "52", min: 10, unit: "m²" },
      { key: "najom", label: "Mesačný nájom € (bez energií)", kind: "number", placeholder: "620", min: 0, unit: "€" },
      { key: "mn", label: "Mesačné náklady € (fond, správa)", kind: "number", placeholder: "130", min: 0, unit: "€" },
      { key: "rn", label: "Ročné náklady € (daň, poistenie)", kind: "number", placeholder: "300", min: 0, unit: "€" },
    ],
  },
  {
    title: "Lokalita",
    fields: [
      {
        key: "dopyt",
        label: "Poloha v meste",
        kind: "select",
        options: [
          { value: 8, label: "Centrum / široké centrum" },
          { value: 7, label: "Dobrá štvrť, žiadaná" },
          { value: 5, label: "Sídlisko s vybavenosťou" },
          { value: 2, label: "Okraj / slabý dopyt" },
        ],
      },
      {
        key: "vyb",
        label: "Práca, školy, nemocnica v okolí",
        kind: "select",
        options: [
          { value: 7, label: "Áno, silné zázemie" },
          { value: 4, label: "Čiastočne" },
          { value: 1, label: "Nie" },
        ],
      },
      {
        key: "mhd",
        label: "MHD / dostupnosť",
        kind: "select",
        options: [
          { value: 5, label: "Výborná" },
          { value: 3, label: "V poriadku" },
          { value: 1, label: "Slabá" },
        ],
      },
      {
        key: "rozvoj",
        label: "Rozvoj lokality (projekty, výstavba)",
        kind: "select",
        options: [
          { value: 5, label: "Rastie — nové projekty, služby" },
          { value: 3, label: "Stagnuje" },
          { value: 0, label: "Upadá" },
        ],
      },
    ],
  },
  {
    title: "Nájomný trh",
    fields: [
      {
        key: "rychlost",
        label: "Ako rýchlo sa tu prenajíma?",
        kind: "select",
        options: [
          { value: "rychlo", label: "Do 2 týždňov" },
          { value: "mesiac", label: "Do mesiaca" },
          { value: "dlho", label: "Dlhšie / neviem" },
        ],
      },
      {
        key: "obsad",
        label: "Počítaš s obsadenosťou",
        kind: "select",
        options: [
          { value: 11, label: "11 mesiacov (zdravý predpoklad)" },
          { value: 12, label: "12 mesiacov (optimizmus)" },
          { value: 10, label: "10 mesiacov (konzervatívne)" },
        ],
      },
    ],
  },
  {
    title: "Právny stav & bytový dom",
    fields: [
      {
        key: "lv",
        label: "List vlastníctva",
        kind: "select",
        options: [
          { value: "cisty", label: "Čistý — bez tiarch a exekúcií" },
          { value: "neviem", label: "Ešte som neoveroval" },
          { value: "tarcha", label: "Je tam ťarcha / exekúcia / vecné bremeno" },
        ],
      },
      {
        key: "fond",
        label: "Fond opráv",
        kind: "select",
        options: [
          { value: "primerany", label: "Primeraný / dobre naplnený" },
          { value: "neviem", label: "Neviem" },
          { value: "nizky", label: "Nízky" },
        ],
      },
      {
        key: "era",
        label: "Éra výstavby domu",
        kind: "select",
        options: [
          { value: "do1970", label: "Pred 1970 (tehla, staršia zástavba)" },
          { value: "panel7093", label: "1970–1993 (panelák)" },
          { value: "p9410", label: "1994–2010" },
          { value: "p2011", label: "2011 a novšie" },
        ],
      },
      {
        key: "opr",
        label: "Veľké opravy domu — označ, čo je hotové",
        kind: "checks",
        options: OPR_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
        wide: true,
      },
      {
        key: "planOprava",
        label: "Plánovaná veľká oprava / zbierka?",
        kind: "select",
        options: [
          { value: "nie", label: "Nie" },
          { value: "kryta", label: "Áno — krytá fondom" },
          { value: "prispevok", label: "Áno — bude jednorazový príspevok" },
        ],
      },
      {
        key: "vytah",
        label: "Výťah",
        kind: "select",
        options: [
          { value: "ok", label: "Výťah je / do 2. poschodia" },
          { value: "bez", label: "3. poschodie a vyššie bez výťahu" },
        ],
      },
      {
        key: "park",
        label: "Parkovanie pri dome",
        kind: "select",
        options: [
          { value: "vlastne", label: "Vlastné / vyhradené státie" },
          { value: "ulica", label: "Verejné — bez problémov" },
          { value: "problem", label: "Problém zaparkovať" },
        ],
      },
    ],
  },
  {
    title: "Komfort bytu",
    fields: [
      {
        key: "orient",
        label: "Orientácia / svetlo",
        kind: "select",
        options: [
          { value: "slnecna", label: "Slnečná (J / JZ / Z)" },
          { value: "vychod", label: "Východná / kombinovaná" },
          { value: "sever", label: "Severná / tmavá" },
        ],
      },
      {
        key: "klima",
        label: "Klimatizácia",
        kind: "select",
        options: [
          { value: "nie", label: "Nie" },
          { value: "ano", label: "Áno" },
        ],
      },
      {
        key: "kur",
        label: "Vykurovanie",
        kind: "select",
        options: [
          { value: "czt", label: "Ústredné (CZT)" },
          { value: "plyn", label: "Vlastný kotol (plyn)" },
          { value: "elektrina", label: "Elektrické" },
        ],
      },
    ],
  },
  {
    title: "Exit",
    fields: [
      {
        key: "likvidita",
        label: "Ako rýchlo sa tu predáva?",
        kind: "select",
        options: [
          { value: "rychla", label: "Rýchlo — žiadaná lokalita" },
          { value: "ok", label: "Štandardne" },
          { value: "pomala", label: "Pomaly / neviem" },
        ],
      },
      {
        key: "horizont",
        label: "Plánuješ držať aspoň 5 rokov?",
        kind: "select",
        options: [
          { value: "5plus", label: "Áno, 5+ rokov" },
          { value: "menej", label: "Nie / neviem" },
        ],
      },
    ],
  },
];
