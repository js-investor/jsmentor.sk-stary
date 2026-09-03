import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import BonusyKonzultaciaSection from "@/components/sections/BonusyKonzultaciaSection";
import KalkulackyShell from "@/pages/kalkulacky/KalkulackyShell";
import { BONUSY_BASE_PATH, BONUSY_PDF_CARD, KALKULACKY_CALCULATORS, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";
import { MAP_PATHS } from "@/components/calculators/shared/slovakiaMap";
import { cn } from "@/lib/utils";
import type { KalkulackaCalculatorMeta } from "@/pages/kalkulacky/kalkulackyConfig";
import "./bonusy-dashboard.css";

/* ---------------------------------------------------------------------------
 * Prehľad bonusov — živý minimalizmus (Wealthsimple / Monarch): každá karta má
 * svoj tón a jeden veľký abstraktný tvar v rohu; text sedí dole. Málo prvkov,
 * veľa charakteru. Tvary sú kód (SVG), farby len z brandu.
 * ------------------------------------------------------------------------- */

type ToneId = "sage" | "lime" | "green" | "sand" | "stone" | "rust" | "clay" | "forest" | "brown";
type Glyph = "venn" | "arcs" | "coins" | "gauge" | "pie" | "map" | "crescent" | "semafor" | "steps" | "dots" | "ring" | "house" | "euro" | "slice" | "cross" | "sun";

/* tón: povrch karty, hlavná farba tvaru, sekundárna farba tvaru, text, tlmený text */
const TONES: Record<ToneId, { bg: string; fg: string; fg2: string; text?: string; muted?: string }> = {
  sage: { bg: "#2a6647", fg: "#f3e9dd", fg2: "rgba(243,233,221, 0.44)", text: "#f3e9dd", muted: "rgba(243,233,221, 0.88)" },
  lime: { bg: "#f0e3cf", fg: "#292420", fg2: "rgba(169,157,126,0.55)" },
  green: { bg: "#2a6647", fg: "#f3e9dd", fg2: "rgba(243,233,221, 0.44)", text: "#f3e9dd", muted: "rgba(243,233,221, 0.88)" },
  sand: { bg: "#f0e3cf", fg: "#292420", fg2: "rgba(169,157,126,0.55)" },
  stone: { bg: "#e9e4dc", fg: "#292420", fg2: "rgba(41,36,32,0.22)" },
  rust: { bg: "#ab4132", fg: "#f6d9c8", fg2: "rgba(246,217,200,0.32)", text: "#f8ebe0", muted: "rgba(248,235,224, 0.88)" },
  clay: { bg: "#b35a4d", fg: "#ffffff", fg2: "rgba(255,255,255,0.32)", text: "#ffffff", muted: "#ffffff" },
  forest: { bg: "#0b3d2e", fg: "#f3e9dd", fg2: "rgba(243,233,221, 0.42)", text: "#f3e9dd", muted: "rgba(243,233,221, 0.88)" },
  brown: { bg: "#292420", fg: "#d9b15c", fg2: "rgba(217,177,92,0.3)", text: "#f3e9dd", muted: "rgba(243,233,221, 0.88)" },
};

const TOOL_META: Record<string, { category: string; tone: ToneId; glyph: Glyph }> = {
  "financny-checkup": { category: "Začni tu", tone: "sage", glyph: "ring" },
  "etf-semafor": { category: "Investovanie", tone: "sage", glyph: "dots" },
  "skoring-bytov": { category: "Nehnuteľnosti", tone: "sand", glyph: "ring" },
  "inteligentna-hypoteka": { category: "Hypotéka", tone: "sand", glyph: "cross" },
  "investicna-kalkulacka": { category: "Investovanie", tone: "green", glyph: "steps" },
  "mzdova-kalkulacka": { category: "Mzda", tone: "stone", glyph: "euro" },
  "uverova-kalkulacka": { category: "Úvery", tone: "sand", glyph: "gauge" },
  "rentova-kalkulacka": { category: "Renta", tone: "brown", glyph: "sun" },
  "investicny-byt": { category: "Nehnuteľnosti", tone: "forest", glyph: "map" },
  "poplatkovy-rontgen": { category: "Poplatky", tone: "clay", glyph: "slice" },
  "bytovy-semafor": { category: "Nehnuteľnosti", tone: "stone", glyph: "semafor" },
  "vynosnost-bytu": { category: "Nehnuteľnosti", tone: "green", glyph: "house" },
};

const NEW_SLUGS = new Set(["financny-checkup", "skoring-bytov", "vynosnost-bytu", "inteligentna-hypoteka"]);
const FAVORITE_SLUGS = new Set(["rentova-kalkulacka"]);
const FEATURED = ["financny-checkup", "etf-semafor", "skoring-bytov"];
const focusClass = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const toneStyle = (t: ToneId, i = 0) => ({ "--i": i, "--tone-bg": TONES[t].bg, "--tone-fg": TONES[t].fg, "--tone-fg2": TONES[t].fg2, "--tone-text": TONES[t].text ?? "#292420", "--tone-muted": TONES[t].muted ?? "#4a4239" } as CSSProperties);

/* ------------------------------ Tvary (poster, dvojtón) ------------------------------ */

const GlyphArt = ({ glyph, tone }: { glyph: Glyph; tone: ToneId }) => {
  const { fg, fg2, bg } = TONES[tone];
  switch (glyph) {
    case "venn":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><circle className="g-a" cx="46" cy="62" r="36" fill={fg2} /><circle className="g-b" cx="78" cy="62" r="36" fill={fg} fillOpacity="0.9" /></svg>
      );
    case "arcs":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><circle className="g-1" cx="30" cy="94" r="13" fill={fg2} /><circle className="g-2" cx="60" cy="68" r="21" fill={fg2} /><circle className="g-3" cx="94" cy="34" r="30" fill={fg} /></svg>
      );
    case "coins":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><rect className="g-1" x="28" y="72" width="64" height="18" rx="9" fill={fg2} /><rect className="g-2" x="28" y="50" width="64" height="18" rx="9" fill={fg} fillOpacity="0.6" /><rect className="g-3" x="28" y="28" width="64" height="18" rx="9" fill={fg} /></svg>
      );
    case "gauge":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><path d="M18 84 A 42 42 0 0 1 102 84" fill="none" stroke={fg2} strokeWidth="16" strokeLinecap="round" /><path className="g-arc" d="M18 84 A 42 42 0 0 1 102 84" pathLength={100} fill="none" stroke={fg} strokeWidth="16" strokeLinecap="round" strokeDasharray="100" strokeDashoffset="42" /><circle cx="60" cy="84" r="8" fill={fg} /></svg>
      );
    case "pie":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><circle cx="60" cy="60" r="42" fill={fg2} /><g className="g-spin"><path d="M60 60 L60 18 A 42 42 0 0 1 102 60 Z" fill={fg} /><path d="M60 60 L102 60 A 42 42 0 0 1 89.7 89.7 Z" fill={fg} fillOpacity="0.55" /></g></svg>
      );
    case "map":
      return (
        <svg viewBox="0 0 1000 498" aria-hidden style={{ overflow: "visible" }}>
          {Object.entries(MAP_PATHS).map(([k, d], i) => (
            <path key={k} className="g-kraj" style={{ transitionDelay: `${i * 55}ms` }} d={d} fill={fg} fillOpacity={k === "BA" || k === "KE" ? 1 : 0.32} stroke={bg} strokeWidth="6" strokeLinejoin="round" />
          ))}
        </svg>
      );
    case "crescent":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><g className="g-spin"><circle cx="60" cy="60" r="42" fill={fg} /><circle cx="82" cy="46" r="34" fill={bg} /><circle cx="82" cy="46" r="34" fill={fg2} /></g></svg>
      );
    case "semafor":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><rect x="38" y="4" width="44" height="118" rx="22" fill={fg2} /><circle className="g-l1" cx="60" cy="28" r="13" fill={fg} fillOpacity="0.3" /><circle className="g-l2" cx="60" cy="63" r="13" fill={fg} fillOpacity="0.55" /><circle className="g-l3" cx="60" cy="98" r="13" fill={fg} /></svg>
      );
    case "steps":
      return (
        <svg viewBox="0 0 120 120" aria-hidden>{[26, 44, 66, 92].map((h, i) => <rect key={i} className={`g-${i + 1}`} x={14 + i * 25} y={106 - h} width="18" height={h} rx="6" fill={fg} fillOpacity={0.35 + i * 0.22} />)}</svg>
      );
    case "house":
      /* byt s grafom: silueta domu a tri rastúce stĺpce (Výnosnosť investičného bytu) */
      return (
        <svg viewBox="0 0 120 120" aria-hidden>
          <path className="g-roof" d="M60 21 L99 51.5 L99 97.5 L21 97.5 L21 51.5 Z" fill={fg2} stroke={fg2} strokeWidth="8.5" strokeLinejoin="round" />
          {[19, 31, 43].map((h, i) => <rect key={i} className={`g-${i + 1}`} x={35.5 + i * 18} y={87 - h} width="13" height={h} rx="4.5" fill={fg} fillOpacity={0.55 + i * 0.22} />)}
        </svg>
      );
    case "euro":
      /* mzda: tri bankovky a minca s € */
      return (
        <svg viewBox="0 0 120 120" aria-hidden>
          <g className="g-coin">
            <circle cx="32" cy="54" r="25" fill={fg} />
            <text x="32" y="66" textAnchor="middle" fontFamily="Calvino, serif" fontWeight="700" fontSize="34" fill={bg}>€</text>
          </g>
          <rect className="g-note g-n1" x="62" y="30" width="44" height="16" rx="8" fill={fg} fillOpacity="0.8" />
          <rect className="g-note g-n2" x="62" y="50" width="44" height="16" rx="8" fill={fg} fillOpacity="0.55" />
          <rect className="g-note g-n3" x="62" y="70" width="44" height="16" rx="8" fill={fg2} />
        </svg>
      );
    case "slice":
      /* poplatkový röntgen: koláč, z ktorého sa pri hoveri odpojí výsek */
      return (
        <svg viewBox="0 0 120 120" aria-hidden>
          <path d="M58 64 L58 22 A42 42 0 1 0 100 64 Z" fill={fg} />
          <path className="g-slice" d="M58 64 L58 22 A42 42 0 0 1 100 64 Z" fill={fg} fillOpacity="0.55" />
        </svg>
      );
    case "cross":
      /* inteligentná hypotéka: klesajúci dlh, rastúca rezerva a bod prieniku */
      return (
        <svg viewBox="0 0 120 120" aria-hidden>
          <path d="M16 26 L104 98" fill="none" stroke={fg2} strokeWidth="9" strokeLinecap="round" />
          <path d="M16 100 L104 24" fill="none" stroke={fg} strokeWidth="9" strokeLinecap="round" />
          <circle className="g-halo" cx="60" cy="62" r="17" fill={fg2} />
          <circle className="g-dot" cx="60" cy="62" r="10" fill={fg} stroke={bg} strokeWidth="4" />
        </svg>
      );
    case "sun":
      /* renta = sloboda: slnko vychádzajúce nad obzor */
      return (
        <svg viewBox="0 0 120 120" aria-hidden>
          <defs><clipPath id="bz-sun-clip"><rect x="0" y="0" width="120" height="82" /></clipPath></defs>
          <line className="g-ray" x1="60" y1="40" x2="60" y2="26" stroke={fg2} strokeWidth="6" strokeLinecap="round" />
          <line className="g-ray" x1="29" y1="53" x2="19" y2="43" stroke={fg2} strokeWidth="6" strokeLinecap="round" />
          <line className="g-ray" x1="91" y1="53" x2="101" y2="43" stroke={fg2} strokeWidth="6" strokeLinecap="round" />
          <circle className="g-sun" cx="60" cy="86" r="34" fill={fg} clipPath="url(#bz-sun-clip)" />
          <line x1="8" y1="82" x2="112" y2="82" stroke={fg2} strokeWidth="8" strokeLinecap="round" />
        </svg>
      );
    case "dots":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><rect x="4" y="38" width="112" height="44" rx="22" fill={fg2} /><circle className="g-1" cx="28" cy="60" r="12" fill={fg} fillOpacity="0.35" /><circle className="g-2" cx="60" cy="60" r="12" fill={fg} fillOpacity="0.6" /><circle className="g-3" cx="92" cy="60" r="12" fill={fg} /></svg>
      );
    case "ring":
      return (
        <svg viewBox="0 0 120 120" aria-hidden><circle cx="60" cy="60" r="40" fill="none" stroke={fg2} strokeWidth="12" /><circle className="g-arc g-rot" cx="60" cy="60" r="40" pathLength={100} fill="none" stroke={fg} strokeWidth="12" strokeLinecap="round" strokeDasharray="100" strokeDashoffset="22" /><text x="60" y="70" textAnchor="middle" fontFamily="Calvino, serif" fontWeight="700" fontSize="30" fill={fg}>84</text></svg>
      );
  }
};

/* ------------------------------- Hlavička ------------------------------- */

const BonusyPageHeader = () => (
  <header className="bz-hero bz-reveal" style={{ "--i": 0 } as CSSProperties}>
    <span className="bz-eyebrow">Bonusy · {KALKULACKY_CALCULATORS.length} nástrojov zadarmo</span>
    <h1 className="bz-h1"><b>Rozhoduj sa s istotou,</b> <em>nie pocitom.</em></h1>
    <p className="bz-lede">Zisti presné čísla skôr, než podpíšeš, investuješ alebo zaplatíš. Každý nástroj tu existuje preto, aby si videl, čo ťa rozhodnutie skutočne stojí a čo ti môže zarobiť.</p>
  </header>
);

/* ------------------------------ Cesta v 3 krokoch ------------------------------ */

const Journey = () => {
  const steps: { n: string; title: string; text: string; cta: string; href: string; tone: ToneId; external?: boolean }[] = [
    { n: "01", title: "Zisti svoje skóre", text: "Finančný check-up za 3 minúty, výsledok hneď, bez e-mailu.", cta: "Spustiť check-up", href: `${BONUSY_BASE_PATH}/financny-checkup`, tone: "sage" },
    { n: "02", title: "Prepočítaj rozhodnutie", text: "Hypotéka, investície, byt alebo renta, každé v presných číslach.", cta: "Vybrať nástroj", href: "#bonusy-library-heading", tone: "sand" },
    { n: "03", title: "Preber to s Ivanom", text: "Bezplatná konzultácia k tvojmu výsledku, 45 minút online.", cta: "Rezervovať termín", href: KONZULTACIA_URL, tone: "brown", external: true },
  ];
  return (
    <ol className="bz-steps" aria-label="Ako to funguje">
      {steps.map((s, i) => {
        const inner = (
          <>
            <span className="bz-step-n" aria-hidden>{s.n}</span>
            <span className="bz-step-title">{s.title}</span>
            <span className="bz-step-text">{s.text}</span>
            <span className="bz-step-cta">{s.cta} <ArrowRight className="h-4 w-4" aria-hidden /></span>
          </>
        );
        const cls = cn("bz-step", focusClass);
        return (
          <li key={s.n} className="bz-reveal" style={toneStyle(s.tone, i + 1)}>
            {s.external ? <a href={s.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a> : <Link to={s.href} className={cls}>{inner}</Link>}
          </li>
        );
      })}
    </ol>
  );
};

/* --------------------------- Hlavička sekcie ---------------------------- */

const SectionHeader = ({ id, title, subtitle, count }: { id: string; title: string; subtitle?: string; count?: number }) => (
  <div>
    <h2 id={id} className="bz-h2">{title}{typeof count === "number" ? <small>{count}</small> : null}</h2>
    {subtitle ? <p className="bz-sub">{subtitle}</p> : null}
  </div>
);

/* --------------------------- Vlajkový check-up --------------------------- */

const CheckupHero = ({ meta }: { meta: KalkulackaCalculatorMeta }) => {
  const c = 2 * Math.PI * 27;
  return (
    <Link to={`${BONUSY_BASE_PATH}/${meta.slug}`} className={cn("bz-flag bz-reveal", focusClass)} style={{ "--i": 4 } as CSSProperties} data-umami-event="click_bonus_tool" data-umami-event-slug={meta.slug}>
      <div className="bz-flag-body">
        <span className="bz-flag-kicker">Nové · začni tu</span>
        <span className="bz-flag-title"><b>Tvoje financie</b> <em>na jednom čísle.</em></span>
        <span className="bz-flag-text">{meta.description}</span>
        <span className="bz-flag-pillars">Míňaš · Šetríš · Dlhy · Chrániš · Rastieš</span>
        <span className="bz-flag-cta">Spustiť check-up <ArrowRight className="h-4 w-4" aria-hidden /></span>
      </div>
      <div className="bz-flag-ring" aria-hidden>
        <svg viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(243,233,221, 0.24)" strokeWidth="4.5" />
          <circle className="bz-ring-arc" cx="32" cy="32" r="27" fill="none" stroke="#d9b15c" strokeWidth="4.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * 0.28} transform="rotate(-90 32 32)" style={{ "--c": c, "--o": c * 0.28 } as CSSProperties} />
          <text x="32" y="37" textAnchor="middle" fontFamily="Calvino, serif" fontWeight="700" fontSize="19" letterSpacing="-0.6" fill="#f3e9dd">72</text>
          <text x="32" y="45" textAnchor="middle" fontFamily="Matter, sans-serif" fontWeight="500" fontSize="3.6" letterSpacing="0.4" fill="rgba(243,233,221, 0.69)">SKÓRE ZO 100</text>
        </svg>
      </div>
    </Link>
  );
};

/* ------------------------------ Karta nástroja ------------------------------ */

const ToolCard = ({ meta, index = 0 }: { meta: KalkulackaCalculatorMeta; index?: number }) => {
  const info = TOOL_META[meta.slug] ?? { category: "Nástroj", tone: "stone" as ToneId, glyph: "arcs" as Glyph };
  return (
    <Link to={`${BONUSY_BASE_PATH}/${meta.slug}`} className={cn("bz-card bz-reveal", focusClass)} style={toneStyle(info.tone, index)} data-umami-event="click_bonus_tool" data-umami-event-slug={meta.slug}>
      <span className={cn("bz-glyph", info.glyph === "map" && "bz-glyph--map")} aria-hidden><GlyphArt glyph={info.glyph} tone={info.tone} /></span>
      <span className="bz-card-head">
        <span className="bz-cat">{info.category}</span>
        {NEW_SLUGS.has(meta.slug) ? <span className="bz-new">Nové</span> : null}
        {FAVORITE_SLUGS.has(meta.slug) ? <span className="bz-new bz-fav">Obľúbené</span> : null}
      </span>
      <span className="bz-card-body">
        <span className="bz-card-title">{meta.title}</span>
        <span className="bz-card-text">{meta.description}</span>
        <span className="bz-card-cta">Otvoriť <ArrowRight className="h-4 w-4" aria-hidden /></span>
      </span>
    </Link>
  );
};

/* ------------------------------- PDF banner ------------------------------ */

const PdfBanner = () => {
  const PdfIcon = BONUSY_PDF_CARD.Icon;
  const isReady = Boolean(BONUSY_PDF_CARD.href);
  const content = (
    <>
      <span className="bz-pdf-icon" aria-hidden><PdfIcon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <h2 id="bonusy-pdf-heading" className="bz-pdf-title">
          {BONUSY_PDF_CARD.title}
          {!isReady ? <span className="bz-pdf-soon">Už čoskoro</span> : null}
        </h2>
        {BONUSY_PDF_CARD.description ? <p className="bz-pdf-text">{BONUSY_PDF_CARD.description}</p> : null}
      </div>
      {isReady ? <ArrowRight className="h-5 w-5 shrink-0" style={{ color: "#2a6647" }} aria-hidden /> : null}
    </>
  );
  if (isReady) return <Link to={BONUSY_PDF_CARD.href} className={cn("bz-pdf", focusClass)}>{content}</Link>;
  return <div className="bz-pdf">{content}</div>;
};

/* --------------------------------- Stránka ------------------------------- */

const bySlug = (slug: string) => KALKULACKY_CALCULATORS.find((c) => c.slug === slug);

const KalkulackyCategoryPage = () => {
  const checkup = bySlug("financny-checkup");
  const featured = FEATURED.slice(1).map(bySlug).filter((m): m is KalkulackaCalculatorMeta => Boolean(m));
  const library = KALKULACKY_CALCULATORS.filter((c) => !FEATURED.includes(c.slug));
  return (
    <KalkulackyShell>
      <div className="bonusy section-container px-4 sm:px-6 lg:px-8">
        <BonusyPageHeader />
        <Journey />

        <section className="mx-auto mt-16 max-w-6xl md:mt-24" aria-labelledby="bonusy-featured-heading">
          <SectionHeader id="bonusy-featured-heading" title="Začni tu" subtitle="Tri nástroje, ktoré ti o tvojich peniazoch prezradia najviac." />
          <div className="mt-6 grid grid-cols-1 gap-4 md:mt-8 md:gap-5 lg:grid-cols-3">
            {checkup ? <div className="lg:col-span-2"><CheckupHero meta={checkup} /></div> : null}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-1">
              {featured.map((m, i) => <ToolCard key={m.slug} meta={m} index={5 + i} />)}
            </div>
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-6xl md:mt-24" aria-labelledby="bonusy-library-heading">
          <SectionHeader id="bonusy-library-heading" title="Kalkulačky a nástroje" subtitle="Presné prepočty pre hypotéku, investície, mzdu, byt aj rentu." count={library.length} />
          <ul className="mt-6 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 md:mt-8 md:gap-5 lg:grid-cols-3">
            {library.map((meta, i) => (
              <li key={meta.slug} className="h-full"><ToolCard meta={meta} index={i} /></li>
            ))}
          </ul>
        </section>

        <section className="mx-auto mt-10 max-w-6xl md:mt-14" aria-labelledby="bonusy-pdf-heading"><PdfBanner /></section>
        <BonusyKonzultaciaSection />
      </div>
    </KalkulackyShell>
  );
};

export default KalkulackyCategoryPage;
