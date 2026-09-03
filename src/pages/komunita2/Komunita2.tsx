import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Calculator,
  CalendarDays,
  Check,
  FileCheck,
  MessageCircle,
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
import { BONUSY_BASE_PATH } from "@/pages/kalkulacky/kalkulackyConfig";
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
 * Komunita 2.0 — tá istá stránka, ten istý obsah (komunitaContent.ts), nový jazyk:
 * krémové plátno, Calvino + Matter, hairline, jedna zelená na akcie, jeden hnedý blok.
 * Referencie (Refero): Wealthsimple, Munro Partners, Medium, Delphi, Kit, Monarch.
 */

const ICONS: Record<string, LucideIcon> = { PlayCircle, BarChart3, Users, Calculator, FileCheck, TrendingUp, CalendarDays, Route, Shield, MessageCircle };
const TILE_TONES = ["", "km-tile--stone", "km-tile--green", "km-tile--stone", "", "km-tile--green"];

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

const scrollToCta = () => document.getElementById(LINKS.cennikSectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });

const Komunita2 = () => {
  useScrollDepth();
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

        {/* ═══ Hero ═══ */}
        <section className="km-hero">
          <div className="km-wrap">
            <div className="km-head km-center km-reveal" style={{ "--i": 0 } as React.CSSProperties}>
              <span className="km-eyebrow">{HERO.eyebrow}</span>
              <h1 className="km-h1">Toto je cesta <em>k bohatšiemu životu.</em></h1>
              <p className="km-lede">{HERO.subheadline}</p>
              <p className="km-sub" style={{ marginTop: "0.875rem" }}>{HERO.description}</p>
              <div className="km-hero-actions" style={{ justifyContent: "center" }}>
                <CtaLink cta={HERO.primaryCta} />
                <a href={`#${SECTION_IDS.nastroje}`} className="km-link">
                  Pozrieť, čo získaš <ArrowDown className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </a>
              </div>
            </div>
            <div className="km-video km-reveal" style={{ "--i": 2 } as React.CSSProperties}>
              <iframe
                src={HERO.video.src}
                title={HERO.video.title}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
            <ul className="km-hero-proof km-reveal" style={{ "--i": 3 } as React.CSSProperties} aria-label="Dôvera">
              {HERO.trustStats.map((s) => (
                <li key={s.label}><b>{s.value}</b>{s.label}</li>
              ))}
              <li><b>900+</b>konzultácií o peniazoch</li>
            </ul>
          </div>
        </section>

        {/* ═══ Intro ═══ */}
        <section className="km-section" id={SECTION_IDS.intro}>
          <div className="km-wrap">
            <AnimatedSection>
              <figure className="km-pull km-intro">
                <blockquote><span className="km-muted">{INTRO.mutedLead}</span> {INTRO.text.replace(/^Táto komunita ?/, "")}</blockquote>
              </figure>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ Chyby ═══ */}
        <section className="km-section" id={SECTION_IDS.chyby}>
          <div className="km-wrap">
            <div className="km-chyby">
              <AnimatedSection className="km-chyby-media">
                <img src={asset(CHYBY.image.src)} alt={CHYBY.image.alt} className="km-chyby-photo" loading="lazy" decoding="async" />
              </AnimatedSection>
              <div className="km-chyby-body">
                <AnimatedSection>
                  <h2 className="km-h2">{rich(CHYBY.heading)}</h2>
                  <p className="km-lede">{CHYBY.intro}</p>
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
                  <div className="km-actions"><CtaLink cta={CHYBY.cta} /></div>
                </AnimatedSection>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Čo získaš ═══ */}
        <section className="km-section" id={SECTION_IDS.nastroje}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-center">
                <h2 className="km-h2">{NASTROJE.heading}</h2>
                <p className="km-lede">{NASTROJE.subheading}</p>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={0.06}>
              <div className="km-tiles">
                {NASTROJE.benefitTabs.map((t, i) => {
                  const Icon = ICONS[t.icon] ?? Calculator;
                  return (
                    <div key={t.line1} className={`km-tile ${TILE_TONES[i % TILE_TONES.length]}`}>
                      <span className="km-tile-icon"><Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden /></span>
                      <span className="km-tile-title">{t.line1}</span>
                      <span className="km-tile-text">{t.line2}</span>
                    </div>
                  );
                })}
              </div>
              <div className="km-actions km-center"><CtaLink cta={NASTROJE.cta} /></div>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ Hnedý blok: ukážky ═══ */}
        <section className="km-section" id={SECTION_IDS.darkGradient}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-dark">
                <span className="km-kicker">Ukážky z komunity</span>
                <h2><span aria-hidden>{DARK_GRADIENT.headingEmoji}</span> {DARK_GRADIENT.headingText}</h2>
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
                      <span className="km-video-thumb"><img src={asset(v.image.src)} alt="" loading="lazy" decoding="async" /><span className="km-video-play" aria-hidden><PlayCircle className="h-6 w-6" strokeWidth={1.5} /></span></span>
                      <span className="km-video-title">{v.title}</span>
                      <span className="km-video-dur">{v.duration}</span>
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

        {/* ═══ Bonusy (už v novom jazyku) ═══ */}
        <div className="km-bonusy">
          <HeroHeroKalkulackySection />
        </div>

        {/* ═══ Recenzie ═══ */}
        <section className="km-section" id={SECTION_IDS.reviews}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-center">
                <h2 className="km-h2">Ľudia potrebujú o peniazoch počuť <em>ľudskou rečou</em> <span aria-hidden>🙌</span></h2>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={0.05}>
              <ul className="km-stats km-stats--wide">
                {REVIEWS.stats.map((s) => (
                  <li key={s.number}><b>{s.number}</b><span>{rich(s.text)}</span></li>
                ))}
              </ul>
            </AnimatedSection>
            <AnimatedSection delay={0.1}>
              <div className="km-quotes">
                {REVIEWS.testimonials.map((t) => (
                  <figure key={t.name} className="km-quote">
                    <p>{t.quote}</p>
                    <figcaption>
                      <img className="km-avatar" src={asset(t.avatar.src)} alt="" loading="lazy" decoding="async" />
                      <span><b>{t.name}</b>{t.role}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
              <div className="km-actions km-center"><CtaLink cta={REVIEWS.cta} /></div>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ Cena: jeden plán (CTA1) ═══ */}
        <section className="km-section" id={HODNOTA.sectionId} data-section={HODNOTA.sectionId}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-center">
                <span className="km-eyebrow">{HODNOTA.eyebrow}</span>
                <h2 className="km-h2" style={{ marginTop: "1rem" }}>{HODNOTA.heading}</h2>
                <p className="km-lede">{HODNOTA.subheading}</p>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={0.06}>
              <div className="km-price">
                <div className="km-price-main">
                  <span className="km-price-kicker">{HODNOTA.price.eyebrow}</span>
                  <div className="km-price-value"><b>{HODNOTA.price.amount}</b><span>{HODNOTA.price.unit}</span></div>
                  <p className="km-price-trial">{HODNOTA.price.line1}</p>
                  <p className="km-sub">{HODNOTA.price.line2}</p>
                  <ul className="km-checks km-checks--price">
                    {HODNOTA.checks.map((c) => (
                      <li key={c}><Check className="h-4 w-4" strokeWidth={2} aria-hidden />{c}</li>
                    ))}
                  </ul>
                  <div className="km-actions"><CtaLink cta={HODNOTA.cta} /></div>
                  <p className="km-price-terms">{HODNOTA.note}</p>
                </div>
                <aside className="km-price-side">
                  <h3>Čo je v členstve</h3>
                  <ul className="km-benefits">
                    {HODNOTA.benefitCards.map((b) => {
                      const Icon = ICONS[b.icon] ?? Check;
                      return (
                        <li key={b.title}>
                          <span className="km-benefit-icon"><Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                          <span><b>{b.title}</b><small>{b.description}</small></span>
                        </li>
                      );
                    })}
                  </ul>
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

        {/* ═══ Ivan ═══ */}
        <section className="km-section">
          <div className="km-wrap">
            <div className="km-bio">
              <AnimatedSection>
                <img src={ivanPortrait} alt={IVAN.image.alt} className="km-bio-photo" loading="lazy" decoding="async" />
              </AnimatedSection>
              <AnimatedSection delay={0.06}>
                <h2 className="km-h2">{IVAN.heading}</h2>
                {IVAN.paragraphs.map((p) => (
                  <p key={p.slice(0, 24)}>{rich(p)}</p>
                ))}
                <ul className="km-stats">
                  <li><b>8+</b><span>rokov pomáham ľuďom investovať</span></li>
                  <li><b>NBS</b><span>pod dohľadom Národnej banky Slovenska</span></li>
                  <li><b>3,5 mil. €</b><span>klientskych aktív v starostlivosti</span></li>
                </ul>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className="km-section" id={SECTION_IDS.faq}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-center">
                <h2 className="km-h2">{FAQ.heading}</h2>
              </div>
              <div className="km-faq">
                {FAQ.items.map((item, i) => (
                  <details key={item.question} open={i === FAQ.defaultOpenIndex}>
                    <summary>{item.question}<Plus className="h-5 w-5" strokeWidth={1.75} aria-hidden /></summary>
                    {item.answer.map((p) => (
                      <p key={p.slice(0, 32)} className="km-faq-a">{rich(p)}</p>
                    ))}
                  </details>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ Porovnanie ═══ */}
        <section className="km-section" id={SECTION_IDS.porovnanie}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-center">
                <h2 className="km-h2">Čo ti kradne peniaze vs. <em>vybuduje tvoj majetok</em></h2>
              </div>
              <div className="km-compare-wrap">
                <table className="km-compare">
                  <thead>
                    <tr>
                      <th scope="col"><span className="km-mark km-mark--bad" aria-hidden><X className="h-3.5 w-3.5" strokeWidth={2.5} /></span>Čo ti kradne peniaze</th>
                      <th scope="col" className="is-good"><span className="km-mark km-mark--good" aria-hidden><Check className="h-3.5 w-3.5" strokeWidth={2.5} /></span>Čo vybuduje tvoj majetok</th>
                    </tr>
                  </thead>
                  <tbody>
                    {POROVNANIE.rows.map((r) => (
                      <tr key={r.chaosTitle}>
                        <td><b>{r.chaosTitle}</b><span>{r.chaos}</span></td>
                        <td className="is-good"><b>{r.knowHowTitle}</b><span>{r.knowHow}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="km-actions km-center"><CtaLink cta={POROVNANIE.cta} /></div>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ Galéria recenzií ═══ */}
        <section className="km-section">
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-center">
                <span className="km-eyebrow">Recenzie</span>
                <h2 className="km-h2" style={{ marginTop: "1rem" }}>Čo píšu ľudia po konzultáciách</h2>
              </div>
              <div className="km-gallery">
                {GALERIA.images.map((img) => (
                  <img key={img.src} src={asset(img.src)} alt={img.alt} loading="lazy" decoding="async" />
                ))}
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ Záverečná výzva ═══ */}
        <section className="km-section">
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-final">
                <h2 className="km-h2">{CENNIK.heading}</h2>
                <p className="km-sub">{CENNIK.subheading}</p>
                <CtaLink cta={CENNIK.cta} />
                <p className="km-price-terms">{CENNIK.note}</p>
              </div>
            </AnimatedSection>
          </div>
        </section>

      </div>
    </PageWrapper>
  );
};

export default Komunita2;
