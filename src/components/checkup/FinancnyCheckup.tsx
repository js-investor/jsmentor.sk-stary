import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import "../calculators/shared/calculator-toolbar.css";
import "../calculators/shared/calc-ui.css";
import "./financny-checkup.css";
import { BONUSY_CTA_LABEL, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";
import {
  BAND_LABEL,
  BENCHMARK,
  CHOICE_QUESTIONS,
  DEFAULT_NUMBERS,
  INDICATORS,
  NUMBER_SCREENS,
  PILLARS,
  RECOMMENDATIONS,
  TIERS,
  bandFor,
  derive,
  derivedPoints,
  type Band,
  type IndicatorId,
  type Numbers,
  type PillarId,
  type Tier,
} from "./checkupData";

type Stage = "intro" | "numbers" | "choices" | "result";
type ChoiceAnswers = Record<string, number | undefined>;

const ADVANCE_DELAY_MS = 380;
const TOTAL_STEPS = NUMBER_SCREENS.length + CHOICE_QUESTIONS.length;

const fmtEur = (v: number) =>
  new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number.isFinite(v) ? v : 0);
const fmtPct = (v: number, d = 0) => `${(v * 100).toFixed(d).replace(".", ",")} %`;
const fmtX = (v: number, d = 1) => `${v.toFixed(d).replace(".", ",")}×`;
const fmtMonths = (v: number) => {
  const r = Math.round(v * 10) / 10;
  const w = r === 1 ? "mesiac" : r >= 2 && r <= 4 ? "mesiace" : "mesiacov";
  return `${r.toFixed(1).replace(".", ",")} ${w}`;
};

/* ------------------------------------------------------------------ skóre */

function computeResult(numbers: Numbers, answers: ChoiceAnswers) {
  const d = derive(numbers);
  const dp = derivedPoints(d);
  const points: Record<IndicatorId, number> = {
    spendRate: dp.spendRate,
    bills: answers.bills ?? 0,
    reserve: dp.reserve,
    longTerm: dp.longTerm,
    dsti: dp.dsti,
    discipline: answers.discipline ?? 0,
    insurance: answers.insurance ?? 0,
    plans: answers.plans ?? 0,
    investRate: dp.investRate,
    fees: answers.fees ?? 0,
  };
  const pillarScores = PILLARS.map((pillar) => {
    const ids = INDICATORS.filter((i) => i.pillar === pillar.id);
    const score = Math.round(ids.reduce((s, i) => s + points[i.id], 0) / ids.length);
    return { pillar, score, band: bandFor(score), indicators: ids.map((i) => ({ ...i, points: points[i.id] })) };
  });
  const total = Math.round(INDICATORS.reduce((s, i) => s + points[i.id], 0) / INDICATORS.length);
  const tier: Tier = TIERS.find((t) => total >= t.min) ?? TIERS[TIERS.length - 1];
  const wellbeing = Math.round(((answers.wb1 ?? 50) + (answers.wb2 ?? 50)) / 2);
  const gap = wellbeing - total;
  const feeling =
    gap >= 15
      ? { title: "Cítiš sa istejšie, než ukazujú čísla", text: "Pocit je o krok pred realitou. Nie je to zlé, len sa nespoliehaj naň pri veľkých rozhodnutiach." }
      : gap <= -15
        ? { title: "Čísla sú lepšie než tvoj pocit", text: "Financie máš zdravšie, než ich prežívaš. Chýba ti prehľad a plán, nie peniaze." }
        : { title: "Pocit sedí s realitou", text: "Vnímaš svoje financie presne. To je dobrý základ pre každé rozhodnutie." };
  const weakest = INDICATORS.map((i) => ({ ...i, points: points[i.id], band: bandFor(points[i.id]) }))
    .sort((a, b) => a.points - b.points)
    .slice(0, 3);
  return { d, points, pillarScores, total, tier, wellbeing, feeling, weakest };
}

/* ------------------------------------------------------------------ kruhový ukazovateľ */

const RING_R = 56;
const RING_C = 2 * Math.PI * RING_R;

const ScoreRing = ({ value, color, track }: { value: number; color: string; track: string }) => {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <div className="fc-ring" role="img" aria-label={`Skóre ${value} zo 100`}>
      <svg viewBox="0 0 140 140" width="100%" height="100%" aria-hidden>
        <circle cx="70" cy="70" r={RING_R} className="fc-ring-track" style={{ stroke: track }} />
        <circle cx="70" cy="70" r={RING_R} className="fc-ring-fill" style={{ stroke: color, strokeDasharray: RING_C, strokeDashoffset: RING_C * (1 - shown / 100) }} />
      </svg>
      <div className="fc-ring-center">
        <span className="fc-ring-value" style={{ color }}>{shown}</span>
        <span className="fc-ring-max">zo 100</span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ pomocné prvky */

const Stepper = ({ onNudge, unit }: { onNudge: (dir: 1 | -1) => void; unit: string }) => (
  <span className="calc-stepper">
    <span className="calc-stepper-unit" aria-hidden>{unit}</span>
    <button type="button" aria-label="Znížiť" onClick={() => onNudge(-1)}>−</button>
    <button type="button" aria-label="Zvýšiť" onClick={() => onNudge(1)}>+</button>
  </span>
);

const PillarStrip = ({ active }: { active: PillarId | "feel" | null }) => (
  <ol className="fc-pillars-strip" aria-label="Piliere">
    {PILLARS.map((p) => (
      <li key={p.id} className={`fc-pill-${p.tone}${active === p.id ? " is-active" : ""}`}>
        <p.Icon className="h-3.5 w-3.5" aria-hidden />
        <span>{p.label}</span>
      </li>
    ))}
    <li className={`fc-pill-feel${active === "feel" ? " is-active" : ""}`}>
      <span>Pocit</span>
    </li>
  </ol>
);

/* ------------------------------------------------------------------ komponent */

const FinancnyCheckup = () => {
  const [stage, setStage] = useState<Stage>("intro");
  const [numIdx, setNumIdx] = useState(0);
  const [choiceIdx, setChoiceIdx] = useState(0);
  const [numbers, setNumbers] = useState<Numbers>(DEFAULT_NUMBERS);
  const [answers, setAnswers] = useState<ChoiceAnswers>({});
  const [pending, setPending] = useState<number | null>(null);
  const timer = useRef<number>(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const scrollToTop = () => {
    const el = rootRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 96;
    if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
  };

  const start = () => {
    setNumbers(DEFAULT_NUMBERS);
    setAnswers({});
    setNumIdx(0);
    setChoiceIdx(0);
    setPending(null);
    setStage("numbers");
    scrollToTop();
  };

  const stepNo = stage === "numbers" ? numIdx : stage === "choices" ? NUMBER_SCREENS.length + choiceIdx : 0;
  const question = CHOICE_QUESTIONS[choiceIdx];
  const numberScreen = NUMBER_SCREENS[numIdx];
  const live = useMemo(() => derive(numbers), [numbers]);
  const result = useMemo(() => (stage === "result" ? computeResult(numbers, answers) : null), [stage, numbers, answers]);

  const nextFromNumbers = () => {
    if (numIdx + 1 < NUMBER_SCREENS.length) setNumIdx(numIdx + 1);
    else setStage("choices");
    scrollToTop();
  };

  const choose = (idx: number) => {
    if (pending !== null) return;
    setAnswers((a) => ({ ...a, [question.id]: question.options[idx].points }));
    setPending(idx);
    timer.current = window.setTimeout(() => {
      setPending(null);
      if (choiceIdx + 1 >= CHOICE_QUESTIONS.length) setStage("result");
      else setChoiceIdx(choiceIdx + 1);
      scrollToTop();
    }, ADVANCE_DELAY_MS);
  };

  const back = () => {
    window.clearTimeout(timer.current);
    setPending(null);
    if (stage === "numbers") {
      if (numIdx === 0) setStage("intro");
      else setNumIdx(numIdx - 1);
    } else if (stage === "choices") {
      if (choiceIdx === 0) {
        setStage("numbers");
        setNumIdx(NUMBER_SCREENS.length - 1);
      } else setChoiceIdx(choiceIdx - 1);
    }
  };

  useEffect(() => {
    if (stage !== "choices") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= question.options.length) choose(n - 1);
      if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, choiceIdx, pending]);

  const selectedIdx = (() => {
    const pts = answers[question?.id ?? ""];
    return pts === undefined ? -1 : question.options.findIndex((o) => o.points === pts);
  })();

  const setNum = (key: keyof Numbers, value: number, min: number, max: number) =>
    setNumbers((n) => ({ ...n, [key]: Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0)) }));

  const activePillar: PillarId | "feel" | null =
    stage === "numbers" ? (numIdx === 0 ? "spend" : "save") : stage === "choices" ? (question.pillar ?? "feel") : null;

  const progressPct = stage === "result" ? 100 : Math.round((stepNo / TOTAL_STEPS) * 100);

  return (
    <div id="fc-root" ref={rootRef} className="calc-ui fc w-full font-sans text-foreground">
      <div className="calc-body-shell">
        <div className="calc-page fc-page">
          <header className="calc-header calc-reveal" style={{ "--i": 0 } as React.CSSProperties}>
            <span className="calc-eyebrow">Finančný check-up</span>
            {stage === "intro" ? (
              <>
                <h1 className="fc-title">Tvoje financie <em>na jednom čísle.</em></h1>
                <p className="fc-lede">Zadáš pár reálnych čísel a odpovieš na sedem otázok. Za tri minúty vidíš skóre 0 až 100, päť pilierov a tri kroky, ktoré ho posunú najviac.</p>
              </>
            ) : null}
          </header>

          {/* ------------------------------------------------------------ Intro */}
          {stage === "intro" && (
            <section className="fc-hero calc-reveal" style={{ "--i": 1 } as React.CSSProperties} aria-label="Úvod">
              <div className="fc-hero-main">
                <p className="fc-hero-kicker">9 krokov · 3 minúty · bez e-mailu</p>
                <h2 className="fc-hero-title">Päť pilierov, <em>jedno skóre.</em> Podľa metodiky FinHealth Score®.</h2>
                <p className="fc-hero-lede">
                  Míňanie, sporenie, dlhy, ochrana a rast. Každý pilier dostane body, spolu dajú skóre finančného zdravia
                  a porovnanie s benchmarkom domácností.
                </p>
                <div className="fc-hero-actions">
                  <button type="button" className="btn-primary fc-btn" onClick={start}>
                    Spustiť check-up
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                  <p className="fc-hero-note">Nie sú tu správne ani nesprávne odpovede. Nič neukladáme, výsledok vidíš len ty.</p>
                </div>
              </div>
              <div className="fc-hero-side" aria-hidden>
                <div className="fc-hero-ring">
                  <ScoreRing value={72} color="#d9b15c" track="rgba(243, 233, 221, 0.26)" />
                </div>
                <p className="fc-hero-side-caption">Ukážka výsledku</p>
              </div>
            </section>
          )}
          {stage === "intro" && (
            <ul className="fc-pillars-intro" aria-label="Päť pilierov">
              {PILLARS.map((p, i) => (
                <li key={p.id} className={`fc-tile fc-tile--${p.tone}`} style={{ animationDelay: `${180 + i * 70}ms` }}>
                  <p.Icon aria-hidden />
                  <span className="fc-tile-label">{p.label}</span>
                  <span className="fc-tile-q">{p.question}</span>
                </li>
              ))}
            </ul>
          )}

          {/* ------------------------------------------------------------ Čísla */}
          {stage === "numbers" && numberScreen && (
            <section className="fc-card fc-quiz" key={numberScreen.id} aria-live="polite">
              <div className="fc-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct} aria-label="Priebeh">
                <div className="fc-progress-fill" style={{ width: `${Math.max(6, progressPct)}%` }} />
              </div>
              <div className="fc-quiz-head">
                <button type="button" className="fc-back" onClick={back} aria-label="Späť">
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Späť
                </button>
                <span className="fc-step">Krok {stepNo + 1} z {TOTAL_STEPS}</span>
              </div>
              <PillarStrip active={activePillar} />
              <p className="fc-lead">{numberScreen.lead}</p>
              <h2 className="fc-question">{numberScreen.title}</h2>

              <div className="fc-fields">
                {numberScreen.fields.map((f) => (
                  <div key={f.key} className="fc-field">
                    <label className="calc-label" htmlFor={`fc-${f.key}`}>
                      {f.label}
                      {f.hint ? <span className="calc-label-hint">{f.hint}</span> : null}
                    </label>
                    <div className="calc-input-wrap calc-input-wrap--stepper">
                      <input
                        type="number"
                        id={`fc-${f.key}`}
                        className="calc-input"
                        inputMode="numeric"
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        value={numbers[f.key]}
                        onChange={(e) => setNum(f.key, Number(e.target.value), f.min, f.max)}
                      />
                      <Stepper unit={f.unit} onNudge={(dir) => setNum(f.key, numbers[f.key] + dir * f.step, f.min, f.max)} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="fc-live" aria-live="polite">
                {numberScreen.id === "mesiac" ? (
                  <>
                    <span className={live.freeCash >= 0 ? "fc-live-good" : "fc-live-bad"}>
                      {live.freeCash >= 0 ? "Ostáva ti" : "Chýba ti"} <strong>{fmtEur(Math.abs(live.freeCash))}</strong> mesačne
                    </span>
                    <span>miera úspor <strong>{fmtPct(live.savingsRate)}</strong></span>
                    <span>splátky <strong>{fmtPct(live.dsti)}</strong> príjmu</span>
                  </>
                ) : (
                  <>
                    <span>rezerva na <strong>{fmtMonths(live.reserveMonths)}</strong></span>
                    <span>investície <strong>{fmtX(live.incomeMultiple)}</strong> ročný príjem</span>
                    <span>investuješ <strong>{fmtPct(live.investRate)}</strong> príjmu</span>
                  </>
                )}
              </div>

              <div className="fc-quiz-actions">
                <button type="button" className="btn-primary fc-btn" onClick={nextFromNumbers}>
                  Pokračovať
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
                <span className="fc-keys">Stačí odhad. Presnosť na euro nerozhoduje.</span>
              </div>
            </section>
          )}

          {/* ------------------------------------------------------------ Otázky */}
          {stage === "choices" && question && (
            <section className="fc-card fc-quiz" key={question.id} aria-live="polite">
              <div className="fc-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct} aria-label="Priebeh">
                <div className="fc-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="fc-quiz-head">
                <button type="button" className="fc-back" onClick={back} aria-label="Späť">
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Späť
                </button>
                <span className="fc-step">Krok {stepNo + 1} z {TOTAL_STEPS}</span>
              </div>
              <PillarStrip active={activePillar} />
              <p className="fc-lead">{question.lead}</p>
              <h2 className="fc-question">{question.text}</h2>
              {question.hint ? <p className="fc-hint">{question.hint}</p> : null}

              <div className="fc-options" role="group" aria-label="Možnosti">
                {question.options.map((o, i) => {
                  const active = pending === i || (pending === null && selectedIdx === i);
                  return (
                    <button key={o.label} type="button" className={`fc-option${active ? " is-active" : ""}`} aria-pressed={active} onClick={() => choose(i)} style={{ animationDelay: `${i * 40}ms` }}>
                      <span className="fc-option-key" aria-hidden>{i + 1}</span>
                      <span className="fc-option-label">{o.label}</span>
                      <span className="fc-option-check" aria-hidden>
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="fc-keys">
                Zdroj otázky: {question.source === "FinHealth" ? "FinHealth Score®, Financial Health Network" : question.source === "CFPB" ? "CFPB Financial Well-Being Scale" : "Ivan Jašík, JS Mentor"}
                <span className="fc-keys-tip"> · stlač 1 až {question.options.length}</span>
              </p>
            </section>
          )}

          {/* ------------------------------------------------------------ Výsledok */}
          {stage === "result" && result && (
            <div className="fc-result">
              <section className="fc-hero fc-hero--result calc-reveal" style={{ "--i": 0 } as React.CSSProperties} aria-label="Skóre">
                <div className="fc-hero-side">
                  <div className="fc-hero-ring">
                    <ScoreRing value={result.total} color={result.tier.id === "zranitelne" ? "#e9a27e" : result.tier.id === "zvladas" ? "#f3e9dd" : "#d9b15c"} track="rgba(243, 233, 221, 0.26)" />
                  </div>
                  <span className={`fc-tier fc-tier--${result.tier.id}`}>{result.tier.label}</span>
                </div>
                <div className="fc-hero-main">
                  <p className="fc-hero-kicker">Tvoje skóre finančného zdravia</p>
                  <h2 className="fc-hero-title">{result.tier.verdict}</h2>
                  <p className="fc-hero-lede">
                    {result.tier.share} Priemer domácností je {BENCHMARK.overall} bodov.
                    <span className="fc-hero-src"> Financial Health Network, Pulse 2025 a 2021.</span>
                  </p>
                  <div className="fc-feeling">
                    <span className="fc-feeling-label">Pocit vs. realita</span>
                    <strong className="fc-feeling-title">{result.feeling.title}</strong>
                    <span className="fc-feeling-text">{result.feeling.text} Pocitové skóre {result.wellbeing}, reálne {result.total}.</span>
                  </div>
                </div>
              </section>

              <section aria-label="Piliere" className="fc-pillars calc-reveal" style={{ "--i": 2 } as React.CSSProperties}>
                {result.pillarScores.map(({ pillar, score, band, indicators }, i) => (
                  <article key={pillar.id} className={`fc-tile fc-tile--${pillar.tone} fc-tile--score`} style={{ animationDelay: `${i * 70}ms` }}>
                    <div className="fc-tile-head">
                      <pillar.Icon className="h-5 w-5" aria-hidden />
                      <span className="fc-tile-label">{pillar.label}</span>
                    </div>
                    <div className="fc-tile-score">
                      <span className="fc-tile-num">{score}</span>
                      <span className={`fc-band fc-band--${band}`}>{BAND_LABEL[band]}</span>
                    </div>
                    <div className="fc-tile-track" aria-hidden>
                      <div className="fc-tile-fill" style={{ width: `${score}%` }} />
                    </div>
                    <ul className="fc-tile-ind">
                      {indicators.map((ind) => (
                        <li key={ind.id}>
                          <span>{ind.label}</span>
                          <strong>{ind.points}</strong>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </section>

              <section className="calc-panel calc-reveal" style={{ "--i": 4 } as React.CSSProperties} aria-label="Tvoje čísla">
                <div className="calc-chart-head">
                  <h2 className="calc-panel-title">Tvoje čísla proti benchmarkom</h2>
                  <span className="calc-panel-sub">Rezerva 3 až 6 mesiacov, úspory 20 %, splátky do 35 %, majetok podľa veku, 25× výdavkov na nezávislosť.</span>
                </div>
                <div className="fc-kpis">
                  <Kpi label="Rezerva" value={fmtMonths(result.d.reserveMonths)} target="cieľ 3 až 6 mesiacov" band={bandFor(result.points.reserve)} />
                  <Kpi label="Miera úspor" value={fmtPct(result.d.savingsRate)} target="cieľ 20 % príjmu" band={bandFor(result.points.spendRate)} />
                  <Kpi label="Splátky" value={`${fmtPct(result.d.dsti)} príjmu`} target="zdravé do 20 %, strop 35 %" band={bandFor(result.points.dsti)} />
                  <Kpi label="Dlhodobé úspory" value={`${fmtX(result.d.incomeMultiple)} ročný príjem`} target={`vo veku ${numbers.age} cieľ ${fmtX(result.d.targetMultiple)}`} band={bandFor(result.points.longTerm)} />
                  <Kpi label="Investuješ" value={`${fmtPct(result.d.investRate)} príjmu`} target="cieľ 15 až 20 %" band={bandFor(result.points.investRate)} />
                  <Kpi label="Cesta k nezávislosti" value={fmtPct(Math.min(9.99, result.d.fiProgress))} target="100 % = 25× ročných výdavkov" band={result.d.fiProgress >= 1 ? "dobra" : result.d.fiProgress >= 0.25 ? "priemer" : "slaba"} />
                </div>
              </section>

              <section className="calc-panel calc-reveal" style={{ "--i": 5 } as React.CSSProperties} aria-label="Tri kroky">
                <div className="calc-chart-head">
                  <h2 className="calc-panel-title">Tri kroky, ktoré posunú skóre najviac</h2>
                  <span className="calc-panel-sub">Najslabšie indikátory ako prvé.</span>
                </div>
                <ol className="fc-rec-list">
                  {result.weakest.map((ind, i) => {
                    const rec = RECOMMENDATIONS[ind.id][ind.band];
                    const pillar = PILLARS.find((p) => p.id === ind.pillar);
                    return (
                      <li key={ind.id} className={`fc-rec is-${ind.band}`}>
                        <span className="fc-rec-n" aria-hidden>{i + 1}</span>
                        <div className="fc-rec-body">
                          <div className="fc-rec-head">
                            <span className="fc-rec-area">{pillar?.label} · {ind.label}</span>
                            <span className="fc-rec-pct">{ind.points} zo 100</span>
                          </div>
                          <h3 className="fc-rec-title">{rec.title}</h3>
                          <p className="fc-rec-text">{rec.text}</p>
                          {rec.tool ? (
                            <a className="fc-rec-tool" href={rec.tool.href}>
                              {rec.tool.label}
                              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                            </a>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <section className="fc-cta calc-reveal" style={{ "--i": 6 } as React.CSSProperties} aria-label="Ďalší krok">
                <div>
                  <h2 className="fc-cta-title">Chceš to prebrať s Ivanom?</h2>
                  <p className="fc-cta-text">Na konzultácii prejdeme tvoje skóre pilier po pilieri, urobíme poradie krokov a povieme si, čo riešiť tento mesiac.</p>
                </div>
                <div className="fc-cta-actions">
                  <a href={KONZULTACIA_URL} target="_blank" rel="noopener noreferrer" className="btn-primary fc-btn" data-umami-event="click_konzultacia" data-umami-event-section="financny-checkup">
                    {BONUSY_CTA_LABEL}
                  </a>
                  <button type="button" className="fc-btn-ghost" onClick={start}>
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Vyplniť znova
                  </button>
                </div>
              </section>

              <p className="calc-note calc-note--center">
                Metodika: FinHealth Score® (Financial Health Network, 8 indikátorov v pilieroch Míňaš, Šetríš, Dlhy, Chrániš) doplnená o pilier Rastieš
                a o reálne pomerové ukazovatele; pocitová časť z CFPB Financial Well-Being Scale. Benchmark: U.S. Financial Health Pulse.
                Check-up je vzdelávací, nie individuálne poradenstvo. Odpovede sa nikam neposielajú.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Kpi = ({ label, value, target, band }: { label: string; value: string; target: string; band: Band }) => (
  <div className={`fc-kpi is-${band}`}>
    <span className="fc-kpi-label">{label}</span>
    <span className="fc-kpi-value">{value}</span>
    <span className="fc-kpi-target">{target}</span>
    <span className={`fc-band fc-band--${band}`}>{BAND_LABEL[band]}</span>
  </div>
);

export default FinancnyCheckup;
