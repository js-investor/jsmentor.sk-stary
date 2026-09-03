import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft,
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
import { KALKULACKY_CALCULATORS } from "@/pages/kalkulacky/kalkulackyConfig";
import { cn } from "@/lib/utils";
import jsLogo from "@/assets/images/js-mentor-logo.png";
import videoPoster from "@/assets/images/komunita-video-poster.jpg";
import ivanKniha from "@/assets/images/js-investor-ivan-kniha.jpg";
import ivanPolo from "@/assets/images/jsmentor-casual-biznis-muz-biela-kosela.jpg";
import vitajWide from "@/assets/images/komunita-vitaj.jpg";
import ivanKreslo from "@/assets/images/komunita-ivan-kreslo.jpg";
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
 * Komunita 3.4 — „živý klub“ v prísnej mriežke. Predajná logika (Hormozi): hook s ponukou → problém,
 * v ktorom sa človek nájde → čo sa stane v prvých 14 dňoch → čo získaš → ukážky → dôkazy →
 * ponuka bez rizika → kto za tým stojí → otázky → porovnanie → záver. Obsah z komunitaContent.ts.
 * Vizuál (Refero): hero Memorisely/Kajabi (centrovaný, jedno médium), „Čo získaš“ = Sketch 101
 * (zoznam „what you'll learn“ + prilepená karta kurzu), ukážky = MasterClass (zoznam lekcií),
 * rytmus pásov Elementor/Kajabi, pokoj Wealthsimple.
 */

const ICONS: Record<string, LucideIcon> = { PlayCircle, BarChart3, Users, Calculator, FileCheck, TrendingUp, CalendarDays, Route, Shield, MessageCircle };
const st = (i: number) => ({ "--i": i }) as CSSProperties;

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

/** Text s číslom („2000+“, „8 rokov“, „3,5 mil. €+“) – číslo sa napočíta, keď sa objaví na obrazovke. */
const parseCount = (text: string) => {
  const match = /^([\d\s\u00a0,]*\d)(.*)$/.exec(text);
  if (!match) return null;
  const numeric = match[1].replace(/[\s\u00a0]/g, "").replace(",", ".");
  return { target: Number(numeric), decimals: match[1].includes(",") ? 1 : 0, rest: match[2] };
};

const CountUp = ({ text }: { text: string }) => {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const parsed = useMemo(() => parseCount(text), [text]);
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!seen || !parsed) return;
    const { target } = parsed;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 1400);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, parsed]);
  if (!parsed) return <span ref={ref}>{text}</span>;
  return (
    <span ref={ref}>
      {value.toLocaleString("sk-SK", { minimumFractionDigits: parsed.decimals, maximumFractionDigits: parsed.decimals })}
      {parsed.rest}
    </span>
  );
};


/** Pás čísel pod videom (variant A – editoriál bez karty). Prvé číslo podľa Ivana: stiahnutia online kurzov. */
const STRIP = (tools: number) => [
  { kicker: "Online kurzy", value: "4\u00a0000+", text: "stiahnutí online kurzov" },
  { kicker: "Skúsenosti", value: "8 rokov", text: "pomáham ľuďom rozumne investovať" },
  { kicker: "V starostlivosti", value: "3,5\u00a0mil.\u00a0€", text: "klientskych aktív pod dohľadom NBS" },
  { kicker: "Bonusy", value: String(tools), text: "nástrojov a kalkulačiek zadarmo" },
];

/** Jedna recenzia naraz – veľký citát, šípky, bodky, samo sa strieda (Alo Wellness Club). */
const Testimonials = () => {
  const items = REVIEWS.testimonials;
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (hover || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((v) => (v + 1) % items.length), 6000);
    return () => window.clearInterval(id);
  }, [hover, items.length]);
  const t = items[index];
  return (
    <div className="km-carousel" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button type="button" className="km-car-btn km-car-btn--prev" onClick={() => setIndex((index - 1 + items.length) % items.length)} aria-label="Predchádzajúca recenzia">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </button>
      <figure className="km-car-item" key={t.name}>
        <blockquote>„{t.quote}“</blockquote>
        <figcaption>
          <img src={asset(t.avatar.src)} alt="" decoding="async" />
          <span><b>{t.name}</b>{t.role}</span>
        </figcaption>
      </figure>
      <button type="button" className="km-car-btn km-car-btn--next" onClick={() => setIndex((index + 1) % items.length)} aria-label="Ďalšia recenzia">
        <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </button>
      <div className="km-car-dots" role="tablist" aria-label="Recenzie">
        {items.map((it, k) => (
          <button key={it.name} type="button" role="tab" aria-selected={k === index} className={cn("km-dot", k === index && "is-on")} onClick={() => setIndex(k)} aria-label={`Recenzia ${k + 1}`} />
        ))}
      </div>
    </div>
  );
};

const PROOF_KICKERS = ["Investičný kurz", "Rentový kurz", "Individuálne plány"];

const Komunita2 = () => {
  useScrollDepth();
  const toolsCount = KALKULACKY_CALCULATORS.length;
  const [playing, setPlaying] = useState(false);
  const [barOn, setBarOn] = useState(false);
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
            { label: "Bonusy", href: "#bonusy-kalkulacky" },
            { label: "Cena", href: LINKS.cennikSectionHash },
            { label: "Otázky", href: `#${SECTION_IDS.faq}` },
          ]}
          ctaLabel="Pridať sa zadarmo"
          ctaShortLabel="Pridať sa"
          ctaHref={LINKS.cennikSectionHash}
          ctaUmamiEvent="click_cennik"
          ctaUmamiEventSection="header"
          ctaVariant="button"
          progress
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

            <div className="km-stage km-reveal" style={st(10)}>
              {playing ? (
                <div className="km-stage-frame">
                  <iframe src={videoSrc} title={HERO.video.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
                </div>
              ) : (
                <button type="button" className="km-stage-video" onClick={() => setPlaying(true)} aria-label={`Prehrať video: ${HERO.video.title}`}>
                  <img src={videoPoster} alt="" decoding="async" />
                  <span className="km-stage-play" aria-hidden><Play className="h-7 w-7" strokeWidth={2.5} /></span>
                  <span className="km-stage-cap" aria-hidden><span>{HERO.video.title}</span><small>Prehrať video</small></span>
                </button>
              )}
            </div>

            <ul className="km-strip km-reveal" style={st(12)} aria-label="Dôvera">
              {STRIP(toolsCount).map((item) => (
                <li key={item.kicker}>
                  <small>{item.kicker}</small>
                  <b><CountUp text={item.value} /></b>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ═══ Pre koho to je: fotka + vyhlásenie ═══ */}
        <section className="km-section km-section--tight" id={SECTION_IDS.intro}>
          <div className="km-wrap">
            <div className="km-intro">
              <AnimatedSection className="km-intro-photo">
                <img src={ivanKniha} alt="Ivan Jašík" loading="lazy" decoding="async" />
              </AnimatedSection>
              <AnimatedSection delay={0.06} className="km-intro-copy">
                <span className="km-kicker">Pre koho to je</span>
                <p className="km-intro-statement">
                  <span className="km-pull-lead">{INTRO.mutedLead}</span> je pre ľudí, ktorí chcú <em>finančne rásť.</em> Ktorí chcú počuť odborné praktické rady a nie prázdne teórie.
                </p>
                <p className="km-lede">{CHYBY.intro}</p>
                <div className="km-actions">
                  <CtaLink cta={HERO.primaryCta} />
                  <a href={`#${SECTION_IDS.nastroje}`} className="km-link">Pozrieť, čo je vnútri</a>
                </div>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* ═══ 2. Problém: 8 chýb v mriežke na hnedom ═══ */}
        <section className="km-band km-band--ink" id={SECTION_IDS.chyby}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-center">
                <span className="km-kicker km-kicker--gold">Nájdeš sa v tom?</span>
                <h2 className="km-h2">{rich(CHYBY.heading)}</h2>
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

        {/* ═══ 4. Čo získaš: zoznam + prilepená karta členstva (Sketch 101) ═══ */}
        <section className="km-section km-section--divided" id={SECTION_IDS.nastroje}>
          <div className="km-wrap">
            <hr className="km-divider" />
            <AnimatedSection>
              <div className="km-head km-head--left">
                <span className="km-kicker">Čo je vnútri</span>
                <h2 className="km-h2">{HODNOTA.heading}</h2>
                <p className="km-lede">{HODNOTA.subheading}</p>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={0.06}>
              <div className="km-learn">
                <ul className="km-learn-list">
                  {HODNOTA.benefitCards.map((b) => (
                    <li key={b.title}>
                      <span className="km-check" aria-hidden><Check className="h-4 w-4" strokeWidth={2.5} /></span>
                      <div>
                        <b>{b.title}</b>
                        <p>{b.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <aside className="km-summary" aria-label="Členstvo v skratke">
                  <div className="km-summary-head">
                    <img src={ivanPolo} alt="" decoding="async" />
                    <div><b>Ivan Jašík</b><small>Pod dohľadom NBS · viac ako 8 rokov skúseností</small></div>
                  </div>
                  <ul className="km-summary-meta">
                    <li><PlayCircle className="h-5 w-5" strokeWidth={1.75} aria-hidden />Nové video každý týždeň</li>
                    <li><Calculator className="h-5 w-5" strokeWidth={1.75} aria-hidden />{toolsCount} nástrojov a kalkulačiek</li>
                    <li><FileCheck className="h-5 w-5" strokeWidth={1.75} aria-hidden />{NASTROJE.benefitTabs[4].line1}: {NASTROJE.benefitTabs[4].line2}</li>
                    <li><MessageCircle className="h-5 w-5" strokeWidth={1.75} aria-hidden />{HODNOTA.benefitCards[5].title}</li>
                    <li><Shield className="h-5 w-5" strokeWidth={1.75} aria-hidden />{HODNOTA.checks[1]}</li>
                  </ul>
                  <div className="km-summary-price">
                    <b>{CENNIK.price.amount}</b>
                    <span>mesačne</span>
                    <small>{HODNOTA.checks[0]}</small>
                  </div>
                  <CtaLink cta={NASTROJE.cta} className="km-btn km-btn--lg" />
                  <p className="km-summary-note">{HODNOTA.note}</p>
                </aside>
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ 5. Ukážky: videá pod sebou na hnedom gradiente ═══ */}
        <section className="km-band km-band--videos" id={SECTION_IDS.darkGradient}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-center">
                <span className="km-kicker km-kicker--gold">Ukážky z komunity</span>
                <h2 className="km-h2"><span aria-hidden>{DARK_GRADIENT.headingEmoji}</span> {DARK_GRADIENT.headingText}</h2>
                <p className="km-lede">{NASTROJE.subheading}</p>
              </div>
            </AnimatedSection>
            <ol className="km-shows">
              {DARK_GRADIENT.items.map((v, i) => (
                <li key={v.title}>
                  <AnimatedSection delay={i * 0.05}>
                    <button
                      type="button"
                      className="km-show"
                      onClick={scrollToCta}
                      data-umami-event={DARK_GRADIENT.thumbnailClick.umamiEvent}
                      data-umami-event-section={DARK_GRADIENT.thumbnailClick.umamiSection}
                    >
                      <span className="km-show-title">{v.title}</span>
                      <span className="km-show-frame">
                        <img src={asset(v.image.src)} alt="" loading="lazy" decoding="async" />
                        <span className="km-show-play" aria-hidden><Play className="h-6 w-6" strokeWidth={2.5} /></span>
                      </span>
                      <span className="km-show-dur">{v.duration}</span>
                    </button>
                  </AnimatedSection>
                </li>
              ))}
            </ol>
            <AnimatedSection>
              <div className="km-shows-foot">
                <CtaLink cta={DARK_GRADIENT.cta} className="km-btn km-btn--light km-btn--lg" />
                <p>{rich(DARK_GRADIENT.note)}</p>
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ 6. Bonusy ═══ */}
        <div className="km-bonusy">
          <HeroHeroKalkulackySection locked />
        </div>

        {/* ═══ 7. Dôkazy: veľký citát, čísla, stena správ ═══ */}
        <section className="km-section" id={SECTION_IDS.reviews}>
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-head km-center">
                <span className="km-kicker">Dôkazy, nie sľuby</span>
                <h2 className="km-h2">Ľudia potrebujú o peniazoch počuť <em>ľudskou rečou</em> <span aria-hidden>🙌</span></h2>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={0.05}>
              <Testimonials />
            </AnimatedSection>
            <AnimatedSection delay={0.1}>
              <ul className="km-proofstats" aria-label="Čísla">
                {REVIEWS.stats.map((st, i) => (
                  <li key={st.number}>
                    <small>{PROOF_KICKERS[i]}</small>
                    <b><CountUp text={st.number} /></b>
                    <p>{rich(st.text)}</p>
                  </li>
                ))}
              </ul>
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

        {/* ═══ 8. Ponuka (CTA1): hnedý plagát ═══ */}
        <section className="km-band km-band--ink km-band--offer" id={HODNOTA.sectionId} data-section={HODNOTA.sectionId}>
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
                  <img src={ivanKreslo} alt={IVAN.image.alt} decoding="async" />
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
        <section className="km-band km-band--stone" id={SECTION_IDS.faq}>
          <div className="km-wrap">
            <div className="km-faq-grid">
              <AnimatedSection className="km-faq-side">
                <span className="km-kicker">Skôr, než sa rozhodneš</span>
                <h2 className="km-h2">{FAQ.heading}</h2>
                <p className="km-lede">Najlepšie investované peniaze sú do kvalitných informácií.</p>
                <div className="km-actions"><CtaLink cta={NASTROJE.cta} className="km-link">Vyskúšať prvé 2 týždne zadarmo</CtaLink></div>
              </AnimatedSection>
              <AnimatedSection delay={0.06}>
                <div className="km-faq-card">
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
                </div>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* ═══ 11. Porovnanie ═══ */}
        <section className="km-section" id={SECTION_IDS.porovnanie}>
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

        {/* ═══ 12. Záver: plagát vľavo, výzva vpravo ═══ */}
        <section className="km-band km-band--ink">
          <div className="km-wrap">
            <AnimatedSection>
              <div className="km-final">
                <figure className="km-poster">
                  <img src={vitajWide} alt="Ivan Jašík víta nových členov komunity" loading="lazy" decoding="async" />
                  <figcaption className="km-poster-text">Vitaj vo svete, kde peniaze robia peniaze</figcaption>
                </figure>
                <div className="km-final-copy">
                  <span className="km-kicker km-kicker--gold">Rozhodni sa podľa seba</span>
                  <h2>Prvé 2 týždne zadarmo, <em>potom len 5 € mesačne.</em></h2>
                  <p>{CENNIK.subheading}. Vojdeš dnu, pozrieš si videá, vyskúšaš nástroje a ak ti to nedáva hodnotu, jedným klikom zrušíš.</p>
                  <CtaLink cta={CENNIK.cta} className="km-btn km-btn--light km-btn--lg" />
                  <small>{CENNIK.note} · {HODNOTA.note}</small>
                </div>
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
