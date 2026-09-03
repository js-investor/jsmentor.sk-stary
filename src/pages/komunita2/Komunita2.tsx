import type { CSSProperties, ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Calculator,
  CalendarDays,
  Check,
  FileCheck,
  MessageCircle,
  Play,
  PlayCircle,
  Plus,
  Route,
  Shield,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import PageWrapper from "@/components/layout/PageWrapper";
import BonusyHeader from "@/components/layout/BonusyHeader";
import HeroHeroKalkulackySection from "@/components/sections/HeroHeroKalkulackySection";
import useScrollDepth from "@/hooks/useScrollDepth";
import { BONUSY_BASE_PATH, KALKULACKY_CALCULATORS } from "@/pages/kalkulacky/kalkulackyConfig";
import jsLogo from "@/assets/images/js-mentor-logo.png";
import ivanPortrait from "@/assets/images/jsmentor-biznis-portret-ivan-interier-svetlo.jpg";
import {
  CENNIK,
  CHYBY,
  DARK_GRADIENT,
  FAQ,
  GALERIA,
  HERO,
  HODNOTA,
  INTRO,
  IVAN,
  LINKS,
  NASTROJE,
  POROVNANIE,
  REVIEWS,
  SECTION_IDS,
  type Cta,
} from "./komunitaContent";
import { asset } from "./komunitaAssets";
import { rich } from "./rich";
import "./komunita2.css";

/**
 * Komunita 2.0 — predajná stránka členstva v jazyku Bonusov.
 * Štruktúra (Hormozi, $100M Offers): hook s ponukou → problém, v ktorom sa človek nájde → hodnotový
 * stack → ukážky → dôkazy → ponuka s odstránením rizika → FAQ → porovnanie → záverečná výzva.
 * Vizuál (Refero): Wealthsimple, Munro Partners, Medium, Delphi, Kit, Monarch. Obsah z komunitaContent.ts.
 */

const ICONS: Record<string, LucideIcon> = { PlayCircle, BarChart3, Users, Calculator, FileCheck, TrendingUp, CalendarDays, Route, Shield, MessageCircle };
const st = (i: number) => ({ "--i": i }) as CSSProperties;

const CtaLink = ({ cta, className = "km-btn", children }: { cta: Cta; className?: string; children?: ReactNode }) => (
  <a
    href={cta.href}
    className={className}
    {...(cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    data-umami-event={cta.umamiEvent}
    {...(cta.umamiSection ? { "data-umami-event-section": cta.umamiSection } : {})}
  >
    {children ?? cta.label}
    <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
  </a>
);

/** Nadpis po slovách, každé s vlastným oneskorením (jemný vstup). */
const Words = ({ text, from = 0 }: { text: string; from?: number }) => (
  <>
    {text.split(" ").map((w, i) => (
      <span key={`${w}-${i}`} className="km-w-wrap">
        <span className="km-w" style={st(from + i)}>{w}</span>{" "}
      </span>
    ))}
  </>
);

const scrollToCta = () => document.getElementById(LINKS.cennikSectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });

const Komunita2 = () => {
  useScrollDepth();
  const toolsCount = KALKULACKY_CALCULATORS.length;

  return (
    <PageWrapper>
      <div className="km">
        <BonusyHeader
          logoHref={LINKS.homeUrl}
          logoSrc={jsLogo}
          logoAlt="JS Mentor"
          leadingLinks={[
            { label: "Čo získaš", href: `#${SECTION_IDS.nastroje}` },
            { label: "Bonusy", href: BONUSY_BASE_PATH },
            { label: "Cena", href: LINKS.cennikSectionHash },
            { label: "Otázky", href: `#${SECTION_IDS.faq}` },
          ]}
          ctaLabel="Pridať sa zadarmo"
          ctaShortLabel="Pridať sa"
          ctaHref={LINKS.cennikSectionHash}
          ctaUmamiEvent="click_cennik"
          ctaUmamiEventSection="header"
        />

        {/* ═══ 1. Hook: sľub + ponuka ═══ */}
        <section className="km-hero">
          <div className="km-wrap">
            <div className="km-hero-head">
              <span className="km-eyebrow km-reveal" style={st(0)}>Prvé 2 týždne zadarmo · potom 5 € mesačne</span>
              <p className="km-kicker-line km-reveal" style={st(1)}>{HERO.eyebrow}</p>
              <h1 className="km-h1">
                <Words text="Toto je cesta" from={2} />
                <em><Words text="k bohatšiemu životu." from={5} /></em>
              </h1>
              <p className="km-lede km-reveal" style={st(9)}>{HERO.subheadline}</p>
              <p className="km-sub km-hero-desc km-reveal" style={st(10)}>{HERO.description}</p>
              <div className="km-hero-actions km-reveal" style={st(11)}>
                <CtaLink cta={HERO.primaryCta} />
                <a href={`#${SECTION_IDS.nastroje}`} className="km-link">
                  Pozrieť, čo získaš <ArrowDown className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </a>
              </div>
            </div>

            <div className="km-hero-media km-reveal" style={st(12)}>
              <div className="km-video">
                <iframe src={HERO.video.src} title={HERO.video.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" />
              </div>
              <span className="km-video-tag"><Play className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />{HERO.video.title}</span>
              <div className="km-float km-float--proof" aria-hidden>
                <b>900+</b>
                <span>konzultácií o peniazoch, ktoré som osobne viedol</span>
              </div>
            </div>

            <ul className="km-proof km-reveal" style={st(14)} aria-label="Dôvera">
              {HERO.trustStats.map((s) => (
                <li key={s.label}><b>{s.value}</b><span>{s.label}</span></li>
              ))}
              <li><b>{toolsCount}</b><span>nástrojov a kalkulačiek zadarmo</span></li>
            </ul>
          </div>
        </section>

        {/* ═══ Pre koho to je ═══ */}
        <section className="km-section" id={SECTION_IDS.intro}>
          <div className="km-wrap">
            <AnimatedSection>
              <figure className="km-pull km-intro">
                <blockquote>
                  <span className="km-intro-lead">{INTRO.mutedLead}</span> je pre ľudí, ktorí chcú <em>finančne rásť.</em> Ktorí chcú počuť odborné praktické rady a nie prázdne teórie.
                </blockquote>
              </figure>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ 2. Problém: nájdeš sa v tom? ═══ */}
        <section className="km-section" id={SECTION_IDS.chyby}>
          <div className="km-wrap">
            <div className="km-chyby">
              <AnimatedSection className="km-chyby-media">
                <div className="km-photo-frame">
                  <img src={asset(CHYBY.image.src)} alt={CHYBY.image.alt} className="km-chyby-photo" decoding="async" />
                  <figure className="km-float km-float--quote">
                    <blockquote>„{CHYBY.intro}“</blockquote>
                    <figcaption>Ivan Jašík</figcaption>
                  </figure>
                </div>
              </AnimatedSection>
              <div className="km-chyby-body">
                <AnimatedSection>
                  <span className="km-kicker">Nájdeš sa v tom?</span>
                  <h2 className="km-h2">{rich(CHYBY.heading)}</h2>
                </AnimatedSection>
                <AnimatedSection delay={0.06}>
                  <ol className="km-rows km-rows--chyby">
                    {CHYBY.mistakes.map((m, i) => (
                      <li key={m.emphasis} className="km-row">
                        <span className="km-row-n">{String(i + 1).padStart(2, "0")}</span>
                        <p className="km-row-t km-row-t--wide">{rich(m.text)}</p>
                      </li>
                    ))}
                  </ol>
                  <p className="km-closing">Ak si sa našiel aspoň v jednej, si na správnom mieste.</p>
                  <div className="km-actions"><CtaLink cta={CHYBY.cta} /></div>
                </AnimatedSection>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ 3. Hodnotový stack: čo všetko získaš ═══ */}
        <section className="km-section" id={SECTION_IDS.nastroje}>
          <div className="km-wrap">
            <div className="km-stack">
              <AnimatedSection className="km-stack-head">
                <span className="km-kicker">Čo je vnútri</span>
                <h2 className="km-h2">{HODNOTA.heading}</h2>
                <p className="km-lede">{NASTROJE.subheading}</p>
                <div className="km-actions"><CtaLink cta={NASTROJE.cta} /></div>
              </AnimatedSection>
              <AnimatedSection delay={0.06}>
                <ol className="km-stack-list">
                  {HODNOTA.benefitCards.map((b, i) => {
                    const Icon = ICONS[b.icon] ?? Check;
                    return (
                      <li key={b.title} className="km-stack-item">
                        <span className="km-stack-n">{String(i + 1).padStart(2, "0")}</span>
                        <span className="km-stack-icon"><Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                        <span className="km-stack-body">
                          <b>{b.title}</b>
                          <span>{b.description}</span>
                        </span>
                      </li>
                    );
                  })}
                  <li className="km-stack-item km-stack-item--bonus">
                    <span className="km-stack-n">+</span>
                    <span className="km-stack-icon"><Calculator className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                    <span className="km-stack-body">
                      <b>{toolsCount} kalkulačiek a nástrojov</b>
                      <span>Inteligentná hypotéka, výnosnosť bytu, ETF semafor, poplatkový röntgen a ďalšie. Zadarmo, bez registrácie.</span>
                    </span>
                  </li>
                </ol>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* ═══ 4. Ukážky: hnedý blok ═══ */}
        <section className="km-section" id={SECTION_IDS.darkGradient}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-dark">
                <div className="km-dark-head">
                  <span className="km-kicker km-kicker--gold">Nové video každý týždeň</span>
                  <h2><span aria-hidden>{DARK_GRADIENT.headingEmoji}</span> {DARK_GRADIENT.headingText}</h2>
                </div>
                <div className="km-videos">
                  {DARK_GRADIENT.items.map((v) => (
                    <button
                      key={v.title}
                      type="button"
                      className="km-video-card"
                      onClick={scrollToCta}
                      data-umami-event={DARK_GRADIENT.thumbnailClick.umamiEvent}
                      data-umami-event-section={DARK_GRADIENT.thumbnailClick.umamiSection}
                    >
                      <span className="km-video-thumb">
                        <img src={asset(v.image.src)} alt="" decoding="async" />
                        <span className="km-video-play" aria-hidden><Play className="h-4 w-4" strokeWidth={2.5} /></span>
                        <span className="km-video-dur">{v.duration}</span>
                      </span>
                      <span className="km-video-title">{v.title}</span>
                    </button>
                  ))}
                </div>
                <div className="km-dark-foot">
                  <CtaLink cta={DARK_GRADIENT.cta} className="km-btn km-btn--light" />
                  <p>{rich(DARK_GRADIENT.note)}</p>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ 5. Bonusy ═══ */}
        <div className="km-bonusy">
          <HeroHeroKalkulackySection />
        </div>

        {/* ═══ 6. Dôkazy ═══ */}
        <section className="km-section" id={SECTION_IDS.reviews}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-center">
                <span className="km-kicker">Dôkazy, nie sľuby</span>
                <h2 className="km-h2">Ľudia potrebujú o peniazoch počuť <em>ľudskou rečou</em> <span aria-hidden>🙌</span></h2>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={0.05}>
              <ul className="km-bigstats">
                {REVIEWS.stats.map((s) => (
                  <li key={s.number}><b>{s.number}</b><span>{rich(s.text)}</span></li>
                ))}
              </ul>
            </AnimatedSection>
            <AnimatedSection delay={0.1}>
              <div className="km-quotes">
                {REVIEWS.testimonials.map((t) => (
                  <figure key={t.name} className="km-quote">
                    <img className="km-avatar" src={asset(t.avatar.src)} alt="" decoding="async" />
                    <blockquote>{t.quote}</blockquote>
                    <figcaption><b>{t.name}</b><span>{t.role}</span></figcaption>
                  </figure>
                ))}
              </div>
              <div className="km-actions km-center"><CtaLink cta={REVIEWS.cta} /></div>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ 7. Ponuka (CTA1) ═══ */}
        <section className="km-section" id={HODNOTA.sectionId} data-section={HODNOTA.sectionId}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-center">
                <span className="km-eyebrow">{HODNOTA.eyebrow}</span>
                <h2 className="km-h2 km-h2--offer">Prvé 2 týždne zadarmo, <em>potom len 5 € mesačne.</em></h2>
                <p className="km-lede">{CENNIK.subheading}. Jedno lepšie finančné rozhodnutie ti môže ušetriť stovky až tisíce eur.</p>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={0.06}>
              <div className="km-price">
                <div className="km-price-main">
                  <span className="km-price-kicker">{HODNOTA.price.eyebrow}</span>
                  <div className="km-price-value"><b>{HODNOTA.price.amount}</b><span>{HODNOTA.price.unit}</span></div>
                  <p className="km-price-trial">{HODNOTA.price.line1}</p>
                  <ul className="km-checks km-checks--price">
                    {HODNOTA.checks.map((c) => (
                      <li key={c}><Check className="h-4 w-4" strokeWidth={2.25} aria-hidden />{c}</li>
                    ))}
                  </ul>
                  <div className="km-actions"><CtaLink cta={HODNOTA.cta} className="km-btn km-btn--lg" /></div>
                  <p className="km-price-terms">{HODNOTA.note} Bez viazanosti, bez telefonátov, bez presviedčania.</p>
                </div>
                <aside className="km-price-side">
                  <h3>Čo je v členstve</h3>
                  <ul className="km-benefits">
                    {NASTROJE.benefitTabs.map((b) => {
                      const Icon = ICONS[b.icon] ?? Check;
                      return (
                        <li key={b.line1}>
                          <span className="km-benefit-icon"><Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                          <span><b>{b.line1}</b><small>{b.line2}</small></span>
                        </li>
                      );
                    })}
                    <li>
                      <span className="km-benefit-icon"><Calculator className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                      <span><b>Bonusy: {toolsCount} nástrojov</b><small>kalkulačky, semafory, röntgen, mapa bytov</small></span>
                    </li>
                  </ul>
                  <p className="km-price-guarantee"><Shield className="h-4 w-4" strokeWidth={1.75} aria-hidden />Vojdeš dnu, pozrieš si videá, vyskúšaš nástroje a rozhodneš sa podľa seba.</p>
                </aside>
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* CTA2 — skryté, nemazať (pôvodná stránka ho drží skryté) */}
        <div className="hidden" aria-hidden="true" data-section={CENNIK.sectionId} id={CENNIK.sectionId}>
          <h2>{CENNIK.heading}</h2>
          <p>{CENNIK.subheading}</p>
        </div>

        {/* ═══ Citát ═══ */}
        <section className="km-section">
          <div className="km-wrap">
            <AnimatedSection>
              <figure className="km-pull">
                <blockquote>Najlepšie investované peniaze sú do <em>kvalitných informácií.</em></blockquote>
              </figure>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ 8. Ivan ═══ */}
        <section className="km-section">
          <div className="km-wrap">
            <div className="km-bio">
              <AnimatedSection>
                <div className="km-photo-frame km-photo-frame--bio">
                  <img src={ivanPortrait} alt={IVAN.image.alt} className="km-bio-photo" decoding="async" />
                  <span className="km-float km-float--tag">Pod dohľadom NBS</span>
                </div>
              </AnimatedSection>
              <AnimatedSection delay={0.06}>
                <span className="km-kicker">Kto za tým stojí</span>
                <h2 className="km-h2">{IVAN.heading}</h2>
                {IVAN.paragraphs.map((p) => (
                  <p key={p.slice(0, 24)}>{rich(p)}</p>
                ))}
                <ul className="km-stats">
                  <li><b>8+</b><span>rokov pomáham ľuďom rozumne investovať</span></li>
                  <li><b>NBS</b><span>pod dohľadom Národnej banky Slovenska</span></li>
                  <li><b>3,5 mil. €</b><span>klientskych aktív v starostlivosti</span></li>
                </ul>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* ═══ 9. FAQ ═══ */}
        <section className="km-section" id={SECTION_IDS.faq}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-center">
                <span className="km-kicker">Skôr, než sa rozhodneš</span>
                <h2 className="km-h2">{FAQ.heading}</h2>
              </div>
              <div className="km-faq">
                {FAQ.items.map((item, i) => (
                  <details key={item.question} open={i === FAQ.defaultOpenIndex}>
                    <summary>{item.question}<Plus className="h-5 w-5" strokeWidth={1.75} aria-hidden /></summary>
                    <div className="km-faq-body">
                      {item.answer.map((p) => (
                        <p key={p.slice(0, 32)} className="km-faq-a">{rich(p)}</p>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ 10. Porovnanie ═══ */}
        <section className="km-section" id={SECTION_IDS.porovnanie}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-center">
                <h2 className="km-h2">Čo ti kradne peniaze vs. <em>vybuduje tvoj majetok</em></h2>
              </div>
              <div className="km-compare">
                <div className="km-compare-col km-compare-col--bad">
                  <span className="km-compare-head"><span className="km-mark km-mark--bad" aria-hidden><X className="h-3.5 w-3.5" strokeWidth={2.5} /></span>Čo ti kradne peniaze</span>
                  {POROVNANIE.rows.map((r) => (
                    <div key={r.chaosTitle} className="km-compare-item"><b>{r.chaosTitle}</b><span>{r.chaos}</span></div>
                  ))}
                </div>
                <div className="km-compare-col km-compare-col--good">
                  <span className="km-compare-head"><span className="km-mark km-mark--good" aria-hidden><Check className="h-3.5 w-3.5" strokeWidth={2.5} /></span>Čo vybuduje tvoj majetok</span>
                  {POROVNANIE.rows.map((r) => (
                    <div key={r.knowHowTitle} className="km-compare-item"><b>{r.knowHowTitle}</b><span>{r.knowHow}</span></div>
                  ))}
                </div>
              </div>
              <div className="km-actions km-center"><CtaLink cta={POROVNANIE.cta} /></div>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ 11. Galéria recenzií ═══ */}
        <section className="km-section">
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-center">
                <span className="km-kicker">Z mojich správ</span>
                <h2 className="km-h2">Čo píšu ľudia po konzultáciách</h2>
              </div>
              <div className="km-gallery">
                {GALERIA.images.map((img) => (
                  <img key={img.src} src={asset(img.src)} alt={img.alt} loading="lazy" decoding="async" />
                ))}
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ 12. Záverečná výzva ═══ */}
        <section className="km-section">
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-final">
                <span className="km-kicker km-kicker--gold">Rozhodni sa podľa seba</span>
                <h2>{CENNIK.heading}</h2>
                <p>{CENNIK.subheading}. Vojdeš dnu, pozrieš si videá, vyskúšaš nástroje a ak ti to nedáva hodnotu, jedným klikom zrušíš.</p>
                <CtaLink cta={CENNIK.cta} className="km-btn km-btn--light km-btn--lg" />
                <small>{CENNIK.note} · {HODNOTA.note}</small>
              </div>
            </AnimatedSection>
          </div>
        </section>
      </div>
    </PageWrapper>
  );
};

export default Komunita2;
