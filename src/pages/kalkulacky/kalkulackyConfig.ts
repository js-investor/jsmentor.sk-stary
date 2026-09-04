import type { LucideIcon } from "lucide-react";
import { BarChart3, FileDown, House, Percent, Receipt, Wallet, MapPin, TrendingUp, ScanLine, TrafficCone, HeartPulse, Building2, Landmark } from "lucide-react";

export const BONUSY_BASE_PATH = "/bonusy";

/** Orientačná hodnota všetkých bonusových nástrojov (komunita: „12 nástrojov v hodnote 390 € úplne zadarmo“). */
export const BONUSY_TOTAL_VALUE = "390\u00a0€";

/** Externá stránka rezervácie konzultácie — používa sa na /bonusy a podstránkach nástrojov. */
export const KONZULTACIA_URL = "https://konzultacia.jsmentor.sk/";
export const BONUSY_CTA_LABEL = "Rezervovať konzultáciu s Ivanom";

export type KalkulackaCalculatorMeta = {
  slug: string;
  title: string;
  menuLabel: string;
  description: string;
  Icon: LucideIcon;
  /** Kalkulačka manažuje vlastné sekcie na celú šírku stránky. */
  fullBleed?: boolean;
};

/** Zodpovedá súborom: Hypo Smart, Investičná, Mzdová kalkulačka, Podľa príjmu, Rentová kalkulačka. */
export const KALKULACKY_CALCULATORS: KalkulackaCalculatorMeta[] = [
  {
    slug: "inteligentna-hypoteka",
    title: "Inteligentná hypotéka",
    menuLabel: "Inteligentná hypotéka",
    description:
      "Plať banke minimum a rozdiel posielaj do úverovej rezervy. Zisti, v ktorom roku rezerva dobehne hypotéku a môžeš ju doplatiť skôr.",
    Icon: House,
  },
  {
    slug: "investicna-kalkulacka",
    title: "Investičná kalkulačka",
    menuLabel: "Investície",
    description:
      "Jednorazové a pravidelné vklady, očakávané zhodnotenie a zložené úročenie v priebehu rokov.",
    Icon: BarChart3,
  },
  {
    slug: "mzdova-kalkulacka",
    title: "Mzdová kalkulačka",
    menuLabel: "Mzdy",
    description:
      "Orientačný prepočet mzdy: hrubá vs. čistá, odvody a čo ti zostane „na ruku“ po zákonných zrážkach.",
    Icon: Receipt,
  },
  {
    slug: "uverova-kalkulacka",
    title: "Úverová kalkulačka",
    menuLabel: "Úvery",
    description:
      "Výpočet maximálnej hypotéky podľa tvojho príjmu, záväzkov a limitov DTI/DSTI.",
    Icon: Wallet,
  },
  {
    slug: "rentova-kalkulacka",
    title: "Rentová kalkulačka",
    menuLabel: "Renta",
    description:
      "Zisti, aký mesačný príjem ti môže chodiť z majetku, koľko kapitálu potrebuješ na cieľovú rentu a ako ju dosiahnuť.",
    Icon: Percent,
  },
  {
    slug: "investicny-byt",
    title: "Investičný byt",
    menuLabel: "Investičný byt",
    description:
      "Interaktívna mapa Slovenska: zisti, koľko ti zarobí investičný byt za 5–30 rokov v každom krajskom meste.",
    Icon: MapPin,
  },
  {
    slug: "etf-semafor",
    title: "ETF semafor 🚦",
    menuLabel: "ETF semafor",
    description:
      "15 otázok za 3 minúty. Zisti, či investuješ správne. Od stratégie až po poplatky a chyby, ktoré ťa potichu stoja peniaze.",
    Icon: TrendingUp,
  },
  {
    slug: "poplatkovy-rontgen",
    title: "Poplatkový röntgen 💸",
    menuLabel: "Poplatkový röntgen",
    description:
      "Tri kliky a uvidíš, koľko z tvojho budúceho majetku potichu zmizne v poplatkoch. V eurách, nie v percentách.",
    Icon: ScanLine,
    fullBleed: true,
  },
  {
    slug: "bytovy-semafor",
    title: "Bytový semafor 🚦",
    menuLabel: "Bytový semafor",
    description:
      "Oplatí sa ti ten byt kúpiť? Lokalita, čísla, banka, dane, zmluvy. Získaš odpovede ešte pred tým, ako zaplatíš zálohu.",
    Icon: TrafficCone,
    fullBleed: true,
  },
  {
    slug: "financny-checkup",
    title: "Finančný check-up",
    menuLabel: "Finančný check-up",
    description:
      "3 minúty, skóre finančného zdravia 0 až 100 podľa metodiky FinHealth Score®. Päť pilierov, tvoje čísla proti benchmarkom a tri kroky, ktoré skóre posunú najviac.",
    Icon: HeartPulse,
  },
  {
    slug: "skoring-bytov",
    title: "Skóring investičných bytov",
    menuLabel: "Skóring bytov",
    description:
      "Porovnaj až 6 bytov: dáta 70+ slovenských miest, reálnosť nájmu, stav domu, férová cena a skóre 0 až 100 s výstrahami.",
    Icon: Building2,
  },
  {
    slug: "vynosnost-bytu",
    title: "Výnosnosť investičného bytu",
    menuLabel: "Výnosnosť bytu",
    description:
      "Cashflow, hypotéka s refixáciou, vývoj majetku rok po roku a výnos na vlastný kapitál. So stres testom a porovnaním s ETF.",
    Icon: Landmark,
  },
];

/** Položka menu — doplniť `href`, keď bude PDF pripravené. */
export const BONUSY_PDF_MENU_ITEM = {
  label: "PDF",
  href: "",
} as const;

/** PDF banner na /bonusy — doplniť `href`, keď budú PDF súbory pripravené (banner sa stane klikateľným a zmizne badge „Už čoskoro“). */
export const BONUSY_PDF_CARD = {
  title: "PDF materiály",
  description: "Pripravujem prehľadné PDF materiály na stiahnutie — pribudnú medzi bonusy čoskoro.",
  href: "",
  Icon: FileDown,
} as const;

/** Skupiny pre dropdown navigáciu v headeri. */
export type NavGroup = {
  label: string;
  items: { label: string; href: string }[];
};

export const KALKULACKY_HEADER_GROUPS: NavGroup[] = [
  {
    label: "Kalkulačky",
    items: [
      { label: "Inteligentná hypotéka", href: `${BONUSY_BASE_PATH}/inteligentna-hypoteka` },
      { label: "Investičná kalkulačka", href: `${BONUSY_BASE_PATH}/investicna-kalkulacka` },
      { label: "Mzdová kalkulačka", href: `${BONUSY_BASE_PATH}/mzdova-kalkulacka` },
      { label: "Úverová kalkulačka", href: `${BONUSY_BASE_PATH}/uverova-kalkulacka` },
      { label: "Rentová kalkulačka", href: `${BONUSY_BASE_PATH}/rentova-kalkulacka` },
    ],
  },
  {
    label: "Nástroje",
    items: [
      { label: "Investičný byt", href: `${BONUSY_BASE_PATH}/investicny-byt` },
      { label: "ETF semafor", href: `${BONUSY_BASE_PATH}/etf-semafor` },
      { label: "Poplatkový röntgen", href: `${BONUSY_BASE_PATH}/poplatkovy-rontgen` },
      { label: "Bytový semafor", href: `${BONUSY_BASE_PATH}/bytovy-semafor` },
      { label: "Finančný check-up", href: `${BONUSY_BASE_PATH}/financny-checkup` },
      { label: "Skóring bytov", href: `${BONUSY_BASE_PATH}/skoring-bytov` },
      { label: "Výnosnosť bytu", href: `${BONUSY_BASE_PATH}/vynosnost-bytu` },
    ],
  },
  {
    label: "PDF",
    items: [],
  },
];

export const KALKULACKY_KONZULTACIA_CARD = {
  title: "Mám otázku k výsledku",
  description:
    "Rezervuj si konzultáciu a preberieme tvoje čísla z kalkulačky a ďalší krok.",
  href: KONZULTACIA_URL,
} as const;
