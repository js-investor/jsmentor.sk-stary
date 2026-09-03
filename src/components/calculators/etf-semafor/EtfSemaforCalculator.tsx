import { useState, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Brain, ChartPie, FileText, Flag, Lightbulb, MessageCircle, RotateCcw, Target, ThumbsUp, type LucideIcon } from "lucide-react";
import "../shared/calc-ui.css";
import "./etf-semafor.css";
import { BONUSY_CTA_LABEL, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";

// ===== TYPES =====
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
}
type Phase = "intro" | "quiz" | "result";

// ===== DATA =====
const CATS = {
  S: "🧠 Stratégia a správanie",
  P: "📊 Tvoje portfólio",
  D: "📄 Dane a štruktúra",
  C: "🎯 Cieľ",
} as const;

const Q: Question[] = [
  /* ---- STRATÉGIA A SPRÁVANIE ---- */
  {
    c: "S", q: "Máš plán, čo presne urobíš, keď trh spadne o 30 %?",
    a: [
      { t: "Mám presný plán — viem, čo kúpim a čo nechám tak", e: "📋", p: 2 },
      { t: "Mám to zhruba v hlave", e: "🤔", p: 1, tip: "<b>Plán v hlave sa v kríze rozpustí ako prvý.</b> Napíš si ho teraz, keď trhy rastú a ty myslíš chladne. V mínuse 30 % už nerozhoduje hlava, ale žalúdok." },
      { t: "Nepremýšľal som nad tým", e: "😶", p: 0, shock: true, tip: "<b>Kríza príde — otázka je len kedy.</b> Investori bez plánu predávajú na dne a kupujú na vrchole. Písomný krízový plán je najlacnejšia poistka tvojho majetku." },
    ],
  },
  {
    c: "S", q: "Investuješ pravidelne a automaticky — alebo \u201Ekeď zvýši\u201D?",
    a: [
      { t: "Automaticky, každý mesiac, bez rozmýšľania", e: "⚙️", p: 2 },
      { t: "Pravidelne, ale posielam to manuálne", e: "📆", p: 1, tip: "<b>Manuálne = jedného dňa zabudneš. Alebo \u201Epočkáš na lepší kurz\u201D.</b> Nastav si trvalý príkaz — automat nemá emócie a emócie sú najdrahší poplatok." },
      { t: "Keď zvýši / keď mám pocit, že je dobrý čas", e: "🎲", p: 0, tip: "<b>\u201EDobrý čas\u201D neexistuje — ani profesionáli ho netrafia.</b> Dáta sú jednoznačné: pravidelné investovanie poráža časovanie trhu, lebo nikdy nestojíš bokom, keď trh rastie." },
    ],
  },
  {
    c: "S", q: "Vieš, prečo vznikli posledné 3 veľké krízy (2000 / 2008 / 2020) — a ako sa vtedy správali jednotlivé triedy aktív?",
    a: [
      { t: "Viem — a preto mám portfólio nastavené tak, ako mám", e: "🧠", p: 2 },
      { t: "Zhruba poznám tie príbehy", e: "📖", p: 1, tip: "<b>Príbehy nestačia — pozri si čísla.</b> Ako hlboko padli akcie, čo robili dlhopisy, ako dlho trvalo zotavenie. Kto pozná históriu, nepanikári, keď sa zopakuje." },
      { t: "Netuším 😳", e: "😳", p: 0, shock: true, tip: "<b>Dot-com 2000, hypotéky 2008, covid 2020 — tri úplne iné krízy, jedno spoločné: kto vydržal, zarobil.</b> Kto nepozná, ako krízy vyzerajú, predáva presne vtedy, keď má kupovať." },
    ],
  },
  {
    c: "S", q: "Vieš, prečo máš presne taký pomer akcií a dlhopisov, aký máš?",
    a: [
      { t: "Áno — vychádza z môjho horizontu a cieľa", e: "🎯", p: 2 },
      { t: "Nastavil mi ho niekto, dôvod presne nepoznám", e: "🤷", p: 1, tip: "<b>Pomer akcií a dlhopisov je najdôležitejšie rozhodnutie celého portfólia</b> — dôležitejšie než výber konkrétneho ETF. Ak nepoznáš dôvod, nevieš ani, či ešte platí." },
      { t: "Neviem, aký pomer vlastne mám 😳", e: "😳", p: 0, shock: true, tip: "<b>Toto je ako šoférovať bez vedomia, akou rýchlosťou ideš.</b> Pomer akcií a dlhopisov určuje, koľko zarobíš aj koľko môžeš stratiť. Prvý krok auditu: zistiť, čo vlastne držíš." },
    ],
  },
  /* ---- TVOJE PORTFÓLIO ---- */
  {
    c: "P", q: "Vieš, aký máš celkový ročný poplatok naprieč všetkým, kde investuješ?",
    a: [
      { t: "Viem presné číslo", e: "🧮", p: 2 },
      { t: "Tuším, ale nepočítal som to", e: "🤔", p: 1, tip: "<b>Poplatok je jediná vec na trhu, ktorú máš na 100 % pod kontrolou.</b> Spočítaj si vážený priemer všetkých svojich produktov — pri väčšine ľudí vyjde nepríjemné prekvapenie." },
      { t: "Netuším 😳", e: "😳", p: 0, shock: true, tip: "<b>Presne preto väčšina ľudí netuší, koľko ich investovanie stojí — poplatok nikdy nevidia na výpise.</b> Strháva sa potichu z hodnoty. Rozdiel 1–2 % ročne = desaťtisíce eur za investičný život." },
    ],
  },
  {
    c: "P", q: "Vieš, do čoho presne investuješ — aké firmy, regióny, meny?",
    a: [
      { t: "Viem — poznám zloženie svojho portfólia", e: "🗺️", p: 2 },
      { t: "Zhruba", e: "🤔", p: 1, tip: "<b>\u201EZhruba\u201D znamená, že nevieš, aké riziko nesieš.</b> Otvor si factsheet svojho fondu/ETF: top 10 pozícií, regióny, meny. Zaberie to 10 minút a často zmení celý pohľad." },
      { t: "\u201EMám nejaký fond v banke\u201D 😳", e: "😳", p: 0, shock: true, tip: "<b>Vlastníš niečo, o čom nevieš nič — a platíš za to poplatky.</b> Prvý krok: zisti názov fondu, otvor jeho KID a factsheet. Druhý krok: porovnaj poplatky a zloženie s nízkonákladovou alternatívou." },
    ],
  },
  {
    c: "P", q: "Koľko % portfólia máš v jednom ETF?",
    a: [
      { t: "20 – 40 %", e: "🛡️", p: 2 },
      { t: "Viac ako 50 %", e: "🟡", p: 1, tip: "<b>Záleží, aké ETF to je.</b> Polovica portfólia v širokom svetovom indexe je niečo iné ako polovica v úzkom tematickom ETF (AI, čisté energie, jeden sektor) — to druhé je koncentrovaná stávka, nie diverzifikácia. Over si, čo presne držíš." },
      { t: "Neviem 🚩", e: "🚩", p: 0, flag: true, tip: "<b>🚩 Ak nevieš, koľko máš v čom, nevieš ani aké riziko nesieš.</b> Tematické a sektorové ETF vedia padnúť o 60 – 80 % a roky sa nespamätať. Prvý krok auditu: rozpísať si portfólio na percentá a zistiť, na čom reálne stojí." },
    ],
  },
  /* ---- DANE A ŠTRUKTÚRA ---- */
  {
    c: "D", q: "Časový test: vieš, ktoré tvoje investície sú po roku oslobodené od dane — a ktoré nebudú oslobodené nikdy?",
    a: [
      { t: "Viem presne, mám to nastavené vedome", e: "🧠", p: 2 },
      { t: "Počul som o tom", e: "🤔", p: 1, tip: "<b>Časový test je najväčšia legálna daňová výhoda slovenského investora</b> — ale platí len pre niektoré nástroje. Over si, do ktorej skupiny patrí každý tvoj produkt." },
      { t: "Aký časový test? 😳", e: "😳", p: 0, shock: true, tip: "<b>ETF obchodované na burze sú po viac ako roku držania oslobodené od dane z výnosu. Podielové fondy nie — tam zaplatíš 19 % vždy.</b> Rovnaký trh, rovnaký výnos — úplne iné peniaze v ruke." },
    ],
  },
  {
    c: "D", q: "Akumulačné vs. distribučné ETF: vieš, prečo na tom daňovo záleží?",
    a: [
      { t: "Viem — vybral som si vedome", e: "📄", p: 2 },
      { t: "Tuším rozdiel", e: "🤔", p: 1, tip: "<b>Akumulačné ETF dividendy reinvestuje samo — distribučné ti ich vypláca a tým otvára daňovú otázku.</b> Pre dlhodobé budovanie majetku je voľba jasná, ale musí byť vedomá." },
      { t: "Prvýkrát počujem 😳", e: "😳", p: 0, shock: true, tip: "<b>Jedno písmeno v názve ETF (Acc/Dist) rozhoduje, či sa ti dividendy potichu skladajú, alebo riešiš daňové priznanie.</b> Detail, ktorý za 20 rokov spraví tisíce eur." },
    ],
  },
  {
    c: "D", q: "Domicil fondu: vieš, prečo ti írske ETF môže ušetriť na dani z dividend?",
    a: [
      { t: "Viem", e: "🇮🇪", p: 2 },
      { t: "Niečo som čítal", e: "📖", p: 1, tip: "<b>Domicil rozhoduje o zrážkovej dani z dividend vnútri fondu.</b> Írske UCITS ETF majú vďaka zmluve s USA výhodnejší režim — preto sú štandardom európskych investorov." },
      { t: "Čo je domicil? 😳", e: "😳", p: 0, shock: true, tip: "<b>Dve ETF na rovnaký index môžu mať rôzny čistý výnos len kvôli tomu, kde sú registrované.</b> Domicil je jeden z detailov, ktoré oddeľujú poskladané portfólio od náhodne nakúpeného." },
    ],
  },
  /* ---- CIEĽ ---- */
  {
    c: "C", q: "Vieš, na akú sumu investuješ — koľko potrebuješ na svoju rentu?",
    a: [
      { t: "Mám presné číslo aj dátum", e: "🎯", p: 2 },
      { t: "Zhruba tuším", e: "🤔", p: 1, tip: "<b>Bez čísla nevieš, či ti stačí 100 € mesačne alebo potrebuješ 500.</b> Renta sa dá prepočítať na konkrétnu sumu a dátum — a celé portfólio sa potom stavia od konca." },
      { t: "Investujem \u201Ečo najviac\u201D 😶", e: "😶", p: 0, shock: true, tip: "<b>\u201EČo najviac\u201D nie je cieľ — je to pocit.</b> Cieľ má sumu, dátum a mesačný vklad. Kým ho nemáš, nevieš ani vyhodnotiť, či ti tvoje investovanie funguje." },
    ],
  },
  {
    c: "C", q: "Sedí tvoj horizont s tým, do čoho investuješ?",
    a: [
      { t: "Áno — peniaze, ktoré budem skoro potrebovať, v akciách nemám", e: "✅", p: 2 },
      { t: "Neviem to posúdiť", e: "🤷", p: 1, tip: "<b>Pravidlo: čo budeš potrebovať do ~5 rokov, nepatrí do akcií.</b> Prejdi si každý svoj cieľ (byt, auto, renta) a priraď mu správny nástroj podľa horizontu." },
      { t: "Peniaze, ktoré budem potrebovať o pár rokov, mám v akciách 🚩", e: "🚩", p: 0, flag: true, tip: "<b>🚩 Toto je najčastejší spôsob, ako sa z investora stane nútený predajca.</b> Ak trh spadne rok pred tým, než peniaze potrebuješ, predávaš v strate — bez ohľadu na to, aký dobrý bol plán." },
    ],
  },
  {
    c: "C", q: "Máš najprv železnú rezervu — a až potom investície?",
    a: [
      { t: "Áno, 6 mesiacov výdavkov bokom", e: "🛡️", p: 2 },
      { t: "Čiastočne, buduje sa", e: "🟡", p: 1, tip: "<b>Rezerva chráni tvoje investície pred tebou samým.</b> Bez nej každý nečakaný výdavok riešiš predajom portfólia — často v najhorší možný moment." },
      { t: "Investujem všetko, rezervu nemám 🚩", e: "🚩", p: 0, flag: true, tip: "<b>🚩 Investovanie bez rezervy je dom bez základov.</b> Prvá pokazená práčka alebo výpadok príjmu ťa donúti predávať — a trh sa nepýta, či je práve vhodný čas. Najprv rezerva, potom všetko ostatné." },
    ],
  },
  {
    c: "C", q: "Kto ti staval tvoje súčasné portfólio?",
    a: [
      { t: "Kvalifikovaný investičný poradca s férovými poplatkami — je postavené na dátach, stratégii a rozumných krokoch", e: "🧠", p: 2 },
      { t: "Bankár / bežný poradca", e: "🏦", p: 1, tip: "<b>Otázka nie je, či ti poradil dobre — otázka je, či vieš prečo a koľko za to platíš.</b> Vypýtaj si zdôvodnenie každého produktu a jeho poplatky. Kvalifikovaný poradca ti ich povie rád, predajca začne hmlieť." },
      { t: "Staval som ho sám podľa YouTube, kamarátov, internetu", e: "😅", p: 0, tip: "<b>Internet ti dá informácie, ale nie stratégiu ani zodpovednosť.</b> Samostavané portfólio býva mix tipov bez systému — funguje, kým rastie trh. Audit ti ukáže, či máš systém, alebo zbierku náhod." },
    ],
  },
  {
    c: "C", q: "Predstav si: investuješ 300 € mesačne do akciových ETF a po 20 rokoch máš 230 000 €. Chceš investovať ešte 10 rokov. Ako ich investuješ ďalej?",
    a: [
      { t: "Posledné roky ich budem postupne prekladať do dlhopisov a hotovosti", e: "🪜", p: 2 },
      { t: "Nechám všetko ďalších 10 rokov v akciách", e: "📈", p: 1, tip: "<b>Odvážne — ale spočítaj si sekvenčné riziko.</b> Pád o 40 % rok pred čerpaním renty ti zoberie to, čo si 20 rokov staval. Posledné roky pred cieľom sa portfólio postupne upokojuje — presne načasovať to je remeslo." },
      { t: "Nikdy som nad tým neuvažoval 😳", e: "😳", p: 0, shock: true, tip: "<b>Toto je otázka, ktorá oddeľuje sporiteľov od investorov.</b> Najnebezpečnejšie roky celého investovania sú tie posledné — pád trhu tesne pred rentou ťa zasiahne najviac, lebo máš najviac v hre. Plán postupného presunu do konzervatívnych aktív sa stavia roky dopredu." },
    ],
  },
];

const MAX = Q.length * 2; // 30

// ===== HELPERS =====
type CatKey = keyof typeof CATS;
type Cls = "g" | "a" | "r";
const CAT_KEYS = Object.keys(CATS) as CatKey[];

/** Popisok kategórie bez úvodného emoji — v UI používame ikony lucide, emoji ostáva len v texte. */
const catLabel = (c: CatKey) => CATS[c].replace(/^[^\p{L}\p{N}]+/u, "");
const CAT_ICON: Record<CatKey, LucideIcon> = { S: Brain, P: ChartPie, D: FileText, C: Target };
/** Tón karty otázky podľa oblasti (šalvia / piesok / kameň). */
const CAT_TONE: Record<CatKey, string> = { S: "sage", P: "sand", D: "stone", C: "sage" };

const shockText = (n: number) =>
  n === 1 ? "1 otázka" : n < 5 ? `${n} otázky` : `${n} otázok`;

/** Verdikt: prvá veta ako italic zlatý dôraz, zvyšok krémový. */
const splitVerdict = (s: string): [string, string] => {
  const i = s.indexOf(". ");
  return i > 0 ? [s.slice(0, i + 1), s.slice(i + 2)] : [s, ""];
};

const VERDICT: Record<Cls, string> = {
  g: "Zelená. Máš to pod kontrolou.",
  a: "Žltá. Tvoje portfólio potrebuje audit.",
  r: "Červená. Tvoje peniaze pracujú proti tebe.",
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

// ===== MAIN COMPONENT =====
const EtfSemaforCalculator = () => {
  const [phase, setPhase]     = useState<Phase>("intro");
  const [idx, setIdx]         = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase]);

  const handleStart = () => { setIdx(0); setAnswers([]); setPhase("quiz"); };
  const handleRestart = () => { setIdx(0); setAnswers([]); setPhase("quiz"); };

  const handleAnswer = (i: number) => {
    const next = [...answers];
    next[idx] = i;
    setAnswers(next);
    if (idx + 1 < Q.length) setIdx(idx + 1);
    else setPhase("result");
  };

  const handleBack = () => { if (idx > 0) setIdx(idx - 1); };

  const result = useMemo(() => {
    if (phase !== "result" || answers.length < Q.length) return null;
    let score = 0, flags = 0, shocks = 0;
    const catScore: Record<string, number> = {};
    const catMax:   Record<string, number> = {};
    const tips: Array<{ tip: string; flag: boolean }> = [];

    Q.forEach((q, qi) => {
      const a = q.a[answers[qi]];
      if (!a) return;
      score += a.p;
      catScore[q.c] = (catScore[q.c] ?? 0) + a.p;
      catMax[q.c]   = (catMax[q.c]   ?? 0) + 2;
      if (a.flag)  flags++;
      if (a.shock) shocks++;
      if (a.tip)   tips.push({ tip: a.tip, flag: !!a.flag });
    });

    let worstCat = "" as keyof typeof CATS, worstR = 1;
    (Object.keys(CATS) as Array<keyof typeof CATS>).forEach(c => {
      const r = (catScore[c] ?? 0) / (catMax[c] ?? 1);
      if (r < worstR) { worstR = r; worstCat = c; }
    });

    const p = score / MAX;
    let cls: "g" | "a" | "r";
    if (flags >= 2 || p < 0.55)      cls = "r";
    else if (flags === 1 || p < 0.8) cls = "a";
    else                              cls = "g";

    const worstName = CATS[worstCat] ?? "";
    let reco: string;
    if (cls === "g") {
      reco = `Patríš do úzkej menšiny — väčšina investorov by tento semafor neprešla. Najslabšie ti vyšla oblasť <b>${worstName}</b>, dotiahnuť ju je tvoj ďalší krok. A ak chceš mať istotu, že ti nič neuniká, <b>priprav si svoje portfólio — AUDIT dostaneš zadarmo</b> a prejdeme ho číslo po čísle.`;
    } else if (cls === "a") {
      reco = `Investuješ — a to je viac, než robí väčšina. Ale tvoje portfólio má diery, najväčšiu v oblasti <b>${worstName}</b>. Každý rok, ktorý ich nechávaš otvorené, ťa potichu stojí peniaze. Najrýchlejšia oprava? <b>Priprav si svoje portfólio — AUDIT dostaneš zadarmo.</b> Za 45 minút budeš presne vedieť, čo zmeniť.`;
    } else {
      reco = `Toto nie je hejt — je to zrkadlo. Tvoje investovanie momentálne stojí na náhode, najslabšia je oblasť <b>${worstName}</b>${flags ? ` a k tomu máš ${flags === 1 ? "červenú vlajku" : "červené vlajky"}, z ktorých každá ti vie rozbiť plán` : ""}. Dobrá správa: všetko z toho sa dá opraviť — a čím skôr, tým lacnejšie. <b>Priprav si svoje portfólio — AUDIT dostaneš zadarmo</b> a nastavíme to nanovo.`;
    }

    return { score, flags, shocks, catScore, catMax, tips, worstCat, p, cls, reco };
  }, [phase, answers]);

  const q = Q[idx];
  const progress = idx / Q.length * 100;
  const CatIcon = q ? CAT_ICON[q.c] : Brain;

  // odvodené hodnoty pre výsledok (iba vizuál)
  const cls: Cls = result?.cls ?? "g";
  const tone = TONE[cls];
  const [vHead, vRest] = splitVerdict(VERDICT[cls]);
  const pct = result ? Math.round(result.p * 100) : 0;
  const ringOff = RING_C * (1 - (result?.p ?? 0));
  const worstLabel = result && CATS[result.worstCat] ? catLabel(result.worstCat) : null;

  return (
    <div id="etfs-root" className="calc-ui etfs w-full font-sans">
      <div className="calc-body-shell">
        <div className="calc-page etfs-page">

          {/* ===== INTRO ===== */}
          {phase === "intro" && (
            <>
              <header className="calc-header calc-reveal" style={st(0)}>
                <span className="calc-eyebrow">ETF semafor</span>
                <h1 className="calc-title">Investuješ.<br />Ale investuješ <em>správne?</em></h1>
                <p className="calc-subtitle">15 otázok, 3 minúty. O stratégii, krízach, daniach a chybách, ktoré ťa potichu stoja peniaze — a o ktorých ti nie každý povie.</p>
              </header>
              <section className="etfs-intro calc-reveal" style={st(1)} aria-label="Spustiť semafor">
                <div className="etfs-lights" aria-hidden>
                  <span className="etfs-light etfs-light--r" /><span className="etfs-light etfs-light--a" /><span className="etfs-light etfs-light--g" />
                </div>
                <button type="button" onClick={handleStart} className="btn-primary etfs-btn">
                  Spustiť semafor <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </button>
                <span className="etfs-micro">zadarmo · bez e-mailu · výsledok hneď</span>
              </section>
              <ul className="etfs-areas" aria-label="Oblasti otázok">
                {CAT_KEYS.map((c, i) => {
                  const Icon = CAT_ICON[c];
                  const n = Q.filter((x) => x.c === c).length;
                  return (
                    <li key={c} className={`etfs-area calc-tone--${CAT_TONE[c]} calc-reveal`} style={st(2 + i)}>
                      <span className="etfs-area-icon"><Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden /></span>
                      <span className="etfs-area-name">{catLabel(c)}</span>
                      <span className="etfs-area-n">{shockText(n)}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* ===== QUIZ ===== */}
          {phase === "quiz" && q && (
            <section className="etfs-quiz" aria-label="Otázky">
              <div className="etfs-quiz-top calc-reveal" style={st(0)}>
                <span className="calc-eyebrow">ETF semafor</span>
              </div>
              <div className="etfs-progress calc-reveal" style={st(0)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Priebeh">
                <span className="etfs-progress-fill" style={{ width: `${Math.max(3, progress)}%` }} />
              </div>
              <div className="etfs-meta calc-reveal" style={st(0)}>
                <span>Otázka <strong>{idx + 1}</strong> / {Q.length}</span>
                <span className="etfs-meta-cat"><CatIcon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />{catLabel(q.c)}</span>
              </div>

              {/* Question card — key forces re-animation on each question */}
              <div key={idx} className={`calc-panel calc-tone--${CAT_TONE[q.c]} etfs-qcard`}>
                <h2 className="etfs-qtxt">{q.q}</h2>
                <div className="etfs-ans" role="group" aria-label="Odpovede">
                  {q.a.map((a, i) => {
                    const chosen = answers[idx] === i;
                    return (
                      <button key={i} type="button" onClick={() => handleAnswer(i)} className={`etfs-ans-btn${chosen ? " is-chosen" : ""}`} aria-pressed={chosen}>
                        <span className="etfs-ans-key" aria-hidden>{i + 1}</span>
                        <span className="etfs-ans-text">{a.t}</span>
                      </button>
                    );
                  })}
                </div>
                {idx > 0 && (
                  <button type="button" onClick={handleBack} className="etfs-back"><ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Späť</button>
                )}
              </div>
            </section>
          )}

          {/* ===== RESULT ===== */}
          {phase === "result" && result && (
            <section className="etfs-result" aria-label="Výsledok">
              {/* jeden plochý hnedý panel: verdikt + skóre */}
              <div className="etfs-hero calc-reveal" style={st(0, { "--etfs-tone": tone.dark })}>
                <div className="etfs-hero-main">
                  <p className="etfs-kicker">Tvoj výsledok</p>
                  <h2 className="etfs-verdict"><em>{vHead}</em> {vRest}</h2>
                  {result.flags > 0 && (
                    <p className="etfs-flags">
                      <Flag className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      <span>{result.flags === 1 ? "1 červená vlajka — riziko, ktoré ti vie rozbiť celý plán" : `${result.flags} červené vlajky — každá z nich ti vie rozbiť celý plán`}</span>
                    </p>
                  )}
                  <div className="etfs-hero-metrics">
                    <div><span className="etfs-metric-label">Skóre</span><strong>{result.score} / {MAX}</strong><small>bodov</small></div>
                    <div><span className="etfs-metric-label">Červené vlajky</span><strong className={result.flags ? "is-neg" : "is-pos"}>{result.flags}</strong><small>v odpovediach</small></div>
                    {worstLabel ? <div className="is-wide"><span className="etfs-metric-label">Najslabšia oblasť</span><strong>{worstLabel}</strong><small>tvoj ďalší krok</small></div> : null}
                  </div>
                </div>
                <div className="etfs-hero-side">
                  <div className="etfs-ring" role="img" aria-label={`Skóre ${pct} zo 100`}>
                    <svg viewBox="0 0 128 128" aria-hidden>
                      <circle cx="64" cy="64" r={RING_R} fill="none" stroke="rgba(243,233,221, 0.28)" strokeWidth="8" />
                      <circle className="etfs-ring-arc" cx="64" cy="64" r={RING_R} fill="none" stroke={tone.dark} strokeWidth="8" strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={ringOff} transform="rotate(-90 64 64)" style={{ "--c": RING_C, "--o": ringOff } as CSSProperties} />
                    </svg>
                    <div className="etfs-ring-center"><span className="etfs-ring-val">{pct}<small>%</small></span><span className="etfs-ring-cap">skóre</span></div>
                  </div>
                  <div className="etfs-semafor" aria-hidden>
                    <span className={cls === "r" ? "is-on" : ""} /><span className={cls === "a" ? "is-on" : ""} /><span className={cls === "g" ? "is-on" : ""} />
                  </div>
                </div>
              </div>

              {/* Shock box */}
              {result.shocks > 0 && (
                <div className="etfs-shock calc-tone--stone calc-reveal" style={st(1)}>
                  <p className="etfs-shock-big">Zaskočilo ťa <em>{shockText(result.shocks)}</em> 😳</p>
                  <p className="etfs-shock-text">Každá z nich je miesto, kde tvoje portfólio potichu stráca peniaze alebo zbytočne riskuje. Dobrá správa: všetky sa dajú opraviť.</p>
                </div>
              )}

              {/* Recommendation */}
              <div className={`etfs-reco calc-tone--${tone.card} calc-reveal`} style={st(2, { "--etfs-reco": tone.label })}>
                <p className="etfs-reco-lbl">Odporúčanie</p>
                <p className="etfs-reco-text" dangerouslySetInnerHTML={{ __html: result.reco }} />
              </div>

              {/* Category bars */}
              <div className="calc-panel etfs-panel calc-reveal" style={st(3)}>
                <h3 className="etfs-h3">Podľa oblastí</h3>
                {CAT_KEYS.map(c => {
                  const Icon = CAT_ICON[c];
                  const score = result.catScore[c] ?? 0;
                  const max   = result.catMax[c]   ?? 1;
                  const ratio = score / max;
                  return (
                    <div key={c} className="etfs-cat">
                      <div className="etfs-cat-top">
                        <span className="etfs-cat-name"><Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />{catLabel(c)}</span>
                        <span className="etfs-cat-score">{score} / {max}</span>
                      </div>
                      <div className="etfs-cat-bar">
                        <span className="etfs-cat-fill" style={{ width: `${ratio * 100}%`, background: colFor(ratio) }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tips */}
              <div className="calc-panel etfs-panel calc-reveal" style={st(4)}>
                <h3 className="etfs-h3">Čo s tým 👇</h3>
                {result.tips.length > 0
                  ? [...result.tips]
                      .sort((a, b) => Number(b.flag) - Number(a.flag))
                      .map((tip, i) => (
                        <div key={i} className={`etfs-tip${tip.flag ? " is-flag" : ""}`}>
                          <span className="etfs-tip-icon">{tip.flag ? <Flag className="h-4 w-4" strokeWidth={1.75} aria-hidden /> : <Lightbulb className="h-4 w-4" strokeWidth={1.75} aria-hidden />}</span>
                          <span dangerouslySetInnerHTML={{ __html: tip.tip }} />
                        </div>
                      ))
                  : (
                    <div className="etfs-tip">
                      <span className="etfs-tip-icon"><ThumbsUp className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                      <span><b>Plný počet — rešpekt.</b> Buď investuješ naozaj premyslene, alebo si bol na seba mierny. Over si odpovede s chladnou hlavou — a drž systém, ktorý máš.</span>
                    </div>
                  )
                }
                <div className="etfs-tip is-cta">
                  <span className="etfs-tip-icon"><MessageCircle className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                  <span><b>A pri každom bode vyššie platí:</b> nemusíš to lúskať sám. Priprav si svoje portfólio — AUDIT dostaneš zadarmo. 45 minút, online, prejdeme ho číslo po čísle.</span>
                </div>
              </div>

              {/* CTA */}
              <div className="etfs-cta calc-reveal" style={st(5)}>
                <a
                  href={KONZULTACIA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary etfs-btn"
                  data-umami-event="click_konzultacia"
                  data-umami-event-section="etf-semafor"
                >
                  {BONUSY_CTA_LABEL} <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </a>
                <span className="etfs-micro">Priprav si svoje portfólio — audit dostaneš zadarmo</span>
                <button type="button" onClick={handleRestart} className="etfs-ghost">
                  <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Spustiť znova
                </button>
              </div>
            </section>
          )}

          {/* ===== FOOTER DISCLAIMER ===== */}
          <p className="calc-note calc-note--center etfs-foot">
            ETF semafor je orientačný vzdelávací nástroj. Daňové a investičné dopady závisia od tvojej konkrétnej situácie — preto ich preberáme individuálne. Nejde o investičné ani daňové odporúčanie.
          </p>

        </div>
      </div>
    </div>
  );
};

export default EtfSemaforCalculator;
