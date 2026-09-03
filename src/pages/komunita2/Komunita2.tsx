import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
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
 * Komunita 3.2 — „živý klub“ v prísnej mriežke. Predajná logika (Hormozi): hook s ponukou → problém,
 * v ktorom sa človek nájde → čo sa stane v prvých 14 dňoch → hodnotový stack → ukážky → dôkazy →
 * ponuka bez rizika → kto za tým stojí → otázky → porovnanie → záver. Obsah z komunitaContent.ts.
 * Vizuál (Refero): Alo Wellness Club, Patreon, Elementor/Kajabi, Wealthsimple.
 */

const ICONS: Record<string, LucideIcon> = { PlayCircle, BarChart3, Users, Calculator, FileCheck, TrendingUp, CalendarDays, Route, Shield, MessageCircle };
const st = (i: number) => ({ "--i": i }) as CSSProperties;

const DAYS = [
  { badge: "Deň 0", title: "Vstúpiš dnu.", text: HODNOTA.checks[2] + ". Platba až po skončení skúšobného obdobia." },
  { badge: "Deň 1 – 3", title: "Pozrieš si prvé rozbory.", text: `${NASTROJE.benefitTabs[0].line1}: ${NASTROJE.benefitTabs[0].line2}. ${NASTROJE.benefitTabs[1].line1} – ${NASTROJE.benefitTabs[1].line2}.` },
  { badge: "Deň 4 – 7", title: "Prepočítaš si vlastné čísla.", text: `${NASTROJE.benefitTabs[3].line1}: ${NASTROJE.benefitTabs[3].line2}. ${NASTROJE.benefitTabs[4].line1} – ${NASTROJE.benefitTabs[4].line2}.` },
  { badge: "Deň 14", title: "Rozhodneš sa podľa seba.", text: "Ak zistíš, že ti to nedáva hodnotu, členstvo jednoducho zrušíš. Bez viazanosti, bez telefonátov, bez presviedčania." },
];

/** Témy rozborov a produkty zo slovenského trhu (z FAQ). */
const ROZBORY_CHIPS = ["Fondy", "Hypotéky", "Investičné byty", "ETF", "Poplatky", "Platformy"];
const PRODUKTY = ["Fondy", "Investičné produkty", "Platformy", "Hypotéky", "Poplatky", "Bežné riešenia bez kontextu"];
const PATH_STEPS = ["Rezerva", "Portfólio", "Renta"];

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
const HypoChart = () => {
  const r = useMemo(() => compute(DEFAULT_INPUTS), []);
  const W = 320;
  const H = 120;
  const years = DEFAULT_INPUTS.years;
  const max = Math.max(...r.mort, ...r.res.slice(0, r.crossM > 0 ? r.crossM + 1 : r.res.length));
  const x = (m: number) => 6 + (m / (years * 12)) * (W - 12);
  const y = (v: number) => H - 8 - (v / max) * (H - 22);
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
      <h3 className="km-panel-title">
        Hypotéku splatíš <em>o {yearsEarlier} {rokov(yearsEarlier)} skôr.</em>
      </h3>
      <p className="km-panel-text">Plať banke minimum a rozdiel posielaj do úverovej rezervy. V bode, kde rezerva dobehne zostatok, môžeš dlh splatiť naraz.</p>
      <svg className="km-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Dlh klesá, úverová rezerva rastie – v bode kríženia môžeš hypotéku splatiť.">
        <line className="l-x" x1="6" x2={W - 6} y1={H - 8} y2={H - 8} />
        {crossX !== null ? <line className="l-x" x1={crossX} x2={crossX} y1="8" y2={H - 8} strokeDasharray="3 4" /> : null}
        <path className="l-fill" d={`${resPath} L${x(years * 12).toFixed(1)},${H - 8} L6,${H - 8} Z`} />
        <path className="l-mort l-draw" d={mortPath} />
        <path className="l-res l-draw" d={resPath} />
        {crossX !== null ? <circle cx={crossX} cy={y(r.res[r.crossM])} r="4.5" fill="#2a6647" stroke="#fffcf7" strokeWidth="2" /> : null}
      </svg>
      <ul className="km-legend">
        <li><i />zostatok hypotéky</li>
        <li><i className="is-green" />úverová rezerva</li>
      </ul>
    </>
  );
};

/** Náhľad k položke zoznamu „Čo je vnútri“ (index = poradie v HODNOTA.benefitCards). */
const FeaturePanel = ({ index, toolsCount }: { index: number; toolsCount: number }) => {
  switch (index) {
    case 0:
      return (
        <div className="km-panel" key="feed">
          <p className="km-panel-label"><span className="km-pulse" aria-hidden />Nové video každý týždeň</p>
          <ul className="km-feed">
            {DARK_GRADIENT.items.map((v) => (
              <li key={v.title}>
                <img src={asset(v.image.src)} alt="" loading="lazy" decoding="async" />
                <span><b>{v.title}</b><small>{v.duration}</small></span>
              </li>
            ))}
          </ul>
        </div>
      );
    case 1:
      return (
        <div className="km-panel" key="rozbory">
          <p className="km-panel-label">Rozbory cez čísla</p>
          <blockquote className="km-panel-quote">Nebude to štýlom „toto si kúp“. Bude to cez čísla, poplatky, riziká, výhody, nevýhody a alternatívy.</blockquote>
          <div className="km-chips" aria-hidden>
            {ROZBORY_CHIPS.map((c) => (
              <span key={c} className="km-chip">{c}</span>
            ))}
          </div>
        </div>
      );
    case 2:
      return (
        <div className="km-panel" key="nastroje">
          <p className="km-panel-label">Inteligentná hypotéka · jeden z {toolsCount} nástrojov</p>
          <HypoChart />
          <Link to={BONUSY_BASE_PATH} className="km-panel-link">Vyskúšať všetky nástroje zadarmo <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </div>
      );
    case 3:
      return (
        <div className="km-panel" key="cesta">
          <p className="km-panel-label">Krok za krokom</p>
          <h3 className="km-panel-title">{HODNOTA.benefitCards[3].title}</h3>
          <p className="km-panel-text">{HODNOTA.benefitCards[3].description}</p>
          <ol className="km-path">
            {PATH_STEPS.map((s, i) => (
              <li key={s}><span className="km-path-n">0{i + 1}</span><b>{s}</b></li>
            ))}
          </ol>
        </div>
      );
    case 4:
      return (
        <div className="km-panel" key="produkty">
          <p className="km-panel-label">Slovenský trh</p>
          <h3 className="km-panel-title">{HODNOTA.benefitCards[4].title}</h3>
          <p className="km-panel-text">Aby si konečne vedel, čo vlastne vlastníš alebo čo sa ti niekto snaží predať.</p>
          <ul className="km-checklist">
            {PRODUKTY.map((p) => (
              <li key={p}><Check className="h-4 w-4" strokeWidth={2.25} aria-hidden />{p}</li>
            ))}
          </ul>
        </div>
      );
    default:
      return (
        <div className="km-panel km-chat" key="otazky">
          <p className="km-panel-label">{HODNOTA.benefitCards[5].title}</p>
          <div className="km-chat-head">
            <img src={ivanPortrait} alt="" decoding="async" />
            <span><b>Ivan Jašík</b><small>odpovedá v komunite</small></span>
          </div>
          <span className="km-bubble">{HODNOTA.benefitCards[5].description}</span>
        </div>
      );
  }
};

const Komunita2 = () => {
  useScrollDepth();
  const toolsCount = KALKULACKY_CALCULATORS.length;
  const [playing, setPlaying] = useState(false);
  const [barOn, setBarOn] = useState(false);
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [hover, setHover] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    // Náhľady sa striedajú samy, kým sa človek nedotkne zoznamu.
    if (!auto || hover) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setActive((a) => (a + 1) % HODNOTA.benefitCards.length), 4500);
    return () => window.clearInterval(id);
  }, [auto, hover]);

  const pick = (i: number) => {
    setActive(i);
    setAuto(false);
  };

  const playHero = () => {
    setPlaying(true);
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const videoSrc = HERO.video.src.replace("autoplay=0", "autoplay=1");
  const [featured, ...moreVideos] = DARK_GRADIENT.items;

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

        {/* ═══ 1. Hook: sľub, jedno video, pás čísel ═══ */}
        <section className="km-hero" ref={heroRef}>
          <div className="km-wrap">
            <div className="km-hero-center">
              <p className="km-pill km-reveal" style={st(0)}>{HERO.eyebrow}</p>
              <h1 className="km-h1">
                <Words text={"Toto je cesta k\u00a0bohatšiemu životu."} from={1} />
              </h1>
              <p className="km-lede km-reveal" style={st(7)}>{HERO.subheadline}</p>
              <div className="km-hero-actions km-reveal" style={st(8)}>
                <CtaLink cta={HERO.primaryCta} className="km-btn km-btn--lg" />
                <button type="button" className="km-link" onClick={playHero}>
                  <Play className="h-4 w-4" strokeWidth={2.25} aria-hidden /> Pozrieť video
                </button>
              </div>
              <p className="km-trust km-reveal" style={st(9)}>
                <span className="km-trust-avatars" aria-hidden>
                  {REVIEWS.testimonials.map((t) => (
                    <img key={t.name} src={asset(t.avatar.src)} alt="" decoding="async" />
                  ))}
                </span>
                <span>{rich(HERO.trustBanner)}</span>
              </p>
            </div>

            <div className="km-stage km-reveal" style={st(10)} ref={stageRef}>
              {playing ? (
                <div className="km-stage-frame">
                  <iframe src={videoSrc} title={HERO.video.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
                </div>
              ) : (
                <button type="button" className="km-stage-video" onClick={() => setPlaying(true)} aria-label={`Prehrať video: ${HERO.video.title}`}>
                  <img src={asset(CHYBY.image.src)} alt="" decoding="async" />
                  <span className="km-stage-play" aria-hidden><Play className="h-7 w-7" strokeWidth={2.5} /></span>
                  <span className="km-stage-cap" aria-hidden><span>{HERO.video.title}</span><small>Prehrať video</small></span>
                </button>
              )}
            </div>

            <ul className="km-strip km-reveal" style={st(12)} aria-label="Dôvera">
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
              <figure className="km-pull">
                <blockquote>
                  <span className="km-pull-lead">{INTRO.mutedLead}</span> je pre ľudí, ktorí chcú <em>finančne rásť.</em> Ktorí chcú počuť odborné praktické rady a nie prázdne teórie.
                </blockquote>
              </figure>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ 2. Problém: 8 chýb v mriežke na hnedom ═══ */}
        <section className="km-band km-band--ink" id={SECTION_IDS.chyby}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-mistakes-head">
                <div>
                  <span className="km-kicker km-kicker--gold">Nájdeš sa v tom?</span>
                  <h2 className="km-h2">{rich(CHYBY.heading)}</h2>
                </div>
                <p className="km-lede">{CHYBY.intro}</p>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={0.06}>
              <ol className="km-mistakes">
                {CHYBY.mistakes.map((m, i) => (
                  <li key={m.emphasis} className="km-mistake">
                    <span className="km-mistake-emoji" aria-hidden>{m.emoji}</span>
                    <p>{rich(m.text.replace(m.emoji, "").trim())}</p>
                    <span className="km-mistake-n" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                  </li>
                ))}
              </ol>
              <div className="km-mistakes-foot">
                <p>Ak si sa našiel aspoň v jednej, si na správnom mieste.</p>
                <CtaLink cta={CHYBY.cta} className="km-btn km-btn--light" />
              </div>
            </AnimatedSection>
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

        {/* ═══ 4. Hodnotový stack: zoznam + prilepený náhľad ═══ */}
        <section className="km-section" id={SECTION_IDS.nastroje} style={{ paddingTop: 0 }}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-head--left">
                <span className="km-kicker">Čo je vnútri</span>
                <h2 className="km-h2">{HODNOTA.heading}</h2>
                <p className="km-lede">{HERO.description}</p>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={0.06}>
              <div className="km-features" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
                <ol className="km-feature-list">
                  {HODNOTA.benefitCards.map((b, i) => {
                    const Icon = ICONS[b.icon] ?? Check;
                    return (
                      <li key={b.title}>
                        <button
                          type="button"
                          className={cn("km-feature", active === i && "is-active")}
                          aria-pressed={active === i}
                          onMouseEnter={() => setActive(i)}
                          onFocus={() => setActive(i)}
                          onClick={() => pick(i)}
                        >
                          <span className="km-feature-icon"><Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden /></span>
                          <span><b>{b.title}</b><span>{b.description}</span></span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <div className="km-feature-stage" aria-live="polite">
                  <FeaturePanel index={active} toolsCount={toolsCount} />
                </div>
              </div>
              <div className="km-actions"><CtaLink cta={NASTROJE.cta} /></div>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ 5. Ukážky: hlavné video + zoznam ═══ */}
        <section className="km-band km-band--sand" id={SECTION_IDS.darkGradient}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-showcase">
                <div className="km-showcase-copy">
                  <span className="km-kicker">Ukážky z komunity</span>
                  <h2 className="km-h2"><span aria-hidden>{DARK_GRADIENT.headingEmoji}</span> {DARK_GRADIENT.headingText}</h2>
                  <p className="km-lede">{NASTROJE.subheading}</p>
                  <div className="km-actions"><CtaLink cta={DARK_GRADIENT.cta} className="km-btn km-btn--ink" /></div>
                  <p className="km-showcase-note">{rich(DARK_GRADIENT.note)}</p>
                </div>
                <div className="km-showcase-media">
                  <button
                    type="button"
                    className="km-featured"
                    onClick={scrollToCta}
                    data-umami-event={DARK_GRADIENT.thumbnailClick.umamiEvent}
                    data-umami-event-section={DARK_GRADIENT.thumbnailClick.umamiSection}
                  >
                    <span className="km-featured-thumb">
                      <img src={asset(featured.image.src)} alt="" loading="lazy" decoding="async" />
                      <span className="km-video-play" aria-hidden><Play className="h-5 w-5" strokeWidth={2.5} /></span>
                      <span className="km-video-dur">{featured.duration}</span>
                    </span>
                    <span className="km-featured-title"><span>{featured.title}</span><small>Nové</small></span>
                  </button>
                  <ul className="km-video-list">
                    {moreVideos.map((v) => (
                      <li key={v.title}>
                        <button
                          type="button"
                          className="km-video-row"
                          onClick={scrollToCta}
                          data-umami-event={DARK_GRADIENT.thumbnailClick.umamiEvent}
                          data-umami-event-section={DARK_GRADIENT.thumbnailClick.umamiSection}
                        >
                          <img src={asset(v.image.src)} alt="" loading="lazy" decoding="async" />
                          <span><b>{v.title}</b><small>{v.duration}</small></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
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
              <div key={r} className={cn("km-marquee", r === 1 && "is-reverse")}>
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
                  <li><b>{"3,5 mil. €"}</b><span>klientskych aktív v starostlivosti</span></li>
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
          <span className="km-bar-text"><b>{"5 € mesačne"}</b>prvé 2 týždne zadarmo</span>
          <a href={LINKS.cennikSectionHash} className="km-btn" data-umami-event="click_cennik" data-umami-event-section="sticky-bar" tabIndex={barOn ? 0 : -1}>
            Pridať sa <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </a>
        </div>
      </div>
    </PageWrapper>
  );
};

export default Komunita2;
