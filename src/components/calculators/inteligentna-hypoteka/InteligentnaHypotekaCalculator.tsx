import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import "../shared/calc-ui.css";
import "./inteligentna-hypoteka.css";
import { DEFAULT_INPUTS, LIMITS, compute, niceStep, type Inputs } from "./inteligentnaHypotekaModel";

/**
 * Inteligentná hypotéka – „plať minimum, rozdiel investuj“.
 * Jazyk /bonusy 2.0: krémové plátno, jeden plochý hnedý panel s prognózou, výrokové vstupy so slidermi,
 * SVG graf s dokreslením čiar a pulzujúcim prienikom, porovnanie so zrýchleným splácaním.
 */

const STORAGE_KEY = "jsm_inteligentna_hypoteka";
const st = (i: number) => ({ "--i": i }) as CSSProperties;

const fmt = (n: number) => `${Math.round(Number.isFinite(n) ? n : 0).toLocaleString("sk-SK")}\u00a0€`;
const fmtS = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n)).toLocaleString("sk-SK")}\u00a0€`;
const f1 = (n: number) => n.toLocaleString("sk-SK", { maximumFractionDigits: 2 });
const yearOf = (m: number) => Math.ceil(m / 12);
const yearsMonths = (m: number) => {
  const y = Math.floor(m / 12);
  const mo = m % 12;
  if (y === 0) return `${mo} mes.`;
  return mo === 0 ? `${y} r.` : `${y} r. ${mo} mes.`;
};

const loadInputs = (): Inputs => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INPUTS;
    const parsed = JSON.parse(raw) as Partial<Inputs>;
    const out = { ...DEFAULT_INPUTS, ...parsed };
    (Object.keys(LIMITS) as (keyof Inputs)[]).forEach((k) => {
      const v = Number(out[k]);
      out[k] = Number.isFinite(v) ? Math.min(LIMITS[k].max, Math.max(LIMITS[k].min, v)) : DEFAULT_INPUTS[k];
    });
    return out;
  } catch {
    return DEFAULT_INPUTS;
  }
};

/** Plynulé dobehnutie čísla k cieľu (jemný pohyb pri zmene vstupov). */
function useCountUp(target: number, ms = 550): number {
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

/* ------------------------------------------------------------------ vstup: výrok + slider */

type SliderFieldProps = {
  label: string;
  hint?: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
};

const SliderField = ({ label, hint, unit, value, min, max, step, onChange }: SliderFieldProps) => {
  const [editing, setEditing] = useState(false);
  const decimals = Math.max(0, (String(step).split(".")[1] ?? "").length);
  const clamp = (v: number) => {
    const c = Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));
    return Number(c.toFixed(decimals));
  };
  const shown = editing
    ? String(value).replace(".", ",")
    : value.toLocaleString("sk-SK", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  const p = `${((value - min) / (max - min)) * 100}%`;
  return (
    <div className="ih-field">
      <div className="ih-field-top">
        <label className="calc-label">
          <span>{label}</span>
          {hint ? <span className="calc-label-hint">{hint}</span> : null}
        </label>
        <div className="ih-val">
          <input
            type="text"
            inputMode="decimal"
            value={shown}
            aria-label={label}
            onFocus={() => setEditing(true)}
            onBlur={(e) => {
              setEditing(false);
              onChange(clamp(Number(e.target.value.replace(/\s/g, "").replace(",", "."))));
            }}
            onChange={(e) => {
              const v = Number(e.target.value.replace(/[^0-9.,-]/g, "").replace(",", "."));
              if (Number.isFinite(v)) onChange(clamp(v));
            }}
          />
          <span className="ih-unit" aria-hidden>{unit}</span>
        </div>
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
    </div>
  );
};

/* ------------------------------------------------------------------ graf */

const W = 940;
const H = 470;
const PL = 60;
const PR = W - 122;
const PT = 44;
const PB = H - 42;

/* ------------------------------------------------------------------ komponent */

const InteligentnaHypotekaCalculator = () => {
  const [S, setS] = useState<Inputs>(loadInputs);
  const [tip, setTip] = useState<{ x: number; y: number; m: number } | null>(null);
  const [openTable, setOpenTable] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drawnRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
    } catch {
      /* súkromný režim */
    }
  }, [S]);

  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setS((s) => ({ ...s, [k]: v }));
  const d = useMemo(() => compute(S), [S]);
  const hasCross = d.crossM >= 0;
  const crossYear = hasCross ? yearOf(d.crossM) : 0;
  const yearsEarlier = hasCross ? Math.round(d.monthsEarlier / 12) : 0;
  const shownDiff = useCountUp(d.diff);
  const shownReserve = useCountUp(d.reserveAtCross);
  const shownSaved = useCountUp(d.interestSaved);

  /* geometria grafu */
  const G = useMemo(() => {
    const yMax = Math.max(d.houseEnd, d.mort[0], d.reserveEnd) * 1.08 || 1;
    const xS = (m: number) => PL + (m / d.n) * (PR - PL);
    const yS = (v: number) => PB - (v / yMax) * (PB - PT);
    const line = (arr: number[]) => arr.map((v, m) => `${m ? "L" : "M"}${xS(m).toFixed(1)} ${yS(v).toFixed(1)}`).join(" ");
    const area = (arr: number[]) => `${line(arr)} L${PR.toFixed(1)} ${PB.toFixed(1)} L${PL.toFixed(1)} ${PB.toFixed(1)} Z`;
    const step = niceStep(yMax / 4);
    const grid: number[] = [];
    for (let v = 0; v <= yMax; v += step) grid.push(v);
    const stepYr = d.N <= 12 ? 2 : 5;
    const ticks: number[] = [];
    for (let yr = 0; yr < d.N; yr += stepYr) ticks.push(yr);
    ticks.push(d.N);
    return { yMax, xS, yS, line, area, grid, ticks };
  }, [d]);

  /* dokreslenie čiar pri prvom zobrazení */
  useEffect(() => {
    if (drawnRef.current) return;
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
      p.style.transition = `stroke-dashoffset 1.1s cubic-bezier(0.22, 0.61, 0.36, 1) ${i * 120}ms`;
      p.style.strokeDashoffset = "0";
      timers.push(
        window.setTimeout(() => {
          p.style.transition = "";
          p.style.strokeDasharray = "";
          p.style.strokeDashoffset = "";
        }, 1300 + i * 120),
      );
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const onMove = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const host = hostRef.current;
    if (!svg || !host) return;
    const r = svg.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    const scale = r.width / W;
    const lx = (clientX - r.left) / scale;
    let m = Math.round(((lx - PL) / (PR - PL)) * d.n);
    m = Math.max(0, Math.min(d.n, m));
    const cx = G.xS(m) * scale + (r.left - hr.left);
    const topV = Math.max(d.mort[m], d.res[m], d.house[m]);
    const cy = G.yS(topV) * scale + (r.top - hr.top);
    setTip({ x: cx, y: cy, m });
    void clientY;
  };

  const crossX = hasCross ? G.xS(d.crossM) : 0;
  const crossY = hasCross ? G.yS(d.res[d.crossM]) : 0;
  const pillW = 128;
  const pillH = 42;
  let pillX = crossX - pillW - 14;
  if (pillX < PL + 4) pillX = crossX + 16;
  let pillY = crossY - pillH - 16;
  if (pillY < PT) pillY = crossY + 18;

  const badgeY = (v: number) => Math.min(PB - 8, Math.max(PT + 12, G.yS(v)));
  const endBadges = [
    { y: badgeY(d.houseEnd), big: fmt(d.houseEnd), small: "nehnuteľnosť", color: "#8f8467" },
    { y: badgeY(d.reserveEnd), big: fmt(d.reserveEnd), small: "rezerva", color: "#2a6647" },
  ];
  // rozostup koncových popiskov, aby sa neprekrývali
  if (Math.abs(endBadges[0].y - endBadges[1].y) < 30) {
    const upper = endBadges[0].y < endBadges[1].y ? 0 : 1;
    endBadges[upper].y = endBadges[1 - upper].y - 30;
  }

  const budget = d.M + S.C;
  const payoffYear = yearOf(d.payoffM);
  const savedByOverpay = Math.max(0, d.interest - d.interestA);
  const tipM = tip?.m ?? 0;

  return (
    <div id="ih-root" className="calc-ui ih w-full font-sans">
      <div className="calc-body-shell">
        <div className="calc-page">
          <header className="calc-header calc-reveal" style={st(0)}>
            <span className="calc-eyebrow">Inteligentná hypotéka</span>
            <h1 className="calc-title">
              Plať minimum,<br />
              <em>rozdiel investuj.</em>
            </h1>
            <p className="calc-subtitle">
              Namiesto zrýchleného splácania si buduješ úverovú rezervu. Uvidíš, v ktorom roku dobehne
              zostatok hypotéky, kedy ju môžeš doplatiť skôr a o koľko budeš bohatší.
            </p>
          </header>

          {/* ═══ Prognóza: jeden plochý hnedý panel ═══ */}
          <section className="ih-hero calc-reveal" aria-label="Prognóza" style={st(1)}>
            <div className="ih-hero-main">
              <p className="ih-kicker">Naša prognóza</p>
              {hasCross ? (
                <>
                  <p className="ih-hero-label">
                    Pri <strong>{fmt(S.C)} mesačne</strong> do rezervy s výnosom <strong>{f1(S.yieldPct)}&nbsp;%</strong> môžeš
                    hypotéku doplatiť už v
                  </p>
                  <p className="ih-hero-value">
                    <span>{crossYear}. roku</span>
                    <em>o {yearsEarlier} {yearsEarlier === 1 ? "rok" : yearsEarlier < 5 ? "roky" : "rokov"} skôr</em>
                  </p>
                </>
              ) : (
                <>
                  <p className="ih-hero-label">
                    Pri týchto vstupoch rezerva zostatok hypotéky nedobehne skôr, než ju splatíš klasicky.
                  </p>
                  <p className="ih-hero-value">
                    <span>{d.N} rokov</span>
                    <em>skús vyššiu rezervu alebo výnos</em>
                  </p>
                </>
              )}
              <div className="ih-hero-metrics">
                <div>
                  <span>Rezerva v tom roku</span>
                  <strong>{hasCross ? fmt(shownReserve) : "—"}</strong>
                  <small>{hasCross ? `pokryje zostatok ${fmt(d.debtAtCross)}` : "nedobehne zostatok"}</small>
                </div>
                <div>
                  <span>Ušetríš na úrokoch</span>
                  <strong>{hasCross ? fmt(shownSaved) : "—"}</strong>
                  <small>{hasCross ? "ak vtedy hypotéku doplatíš" : "úroky spolu " + fmt(d.interest)}</small>
                </div>
                <div>
                  <span>Mesačný rozpočet</span>
                  <strong>{fmt(budget)}</strong>
                  <small>splátka {fmt(d.M)} + rezerva {fmt(S.C)}</small>
                </div>
              </div>
            </div>

            <div className={`ih-compare ${d.diff >= 0 ? "is-pos" : "is-neg"}`}>
              <span className="ih-compare-kicker">Inteligentná vs. zrýchlené splácanie</span>
              <span className="ih-compare-value">{fmtS(shownDiff)}</span>
              <span className="ih-compare-text">
                {d.diff >= 0
                  ? "o toľko si na konci bohatší, keď rozdiel investuješ namiesto posielania banke"
                  : "o toľko skončíš horšie; pri tomto výnose vyhráva istá úspora na úrokoch"}
              </span>
              <div className="ih-compare-rows">
                <div><span>Inteligentná hypotéka</span><b>{fmt(d.netSmart)}</b></div>
                <div><span>Zrýchlené splácanie</span><b>{fmt(d.netOverpay)}</b></div>
              </div>
            </div>
          </section>

          <div className="ih-layout">
            {/* ═══ Vstupy ═══ */}
            <aside className="ih-inputs calc-reveal" aria-label="Vstupy" style={st(2)}>
              <div className="ih-inputs-head">
                <h2 className="calc-panel-title">Tvoje čísla</h2>
                <p className="calc-panel-sub">Posuň alebo prepíš. Všetko sa prepočíta hneď.</p>
              </div>

              <section className="ih-group">
                <p className="ih-group-title">Hypotéka</p>
                <SliderField label="Výška hypotéky" unit="€" value={S.P} {...LIMITS.P} onChange={(v) => set("P", v)} />
                <SliderField label="Úroková sadzba" unit="% p. a." value={S.rate} {...LIMITS.rate} onChange={(v) => set("rate", v)} />
                <SliderField label="Doba splácania" unit="rokov" value={S.years} {...LIMITS.years} onChange={(v) => set("years", v)} />
                <p className="ih-note">
                  Splátka <strong>{fmt(d.M)} / mes.</strong> · úroky za celú dobu <strong>{fmt(d.interest)}</strong>
                </p>
              </section>

              <section className="ih-group">
                <p className="ih-group-title">Úverová rezerva</p>
                <SliderField label="Mesačne do rezervy" hint="namiesto mimoriadnej splátky" unit="€ / mes." value={S.C} {...LIMITS.C} onChange={(v) => set("C", v)} />
                <SliderField label="Výnos rezervy" hint="ETF portfólio, dlhodobo" unit="% p. a." value={S.yieldPct} {...LIMITS.yieldPct} onChange={(v) => set("yieldPct", v)} />
                <SliderField label="Rast ceny nehnuteľnosti" unit="% p. a." value={S.growth} {...LIMITS.growth} onChange={(v) => set("growth", v)} />
                <p className="ih-note">
                  Rezerva ostáva tvoja a likvidná. Ty rozhoduješ, kedy hypotéku doplatíš, banka nie.
                </p>
              </section>

              <button type="button" className="ih-reset" onClick={() => setS(DEFAULT_INPUTS)}>
                Vrátiť predvolené hodnoty
              </button>
            </aside>

            {/* ═══ Graf a porovnanie ═══ */}
            <section className="ih-result calc-reveal" aria-label="Vývoj v čase" style={st(3)}>
              <div className="ih-chart-head">
                <h2 className="calc-panel-title">Kedy rezerva dobehne hypotéku</h2>
                <span className="ih-chart-sub">prejdi prstom po grafe</span>
              </div>
              <div className="calc-legend ih-legend">
                <span className="calc-legend-item"><span className="calc-legend-dot" style={{ background: "#292420" }} />Zostatok hypotéky</span>
                <span className="calc-legend-item"><span className="calc-legend-dot" style={{ background: "#2a6647" }} />Úverová rezerva</span>
                <span className="calc-legend-item"><span className="calc-legend-dot ih-dot-dash" />Hodnota nehnuteľnosti</span>
              </div>

              <div
                className="ih-chart-host"
                ref={hostRef}
                onMouseMove={(e) => onMove(e.clientX, e.clientY)}
                onMouseLeave={() => setTip(null)}
                onTouchMove={(e) => {
                  e.preventDefault();
                  onMove(e.touches[0].clientX, e.touches[0].clientY);
                }}
                onTouchEnd={() => setTip(null)}
              >
                <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="ih-chart" aria-hidden>
                  <defs>
                    <linearGradient id="ih-gRes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#2a6647" stopOpacity="0.18" />
                      <stop offset="1" stopColor="#2a6647" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="ih-gDebt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#292420" stopOpacity="0.08" />
                      <stop offset="1" stopColor="#292420" stopOpacity="0" />
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
                  <line x1={PL} x2={PR} y1={PB} y2={PB} stroke="rgba(41,36,32,0.22)" strokeWidth={1.5} />

                  <path d={G.area(d.mort)} fill="url(#ih-gDebt)" />
                  <path d={G.area(d.res)} fill="url(#ih-gRes)" />
                  <path className="ih-ln ih-ln--house" d={G.line(d.house)} fill="none" stroke="#8f8467" strokeWidth={2.2} strokeLinecap="round" strokeDasharray="6 5" />
                  <path className="ih-ln" d={G.line(d.mort)} fill="none" stroke="#292420" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  <path className="ih-ln" d={G.line(d.res)} fill="none" stroke="#2a6647" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />

                  <circle cx={G.xS(0)} cy={G.yS(d.mort[0])} r={5} fill="#292420" />

                  {endBadges.map((b) => (
                    <g key={b.small}>
                      <circle cx={PR} cy={G.yS(b.small === "rezerva" ? d.reserveEnd : d.houseEnd)} r={4.5} fill={b.color} />
                      <text className="ih-end-b" x={PR + 12} y={b.y - 1} fill={b.color}>{b.big}</text>
                      <text className="ih-end-s" x={PR + 12} y={b.y + 13}>{b.small}</text>
                    </g>
                  ))}
                  <text className="ih-end-b" x={PR + 12} y={PB - 4} fill="#292420">0 €</text>
                  <text className="ih-end-s" x={PR + 12} y={PB + 10}>splatené</text>

                  {hasCross ? (
                    <g className="ih-cross">
                      <line x1={crossX} x2={crossX} y1={crossY} y2={PB} stroke="#2a6647" strokeWidth={1} strokeDasharray="2 3" opacity={0.55} />
                      <circle className="ih-pulse" cx={crossX} cy={crossY} r={6} fill="none" stroke="#2a6647" strokeWidth={2} />
                      <circle cx={crossX} cy={crossY} r={6} fill="#2a6647" stroke="#fffcf7" strokeWidth={2} />
                      <g transform={`translate(${pillX.toFixed(1)}, ${pillY.toFixed(1)})`}>
                        <rect width={pillW} height={pillH} rx={11} fill="#2a6647" />
                        <text className="ih-pill-s" x={12} y={16}>{crossYear}. rok · prienik</text>
                        <text className="ih-pill-b" x={12} y={33}>{fmt(d.res[d.crossM])}</text>
                      </g>
                    </g>
                  ) : null}

                  {G.ticks.map((yr) => (
                    <text key={yr} className="ih-ax" x={G.xS(yr * 12)} y={PB + 22} textAnchor="middle">{yr}</text>
                  ))}
                  <text className="ih-axlab" x={(PL + PR) / 2} y={H - 4} textAnchor="middle">roky</text>

                  {tip ? (
                    <g>
                      <line x1={G.xS(tipM)} x2={G.xS(tipM)} y1={PT} y2={PB} stroke="rgba(41,36,32,0.35)" strokeWidth={1.5} strokeDasharray="5 4" />
                      <circle cx={G.xS(tipM)} cy={G.yS(d.mort[tipM])} r={5.5} fill="#292420" stroke="#fffcf7" strokeWidth={2} />
                      <circle cx={G.xS(tipM)} cy={G.yS(d.res[tipM])} r={5.5} fill="#2a6647" stroke="#fffcf7" strokeWidth={2} />
                    </g>
                  ) : null}
                </svg>

                {tip ? (
                  <div
                    className="ih-tooltip"
                    style={{
                      left: tip.x > (hostRef.current?.offsetWidth ?? 0) - 220 ? tip.x - 210 : tip.x + 16,
                      top: Math.max(0, tip.y - 84),
                    }}
                  >
                    <div className="ih-tt-d">{tipM === 0 ? "dnes" : `po ${yearsMonths(tipM)}`}</div>
                    <div><span className="ih-tt-dot" style={{ background: "#f3e9dd" }} />Hypotéka: <b>{fmt(d.mort[tipM])}</b></div>
                    <div><span className="ih-tt-dot" style={{ background: "#8fd4b4" }} />Rezerva: <b>{fmt(d.res[tipM])}</b></div>
                    <div><span className="ih-tt-dot" style={{ background: "#d9b15c" }} />Nehnuteľnosť: <b>{fmt(d.house[tipM])}</b></div>
                    <div className={`ih-tt-diff ${d.res[tipM] - d.mort[tipM] >= 0 ? "is-pos" : ""}`}>
                      rezerva − hypotéka: <b>{fmtS(d.res[tipM] - d.mort[tipM])}</b>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="ih-kpis">
                <div className="ih-kpi">
                  <span className="calc-stat-label">Mesačná splátka</span>
                  <span className="calc-stat-value">{fmt(d.M)}</span>
                  <span className="calc-stat-sub">+ {fmt(S.C)} do rezervy mimo splátky</span>
                </div>
                <div className="ih-kpi">
                  <span className="calc-stat-label">Úroky pri klasickom splácaní</span>
                  <span className="calc-stat-value ih-neg">−{fmt(d.interest)}</span>
                  <span className="calc-stat-sub">koľko zaplatíš banke navyše</span>
                </div>
                <div className="ih-kpi">
                  <span className="calc-stat-label">Rezerva na konci</span>
                  <span className="calc-stat-value ih-pos">{fmt(d.reserveEnd)}</span>
                  <span className="calc-stat-sub">{fmt(S.C)} / mes. pri {f1(S.yieldPct)} % p. a.</span>
                </div>
                <div className="ih-kpi ih-kpi--accent">
                  <span className="calc-stat-label">Majetok na konci</span>
                  <span className="calc-stat-value">{fmt(d.netSmart)}</span>
                  <span className="calc-stat-sub">nehnuteľnosť {fmt(d.houseEnd)} + rezerva</span>
                </div>
              </div>

              {/* porovnanie */}
              <div className="ih-cmp">
                <div className="ih-cmp-head">
                  <h3>Dva prístupy, rovnaký rozpočet {fmt(budget)} mesačne</h3>
                  <p>Vľavo posielaš rozdiel banke ako mimoriadnu splátku. Vpravo ho investuješ do rezervy a hypotéku splácaš minimom.</p>
                </div>
                <div className="ih-cmp-row">
                  <div className="ih-cmp-col is-alt">
                    <span className="ih-cmp-lab">Zrýchlené splácanie</span>
                    <span className="ih-cmp-amt">{fmt(d.netOverpay)}</span>
                    <small>hypotéka splatená v {payoffYear}. roku, potom investuješ celý rozpočet</small>
                  </div>
                  <div className="ih-cmp-col">
                    <span className="ih-cmp-lab">Inteligentná hypotéka</span>
                    <span className="ih-cmp-amt">{fmt(d.netSmart)}</span>
                    <small>nehnuteľnosť {fmt(d.houseEnd)} + rezerva {fmt(d.reserveEnd)}</small>
                  </div>
                  <div className={`ih-cmp-diff ${d.diff >= 0 ? "is-pos" : "is-neg"}`}>
                    <span className="ih-cmp-lab">Rozdiel</span>
                    <span className="ih-cmp-amt">{fmtS(d.diff)}</span>
                    <small>majetok na konci</small>
                  </div>
                </div>
                <ul className="ih-insights">
                  {d.diff >= 0 ? (
                    <li className="is-good">
                      <b>Výnos rezervy {f1(S.yieldPct)} % je nad úrokom hypotéky {f1(S.rate)} %.</b> Investovanie rozdielu ťa za {d.N} rokov
                      spraví o <b>{fmt(Math.abs(d.diff))}</b> bohatším. Cenou je neistota, výnos nie je garantovaný a cestou kolíše.
                    </li>
                  ) : (
                    <li className="is-warn">
                      <b>Pri výnose {f1(S.yieldPct)} % pod úrokom {f1(S.rate)} % vyhráva istota.</b> Zrýchlené splácanie ušetrí na úrokoch{" "}
                      <b>{fmt(savedByOverpay)}</b> a skončíš o <b>{fmt(Math.abs(d.diff))}</b> lepšie.
                    </li>
                  )}
                  {hasCross ? (
                    <li className="is-good">
                      <b>Od {crossYear}. roku máš voľbu.</b> Rezerva {fmt(d.reserveAtCross)} pokryje zostatok {fmt(d.debtAtCross)}: hypotéku môžeš
                      doplatiť a ušetriť <b>{fmt(d.interestSaved)}</b> na úrokoch, alebo ju nechať rásť ďalej.
                    </li>
                  ) : (
                    <li className="is-warn">
                      <b>Rezerva zostatok nedobehne.</b> Pri {fmt(S.C)} mesačne a {f1(S.yieldPct)} % je stále nižšia než dlh. Skús vyšší
                      vklad, dlhší horizont alebo realistickejší výnos.
                    </li>
                  )}
                  <li>
                    <b>Rezerva je tvoja poistka.</b> Pri strate príjmu alebo vyššom úroku po fixácii máš z čoho platiť. Mimoriadna splátka
                    poslaná banke sa už vrátiť nedá.
                  </li>
                </ul>
              </div>

              {/* rozpis po rokoch */}
              <div className="ih-table-block">
                <button type="button" className="ih-collapse" aria-expanded={openTable} onClick={() => setOpenTable(!openTable)}>
                  <span>Rozpis po rokoch</span>
                  <span className="ih-collapse-action">
                    {openTable ? "Skryť" : "Zobraziť"} <ChevronDown className="h-3.5 w-3.5" style={{ transform: openTable ? "rotate(180deg)" : undefined }} aria-hidden />
                  </span>
                </button>
                {openTable ? (
                  <div className="ih-table-wrap">
                    <table className="ih-table">
                      <thead>
                        <tr><th>Rok</th><th>Zostatok hypotéky</th><th>Rezerva</th><th>Nehnuteľnosť</th><th>Rezerva − zostatok</th></tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: d.N + 1 }, (_, y) => {
                          const m = y * 12;
                          const gap = d.res[m] - d.mort[m];
                          return (
                            <tr key={y} className={hasCross && y === crossYear ? "is-current" : ""}>
                              <td>{y === 0 ? "dnes" : `+${y}`}</td>
                              <td>{fmt(d.mort[m])}</td>
                              <td>{fmt(d.res[m])}</td>
                              <td>{fmt(d.house[m])}</td>
                              <td className={gap >= 0 ? "ih-pos" : "ih-neg"}>{fmtS(gap)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <p className="calc-note calc-note--center ih-foot">
            Orientačný prepočet. Výnos rezervy nie je garantovaný a v čase kolíše, modelujeme ho konštantným ročným výnosom s mesačným
            pripisovaním. Úspora na úrokoch pri zrýchlenom splácaní je naopak istá. Konštantná úroková sadzba, bez poplatkov a daní.
            Nejde o investičné ani daňové odporúčanie. Vstupy sa ukladajú iba v tvojom prehliadači.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InteligentnaHypotekaCalculator;
