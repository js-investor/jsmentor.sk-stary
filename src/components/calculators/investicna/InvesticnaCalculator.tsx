import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, ChevronDown, Plus } from "lucide-react";
import "../shared/calc-ui.css";
import "./investicna-calculator.css";
import { DEFAULT_INPUTS, LIMITS, MAX_EVENTS, compute, niceStep, sanitize, type InvEvent, type Inputs, type NumKey } from "./investicnaModel";
import { BONUSY_CTA_LABEL, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";

/**
 * Investičná kalkulačka 3.0 – krátky formulár vľavo, jeden pokojný výsledok vpravo (rovnaký jazyk ako Úverová 3.0).
 * Novinky: udalosti v čase (od roka X iný mesačný vklad, jednorazový vklad v roku X) a poplatky s reálnym dopadom
 * vrátane ušlého zhodnotenia. Jeden graf so značkami udalostí, vývoj po rokoch na rozkliknutie.
 */

const STORAGE_KEY = "jsm_investicna_v3";
const st = (i: number) => ({ "--i": i }) as CSSProperties;

const NBSP = String.fromCharCode(160);
const fmt = (n: number) => `${Math.round(Number.isFinite(n) ? n : 0).toLocaleString("sk-SK")}${NBSP}€`;
const fmtS = (n: number) => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`;
const f1 = (n: number) => n.toLocaleString("sk-SK", { maximumFractionDigits: 2 });
const rokov = (y: number) => (y === 1 ? "rok" : y >= 2 && y <= 4 ? "roky" : "rokov");
const START_YEAR = new Date().getFullYear();

const newEvent = (years: number, i = 0): InvEvent => ({ id: `ev-${Date.now().toString(36)}-${i}`, kind: "monthly", year: Math.min(years, 5 + i * 5), amount: 0 });
const withRow = (d: Inputs): Inputs => (d.events.length ? d : { ...d, events: [newEvent(d.years)] });

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
    <div className={`iv-field${compact ? " is-compact" : ""}`}>
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
          className="calc-slider iv-slider"
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

const Select = ({ id, label, value, options, className, onChange }: { id: string; label: string; value: number; options: { value: number; label: string }[]; className?: string; onChange: (v: number) => void }) => (
  <div className={`iv-field is-compact${className ? ` ${className}` : ""}`}>
    <label className="calc-label" htmlFor={id}>{label}</label>
    <div className="iv-select-wrap">
      <select id={id} className="calc-input iv-select" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="h-4 w-4 iv-select-chev" aria-hidden />
    </div>
  </div>
);

const Collapse = ({ title, meta, open, onToggle, children }: { title: string; meta: string; open: boolean; onToggle: () => void; children: ReactNode }) => (
  <>
    <button type="button" className="iv-collapse" aria-expanded={open} onClick={onToggle}>
      <span>{title}</span>
      <span className="iv-collapse-meta">{meta}</span>
      <ChevronDown className={`h-4 w-4 iv-chev${open ? " is-open" : ""}`} aria-hidden />
    </button>
    {open ? <div className="iv-advanced">{children}</div> : null}
  </>
);

/* ------------------------------------------------------------------ graf */

const W = 940;
const H = 340;
const PL = 62;
const PR = W - 20;
const PT = 26;
const PB = H - 40;

const KIND_OPTIONS = [
  { value: 0, label: "Zmením mesačný vklad" },
  { value: 1, label: "Jednorazový vklad" },
];

/* ------------------------------------------------------------------ komponent */

const InvesticnaCalculator = () => {
  const [A, setA] = useState<Inputs>(loadSaved);
  const [feesOpen, setFeesOpen] = useState(() => A.entryFee > 0 || A.annualFee > 0 || A.perfFee > 0 || A.tax === 1);
  const [tableOpen, setTableOpen] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; i: number } | null>(null);
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
  const shownValue = useCountUp(r.finalValue);
  const yearOptions = Array.from({ length: D.years }, (_, i) => ({ value: i + 1, label: `${i + 1}. rok` }));
  const activeEvents = D.events.filter((e) => e.amount > 0);

  const addEvent = () => setA((s) => ({ ...s, events: [...s.events, newEvent(s.years, s.events.length)] }));
  const updateEvent = (id: string, patch: Partial<InvEvent>) => setA((s) => ({ ...s, events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const removeEvent = (id: string) => setA((s) => withRow({ ...s, events: s.events.filter((e) => e.id !== id) }));
  const reset = () => {
    setA(withRow(DEFAULT_INPUTS));
    setFeesOpen(false);
  };

  /* geometria grafu */
  const G = useMemo(() => {
    const N = Math.max(1, D.years);
    const yMax = Math.max(...r.gross.series, 1) * 1.05;
    const step = niceStep(yMax / 4);
    const grid: number[] = [];
    for (let v = 0; v <= yMax + 1e-9; v += step) grid.push(v);
    const x = (i: number) => PL + (i / N) * (PR - PL);
    const y = (v: number) => PB - (v / yMax) * (PB - PT);
    const line = (arr: number[]) => arr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
    const area = (arr: number[]) => `${line(arr)} L${x(arr.length - 1).toFixed(1)} ${PB.toFixed(1)} L${PL.toFixed(1)} ${PB.toFixed(1)} Z`;
    const stepYr = N <= 12 ? 1 : N <= 24 ? 2 : 5;
    const ticks: number[] = [];
    for (let i = 0; i <= N; i += stepYr) ticks.push(i);
    if (ticks[ticks.length - 1] !== N) ticks.push(N);
    return { N, grid, x, y, line, area, ticks };
  }, [r.gross.series, D.years]);

  const onMove = (clientX: number) => {
    const svg = svgRef.current;
    const host = hostRef.current;
    if (!svg || !host) return;
    const rect = svg.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    const scale = rect.width / W;
    const lx = (clientX - rect.left) / scale;
    const i = Math.max(0, Math.min(G.N, Math.round(((lx - PL) / (PR - PL)) * G.N)));
    setTip({ x: G.x(i) * scale + (rect.left - hr.left), y: G.y(r.net.series[i] ?? 0) * scale + (rect.top - hr.top), i });
  };

  const single = activeEvents.length === 1 ? activeEvents[0] : null;
  const verdictHead = single
    ? single.kind === "monthly"
      ? `Od ${single.year}. roka ${fmt(single.amount)} mesačne namiesto ${fmt(D.monthly)} ${r.eventsDelta >= 0 ? "pridá k výsledku" : "uberie z výsledku"} ${fmt(Math.abs(r.eventsDelta))}.`
      : `Jednorazový vklad ${fmt(single.amount)} v ${single.year}. roku pridá k výsledku ${fmt(r.eventsDelta)}.`
    : `Tvoje udalosti ${r.eventsDelta >= 0 ? "pridajú k výsledku" : "uberú z výsledku"} ${fmt(Math.abs(r.eventsDelta))}.`;
  const verdictSub =
    r.eventsInvested > 0
      ? r.eventsDelta > r.eventsInvested
        ? `Vložíš o ${fmt(r.eventsInvested)} viac, zvyšných ${fmt(r.eventsDelta - r.eventsInvested)} urobí zložené úročenie.`
        : `Vložíš o ${fmt(r.eventsInvested)} viac.`
      : `Vložíš o ${fmt(-r.eventsInvested)} menej.`;

  const feesMeta = [
    D.entryFee > 0 ? `vstupný ${f1(D.entryFee)} %` : "",
    D.annualFee > 0 ? `ročný ${f1(D.annualFee)} %` : "",
    D.perfFee > 0 ? `výkonnostný ${f1(D.perfFee)} %` : "",
    D.tax === 1 ? "daň 19 %" : "",
  ]
    .filter(Boolean)
    .join(", ");

  const heroSub = [
    `${fmt(D.initial)} na začiatku`,
    `${fmt(D.monthly)} mesačne`,
    `${f1(D.rate)} % p. a.`,
    `${r.hasCosts ? "po poplatkoch a dani " : ""}do roku ${r.endYear}`,
  ];

  const eventRow = (year: number) => activeEvents.filter((e) => e.year === year);

  return (
    <div id="iv-root" className="calc-ui iv w-full font-sans">
      <div className="calc-body-shell">
        <div className="calc-page">
          <header className="calc-header calc-reveal" style={st(0)}>
            <span className="calc-eyebrow">Investičná kalkulačka</span>
            <h1 className="calc-title">
              Koľko ti zarobí <em>zložené úročenie</em>?
            </h1>
            <p className="calc-subtitle">
              Zadaj vklady, dobu a výnos. Pridaj udalosti v čase, napríklad vyšší vklad od piateho roka alebo jednorazový vklad,
              a pozri, čo z výsledku ukroja poplatky, daň a inflácia.
            </p>
          </header>

          <div className="iv-layout">
            {/* ---------------------------------------------------------------- Formulár */}
            <aside className="iv-form calc-reveal" aria-label="Parametre investície" style={st(1)}>
              <Field id="iv-initial" label="Počiatočný vklad" unit="€" value={A.initial} {...LIMITS.initial} onChange={(v) => setNum("initial", v)} />
              <Field id="iv-monthly" label="Mesačný vklad" unit="€" value={A.monthly} {...LIMITS.monthly} onChange={(v) => setNum("monthly", v)} />
              <div className="iv-row">
                <Field id="iv-years" label="Doba" unit="rokov" value={A.years} {...LIMITS.years} slider={false} compact onChange={(v) => setNum("years", v)} />
                <Field id="iv-rate" label="Ročný výnos" unit="%" value={A.rate} {...LIMITS.rate} slider={false} compact onChange={(v) => setNum("rate", v)} />
              </div>

              <div className="iv-events">
                <p className="iv-events-title">
                  Udalosti v čase <span>voliteľné</span>
                </p>
                <p className="iv-events-help">Napríklad od 5. roka investuješ 400 € mesačne alebo v 3. roku vložíš jednorazovo 10 000 €.</p>
                {D.events.map((e, i) => {
                  const cal = START_YEAR + e.year - 1;
                  return (
                    <div key={e.id} className="iv-event">
                      <Select id={`iv-ev-kind-${i}`} label="Udalosť" className="iv-event-kind" value={e.kind === "lump" ? 1 : 0} options={KIND_OPTIONS} onChange={(v) => updateEvent(e.id, { kind: v === 1 ? "lump" : "monthly" })} />
                      <Select id={`iv-ev-year-${i}`} label={e.kind === "lump" ? "V roku" : "Od roka"} value={e.year} options={yearOptions} onChange={(v) => updateEvent(e.id, { year: v })} />
                      <Field id={`iv-ev-amount-${i}`} label={e.kind === "lump" ? "Suma" : "Nový mesačný vklad"} unit="€" value={e.amount} min={0} max={10000000} step={e.kind === "lump" ? 500 : 10} slider={false} compact onChange={(v) => updateEvent(e.id, { amount: v })} />
                      <small className="iv-event-cal">
                        {e.amount > 0
                          ? e.kind === "lump"
                            ? `V roku ${cal} vložíš jednorazovo ${fmt(e.amount)}.`
                            : `Od roku ${cal} investuješ ${fmt(e.amount)} mesačne${e.amount > D.monthly ? ` namiesto ${fmt(D.monthly)}` : ""}.`
                          : "Zadaj sumu, inak sa udalosť nepočíta."}
                      </small>
                      {D.events.length > 1 ? (
                        <button type="button" className="iv-event-x" onClick={() => removeEvent(e.id)}>
                          Odstrániť
                        </button>
                      ) : null}
                    </div>
                  );
                })}
                {D.events.length < MAX_EVENTS ? (
                  <button type="button" className="iv-add" onClick={addEvent}>
                    <Plus className="h-4 w-4" strokeWidth={2} aria-hidden /> Pridať udalosť
                  </button>
                ) : null}
              </div>

              <Collapse title="Poplatky, daň a inflácia" meta={feesMeta || "bez poplatkov"} open={feesOpen} onToggle={() => setFeesOpen((o) => !o)}>
                <div className="iv-row">
                  <Field id="iv-entry" label="Vstupný poplatok" hint="% z vkladu" unit="%" value={A.entryFee} {...LIMITS.entryFee} slider={false} compact onChange={(v) => setNum("entryFee", v)} />
                  <Field id="iv-annual" label="Ročný poplatok" hint="TER, % p. a." unit="%" value={A.annualFee} {...LIMITS.annualFee} slider={false} compact onChange={(v) => setNum("annualFee", v)} />
                </div>
                <div className="iv-row">
                  <Field id="iv-perf" label="Výkonnostný" hint="% zo zisku" unit="%" value={A.perfFee} {...LIMITS.perfFee} slider={false} compact onChange={(v) => setNum("perfFee", v)} />
                  <Field id="iv-inflation" label="Inflácia" hint="% ročne" unit="%" value={A.inflation} {...LIMITS.inflation} slider={false} compact onChange={(v) => setNum("inflation", v)} />
                </div>
                <label className="iv-check" htmlFor="iv-tax">
                  <span className="iv-check-t">
                    Zdaniť výnos daňou 19 %
                    <small>Na konci investovania. ETF na burze držané dlhšie ako rok sú na Slovensku od dane oslobodené.</small>
                  </span>
                  <input id="iv-tax" type="checkbox" checked={D.tax === 1} onChange={(e) => setNum("tax", e.target.checked ? 1 : 0)} />
                </label>
              </Collapse>

              <div className="iv-form-foot">
                <button type="button" className="iv-reset" onClick={reset}>Začať odznova</button>
              </div>
            </aside>

            {/* ---------------------------------------------------------------- Výsledok */}
            <section className="iv-result calc-reveal" aria-label="Výsledok" style={st(2)}>
              <p className="iv-kicker">Hodnota portfólia</p>
              <p className="iv-hero">
                <span className="iv-hero-value">{fmt(shownValue)}</span>
                <span className="iv-hero-unit">o {D.years} {rokov(D.years)}</span>
              </p>
              <p className="iv-hero-sub">
                {heroSub.map((part, i) => (
                  <span key={part} className={i === heroSub.length - 1 ? "iv-hero-sub-last" : undefined}>
                    {i > 0 ? <i aria-hidden>·</i> : null}
                    {part}
                  </span>
                ))}
              </p>

              {r.hasEvents ? (
                <div className={`iv-verdict${r.eventsDelta < 0 ? " is-neg" : ""}`}>
                  <b>{verdictHead}</b>
                  <span>{verdictSub}</span>
                </div>
              ) : null}

              <dl className="iv-facts">
                <div>
                  <dt>Vložíš celkovo</dt>
                  <dd>{fmt(r.net.totalInvested)}</dd>
                  <small>{r.hasEvents ? `z toho udalosti ${fmtS(r.eventsInvested)}` : `${fmt(D.initial)} + ${D.years * 12} × ${fmt(D.monthly)}`}</small>
                </div>
                <div>
                  <dt>Zhodnotenie</dt>
                  <dd className={r.gain >= 0 ? "is-accent" : ""}>{fmtS(r.gain)}</dd>
                  <small>{Math.round(Math.max(0, r.gainPct))} % z hodnoty portfólia</small>
                </div>
                <div>
                  <dt>Reálna hodnota</dt>
                  <dd>{fmt(r.realValue)}</dd>
                  <small>v dnešných cenách pri inflácii {f1(D.inflation)} %</small>
                </div>
              </dl>

              <div className="iv-share" aria-label="Pomer vkladov a zhodnotenia">
                <div className="iv-share-bar" aria-hidden>
                  <i className="iv-share-ink" style={{ width: `${r.investedPct}%` }} />
                  <i className="iv-share-accent" style={{ width: `${Math.max(0, 100 - r.investedPct)}%` }} />
                </div>
                <div className="iv-share-legend">
                  <span><i className="iv-sw iv-sw-ink" />Vklady {Math.round(r.investedPct)} %</span>
                  <span><i className="iv-sw iv-sw-accent" />Zhodnotenie {Math.round(Math.max(0, 100 - r.investedPct))} %</span>
                </div>
              </div>

              {r.hasCosts ? (
                <div className="iv-block">
                  <div className="iv-block-head">
                    <h3>Čo ťa stoja poplatky a daň</h3>
                    <div className="iv-cost-head">
                      <b>−{fmt(r.costTotal)}</b>
                      <small>{Math.round(r.costPct)} % z hodnoty bez poplatkov</small>
                    </div>
                  </div>
                  <p className="iv-block-sub">Bez poplatkov a dane by si mal {fmt(r.gross.final)}. Ročný poplatok počítame aj s ušlým zhodnotením, ktoré by ti tie peniaze zarobili.</p>
                  <ol className="iv-rows">
                    {D.entryFee > 0 ? (
                      <li>
                        <div>
                          <span className="iv-row-t">Vstupný poplatok</span>
                          <span className="iv-row-s">{f1(D.entryFee)} % z {fmt(r.net.totalInvested)}, ktoré vložíš</span>
                        </div>
                        <b className="is-cost">−{fmt(r.net.entryPaid)}</b>
                      </li>
                    ) : null}
                    {D.annualFee > 0 ? (
                      <li>
                        <div>
                          <span className="iv-row-t">Ročný poplatok</span>
                          <span className="iv-row-s">{f1(D.annualFee)} % p. a.: zaplatené {fmt(r.net.annualPaid)} + ušlé zhodnotenie {fmt(Math.max(0, r.annualImpact - r.net.annualPaid))}</span>
                        </div>
                        <b className="is-cost">−{fmt(r.annualImpact)}</b>
                      </li>
                    ) : null}
                    {D.perfFee > 0 ? (
                      <li>
                        <div>
                          <span className="iv-row-t">Výkonnostný poplatok</span>
                          <span className="iv-row-s">{f1(D.perfFee)} % z každého kladného zhodnotenia</span>
                        </div>
                        <b className="is-cost">−{fmt(r.net.perfPaid)}</b>
                      </li>
                    ) : null}
                    {r.tax > 0 ? (
                      <li>
                        <div>
                          <span className="iv-row-t">Daň 19 % zo zisku</span>
                          <span className="iv-row-s">zo zisku {fmt(Math.max(0, r.net.final - r.net.totalInvested))} po poplatkoch</span>
                        </div>
                        <b className="is-cost">−{fmt(r.tax)}</b>
                      </li>
                    ) : null}
                  </ol>
                </div>
              ) : null}

              {/* graf */}
              <div className="iv-block">
                <div className="iv-block-head">
                  <h3>Vývoj v čase</h3>
                  <div className="iv-legend">
                    <span><i className="iv-legend-line iv-legend-accent" />Hodnota</span>
                    <span><i className="iv-legend-line iv-legend-sand" />Vklady</span>
                    {r.hasFees ? <span><i className="iv-legend-line iv-legend-ink" />Bez poplatkov</span> : null}
                    {r.marks.length ? <span><i className="iv-legend-dot" />Udalosť</span> : null}
                  </div>
                </div>
                <div
                  className="iv-chart-host"
                  ref={hostRef}
                  onMouseMove={(e) => onMove(e.clientX)}
                  onMouseLeave={() => setTip(null)}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    onMove(e.touches[0].clientX);
                  }}
                  onTouchEnd={() => setTip(null)}
                >
                  <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="iv-chart" aria-hidden>
                    <defs>
                      <linearGradient id="iv-gVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#2a6647" stopOpacity="0.16" />
                        <stop offset="1" stopColor="#2a6647" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {G.grid.map((v) => (
                      <g key={v}>
                        <line className="iv-grid" x1={PL} x2={PR} y1={G.y(v)} y2={G.y(v)} />
                        <text className="iv-ax" x={PL - 10} y={G.y(v) + 4} textAnchor="end">{v >= 1000000 ? `${f1(Math.round(v / 100000) / 10)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}</text>
                      </g>
                    ))}
                    <path d={G.area(r.net.series)} fill="url(#iv-gVal)" />
                    {r.hasFees ? <path d={G.line(r.gross.series)} fill="none" stroke="#292420" strokeWidth={1.5} strokeDasharray="2 4" strokeLinecap="round" opacity={0.7} /> : null}
                    <path d={G.line(r.net.invested)} fill="none" stroke="#c9b48f" strokeWidth={2} strokeDasharray="5 5" strokeLinecap="round" />
                    <path d={G.line(r.net.series)} fill="none" stroke="#2a6647" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                    {r.marks.map((m) => (
                      <circle key={m.id} cx={G.x(m.i)} cy={G.y(m.value)} r={6} fill="#2a6647" stroke="#fffcf7" strokeWidth={2} />
                    ))}
                    {G.ticks.map((i) => (
                      <text key={i} className="iv-ax" x={G.x(i)} y={PB + 24} textAnchor="middle">
                        {START_YEAR + i}
                      </text>
                    ))}
                    {tip ? (
                      <g>
                        <line x1={G.x(tip.i)} x2={G.x(tip.i)} y1={PT} y2={PB} stroke="rgba(41,36,32,0.3)" strokeWidth={1} />
                        <circle cx={G.x(tip.i)} cy={G.y(r.net.series[tip.i] ?? 0)} r={5} fill="#2a6647" stroke="#fffcf7" strokeWidth={2} />
                      </g>
                    ) : null}
                  </svg>
                  {tip ? (
                    <div className="iv-tooltip" style={{ left: tip.x > (hostRef.current?.offsetWidth ?? 0) - 220 ? tip.x - 210 : tip.x + 14, top: Math.max(0, tip.y - 80) }}>
                      <div className="iv-tt-d">{tip.i === 0 ? "začiatok" : `${tip.i}. rok · ${START_YEAR + tip.i}`}</div>
                      <div>Hodnota <b>{fmt(r.net.series[tip.i] ?? 0)}</b></div>
                      <div>Vložené <b>{fmt(r.net.invested[tip.i] ?? 0)}</b></div>
                      {r.hasFees ? <div>Bez poplatkov <b>{fmt(r.gross.series[tip.i] ?? 0)}</b></div> : null}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* vývoj po rokoch */}
              <button type="button" className="iv-collapse iv-collapse--table" aria-expanded={tableOpen} onClick={() => setTableOpen((o) => !o)}>
                <span>Vývoj po rokoch</span>
                <span className="iv-collapse-meta">{tableOpen ? "skryť" : "zobraziť"}</span>
                <ChevronDown className={`h-4 w-4 iv-chev${tableOpen ? " is-open" : ""}`} aria-hidden />
              </button>
              {tableOpen ? (
                <div className="iv-table-wrap">
                  <table className="iv-table">
                    <thead>
                      <tr>
                        <th>Rok</th>
                        <th>Vložené</th>
                        <th>Hodnota</th>
                        <th>Zhodnotenie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.net.series.slice(1).map((v, k) => {
                        const n = k + 1;
                        const evs = eventRow(n);
                        return (
                          <tr key={n} className={evs.length ? "is-event" : ""}>
                            <td>
                              {n}. rok <small>{START_YEAR + n}</small>
                              {evs.map((e) => (
                                <small key={e.id} className="is-accent">{e.kind === "lump" ? ` +${fmt(e.amount)}` : ` ${fmt(e.amount)} / mes.`}</small>
                              ))}
                            </td>
                            <td>{fmt(r.net.invested[n])}</td>
                            <td><strong>{fmt(v)}</strong></td>
                            <td className={v - r.net.invested[n] >= 0 ? "is-accent" : ""}>{fmtS(v - r.net.invested[n])}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="iv-cta">
                <p>Chceš vedieť, kde investovať bez zbytočných poplatkov a ako nastaviť vklady podľa svojho plánu? Prejdeme to na tvojich číslach.</p>
                <a className="btn-primary iv-cta-btn" href={KONZULTACIA_URL} target="_blank" rel="noopener noreferrer" data-umami-event="click_konzultacia" data-umami-event-section="investicna">
                  {BONUSY_CTA_LABEL} <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </a>
              </div>
            </section>
          </div>

          <p className="calc-note calc-note--center iv-foot">
            Orientačný prepočet s konštantným ročným výnosom, mesačným pripisovaním a vkladmi na konci mesiaca. Udalosti platia od začiatku zvoleného roka.
            Vstupný poplatok sa strháva z každého vloženého eura, ročný z hodnoty majetku, výkonnostný z kladného mesačného zhodnotenia, daň 19 % zo zisku na konci.
            Výnosy nie sú garantované. Hodnoty sa ukladajú iba v tvojom prehliadači.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InvesticnaCalculator;
