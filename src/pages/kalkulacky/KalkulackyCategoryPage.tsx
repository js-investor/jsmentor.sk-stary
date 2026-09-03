import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import BonusyKonzultaciaSection from "@/components/sections/BonusyKonzultaciaSection";
import KalkulackyShell from "@/pages/kalkulacky/KalkulackyShell";
import { BONUSY_BASE_PATH, BONUSY_PDF_CARD, KALKULACKY_CALCULATORS, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";
import { cn } from "@/lib/utils";
import type { KalkulackaCalculatorMeta } from "@/pages/kalkulacky/kalkulackyConfig";
import "./bonusy-dashboard.css";

/* ---------------------------------------------------------------------------
 * Prehľad bonusov — živý minimalizmus (Wealthsimple / Monarch): každá karta má
 * svoj tón a jeden veľký abstraktný tvar v rohu; text sedí dole. Málo prvkov,
 * veľa charakteru. Tvary sú kód (SVG), farby len z brandu.
 * ------------------------------------------------------------------------- */

import { ToolCard, focusClass, toneStyle, type ToneId } from "@/pages/kalkulacky/bonusyCards";

const FEATURED = ["financny-checkup", "etf-semafor", "skoring-bytov"];

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
