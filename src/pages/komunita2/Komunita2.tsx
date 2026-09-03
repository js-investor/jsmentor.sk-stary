import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Calculator,
  CalendarDays,
  Check,
  ChevronRight,
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
import { Link } from "react-router-dom";
import AnimatedSection from "@/components/AnimatedSection";
import PageWrapper from "@/components/layout/PageWrapper";
import BonusyHeader from "@/components/layout/BonusyHeader";
import HeroHeroKalkulackySection from "@/components/sections/HeroHeroKalkulackySection";
import useScrollDepth from "@/hooks/useScrollDepth";
import { compute, DEFAULT_INPUTS } from "@/components/calculators/inteligentna-hypoteka/inteligentnaHypotekaModel";
import { BONUSY_BASE_PATH, KALKULACKY_CALCULATORS } from "@/pages/kalkulacky/kalkulackyConfig";
import { cn } from "@/lib/utils";
import jsLogo from "@/assets/images/js-mentor-logo.png";
import ivanGesto from "@/assets/images/jsmentor-ivan-gesto-vysvetlovanie.jpg";
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
 * Komunita 3.0 — „živý klub“. Predajná logika (Hormozi): hook s ponukou → problém, v ktorom sa
 * človek nájde → čo sa stane v prvých 14 dňoch → hodnotový stack → ukážky → dôkazy → ponuka bez
 * rizika → kto za tým stojí → otázky → porovnanie → záver. Obsah z komunitaContent.ts.
 * Vizuál (Refero): Empower, Patreon, Elementor/Kajabi, Winamp, Delphi, Alo Wellness Club.
 */

const ICONS: Record<string, LucideIcon> = { PlayCircle, BarChart3, Users, Calculator, FileCheck, TrendingUp, CalendarDays, Route, Shield, MessageCircle };
const st = (i: number) => ({ "--i": i }) as CSSProperties;

const TOPICS = ["Hypotéka", "ETF", "Investičný byt", "Renta", "Poplatky", "Rezerva", "Fondy", "Daňové priznanie", "Portfólio", "Bývanie", "Slovenské produkty", "Reálne prípady"];

const DAYS = [
  { badge: "Deň 0", title: "Vstúpiš dnu.", text: HODNOTA.checks[2] + ". Platba až po skončení skúšobného obdobia." },
  { badge: "Deň 1 – 3", title: "Pozrieš si prvé rozbory.", text: `${NASTROJE.benefitTabs[0].line1}: ${NASTROJE.benefitTabs[0].line2}. ${NASTROJE.benefitTabs[1].line1} – ${NASTROJE.benefitTabs[1].line2}.` },
  { badge: "Deň 4 – 7", title: "Prepočítaš si vlastné čísla.", text: `${NASTROJE.benefitTabs[3].line1}: ${NASTROJE.benefitTabs[3].line2}. ${NASTROJE.benefitTabs[4].line1} – ${NASTROJE.benefitTabs[4].line2}.` },
  { badge: "Deň 14", title: "Rozhodneš sa podľa seba.", text: "Ak zistíš, že ti to nedáva hodnotu, členstvo jednoducho zrušíš. Bez viazanosti, bez telefonátov, bez presviedčania." },
];

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

/** Nadpis po slovách, každé s vlastným oneskorením. */
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

/** Jednorazové „videl som ťa“ cez IntersectionObserver. */
function useInView<T extends HTMLElement>(margin = "-60px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (!("IntersectionObserver" in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin, seen]);
  return [ref, seen] as const;
}

/** Číslo, ktoré sa napočíta, keď sa objaví na obrazovke (napr. „2000+“). */
const BigStat = ({ number, text }: { number: string; text: string }) => {
  const [ref, seen] = useInView<HTMLLIElement>();
  const target = Number(number.replace(/\D/g, "")) || 0;
  const suffix = number.replace(/[\d\s]/g, "");
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!seen) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 1500);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, target]);
  return (
    <li ref={ref}>
      <b>
        {value.toLocaleString("sk-SK")}
        {suffix}
      </b>
      <span>{rich(text)}</span>
    </li>
  );
};

const rokov = (n: number) => (n === 1 ? "rok" : n >= 2 && n <= 4 ? "roky" : "rokov");

/** Mini graf z modelu Inteligentnej hypotéky (predvolený príklad): dlh klesá, rezerva rastie. */
const HeroChart = () => {
  const r = useMemo(() => compute(DEFAULT_INPUTS), []);
  const W = 320;
  const H = 130;
  const years = DEFAULT_INPUTS.years;
  const max = Math.max(...r.mort, ...r.res.slice(0, r.crossM > 0 ? r.crossM + 1 : r.res.length));
  const x = (m: number) => 6 + (m / (years * 12)) * (W - 12);
  const y = (v: number) => H - 8 - (v / max) * (H - 24);
  const sample = (arr: number[]) => {
    const pts: string[] = [];
    for (let m = 0; m <= years * 12; m += 6) pts.push(`${x(m).toFixed(1)},${y(arr[m] ?? 0).toFixed(1)}`);
    return pts.join(" L");
  };
  const mortPath = `M${sample(r.mort)}`;
  const resPath = `M${sample(r.res.map((v, i) => (r.crossM > 0 && i > r.crossM ? r.res[r.crossM] : v)))}`;
  const crossX = r.crossM > 0 ? x(r.crossM) : null;
  const yearsEarlier = Math.round(r.monthsEarlier / 12);
  return (
    <>
      <h3>
        Hypotéku splatíš <em>o {yearsEarlier} {rokov(yearsEarlier)} skôr.</em>
      </h3>
      <svg className="km-cg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Dlh klesá, úverová rezerva rastie – v bode kríženia môžeš hypotéku splatiť.">
        <line className="l-x" x1="6" x2={W - 6} y1={H - 8} y2={H - 8} />
        {crossX !== null ? <line className="l-x" x1={crossX} x2={crossX} y1="10" y2={H - 8} strokeDasharray="3 4" /> : null}
        <path className="l-fill" d={`${resPath} L${x(years * 12).toFixed(1)},${H - 8} L6,${H - 8} Z`} />
        <path className="l-mort l-draw" d={mortPath} />
        <path className="l-res l-draw" d={resPath} />
        {crossX !== null ? <circle cx={crossX} cy={y(r.res[r.crossM])} r="4.5" fill="#2a6647" stroke="#fffcf7" strokeWidth="2" /> : null}
      </svg>
      <ul className="km-cg-legend">
        <li><i />zostatok hypotéky</li>
        <li><i className="is-green" />úverová rezerva</li>
      </ul>
    </>
  );
};

const CARD_TONES = ["sand", "ivory", "green", "stone"] as const;

const Komunita2 = () => {
  useScrollDepth();
  const toolsCount = KALKULACKY_CALCULATORS.length;
  const [playing, setPlaying] = useState(false);
  const [barOn, setBarOn] = useState(false);
  const deckRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Lišta sa ukáže, keď hero odíde z obrazovky, a schová sa, kým je vidieť ponuku (CTA1).
    const hero = heroRef.current;
    const offer = document.getElementById(LINKS.cennikSectionId);
    if (!hero || !offer || !("IntersectionObserver" in window)) return;
    let heroOut = false;
    let offerIn = false;
    const update = () => setBarOn(heroOut && !offerIn);
    const ioHero = new IntersectionObserver(([e]) => { heroOut = !e.isIntersecting && e.boundingClientRect.bottom < 0; update(); });
    const ioOffer = new IntersectionObserver(([e]) => { offerIn = e.isIntersecting; update(); });
    ioHero.observe(hero);
    ioOffer.observe(offer);
    return () => { ioHero.disconnect(); ioOffer.disconnect(); };
  }, []);

  const slideDeck = (dir: 1 | -1) => {
    const el = deckRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.7), behavior: "smooth" });
  };

  const videoSrc = HERO.video.src.replace("autoplay=0", "autoplay=1");

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

        {/* ═══ 1. Hook: sľub + koláž toho, čo je vnútri ═══ */}
        <section className="km-hero" ref={heroRef}>
          <div className="km-wrap km-hero-grid">
            <div className="km-hero-copy">
              <p className="km-kicker-line km-reveal" style={st(0)}>{HERO.eyebrow}</p>
              <h1 className="km-h1">
                <Words text="Toto je cesta" from={1} />
                <span className="km-h1-big"><Words text="k bohatšiemu životu." from={4} /></span>
              </h1>
              <p className="km-lede km-reveal" style={st(8)}>{HERO.subheadline}</p>
              <p className="km-sub km-reveal" style={st(9)}>{HERO.description}</p>
              <div className="km-hero-actions km-reveal" style={st(10)}>
                <CtaLink cta={HERO.primaryCta} className="km-btn km-btn--lg" />
                <button type="button" className="km-link" onClick={() => setPlaying(true)}>
                  <Play className="h-4 w-4" strokeWidth={2.25} aria-hidden /> Pozrieť video
                </button>
              </div>
              <ul className="km-proof km-reveal" style={st(12)} aria-label="Dôvera">
                {HERO.trustStats.map((s) => (
                  <li key={s.label}><b>{s.value}</b><span>{s.label}</span></li>
                ))}
                <li><b>900+</b><span>konzultácií o peniazoch</span></li>
              </ul>
            </div>

            <div className="km-collage">
              <div className="km-cg km-cg--video is-floating" style={st(0)}>
                {playing ? (
                  <div className="km-cg-frame">
                    <iframe src={videoSrc} title={HERO.video.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
                  </div>
                ) : (
                  <button type="button" className="km-cg-video" onClick={() => setPlaying(true)} aria-label={`Prehrať video: ${HERO.video.title}`}>
                    <img src={asset(CHYBY.image.src)} alt="" decoding="async" />
                    <span className="km-cg-play" aria-hidden><Play className="h-6 w-6" strokeWidth={2.5} /></span>
                    <span className="km-cg-cap" aria-hidden><span>{HERO.video.title}</span><small>video</small></span>
                  </button>
                )}
              </div>

              <div className="km-cg km-cg--chart is-floating" style={st(1)}>
                <div className="km-cg-k"><span>Inteligentná hypotéka</span><b>zadarmo</b></div>
                <HeroChart />
              </div>

              <figure className="km-cg km-cg--quote is-floating" style={st(2)}>
                <img src={asset(REVIEWS.testimonials[0].avatar.src)} alt="" decoding="async" />
                <div>
                  <blockquote>{REVIEWS.testimonials[0].quote}</blockquote>
                  <figcaption><b>{REVIEWS.testimonials[0].name}</b> · {REVIEWS.testimonials[0].role}</figcaption>
                </div>
              </figure>

              <div className="km-cg km-cg--notice is-floating" style={st(3)}>
                <span className="km-pulse" aria-hidden />
                <div>
                  <b>Nové video každý týždeň</b>
                  <span>{DARK_GRADIENT.items[0].title}</span>
                </div>
              </div>

              <div className="km-cg km-cg--price is-floating" style={st(4)}>
                <b>{"5 €"}</b>
                <span>mesačne · prvé 2 týždne zadarmo</span>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Bežiaci pás tém ═══ */}
        <div className="km-marquee" aria-hidden>
          <div className="km-marquee-track">
            {[...TOPICS, ...TOPICS].map((t, i) => (
              <span key={`${t}-${i}`}>{t}</span>
            ))}
          </div>
        </div>

        {/* ═══ Pre koho to je ═══ */}
        <section className="km-section" id={SECTION_IDS.intro}>
          <div className="km-wrap">
            <AnimatedSection>
              <figure className="km-pull">
                <blockquote>
                  <span className="km-pull-lead">{INTRO.mutedLead}</span> je pre ľudí, ktorí chcú <em>finančne rásť.</em> Ktorí chcú počuť odborné praktické rady a nie prázdne teórie.
                </blockquote>
              </figure>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ 2. Problém: paklík chýb na hnedom ═══ */}
        <section className="km-band km-band--ink" id={SECTION_IDS.chyby}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-deck-head">
                <div>
                  <span className="km-kicker km-kicker--gold">Nájdeš sa v tom?</span>
                  <h2 className="km-h2">{rich(CHYBY.heading)}</h2>
                  <p className="km-lede">{CHYBY.intro}</p>
                </div>
                <div className="km-deck-ctl">
                  <small>Potiahni alebo listuj</small>
                  <button type="button" className="km-deck-btn" onClick={() => slideDeck(-1)} aria-label="Predchádzajúce karty"><ArrowLeft className="h-4 w-4" strokeWidth={1.75} /></button>
                  <button type="button" className="km-deck-btn" onClick={() => slideDeck(1)} aria-label="Ďalšie karty"><ArrowRight className="h-4 w-4" strokeWidth={1.75} /></button>
                </div>
              </div>
            </AnimatedSection>
            <div className="km-deck-wrap" ref={deckRef}>
              <ol className="km-deck">
                {CHYBY.mistakes.map((m, i) => (
                  <li key={m.emphasis} className={cn("km-card", `km-card--${CARD_TONES[i % CARD_TONES.length]}`)}>
                    <div className="km-card-top">
                      <span className="km-card-n">{String(i + 1).padStart(2, "0")}</span>
                      <span className="km-card-emoji" aria-hidden>{m.emoji}</span>
                    </div>
                    <p>{rich(m.text.replace(m.emoji, "").trim())}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="km-deck-foot">
              <p>Ak si sa našiel aspoň v jednej, si na správnom mieste.</p>
              <CtaLink cta={CHYBY.cta} className="km-btn km-btn--light" />
            </div>
          </div>
        </section>

        {/* ═══ 3. Prvých 14 dní ═══ */}
        <section className="km-section" id="prvych-14-dni">
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-head--left">
                <span className="km-kicker">Ako to prebieha</span>
                <h2 className="km-h2">Čo sa stane v prvých <em>14 dňoch.</em></h2>
                <p className="km-lede">Vojdeš dnu, pozrieš si videá, vyskúšaš nástroje, stiahneš si bonusy a rozhodneš sa podľa seba.</p>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={0.06}>
              <ol className="km-days">
                {DAYS.map((d, i) => (
                  <li key={d.badge} className={cn("km-day", i === DAYS.length - 1 && "km-day--last")}>
                    <span className="km-day-badge">{d.badge}</span>
                    <h3>{d.title}</h3>
                    <p>{d.text}</p>
                  </li>
                ))}
              </ol>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ 4. Hodnotový stack: bento ═══ */}
        <section className="km-section" id={SECTION_IDS.nastroje} style={{ paddingTop: 0 }}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-head--left">
                <span className="km-kicker">Čo je vnútri</span>
                <h2 className="km-h2">{HODNOTA.heading}</h2>
                <p className="km-lede">{NASTROJE.subheading}</p>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={0.06}>
              <div className="km-bento">
                <div className="km-b km-b--7 km-b--sand">
                  <span className="km-b-icon"><CalendarDays className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                  <div className="km-b-strip" aria-hidden>
                    {DARK_GRADIENT.items.map((v) => (
                      <img key={v.title} src={asset(v.image.src)} alt="" loading="lazy" decoding="async" />
                    ))}
                  </div>
                  <h3>{HODNOTA.benefitCards[0].title}</h3>
                  <p>{HODNOTA.benefitCards[0].description}</p>
                </div>
                <div className="km-b km-b--5 km-b--green">
                  <span className="km-b-icon"><Route className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                  <div className="km-b-steps" aria-hidden>
                    <span>Rezerva</span><ChevronRight className="h-4 w-4" /><span>Portfólio</span><ChevronRight className="h-4 w-4" /><span>Renta</span>
                  </div>
                  <h3>{HODNOTA.benefitCards[3].title}</h3>
                  <p>{HODNOTA.benefitCards[3].description}</p>
                </div>
                <div className="km-b km-b--4">
                  <span className="km-b-icon"><BarChart3 className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                  <h3>{HODNOTA.benefitCards[1].title}</h3>
                  <p>{HODNOTA.benefitCards[1].description}</p>
                </div>
                <div className="km-b km-b--4 km-b--stone">
                  <span className="km-b-icon"><Calculator className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                  <span className="km-b-count" aria-hidden>{toolsCount}</span>
                  <h3>{HODNOTA.benefitCards[2].title}</h3>
                  <p>{HODNOTA.benefitCards[2].description}</p>
                  <Link to={BONUSY_BASE_PATH} className="km-b-link">Vyskúšať nástroje <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
                </div>
                <div className="km-b km-b--4">
                  <span className="km-b-icon"><Shield className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                  <h3>{HODNOTA.benefitCards[4].title}</h3>
                  <p>{HODNOTA.benefitCards[4].description}</p>
                </div>
                <div className="km-b km-b--12 km-b--ink km-b--chat">
                  <img className="km-b-avatar" src={ivanPortrait} alt="" decoding="async" />
                  <div>
                    <h3>{HODNOTA.benefitCards[5].title}</h3>
                    <p>Nie je to len ďalší obsah. Je to systém, podľa ktorého sa vieš rozhodovať.</p>
                  </div>
                  <span className="km-b-bubble">{HODNOTA.benefitCards[5].description}</span>
                </div>
              </div>
              <div className="km-actions"><CtaLink cta={NASTROJE.cta} /></div>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ 5. Ukážky: vejár videí na piesku ═══ */}
        <section className="km-band km-band--sand" id={SECTION_IDS.darkGradient}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-center">
                <span className="km-kicker">Ukážky z komunity</span>
                <h2 className="km-h2"><span aria-hidden>{DARK_GRADIENT.headingEmoji}</span> {DARK_GRADIENT.headingText}</h2>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={0.06}>
              <div className="km-fan">
                {DARK_GRADIENT.items.map((v) => (
                  <button
                    key={v.title}
                    type="button"
                    className="km-fan-card"
                    style={{ "--rot": v.tilt } as CSSProperties}
                    onClick={scrollToCta}
                    data-umami-event={DARK_GRADIENT.thumbnailClick.umamiEvent}
                    data-umami-event-section={DARK_GRADIENT.thumbnailClick.umamiSection}
                  >
                    <span className="km-fan-thumb">
                      <img src={asset(v.image.src)} alt="" loading="lazy" decoding="async" />
                      <span className="km-fan-play" aria-hidden><Play className="h-5 w-5" strokeWidth={2.5} /></span>
                      <span className="km-fan-dur">{v.duration}</span>
                    </span>
                    <span className="km-fan-title">{v.title}</span>
                  </button>
                ))}
              </div>
              <div className="km-fan-foot">
                <CtaLink cta={DARK_GRADIENT.cta} className="km-btn km-btn--ink" />
                <p>{rich(DARK_GRADIENT.note)}</p>
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ 6. Bonusy ═══ */}
        <div className="km-bonusy">
          <HeroHeroKalkulackySection />
        </div>

        {/* ═══ 7. Dôkazy ═══ */}
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
                  <BigStat key={s.number} number={s.number} text={s.text} />
                ))}
              </ul>
            </AnimatedSection>
            <AnimatedSection delay={0.1}>
              <div className="km-quotes">
                {REVIEWS.testimonials.map((t) => (
                  <figure key={t.name} className="km-quote">
                    <blockquote>{t.quote}</blockquote>
                    <figcaption>
                      <img className="km-avatar" src={asset(t.avatar.src)} alt="" decoding="async" />
                      <span><b>{t.name}</b>{t.role}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
              <div className="km-actions km-center"><CtaLink cta={REVIEWS.cta} /></div>
            </AnimatedSection>
          </div>
          <div className="km-wall">
            <p className="km-wall-cap">Z mojich správ po konzultáciách</p>
            {[GALERIA.images.slice(0, 5), GALERIA.images.slice(5)].map((row, r) => (
              <div key={r} className={cn("km-marquee km-marquee--wall", r === 1 && "is-reverse")}>
                <div className="km-marquee-track">
                  {[...row, ...row].map((img, i) => (
                    <img key={`${img.src}-${i}`} className="km-wall-item" src={asset(img.src)} alt={i < row.length ? img.alt : ""} loading="lazy" decoding="async" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ 8. Ponuka (CTA1): tmavozelený plagát ═══ */}
        <section className="km-band km-band--green" id={HODNOTA.sectionId} data-section={HODNOTA.sectionId}>
          <div className="km-wrap">
            <div className="km-offer">
              <AnimatedSection>
                <span className="km-kicker km-kicker--paper">{HODNOTA.eyebrow}</span>
                <h2 className="km-h2">{CENNIK.heading.split(",")[0]}, <em>potom len 5 € mesačne.</em></h2>
                <div className="km-offer-price">
                  <b>{HODNOTA.price.amount}</b>
                  <span>{HODNOTA.price.unit}</span>
                </div>
                <p className="km-offer-line">{HODNOTA.price.line1}</p>
                <p className="km-offer-line">{HODNOTA.price.line2}</p>
                <ul className="km-checks">
                  {HODNOTA.checks.map((c) => (
                    <li key={c}><Check className="h-4 w-4" strokeWidth={2.25} aria-hidden />{c}</li>
                  ))}
                </ul>
                <div className="km-actions"><CtaLink cta={HODNOTA.cta} className="km-btn km-btn--light km-btn--lg" /></div>
                <p className="km-offer-note">{HODNOTA.note} {CENNIK.note}.</p>
              </AnimatedSection>
              <AnimatedSection delay={0.08}>
                <aside className="km-offer-side">
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
                  <p className="km-guarantee"><Shield className="h-4 w-4" strokeWidth={1.75} aria-hidden />Vojdeš dnu, pozrieš si videá, vyskúšaš nástroje, stiahneš si bonusy a rozhodneš sa podľa seba.</p>
                </aside>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* CTA2 — skryté, nemazať (pôvodná stránka ho drží skryté) */}
        <div className="hidden" aria-hidden="true" data-section={CENNIK.sectionId} id={CENNIK.sectionId}>
          <h2>{CENNIK.heading}</h2>
          <p>{CENNIK.subheading}</p>
        </div>

        {/* ═══ 9. Ivan ═══ */}
        <section className="km-section">
          <div className="km-wrap">
            <div className="km-bio">
              <AnimatedSection>
                <div className="km-bio-photo">
                  <img src={ivanGesto} alt={IVAN.image.alt} decoding="async" />
                  <span className="km-bio-tag">Pod dohľadom NBS</span>
                </div>
              </AnimatedSection>
              <AnimatedSection delay={0.06}>
                <span className="km-kicker">Kto za tým stojí</span>
                <h2 className="km-h2">{IVAN.heading}</h2>
                {IVAN.paragraphs.map((p) => (
                  <p key={p.slice(0, 24)}>{rich(p)}</p>
                ))}
                <ul className="km-facts">
                  <li><b>8+</b><span>rokov pomáham ľuďom rozumne investovať</span></li>
                  <li><b>NBS</b><span>pod dohľadom Národnej banky Slovenska</span></li>
                  <li><b>{"3,5 mil. €"}</b><span>klientskych aktív v starostlivosti</span></li>
                </ul>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* ═══ 10. FAQ ═══ */}
        <section className="km-section" id={SECTION_IDS.faq} style={{ paddingTop: 0 }}>
          <div className="km-wrap">
            <div className="km-faq-grid">
              <AnimatedSection className="km-faq-side">
                <span className="km-kicker">Skôr, než sa rozhodneš</span>
                <h2 className="km-h2">{FAQ.heading}</h2>
                <p className="km-lede">Najlepšie investované peniaze sú do kvalitných informácií.</p>
                <div className="km-actions"><CtaLink cta={NASTROJE.cta} className="km-link">Vyskúšať prvé 2 týždne zadarmo</CtaLink></div>
              </AnimatedSection>
              <AnimatedSection delay={0.06}>
                <div className="km-faq">
                  {FAQ.items.map((item, i) => (
                    <details key={item.question} open={i === FAQ.defaultOpenIndex}>
                      <summary>{item.question}<span aria-hidden><Plus className="h-4 w-4" strokeWidth={1.75} /></span></summary>
                      {item.answer.map((p) => (
                        <p key={p.slice(0, 32)} className="km-faq-a">{rich(p)}</p>
                      ))}
                    </details>
                  ))}
                </div>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* ═══ 11. Porovnanie ═══ */}
        <section className="km-section" id={SECTION_IDS.porovnanie} style={{ paddingTop: 0 }}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-center">
                <span className="km-kicker">Dve cesty</span>
                <h2 className="km-h2">Čo ti kradne peniaze vs. <em>vybuduje tvoj majetok</em></h2>
              </div>
              <div className="km-ledger">
                <div className="km-ledger-col km-ledger-col--bad">
                  <div className="km-ledger-head"><span className="km-mark" aria-hidden><X className="h-3.5 w-3.5" strokeWidth={2.5} /></span>Čo ti kradne peniaze</div>
                  {POROVNANIE.rows.map((r) => (
                    <div key={r.chaosTitle} className="km-ledger-item"><b>{r.chaosTitle}</b><span>{r.chaos}</span></div>
                  ))}
                </div>
                <div className="km-ledger-vs" aria-hidden>{POROVNANIE.mobileDivider}</div>
                <div className="km-ledger-col km-ledger-col--good">
                  <div className="km-ledger-head"><span className="km-mark" aria-hidden><Check className="h-3.5 w-3.5" strokeWidth={2.5} /></span>Čo vybuduje tvoj majetok</div>
                  {POROVNANIE.rows.map((r) => (
                    <div key={r.knowHowTitle} className="km-ledger-item"><b>{r.knowHowTitle}</b><span>{r.knowHow}</span></div>
                  ))}
                </div>
              </div>
              <div className="km-actions km-center"><CtaLink cta={POROVNANIE.cta} /></div>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ 12. Záver ═══ */}
        <section className="km-band km-band--ink">
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-final">
                <span className="km-kicker km-kicker--gold">Rozhodni sa podľa seba</span>
                <h2>Prvé 2 týždne zadarmo, <em>potom len 5 € mesačne.</em></h2>
                <p>{CENNIK.subheading}. Vojdeš dnu, pozrieš si videá, vyskúšaš nástroje a ak ti to nedáva hodnotu, jedným klikom zrušíš.</p>
                <CtaLink cta={CENNIK.cta} className="km-btn km-btn--light km-btn--lg" />
                <small>{CENNIK.note} · {HODNOTA.note}</small>
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* Lepiaca lišta na mobile */}
        <div className={cn("km-bar", barOn && "is-on")} aria-hidden={!barOn}>
          <span className="km-bar-text"><b>{"5 € mesačne"}</b>prvé 2 týždne zadarmo</span>
          <a href={LINKS.cennikSectionHash} className="km-btn" data-umami-event="click_cennik" data-umami-event-section="sticky-bar" tabIndex={barOn ? 0 : -1}>
            Pridať sa <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </a>
        </div>
      </div>
    </PageWrapper>
  );
};

export default Komunita2;
