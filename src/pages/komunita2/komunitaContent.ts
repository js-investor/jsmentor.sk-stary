/**
 * komunitaContent.ts — verbatim content of the /komunita landing page.
 *
 * Extracted from src/pages/Komunita.tsx and the section components it renders
 * (src/components/sections/*, src/components/templates/HeroSectionTemplate.tsx,
 * src/components/layout/SiteHeader.tsx, src/components/sections/FooterSection.tsx)
 * so that a redesigned page can consume the same copy without touching the legacy
 * components. Nothing here is rephrased — every string is copied as it renders.
 *
 * Conventions
 * - `**text**`      → the phrase is wrapped in <strong> in the original.
 * - `[text](href)`  → inline link in the original (used once, in FAQ).
 * - `\n`            → forced line break (<br />) in the original.
 * - `U+00A0`        → non-breaking space written as &nbsp; in the original.
 * - Images are module path strings ("@/assets/…"); the consumer decides how to import them.
 * - `icon` values are lucide-react export names.
 * - `umamiEvent` / `umamiSection` mirror data-umami-event / data-umami-event-section.
 *   `umamiSection: undefined` means the attribute is absent in the original.
 * - HeroHeroKalkulackySection is deliberately NOT extracted (already redesigned);
 *   only its position in PAGE_ORDER and its tracking values are recorded.
 */

import {
  CENNIK_SECTION_HASH,
  CENNIK_SECTION_HREF,
  CENNIK_SECTION_ID,
  HEROHERO_JOIN_URL,
  KOMUNITA_PATH,
} from "@/lib/cennikCta";

/* ------------------------------------------------------------------ */
/* Shared types                                                        */
/* ------------------------------------------------------------------ */

export type UmamiEvent = "click_cennik" | "click_herohero" | "click_video_cennik";

export type Cta = {
  label: string;
  href: string;
  /** true → target="_blank" rel="noopener noreferrer" in the original. */
  external?: boolean;
  umamiEvent: UmamiEvent;
  /** data-umami-event-section; undefined when the attribute is not set. */
  umamiSection?: string;
};

export type ImageRef = {
  /** Module path, e.g. "@/assets/images/foo.webp". */
  src: string;
  alt: string;
};

export type FaqEntry = {
  question: string;
  /** One string per <p>; may contain `**bold**` and `[link](href)` markers. */
  answer: readonly string[];
};

/* ------------------------------------------------------------------ */
/* Links, tracking, anchors, page order                                */
/* ------------------------------------------------------------------ */

export const LINKS = {
  /** "/komunita" */
  komunitaPath: KOMUNITA_PATH,
  /** "CTA1" — id of the HODNOTA section, target of every "Chcem sa pridať" button. */
  cennikSectionId: CENNIK_SECTION_ID,
  /** "#CTA1" */
  cennikSectionHash: CENNIK_SECTION_HASH,
  /** "/komunita#CTA1" — href of all in-page CTAs. */
  cennikSectionHref: CENNIK_SECTION_HREF,
  /** "https://herohero.co/jsmentor" — the actual join/checkout URL (HODNOTA + CENNIK buttons). */
  joinHref: HEROHERO_JOIN_URL,
  /** Linked from the FAQ answer "Je toto investičné poradenstvo?". */
  konzultaciaUrl: "/konzultacia",
  /** Footer link. */
  gdprUrl: "/gdpr",
  /** Logo link (header + footer). */
  homeUrl: "/",
  /** Hero Vimeo embed. */
  heroVideoUrl:
    "https://player.vimeo.com/video/1212923039?h=bfcdeb03df&autoplay=0&title=0&portrait=0&byline=0",
} as const;

/** data-umami-event / data-umami-event-section per CTA location. */
export const TRACKING = {
  header: { event: "click_cennik", section: "header" },
  hero: { event: "click_cennik", section: "hero" },
  chyby: { event: "click_cennik", section: "chyby" },
  nastroje: { event: "click_cennik", section: "nastroje" },
  /** Video thumbnail buttons in DARK_GRADIENT (scroll to CTA1). */
  ukazkyPlay: { event: "click_video_cennik", section: "ukazky-play" },
  /** Button under the video showcase in DARK_GRADIENT. */
  ukazkyCta: { event: "click_cennik", section: "ukazky-cta" },
  /** HeroHeroKalkulackySection — not extracted here, recorded for completeness. */
  kalkulacky: { event: "click_cennik", section: "kalkulacky" },
  recenzie: { event: "click_cennik", section: "recenzie" },
  /** HODNOTA join button (external HeroHero link). */
  cta1: { event: "click_herohero", section: "CTA1" },
  /** CENNIK (hidden CTA2) join button (external HeroHero link). */
  cta2: { event: "click_herohero", section: "cennik" },
  /** POROVNANIE button has NO data-umami-event-section in the original. */
  porovnanie: { event: "click_cennik", section: undefined },
  recenzieGaleria: { event: "click_cennik", section: "recenzie-galeria" },
} as const;

/** DOM ids used as scroll anchors (sections without an id are omitted). */
export const SECTION_IDS = {
  intro: "ivan",
  chyby: "financne-chyby",
  nastroje: "nastroje",
  darkGradient: "ukazky-videi",
  reviews: "recenzie",
  hodnota: CENNIK_SECTION_ID, // "CTA1"
  cennik: "CTA2",
  faq: "faq",
  porovnanie: "porovnanie",
} as const;

/** Render order on /komunita (Komunita.tsx). */
export const PAGE_ORDER = [
  "HEADER",
  "HERO",
  "INTRO",
  "CHYBY",
  "NASTROJE",
  "DARK_GRADIENT",
  "KALKULACKY", // HeroHeroKalkulackySection — already redesigned, not extracted
  "REVIEWS",
  "HODNOTA", // CTA1 — main conversion section
  "CENNIK", // CTA2 — wrapped in <div class="hidden" aria-hidden data-section="CTA2">, "nemazať"
  "QUOTE",
  "IVAN",
  "FAQ",
  "POROVNANIE",
  "GALERIA",
  "FOOTER", // rendered by PageWrapper, not by Komunita.tsx itself
] as const;

/* ------------------------------------------------------------------ */
/* HEADER (SiteHeader, rendered by HeroSectionTemplate)                */
/* ------------------------------------------------------------------ */

export const HEADER = {
  logo: { src: "@/assets/images/js-mentor-logo.png", alt: "JS Mentor logo" },
  logoHref: LINKS.homeUrl,
  cta: {
    label: "Chcem sa pridať ZADARMO 🚀",
    href: CENNIK_SECTION_HREF,
    umamiEvent: "click_cennik",
    umamiSection: "header",
  },
} as const;

/* ------------------------------------------------------------------ */
/* HERO (HomeDesignHeaderSection + HeroSectionTemplate + HeroTrustStatsBar) */
/* ------------------------------------------------------------------ */

export const HERO = {
  /** Pill above the headline (dark-red #7A1F1F pill, white sans text, normal case). */
  eyebrow: "Miesto, kde konečne pochopíš, ako fungujú peniaze",
  /** <h1>; no bold/italic spans inside — one <br /> after "cesta". */
  headline: "Toto je cesta\nk bohatšiemu životu.",
  subheadline:
    "Vyšší príjem ti môže kúpiť pohodlie. Rozumné finančné rozhodnutia ti kupujú slobodu.",
  description:
    "V mojej komunite ti ukážem, ako robiť lepšie rozhodnutia pri investovaní, hypotéke, fondoch, ETF, nehnuteľnostiach, rente a produktoch, ktoré ťa môžu stáť tisíce eur.",
  /** No bullet list in the hero. */
  bullets: [] as const,
  primaryCta: {
    label: "Chcem sa pridať ZADARMO 🚀",
    href: CENNIK_SECTION_HREF,
    umamiEvent: "click_cennik",
    umamiSection: "hero",
  },
  /** No secondary CTA in the hero. */
  secondaryCta: null,
  /** No hero image — a Vimeo iframe sits below the CTA. */
  image: null,
  video: {
    provider: "vimeo",
    src: LINKS.heroVideoUrl,
    /** iframe title attribute. */
    title: "Prečo väčšina neuspeje",
  },
  /** Three-up stats panel under the video (HeroTrustStatsBar). */
  trustStats: [
    { value: "123 000+", label: "sledovateľov na IG" },
    { value: "8 rokov", label: "skúsenosti" },
    { value: "3,5 mil. €+", label: "v starostlivosti" },
  ],
  /** Full-width beige (#eee8dd) banner under the stats; serif, "900" bold. */
  trustBanner: "viac ako **900** konzultácií o peniazoch",
  /** Visual order inside the hero. */
  order: [
    "eyebrow",
    "headline",
    "subheadline",
    "description",
    "primaryCta",
    "video",
    "trustStats",
    "trustBanner",
  ],
} as const;

/* ------------------------------------------------------------------ */
/* INTRO statement (HeroHeroIvanSection, id="ivan")                    */
/* ------------------------------------------------------------------ */

export const INTRO = {
  /** Large centred serif statement; `mutedLead` is rendered in grey #ada8a3, the rest in foreground. */
  mutedLead: "Táto komunita",
  text: "Táto komunita je pre ľudí, ktorí chcú finančne rásť. Ktorí chcú počuť odborné praktické rady a nie prázdne teórie.",
} as const;

/* ------------------------------------------------------------------ */
/* CHYBY — mistakes (HeroHeroChybySection, id="financne-chyby", black bg) */
/* ------------------------------------------------------------------ */

export const CHYBY = {
  image: { src: "@/assets/images/Ivan-Jašík-HeroHero.webp", alt: "Ivan Jašík" },
  /** "Toto sú chyby," is <strong>, the rest is font-normal. */
  heading:
    "**Toto sú chyby,** ktoré ľudí stoja najviac peňazí. A často vyzerajú úplne normálne.",
  intro:
    "Problém väčšiny ľudí nie je ich príjem. Problém je, že robia rozhodnutia, ktoré si nikdy poriadne neprepočítali.",
  /**
   * White pill cards, one line each. The original has no title/description split —
   * `text` is the full line, `emphasis` is the <strong> phrase, `emoji` the trailing emoji.
   */
  mistakes: [
    { text: "Zarábaš, ale **majetok nerastie** 😬", emphasis: "majetok nerastie", emoji: "😬" },
    { text: "Už **investuješ, ale nevieš** či správne 😥", emphasis: "investuješ, ale nevieš", emoji: "😥" },
    {
      text: "Nevieš či má zmysel **hypotéku skôr splatiť,** alebo si radšej peniaze odložiť 😫",
      emphasis: "hypotéku skôr splatiť,",
      emoji: "😫",
    },
    {
      text: "Všetci: BYTY BYTY BYTY, ale **nikto nepovie o rizikách** a reálnych číslach 🏠",
      emphasis: "nikto nepovie o rizikách",
      emoji: "🏠",
    },
    { text: "Ešte neinvestuješ, lebo sa **bojíš chýb** ❌", emphasis: "bojíš chýb", emoji: "❌" },
    { text: "Máš **vzťahové problémy** kvôli peniazom 👫", emphasis: "vzťahové problémy", emoji: "👫" },
    { text: "Tvoje peniaze nemajú **žiaden systém** 🤯", emphasis: "žiaden systém", emoji: "🤯" },
    {
      text: "**Máš v tom chaos.** Jeden hovorí splať úver. Druhý investuj. Tretí kúp byt. Čo teda ? 🫨",
      emphasis: "Máš v tom chaos.",
      emoji: "🫨",
    },
  ],
  /** No closing paragraph after the list in the original. */
  closing: null,
  cta: {
    label: "Chcem sa pridať ZADARMO 🚀",
    href: CENNIK_SECTION_HREF,
    umamiEvent: "click_cennik",
    umamiSection: "chyby",
  },
} as const;

/* ------------------------------------------------------------------ */
/* NASTROJE — what you get (HeroHeroNastrojeSection, id="nastroje")    */
/* ------------------------------------------------------------------ */

export const NASTROJE = {
  heading: "Čo všetko získaš?",
  subheading:
    "Získaš pravidelný obsah, praktické nástroje a konkrétne rozhodnutia pre lepšie financie.",
  /** Dark (#1A1A1A) tiles, 3-col grid; icon sits on a white brand-pattern mask. */
  benefitTabs: [
    { icon: "PlayCircle", line1: "Týždenné rozbory", line2: "videá hneď po vstupe" },
    { icon: "BarChart3", line1: "Analýzy slovenských produktov", line2: "hypotéky, byty, renta" },
    { icon: "Users", line1: "Reálne prípady ľudí", line2: "konkrétne finančné rozhodnutia" },
    { icon: "Calculator", line1: "Kalkulačky a mapa bytov", line2: "röntgen, semafor, nástroje" },
    { icon: "FileCheck", line1: "Checklisty a PDF", line2: "materiály na stiahnutie" },
    { icon: "TrendingUp", line1: "Investičné myslenie", line2: "bez rozprávok" },
  ],
  /** SVG used as a CSS mask behind each icon. */
  iconMaskPattern: "@/assets/logo/js-brand-pattern.svg",
  cta: {
    label: "Vyskúšať prvé 2 týždne zadarmo 🚀",
    href: CENNIK_SECTION_HREF,
    umamiEvent: "click_cennik",
    umamiSection: "nastroje",
  },
} as const;

/* ------------------------------------------------------------------ */
/* DARK_GRADIENT — video showcase (HeroHeroDarkGradientSection, id="ukazky-videi") */
/* ------------------------------------------------------------------ */

export const DARK_GRADIENT = {
  /** The 🍿 is an aria-hidden <span> in front of the text. */
  heading: "🍿 Toto nájdeš v komunite už dnes:",
  headingEmoji: "🍿",
  headingText: "Toto nájdeš v komunite už dnes:",
  /**
   * Three tilted thumbnails, each a <button> that scrolls to CTA1 (see `thumbnailClick`).
   * img alt equals the title. `tilt` is the CSS rotation of the card.
   */
  items: [
    {
      title: "Ako by som začal investovať v roku 2026, keby som dnes začínal od nuly",
      duration: "16 minút",
      image: {
        src: "@/assets/images/Ako by som zacal investovat.webp",
        alt: "Ako by som začal investovať v roku 2026, keby som dnes začínal od nuly",
      },
      tilt: "-2.5deg",
    },
    {
      title: "Kúpil som investičný byt. Toto sú riziká, o ktorých sa nahlas nehovorí.",
      duration: "21 minút",
      image: {
        src: "@/assets/images/Investicny byt.webp",
        alt: "Kúpil som investičný byt. Toto sú riziká, o ktorých sa nahlas nehovorí.",
      },
      tilt: "2.5deg",
    },
    {
      title: "Mimoriadna splátka hypotéky: kedy dáva zmysel a kedy je to drahá chyba",
      duration: "12 minút",
      image: {
        src: "@/assets/images/Mimoriadna splátka hypotéky.webp",
        alt: "Mimoriadna splátka hypotéky: kedy dáva zmysel a kedy je to drahá chyba",
      },
      tilt: "-2.5deg",
    },
  ],
  thumbnailClick: {
    scrollToId: CENNIK_SECTION_ID,
    umamiEvent: "click_video_cennik",
    umamiSection: "ukazky-play",
  },
  /** White pill button, forest-green text. */
  cta: {
    label: "Chcem si to pozrieť 👀",
    href: CENNIK_SECTION_HREF,
    umamiEvent: "click_cennik",
    umamiSection: "ukazky-cta",
  },
  /** Line under the CTA; "5 €" is <strong> in serif 900. */
  note: "Prvé 2 týždne zadarmo. Potom **5 €** mesačne. Zrušíš kedykoľvek.",
  background:
    "radial-gradient(ellipse 88% 78% at 50% 38%, #121212 0%, #080808 42%, #030303 72%, #000000 100%)",
} as const;

/* ------------------------------------------------------------------ */
/* REVIEWS (HeroHeroReviewsSection, id="recenzie", black bg)           */
/* ------------------------------------------------------------------ */

export const REVIEWS = {
  /** The 🙌 is an aria-hidden <span>. */
  heading: "Ľudia potrebujú o peniazoch počuť ľudskou rečou 🙌",
  /** No subheading in the original. */
  subheading: null,
  /** Coloured stat cards; `text` is the rendered label (bold word marked). */
  stats: [
    { number: "2000+", text: "ľudí si pozrelo môj **investičný** kurz", bg: "#1A1A1A", border: true },
    { number: "1100+", text: "ľudí si pozrelo môj **rentový** kurz", bg: "#1B4332", border: false },
    { number: "900+", text: "Som individuálne nastavil plán", bg: "#6B5744", border: false },
  ],
  testimonials: [
    {
      quote: "Ivan mi za dva týždne ukázal plán, podľa ktorého investujem dodnes.",
      name: "MuDr. Martin Vanečko",
      role: "Doktor pôsobiaci vo Švajčiarsku",
      avatar: { src: "@/assets/images/vanecko.webp", alt: "MuDr. Martin Vanečko" },
    },
    {
      quote: "Ivan je profesionál. Spolupracujeme 5 rokov. Každý rok môj majetok rastie.",
      name: "Šimon Latkoczy",
      role: "Slovenský hokejový reprezentant",
      avatar: { src: "@/assets/images/Latkoczy.webp", alt: "Šimon Latkoczy" },
    },
    {
      quote: "Ivan presne vie, ako z firemného zisku spraviť osobný majetok.",
      name: "Ladislav Papik",
      role: "Konateľ PAPIK ENTERPRISE s.r.o.",
      avatar: { src: "@/assets/images/papik.webp", alt: "Ladislav Papik" },
    },
  ],
  /**
   * Desktop: 3 rows, stat card (35 %) + testimonial (65 %); in row 2 the stat is on the right.
   * Mobile: flat list stat → testimonial × 3 (stats[i] pairs with testimonials[i]).
   */
  layout: {
    desktopRows: [
      { stat: 0, testimonial: 0, statRight: false },
      { stat: 1, testimonial: 1, statRight: true },
      { stat: 2, testimonial: 2, statRight: false },
    ],
  },
  cta: {
    label: "Vyskúšať prvé 2 týždne zadarmo 🚀",
    href: CENNIK_SECTION_HREF,
    umamiEvent: "click_cennik",
    umamiSection: "recenzie",
  },
} as const;

/* ------------------------------------------------------------------ */
/* HODNOTA — value + price, CTA1 (HeroHeroHodnotaSection, id="CTA1")   */
/* ------------------------------------------------------------------ */

export const HODNOTA = {
  sectionId: CENNIK_SECTION_ID, // "CTA1"; also data-section="CTA1"
  /** Small uppercase tracked label in primary colour. */
  eyebrow: "Členstvo v komunite",
  heading: "Čo všetko získaš v komunite?",
  subheading:
    "Praktický obsah, nástroje a odpovede, ktoré ti pomôžu robiť lepšie rozhodnutia s peniazmi.",
  /** Six dark (#1A1A1A) cards, icon on cream brand-pattern mask, serif bold title. */
  benefitCards: [
    {
      icon: "CalendarDays",
      title: "Nový odborný obsah každý týždeň",
      description: "Rozbory, čísla a témy, ktoré práve hýbu na finančnom trhu.",
    },
    {
      icon: "BarChart3",
      title: "Rozbory fondov, hypoték a bytov",
      description: "Aj ďalších finančných produktov — konkrétne poplatky, riziká a rozhodnutia.",
    },
    {
      icon: "Calculator",
      title: "Kalkulačky a aplikácie",
      description:
        "Rôzne aplikácie a kalkulačky — od investičných bytov až po výpočet daňového priznania.",
    },
    {
      icon: "Route",
      title: "Cesta k rezerve, portfóliu a rente",
      description: "Systém krok za krokom — od prvej rezervy po pasívny príjem.",
    },
    {
      icon: "Shield",
      title: "Slovenské produkty ľudskou rečou",
      description: "Čo majú bežní ľudia — a čo dáva skutočný zmysel.",
    },
    {
      icon: "MessageCircle",
      title: "Odpovede na otázky členov",
      description: "Pýtaš sa priamo mňa.",
    },
  ],
  /** Forest-green gradient panel under the cards. */
  price: {
    /** Small uppercase label (#8FBFA4). */
    eyebrow: "To všetko za",
    /** Huge serif 900 figure; nbsp between "0,17" and "€". */
    amount: "0,17 €",
    /** Small uppercase suffix after the amount. */
    unit: "denne",
    /** nbsp between "5" and "€". */
    line1: "Menej, ako necháš pri pokladni v drobných. 5 € mesačne.",
    line2: "Jedno lepšie finančné rozhodnutie ti môže ušetriť stovky až tisíce eur.",
  },
  /** Green check bullets next to the price. */
  checks: [
    "Prvé 2 týždne úplne zadarmo",
    "Žiadna viazanosť — zrušíš jedným klikom",
    "Okamžitý prístup k celému archívu a nástrojom",
  ],
  /** White pill button → HeroHero (new tab). */
  cta: {
    label: "Chcem vstúpiť do komunity 🚀",
    href: HEROHERO_JOIN_URL,
    external: true,
    umamiEvent: "click_herohero",
    umamiSection: "CTA1",
  },
  /** Small line under the button. */
  note: "Platba až po skončení skúšobného obdobia.",
  /** No badge/ribbon text in the original. */
  badge: null,
  iconMaskPattern: "@/assets/logo/js-brand-pattern.svg",
  panelGradient: "linear-gradient(160deg, #023c2e 0%, #065f4a 52%, #0a5a47 100%)",
} as const;

/* ------------------------------------------------------------------ */
/* CENNIK — hidden CTA2 (HeroHeroCennikSection, id="CTA2")             */
/* ------------------------------------------------------------------ */

export const CENNIK = {
  sectionId: "CTA2", // also data-section="CTA2"
  /** Komunita.tsx wraps it in <div className="hidden" aria-hidden="true" data-section="CTA2"> — "CTA2 — skryté, nemazať". */
  hidden: true,
  heading: "Prvé 2 týždne zadarmo, potom len 5 € mesačne",
  /** Serif, 60 % opacity. */
  subheading: "Menej ako jeden obed v meste",
  price: {
    /** Huge serif 900 figure. */
    amount: "5 €",
    unit: "/mesačne",
  },
  /** Green check bullets, centred block. */
  bullets: [
    "Prvé 2 týždne úplne zadarmo",
    "Absolútne žiadne záväzky",
    "Zrušenie kedykoľvek jedným klikom",
  ],
  /** White pill button → HeroHero (new tab). */
  cta: {
    label: "Chcem sa pridať 🚀",
    href: HEROHERO_JOIN_URL,
    external: true,
    umamiEvent: "click_herohero",
    umamiSection: "cennik",
  },
  /** Line under the button. */
  note: "Kedykoľvek môžeš zrušiť",
  badge: null,
  panelGradient: "linear-gradient(160deg, #023c2e 0%, #065f4a 52%, #0a5a47 100%)",
} as const;

/* ------------------------------------------------------------------ */
/* QUOTE (QuoteSection)                                                */
/* ------------------------------------------------------------------ */

export const QUOTE = {
  /** Large centred serif statement, no quotation marks in the original. */
  text: "Najlepšie investované peniaze sú do kvalitných informácií",
  /** No author line in the original. */
  author: null,
  /** No image in the original. */
  image: null,
} as const;

/* ------------------------------------------------------------------ */
/* IVAN — bio (IvanJasikSection, #111111 bg)                           */
/* ------------------------------------------------------------------ */

export const IVAN = {
  heading: "Kto je Ivan Jašík?",
  /** Four <p>; bold phrases marked. */
  paragraphs: [
    "Nie som tu na to, aby som ti predával sen o rýchlom zbohatnutí. Keď mi Meta druhýkrát vypla finančný profil jsInvestor, uvedomil som si jednu vec: najdôležitejšie finančné témy nemôžu stáť len na Instagrame.",
    "**Volám sa Ivan Jašík.** Viac ako 8 rokov pomáham ľuďom rozumne investovať a budovať majetok. Som pod dohľadom **Národnej banky Slovenska** a starám sa o viac ako **3,5 milióna eur** klientskych aktív.",
    "Vytváram ľuďom investičné plány na mieru: od ETF portfólií, cez investičné nehnuteľnosti, až po základný systém osobných financií.",
    "Viac ako 8 rokov vzdelávam verejnosť a chcem pokračovať. Preto vzniká táto komunita. **Komunita, kde budeme otvorene hovoriť o peniazoch, problémoch ale aj možnostiach.**",
  ],
  /** Numbers/claims lifted verbatim from the paragraphs (not rendered as separate stat tiles in the original). */
  facts: [
    { value: "8 rokov", context: "Viac ako 8 rokov pomáham ľuďom rozumne investovať a budovať majetok." },
    { value: "Národnej banky Slovenska", context: "Som pod dohľadom Národnej banky Slovenska" },
    { value: "3,5 milióna eur", context: "starám sa o viac ako 3,5 milióna eur klientskych aktív" },
  ],
  /** Full-width image under the text. */
  image: { src: "@/assets/images/o-mne-ivan-jasik.png", alt: "Ivan Jašík" },
  /** No CTA in this section. */
  cta: null,
} as const;

/* ------------------------------------------------------------------ */
/* FAQ (HeroHeroCasteFaqSection, id="faq", #F5EFEA bg)                 */
/* ------------------------------------------------------------------ */

export const FAQ = {
  heading: "Časté otázky",
  /** First item is open by default (useState(0)); one open at a time. */
  defaultOpenIndex: 0,
  items: [
    {
      question: "Mám vo financiách chaos a vôbec im nerozumiem. Je táto komunita pre mňa?",
      answer: [
        "Áno. Práve preto som túto komunitu vytvoril.",
        "**Nemusíš byť finančný expert.** Nepotrebuješ rozumieť všetkým grafom, fondom, ETF, hypotékam a poplatkom. Potrebuješ pochopiť základné rozhodnutia, ktoré robíš celý život: čo robiť s výplatou, ako si vytvoriť rezervu, ako začať investovať, ako rozmýšľať nad hypotékou, fondmi, bývaním, rentou a finančnou slobodou.",
        "**V komunite veci vysvetľujem ľudskou rečou, na konkrétnych príkladoch a cez čísla.**",
      ],
    },
    {
      question: "Čo ak zistím, že to pre mňa nie je? Musím sa viazať?",
      answer: [
        "Nie. Nemusíš sa viazať.",
        "**Prvé 2 týždne máš zadarmo.** Vojdeš dnu, pozrieš si videá, vyskúšaš nástroje, stiahneš si bonusy a rozhodneš sa podľa seba.",
        "**Ak zistíš, že ti to nedáva hodnotu, členstvo jednoducho zrušíš.** Bez viazanosti, bez telefonátov, bez presviedčania.",
      ],
    },
    {
      question: "Čo presne za 5 € mesačne dostanem?",
      answer: [
        "Dostaneš prístup do mojej komunity na HeroHero, kde každý týždeň pribudne nový praktický finančný obsah.",
        "Nájdeš tam videá **o investovaní, hypotékach, ETF, fondoch, investičných bytoch, rente, poplatkoch a produktoch na slovenskom trhu.**",
        "Okrem videí dostaneš aj **praktické nástroje a bonusy: kalkulačky, checklisty, PDF dokumenty, poplatkový röntgen, bytový a ETF semafor, interaktívnu mapu investičných bytov a ďalšie materiály,** ktoré ti pomôžu robiť lepšie rozhodnutia s peniazmi.",
        "Nie je to len ďalší obsah. Je to systém, podľa ktorého sa vieš rozhodovať.",
      ],
    },
    {
      question: "Prečo by som mal platiť, keď je internet plný finančných rád zadarmo?",
      answer: [
        "**Lebo internet je plný rád bez kontextu.**",
        "Jeden človek ti povie: splať hypotéku. Druhý ti povie: investuj. Tretí ti povie: kúp byt. Štvrtý ti ukáže fond. Piaty ti povie úplne opačný názor.",
        "A ty máš z toho spraviť rozhodnutie za tisíce eur.",
        "V komunite nejde o ďalší názor z internetu. Ide o systém, slovenský kontext, výpočty, poplatky, produkty a rozhodnutia, ktoré si vieš konečne prepočítať.",
      ],
    },
    {
      question: "Je toto investičné poradenstvo?",
      answer: [
        "Nie. Obsah v komunite má vzdelávací a informačný charakter.",
        "Ukazujem princípy, výpočty, porovnania, konkrétne produkty, riziká, poplatky a môj spôsob uvažovania. Cieľom je, aby si lepšie rozumel peniazom a vedel robiť rozumnejšie rozhodnutia.",
        "**Individuálne odporúčanie pre tvoju konkrétnu situáciu patrí na [osobnú konzultáciu](/konzultacia).**",
      ],
    },
    {
      question: "Budeš rozoberať aj konkrétne produkty na Slovensku?",
      answer: [
        "Áno. Práve to bude jedna z najväčších hodnôt komunity.",
        "Budem rozoberať fondy, investičné produkty, platformy, hypotéky, poplatky a **riešenia, ktoré ľudia na Slovensku bežne kupujú bez toho, aby im úplne rozumeli.**",
        "Nebude to štýlom „toto si kúp\". Bude to cez čísla, poplatky, riziká, výhody, nevýhody a alternatívy. Aby si konečne vedel, čo vlastne vlastníš alebo čo sa ti niekto snaží predať.",
      ],
    },
    {
      question: "Je to aj pre mňa, keď už investujem?",
      answer: [
        "Áno. Možno práve vtedy ešte viac.",
        "Ak už investuješ, komunita ti pomôže skontrolovať, čo vlastníš, koľko platíš, aké riziko podstupuješ a či by si si daný produkt kúpil znova, keby si sa dnes rozhodoval od nuly.",
        "Ak ešte neinvestuješ, začneš od základov. **Ak už investuješ, pôjdeme viac do optimalizácie, poplatkov, portfólia, hypotéky, nehnuteľností a rozhodnutí, ktoré môžu mať veľký dopad na tvoj majetok.**",
      ],
    },
  ],
} as const;

/* ------------------------------------------------------------------ */
/* POROVNANIE — comparison (HeroHeroPorovnanieSection, id="porovnanie") */
/* ------------------------------------------------------------------ */

export const POROVNANIE = {
  /** "Čo ti kradne peniaze vs." is font-500; "vybuduje tvoj majetok" is <strong> in primary colour. */
  heading: "Čo ti kradne peniaze vs. **vybuduje tvoj majetok**",
  /**
   * Two columns. The original renders NO column header text — `chaosTitle` / `knowHowTitle`
   * exist in the component data but are never output. Only the description texts render.
   * Left column = red card with an X (false), right column = green card with a check (true).
   */
  columns: [
    { key: "chaos", header: null, ok: false, mark: "cross", cardBg: "#FEF6F5", cardBorder: "#F5C0BA", markBg: "#FDECEA", markColor: "#C0392B" },
    { key: "knowHow", header: null, ok: true, mark: "check", cardBg: "#F2FDF5", cardBorder: "#A7F3C4", markBg: "#DCFCE7", markColor: "#16a34a" },
  ],
  /** Mobile stacks all chaos cards, then this divider label, then all know-how cards. */
  mobileDivider: "vs.",
  rows: [
    {
      chaosTitle: "Motivačné dno z TikToku",
      chaos: "Generické rady o rýchlom zbohatnutí, ktoré v reálnom živote nefungujú.",
      chaosOk: false,
      knowHowTitle: "Slovenská realita v číslach",
      knowHow: "Overené postupy prispôsobené slovenskému trhu, zákonom a realite.",
      knowHowOk: true,
    },
    {
      chaosTitle: "Cenzúra algoritmov",
      chaos: "Na sociálnych sieťach vidíš len zlomok toho, čo sa dá povedať.",
      chaosOk: false,
      knowHowTitle: "Peniaze bez filtra",
      knowHow: "Otvorené rozbory fondov, poplatkov a finančných pascí bez prikrášľovania.",
      knowHowOk: true,
    },
    {
      chaosTitle: "Finančný chaos",
      chaos: "Protichodné rady, dohady a rozhodnutia založené na pocitoch.",
      chaosOk: false,
      knowHowTitle: "Strategické riadenie majetku",
      knowHow: "Jasný systém postavený na dátach, nie na emóciách.",
      knowHowOk: true,
    },
    {
      chaosTitle: "Peniaze strácajú hodnotu",
      chaos: "Inflácia a poplatky potichu ukrajujú z tvojich úspor.",
      chaosOk: false,
      knowHowTitle: "Okamžitá akcia",
      knowHow: "Kalkulačky, checklisty a konkrétne kroky, ktoré môžeš využiť hneď.",
      knowHowOk: true,
    },
  ],
  /** NOTE: this button has data-umami-event but no data-umami-event-section. */
  cta: {
    label: "Chcem sa pridať ZADARMO 🚀",
    href: CENNIK_SECTION_HREF,
    umamiEvent: "click_cennik",
    umamiSection: undefined,
  },
} as const;

/* ------------------------------------------------------------------ */
/* GALERIA — screenshot reviews (RecenzieGaleriaSection)               */
/* ------------------------------------------------------------------ */

export const GALERIA = {
  /** The original has NO heading — just a 3-column masonry of screenshots. */
  heading: null,
  images: [
    { src: "@/assets/images/recenzia-1.png", alt: "Recenzia klienta 1" },
    { src: "@/assets/images/recenzia-2.png", alt: "Recenzia klienta 2" },
    { src: "@/assets/images/recenzia-3.png", alt: "Recenzia klienta 3" },
    { src: "@/assets/images/recenzia-4.png", alt: "Recenzia klienta 4" },
    { src: "@/assets/images/recenzia-5.png", alt: "Recenzia klienta 5" },
    { src: "@/assets/images/recenzia-6.png", alt: "Recenzia klienta 6" },
    { src: "@/assets/images/recenzia-7.png", alt: "Recenzia klienta 7" },
    { src: "@/assets/images/recenzia-8.png", alt: "Recenzia klienta 8" },
    { src: "@/assets/images/recenzia-9.png", alt: "Recenzia klienta 9" },
  ],
  cta: {
    label: "Vyskúšať prvé 2 týždne zadarmo 🚀",
    href: CENNIK_SECTION_HREF,
    umamiEvent: "click_cennik",
    umamiSection: "recenzie-galeria",
  },
} as const;

/* ------------------------------------------------------------------ */
/* FOOTER (FooterSection via PageWrapper — outside Komunita.tsx)       */
/* ------------------------------------------------------------------ */

export const FOOTER = {
  logo: { src: "@/assets/images/js-mentor-logo.png", alt: "JS Mentor" },
  logoHref: LINKS.homeUrl,
  copyright: "© 2026 Jashik s.r.o. Všetky práva vyhradené.",
  gdprLink: { label: "Ochrana osobných údajov (GDPR)", href: LINKS.gdprUrl },
} as const;

/* ------------------------------------------------------------------ */
/* Misc: pricing phrases + legal / disclaimer lines                    */
/* ------------------------------------------------------------------ */

/** Every price-related phrase on the page, verbatim, with where it appears. */
export const PRICING = {
  monthly: "5 €",
  daily: "0,17 €",
  trial: "Prvé 2 týždne zadarmo",
  phrases: [
    { where: "NASTROJE.cta", text: "Vyskúšať prvé 2 týždne zadarmo 🚀" },
    { where: "DARK_GRADIENT.note", text: "Prvé 2 týždne zadarmo. Potom **5 €** mesačne. Zrušíš kedykoľvek." },
    { where: "HODNOTA.price", text: "0,17 € denne" },
    { where: "HODNOTA.price.line1", text: "Menej, ako necháš pri pokladni v drobných. 5 € mesačne." },
    { where: "HODNOTA.checks[0]", text: "Prvé 2 týždne úplne zadarmo" },
    { where: "HODNOTA.note", text: "Platba až po skončení skúšobného obdobia." },
    { where: "CENNIK.heading", text: "Prvé 2 týždne zadarmo, potom len 5 € mesačne" },
    { where: "CENNIK.subheading", text: "Menej ako jeden obed v meste" },
    { where: "CENNIK.price", text: "5 € /mesačne" },
    { where: "FAQ.items[2].question", text: "Čo presne za 5 € mesačne dostanem?" },
  ],
} as const;

/** Disclaimer-ish / legal lines found inside the extracted sections (+ footer). */
export const LEGAL_LINES = [
  { where: "FAQ.items[4].answer[0]", text: "Nie. Obsah v komunite má vzdelávací a informačný charakter." },
  { where: "HODNOTA.note", text: "Platba až po skončení skúšobného obdobia." },
  { where: "CENNIK.note", text: "Kedykoľvek môžeš zrušiť" },
  { where: "FOOTER.copyright", text: "© 2026 Jashik s.r.o. Všetky práva vyhradené." },
  { where: "FOOTER.gdprLink", text: "Ochrana osobných údajov (GDPR)" },
] as const;

/* ------------------------------------------------------------------ */
/* Aggregate                                                           */
/* ------------------------------------------------------------------ */

export const KOMUNITA_CONTENT = {
  LINKS,
  TRACKING,
  SECTION_IDS,
  PAGE_ORDER,
  HEADER,
  HERO,
  INTRO,
  CHYBY,
  NASTROJE,
  DARK_GRADIENT,
  REVIEWS,
  HODNOTA,
  CENNIK,
  QUOTE,
  IVAN,
  FAQ,
  POROVNANIE,
  GALERIA,
  FOOTER,
  PRICING,
  LEGAL_LINES,
} as const;

export type KomunitaContent = typeof KOMUNITA_CONTENT;
