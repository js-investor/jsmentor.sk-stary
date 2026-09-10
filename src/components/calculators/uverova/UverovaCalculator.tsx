import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import "../shared/calc-ui.css";
import "./uverova-calculator.css";
import { DEFAULT_INPUTS, LIMITS, compute, niceStep, sanitize, type Inputs } from "./uverovaModel";
import { BONUSY_CTA_LABEL, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";

/**
 * Úverová kalkulačka – krátky formulár (suma, úrok, splatnosť) a okamžitý výsledok:
 * mesačná splátka, preplatenie, RPMN, graf istina / úroky po rokoch, rozpis a efekt mimoriadnej splátky.
 * Jazyk /bonusy 2.0: ivory karty s hairline na krémovom plátne, jedna zelená, bez tieňov.
 */

const STORAGE_KEY = "jsm_uverova_v1";
const st = (i: number) => ({ "--i": i }) as CSSProperties;

const fmt = (n: number) => `${Math.round(Number.isFinite(n) ? n : 0).toLocaleString("sk-SK")}\u00a0€`;
const fmt2 = (n: number) => `${(Number.isFinite(n) ? n : 0).toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00a0€`;
const f2 = (n: number) => n.toLocaleString("sk-SK", { maximumFractionDigits: 2 });
const rokov = (y: number) => (y === 1 ? "rok" : y >= 2 && y <= 4 ? "roky" : "rokov");
const mesiacov = (m: number) => (m === 1 ? "mesiac" : m >= 2 && m <= 4 ? "mesiace" : "mesiacov");
const MONTHS = ["január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"];

const PRESETS: { label: string; sub: string; amount: number; rate: number; years: number }[] = [
  { label: "Hypotéka", sub: "150 000 € · 3,8 % · 30 r.", amount: 150000, rate: 3.8, years: 30 },
  { label: "Spotrebný úver", sub: "10 000 € · 8 % · 5 r.", amount: 10000, rate: 8, years: 5 },
  { label: "Auto", sub: "20 000 € · 6,5 % · 6 r.", amount: 20000, rate: 6.5, years: 6 },
];

const loadSaved = (): Inputs => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize({ ...DEFAULT_INPUTS, ...(JSON.parse(raw) as Partial<Inputs>) }) : DEFAULT_INPUTS;
  } catch {
    return DEFAULT_INPUTS;
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

/* ------------------------------------------------------------------ pole: číslo + jednotka (+ slider) */

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
  onChange: (v: number) => void;
};

const Field = ({ id, label, hint, unit, value, min, max, step, slider = true, onChange }: FieldProps) => {
  const [text, setText] = useState<string | null>(null);
  const decimals = Math.max(0, (String(step).split(".")[1] ?? "").length);
  const clamp = (v: number) => Number(Math.max(min, Math.min(max, Number.isFinite(v) ? v : min)).toFixed(decimals));
  const shown = text ?? value.toLocaleString("sk-SK", { maximumFractionDigits: decimals });
  const p = `${((value - min) / (max - min)) * 100}%`;
  return (
    <div className="uv-field">
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

/* ------------------------------------------------------------------ graf */

const W = 940;
const H = 360;
const PL = 66;
const PR = W - 24;
const PT = 28;
const PB = H - 40;

/* ------------------------------------------------------------------ komponent */

const UverovaCalculator = () => {
  const [A, setA] = useState<Inputs>(loadSaved);
  const [feesOpen, setFeesOpen] = useState(() => A.feeUpfront > 0 || A.feeMonthly > 0);
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

  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setA((s) => ({ ...s, [k]: v }));
  const r = useMemo(() => compute(A), [A]);
  const D = r.d;
  const shownPayment = useCountUp(r.payment);
  const hasExtra = r.withExtra !== null && r.monthsSaved > 0;
  const sched = hasExtra && r.withExtra ? r.withExtra : r.base;

  const endDate = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };
  const yearsMonths = (m: number) => {
    const y = Math.floor(m / 12);
    const mm = m % 12;
    return [y > 0 ? `${y} ${rokov(y)}` : "", mm > 0 ? `${mm} ${mesiacov(mm)}` : ""].filter(Boolean).join(" a ");
  };
  const interestShare = r.totalPaid > 0 ? (r.totalInterest / r.totalPaid) * 100 : 0;

  /* geometria grafu: stĺpce istina + úrok po rokoch, čiara zostatku */
  const G = useMemo(() => {
    const rows = sched.rows;
    const n = Math.max(1, rows.length);
    const yMaxBar = Math.max(...rows.map((x) => x.principal + x.interest), 1);
    const yMaxLine = Math.max(D.amount, 1);
    const stepV = niceStep(yMaxBar / 4);
    const yMax = Math.ceil((yMaxBar * 1.08) / stepV) * stepV;
    const slot = (PR - PL) / n;
    const bw = Math.max(4, Math.min(28, slot * 0.62));
    const xS = (i: number) => PL + slot * (i + 0.5);
    const yS = (v: number) => PB - (v / yMax) * (PB - PT);
    const yL = (v: number) => PB - (v / yMaxLine) * (PB - PT);
    const grid: number[] = [];
    for (let v = 0; v <= yMax + 1e-9; v += stepV) grid.push(v);
    const line = sched.balance
      .filter((_, m) => m % 12 === 0 || m === sched.balance.length - 1)
      .map((v, k, arr) => `${k ? "L" : "M"}${(PL + ((k / Math.max(1, arr.length - 1)) * n) * slot).toFixed(1)} ${yL(v).toFixed(1)}`)
      .join(" ");
    const stepYr = n <= 12 ? 1 : n <= 24 ? 2 : 5;
    return { rows, n, yMax, xS, yS, bw, grid, line, stepYr };
  }, [sched, D.amount]);

  const onMove = (clientX: number) => {
    const svg = svgRef.current;
    const host = hostRef.current;
    if (!svg || !host) return;
    const rect = svg.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    const scale = rect.width / W;
    const lx = (clientX - rect.left) / scale;
    const i = Math.max(0, Math.min(G.n - 1, Math.floor((lx - PL) / ((PR - PL) / G.n))));
    const row = G.rows[i];
    if (!row) return;
    setTip({ x: G.xS(i) * scale + (rect.left - hr.left), y: G.yS(row.principal + row.interest) * scale + (rect.top - hr.top), i });
  };

  const tipRow = tip ? G.rows[tip.i] : null;

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
              Zadaj sumu, úrok a splatnosť. Hneď vidíš mesačnú splátku, koľko celkovo preplatíš, RPMN a čo urobí mimoriadna
              splátka.
            </p>
          </header>

          <div className="uv-layout">
            {/* ---------------------------------------------------------------- Formulár */}
            <aside className="uv-form calc-reveal" aria-label="Parametre úveru" style={st(1)}>
              <div className="uv-presets" role="group" aria-label="Rýchly príklad">
                {PRESETS.map((p) => {
                  const on = D.amount === p.amount && D.rate === p.rate && D.years === p.years;
                  return (
                    <button key={p.label} type="button" className={`uv-preset${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => setA((s) => ({ ...s, amount: p.amount, rate: p.rate, years: p.years }))}>
                      <b>{p.label}</b>
                      <small>{p.sub}</small>
                    </button>
                  );
                })}
              </div>

              <Field id="uv-amount" label="Výška úveru" unit="€" value={A.amount} {...LIMITS.amount} onChange={(v) => set("amount", v)} />
              <Field id="uv-rate" label="Úrok" hint="% p. a." unit="%" value={A.rate} {...LIMITS.rate} onChange={(v) => set("rate", v)} />
              <Field id="uv-years" label="Splatnosť" unit="rokov" value={A.years} {...LIMITS.years} onChange={(v) => set("years", v)} />

              <button type="button" className="uv-collapse" aria-expanded={feesOpen} onClick={() => setFeesOpen((o) => !o)}>
                <span>Poplatky a mimoriadna splátka</span>
                <span className="uv-collapse-meta">
                  {D.feeUpfront > 0 || D.feeMonthly > 0 || D.extra > 0
                    ? [D.feeUpfront > 0 ? `poplatok ${fmt(D.feeUpfront)}` : "", D.feeMonthly > 0 ? `${fmt(D.feeMonthly)} / mes.` : "", D.extra > 0 ? `+${fmt(D.extra)} navyše` : ""].filter(Boolean).join(" · ")
                    : "voliteľné"}
                </span>
                <ChevronDown className={`h-4 w-4 uv-chev${feesOpen ? " is-open" : ""}`} aria-hidden />
              </button>
              {feesOpen ? (
                <div className="uv-advanced">
                  <Field id="uv-fee-upfront" label="Poplatok za poskytnutie" hint="jednorazovo" unit="€" value={A.feeUpfront} {...LIMITS.feeUpfront} slider={false} onChange={(v) => set("feeUpfront", v)} />
                  <Field id="uv-fee-monthly" label="Mesačný poplatok" hint="vedenie, poistenie" unit="€" value={A.feeMonthly} {...LIMITS.feeMonthly} slider={false} onChange={(v) => set("feeMonthly", v)} />
                  <Field id="uv-extra" label="Mimoriadna splátka navyše" hint="každý mesiac" unit="€" value={A.extra} {...LIMITS.extra} onChange={(v) => set("extra", v)} />
                  <p className="uv-note">Poplatky vstupujú do RPMN a celkových nákladov. Mimoriadna splátka ide celá do istiny, počítame bez poplatku za predčasné splatenie.</p>
                </div>
              ) : null}
            </aside>

            {/* ---------------------------------------------------------------- Výsledok */}
            <section className="uv-result calc-reveal" aria-label="Výsledok" style={st(2)}>
              <p className="uv-kicker">Mesačná splátka</p>
              <p className="uv-hero">
                <span className="uv-hero-value">{fmt2(shownPayment)}</span>
                <span className="uv-hero-unit">mesačne</span>
              </p>
              <p className="uv-hero-sub">
                {fmt(D.amount)} na {D.years} {rokov(D.years)} pri {f2(D.rate)} % p. a.
                {D.feeMonthly > 0 ? ` · s poplatkom ${fmt2(r.monthlyOut)} mesačne` : ""}
              </p>

              <div className="uv-stats">
                <div>
                  <span className="uv-stat-label">Celkovo zaplatíš</span>
                  <strong>{fmt(r.totalPaid + r.totalFees)}</strong>
                  <small>{r.totalFees > 0 ? `splátky ${fmt(r.totalPaid)} + poplatky ${fmt(r.totalFees)}` : `${r.base.months} splátok`}</small>
                </div>
                <div>
                  <span className="uv-stat-label">Z toho úroky</span>
                  <strong>{fmt(r.totalInterest)}</strong>
                  <small>{Math.round(interestShare)} % z toho, čo zaplatíš</small>
                </div>
                <div>
                  <span className="uv-stat-label">RPMN</span>
                  <strong>{f2(Math.round(r.rpmn * 100) / 100)} %</strong>
                  <small>{r.totalFees > 0 ? "vrátane poplatkov" : "bez poplatkov = efektívny úrok"}</small>
                </div>
                <div>
                  <span className="uv-stat-label">Splatené</span>
                  <strong>{endDate(r.base.months)}</strong>
                  <small>{yearsMonths(r.base.months)}</small>
                </div>
              </div>

              {r.withExtra ? (
                <div className={`uv-extra${hasExtra ? " is-good" : ""}`}>
                  {hasExtra ? (
                    <>
                      <b>S {fmt(D.extra)} navyše mesačne splatíš úver o {yearsMonths(r.monthsSaved)} skôr</b>
                      <span>
                        a na úrokoch ušetríš <strong>{fmt(r.interestSaved)}</strong>. Koniec: {endDate(r.withExtra.months)} namiesto {endDate(r.base.months)}.
                      </span>
                    </>
                  ) : (
                    <b>Mimoriadna splátka je pri týchto číslach príliš malá, aby skrátila splácanie.</b>
                  )}
                </div>
              ) : null}

              {/* graf */}
              <div className="uv-chart-block">
                <div className="uv-chart-head">
                  <h3>Istina a úroky po rokoch{hasExtra ? " (s mimoriadnou splátkou)" : ""}</h3>
                  <div className="uv-legend">
                    <span><i className="uv-legend-ink" />Istina</span>
                    <span><i className="uv-legend-sand" />Úroky</span>
                    <span><i className="uv-legend-accent" />Zostatok</span>
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
                    {G.grid.map((v) => (
                      <g key={v}>
                        <line className="uv-grid" x1={PL} x2={PR} y1={G.yS(v)} y2={G.yS(v)} />
                        <text className="uv-ax" x={PL - 10} y={G.yS(v) + 4} textAnchor="end">
                          {v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
                        </text>
                      </g>
                    ))}
                    {G.rows.map((row, i) => {
                      const x = G.xS(i) - G.bw / 2;
                      const yP = G.yS(row.principal);
                      const yT = G.yS(row.principal + row.interest);
                      return (
                        <g key={row.year} opacity={tip && tip.i !== i ? 0.55 : 1}>
                          <rect x={x} y={yP} width={G.bw} height={Math.max(0, PB - yP)} fill="#292420" rx={2} />
                          <rect x={x} y={yT} width={G.bw} height={Math.max(0, yP - yT)} fill="#c9b48f" rx={2} />
                        </g>
                      );
                    })}
                    <path d={G.line} fill="none" stroke="#2a6647" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    {G.rows.map((row, i) =>
                      (i % G.stepYr === 0 || i === G.rows.length - 1) ? (
                        <text key={row.year} className="uv-ax" x={G.xS(i)} y={PB + 24} textAnchor="middle">
                          {row.year}. r.
                        </text>
                      ) : null,
                    )}
                  </svg>
                  {tip && tipRow ? (
                    <div className="uv-tooltip" style={{ left: tip.x > (hostRef.current?.offsetWidth ?? 0) - 200 ? tip.x - 190 : tip.x + 14, top: Math.max(0, tip.y - 84) }}>
                      <div className="uv-tt-d">{tipRow.year}. rok</div>
                      <div>Istina <b>{fmt(tipRow.principal)}</b></div>
                      <div>Úroky <b>{fmt(tipRow.interest)}</b></div>
                      <div>Zostatok <b>{fmt(tipRow.balance)}</b></div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* rozpis */}
              <button type="button" className="uv-collapse uv-collapse--table" aria-expanded={tableOpen} onClick={() => setTableOpen((o) => !o)}>
                <span>Rozpis po rokoch</span>
                <span className="uv-collapse-meta">{tableOpen ? "skryť" : "zobraziť"}</span>
                <ChevronDown className={`h-4 w-4 uv-chev${tableOpen ? " is-open" : ""}`} aria-hidden />
              </button>
              {tableOpen ? (
                <div className="uv-table-wrap">
                  <table className="uv-table">
                    <thead>
                      <tr>
                        <th>Rok</th>
                        <th>Istina</th>
                        <th>Úroky</th>
                        <th>Zostatok</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sched.rows.map((row) => (
                        <tr key={row.year}>
                          <td>{row.year}.</td>
                          <td>{fmt(row.principal)}</td>
                          <td>{fmt(row.interest)}</td>
                          <td><strong>{fmt(row.balance)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="uv-cta">
                <p>Chceš vedieť, či sa oplatí refinancovať alebo splácať rýchlejšie? Prejdeme to na tvojich číslach.</p>
                <a className="btn-primary uv-cta-btn" href={KONZULTACIA_URL} target="_blank" rel="noopener noreferrer" data-umami-event="click_konzultacia" data-umami-event-section="uverova">
                  {BONUSY_CTA_LABEL} <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </a>
              </div>
            </section>
          </div>

          <p className="calc-note calc-note--center uv-foot">
            Orientačný prepočet anuitného úveru s konštantným úrokom. Nezohľadňuje zmeny sadzby po fixácii ani poplatok za predčasné
            splatenie. Hodnoty sa ukladajú iba v tvojom prehliadači.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UverovaCalculator;
