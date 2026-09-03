/**
 * Finančný check-up — metodika.
 *
 * Základ: FinHealth Score® (Financial Health Network) — 8 indikátorov v pilieroch
 * Spend / Save / Borrow / Plan, každá odpoveď 0–100 bodov, skóre = priemer indikátorov,
 * pásma 0–39 zraniteľné, 40–79 zvládaš, 80–100 zdravé. K tomu piaty pilier „Rast“
 * (pravidelnosť investovania a poplatková disciplína) a objektívne ukazovatele z reálnych
 * čísel domácnosti (rezerva v mesiacoch, miera úspor, splátky vs. príjem, majetok vs. vek).
 * Pocitová časť: dve položky CFPB Financial Well-Being Scale, mimo skóre.
 */

import type { LucideIcon } from "lucide-react";
import { CreditCard, PiggyBank, ShieldCheck, TrendingUp, Wallet } from "lucide-react";

export type PillarId = "spend" | "save" | "borrow" | "plan" | "grow";

export type Pillar = {
  id: PillarId;
  label: string;
  /** Otázka, na ktorú pilier odpovedá. */
  question: string;
  Icon: LucideIcon;
  /** Farebná rola dlaždice (CSS trieda). */
  tone: "sand" | "mint" | "terra" | "ink" | "forest";
};

export const PILLARS: Pillar[] = [
  { id: "spend", label: "Míňaš", question: "Miniem menej, než zarobím?", Icon: Wallet, tone: "sand" },
  { id: "save", label: "Šetríš", question: "Mám rezervu a dlhodobé úspory?", Icon: PiggyBank, tone: "mint" },
  { id: "borrow", label: "Dlhy", question: "Sú moje dlhy zvládnuteľné?", Icon: CreditCard, tone: "terra" },
  { id: "plan", label: "Chrániš", question: "Som chránený a plánujem dopredu?", Icon: ShieldCheck, tone: "ink" },
  { id: "grow", label: "Rastieš", question: "Rastie môj majetok efektívne?", Icon: TrendingUp, tone: "forest" },
];

/* ------------------------------------------------------------------ číselné vstupy */

export type Numbers = {
  age: number;
  /** Čistý mesačný príjem domácnosti. */
  income: number;
  /** Bežné mesačné výdavky bez splátok. */
  expenses: number;
  /** Mesačné splátky všetkých úverov vrátane hypotéky. */
  payments: number;
  /** Likvidná rezerva (účet, sporiaci účet, peňažný fond). */
  reserve: number;
  /** Investície a dlhodobé úspory (ETF, akcie, 2./3. pilier, sporenie na dôchodok). */
  invested: number;
  /** Koľko mesačne investuje. */
  monthlyInvest: number;
};

export const DEFAULT_NUMBERS: Numbers = {
  age: 35,
  income: 1800,
  expenses: 1100,
  payments: 350,
  reserve: 2000,
  invested: 8000,
  monthlyInvest: 100,
};

export type NumberField = {
  key: keyof Numbers;
  label: string;
  hint?: string;
  unit: "rokov" | "€" | "€ / mes";
  step: number;
  min: number;
  max: number;
};

export type NumberScreen = { id: string; lead: string; title: string; fields: NumberField[] };

export const NUMBER_SCREENS: NumberScreen[] = [
  {
    id: "mesiac",
    lead: "Začnime tvojím bežným mesiacom.",
    title: "Koľko ti príde a koľko odíde?",
    fields: [
      { key: "age", label: "Tvoj vek", unit: "rokov", step: 1, min: 18, max: 80 },
      { key: "income", label: "Čistý mesačný príjem domácnosti", hint: "všetci, kto prispievajú", unit: "€ / mes", step: 50, min: 0, max: 50000 },
      { key: "expenses", label: "Bežné výdavky bez splátok", hint: "bývanie, jedlo, deti, auto", unit: "€ / mes", step: 50, min: 0, max: 50000 },
      { key: "payments", label: "Splátky úverov spolu", hint: "hypotéka, spotrebáky, leasing, kreditky", unit: "€ / mes", step: 10, min: 0, max: 50000 },
    ],
  },
  {
    id: "majetok",
    lead: "Teraz to, čo už máš.",
    title: "Aký majetok stojí za tebou?",
    fields: [
      { key: "reserve", label: "Rezerva, ku ktorej sa dostaneš do pár dní", hint: "účet, sporiaci účet, peňažný fond", unit: "€", step: 500, min: 0, max: 5000000 },
      { key: "invested", label: "Investície a dlhodobé úspory", hint: "ETF, akcie, 2. a 3. pilier, sporenie na dôchodok", unit: "€", step: 1000, min: 0, max: 50000000 },
      { key: "monthlyInvest", label: "Mesačne investuješ", hint: "pravidelne, automaticky", unit: "€ / mes", step: 10, min: 0, max: 50000 },
    ],
  },
];

/* ------------------------------------------------------------------ otázky s výberom */

export type Option = { label: string; points: number };

export type ChoiceQuestion = {
  id: string;
  /** Indikátor v skóre, alebo "wellbeing" (mimo skóre). */
  indicator: IndicatorId | "wellbeing";
  pillar?: PillarId;
  lead: string;
  text: string;
  hint?: string;
  options: Option[];
  /** Zdroj otázky — zobrazí sa malým písmom. */
  source: "FinHealth" | "CFPB" | "JS Mentor";
};

export const CHOICE_QUESTIONS: ChoiceQuestion[] = [
  {
    id: "bills",
    indicator: "bills",
    pillar: "spend",
    lead: "Disciplína v bežnom mesiaci.",
    text: "Ako tvoja domácnosť platila účty a splátky za posledných 12 mesiacov?",
    source: "FinHealth",
    options: [
      { label: "Všetky načas", points: 100 },
      { label: "Takmer všetky načas", points: 60 },
      { label: "Väčšinu načas", points: 40 },
      { label: "Niektoré načas", points: 20 },
      { label: "Len málo z nich načas", points: 0 },
    ],
  },
  {
    id: "discipline",
    indicator: "discipline",
    pillar: "borrow",
    lead: "Ako ťa dnes vidí banka.",
    text: "Aká je tvoja úverová história?",
    hint: "Na Slovensku ju banky čítajú z registrov, nie zo skóre ako v USA.",
    source: "JS Mentor",
    options: [
      { label: "Nikdy som nemeškal(a) so splátkou", points: 100 },
      { label: "Nemám žiadnu úverovú históriu", points: 70 },
      { label: "Raz-dvakrát som meškal(a) do 30 dní", points: 55 },
      { label: "Meškal(a) som opakovane alebo mi zamietli úver", points: 20 },
      { label: "Som po splatnosti, mám exekúciu alebo záznam", points: 0 },
    ],
  },
  {
    id: "insurance",
    indicator: "insurance",
    pillar: "plan",
    lead: "Čo keď sa niečo stane.",
    text: "Nakoľko si istý(á), že tvoje poistenie (život, PN, invalidita, majetok) ťa a rodinu v núdzi naozaj podrží?",
    source: "FinHealth",
    options: [
      { label: "Úplne istý(á)", points: 100 },
      { label: "Dosť istý(á)", points: 75 },
      { label: "Čiastočne istý(á)", points: 50 },
      { label: "Skôr neistý(á)", points: 25 },
      { label: "Vôbec nie", points: 10 },
      { label: "Nemám žiadne poistenie", points: 0 },
    ],
  },
  {
    id: "plans",
    indicator: "plans",
    pillar: "plan",
    lead: "Pohľad dopredu.",
    text: "„Moja domácnosť plánuje financie dopredu.“ Nakoľko to sedí?",
    source: "FinHealth",
    options: [
      { label: "Úplne súhlasím", points: 100 },
      { label: "Skôr súhlasím", points: 65 },
      { label: "Ani áno, ani nie", points: 35 },
      { label: "Skôr nesúhlasím", points: 15 },
      { label: "Vôbec nesúhlasím", points: 0 },
    ],
  },
  {
    id: "fees",
    indicator: "fees",
    pillar: "grow",
    lead: "Úprimne, bez hanby.",
    text: "Vieš, do čoho presne investuješ a koľko za to ročne platíš na poplatkoch?",
    source: "JS Mentor",
    options: [
      { label: "Presne. Nízkonákladové ETF, stratégiu mám na papieri", points: 100 },
      { label: "Viem, čo mám, poplatky poznám približne", points: 70 },
      { label: "Mám produkt od agenta, poplatky nepoznám", points: 30 },
      { label: "Neinvestujem, ale viem, ako by som začal(a)", points: 20 },
      { label: "Neinvestujem a netuším, kde začať", points: 0 },
    ],
  },
  {
    id: "wb1",
    indicator: "wellbeing",
    lead: "Na záver dve vety o pocite.",
    text: "„Zvládol(a) by som väčší nečakaný výdavok.“ Nakoľko ťa to vystihuje?",
    source: "CFPB",
    options: [
      { label: "Úplne", points: 100 },
      { label: "Veľmi dobre", points: 75 },
      { label: "Čiastočne", points: 50 },
      { label: "Veľmi málo", points: 25 },
      { label: "Vôbec", points: 0 },
    ],
  },
  {
    id: "wb2",
    indicator: "wellbeing",
    lead: "Posledná.",
    text: "„Moje financie riadia môj život.“ Nakoľko ťa to vystihuje?",
    source: "CFPB",
    options: [
      { label: "Úplne", points: 0 },
      { label: "Veľmi dobre", points: 25 },
      { label: "Čiastočne", points: 50 },
      { label: "Veľmi málo", points: 75 },
      { label: "Vôbec", points: 100 },
    ],
  },
];

/* ------------------------------------------------------------------ indikátory a skóre */

export type IndicatorId =
  | "spendRate"
  | "bills"
  | "reserve"
  | "longTerm"
  | "dsti"
  | "discipline"
  | "insurance"
  | "plans"
  | "investRate"
  | "fees";

export type Indicator = { id: IndicatorId; pillar: PillarId; label: string; source: "FinHealth" | "JS Mentor" };

export const INDICATORS: Indicator[] = [
  { id: "spendRate", pillar: "spend", label: "Míňaš menej, než zarobíš", source: "FinHealth" },
  { id: "bills", pillar: "spend", label: "Platíš účty načas", source: "FinHealth" },
  { id: "reserve", pillar: "save", label: "Máš dostatočnú rezervu", source: "FinHealth" },
  { id: "longTerm", pillar: "save", label: "Dlhodobé úspory zodpovedajú veku", source: "FinHealth" },
  { id: "dsti", pillar: "borrow", label: "Splátky sú zvládnuteľné", source: "FinHealth" },
  { id: "discipline", pillar: "borrow", label: "Čistá úverová história", source: "FinHealth" },
  { id: "insurance", pillar: "plan", label: "Primerané poistenie", source: "FinHealth" },
  { id: "plans", pillar: "plan", label: "Plánuješ dopredu", source: "FinHealth" },
  { id: "investRate", pillar: "grow", label: "Investuješ pravidelne a dosť", source: "JS Mentor" },
  { id: "fees", pillar: "grow", label: "Vieš, čo máš a čo platíš", source: "JS Mentor" },
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Fidelity pravidlo: násobok ročného príjmu v dlhodobých úsporách podľa veku (1× v 30, 3× v 40, 6× v 50, 8× v 60, 10× v 67). */
export function targetMultiple(age: number): number {
  const pts: [number, number][] = [[22, 0], [30, 1], [35, 2], [40, 3], [45, 4], [50, 6], [55, 7], [60, 8], [67, 10]];
  if (age <= pts[0][0]) return 0;
  if (age >= pts[pts.length - 1][0]) return 10;
  for (let i = 1; i < pts.length; i++) {
    const [a0, m0] = pts[i - 1];
    const [a1, m1] = pts[i];
    if (age <= a1) return m0 + ((age - a0) / (a1 - a0)) * (m1 - m0);
  }
  return 10;
}

export type Derived = {
  reserveMonths: number;
  savingsRate: number;
  dsti: number;
  investRate: number;
  incomeMultiple: number;
  targetMultiple: number;
  fiProgress: number;
  freeCash: number;
};

export function derive(n: Numbers): Derived {
  const monthlyOut = n.expenses + n.payments;
  const freeCash = n.income - monthlyOut;
  const annualIncome = n.income * 12;
  const annualExpenses = monthlyOut * 12;
  return {
    reserveMonths: monthlyOut > 0 ? n.reserve / monthlyOut : n.reserve > 0 ? 12 : 0,
    savingsRate: n.income > 0 ? freeCash / n.income : 0,
    dsti: n.income > 0 ? n.payments / n.income : n.payments > 0 ? 1 : 0,
    investRate: n.income > 0 ? n.monthlyInvest / n.income : 0,
    incomeMultiple: annualIncome > 0 ? n.invested / annualIncome : 0,
    targetMultiple: targetMultiple(n.age),
    fiProgress: annualExpenses > 0 ? n.invested / (25 * annualExpenses) : 0,
    freeCash,
  };
}

/** Body podľa FinHealth tabuliek, prepočítané z reálnych čísel. */
export function derivedPoints(d: Derived): Record<"spendRate" | "reserve" | "longTerm" | "dsti" | "investRate", number> {
  const sr = d.savingsRate;
  const spendRate = sr >= 0.2 ? 100 : sr >= 0.05 ? 75 : sr >= -0.05 ? 50 : sr >= -0.2 ? 25 : 0;
  const m = d.reserveMonths;
  const reserve = m >= 6 ? 100 : m >= 3 ? 75 : m >= 1 ? 50 : m >= 0.25 ? 25 : 0;
  const ratio = d.targetMultiple > 0 ? d.incomeMultiple / d.targetMultiple : d.incomeMultiple > 0 ? 1 : 0.5;
  const longTerm = Math.round(clamp(ratio, 0, 1) * 100);
  const x = d.dsti;
  const dsti = x <= 0 ? 100 : x <= 0.2 ? 85 : x <= 0.35 ? 60 : x <= 0.5 ? 30 : 0;
  const ir = d.investRate;
  const investRate = ir >= 0.2 ? 100 : ir >= 0.15 ? 85 : ir >= 0.1 ? 70 : ir >= 0.05 ? 45 : ir > 0 ? 20 : 0;
  return { spendRate, reserve, longTerm, dsti, investRate };
}

export type Tier = { id: "zranitelne" | "zvladas" | "zdrave"; label: string; min: number; verdict: string; share: string };

/** Pásma podľa FinHealth; podiel domácností z U.S. Financial Health Pulse 2025. */
export const TIERS: Tier[] = [
  {
    id: "zdrave",
    label: "Finančne zdravé",
    min: 80,
    verdict: "Máš zdravé výsledky naprieč všetkými piliermi. Ďalší posun je v efektivite: poplatky, dane, stratégia a to, aby peniaze pracovali za teba.",
    share: "Do tohto pásma sa dostane len 31 % domácností.",
  },
  {
    id: "zvladas",
    label: "Zvládaš to",
    min: 40,
    verdict: "Základy fungujú, ale bez vankúša. Niektoré piliere držia, iné ťa brzdia. Dobrá správa: prvé dva kroky zvyknú posunúť skóre najviac.",
    share: "V tomto pásme je väčšina domácností, 54 %.",
  },
  {
    id: "zranitelne",
    label: "Zraniteľné",
    min: 0,
    verdict: "Jedna nečakaná udalosť ťa dnes môže vykoľajiť. Nie je to hodnotenie teba, len bod na mape. Z tohto pásma sa dá vyjsť za pár mesiacov disciplíny.",
    share: "V tomto pásme je 15 % domácností.",
  },
];

/** Benchmark: 2021 národné priemery FinHealth Score (USA) — celkové 61, Spend 66, Save 75, Borrow 69, Plan 61. */
export const BENCHMARK = { overall: 61, spend: 66, save: 75, borrow: 69, plan: 61 } as const;

export type Band = "slaba" | "priemer" | "dobra";
export const bandFor = (pts: number): Band => (pts < 40 ? "slaba" : pts < 80 ? "priemer" : "dobra");
export const BAND_LABEL: Record<Band, string> = { slaba: "Rieš ako prvé", priemer: "Dá sa zlepšiť", dobra: "V poriadku" };

/* ------------------------------------------------------------------ odporúčania */

export type Recommendation = { title: string; text: string; tool?: { label: string; href: string } };

const B = "/bonusy";
const T = {
  mzdova: { label: "Mzdová kalkulačka", href: `${B}/mzdova-kalkulacka` },
  investicna: { label: "Investičná kalkulačka", href: `${B}/investicna-kalkulacka` },
  uverova: { label: "Úverová kalkulačka", href: `${B}/uverova-kalkulacka` },
  hypo: { label: "Inteligentná hypotéka", href: `${B}/inteligentna-hypoteka` },
  rentova: { label: "Rentová kalkulačka", href: `${B}/rentova-kalkulacka` },
  rontgen: { label: "Poplatkový röntgen", href: `${B}/poplatkovy-rontgen` },
  semafor: { label: "ETF semafor", href: `${B}/etf-semafor` },
};

export const RECOMMENDATIONS: Record<IndicatorId, Record<Band, Recommendation>> = {
  spendRate: {
    slaba: { title: "Zastav únik: každý mesiac odchádza viac, než príde", text: "Bez kladného cashflow nefunguje nič ďalšie. Dva týždne si zapisuj každý výdavok a nájdi 10 % príjmu, ktoré vieš zastaviť hneď. Nastav platbu sebe ako prvú položku po výplate.", tool: T.mzdova },
    priemer: { title: "Zdvihni mieru úspor na 20 % príjmu", text: "Zdravá domácnosť odkladá aspoň pätinu. Rozdiel medzi 5 % a 20 % je za 20 rokov rozdiel medzi „nejako to bude“ a rentou z majetku.", tool: T.investicna },
    dobra: { title: "Cashflow máš pod kontrolou", text: "Odkladáš pätinu a viac. Dbaj, aby prebytok nezostával na bežnom účte, ale mal cieľ: rezerva, potom dlhodobé investície.", tool: T.investicna },
  },
  bills: {
    slaba: { title: "Zaplať účty načas skôr, než čokoľvek iné", text: "Penále a úroky z omeškania sú najdrahší dlh, aký existuje. Nastav automatické platby v deň výplaty a zoraď záväzky podľa úroku." },
    priemer: { title: "Automatizuj platby", text: "Občasné meškanie ťa stojí poplatky aj úverovú históriu. Trvalé príkazy deň po výplate to riešia raz a navždy." },
    dobra: { title: "Platobná disciplína je vzorová", text: "Nič netreba meniť. Ak máš kreditku, plať ju celú, nikdy len minimálnu splátku." },
  },
  reserve: {
    slaba: { title: "Postav rezervu na 3 mesiace výdavkov", text: "Bez rezervy každý problém končí dlhom. Otvor samostatný sporiaci účet a posielaj tam pevnú sumu hneď po výplate. Prvý cieľ je jeden mesiac výdavkov.", tool: T.mzdova },
    priemer: { title: "Dotiahni rezervu na 6 mesiacov", text: "Máš vankúš na drobné veci, nie na výpadok príjmu. Rezervu drž oddelene a v peňažnom fonde, aby nestrácala hodnotu.", tool: T.investicna },
    dobra: { title: "Rezerva stačí, nedrž v nej viac", text: "Všetko nad 6 mesiacov výdavkov ti na účte požiera inflácia. Prebytok patrí do dlhodobých investícií.", tool: T.investicna },
  },
  longTerm: {
    slaba: { title: "Dlhodobé úspory zaostávajú za tvojím vekom", text: "Orientačné pravidlo: v 30 mať 1× ročný príjem, v 40 už 3×, v 50 6×. Dobehnúť sa to dá len pravidelnou investíciou a časom, preto začni tento mesiac.", tool: T.rentova },
    priemer: { title: "Si na ceste, ale tempo treba zrýchliť", text: "S rastom príjmu zvyšuj aj mesačnú investíciu. Každé zvýšenie o 50 € mesačne je za 25 rokov desiatky tisíc eur.", tool: T.rentova },
    dobra: { title: "Dlhodobé úspory zodpovedajú veku", text: "Drž kurz. Raz ročne si over, či ti projekcia sedí s cieľovou rentou.", tool: T.rentova },
  },
  dsti: {
    slaba: { title: "Splátky ti berú priveľkú časť príjmu", text: "Nad 35 % príjmu na splátkach je ťažko, nad 50 % kriticky. Najprv splať najdrahší úver, potom rokuj o konsolidácii alebo predĺžení hypotéky.", tool: T.uverova },
    priemer: { title: "Splátky sú zvládnuteľné, ale ber to ako strop", text: "Pod 20 % príjmu je pohodlné pásmo. Nový úver si dovoľ, len ak ostane rezerva aj miera úspor.", tool: T.hypo },
    dobra: { title: "Dlhy máš pod kontrolou", text: "Ak máš lacnú hypotéku, porovnaj si, či sa oplatí splácať mimoriadne, alebo radšej investovať.", tool: T.hypo },
  },
  discipline: {
    slaba: { title: "Vyčisti úverovú históriu", text: "Záznam v registri ti zdraží alebo znemožní hypotéku na roky. Dohodni splátkový kalendár, splácaj načas a po 12 mesiacoch čistej histórie sa situácia otočí." },
    priemer: { title: "Vybuduj čistú históriu", text: "Občasné meškanie alebo nulová história znižujú tvoju úverovú kapacitu. Jeden malý záväzok splácaný vzorne históriu buduje.", tool: T.uverova },
    dobra: { title: "Banka ťa vidí ako bezpečného klienta", text: "Udrž si to. Pri každej žiadosti o úver si porovnaj ponuky viacerých bánk, tvoja pozícia je silná." },
  },
  insurance: {
    slaba: { title: "Zabezpeč príjem, nie veci", text: "Dlhodobá PN alebo invalidita je väčšie riziko než požiar bytu. Rieš najprv poistenie príjmu a smrti, ak od teba niekto závisí. Zvyšok pokryje rezerva." },
    priemer: { title: "Prever, čo tvoje poistenie naozaj kryje", text: "Sumy nastav podľa hypotéky, príjmu a počtu ľudí, ktorí od teba závisia, nie podľa toho, čo ponúkol agent." },
    dobra: { title: "Ochrana je nastavená", text: "Poistenie si prejdi pri každej väčšej zmene: nová hypotéka, dieťa, zmena príjmu. Inak ho netreba riešiť." },
  },
  plans: {
    slaba: { title: "Daj svojim peniazom plán", text: "Bez plánu rozhodujú náhody a reklama. Stanov si tri ciele s termínom a sumou, rozdeľ ich na mesačné odklady a sleduj ich raz mesačne.", tool: T.rentova },
    priemer: { title: "Z plánu v hlave urob plán na papieri", text: "Napíš si ciele, sumy a termíny. Čo je napísané, sa deje. Raz štvrťročne si to prejdi." },
    dobra: { title: "Plánuješ dopredu", text: "Máš návyk, ktorý chýba väčšine. Prepoj plány s číslami: cieľová renta, vek a potrebný mesačný vklad.", tool: T.rentova },
  },
  investRate: {
    slaba: { title: "Začni investovať pravidelne, aj s malou sumou", text: "Čas je tvoj najsilnejší spojenec. 100 € mesačne pri 8 % ročne je za 30 rokov okolo 150 000 €. Nastav automatický vklad do nízkonákladového ETF.", tool: T.investicna },
    priemer: { title: "Zdvihni mesačnú investíciu k 15 až 20 % príjmu", text: "Investuješ, ale tempo ťa k rente nedovedie. Každé zvýšenie príjmu rozdeľ: polovicu do investície, polovicu do života.", tool: T.investicna },
    dobra: { title: "Investuješ dosť, drž kurz", text: "Stratégiu si prejdi raz ročne, nie pri každom poklese trhu. Sleduj poplatky, tie rozhodujú o výsledku viac než výber fondu.", tool: T.semafor },
  },
  fees: {
    slaba: { title: "Zisti, čo ťa investície stoja", text: "Poplatky 2 až 3 % ročne zoberú za 30 rokov aj polovicu výnosu. Prever produkty, ktoré máš, a porovnaj ich s lacným ETF.", tool: T.rontgen },
    priemer: { title: "Prever produkt, ktorý máš, a poplatky do detailu", text: "„Približne viem“ pri poplatkoch stojí tisíce. Vypýtaj si od poskytovateľa celkovú nákladovosť (TER, vstupný, správcovský, výkonnostný).", tool: T.rontgen },
    dobra: { title: "Investuješ efektívne", text: "Lacné ETF a stratégia na papieri sú základ, ktorý väčšina nemá. Ďalší krok je daňová efektivita a rebalansovanie.", tool: T.semafor },
  },
};
