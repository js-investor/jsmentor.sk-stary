import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { ArrowRight } from "lucide-react";
import "../shared/calc-ui.css";
import "./inteligentna-hypoteka.css";
import { DEFAULT_INPUTS, LIMITS, compute, niceStep, type Inputs } from "./inteligentnaHypotekaModel";
import { BONUSY_CTA_LABEL, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";

/**
 * Inteligentná hypotéka – päť otázok zhora nadol, potom výsledok.
 * Referencie (Refero): Wealthsimple kalkulačky (jedno tvrdenie ako výsledok, monochromatický graf,
 * jediný akcent), Preply / Teachable (jedna otázka na krok, tenký progress, Späť + jedno tlačidlo).
 * Farby: atrament, krém, hairline a jedna zelená. Bez červenej, zlatej a tmavých blokov.
 */

const STORAGE_KEY = "jsm_inteligentna_hypoteka_v2";
const st = (i: number) => ({ "--i": i }) as CSSProperties;

const fmt = (n: number) => `${Math.round(Number.isFinite(n) ? n : 0).toLocaleString("sk-SK")}\u00a0€`;
const fmtS = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n)).toLocaleString("sk-SK")}\u00a0€`;
const f1 = (n: number) => n.toLocaleString("sk-SK", { maximumFractionDigits: 2 });
const yearOf = (m: number) => Math.ceil(m / 12);
const rokov = (y: number) => (y === 1 ? "rok" : y >= 2 && y <= 4 ? "roky" : "rokov");

type QKey = "P" | "rate" | "years" | "C" | "yieldPct";

const STEPS: { key: QKey; q: string; help: string; unit: string; chips?: number[]; show: (v: number) => string }[] = [
  { key: "P", q: "Koľko ti ostáva splatiť?", help: "Zostatok hypotéky dnes. Stačí približne.", unit: "€", show: (v) => fmt(v) },
  { key: "rate", q: "Aký máš úrok?", help: "Sadzba z aktuálnej fixácie.", unit: "% p. a.", chips: [3, 3.5, 4, 4.5], show: (v) => `${f1(v)} % p. a.` },
  { key: "years", q: "Koľko rokov ešte budeš splácať?", help: "Zostávajúca splatnosť hypotéky.", unit: "rokov", show: (v) => `${v} ${rokov(v)}` },
  { key: "C", q: "Koľko vieš mesačne dať bokom navyše?", help: "Suma nad rámec splátky. Namiesto mimoriadnej splátky pôjde do úverovej rezervy, ktorá ostáva tvoja.", unit: "€ / mes.", chips: [50, 100, 200, 300], show: (v) => `${fmt(v)} / mes.` },
  { key: "yieldPct", q: "Aký výnos od rezervy očakávaš?", help: "Dlhodobý priemer svetových akcií je okolo 7 % ročne. Radšej počítaj konzervatívne.", unit: "% p. a.", chips: [4, 6, 7.5, 9], show: (v) => `${f1(v)} % p. a.` },
];

type Saved = { answers: Inputs; done: boolean };

const loadSaved = (): Saved => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { answers: DEFAULT_INPUTS, done: false };
    const parsed = JSON.parse(raw) as Partial<Saved>;
    const answers = { ...DEFAULT_INPUTS, ...(parsed.answers ?? {}) };
    (Object.keys(LIMITS) as (keyof Inputs)[]).forEach((k) => {
      const v = Number(answers[k]);
      answers[k] = Number.isFinite(v) ? Math.min(LIMITS[k].max, Math.max(LIMITS[k].min, v)) : DEFAULT_INPUTS[k];
    });
    return { answers, done: Boolean(parsed.done) };
  } catch {
    return { answers: DEFAULT_INPUTS, done: false };
  }
};

/** Plynulé dobehnutie čísla k cieľu. */
function useCountUp(target: number, ms = 600): number {
  const [v, setV] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(from + (target - from) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = target;
    };
  }, [target, ms]);
  return v;
}

/* ------------------------------------------------------------------ vstup otázky: číslo + slider */

type ValueFieldProps = {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  chips?: number[];
  onChange: (v: number) => void;
  onEnter?: () => void;
};

const ValueField = ({ label, unit, value, min, max, step, chips, onChange, onEnter }: ValueFieldProps) => {
  const [editing, setEditing] = useState(false);
  const decimals = Math.max(0, (String(step).split(".")[1] ?? "").length);
  const clamp = (v: number) => Number(Math.max(min, Math.min(max, Number.isFinite(v) ? v : min)).toFixed(decimals));
  const shown = editing ? String(value).replace(".", ",") : value.toLocaleString("sk-SK", { maximumFractionDigits: decimals });
  const p = `${((value - min) / (max - min)) * 100}%`;
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
      onEnter?.();
    }
  };
  return (
    <div className="ih-answer">
      <div className="ih-answer-row">
        <input
          className="ih-answer-input"
          type="text"
          inputMode="decimal"
          value={shown}
          aria-label={label}
          size={Math.max(3, shown.length)}
          onFocus={() => setEditing(true)}
          onBlur={(e) => {
            setEditing(false);
            onChange(clamp(Number(e.target.value.replace(/\s/g, "").replace(",", "."))));
          }}
          onChange={(e) => {
            const v = Number(e.target.value.replace(/[^0-9.,-]/g, "").replace(",", "."));
            if (Number.isFinite(v)) onChange(clamp(v));
          }}
          onKeyDown={onKey}
        />
        <span className="ih-answer-unit">{unit}</span>
      </div>
      <input
        type="range"
        className="calc-slider ih-slider"
        style={{ "--p": p } as CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={`${label} (posuvník)`}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      <div className="ih-scale">
        <span>{min.toLocaleString("sk-SK")}</span>
        <span>{max.toLocaleString("sk-SK")}</span>
      </div>
      {chips ? (
        <div className="ih-chips" role="group" aria-label="Rýchly výber">
          {chips.map((c) => (
            <button key={c} type="button" className={`ih-chip${value === c ? " is-on" : ""}`} aria-pressed={value === c} onClick={() => onChange(c)}>
              {c.toLocaleString("sk-SK")} {unit}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ graf */

const W = 940;
const H = 400;
const PL = 66;
const PR = W - 28;
const PT = 40;
const PB = H - 40;

/* ------------------------------------------------------------------ komponent */

const InteligentnaHypotekaCalculator = () => {
  const [saved] = useState(loadSaved);
  const [A, setA] = useState<Inputs>(saved.answers);
  const [done, setDone] = useState(saved.done);
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; m: number } | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const drawnRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers: A, done } satisfies Saved));
    } catch {
      /* súkromný režim */
    }
  }, [A, done]);

  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setA((s) => ({ ...s, [k]: v }));
  const d = useMemo(() => compute(A), [A]);
  const hasCross = d.crossM >= 0;
  const crossYear = hasCross ? yearOf(d.crossM) : 0;
  const yearsEarlier = hasCross ? Math.round(d.monthsEarlier / 12) : 0;
  const shownDiff = useCountUp(d.diff);
  const shownSaved = useCountUp(d.interestSaved);
  const shownReserve = useCountUp(d.reserveEnd);

  const activeStep = editing ?? step;
  const current = STEPS[activeStep];
  const showQuestion = !done || editing !== null;
  const progress = done ? 100 : (step / STEPS.length) * 100;

  const next = () => {
    if (editing !== null) {
      setEditing(null);
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    setDone(true);
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const back = () => {
    if (editing !== null) setEditing(null);
    else if (step > 0) setStep(step - 1);
  };
  const restart = () => {
    setA(DEFAULT_INPUTS);
    setDone(false);
    setEditing(null);
    setStep(0);
    drawnRef.current = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* geometria grafu (len hypotéka a rezerva – prienik je hviezda) */
  const G = useMemo(() => {
    const yMax = Math.max(d.mort[0], d.reserveEnd) * 1.1 || 1;
    const xS = (m: number) => PL + (m / d.n) * (PR - PL);
    const yS = (v: number) => PB - (v / yMax) * (PB - PT);
    const line = (arr: number[]) => arr.map((v, m) => `${m ? "L" : "M"}${xS(m).toFixed(1)} ${yS(v).toFixed(1)}`).join(" ");
    const area = (arr: number[]) => `${line(arr)} L${PR.toFixed(1)} ${PB.toFixed(1)} L${PL.toFixed(1)} ${PB.toFixed(1)} Z`;
    const stepV = niceStep(yMax / 4);
    const grid: number[] = [];
    for (let v = 0; v <= yMax; v += stepV) grid.push(v);
    const stepYr = d.N <= 12 ? 2 : 5;
    const ticks: number[] = [];
    for (let yr = 0; yr < d.N; yr += stepYr) ticks.push(yr);
    ticks.push(d.N);
    return { yMax, xS, yS, line, area, grid, ticks };
  }, [d]);

  /* dokreslenie čiar pri prvom zobrazení výsledku */
  useEffect(() => {
    if (!done || drawnRef.current) return;
    drawnRef.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const paths = svgRef.current?.querySelectorAll<SVGPathElement>(".ih-ln");
    if (!paths?.length) return;
    const timers: number[] = [];
    paths.forEach((p, i) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      p.getBoundingClientRect();
      p.style.transition = `stroke-dashoffset 1.1s cubic-bezier(0.22, 0.61, 0.36, 1) ${200 + i * 150}ms`;
      p.style.strokeDashoffset = "0";
      timers.push(
        window.setTimeout(() => {
          p.style.transition = "";
          p.style.strokeDasharray = "";
          p.style.strokeDashoffset = "";
        }, 1600 + i * 150),
      );
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [done]);

  const onMove = (clientX: number) => {
    const svg = svgRef.current;
    const host = hostRef.current;
    if (!svg || !host) return;
    const r = svg.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    const scale = r.width / W;
    const lx = (clientX - r.left) / scale;
    const m = Math.max(0, Math.min(d.n, Math.round(((lx - PL) / (PR - PL)) * d.n)));
    const cx = G.xS(m) * scale + (r.left - hr.left);
    const cy = G.yS(Math.max(d.mort[m], d.res[m])) * scale + (r.top - hr.top);
    setTip({ x: cx, y: cy, m });
  };

  const crossX = hasCross ? G.xS(d.crossM) : 0;
  const crossY = hasCross ? G.yS(d.res[d.crossM]) : 0;
  const labelLeft = hasCross && crossX > (PL + PR) / 2;
  const tipM = tip?.m ?? 0;
  const budget = d.M + A.C;
  const payoffYear = yearOf(d.payoffM);

  /* živá nápoveda pod otázkou */
  const hint =
    current.key === "years"
      ? `Splátka pri týchto číslach: ${fmt(d.M)} mesačne.`
      : current.key === "C"
        ? `Spolu mesačne: splátka ${fmt(d.M)} + rezerva ${fmt(A.C)} = ${fmt(budget)}.`
        : current.key === "yieldPct"
          ? `Úrok hypotéky je ${f1(A.rate)} %. Ak je výnos rezervy vyšší, investovanie rozdielu sa oplatí.`
          : null;

  return (
    <div id="ih-root" className="calc-ui ih w-full font-sans">
      <div className="calc-body-shell">
        <div className="calc-page ih-page">
          <header className="calc-header calc-reveal" style={st(0)}>
            <span className="calc-eyebrow">Inteligentná hypotéka</span>
            <h1 className="calc-title">
              Kedy môžeš hypotéku<br />
              <em>doplatiť skôr?</em>
            </h1>
            <p className="calc-subtitle">
              Päť otázok, žiadna registrácia. Plať banke minimum, rozdiel posielaj do úverovej rezervy a zisti,
              v ktorom roku ju môžeš celú doplatiť.
            </p>
          </header>

          {/* ═══ Otázky zhora nadol ═══ */}
          <section className="ih-flow calc-reveal" aria-label="Otázky" style={st(1)}>
            <div className="ih-progress" aria-hidden>
              <span className="ih-progress-label">{done && editing === null ? "Hotovo" : `Otázka ${activeStep + 1} z ${STEPS.length}`}</span>
              <span className="ih-progress-track"><span className="ih-progress-fill" style={{ width: `${progress}%` }} /></span>
            </div>

            {/* zodpovedané otázky */}
            {(done ? STEPS : STEPS.slice(0, step)).length > 0 ? (
              <ol className="ih-done">
                {(done ? STEPS : STEPS.slice(0, step)).map((s, i) => (
                  <li key={s.key} className={editing === i ? "is-editing" : ""}>
                    <span className="ih-done-q">{s.q}</span>
                    <span className="ih-done-v">{s.show(A[s.key])}</span>
                    <button type="button" className="ih-done-edit" onClick={() => setEditing(i)} disabled={editing === i}>
                      Upraviť
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}

            {showQuestion ? (
              <div key={`${activeStep}-${editing}`} className="ih-q">
                <h2 className="ih-q-title">{current.q}</h2>
                <p className="ih-q-help">{current.help}</p>
                <ValueField
                  label={current.q}
                  unit={current.unit}
                  value={A[current.key]}
                  {...LIMITS[current.key]}
                  chips={current.chips}
                  onChange={(v) => set(current.key, v)}
                  onEnter={next}
                />
                {hint ? <p className="ih-q-hint">{hint}</p> : null}
                <div className="ih-q-actions">
                  {activeStep > 0 || editing !== null ? (
                    <button type="button" className="ih-back" onClick={back}>
                      {editing !== null ? "Zrušiť" : "Späť"}
                    </button>
                  ) : (
                    <span />
                  )}
                  <button type="button" className="btn-primary ih-next" onClick={next}>
                    {editing !== null ? "Hotovo" : activeStep < STEPS.length - 1 ? "Ďalej" : "Ukázať výsledok"}
                    <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </button>
                </div>
              </div>
            ) : (
              <div className="ih-flow-foot">
                <button type="button" className="ih-back" onClick={restart}>Začať odznova</button>
              </div>
            )}
          </section>

          {/* ═══ Výsledok ═══ */}
          {done ? (
            <section ref={resultRef} className="ih-result" aria-label="Výsledok">
              <div className="ih-verdict calc-reveal" style={st(0)}>
                <span className="ih-kicker">Tvoj výsledok</span>
                {hasCross ? (
                  <>
                    <h2 className="ih-verdict-title">
                      Hypotéku môžeš doplatiť už v <em>{crossYear}. roku</em>.
                    </h2>
                    <p className="ih-verdict-text">
                      To je o <strong>{yearsEarlier} {rokov(yearsEarlier)} skôr</strong> než pri klasickom splácaní. Rezerva bude mať vtedy{" "}
                      <strong>{fmt(d.reserveAtCross)}</strong> a pokryje celý zostatok {fmt(d.debtAtCross)}. Rozhodnutie ostane na tebe: doplatiť, alebo
                      nechať rezervu rásť ďalej.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="ih-verdict-title">
                      Rezerva zostatok hypotéky <em>nedobehne</em> skôr, než ju splatíš.
                    </h2>
                    <p className="ih-verdict-text">
                      Pri {fmt(A.C)} mesačne a výnose {f1(A.yieldPct)} % ostáva rezerva celý čas nižšia než dlh. Skús vyšší mesačný vklad alebo
                      dlhší horizont. Rezerva má aj tak zmysel: je to tvoja poistka na horšie časy.
                    </p>
                  </>
                )}
              </div>

              <div className="ih-stats calc-reveal" style={st(1)}>
                <div>
                  <span className="ih-stat-label">Ušetríš na úrokoch</span>
                  <strong>{hasCross ? fmt(shownSaved) : "—"}</strong>
                  <small>{hasCross ? "ak v tom roku doplatíš" : "rezerva nedobehne zostatok"}</small>
                </div>
                <div>
                  <span className="ih-stat-label">Rezerva na konci</span>
                  <strong>{fmt(shownReserve)}</strong>
                  <small>{fmt(A.C)} mesačne pri {f1(A.yieldPct)} % p. a.</small>
                </div>
                <div>
                  <span className="ih-stat-label">Oproti zrýchlenému splácaniu</span>
                  <strong className={d.diff >= 0 ? "is-accent" : ""}>{fmtS(shownDiff)}</strong>
                  <small>majetok na konci po {d.N} rokoch</small>
                </div>
              </div>

              {/* graf */}
              <div className="ih-chart-block calc-reveal" style={st(2)}>
                <div className="ih-chart-head">
                  <h3>Rezerva vs. zostatok hypotéky</h3>
                  <div className="ih-legend">
                    <span><i className="ih-legend-ink" />Zostatok hypotéky</span>
                    <span><i className="ih-legend-accent" />Úverová rezerva</span>
                  </div>
                </div>
                <div
                  className="ih-chart-host"
                  ref={hostRef}
                  onMouseMove={(e) => onMove(e.clientX)}
                  onMouseLeave={() => setTip(null)}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    onMove(e.touches[0].clientX);
                  }}
                  onTouchEnd={() => setTip(null)}
                >
                  <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="ih-chart" aria-hidden>
                    <defs>
                      <linearGradient id="ih-gRes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#2a6647" stopOpacity="0.16" />
                        <stop offset="1" stopColor="#2a6647" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {G.grid.map((v) => (
                      <g key={v}>
                        <line className="ih-grid" x1={PL} x2={PR} y1={G.yS(v)} y2={G.yS(v)} />
                        <text className="ih-ax" x={PL - 10} y={G.yS(v) + 4} textAnchor="end">
                          {v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
                        </text>
                      </g>
                    ))}
                    <path d={G.area(d.res)} fill="url(#ih-gRes)" />
                    <path className="ih-ln" d={G.line(d.mort)} fill="none" stroke="#292420" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    <path className="ih-ln" d={G.line(d.res)} fill="none" stroke="#2a6647" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                    {hasCross ? (
                      <g>
                        <line x1={crossX} x2={crossX} y1={crossY} y2={PB} stroke="#292420" strokeWidth={1} strokeDasharray="2 4" opacity={0.4} />
                        <circle className="ih-pulse" cx={crossX} cy={crossY} r={6} fill="none" stroke="#2a6647" strokeWidth={1.5} />
                        <circle cx={crossX} cy={crossY} r={5.5} fill="#2a6647" stroke="#fffcf7" strokeWidth={2} />
                        <text className="ih-cross-t" x={labelLeft ? crossX - 14 : crossX + 14} y={crossY - 22} textAnchor={labelLeft ? "end" : "start"}>
                          {crossYear}. rok
                        </text>
                        <text className="ih-cross-s" x={labelLeft ? crossX - 14 : crossX + 14} y={crossY - 6} textAnchor={labelLeft ? "end" : "start"}>
                          rezerva {fmt(d.res[d.crossM])}
                        </text>
                      </g>
                    ) : null}
                    {G.ticks.map((yr) => (
                      <text key={yr} className="ih-ax" x={G.xS(yr * 12)} y={PB + 24} textAnchor="middle">
                        {yr === 0 ? "dnes" : `+${yr} r.`}
                      </text>
                    ))}
                    {tip ? (
                      <g>
                        <line x1={G.xS(tipM)} x2={G.xS(tipM)} y1={PT} y2={PB} stroke="rgba(41,36,32,0.3)" strokeWidth={1} />
                        <circle cx={G.xS(tipM)} cy={G.yS(d.mort[tipM])} r={5} fill="#292420" stroke="#fffcf7" strokeWidth={2} />
                        <circle cx={G.xS(tipM)} cy={G.yS(d.res[tipM])} r={5} fill="#2a6647" stroke="#fffcf7" strokeWidth={2} />
                      </g>
                    ) : null}
                  </svg>
                  {tip ? (
                    <div
                      className="ih-tooltip"
                      style={{
                        left: tip.x > (hostRef.current?.offsetWidth ?? 0) - 200 ? tip.x - 190 : tip.x + 14,
                        top: Math.max(0, tip.y - 76),
                      }}
                    >
                      <div className="ih-tt-d">{tipM === 0 ? "dnes" : `po ${yearOf(tipM)}. roku`}</div>
                      <div>Hypotéka <b>{fmt(d.mort[tipM])}</b></div>
                      <div>Rezerva <b>{fmt(d.res[tipM])}</b></div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* porovnanie */}
              <div className="ih-compare calc-reveal" style={st(3)}>
                <h3>Dva prístupy, rovnaký rozpočet {fmt(budget)} mesačne</h3>
                <ol className="ih-rows">
                  <li>
                    <div>
                      <span className="ih-row-t">Zrýchlené splácanie</span>
                      <span className="ih-row-s">rozdiel posielaš banke · splatené v {payoffYear}. roku, potom investuješ celý rozpočet</span>
                    </div>
                    <b>{fmt(d.netOverpay)}</b>
                  </li>
                  <li>
                    <div>
                      <span className="ih-row-t">Inteligentná hypotéka</span>
                      <span className="ih-row-s">rozdiel investuješ · rezerva {fmt(d.reserveEnd)} + nehnuteľnosť {fmt(d.houseEnd)}</span>
                    </div>
                    <b>{fmt(d.netSmart)}</b>
                  </li>
                  <li className="is-total">
                    <div>
                      <span className="ih-row-t">Rozdiel v majetku po {d.N} rokoch</span>
                      <span className="ih-row-s">
                        {d.diff >= 0
                          ? `výnos rezervy ${f1(A.yieldPct)} % je nad úrokom ${f1(A.rate)} %, investovanie rozdielu sa oplatí`
                          : `výnos ${f1(A.yieldPct)} % je pod úrokom ${f1(A.rate)} %, istá úspora na úrokoch vyhráva`}
                      </span>
                    </div>
                    <b className={d.diff >= 0 ? "is-accent" : ""}>{fmtS(d.diff)}</b>
                  </li>
                </ol>
                <p className="ih-assume">
                  Predpoklady: konštantný úrok, mesačné úročenie rezervy, rast ceny nehnuteľnosti
                  <span className="ih-assume-seg" role="group" aria-label="Rast ceny nehnuteľnosti">
                    {[2, 4, 6].map((g) => (
                      <button key={g} type="button" aria-pressed={A.growth === g} onClick={() => set("growth", g)}>{g} %</button>
                    ))}
                  </span>
                  ročne (rovnaký v oboch scenároch), bez daní a poplatkov. Výnos rezervy nie je garantovaný, úspora na úrokoch je istá.
                </p>
              </div>

              <div className="ih-cta calc-reveal" style={st(4)}>
                <p>Chceš to prebrať na svojich číslach? Prejdeme fixáciu, rezervu aj to, kedy sa doplatenie naozaj oplatí.</p>
                <a className="btn-primary ih-cta-btn" href={KONZULTACIA_URL} target="_blank" rel="noopener noreferrer" data-umami-event="click_konzultacia" data-umami-event-section="inteligentna-hypoteka">
                  {BONUSY_CTA_LABEL} <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </a>
              </div>

              <p className="calc-note calc-note--center ih-foot">
                Orientačný prepočet, nie investičné ani daňové odporúčanie. Odpovede sa ukladajú iba v tvojom prehliadači.
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default InteligentnaHypotekaCalculator;
