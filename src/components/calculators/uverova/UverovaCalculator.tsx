import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, ChevronDown, Plus, X } from "lucide-react";
import "../shared/calc-ui.css";
import "./uverova-calculator.css";
import { DEFAULT_INPUTS, LIMITS, MAX_ONE_TIMES, calMonth, compute, niceStep, oneTimeIndex, sanitize, type Inputs, type NumKey, type OneTime, type Schedule } from "./uverovaModel";
import { BONUSY_CTA_LABEL, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";

/**
 * Úverová kalkulačka 3.0 – krátky formulár vľavo, jeden pokojný výsledok vpravo.
 * Referencie (Refero): Wealthsimple (editoriálny minimalizmus, serifové číslo ako hrdina, hairline deliče, žiadne tiene),
 * Odin's Crow (vodorovné linky ako hlavná štruktúra namiesto kariet), Titan (disciplinovaná typografická hierarchia).
 * Jazyk /bonusy 2.0: ivory plocha na krémovom plátne, atrament, piesok, jedna zelená.
 */

const STORAGE_KEY = "jsm_uverova_v3";
const st = (i: number) => ({ "--i": i }) as CSSProperties;

const fmt = (n: number) => `${Math.round(Number.isFinite(n) ? n : 0).toLocaleString("sk-SK")}\u00a0€`;
const fmt2 = (n: number) => `${(Number.isFinite(n) ? n : 0).toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00a0€`;
const f2 = (n: number) => n.toLocaleString("sk-SK", { maximumFractionDigits: 2 });
const rokov = (y: number) => (y === 1 ? "rok" : y >= 2 && y <= 4 ? "roky" : "rokov");
const mesiacov = (m: number) => (m === 1 ? "mesiac" : m >= 2 && m <= 4 ? "mesiace" : "mesiacov");
const MONTHS = ["január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"];
const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "máj", "jún", "júl", "aug", "sep", "okt", "nov", "dec"];
const MONTHS_GEN = ["januára", "februára", "marca", "apríla", "mája", "júna", "júla", "augusta", "septembra", "októbra", "novembra", "decembra"];
const MONTHS_LOC = ["v januári", "vo februári", "v marci", "v apríli", "v máji", "v júni", "v júli", "v auguste", "v septembri", "v októbri", "v novembri", "v decembri"];
const dateOf = (d: { year: number; month: number }) => `${MONTHS[d.month - 1]} ${d.year}`;
const dateLoc = (d: { year: number; month: number }) => `${MONTHS_LOC[d.month - 1]} ${d.year}`;
const dateGen = (d: { year: number; month: number }) => `${MONTHS_GEN[d.month - 1]} ${d.year}`;
const yearsMonths = (m: number) => {
  const y = Math.floor(m / 12);
  const mm = m % 12;
  return [y > 0 ? `${y} ${rokov(y)}` : "", mm > 0 ? `${mm} ${mesiacov(mm)}` : ""].filter(Boolean).join(" a ") || "0 mesiacov";
};

const newOneTime = (years: number, i = 0): OneTime => ({ id: `ot-${Date.now().toString(36)}-${i}`, amount: 0, year: Math.min(years, 5 + i * 5), month: 6 });
const withRow = (d: Inputs): Inputs => (d.oneTimes.length ? d : { ...d, oneTimes: [newOneTime(d.years)] });

const loadSaved = (): Inputs => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return withRow(raw ? sanitize({ ...DEFAULT_INPUTS, ...(JSON.parse(raw) as Partial<Inputs>) }) : DEFAULT_INPUTS);
  } catch {
    return withRow(DEFAULT_INPUTS);
  }
};

/** Plynulé dobehnutie čísla k cieľu. */
function useCountUp(target: number, ms = 500): number {
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

/* ------------------------------------------------------------------ polia */

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  slider?: boolean;
  compact?: boolean;
  onChange: (v: number) => void;
};

const Field = ({ id, label, hint, unit, value, min, max, step, slider = true, compact = false, onChange }: FieldProps) => {
  const [text, setText] = useState<string | null>(null);
  const decimals = Math.max(0, (String(step).split(".")[1] ?? "").length);
  const clamp = (v: number) => Number(Math.max(min, Math.min(max, Number.isFinite(v) ? v : min)).toFixed(decimals));
  const shown = text ?? value.toLocaleString("sk-SK", { maximumFractionDigits: decimals });
  const p = `${((value - min) / (max - min)) * 100}%`;
  return (
    <div className={`uv-field${compact ? " is-compact" : ""}`}>
      <label className="calc-label" htmlFor={id}>
        {label}
        {hint ? <span className="calc-label-hint">{hint}</span> : null}
      </label>
      <div className="calc-input-wrap">
        <input
          id={id}
          className="calc-input calc-input--unit"
          type="text"
          inputMode="decimal"
          value={shown}
          onFocus={() => setText(String(value).replace(".", ","))}
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value.replace(/\s/g, "").replace(",", "."));
            if (Number.isFinite(v)) onChange(clamp(v));
          }}
          onBlur={() => setText(null)}
        />
        <span className="calc-input-unit" aria-hidden>{unit}</span>
      </div>
      {slider ? (
        <input
          type="range"
          className="calc-slider uv-slider"
          style={{ "--p": p } as CSSProperties}
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={`${label} (posuvník)`}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
        />
      ) : null}
    </div>
  );
};

const Select = ({ id, label, value, options, onChange }: { id: string; label: string; value: number; options: { value: number; label: string }[]; onChange: (v: number) => void }) => (
  <div className="uv-field is-compact">
    <label className="calc-label" htmlFor={id}>{label}</label>
    <div className="uv-select-wrap">
      <select id={id} className="calc-input uv-select" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="h-4 w-4 uv-select-chev" aria-hidden />
    </div>
  </div>
);

const Collapse = ({ title, meta, open, onToggle, children }: { title: string; meta: string; open: boolean; onToggle: () => void; children: ReactNode }) => (
  <>
    <button type="button" className="uv-collapse" aria-expanded={open} onClick={onToggle}>
      <span>{title}</span>
      <span className="uv-collapse-meta">{meta}</span>
      <ChevronDown className={`h-4 w-4 uv-chev${open ? " is-open" : ""}`} aria-hidden />
    </button>
    {open ? <div className="uv-advanced">{children}</div> : null}
  </>
);

/* ------------------------------------------------------------------ graf */

const W = 940;
const H = 340;
const PL = 62;
const PR = W - 20;
const PT = 26;
const PB = H - 40;

const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: i + 1, label: m }));
const MONTH_OPTIONS_SHORT = MONTHS_SHORT.map((m, i) => ({ value: i + 1, label: m }));

/* ------------------------------------------------------------------ komponent */

const UverovaCalculator = () => {
  const [A, setA] = useState<Inputs>(loadSaved);
  const [fixOpen, setFixOpen] = useState(() => A.fixYears > 0);
  const [tableOpen, setTableOpen] = useState(false);
  const [openYears, setOpenYears] = useState<Set<number>>(() => new Set());
  const [tip, setTip] = useState<{ x: number; y: number; m: number } | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(A));
    } catch {
      /* súkromný režim */
    }
  }, [A]);

  const setNum = (k: NumKey, v: number) => setA((s) => ({ ...s, [k]: v }));
  const r = useMemo(() => compute(A), [A]);
  const D = r.d;
  const S: Schedule = r.term;
  const shownPayment = useCountUp(r.payment);
  const interestPct = S.totalPaid > 0 ? (S.totalInterest / S.totalPaid) * 100 : 0;
  const principalPct = 100 - interestPct;
  const yearOptions = Array.from({ length: D.years }, (_, i) => ({ value: i + 1, label: `${i + 1}. rok` }));
  const startYearOptions = Array.from({ length: 6 }, (_, i) => DEFAULT_INPUTS.startYear - 1 + i).map((y) => ({ value: y, label: String(y) }));
  const activeOneTimes = D.oneTimes.filter((o) => o.amount > 0);

  const addOneTime = () => setA((s) => ({ ...s, oneTimes: [...s.oneTimes, newOneTime(s.years, s.oneTimes.length)] }));
  const updateOneTime = (id: string, patch: Partial<OneTime>) => setA((s) => ({ ...s, oneTimes: s.oneTimes.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  const removeOneTime = (id: string) => setA((s) => withRow({ ...s, oneTimes: s.oneTimes.filter((o) => o.id !== id) }));
  const reset = () => {
    setA(withRow(DEFAULT_INPUTS));
    setOpenYears(new Set());
    setFixOpen(false);
  };
  const toggleYear = (n: number) =>
    setOpenYears((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  /* geometria grafu */
  const G = useMemo(() => {
    const M = Math.max(1, r.base.months);
    const yMax = D.amount * 1.05;
    const step = niceStep(yMax / 4);
    const grid: number[] = [];
    for (let v = 0; v <= yMax + 1e-9; v += step) grid.push(v);
    const x = (m: number) => PL + (m / M) * (PR - PL);
    const y = (v: number) => PB - (v / yMax) * (PB - PT);
    const line = (bal: number[]) => bal.map((v, m) => `${m ? "L" : "M"}${x(m).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
    const area = (bal: number[]) => `${line(bal)} L${x(bal.length - 1).toFixed(1)} ${PB.toFixed(1)} L${PL.toFixed(1)} ${PB.toFixed(1)} Z`;
    const stepYr = D.years <= 12 ? 1 : D.years <= 24 ? 2 : 5;
    const ticks: number[] = [];
    for (let yy = 0; yy <= D.years; yy += stepYr) ticks.push(yy);
    if (ticks[ticks.length - 1] !== D.years) ticks.push(D.years);
    return { M, grid, x, y, line, area, ticks };
  }, [r.base.months, D.amount, D.years]);

  const onMove = (clientX: number) => {
    const svg = svgRef.current;
    const host = hostRef.current;
    if (!svg || !host) return;
    const rect = svg.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    const scale = rect.width / W;
    const lx = (clientX - rect.left) / scale;
    const m = Math.max(0, Math.min(G.M, Math.round(((lx - PL) / (PR - PL)) * G.M)));
    const v = Math.max(r.base.balance[m] ?? 0, S.balance[m] ?? 0);
    setTip({ x: G.x(m) * scale + (rect.left - hr.left), y: G.y(v) * scale + (rect.top - hr.top), m });
  };

  const balAt = (s: Schedule, m: number) => s.balance[Math.min(m, s.balance.length - 1)] ?? 0;
  const marks = activeOneTimes.map((o) => ({ ...o, m: oneTimeIndex(D, o) })).filter((o) => o.m <= S.months);
  const single = activeOneTimes.length === 1 ? activeOneTimes[0] : null;
  const extraLabel = single ? `${fmt(S.totalExtra)} ${dateLoc(calMonth(D, oneTimeIndex(D, single)))}` : `spolu ${fmt(S.totalExtra)}`;
  const heroSub = [
    fmt(D.amount),
    `${D.years} ${rokov(D.years)}`,
    `${f2(D.rate)} % p. a.`,
    `prvá splátka ${dateOf({ year: D.startYear, month: D.startMonth })}`,
    r.base.paymentAfterFix !== null ? `po fixácii ${fmt2(r.base.paymentAfterFix)}` : "",
  ].filter(Boolean);

  return (
    <div id="uv-root" className="calc-ui uv w-full font-sans">
      <div className="calc-body-shell">
        <div className="calc-page">
          <header className="calc-header calc-reveal" style={st(0)}>
            <span className="calc-eyebrow">Úverová kalkulačka</span>
            <h1 className="calc-title">
              Koľko ťa bude <em>stáť úver</em>?
            </h1>
            <p className="calc-subtitle">
              Zadaj sumu, úrok a splatnosť. Hneď vidíš splátku, preplatenie a deň, keď budeš bez dlhu. Potom skús mimoriadnu
              splátku v konkrétnom roku a mesiaci a pozri, čo urobí s koncom splácania.
            </p>
          </header>

          <div className="uv-layout">
            {/* ---------------------------------------------------------------- Formulár */}
            <aside className="uv-form calc-reveal" aria-label="Parametre úveru" style={st(1)}>
              <Field id="uv-amount" label="Výška úveru" unit="€" value={A.amount} {...LIMITS.amount} onChange={(v) => setNum("amount", v)} />
              <Field id="uv-rate" label="Úrok" hint="% p. a." unit="%" value={A.rate} {...LIMITS.rate} onChange={(v) => setNum("rate", v)} />
              <Field id="uv-years" label="Splatnosť" unit="rokov" value={A.years} {...LIMITS.years} onChange={(v) => setNum("years", v)} />
              <div className="uv-row">
                <Select id="uv-start-month" label="Prvá splátka" value={D.startMonth} options={MONTH_OPTIONS} onChange={(v) => setNum("startMonth", v)} />
                <Select id="uv-start-year" label="Rok" value={D.startYear} options={startYearOptions.some((o) => o.value === D.startYear) ? startYearOptions : [...startYearOptions, { value: D.startYear, label: String(D.startYear) }]} onChange={(v) => setNum("startYear", v)} />
              </div>

              <div className="uv-onetimes">
                <p className="uv-onetimes-title">
                  Mimoriadna splátka <span>voliteľné</span>
                </p>
                {D.oneTimes.map((o, i) => {
                  const cal = calMonth(D, oneTimeIndex(D, o));
                  const removable = D.oneTimes.length > 1;
                  return (
                    <div key={o.id} className={`uv-onetime${removable ? " has-x" : ""}`}>
                      <Field id={`uv-ot-${i}`} label="Suma" unit="€" value={o.amount} min={0} max={1000000} step={100} slider={false} compact onChange={(v) => updateOneTime(o.id, { amount: v })} />
                      <Select id={`uv-ot-year-${i}`} label="Kedy" value={o.year} options={yearOptions} onChange={(v) => updateOneTime(o.id, { year: v })} />
                      <Select id={`uv-ot-month-${i}`} label="Mesiac" value={o.month} options={MONTH_OPTIONS_SHORT} onChange={(v) => updateOneTime(o.id, { month: v })} />
                      {removable ? (
                        <button type="button" className="uv-onetime-x" aria-label="Odstrániť mimoriadnu splátku" onClick={() => removeOneTime(o.id)}>
                          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                        </button>
                      ) : null}
                      <small className="uv-onetime-cal">{o.amount > 0 ? `${fmt(o.amount)} ${dateLoc(cal)}` : `= ${dateOf(cal)}`}</small>
                    </div>
                  );
                })}
                {activeOneTimes.length > 0 && D.oneTimes.length < MAX_ONE_TIMES ? (
                  <button type="button" className="uv-add" onClick={addOneTime}>
                    <Plus className="h-4 w-4" strokeWidth={2} aria-hidden /> Pridať ďalšiu
                  </button>
                ) : null}
              </div>

              <Collapse title="Zmena úroku po fixácii" meta={D.fixYears > 0 ? `po ${D.fixYears} r. úrok ${f2(D.rateAfter)} %` : "voliteľné"} open={fixOpen} onToggle={() => setFixOpen((o) => !o)}>
                <div className="uv-row">
                  <Field id="uv-fix" label="Fixácia" hint="0 = bez zmeny" unit="rokov" value={A.fixYears} min={0} max={Math.max(0, D.years - 1)} step={1} slider={false} compact onChange={(v) => setNum("fixYears", v)} />
                  <Field id="uv-rate-after" label="Úrok po fixácii" unit="%" value={A.rateAfter} {...LIMITS.rateAfter} slider={false} compact onChange={(v) => setNum("rateAfter", v)} />
                </div>
              </Collapse>

              <div className="uv-form-foot">
                <button type="button" className="uv-reset" onClick={reset}>Začať odznova</button>
              </div>
            </aside>

            {/* ---------------------------------------------------------------- Výsledok */}
            <section className="uv-result calc-reveal" aria-label="Výsledok" style={st(2)}>
              <p className="uv-kicker">Mesačná splátka</p>
              <p className="uv-hero">
                <span className="uv-hero-value">{fmt2(shownPayment)}</span>
                <span className="uv-hero-unit">mesačne</span>
              </p>
              <p className="uv-hero-sub">
                {heroSub.map((part, i) => (
                  <span key={part} className={part.startsWith("prvá splátka") ? "uv-hero-sub-start" : undefined}>
                    {i > 0 ? <i aria-hidden>·</i> : null}
                    {part}
                  </span>
                ))}
              </p>

              {r.hasExtras ? (
                <div className="uv-verdict">
                  {r.monthsSaved > 0 ? (
                    <>
                      <b>
                        Mimoriadna splátka {extraLabel} skráti splácanie o {yearsMonths(r.monthsSaved)}.
                      </b>
                      <span>
                        Bez dlhu budeš {dateLoc(r.endTerm)} namiesto {dateGen(r.endBase)} a na úrokoch ušetríš <strong>{fmt(r.interestSaved)}</strong>.
                      </span>
                    </>
                  ) : (
                    <>
                      <b>Mimoriadna splátka {extraLabel} zníži úroky o {fmt(r.interestSaved)}.</b>
                      <span>Koniec splácania ostáva {dateLoc(r.endBase)}.</span>
                    </>
                  )}
                  <em>
                    Ak si radšej necháš pôvodnú splatnosť, splátka klesne na <strong>{fmt2(r.reduced.paymentEnd)}</strong> a ušetríš {fmt(r.interestSavedReduced)}.
                  </em>
                </div>
              ) : null}

              <dl className="uv-facts">
                <div>
                  <dt>Celkovo zaplatíš</dt>
                  <dd>{fmt(S.totalPaid)}</dd>
                  <small>{S.months} splátok{r.hasExtras ? ` + mimoriadna ${fmt(S.totalExtra)}` : ""}</small>
                </div>
                <div>
                  <dt>Z toho úroky</dt>
                  <dd>{fmt(S.totalInterest)}</dd>
                  <small>{r.hasExtras ? <span className="is-accent">o {fmt(r.interestSaved)} menej</span> : `${Math.round(interestPct)} % z toho, čo zaplatíš`}</small>
                </div>
                <div>
                  <dt>Bez dlhu</dt>
                  <dd>{dateOf(r.hasExtras ? r.endTerm : r.endBase)}</dd>
                  <small>{r.hasExtras && r.monthsSaved > 0 ? <span className="is-accent">o {yearsMonths(r.monthsSaved)} skôr</span> : yearsMonths(S.months)}</small>
                </div>
              </dl>

              <div className="uv-share" aria-label="Pomer istiny a úrokov">
                <div className="uv-share-bar" aria-hidden>
                  <i className="uv-share-ink" style={{ width: `${principalPct}%` }} />
                  <i className="uv-share-sand" style={{ width: `${interestPct}%` }} />
                </div>
                <div className="uv-share-legend">
                  <span><i className="uv-sw uv-sw-ink" />Istina {Math.round(principalPct)} %</span>
                  <span><i className="uv-sw uv-sw-sand" />Úroky {Math.round(interestPct)} %</span>
                </div>
              </div>

              {/* graf */}
              <div className="uv-chart-block">
                <div className="uv-chart-head">
                  <h3>Zostatok úveru v čase</h3>
                  <div className="uv-legend">
                    <span><i className="uv-legend-line uv-legend-accent" />{r.hasExtras ? "S mimoriadnou splátkou" : "Zostatok"}</span>
                    {r.hasExtras ? <span><i className="uv-legend-line uv-legend-ink" />Bez nej</span> : null}
                  </div>
                </div>
                <div
                  className="uv-chart-host"
                  ref={hostRef}
                  onMouseMove={(e) => onMove(e.clientX)}
                  onMouseLeave={() => setTip(null)}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    onMove(e.touches[0].clientX);
                  }}
                  onTouchEnd={() => setTip(null)}
                >
                  <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="uv-chart" aria-hidden>
                    <defs>
                      <linearGradient id="uv-gBal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#2a6647" stopOpacity="0.14" />
                        <stop offset="1" stopColor="#2a6647" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {G.grid.map((v) => (
                      <g key={v}>
                        <line className="uv-grid" x1={PL} x2={PR} y1={G.y(v)} y2={G.y(v)} />
                        <text className="uv-ax" x={PL - 10} y={G.y(v) + 4} textAnchor="end">{v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}</text>
                      </g>
                    ))}
                    <path d={G.area(S.balance)} fill="url(#uv-gBal)" />
                    {r.hasExtras ? <path d={G.line(r.base.balance)} fill="none" stroke="#292420" strokeWidth={1.75} strokeDasharray="5 5" strokeLinecap="round" opacity={0.7} /> : null}
                    <path d={G.line(S.balance)} fill="none" stroke="#2a6647" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                    {D.fixYears > 0 && D.fixYears < D.years ? (
                      <g>
                        <line x1={G.x(D.fixYears * 12)} x2={G.x(D.fixYears * 12)} y1={PT} y2={PB} stroke="#292420" strokeWidth={1} strokeDasharray="2 4" opacity={0.45} />
                        <text className="uv-ax" x={G.x(D.fixYears * 12) + 6} y={PT + 12} textAnchor="start">koniec fixácie</text>
                      </g>
                    ) : null}
                    {marks.map((o) => (
                      <circle key={o.id} cx={G.x(o.m)} cy={G.y(balAt(S, o.m))} r={6} fill="#2a6647" stroke="#fffcf7" strokeWidth={2} />
                    ))}
                    {G.ticks.map((yy) => (
                      <text key={yy} className="uv-ax" x={G.x(yy * 12)} y={PB + 24} textAnchor="middle">
                        {String(calMonth(D, yy * 12).year)}
                      </text>
                    ))}
                    {tip ? (
                      <g>
                        <line x1={G.x(tip.m)} x2={G.x(tip.m)} y1={PT} y2={PB} stroke="rgba(41,36,32,0.3)" strokeWidth={1} />
                        <circle cx={G.x(tip.m)} cy={G.y(balAt(S, tip.m))} r={5} fill="#2a6647" stroke="#fffcf7" strokeWidth={2} />
                      </g>
                    ) : null}
                  </svg>
                  {tip ? (
                    <div className="uv-tooltip" style={{ left: tip.x > (hostRef.current?.offsetWidth ?? 0) - 220 ? tip.x - 210 : tip.x + 14, top: Math.max(0, tip.y - 80) }}>
                      <div className="uv-tt-d">{tip.m === 0 ? "začiatok" : dateOf(calMonth(D, tip.m))}</div>
                      <div>Zostatok <b>{fmt(balAt(S, tip.m))}</b></div>
                      {r.hasExtras ? <div>Bez mimoriadnej <b>{fmt(balAt(r.base, tip.m))}</b></div> : null}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* splátkový kalendár */}
              <button type="button" className="uv-collapse uv-collapse--table" aria-expanded={tableOpen} onClick={() => setTableOpen((o) => !o)}>
                <span>Splátkový kalendár</span>
                <span className="uv-collapse-meta">{tableOpen ? "skryť" : "zobraziť"}</span>
                <ChevronDown className={`h-4 w-4 uv-chev${tableOpen ? " is-open" : ""}`} aria-hidden />
              </button>
              {tableOpen ? (
                <div className="uv-table-wrap">
                  <table className="uv-table">
                    <thead>
                      <tr>
                        <th>Obdobie</th>
                        <th>Splátky</th>
                        <th>Istina</th>
                        <th>Úroky</th>
                        {r.hasExtras ? <th>Mimoriadna</th> : null}
                        <th>Zostatok</th>
                      </tr>
                    </thead>
                    <tbody>
                      {S.rows.map((row) => (
                        <RowGroup key={row.n} row={row} open={openYears.has(row.n)} onToggle={() => toggleYear(row.n)} hasExtras={r.hasExtras} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="uv-cta">
                <p>Chceš vedieť, či sa oplatí refinancovať, skrátiť splatnosť alebo radšej investovať rozdiel? Prejdeme to na tvojich číslach.</p>
                <a className="btn-primary uv-cta-btn" href={KONZULTACIA_URL} target="_blank" rel="noopener noreferrer" data-umami-event="click_konzultacia" data-umami-event-section="uverova">
                  {BONUSY_CTA_LABEL} <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </a>
              </div>
            </section>
          </div>

          <p className="calc-note calc-note--center uv-foot">
            Orientačný prepočet anuitného úveru: konštantný úrok v rámci fixácie, mesačné úročenie, mimoriadna splátka ide celá do istiny.
            Banky môžu počítať úrok z presného počtu dní a účtovať vlastné poplatky. Hodnoty sa ukladajú iba v tvojom prehliadači.
          </p>
        </div>
      </div>
    </div>
  );
};

/** Riadok roka v splátkovom kalendári s rozbalením mesiacov. */
const RowGroup = ({ row, open, onToggle, hasExtras }: { row: Schedule["rows"][number]; open: boolean; onToggle: () => void; hasExtras: boolean }) => (
  <>
    <tr className={`uv-yr${open ? " is-open" : ""}`} onClick={onToggle}>
      <td>
        <ChevronDown className={`h-3.5 w-3.5 uv-yr-chev${open ? " is-open" : ""}`} aria-hidden /> {row.n}. rok <small>{row.calYear}</small>
      </td>
      <td>{fmt(row.payment)}</td>
      <td>{fmt(row.principal)}</td>
      <td>{fmt(row.interest)}</td>
      {hasExtras ? <td className={row.extra > 0 ? "is-accent" : ""}>{row.extra > 0 ? fmt(row.extra) : "—"}</td> : null}
      <td><strong>{fmt(row.balance)}</strong></td>
    </tr>
    {open
      ? row.months.map((m) => (
          <tr key={m.m} className="uv-mo">
            <td>{MONTHS_SHORT[m.month - 1]} {m.year}</td>
            <td>{fmt2(m.payment)}</td>
            <td>{fmt2(m.principal)}</td>
            <td>{fmt2(m.interest)}</td>
            {hasExtras ? <td className={m.extra > 0 ? "is-accent" : ""}>{m.extra > 0 ? fmt(m.extra) : "—"}</td> : null}
            <td>{fmt(m.balance)}</td>
          </tr>
        ))
      : null}
  </>
);

export default UverovaCalculator;
