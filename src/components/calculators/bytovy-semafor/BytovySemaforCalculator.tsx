import { useState, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { ArrowLeft, ArrowRight, FileText, Flag, House, Landmark, Lightbulb, MapPin, MessageCircle, RotateCcw, ThumbsUp, type LucideIcon } from "lucide-react";
import "../shared/calc-ui.css";
import "./bytovy-semafor.css";
import { BONUSY_CTA_LABEL, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";

// ── types ──
interface Answer {
  t: string;
  e: string;
  p: number;
  flag?: boolean;
  shock?: boolean;
  tip?: string;
}
interface Question {
  c: keyof typeof CATS;
  q: string;
  a: Answer[];
  calc?: boolean;
}
type Phase = "intro" | "quiz" | "result";
type CatKey = "L" | "C" | "D" | "S";
type Cls = "g" | "a" | "r";

// ── data ──
const CATS: Record<CatKey, string> = {
  L: "📍 Lokalita a dopyt",
  C: "🏦 Čísla a banka",
  D: "📄 Dane a zmluvy",
  S: "🏠 Stav a riziká",
};

const Q: Question[] = [
  /* ── LOKALITA A DOPYT ── */
  {
    c: "L", q: "Kde sa byt nachádza?",
    a: [
      { t: "Krajské alebo silné okresné mesto, kam sa ľudia sťahujú", e: "🏙️", p: 2 },
      { t: "Menšie okresné mesto so stabilným dopytom", e: "🏘️", p: 1 },
      { t: "Lokalita, odkiaľ ľudia skôr odchádzajú", e: "📉", p: 0,
        tip: "<b>Lokalita je 50\u00a0% investície.</b> Klesajúci počet obyvateľov\u00a0= klesajúci dopyt po nájme aj horší predaj. Preveruj demografiu obce za posledných 10 rokov." },
    ],
  },
  {
    c: "L", q: "Čo je od bytu v pešej dostupnosti?",
    a: [
      { t: "Obchody, škola/škôlka, MHD aj lekár", e: "✅", p: 2 },
      { t: "Niečo z toho — zvyšok autom", e: "🚗", p: 1,
        tip: "<b>Vybavenosť rozhoduje o nájomníkovi.</b> Čím menej je pešo, tým užší okruh záujemcov\u00a0— rátaj s dlhšou neobsadenosťou." },
      { t: "Bez auta sa odtiaľ nepohneš", e: "🛣️", p: 0,
        tip: "<b>Byt bez vybavenosti\u00a0= byt pre úzku skupinu.</b> Rodiny s deťmi a seniori ti vypadnú z cieľovky. Zváž, či cena tento hendikep naozaj kompenzuje." },
    ],
  },
  {
    c: "L", q: "Ako rýchlo sa v lokalite prenajímajú podobné byty?",
    a: [
      { t: "Inzeráty miznú do pár dní", e: "⚡", p: 2 },
      { t: "Do mesiaca sa prenajme", e: "📆", p: 1 },
      { t: "Neviem / inzeráty visia dlho", e: "🤷", p: 0,
        tip: "<b>Toto si over PRED kúpou, nie po nej.</b> 30 minút na nehnutelnosti.sk: koľko podobných bytov je na prenájom a ako dlho visia. Veľa a dlho\u00a0= tvoj nájom bude pod tlakom." },
    ],
  },
  {
    c: "L", q: "Kto presne bude tvoj nájomník?",
    a: [
      { t: "Viem presne (rodina / pár / študenti…) a byt tomu sedí", e: "🎯", p: 2 },
      { t: "Zhruba tuším", e: "🤔", p: 1,
        tip: '<b>&bdquo;Niekto sa nájde&rdquo; nie je stratégia.</b> Cieľový nájomník určuje dispozíciu, zariadenie, výšku nájmu aj fluktuáciu. Definuj si ho pred kúpou\u00a0— nie po treťom neúspešnom inzeráte.' },
      { t: "Nepremýšľal som nad tým", e: "😶", p: 0, shock: true,
        tip: "<b>Byt bez cieľovky\u00a0= všetko nastavené naslepo.</b> Iný byt kupuješ pre študentov, iný pre rodinu s deťmi. Od toho sa odvíja lokalita, dispozícia, zariadenie aj zmluva." },
    ],
  },
  /* ── ČÍSLA A BANKA ── */
  {
    c: "C", q: "Ako je byt nacenený oproti porovnateľným v okolí?",
    a: [
      { t: "Na priemere alebo pod ním", e: "🎯", p: 2 },
      { t: "Mierne nad (do +10\u00a0%)", e: "📈", p: 1,
        tip: "<b>Mierne nad trhom sa dá vyjednať.</b> Priprav si 3–5 porovnateľných inzerátov a pýtaj zľavu\u00a0— predávajúci dnes čakajú vyjednávanie." },
      { t: "Výrazne nad / neporovnával som", e: "❓", p: 0,
        tip: "<b>Bez porovnania kupuješ naslepo.</b> Minimálne 5 porovnateľných bytov (rovnaká lokalita, výmera, stav) a prepočet na €/m². Preplatenie pri kúpe ti žiadny rast trhu nevráti rýchlo." },
    ],
  },
  {
    c: "C", q: "Aký je hrubý ročný výnos z nájmu?", calc: true,
    a: [
      { t: "Nad 4,5\u00a0%", e: "💪", p: 2 },
      { t: "3,5\u00a0–\u00a04,5\u00a0%", e: "🆗", p: 1,
        tip: "<b>Priemerný výnos\u00a0— rozhoduje rast hodnoty.</b> Pri 3,5–4,5\u00a0% ťa živí hlavne zhodnotenie. O to viac musí sedieť lokalita a cena pri kúpe." },
      { t: "Pod 3,5\u00a0% / nerátal som", e: "🚨", p: 0,
        tip: "<b>Pod 3,5\u00a0% je nájom slabý vankúš.</b> Prepočítaj si: nájom × 11 ÷ cena. Ak nevychádza, buď je byt drahý, alebo nájom v lokalite nízky\u00a0— oboje je signál." },
    ],
  },
  {
    c: "C", q: "Ako vyjde mesačný cashflow? (nájom − splátka − náklady)",
    a: [
      { t: "Plus alebo okolo nuly", e: "✅", p: 2 },
      { t: "Mierny mínus, ktorý bez problémov utiahnem", e: "🟡", p: 1,
        tip: "<b>Mínusový cashflow nie je automaticky zlý</b>\u00a0— ale musí byť plánovaný a krytý príjmom. Spočítaj si, koľko ťa byt bude stáť mesačne najbližších 5 rokov." },
      { t: "Veľký mínus / vôbec neviem", e: "🚩", p: 0, flag: true,
        tip: "<b>🚩 Toto je stopka.</b> Kupovať byt bez prepočtu cashflow je hazard, nie investícia. Splátka\u00a0+ fond opráv\u00a0+ poistenie\u00a0+ daň\u00a0+ neobsadenosť\u00a0— všetko na papier, až potom rezervačka." },
    ],
  },
  {
    c: "C", q: "Aká ti zostane rezerva po kúpe?",
    a: [
      { t: "6+ mesiacov splátok + rezerva na opravy", e: "🛡️", p: 2 },
      { t: "3\u00a0–\u00a06 mesiacov splátok", e: "🟡", p: 1,
        tip: "<b>Rezervu dobuduj čo najskôr.</b> Pokazený kotol a 2 mesiace bez nájomníka prídu vždy naraz\u00a0— cieľ je 6 mesiacov splátok bokom." },
      { t: "Idem nadoraz", e: "🚩", p: 0, flag: true,
        tip: "<b>🚩 Nadoraz sa byty nekupujú.</b> Prvá neplánovaná udalosť ťa dotlačí k panickému predaju alebo k úveru na úver. Radšej menší byt, neskorší termín, alebo vyšší vlastný vklad." },
    ],
  },
  {
    c: "C", q: "Vieš, koľko\u00a0% z budúceho nájmu ti banka reálne uzná do príjmu, keď pôjdeš po ďalšiu hypotéku?",
    a: [
      { t: "Viem\u00a0— mám to prepočítané pre konkrétne banky", e: "🧮", p: 2 },
      { t: "Tuším, že nie celý nájom", e: "🤔", p: 1,
        tip: "<b>Každá banka uznáva iné\u00a0% z nájmu</b>\u00a0— a niektoré nič, kým nemáš zmluvu a históriu príjmu. Ak plánuješ byt č.\u00a02, toto číslo rozhoduje o tvojej úverovej kapacite." },
      { t: "Počkať… banka mi neuzná celý nájom?! 😳", e: "😳", p: 0, shock: true,
        tip: "<b>Presne tak\u00a0— a rozdiely medzi bankami sú obrovské.</b> Zle zvolená prvá banka ti vie zavrieť dvere k druhému bytu. Poradie a výber bánk je stratégia, nie detail." },
    ],
  },
  {
    c: "C", q: "Vieš, že pri druhej hypotéke ti banka môže na investičný byt skrátiť splatnosť — a čo to spraví so splátkou?",
    a: [
      { t: "Viem a mám to zarátané v cashflow", e: "✅", p: 2 },
      { t: "Netušil som, ale vyššiu splátku utiahnem", e: "🟡", p: 1,
        tip: "<b>Kratšia splatnosť\u00a0= vyššia splátka\u00a0= úplne iný cashflow.</b> Prepočítaj si scenár s 20-ročnou splatnosťou namiesto 30\u00a0— nech ťa to neprekvapí pri schvaľovaní." },
      { t: "Prvýkrát počujem 😳", e: "😳", p: 0, shock: true,
        tip: "<b>Niektoré banky dávajú na ďalší (investičný) byt kratšiu splatnosť</b>\u00a0— a tvoja splátka skočí o desiatky percent oproti tomu, čo máš v exceli. Podmienky sa medzi bankami líšia a menia\u00a0— presné čísla pre tvoju situáciu si over vopred." },
    ],
  },
  /* ── DANE A ZMLUVY ── */
  {
    c: "D", q: "Obchodný majetok: vieš, čo spraví zaradenie bytu do obchodného majetku s tvojimi daňami — pri prenájme AJ pri predaji?",
    a: [
      { t: "Viem presne a rozhodol som sa vedome", e: "🧠", p: 2 },
      { t: "Počul som niečo o odpisoch…", e: "🤔", p: 1,
        tip: "<b>Toto rozhodnutie má dve strany.</b> Zaradenie ti otvára uplatnenie nákladov (úroky, odpisy) z nájmu\u00a0— ale mení pravidlá zdanenia pri predaji. Polovičná informácia je tu drahšia ako žiadna." },
      { t: "Kokos… čo je obchodný majetok? 😳", e: "😳", p: 0, shock: true,
        tip: "<b>Jedno rozhodnutie PRED prenájmom\u00a0— dopad v tisícoch eur.</b> Ovplyvňuje, či si z nájmu uplatníš úroky z hypotéky a odpisy, a zároveň či a kedy zaplatíš daň pri predaji bytu. Urobiť ho treba vedome a na tvoje čísla." },
    ],
  },
  {
    c: "D", q: "Nájomná zmluva: vieš, v akom právnom režime ju podpísať, aby si vedel neplatiča reálne dostať z bytu?",
    a: [
      { t: "Áno\u00a0— krátkodobý nájom mám podchytený", e: "📄", p: 2 },
      { t: "Stiahnem si vzor z internetu", e: "🖨️", p: 1,
        tip: "<b>Vzor z internetu nevie, čo chceš chrániť.</b> Režim zmluvy, kaucia, výpovedné podmienky, protokol\u00a0— rozdiel medzi dobrou a zlou zmluvou je rozdiel medzi mesiacom a rokom problémov." },
      { t: "Zmluva ako zmluva, nie? 😬", e: "😬", p: 0, shock: true,
        tip: "<b>Nie.</b> Zle postavená zmluva\u00a0= nájomník, ktorý neplatí a býva u teba mesiace, kým ty platíš hypotéku. Ochrana prenajímateľa sa buduje v zmluve PRED odovzdaním kľúčov." },
    ],
  },
  {
    c: "D", q: "Čo hovorí list vlastníctva?",
    a: [
      { t: "Čistý\u00a0— bez tiarch, exekúcií a bremien", e: "📄", p: 2 },
      { t: "Ťarcha banky predávajúceho (bežný štandard)", e: "🏦", p: 1 },
      { t: "Iné ťarchy / vecné bremená / nepozeral som", e: "🚩", p: 0, flag: true,
        tip: "<b>🚩 LV je prvá vec, ktorú otváraš\u00a0— a je zadarmo na katasterportal.sk.</b> Exekúcie, bremená dožitia, predkupné práva\u00a0— toto ti vie zablokovať byt na roky. Pri čomkoľvek nejasnom právnik, nie maklér." },
    ],
  },
  /* ── STAV A RIZIKÁ ── */
  {
    c: "S", q: "V akom stave je samotný byt?",
    a: [
      { t: "Po rekonštrukcii / novostavba", e: "✨", p: 2 },
      { t: "Obývateľný, stačí kozmetika", e: "🖌️", p: 1 },
      { t: "Potrebuje kompletnú rekonštrukciu", e: "🔨", p: 0,
        tip: "<b>Rekonštrukcia nie je problém\u00a0— nenacenená rekonštrukcia áno.</b> Polož si strop (€/m²), pridaj 20\u00a0% rezervu a odpočítaj to od kúpnej ceny pri vyjednávaní." },
    ],
  },
  {
    c: "S", q: "Rezervačná zmluva s realitkou: vieš, čo podpisuješ a kedy ti prepadne záloha?",
    a: [
      { t: "Čítam a upravujem podmienky pred podpisom", e: "🧐", p: 2 },
      { t: "Prebehnem ju očami", e: "👀", p: 1,
        tip: "<b>Rezervačka je často najtvrdší dokument celého obchodu.</b> Prepadnutie zálohy, sankcie, termíny\u00a0— než podpíšeš, vedz presne, za akých podmienok dostaneš peniaze späť." },
      { t: "Veď je to len rezervácia 😅", e: "😅", p: 0, shock: true,
        tip: '<b>&bdquo;Len rezervácia&rdquo; s prepadnuteľnou zálohou v tisícoch eur.</b> Ak ti nevyjde hypotéka alebo znalecký posudok a zmluva s tým neráta, záloha je preč. Podmienky vrátenia si daj do zmluvy PRED podpisom.' },
    ],
  },
];

const MAX_SCORE = Q.length * 2;

// ── helpers ──
function calcYield(rent: number, price: number): number {
  return (rent * 11) / price * 100;
}

// ── vizuál: ikony, tóny, formát ──
const CAT_KEYS = Object.keys(CATS) as CatKey[];
/** Popisok bez úvodného emoji — v UI používame ikony lucide, emoji ostáva len v texte. */
const stripEmoji = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, "");
const catLabel = (c: CatKey) => stripEmoji(CATS[c]);
const CAT_ICON: Record<CatKey, LucideIcon> = { L: MapPin, C: Landmark, D: FileText, S: House };
/** Tón karty otázky podľa oblasti (šalvia / piesok / kameň). */
const CAT_TONE: Record<CatKey, string> = { L: "sage", C: "sand", D: "stone", S: "sage" };

const shockText = (n: number) =>
  n === 1 ? "1 otázka" : n < 5 ? `${n} otázky` : `${n} otázok`;

/** Verdikt: prvá veta ako italic zlatý dôraz, zvyšok krémový. */
const splitVerdict = (s: string): [string, string] => {
  const i = s.indexOf(". ");
  return i > 0 ? [s.slice(0, i + 1), s.slice(i + 2)] : [s, ""];
};

/** Farba pásu podľa pomeru: lesná zelená / taupe / červená (žiadna žltá na svetlom). */
const colFor = (r: number) =>
  r >= 0.8 ? "#2a6647" : r >= 0.55 ? "#a99d7e" : "#ab4132";

/** Tón semafora: na hnedom paneli mint / zlatá / lososová, pod ním šalvia / piesok / ružovkastá. */
const TONE: Record<Cls, { dark: string; card: string; label: string }> = {
  g: { dark: "#d9b15c", card: "sage", label: "#2a6647" },
  a: { dark: "#d9b15c", card: "sand", label: "#292420" },
  r: { dark: "#e9a27e", card: "blush", label: "#ab4132" },
};

const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;
const st = (i: number, extra: Record<string, string | number> = {}) => ({ "--i": i, ...extra }) as CSSProperties;

// ── component ──
export default function BytovySemaforCalculator() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [mcRent, setMcRent] = useState("");
  const [mcPrice, setMcPrice] = useState("");

  const topRef = useRef<HTMLDivElement>(null);

  const scrollUp = () => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startQuiz = () => {
    setAnswers([]);
    setIdx(0);
    setMcRent("");
    setMcPrice("");
    setPhase("quiz");
    scrollUp();
  };

  const handleAnswer = (ai: number) => {
    const next = idx + 1;
    if (next < Q.length) {
      setAnswers((prev) => { const a = [...prev]; a[idx] = ai; return a; });
      setIdx(next);
      setMcRent("");
      setMcPrice("");
      scrollUp();
    } else {
      setAnswers((prev) => { const a = [...prev]; a[idx] = ai; return a; });
      setPhase("result");
      scrollUp();
    }
  };

  const goBack = () => {
    if (idx > 0) {
      setIdx((i) => i - 1);
      setMcRent("");
      setMcPrice("");
      scrollUp();
    }
  };

  const restart = () => {
    startQuiz();
  };

  // ── result computation ──
  const result = useMemo(() => {
    if (phase !== "result" || answers.length < Q.length) return null;

    let score = 0;
    let flags = 0;
    let shocks = 0;
    const catScore: Partial<Record<CatKey, number>> = {};
    const catMax: Partial<Record<CatKey, number>> = {};
    const tips: { tip: string; flag: boolean }[] = [];

    Q.forEach((q, qi) => {
      const a = q.a[answers[qi]];
      if (!a) return;
      score += a.p;
      catScore[q.c] = (catScore[q.c] ?? 0) + a.p;
      catMax[q.c] = (catMax[q.c] ?? 0) + 2;
      if (a.flag) flags++;
      if (a.shock) shocks++;
      if (a.tip) tips.push({ tip: a.tip, flag: !!a.flag });
    });

    let worstCat: CatKey | null = null;
    let worstR = 1;
    (Object.keys(CATS) as CatKey[]).forEach((c) => {
      const r = (catScore[c] ?? 0) / (catMax[c] ?? 1);
      if (r < worstR) { worstR = r; worstCat = c; }
    });

    const p = score / MAX_SCORE;
    let cls: "g" | "a" | "r";
    let emo: string;
    let txt: string;
    if (flags >= 2 || p < 0.55) { cls = "r"; emo = "🔴"; txt = "Stop. Takto nie."; }
    else if (flags === 1 || p < 0.8) { cls = "a"; emo = "🟡"; txt = "Pozor. Najprv dorataj."; }
    else { cls = "g"; emo = "🟢"; txt = "Zelená. Vyzerá to dobre."; }

    const worstName = worstCat ? CATS[worstCat as CatKey] : "";
    let reco = "";
    if (cls === "g") {
      reco = `Byt vyzerá zdravo a ty pripravene\u00a0— to je vzácna kombinácia. Najslabšie ti vyšla oblasť <b>${worstName}</b>, tak ju ešte raz prejdi s chladnou hlavou. Ak čísla sedia aj na papieri, konaj\u00a0— dobré byty nečakajú. A ak chceš mať istotu pred podpisom, <b>využi konzultáciu zadarmo s Ivanom</b>\u00a0— prejdeme byt číslo po čísle.`;
    } else if (cls === "a") {
      reco = `Tento byt sa kúpiť dá\u00a0— ale nie zajtra a nie takto. Najväčšiu dieru máš v oblasti <b>${worstName}</b>. Nepodpisuj rezervačku, kým si nedoplníš odpovede nižšie; každá z nich je lacnejšia teraz ako po podpise. Najrýchlejšia cesta? <b>Využi konzultáciu zadarmo s Ivanom</b>\u00a0— za 45 minút z toho spravíme jasné áno alebo jasné nie.`;
    } else {
      reco = `Zastav sa. V tomto stave nekupuješ investíciu, ale riziko\u00a0— najhoršie vychádza oblasť <b>${worstName}</b>${flags ? ` a máš na stole ${flags === 1 ? "červenú vlajku" : "červené vlajky"}, z ktorých každá vie pochovať celý obchod` : ""}. Nič nepodpisuj a neplať zálohu. Buď tento byt, alebo tvoja príprava potrebuje prerobiť od základov\u00a0— <b>využi konzultáciu zadarmo s Ivanom</b> a nastavíme to nanovo, skôr než ťa to bude stáť peniaze.`;
    }

    tips.sort((a, b) => Number(b.flag) - Number(a.flag));

    return { score, flags, shocks, catScore, catMax, p, cls, emo, txt, reco, worstName, tips };
  }, [phase, answers]);

  // ── mini-calc derived ──
  const yieldValue = mcRent && mcPrice
    ? calcYield(Number(mcRent), Number(mcPrice))
    : null;
  const suggestedAns = yieldValue !== null
    ? yieldValue > 4.5 ? 0 : yieldValue >= 3.5 ? 1 : 2
    : null;

  const q = Q[idx];
  const progress = (idx / Q.length) * 100;
  const CatIcon = q ? CAT_ICON[q.c] : MapPin;

  // odvodené hodnoty pre výsledok (iba vizuál)
  const cls: Cls = result?.cls ?? "g";
  const tone = TONE[cls];
  const [vHead, vRest] = splitVerdict(result?.txt ?? "");
  const pct = result ? Math.round(result.p * 100) : 0;
  const ringOff = RING_C * (1 - (result?.p ?? 0));
  const worstLabel = result?.worstName ? stripEmoji(result.worstName) : null;

  return (
    <div className="section-container bys-outer">
      <div id="bys-root" className="calc-ui bys-root w-full font-sans" ref={topRef}>
        <div className="calc-body-shell">
          <div className="calc-page bys-page">

            {/* ═══ INTRO ═══ */}
            {phase === "intro" && (
              <>
                <header className="calc-header calc-reveal" style={st(0)}>
                  <span className="calc-eyebrow">Bytový semafor</span>
                  <h1 className="calc-title">Oplatí sa ti<br />ten byt <em>kúpiť</em>?</h1>
                  <p className="calc-subtitle">
                    15 otázok, 3 minúty. Niektoré si si možno nikdy nepoložil — a presne tie ťa môžu
                    stáť najviac peňazí. Lokalita, čísla, banka, dane, zmluvy.
                  </p>
                </header>
                <section className="bys-intro calc-reveal" style={st(1)} aria-label="Spustiť semafor">
                  <div className="bys-lights" aria-hidden>
                    <span className="bys-light bys-light--r" /><span className="bys-light bys-light--a" /><span className="bys-light bys-light--g" />
                  </div>
                  <button type="button" className="btn-primary bys-btn" onClick={startQuiz}>
                    Spustiť semafor <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </button>
                  <span className="bys-micro">zadarmo · bez e-mailu · výsledok hneď</span>
                </section>
                <ul className="bys-areas" aria-label="Oblasti otázok">
                  {CAT_KEYS.map((c, i) => {
                    const Icon = CAT_ICON[c];
                    const n = Q.filter((x) => x.c === c).length;
                    return (
                      <li key={c} className={`bys-area calc-tone--${CAT_TONE[c]} calc-reveal`} style={st(2 + i)}>
                        <span className="bys-area-icon"><Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden /></span>
                        <span className="bys-area-name">{catLabel(c)}</span>
                        <span className="bys-area-n">{shockText(n)}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {/* ═══ KVÍZ ═══ */}
            {phase === "quiz" && q && (
              <section className="bys-quiz" aria-label="Otázky">
                <div className="bys-quiz-top calc-reveal" style={st(0)}>
                  <span className="calc-eyebrow">Bytový semafor</span>
                </div>
                {/* progress */}
                <div className="bys-progress calc-reveal" style={st(0)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Priebeh">
                  <span className="bys-progress-fill" style={{ width: `${Math.max(3, progress)}%` }} />
                </div>
                <div className="bys-meta calc-reveal" style={st(0)}>
                  <span>Otázka <strong>{idx + 1}</strong> / {Q.length}</span>
                  <span className="bys-meta-cat"><CatIcon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />{catLabel(q.c)}</span>
                </div>

                {/* question card */}
                <div className={`calc-panel calc-tone--${CAT_TONE[q.c]} bys-qcard`} key={idx}>
                  <h2 className="bys-qtxt">{q.q}</h2>

                  {/* mini calculator (Q6 — yield) */}
                  {q.calc && (
                    <div className="bys-mc">
                      <div className="bys-mc-row">
                        <label className="bys-mc-field">
                          <span className="calc-label">Nájom / mes. (€)</span>
                          <input
                            className="calc-input"
                            type="number"
                            inputMode="numeric"
                            placeholder="850"
                            value={mcRent}
                            onChange={(e) => setMcRent(e.target.value)}
                          />
                        </label>
                        <label className="bys-mc-field">
                          <span className="calc-label">Cena bytu (€)</span>
                          <input
                            className="calc-input"
                            type="number"
                            inputMode="numeric"
                            placeholder="230 000"
                            value={mcPrice}
                            onChange={(e) => setMcPrice(e.target.value)}
                          />
                        </label>
                      </div>
                      <p className="bys-mc-out">
                        {yieldValue !== null ? (
                          <>
                            Tvoj hrubý výnos:{" "}
                            <strong>
                              {yieldValue.toLocaleString("sk-SK", { maximumFractionDigits: 1 })}&nbsp;%
                            </strong>{" "}
                            ročne{" "}
                            <span>
                              ({Number(mcRent).toLocaleString("sk-SK")}&nbsp;€ × 11 ÷{" "}
                              {Number(mcPrice).toLocaleString("sk-SK")}&nbsp;€)
                            </span>
                            {" "}— klikni zvýraznenú odpoveď 👇
                          </>
                        ) : (
                          "Zadaj nájom a cenu — výnos ti vypočítam 👇"
                        )}
                      </p>
                    </div>
                  )}

                  {/* answers */}
                  <div className="bys-ans" role="group" aria-label="Odpovede">
                    {q.a.map((a, ai) => {
                      const chosen = answers[idx] === ai;
                      return (
                        <button
                          key={ai}
                          type="button"
                          className={`bys-ans-btn${suggestedAns === ai ? " is-suggest" : ""}${chosen ? " is-chosen" : ""}`}
                          aria-pressed={chosen}
                          onClick={() => handleAnswer(ai)}
                        >
                          <span className="bys-ans-key" aria-hidden>{ai + 1}</span>
                          <span className="bys-ans-text">{a.t}</span>
                        </button>
                      );
                    })}
                  </div>

                  {idx > 0 && (
                    <button type="button" className="bys-back" onClick={goBack}>
                      <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Späť
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* ═══ VÝSLEDOK ═══ */}
            {phase === "result" && result && (
              <section className="bys-result" aria-label="Výsledok">
                {/* jeden plochý hnedý panel: semafor + verdikt + skóre */}
                <div className="bys-hero calc-reveal" style={st(0, { "--bys-tone": tone.dark })}>
                  <div className="bys-hero-main">
                    <p className="bys-kicker">Tvoj výsledok</p>
                    <h2 className="bys-verdict"><em>{vHead}</em> {vRest}</h2>
                    {result.flags > 0 && (
                      <p className="bys-flags">
                        <Flag className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                        <span>
                          {result.flags === 1
                            ? "1 červená vlajka — tá sama o sebe sťahuje semafor dole"
                            : `${result.flags} červené vlajky — každá z nich je dôvod zastaviť kúpu`}
                        </span>
                      </p>
                    )}
                    <div className="bys-hero-metrics">
                      <div><span className="bys-metric-label">Skóre</span><strong>{result.score} / {MAX_SCORE}</strong><small>bodov</small></div>
                      <div><span className="bys-metric-label">Červené vlajky</span><strong className={result.flags ? "is-neg" : "is-pos"}>{result.flags}</strong><small>v odpovediach</small></div>
                      {worstLabel ? <div className="is-wide"><span className="bys-metric-label">Najslabšia oblasť</span><strong>{worstLabel}</strong><small>tvoj ďalší krok</small></div> : null}
                    </div>
                  </div>
                  <div className="bys-hero-side">
                    <div className="bys-ring" role="img" aria-label={`Skóre ${pct} zo 100`}>
                      <svg viewBox="0 0 128 128" aria-hidden>
                        <circle cx="64" cy="64" r={RING_R} fill="none" stroke="rgba(243,233,221, 0.28)" strokeWidth="8" />
                        <circle className="bys-ring-arc" cx="64" cy="64" r={RING_R} fill="none" stroke={tone.dark} strokeWidth="8" strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={ringOff} transform="rotate(-90 64 64)" style={{ "--c": RING_C, "--o": ringOff } as CSSProperties} />
                      </svg>
                      <div className="bys-ring-center"><span className="bys-ring-val">{pct}<small>%</small></span><span className="bys-ring-cap">skóre</span></div>
                    </div>
                    <div className="bys-semafor" aria-hidden>
                      <span className={cls === "r" ? "is-on" : ""} /><span className={cls === "a" ? "is-on" : ""} /><span className={cls === "g" ? "is-on" : ""} />
                    </div>
                  </div>
                </div>

                {/* shock box */}
                {result.shocks > 0 && (
                  <div className="bys-shock calc-tone--stone calc-reveal" style={st(1)}>
                    <p className="bys-shock-big">Zaskočilo ťa <em>{shockText(result.shocks)}</em> 😳</p>
                    <p className="bys-shock-text">
                      Presne tieto veci treba vyriešiť <strong>PRED kúpou</strong> — po podpise sa
                      už väčšina z nich opraviť nedá.
                    </p>
                  </div>
                )}

                {/* recommendation */}
                <div className={`bys-reco calc-tone--${tone.card} calc-reveal`} style={st(2, { "--bys-reco": tone.label })}>
                  <p className="bys-reco-lbl">Odporúčanie</p>
                  <p className="bys-reco-text" dangerouslySetInnerHTML={{ __html: result.reco }} />
                </div>

                {/* category bars */}
                <div className="calc-panel bys-panel calc-reveal" style={st(3)}>
                  <h3 className="bys-h3">Podľa oblastí</h3>
                  {CAT_KEYS.map((c) => {
                    const Icon = CAT_ICON[c];
                    const sc = result.catScore[c] ?? 0;
                    const mx = result.catMax[c] ?? 1;
                    const r = sc / mx;
                    return (
                      <div className="bys-cat" key={c}>
                        <div className="bys-cat-top">
                          <span className="bys-cat-name"><Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />{catLabel(c)}</span>
                          <span className="bys-cat-score">{sc} / {mx}</span>
                        </div>
                        <div className="bys-cat-bar">
                          <span className="bys-cat-fill" style={{ width: `${r * 100}%`, background: colFor(r) }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* tips */}
                <div className="calc-panel bys-panel calc-reveal" style={st(4)}>
                  <h3 className="bys-h3">Čo s tým 👇</h3>
                  {result.tips.length > 0 ? (
                    result.tips.map((t, i) => (
                      <div key={i} className={`bys-tip${t.flag ? " is-flag" : ""}`}>
                        <span className="bys-tip-icon">{t.flag ? <Flag className="h-4 w-4" strokeWidth={1.75} aria-hidden /> : <Lightbulb className="h-4 w-4" strokeWidth={1.75} aria-hidden />}</span>
                        <span dangerouslySetInnerHTML={{ __html: t.tip }} />
                      </div>
                    ))
                  ) : (
                    <div className="bys-tip">
                      <span className="bys-tip-icon"><ThumbsUp className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                      <span>
                        <strong>Plný počet — klobúk dole.</strong> Buď máš pred sebou výborný byt a
                        si pripravený, alebo si bol na seba mierny. Over si odpovede s chladnou
                        hlavou — a potom konaj, takéto byty nečakajú.
                      </span>
                    </div>
                  )}
                  <div className="bys-tip is-cta">
                    <span className="bys-tip-icon"><MessageCircle className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                    <span>
                      <strong>A pri každom bode vyššie platí:</strong> nemusíš to lúskať sám.
                      Využi konzultáciu zadarmo s Ivanom — 45 minút, online, prejdeme tvoj byt
                      aj tvoje čísla.
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <div className="bys-cta calc-reveal" style={st(5)}>
                  <a
                    className="btn-primary bys-btn"
                    href={KONZULTACIA_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-umami-event="click_konzultacia"
                    data-umami-event-section="bytovy-semafor"
                  >
                    {BONUSY_CTA_LABEL} <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </a>
                  <span className="bys-micro">45 minút · zadarmo · online</span>
                  <button type="button" className="bys-ghost" onClick={restart}>
                    <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Vyhodnotiť iný byt
                  </button>
                </div>
              </section>
            )}

            {/* footer */}
            <p className="calc-note calc-note--center bys-foot">
              Bytový semafor je orientačný nástroj. Daňové, bankové a právne dopady závisia od
              tvojej konkrétnej situácie a aktuálnych podmienok — preto ich preberáme individuálne.
              Nenahrádza právnu previerku, technickú obhliadku ani daňové poradenstvo. Nejde o
              investičné odporúčanie.
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}
