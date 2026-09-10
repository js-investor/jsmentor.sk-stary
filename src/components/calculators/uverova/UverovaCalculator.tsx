import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, ChevronDown, Plus, X } from "lucide-react";
import "../shared/calc-ui.css";
import "./uverova-calculator.css";
import { DEFAULT_INPUTS, LIMITS, compute, niceStep, sanitize, type ExtraMode, type Inputs, type NumKey, type OneTime, type Schedule } from "./uverovaModel";
import { BONUSY_CTA_LABEL, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";

/**
 * Úverová kalkulačka 2.0 – krátky formulár vľavo, živý výsledok vpravo.
 * Referencie (Refero): Trulia mortgage calculator (vstupy s posuvníkmi, donut rozdelenia platby, porovnávacia tabuľka),
 * Wealthsimple kalkulačky (jedno tvrdenie ako verdikt, veľký graf s prehľadom, sekcia predpokladov).
 * Jazyk /bonusy 2.0: ivory karty s hairline na krémovom plátne, atrament, piesok, jedna zelená, bez tieňov.
 */

const STORAGE_KEY = "jsm_uverova_v2";
const st = (i: number) => ({ "--i": i }) as CSSProperties;

const fmt = (n: number) => `${Math.round(Number.isFinite(n) ? n : 0).toLocaleString("sk-SK")}\u00a0€`;
const fmt2 = (n: number) => `${(Number.isFinite(n) ? n : 0).toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00a0€`;
const f2 = (n: number) => n.toLocaleString("sk-SK", { maximumFractionDigits: 2 });
const rokov = (y: number) => (y === 1 ? "rok" : y >= 2 && y <= 4 ? "roky" : "rokov");
const mesiacov = (m: number) => (m === 1 ? "mesiac" : m >= 2 && m <= 4 ? "mesiace" : "mesiacov");
const MONTHS = ["január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"];
const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "máj", "jún", "júl", "aug", "sep", "okt", "nov", "dec"];
const dateOf = (d: { year: number; month: number }) => `${MONTHS[d.month - 1]} ${d.year}`;
const yearsMonths = (m: number) => {
  const y = Math.floor(m / 12);
  const mm = m % 12;
  return [y > 0 ? `${y} ${rokov(y)}` : "", mm > 0 ? `${mm} ${mesiacov(mm)}` : ""].filter(Boolean).join(" a ") || "0 mesiacov";
};

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
const H = 360;
const PL = 66;
const PR = W - 24;
const PT = 28;
const PB = H - 40;

const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: i + 1, label: m }));

/* ------------------------------------------------------------------ komponent */

const UverovaCalculator = () => {
  const [A, setA] = useState<Inputs>(loadSaved);
  const [fixOpen, setFixOpen] = useState(() => A.fixYears > 0 || A.feeUpfront > 0 || A.feeMonthly > 0 || A.feeExtraPct > 0);
  const [extraOpen, setExtraOpen] = useState(() => A.extraMonthly > 0 || A.extraYearly > 0 || A.oneTimes.length > 0);
  const [chartTab, setChartTab] = useState<"balance" | "bars">("balance");
  const [tableOpen, setTableOpen] = useState(false);
  const [openYears, setOpenYears] = useState<Set<number>>(() => new Set());
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
  const setNum = (k: NumKey, v: number) => setA((s) => ({ ...s, [k]: v }));
  const r = useMemo(() => compute(A), [A]);
  const D = r.d;
  const S: Schedule = r.hasExtras ? r.extras : r.base;
  const shownPayment = useCountUp(r.payment);
  const totalWithFees = S.totalPaid + r.totalFees;
  const interestShare = totalWithFees > 0 ? (S.totalInterest / totalWithFees) * 100 : 0;
  const yearOptions = Array.from({ length: D.years }, (_, i) => ({ value: i + 1, label: `${i + 1}. rok` }));
  const startYearOptions = Array.from({ length: 6 }, (_, i) => DEFAULT_INPUTS.startYear - 1 + i).map((y) => ({ value: y, label: String(y) }));

  const addOneTime = () =>
    setA((s) => ({
      ...s,
      oneTimes: [...s.oneTimes, { id: `ot-${Date.now().toString(36)}`, amount: 5000, year: Math.min(s.years, s.oneTimes.length + 2), month: 6 }],
    }));
  const updateOneTime = (id: string, patch: Partial<OneTime>) => setA((s) => ({ ...s, oneTimes: s.oneTimes.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  const removeOneTime = (id: string) => setA((s) => ({ ...s, oneTimes: s.oneTimes.filter((o) => o.id !== id) }));
  const reset = () => {
    setA(DEFAULT_INPUTS);
    setOpenYears(new Set());
  };
  const toggleYear = (n: number) =>
    setOpenYears((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const calAt = (m: number) => {
    if (m <= 0) return { year: D.startYear, month: D.startMonth };
    const idx = D.startMonth - 1 + (m - 1);
    return { year: D.startYear + Math.floor(idx / 12), month: (idx % 12) + 1 };
  };

  /* geometria grafov */
  const G = useMemo(() => {
    const rows = S.rows;
    const n = Math.max(1, rows.length);
    const yMaxBar = Math.max(...rows.map((x) => x.principal + x.interest + x.extra), 1);
    const stepB = niceStep(yMaxBar / 4);
    const yMaxB = Math.ceil((yMaxBar * 1.08) / stepB) * stepB;
    const slot = (PR - PL) / n;
    const bw = Math.max(4, Math.min(28, slot * 0.62));
    const xB = (i: number) => PL + slot * (i + 0.5);
    const yB = (v: number) => PB - (v / yMaxB) * (PB - PT);
    const gridB: number[] = [];
    for (let v = 0; v <= yMaxB + 1e-9; v += stepB) gridB.push(v);
    const M = Math.max(1, r.base.months);
    const yMaxL = D.amount * 1.05;
    const stepL = niceStep(yMaxL / 4);
    const gridL: number[] = [];
    for (let v = 0; v <= yMaxL + 1e-9; v += stepL) gridL.push(v);
    const xL = (m: number) => PL + (m / M) * (PR - PL);
    const yL = (v: number) => PB - (v / yMaxL) * (PB - PT);
    const line = (bal: number[]) => bal.map((v, m) => `${m ? "L" : "M"}${xL(m).toFixed(1)} ${yL(v).toFixed(1)}`).join(" ");
    const area = (bal: number[]) => `${line(bal)} L${xL(bal.length - 1).toFixed(1)} ${PB.toFixed(1)} L${PL.toFixed(1)} ${PB.toFixed(1)} Z`;
    const stepYr = D.years <= 12 ? 1 : D.years <= 24 ? 2 : 5;
    const ticks: number[] = [];
    for (let y = 0; y <= D.years; y += stepYr) ticks.push(y);
    if (ticks[ticks.length - 1] !== D.years) ticks.push(D.years);
    return { rows, n, yMaxB, xB, yB, bw, gridB, gridL, xL, yL, line, area, ticks, stepYr, M };
  }, [S, r.base.months, D.amount, D.years]);

  const onMove = (clientX: number) => {
    const svg = svgRef.current;
    const host = hostRef.current;
    if (!svg || !host) return;
    const rect = svg.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    const scale = rect.width / W;
    const lx = (clientX - rect.left) / scale;
    if (chartTab === "bars") {
      const i = Math.max(0, Math.min(G.n - 1, Math.floor((lx - PL) / ((PR - PL) / G.n))));
      const row = G.rows[i];
      if (!row) return;
      setTip({ x: G.xB(i) * scale + (rect.left - hr.left), y: G.yB(row.principal + row.interest + row.extra) * scale + (rect.top - hr.top), i });
    } else {
      const m = Math.max(0, Math.min(G.M, Math.round(((lx - PL) / (PR - PL)) * G.M)));
      const v = Math.max(r.base.balance[m] ?? 0, S.balance[m] ?? 0);
      setTip({ x: G.xL(m) * scale + (rect.left - hr.left), y: G.yL(v) * scale + (rect.top - hr.top), i: m });
    }
  };

  const tipRow = tip && chartTab === "bars" ? G.rows[tip.i] : null;
  const tipMonth = tip && chartTab === "balance" ? tip.i : null;
  const oneTimeMarks = D.oneTimes.filter((o) => o.amount > 0).map((o) => ({ ...o, m: (o.year - 1) * 12 + o.month }));
  const principalPct = totalWithFees > 0 ? (D.amount / totalWithFees) * 100 : 100;
  const interestPct = totalWithFees > 0 ? (S.totalInterest / totalWithFees) * 100 : 0;
  const feesPct = Math.max(0, 100 - principalPct - interestPct);
  const C = 2 * Math.PI * 42;
  const baseTotalWithFees = r.base.totalPaid + D.feeUpfront + D.feeMonthly * r.base.months;

  const extrasMeta = [
    D.extraMonthly > 0 ? `${fmt(D.extraMonthly)} / mes.` : "",
    D.extraYearly > 0 ? `${fmt(D.extraYearly)} ročne` : "",
    D.oneTimes.filter((o) => o.amount > 0).length ? `${D.oneTimes.filter((o) => o.amount > 0).length}× jednorazovo` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const fixMeta = [
    D.fixYears > 0 ? `po ${D.fixYears} r. úrok ${f2(D.rateAfter)} %` : "",
    D.feeUpfront > 0 ? `poplatok ${fmt(D.feeUpfront)}` : "",
    D.feeMonthly > 0 ? `${fmt(D.feeMonthly)} / mes.` : "",
    D.feeExtraPct > 0 ? `${f2(D.feeExtraPct)} % z mimoriadnej` : "",
  ]
    .filter(Boolean)
    .join(" · ");

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
              Zadaj sumu, úrok a splatnosť. Hneď vidíš splátku, preplatenie a RPMN. Potom skús mimoriadne splátky, aj jednorazovú
              v konkrétnom roku a mesiaci, alebo zmenu úroku po fixácii a pozri, čo to urobí s koncom splácania.
            </p>
          </header>

          <div className="uv-layout">
            {/* ---------------------------------------------------------------- Formulár */}
            <aside className="uv-form calc-reveal" aria-label="Parametre úveru" style={st(1)}>
              <div className="uv-presets" role="group" aria-label="Rýchly príklad">
                {PRESETS.map((p) => {
                  const on = D.amount === p.amount && D.rate === p.rate && D.years === p.years;
                  return (
                    <button key={p.label} type="button" className={`uv-preset${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => setA((s) => ({ ...s, amount: p.amount, rate: p.rate, years: p.years, rateAfter: p.rate }))}>
                      <b>{p.label}</b>
                      <small>{p.sub}</small>
                    </button>
                  );
                })}
              </div>

              <Field id="uv-amount" label="Výška úveru" unit="€" value={A.amount} {...LIMITS.amount} onChange={(v) => setNum("amount", v)} />
              <Field id="uv-rate" label="Úrok" hint="% p. a." unit="%" value={A.rate} {...LIMITS.rate} onChange={(v) => setNum("rate", v)} />
              <Field id="uv-years" label="Splatnosť" unit="rokov" value={A.years} {...LIMITS.years} onChange={(v) => setNum("years", v)} />
              <div className="uv-row">
                <Select id="uv-start-month" label="Prvá splátka" value={D.startMonth} options={MONTH_OPTIONS} onChange={(v) => setNum("startMonth", v)} />
                <Select id="uv-start-year" label="Rok" value={D.startYear} options={startYearOptions.some((o) => o.value === D.startYear) ? startYearOptions : [...startYearOptions, { value: D.startYear, label: String(D.startYear) }]} onChange={(v) => setNum("startYear", v)} />
              </div>

              <Collapse title="Mimoriadne splátky" meta={extrasMeta || "voliteľné"} open={extraOpen} onToggle={() => setExtraOpen((o) => !o)}>
                <div className="uv-seg" role="group" aria-label="Čo urobí mimoriadna splátka">
                  {(["term", "payment"] as ExtraMode[]).map((m) => (
                    <button key={m} type="button" aria-pressed={D.extraMode === m} onClick={() => set("extraMode", m)}>
                      {m === "term" ? "Skrátiť splatnosť" : "Znížiť splátku"}
                    </button>
                  ))}
                </div>
                <Field id="uv-extra-monthly" label="Každý mesiac navyše" unit="€" value={A.extraMonthly} {...LIMITS.extraMonthly} onChange={(v) => setNum("extraMonthly", v)} />
                <div className="uv-row">
                  <Field id="uv-extra-yearly" label="Raz ročne navyše" hint="13. plat, bonus" unit="€" value={A.extraYearly} {...LIMITS.extraYearly} slider={false} compact onChange={(v) => setNum("extraYearly", v)} />
                  <Select id="uv-extra-yearly-month" label="V mesiaci" value={D.extraYearlyMonth} options={MONTH_OPTIONS} onChange={(v) => setNum("extraYearlyMonth", v)} />
                </div>
                <div className="uv-onetimes">
                  <p className="uv-onetimes-title">Jednorazové splátky <span>v konkrétnom roku a mesiaci splácania</span></p>
                  {D.oneTimes.map((o, i) => {
                    const cal = calAt((o.year - 1) * 12 + o.month);
                    return (
                      <div key={o.id} className="uv-onetime">
                        <Field id={`uv-ot-${i}`} label="Suma" unit="€" value={o.amount} min={0} max={1000000} step={100} slider={false} compact onChange={(v) => updateOneTime(o.id, { amount: v })} />
                        <Select id={`uv-ot-year-${i}`} label="Rok splácania" value={o.year} options={yearOptions} onChange={(v) => updateOneTime(o.id, { year: v })} />
                        <Select id={`uv-ot-month-${i}`} label="Mesiac" value={o.month} options={MONTH_OPTIONS.map((m) => ({ value: m.value, label: MONTHS_SHORT[m.value - 1] }))} onChange={(v) => updateOneTime(o.id, { month: v })} />
                        <button type="button" className="uv-onetime-x" aria-label="Odstrániť jednorazovú splátku" onClick={() => removeOneTime(o.id)}>
                          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                        </button>
                        <small className="uv-onetime-cal">= {MONTHS[cal.month - 1]} {cal.year}</small>
                      </div>
                    );
                  })}
                  {D.oneTimes.length < 12 ? (
                    <button type="button" className="uv-add" onClick={addOneTime}>
                      <Plus className="h-4 w-4" strokeWidth={2} aria-hidden /> Pridať jednorazovú splátku
                    </button>
                  ) : null}
                </div>
                <p className="uv-note">
                  {D.extraMode === "term"
                    ? "Splátka ostáva rovnaká, úver sa splatí skôr. Najviac ušetríš, ak mimoriadnu splátku pošleš čo najskôr."
                    : "Splatnosť ostáva, po každej mimoriadnej splátke banka prepočíta nižšiu splátku."}
                </p>
              </Collapse>

              <Collapse title="Fixácia a poplatky" meta={fixMeta || "voliteľné"} open={fixOpen} onToggle={() => setFixOpen((o) => !o)}>
                <div className="uv-row">
                  <Field id="uv-fix" label="Fixácia" hint="0 = bez zmeny" unit="rokov" value={A.fixYears} min={0} max={Math.max(0, D.years - 1)} step={1} slider={false} compact onChange={(v) => setNum("fixYears", v)} />
                  <Field id="uv-rate-after" label="Úrok po fixácii" unit="%" value={A.rateAfter} {...LIMITS.rateAfter} slider={false} compact onChange={(v) => setNum("rateAfter", v)} />
                </div>
                <div className="uv-row">
                  <Field id="uv-fee-upfront" label="Poplatok za poskytnutie" unit="€" value={A.feeUpfront} {...LIMITS.feeUpfront} slider={false} compact onChange={(v) => setNum("feeUpfront", v)} />
                  <Field id="uv-fee-monthly" label="Mesačný poplatok" unit="€" value={A.feeMonthly} {...LIMITS.feeMonthly} slider={false} compact onChange={(v) => setNum("feeMonthly", v)} />
                </div>
                <Field id="uv-fee-extra" label="Poplatok z mimoriadnej splátky" hint="pri hypotéke 20 % ročne bez poplatku" unit="%" value={A.feeExtraPct} {...LIMITS.feeExtraPct} slider={false} compact onChange={(v) => setNum("feeExtraPct", v)} />
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
                {fmt(D.amount)} na {D.years} {rokov(D.years)} pri {f2(D.rate)} % p. a., prvá splátka {dateOf({ year: D.startYear, month: D.startMonth })}
                {D.feeMonthly > 0 ? `, s poplatkom ${fmt2(r.monthlyOut)} mesačne` : ""}
                {r.base.paymentAfterFix !== null ? `. Po fixácii od ${D.fixYears + 1}. roka pri ${f2(D.rateAfter)} % splátka ${fmt2(r.base.paymentAfterFix)}` : ""}.
              </p>

              {r.hasExtras ? (
                <div className={`uv-verdict${r.monthsSaved > 0 || r.interestSaved > 0 ? " is-good" : ""}`}>
                  {D.extraMode === "term" ? (
                    <>
                      <b>S mimoriadnymi splátkami splatíš úver v {dateOf(r.endExtras)}, o {yearsMonths(r.monthsSaved)} skôr.</b>
                      <span>
                        Na úrokoch ušetríš <strong>{fmt(r.interestSaved)}</strong>{r.extras.totalExtraFees > 0 ? `, poplatky za mimoriadne splátky ${fmt(r.extras.totalExtraFees)}` : ""}. Mimoriadne splátky spolu {fmt(r.extras.totalExtra)}.
                      </span>
                    </>
                  ) : (
                    <>
                      <b>S mimoriadnymi splátkami klesne splátka na {fmt2(r.extras.paymentEnd)} a na úrokoch ušetríš {fmt(r.interestSaved)}.</b>
                      <span>
                        Splatnosť ostáva do {dateOf(r.endExtras)}. Mimoriadne splátky spolu {fmt(r.extras.totalExtra)}{r.extras.totalExtraFees > 0 ? `, poplatky ${fmt(r.extras.totalExtraFees)}` : ""}.
                      </span>
                    </>
                  )}
                </div>
              ) : null}

              <div className="uv-stats">
                <div>
                  <span className="uv-stat-label">Celkovo zaplatíš</span>
                  <strong>{fmt(totalWithFees)}</strong>
                  <small>{r.totalFees > 0 ? `splátky ${fmt(S.totalPaid)} + poplatky ${fmt(r.totalFees)}` : `${S.months} splátok`}</small>
                </div>
                <div>
                  <span className="uv-stat-label">Z toho úroky</span>
                  <strong>{fmt(S.totalInterest)}</strong>
                  <small>{Math.round(interestShare)} % z toho, čo zaplatíš</small>
                </div>
                <div>
                  <span className="uv-stat-label">RPMN</span>
                  <strong>{f2(Math.round(r.rpmn * 100) / 100)} %</strong>
                  <small>{r.totalFees > 0 ? "vrátane poplatkov" : "bez poplatkov = efektívny úrok"}</small>
                </div>
                <div>
                  <span className="uv-stat-label">Splatené</span>
                  <strong>{dateOf(r.hasExtras ? r.endExtras : r.endBase)}</strong>
                  <small>{yearsMonths(S.months)}</small>
                </div>
              </div>

              {/* rozdelenie platby */}
              <div className="uv-split">
                <svg viewBox="0 0 100 100" className="uv-donut" aria-hidden>
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#e9e4dc" strokeWidth="12" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#292420" strokeWidth="12" strokeDasharray={`${(C * principalPct) / 100} ${C}`} transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#c9b48f" strokeWidth="12" strokeDasharray={`${(C * interestPct) / 100} ${C}`} strokeDashoffset={-(C * principalPct) / 100} transform="rotate(-90 50 50)" />
                  <text x="50" y="47" textAnchor="middle" fontFamily="Calvino, serif" fontWeight="700" fontSize="15" fill="#292420">{Math.round(interestPct + feesPct)} %</text>
                  <text x="50" y="59" textAnchor="middle" fontFamily="Matter, sans-serif" fontSize="6.5" fill="#6b625a">navyše</text>
                </svg>
                <ul className="uv-split-legend">
                  <li><i className="uv-sw uv-sw-ink" /><span>Istina</span><b>{fmt(D.amount)}</b></li>
                  <li><i className="uv-sw uv-sw-sand" /><span>Úroky</span><b>{fmt(S.totalInterest)}</b></li>
                  {r.totalFees > 0 ? <li><i className="uv-sw uv-sw-stone" /><span>Poplatky</span><b>{fmt(r.totalFees)}</b></li> : null}
                  <li className="is-total"><span>Celkovo</span><b>{fmt(totalWithFees)}</b></li>
                </ul>
              </div>

              {/* porovnanie scenárov */}
              {r.hasExtras ? (
                <div className="uv-compare">
                  <h3>Bez mimoriadnych splátok vs. s nimi</h3>
                  <table className="uv-cmp">
                    <thead>
                      <tr>
                        <th />
                        <th>Bez</th>
                        <th>S mimoriadnymi</th>
                        <th>Rozdiel</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Mesačná splátka</td>
                        <td>{fmt2(r.payment)}</td>
                        <td>{D.extraMode === "payment" ? `${fmt2(r.payment)} → ${fmt2(r.extras.paymentEnd)}` : fmt2(r.payment)}</td>
                        <td className={D.extraMode === "payment" ? "is-accent" : ""}>{D.extraMode === "payment" ? `−${fmt2(r.payment - r.extras.paymentEnd)}` : "—"}</td>
                      </tr>
                      <tr>
                        <td>Úroky spolu</td>
                        <td>{fmt(r.base.totalInterest)}</td>
                        <td>{fmt(r.extras.totalInterest)}</td>
                        <td className="is-accent">−{fmt(r.interestSaved)}</td>
                      </tr>
                      <tr>
                        <td>Koniec splácania</td>
                        <td>{dateOf(r.endBase)}</td>
                        <td>{dateOf(r.endExtras)}</td>
                        <td className={r.monthsSaved > 0 ? "is-accent" : ""}>{r.monthsSaved > 0 ? `o ${yearsMonths(r.monthsSaved)} skôr` : "rovnako"}</td>
                      </tr>
                      <tr>
                        <td>Celkovo zaplatíš</td>
                        <td>{fmt(baseTotalWithFees)}</td>
                        <td>{fmt(totalWithFees)}</td>
                        <td className="is-accent">−{fmt(baseTotalWithFees - totalWithFees)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : null}

              {/* graf */}
              <div className="uv-chart-block">
                <div className="uv-chart-head">
                  <div className="uv-tabs" role="tablist" aria-label="Zobrazenie grafu">
                    <button type="button" role="tab" aria-selected={chartTab === "balance"} onClick={() => setChartTab("balance")}>Zostatok úveru</button>
                    <button type="button" role="tab" aria-selected={chartTab === "bars"} onClick={() => setChartTab("bars")}>Istina a úroky po rokoch</button>
                  </div>
                  <div className="uv-legend">
                    {chartTab === "balance" ? (
                      <>
                        <span><i className="uv-legend-line uv-legend-accent" />{r.hasExtras ? "S mimoriadnymi" : "Zostatok"}</span>
                        {r.hasExtras ? <span><i className="uv-legend-line uv-legend-ink" />Bez mimoriadnych</span> : null}
                        {oneTimeMarks.length ? <span><i className="uv-legend-dot" />Jednorazová splátka</span> : null}
                      </>
                    ) : (
                      <>
                        <span><i className="uv-sw uv-sw-ink" />Istina</span>
                        <span><i className="uv-sw uv-sw-sand" />Úroky</span>
                        {r.hasExtras ? <span><i className="uv-sw uv-sw-accent" />Mimoriadne</span> : null}
                      </>
                    )}
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
                    {chartTab === "balance" ? (
                      <>
                        <defs>
                          <linearGradient id="uv-gBal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#2a6647" stopOpacity="0.16" />
                            <stop offset="1" stopColor="#2a6647" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {G.gridL.map((v) => (
                          <g key={v}>
                            <line className="uv-grid" x1={PL} x2={PR} y1={G.yL(v)} y2={G.yL(v)} />
                            <text className="uv-ax" x={PL - 10} y={G.yL(v) + 4} textAnchor="end">{v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}</text>
                          </g>
                        ))}
                        <path d={G.area(S.balance)} fill="url(#uv-gBal)" />
                        {r.hasExtras ? <path d={G.line(r.base.balance)} fill="none" stroke="#292420" strokeWidth={2} strokeDasharray="5 5" strokeLinecap="round" /> : null}
                        <path d={G.line(S.balance)} fill="none" stroke="#2a6647" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                        {D.fixYears > 0 && D.fixYears < D.years ? (
                          <g>
                            <line x1={G.xL(D.fixYears * 12)} x2={G.xL(D.fixYears * 12)} y1={PT} y2={PB} stroke="#292420" strokeWidth={1} strokeDasharray="2 4" opacity={0.45} />
                            <text className="uv-ax" x={G.xL(D.fixYears * 12) + 6} y={PT + 12} textAnchor="start">koniec fixácie</text>
                          </g>
                        ) : null}
                        {oneTimeMarks.map((o) => (
                          <circle key={o.id} cx={G.xL(Math.min(o.m, G.M))} cy={G.yL(S.balance[Math.min(o.m, S.balance.length - 1)] ?? 0)} r={6} fill="#2a6647" stroke="#fffcf7" strokeWidth={2} />
                        ))}
                        {G.ticks.map((y) => (
                          <text key={y} className="uv-ax" x={G.xL(y * 12)} y={PB + 24} textAnchor="middle">
                            {String(calAt(y * 12).year)}
                          </text>
                        ))}
                        {tipMonth !== null ? (
                          <g>
                            <line x1={G.xL(tipMonth)} x2={G.xL(tipMonth)} y1={PT} y2={PB} stroke="rgba(41,36,32,0.3)" strokeWidth={1} />
                            <circle cx={G.xL(tipMonth)} cy={G.yL(S.balance[Math.min(tipMonth, S.balance.length - 1)] ?? 0)} r={5} fill="#2a6647" stroke="#fffcf7" strokeWidth={2} />
                          </g>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {G.gridB.map((v) => (
                          <g key={v}>
                            <line className="uv-grid" x1={PL} x2={PR} y1={G.yB(v)} y2={G.yB(v)} />
                            <text className="uv-ax" x={PL - 10} y={G.yB(v) + 4} textAnchor="end">{v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}</text>
                          </g>
                        ))}
                        {G.rows.map((row, i) => {
                          const x = G.xB(i) - G.bw / 2;
                          const yP = G.yB(row.principal);
                          const yI = G.yB(row.principal + row.interest);
                          const yE = G.yB(row.principal + row.interest + row.extra);
                          return (
                            <g key={row.n} opacity={tip && tip.i !== i ? 0.55 : 1}>
                              <rect x={x} y={yP} width={G.bw} height={Math.max(0, PB - yP)} fill="#292420" rx={2} />
                              <rect x={x} y={yI} width={G.bw} height={Math.max(0, yP - yI)} fill="#c9b48f" rx={2} />
                              {row.extra > 0 ? <rect x={x} y={yE} width={G.bw} height={Math.max(0, yI - yE)} fill="#2a6647" rx={2} /> : null}
                            </g>
                          );
                        })}
                        {G.rows.map((row, i) =>
                          i % G.stepYr === 0 || i === G.rows.length - 1 ? (
                            <text key={row.n} className="uv-ax" x={G.xB(i)} y={PB + 24} textAnchor="middle">{row.calYear}</text>
                          ) : null,
                        )}
                      </>
                    )}
                  </svg>
                  {tip ? (
                    <div className="uv-tooltip" style={{ left: tip.x > (hostRef.current?.offsetWidth ?? 0) - 220 ? tip.x - 210 : tip.x + 14, top: Math.max(0, tip.y - 90) }}>
                      {tipRow ? (
                        <>
                          <div className="uv-tt-d">{tipRow.n}. rok · {tipRow.calYear}</div>
                          <div>Istina <b>{fmt(tipRow.principal)}</b></div>
                          <div>Úroky <b>{fmt(tipRow.interest)}</b></div>
                          {tipRow.extra > 0 ? <div>Mimoriadne <b>{fmt(tipRow.extra)}</b></div> : null}
                          <div>Zostatok <b>{fmt(tipRow.balance)}</b></div>
                        </>
                      ) : tipMonth !== null ? (
                        <>
                          <div className="uv-tt-d">{tipMonth === 0 ? "začiatok" : dateOf(calAt(tipMonth))}</div>
                          <div>Zostatok <b>{fmt(S.balance[Math.min(tipMonth, S.balance.length - 1)] ?? 0)}</b></div>
                          {r.hasExtras ? <div>Bez mimoriadnych <b>{fmt(r.base.balance[Math.min(tipMonth, r.base.balance.length - 1)] ?? 0)}</b></div> : null}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* citlivosť na úrok */}
              <div className="uv-sens">
                <p className="uv-sens-title">Čo urobí úrok so splátkou</p>
                <div className="uv-sens-row" role="group" aria-label="Iný úrok">
                  {r.sensitivity.map((s) => (
                    <button key={s.rate} type="button" className={`uv-sens-chip${s.rate === D.rate ? " is-on" : ""}`} aria-pressed={s.rate === D.rate} onClick={() => setNum("rate", s.rate)}>
                      <span>{f2(s.rate)} %</span>
                      <b>{fmt2(s.payment)}</b>
                      <small>úroky {fmt(s.interest)}</small>
                    </button>
                  ))}
                </div>
              </div>

              {/* splátkový kalendár */}
              <button type="button" className="uv-collapse uv-collapse--table" aria-expanded={tableOpen} onClick={() => setTableOpen((o) => !o)}>
                <span>Splátkový kalendár</span>
                <span className="uv-collapse-meta">{tableOpen ? "skryť" : "po rokoch, klikni na rok pre mesiace"}</span>
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
                        {r.hasExtras ? <th>Mimoriadne</th> : null}
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
