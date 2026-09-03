import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { Check, ChevronDown, Plus, Sparkles, Trash2, X } from "lucide-react";
import "../shared/calculator-toolbar.css";
import "../shared/calc-ui.css";
import "./vynosnost-bytu.css";
import { DISP, KRAJE, M2RANGE, MESTA, RENT_STAV_K, STAV, type DispKey, type StavKey } from "../skoring-bytov/skoringData";
import {
  DEFAULT_STATE,
  STRESS,
  applyStress,
  dealScore,
  resilience,
  simulate,
  uid,
  verdict,
  type Jedno,
  type Opak,
  type State,
  type StressId,
} from "./vynosnostModel";

const STORAGE_KEY = "jsm_vynosnost_bytu";
type Tab = "net" | "cf" | "long" | "roe" | "stress";

const fmt = (n: number) => `${Math.round(Number.isFinite(n) ? n : 0).toLocaleString("sk-SK")} €`;
const fmtS = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n)).toLocaleString("sk-SK")} €`;
const f1 = (n: number) => n.toFixed(1).replace(".", ",");

const loadState = (): State => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<State>;
    return { ...DEFAULT_STATE, ...parsed, energie: parsed.energie ?? 0, jedno: parsed.jedno ?? DEFAULT_STATE.jedno, opak: parsed.opak ?? DEFAULT_STATE.opak };
  } catch {
    return DEFAULT_STATE;
  }
};

/** Plynulé dobehnutie čísla k cieľu. */
function useCountUp(target: number, ms = 650): number {
  const [v, setV] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(from + (target - from) * e));
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

/* ------------------------------------------------------------------ pomocné prvky */

const NumField = ({ label, hint, unit, value, step, min, max, compact = false, size, onChange }: { label: string; hint?: string; unit: string; value: number; step: number; min?: number; max?: number; compact?: boolean; size?: "lg"; onChange: (v: number) => void }) => {
  const decimals = Math.max(0, (String(step).split(".")[1] ?? "").length);
  const clamp = (v: number) => {
    const c = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, Number.isFinite(v) ? v : 0));
    return Number(c.toFixed(decimals));
  };
  const [editing, setEditing] = useState(false);
  if (size === "lg") {
    /* Výrokové pole (Wealthsimple): veľké serifové číslo s oddeľovačmi tisícov, ± ako okrúhle tlačidlá. Mimo editácie sa zobrazuje formátovaná hodnota. */
    const shown = editing ? (value === 0 ? "" : String(value)) : value === 0 ? "" : value.toLocaleString("sk-SK");
    return (
      <div className="vb-field vb-field--lg">
        <label className="calc-label">
          <span>{label}</span>
          {hint ? <span className="calc-label-hint">{hint}</span> : null}
        </label>
        <div className="vb-lg-row">
          <div className="vb-lg-input">
            <input
              type="text"
              inputMode="decimal"
              value={shown}
              placeholder="0"
              onFocus={() => setEditing(true)}
              onBlur={() => setEditing(false)}
              onChange={(e) => onChange(clamp(Number(e.target.value.replace(/[^0-9.,-]/g, "").replace(",", "."))))}
              aria-label={label}
            />
            <span className="vb-lg-unit" aria-hidden>{unit}</span>
          </div>
          <span className="vb-lg-steppers">
            <button type="button" aria-label="Znížiť" onClick={() => onChange(clamp(value - step))}>−</button>
            <button type="button" aria-label="Zvýšiť" onClick={() => onChange(clamp(value + step))}>+</button>
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="vb-field">
      <label className="calc-label">
        <span>{label}</span>
        {compact ? <span className="calc-label-hint">{unit}</span> : hint ? <span className="calc-label-hint">{hint}</span> : null}
      </label>
      <div className="calc-input-wrap calc-input-wrap--stepper">
        <input type="number" className="calc-input" inputMode="decimal" value={value === 0 ? "" : value} placeholder="0" step={step} min={min} max={max} onChange={(e) => onChange(clamp(Number(e.target.value)))} />
        <span className="calc-stepper">
          {compact ? null : <span className="calc-stepper-unit" aria-hidden>{unit}</span>}
          <button type="button" aria-label="Znížiť" onClick={() => onChange(clamp(value - step))}>−</button>
          <button type="button" aria-label="Zvýšiť" onClick={() => onChange(clamp(value + step))}>+</button>
        </span>
      </div>
    </div>
  );
};

const Ring = ({ value, size, stroke, color, track, label }: { value: number; size: number; stroke: number; color: string; track: string; label?: string }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="vb-ring" style={{ width: size, height: size }} role="img" aria-label={`Deal skóre ${value} zo 100`}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.2,0.7,0.2,1)" }} />
      </svg>
      <span style={{ color, fontSize: size * 0.3 }}>{value}</span>
      {label ? <small>{label}</small> : null}
    </div>
  );
};

/* ------------------------------------------------------------------ graf */

type Series = { label: string; data: number[]; color: string; dash?: number[]; width?: number; fill?: boolean };

function useLineChart(canvasRef: React.RefObject<HTMLCanvasElement>, labels: string[], series: Series[], marker: number, active: boolean, tooltipFooter?: (idx: number) => string) {
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const markerPlugin = {
      id: "vbMarker",
      afterDatasetsDraw(chart: Chart) {
        const pt = chart.getDatasetMeta(0).data[marker];
        if (!pt) return;
        const { top, bottom } = chart.chartArea;
        const c = chart.ctx;
        c.save();
        c.beginPath();
        c.moveTo(pt.x, top);
        c.lineTo(pt.x, bottom);
        c.setLineDash([5, 4]);
        c.lineWidth = 1.5;
        c.strokeStyle = "rgba(41, 36, 32, 0.45)";
        c.stroke();
        c.restore();
      },
    };
    const datasets = series.map((s) => ({
      label: s.label,
      data: s.data,
      borderColor: s.color,
      backgroundColor: s.fill
        ? (c2: { chart: Chart }) => {
            const area = c2.chart.chartArea;
            if (!area) return "transparent";
            const g = c2.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
            g.addColorStop(0, s.color.replace(")", ", 0.28)").replace("rgb(", "rgba("));
            g.addColorStop(1, s.color.replace(")", ", 0)").replace("rgb(", "rgba("));
            return g;
          }
        : "transparent",
      borderWidth: s.width ?? 2,
      borderDash: s.dash ?? [],
      fill: s.fill ?? false,
      tension: 0.35,
      pointRadius: (ctx2: { dataIndex: number }) => (ctx2.dataIndex === marker ? 5 : 0),
      pointHoverRadius: 5,
      pointBackgroundColor: (ctx2: { dataIndex: number }) => (ctx2.dataIndex === marker ? "#292420" : s.color),
      pointBorderColor: "#fffcf7",
      pointBorderWidth: 2,
    }));
    if (chartRef.current) {
      chartRef.current.data.labels = labels;
      chartRef.current.data.datasets = datasets;
      chartRef.current.config.plugins = [markerPlugin];
      chartRef.current.update();
      return;
    }
    chartRef.current = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      plugins: [markerPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(41, 36, 32, 0.96)", titleColor: "#f3e9dd", bodyColor: "rgba(243, 233, 221, 0.9)", footerColor: "#d9b15c", padding: 12, cornerRadius: 12, usePointStyle: true,
            titleFont: { family: "Matter, sans-serif", size: 13, weight: 600 }, bodyFont: { family: "Matter, sans-serif", size: 13 }, footerFont: { family: "Matter, sans-serif", size: 13, weight: 600 },
            callbacks: {
              title: (items) => (items.length ? (items[0].dataIndex === 0 ? "Dnes" : `Rok +${items[0].dataIndex}`) : ""),
              label: (c) => `${c.dataset.label}: ${fmt(Number(c.parsed.y))}`,
              footer: (items) => (tooltipFooter && items.length ? tooltipFooter(items[0].dataIndex) : ""),
            },
          },
        },
        scales: {
          y: { border: { display: false }, grid: { color: "rgba(41,36,32,0.08)" } as never, ticks: { maxTicksLimit: 5, color: "rgba(41,36,32,0.5)", font: { family: "Matter, sans-serif", size: 12 }, callback: (v) => `${Math.round(Number(v) / 1000)}k €` } },
          x: { border: { display: false }, grid: { display: false }, ticks: { maxTicksLimit: 8, color: "rgba(41,36,32,0.5)", font: { family: "Matter, sans-serif", size: 12 } } },
        },
      },
    });
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, labels.join(","), JSON.stringify(series.map((s) => s.data)), marker]);
}

/* ------------------------------------------------------------------ komponent */

const VynosnostBytuCalculator = () => {
  const [S, setS] = useState<State>(loadState);
  const [YR, setYR] = useState(0);
  const [tab, setTab] = useState<Tab>("net");
  const [stress, setStress] = useState<StressId[]>([]);
  const [openJedno, setOpenJedno] = useState(false);
  const [openOpak, setOpenOpak] = useState(false);
  const [openTable, setOpenTable] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [preset, setPreset] = useState<{ mesto: string; disp: DispKey; stav: StavKey }>({ mesto: "za", disp: "i2", stav: "ciastocna" });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
    } catch {
      /* súkromný režim */
    }
  }, [S]);

  const base = useMemo(() => simulate(S), [S]);
  const sim = useMemo(() => (stress.length ? simulate(applyStress(S, stress)) : base), [S, stress, base]);
  const score = useMemo(() => dealScore(sim, S), [sim, S]);
  const res = useMemo(() => resilience(S), [S]);
  const survived = res.filter((r) => r.ok).length;
  const v = verdict(score.total);
  const shownScore = useCountUp(score.total);
  const shownWealth = useCountUp(sim.rows[sim.roky].cisty, 900);
  const roky = sim.roky;
  const yr = Math.min(YR, roky);
  const R = sim.rows[yr];
  const R0 = sim.rows[0];
  const RL = sim.rows[roky];
  const mid = sim.rows[Math.round(roky / 2)];
  const rFix = sim.rows[Math.min(sim.fix, roky)];
  const set = <K extends keyof State>(k: K, val: State[K]) => setS((s) => ({ ...s, [k]: val }));
  const updJedno = (id: string, patch: Partial<Jedno>) => setS((s) => ({ ...s, jedno: s.jedno.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  const updOpak = (id: string, patch: Partial<Opak>) => setS((s) => ({ ...s, opak: s.opak.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));

  const labels = useMemo(() => sim.rows.map((r) => (r.y === 0 ? "dnes" : `+${r.y}`)), [sim]);
  const cfCanvas = useRef<HTMLCanvasElement>(null);
  const netCanvas = useRef<HTMLCanvasElement>(null);
  useLineChart(cfCanvas, labels, [
    { label: "Príjmy z nájmu", data: sim.rows.map((r) => r.najomM), color: "rgb(42,102,71)", width: 3, fill: true },
    { label: "Výdavky (splátka + náklady)", data: sim.rows.map((r) => r.spl + r.naklM), color: "rgb(171,65,50)" },
  ], yr, tab === "long", (i) => `Cashflow: ${fmtS(sim.rows[i].cfM)} / mes.`);
  useLineChart(netCanvas, labels, [
    { label: "Čistý majetok", data: sim.rows.map((r) => r.cisty), color: "rgb(42,102,71)", width: 3, fill: true },
    { label: "Hodnota bytu", data: sim.rows.map((r) => r.hodnota), color: "rgb(169, 157, 126)", width: 1.5 },
    { label: "Zostatok hypotéky", data: sim.rows.map((r) => r.dlh), color: "rgb(171,65,50)", dash: [5, 5], width: 1.5 },
    { label: "Rovnaké vložené peniaze v ETF (10 %)", data: sim.etfSeries, color: "rgb(41, 36, 32)", dash: [2, 4], width: 1.5 },
  ], yr, tab === "net");

  // Predvyplnenie z benchmarkov (dáta miest zo skóringu)
  const PM = MESTA[preset.mesto] ?? MESTA.ine20;
  const presetM2 = Math.round((M2RANGE[preset.disp][0] + M2RANGE[preset.disp][1]) / 2);
  const presetCena = Math.round((PM.m2 * DISP[preset.disp].k * STAV[preset.stav].k * presetM2) / 1000) * 1000;
  const presetNajom = Math.round((PM.nj * DISP[preset.disp].rk * RENT_STAV_K[preset.stav]) / 10) * 10;
  const presetEnergie = 150;
  const applyPreset = () => {
    setS((s) => ({ ...s, cena: presetCena, najom: presetNajom + presetEnergie, energie: presetEnergie, hypo: Math.round((presetCena * 0.8) / 1000) * 1000, vlastne: Math.round((presetCena * 0.2) / 1000) * 1000 }));
    setPresetOpen(false);
  };

  const ziskPredaj = R.cisty - sim.kapital;
  const stressDelta = stress.length ? RL.cisty - base.rows[base.roky].cisty : 0;
  const paidPct = S.hypo > 0 ? Math.round((1 - R.dlh / S.hypo) * 100) : 100;
  const story =
    yr === 0
      ? `Dnes: kúpa za ${fmt(S.cena)}, vložený kapitál ${fmt(sim.kapital)}, hypotéka ${fmt(S.hypo)}.`
      : `V roku +${yr} máš do bytu vložených ${fmt(R.vlozene)} vlastných peňazí (${fmt(sim.kapital)} na začiatku + ${fmt(R.doplatky)} doplatkov), splatených ${paidPct} % hypotéky a byt vzrástol o ${fmtS(R.hodnota - S.cena)}.${sim.prvyPlus ? ` Cashflow je v pluse od roku ${sim.prvyPlus.y}.` : " Cashflow ostáva záporný celý čas."}`;

  return (
    <div id="vb-root" className="calc-ui vb w-full font-sans text-foreground">
      <div className="calc-body-shell">
        <div className="calc-page">
          <header className="vb-head vb-reveal" style={{ "--i": 0 } as React.CSSProperties}>
            <span className="calc-eyebrow">Výnosnosť investičného bytu</span>
            <h1 className="vb-title">Oplatí sa tento byt?</h1>
            <p className="vb-lede">Zadaj cenu, nájom a hypotéku. Uvidíš cashflow, výnos na vlastné peniaze a čo byt urobí s tvojím majetkom za {roky} rokov.</p>
          </header>

          {/* ------------------------------------------------------------ Súhrn (KPI pás + deal skóre) */}
          <section className="vb-summary vb-reveal" aria-label="Výsledok" style={{ "--i": 1 } as React.CSSProperties}>
            <div className="vb-summary-main">
              <p className="vb-kicker">Naša prognóza</p>
              <p className="vb-summary-label">Z vložených <strong>{fmt(sim.kapital)}</strong> budeš mať o {roky} rokov</p>
              <p className="vb-summary-value"><span>{fmt(shownWealth)}</span><em>čistého majetku</em></p>
              <div className="vb-summary-metrics">
                <div><span className="vb-metric-label">Výnos na vlastný kapitál</span><strong>{f1(sim.cagr)} % p. a.</strong><small>znásobenie {f1(sim.nasobenie)}×</small></div>
                <div><span className="vb-metric-label">Cashflow dnes</span><strong className={R0.cfM < 0 ? "is-neg" : "is-pos"}>{fmtS(R0.cfM)} / mes.</strong><small>{R0.cfM >= 0 ? "byt sa platí sám" : sim.prvyPlus ? `do plusu v roku ${sim.prvyPlus.y}` : "dopláčaš celý čas"}</small></div>
                <div><span className="vb-metric-label">Byt vs. ETF 10 %</span><strong>{sim.etfCrossYear ? `od roku +${sim.etfCrossYear}` : "neprekoná"}</strong><small>{sim.etfCrossYear ? "byt vyhráva" : `ETF ${fmt(sim.etf)}`}</small></div>
                {stress.length ? <div><span className="vb-metric-label">Stres test</span><strong className={stressDelta < 0 ? "is-neg" : "is-pos"}>{fmtS(stressDelta)}</strong><small>rozdiel v čistom majetku</small></div> : null}
              </div>
            </div>
            <div className={`vb-summary-score vb-score--${v.id}`}>
              <Ring value={shownScore} size={104} stroke={6} color={v.id === "dobry" ? "#2a6647" : v.id === "priemer" ? "#a99d7e" : "#ab4132"} track="rgba(41,36,32,0.08)" label="zo 100" />
              <div className="vb-score-body">
                <span className="vb-score-kicker">Deal skóre</span>
                <span className="vb-tier">{v.label}</span>
                <span className="vb-score-text">{v.text}</span>
                <span className="vb-score-res">Prežije <b>{survived} z {res.length}</b> stres testov</span>
              </div>
            </div>
          </section>

          <div className="vb-layout">
            {/* ------------------------------------------------------------ Vstupy */}
            <aside className="vb-inputs vb-reveal" aria-label="Vstupy" style={{ "--i": 2 } as React.CSSProperties}>
              <div className="vb-inputs-head">
                <h2 className="calc-panel-title">Čísla bytu</h2>
                <p className="calc-panel-sub">Zadaj údaje z inzerátu a ponuky banky. Všetko sa prepočíta hneď.</p>
              </div>

              <div className="vb-preset">
                <button type="button" className="vb-preset-toggle" aria-expanded={presetOpen} onClick={() => setPresetOpen(!presetOpen)}>
                  <Sparkles className="h-4 w-4" aria-hidden /> Predvyplniť z benchmarkov mesta
                  <ChevronDown className="h-3.5 w-3.5" style={{ transform: presetOpen ? "rotate(180deg)" : undefined, marginLeft: "auto" }} aria-hidden />
                </button>
                {presetOpen ? (
                  <div className="vb-preset-body">
                    <select className="calc-input vb-select" value={preset.mesto} onChange={(e) => setPreset({ ...preset, mesto: e.target.value })} aria-label="Mesto">
                      {Object.entries(KRAJE).map(([kr, name]) => (
                        <optgroup key={kr} label={name}>
                          {Object.entries(MESTA).filter(([, m]) => m.kr === kr).map(([k, m]) => <option key={k} value={k}>{m.n}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <div className="vb-fields-2">
                      <select className="calc-input vb-select" value={preset.disp} onChange={(e) => setPreset({ ...preset, disp: e.target.value as DispKey })} aria-label="Dispozícia">
                        {Object.entries(DISP).map(([k, d]) => <option key={k} value={k}>{d.n}</option>)}
                      </select>
                      <select className="calc-input vb-select" value={preset.stav} onChange={(e) => setPreset({ ...preset, stav: e.target.value as StavKey })} aria-label="Stav">
                        {Object.entries(STAV).map(([k, d]) => <option key={k} value={k}>{d.n}</option>)}
                      </select>
                    </div>
                    <p className="vb-note">Benchmark: ~{fmt(presetCena)} za {presetM2} m² · čistý nájom ~{fmt(presetNajom)} + energie {fmt(presetEnergie)} · hypotéka 80 % LTV</p>
                    <button type="button" className="btn-primary vb-btn" onClick={applyPreset}>Použiť tieto čísla</button>
                  </div>
                ) : null}
              </div>

              <section className="vb-group">
                <p className="vb-group-title">Byt a nájom</p>
                <NumField label="Kúpna cena bytu" size="lg" unit="€" value={S.cena} step={1000} min={0} onChange={(x) => set("cena", x)} />
                <NumField label="Nájom celkom" hint="s energiami" size="lg" unit="€ / mes" value={S.najom} step={10} min={0} onChange={(x) => set("najom", x)} />
                <NumField label="Z toho energie a služby" hint="posielaš ďalej" unit="€ / mes" value={S.energie} step={10} min={0} max={S.najom} onChange={(x) => set("energie", Math.min(x, S.najom))} />
                <p className="vb-note vb-note--net" style={{ marginTop: "-0.375rem" }}>Čistý nájom pre teba <strong>{fmt(S.najom - S.energie)} / mes.</strong> Energie sa automaticky započítajú do opakovaných výdavkov, nezadávaj ich tam znova.</p>
                <div className="vb-field">
                  <label className="calc-label"><span>Obsadenosť</span></label>
                  <div className="calc-segment">
                    {([12, 11, 10] as const).map((o) => <button key={o} type="button" aria-pressed={S.obsad === o} onClick={() => set("obsad", o)}>{o} mes.</button>)}
                  </div>
                  <p className="vb-note">{S.obsad === 12 ? "100 % — optimizmus" : S.obsad === 11 ? "91 % — zdravý predpoklad" : "83 % — konzervatívne"}</p>
                </div>
                <div className="vb-fields-2">
                  <NumField label="Rast nájmu" compact unit="%/rok" value={S.gN} step={0.5} min={0} max={15} onChange={(x) => set("gN", x)} />
                  <NumField label="Rast ceny bytu" compact unit="%/rok" value={S.gC} step={0.5} min={0} max={15} onChange={(x) => set("gC", x)} />
                </div>
              </section>

              <section className="vb-group">
                <p className="vb-group-title">Hypotéka</p>
                <div className="vb-fields-lg">
                  <NumField label="Vlastné zdroje" size="lg" unit="€" value={S.vlastne} step={1000} min={0} onChange={(x) => set("vlastne", x)} />
                  <NumField label="Hypotéka" size="lg" unit="€" value={S.hypo} step={1000} min={0} onChange={(x) => set("hypo", x)} />
                </div>
                <div className="vb-fields-2">
                  <NumField label="Úrok" compact unit="%" value={S.urok} step={0.1} min={0} max={20} onChange={(x) => set("urok", x)} />
                  <NumField label="Splatnosť" compact unit="rokov" value={S.roky} step={1} min={5} max={40} onChange={(x) => set("roky", x)} />
                  <NumField label="Fixácia" compact unit="rokov" value={S.fix} step={1} min={1} max={15} onChange={(x) => set("fix", x)} />
                  <NumField label="Úrok po fixácii" compact unit="%" value={S.urok2} step={0.1} min={0} max={20} onChange={(x) => set("urok2", x)} />
                </div>
                <p className="vb-note">
                  LTV <strong>{Math.round(base.ltv)} %</strong> · splátka počas fixácie <strong>{fmt(base.spl1)} / mes.</strong>
                  {Math.abs(base.spl2 - base.spl1) > 1 ? <span className="vb-note-warn"> Po fixácii (rok {base.fix}): ~{fmt(base.spl2)} / mes. ({fmtS(base.spl2 - base.spl1)})</span> : null}
                </p>
              </section>

              <section className="vb-group">
                <button type="button" className="vb-collapse" aria-expanded={openJedno} onClick={() => setOpenJedno(!openJedno)}>
                  <span className="vb-group-title vb-group-title--inline">Jednorazové výdavky <em>{fmt(S.jedno.filter((o) => o.on).reduce((a, o) => a + o.a, 0))}</em></span>
                  <span className="calc-collapse-chevron" style={{ transform: openJedno ? "rotate(180deg)" : undefined }}>▼</span>
                </button>
                {openJedno ? (
                  <div className="vb-items">
                    {S.jedno.map((o) => (
                      <div key={o.id} className={`vb-item${o.on ? "" : " is-off"}`}>
                        <div className="vb-item-head">
                          <input type="text" className="vb-item-name" value={o.n} onChange={(e) => updJedno(o.id, { n: e.target.value })} aria-label="Názov výdavku" />
                          <label className="vb-switch"><input type="checkbox" checked={o.on} onChange={(e) => updJedno(o.id, { on: e.target.checked })} /><span /></label>
                          <button type="button" className="vb-del" aria-label="Zmazať" onClick={() => setS((s) => ({ ...s, jedno: s.jedno.filter((x) => x.id !== o.id) }))}><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                        <div className="vb-item-row">
                          <label>Čiastka €<input type="number" value={o.a} step={10} min={0} onChange={(e) => updJedno(o.id, { a: Number(e.target.value) || 0 })} /></label>
                          <label>Kedy (rok)<input type="number" value={o.y} step={1} min={0} max={40} onChange={(e) => updJedno(o.id, { y: Math.max(0, Math.min(40, Number(e.target.value) || 0)) })} /></label>
                        </div>
                      </div>
                    ))}
                    <button type="button" className="vb-add" onClick={() => setS((s) => ({ ...s, jedno: [...s.jedno, { id: uid(), n: "Nový výdavok", a: 500, y: 0, on: true }] }))}><Plus className="h-3.5 w-3.5" /> Pridať výdavok</button>
                    <p className="vb-note">Výdavky v roku 0 sa pripočítajú k vloženému kapitálu.</p>
                  </div>
                ) : null}
              </section>

              <section className="vb-group">
                <button type="button" className="vb-collapse" aria-expanded={openOpak} onClick={() => setOpenOpak(!openOpak)}>
                  <span className="vb-group-title vb-group-title--inline">Opakované výdavky <em>{fmt(S.energie + S.opak.filter((o) => o.on).reduce((a, o) => a + o.a, 0))} / mes.</em></span>
                  <span className="calc-collapse-chevron" style={{ transform: openOpak ? "rotate(180deg)" : undefined }}>▼</span>
                </button>
                {openOpak ? (
                  <div className="vb-items">
                    <div className="vb-item vb-item--auto">
                      <div className="vb-item-head">
                        <span className="vb-item-name">Energie a služby (z nájmu)</span>
                        <span className="vb-item-auto">automaticky</span>
                      </div>
                      <div className="vb-item-row"><label>Čiastka € / mes.<input type="number" value={S.energie} readOnly /></label><label>Ročný rast %<input type="number" value={S.gN} readOnly /></label></div>
                    </div>
                    {S.opak.map((o) => (
                      <div key={o.id} className={`vb-item${o.on ? "" : " is-off"}`}>
                        <div className="vb-item-head">
                          <input type="text" className="vb-item-name" value={o.n} onChange={(e) => updOpak(o.id, { n: e.target.value })} aria-label="Názov výdavku" />
                          <label className="vb-switch"><input type="checkbox" checked={o.on} onChange={(e) => updOpak(o.id, { on: e.target.checked })} /><span /></label>
                          <button type="button" className="vb-del" aria-label="Zmazať" onClick={() => setS((s) => ({ ...s, opak: s.opak.filter((x) => x.id !== o.id) }))}><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                        <div className="vb-item-row">
                          <label>Čiastka € / mes.<input type="number" value={o.a} step={10} min={0} onChange={(e) => updOpak(o.id, { a: Number(e.target.value) || 0 })} /></label>
                          <label>Ročný rast %<input type="number" value={o.g} step={0.5} min={0} onChange={(e) => updOpak(o.id, { g: Number(e.target.value) || 0 })} /></label>
                        </div>
                      </div>
                    ))}
                    <button type="button" className="vb-add" onClick={() => setS((s) => ({ ...s, opak: [...s.opak, { id: uid(), n: "Nový výdavok", a: 20, g: 3, on: true }] }))}><Plus className="h-3.5 w-3.5" /> Pridať výdavok</button>
                  </div>
                ) : null}
              </section>

              <button type="button" className="vb-reset" onClick={() => { setS(DEFAULT_STATE); setStress([]); setYR(0); }}>Vrátiť predvolené hodnoty</button>
            </aside>

            {/* ------------------------------------------------------------ Výsledok v čase */}
            <section className="vb-result vb-reveal" aria-label="Vývoj v čase" style={{ "--i": 3 } as React.CSSProperties}>
              <div className="vb-views" role="tablist" aria-label="Pohľady">
                {([
                  ["net", "Vývoj majetku"],
                  ["cf", "Cashflow"],
                  ["long", "Nájom vs. výdavky"],
                  ["roe", "Výnosnosť"],
                  ["stress", `Stres test ${survived}/${res.length}`],
                ] as [Tab, string][]).map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} className={`vb-view-pill${tab === id ? " is-active" : ""}`} onClick={() => setTab(id)}>{label}</button>
                ))}
              </div>

              <div className="vb-year">
                <div className="vb-year-head"><span>Rok</span><strong>{yr === 0 ? "dnes" : `+${yr} rokov`}</strong></div>
                <input type="range" className="calc-slider vb-slider" min={0} max={roky} step={1} value={yr} onChange={(e) => setYR(Number(e.target.value))} aria-label="Rok" />
                <div className="calc-slider-scale"><span>dnes</span><span>+{Math.round(roky / 2)} r.</span><span>+{roky} r.</span></div>
                <p className="vb-story"><b>{yr === 0 ? "Dnes." : `Rok +${yr}.`}</b> {story.replace(/^(Dnes: |V roku \+\d+ )/, (m) => (m.startsWith("V roku") ? "Máš" : ""))}</p>
              </div>

              <div className="vb-kpis">
                <div className="vb-kpi"><span className="calc-stat-label">Hodnota bytu</span><span className="calc-stat-value">{fmt(R.hodnota)}</span><span className="calc-stat-sub">{yr === 0 ? "kúpna cena" : `${fmtS(R.hodnota - S.cena)} od kúpy`}</span></div>
                <div className="vb-kpi"><span className="calc-stat-label">Zostatok hypotéky</span><span className="calc-stat-value">{fmt(R.dlh)}</span><span className="calc-stat-sub">splátka {fmt(R.spl)} · splatené {paidPct} %</span></div>
                <div className="vb-kpi"><span className="calc-stat-label">Vložené vlastné zdroje</span><span className="calc-stat-value">{fmt(R.vlozene)}</span><span className="calc-stat-sub">{fmt(sim.kapital)} na začiatku + {fmt(R.doplatky)} doplatkov</span></div>
                <div className="vb-kpi vb-kpi--accent"><span className="calc-stat-label">Čistý majetok</span><span className="calc-stat-value">{fmt(R.cisty)}</span><span className="calc-stat-sub">hodnota − hypotéka + cashflow</span></div>
              </div>

              {tab === "cf" && (
                <div className="vb-view">
                  <div className="vb-view-head"><span className="vb-view-title">Zloženie cashflow</span><span className="vb-view-sub">{yr === 0 ? "dnes" : `v roku +${yr}`}</span></div>
                  <div className="vb-bars">
                    {(() => {
                      const maxV = Math.max(R.najomM, R.spl + R.naklM, 1);
                      const rows: [string, number, string][] = [["Nájom (efektívny)", R.najomM, "#2a6647"], ["Splátka hypotéky", -R.spl, "#A99D7E"], ["Náklady", -R.naklM, "#ab4132"], ["Cashflow", R.cfM, R.cfM >= 0 ? "#2a6647" : "#ab4132"]];
                      if (R.jednoY) rows.push([`Jednorazové (rok ${yr})`, -R.jednoY, "#7a3a2c"]);
                      return rows.map(([name, val, color]) => (
                        <div key={name} className="vb-bar"><span className="vb-bar-name">{name}</span><span className="vb-bar-track"><span className="vb-bar-fill" style={{ width: `${Math.min(100, (Math.abs(val) / maxV) * 100)}%`, background: color }} /></span><span className="vb-bar-val">{fmtS(val)}</span></div>
                      ));
                    })()}
                  </div>
                  <ul className="vb-insights">
                    {R0.cfM >= 0 ? <li className="is-good">Byt je od začiatku <b>cashflow pozitívny</b>.</li> : <li className="is-warn">Na začiatku mesačne dopláčaš <b>{fmt(Math.abs(R0.cfM))}</b>. Nemusí to byť chyba, ale patrí to do rozpočtu a k rezerve.</li>}
                    {sim.prvyPlus && R0.cfM < 0 ? <li>Cashflow sa preklopí do plusu v <b>roku {sim.prvyPlus.y}</b>: nájom rastie, splátka je fixná.</li> : null}
                    {Math.abs(rFix.spl - R0.spl) > 1 ? <li className={rFix.spl > R0.spl ? "is-warn" : ""}><b>Refixácia v roku {sim.fix}:</b> splátka {fmt(R0.spl)} → <b>{fmt(rFix.spl)}</b>, cashflow v tom roku <b>{fmtS(rFix.cfM)}</b> / mes. Vyskúšaj rôzne úroky po fixácii, je to najčastejšie podcenené riziko.</li> : null}
                    <li><b>LTV {Math.round(sim.ltv)} %.</b> {sim.ltv > 85 ? "Silná páka: maximalizuje výnos na vlastný kapitál, ale vyžaduje väčšiu rezervu a stabilný príjem." : sim.ltv > 60 ? "Vyvážený pomer: páka pracuje, riziko je zvládnuteľné." : "Konzervatívne: nižšie riziko, ale páka, hlavná výhoda investičného bytu, je málo využitá."}</li>
                    <li>Výnos z nájmu: hrubý <b>{f1(sim.hruby)} %</b> · čistý <b>{f1(sim.cistyVynos)} %</b> ročne. {sim.cistyVynos < 3 ? "Pod 3 %, cena bytu je voči nájmu vysoká." : sim.cistyVynos > 5 ? "Nad 5 %, nadpriemer pre slovenský trh." : "Bežné pásmo pre slovenský trh."}</li>
                  </ul>
                </div>
              )}

              {tab === "long" && (
                <div className="vb-view">
                  <div className="vb-view-head"><span className="vb-view-title">Mesačné príjmy vs. výdavky</span><div className="calc-legend"><span className="calc-legend-item"><span className="calc-legend-dot" style={{ background: "#2a6647" }} />Príjmy z nájmu</span><span className="calc-legend-item"><span className="calc-legend-dot" style={{ background: "#ab4132" }} />Výdavky</span></div></div>
                  <div className="vb-chart"><canvas ref={cfCanvas} /></div>
                </div>
              )}

              {tab === "net" && (
                <div className="vb-view">
                  <div className="vb-view-head"><span className="vb-view-title">Vývoj majetku v čase</span><div className="calc-legend"><span className="calc-legend-item"><span className="calc-legend-dot" style={{ background: "#2a6647" }} />Čistý majetok</span><span className="calc-legend-item"><span className="calc-legend-dot" style={{ background: "#A99D7E" }} />Hodnota bytu</span><span className="calc-legend-item"><span className="calc-legend-dot" style={{ background: "#ab4132" }} />Hypotéka</span><span className="calc-legend-item"><span className="calc-legend-dot" style={{ background: "#292420" }} />ETF 10 %</span></div></div>
                  <div className="vb-chart vb-chart--tall"><canvas ref={netCanvas} /></div>
                  <div className="calc-statbar vb-cells">
                    <div><p className="calc-stat-label">Dnes</p><p className="calc-stat-value">{fmt(R0.cisty)}</p></div>
                    <div><p className="calc-stat-label">O {Math.round(roky / 2)} r.</p><p className="calc-stat-value">{fmt(mid.cisty)}</p></div>
                    <div><p className="calc-stat-label">O {roky} r.</p><p className="calc-stat-value vb-pos">{fmt(RL.cisty)}</p></div>
                  </div>
                  <ul className="vb-insights">
                    <li className={yr > 0 && yr < 5 ? "is-warn" : "is-good"}><b>Ak predáš {yr === 0 ? "dnes" : `v roku +${yr}`}:</b> cena {fmt(R.hodnota)} − hypotéka {fmt(R.dlh)} + kumulovaný cashflow {fmtS(R.kum)} = <b>zisk {fmtS(ziskPredaj)}</b> voči {fmt(sim.kapital)} vloženým na začiatku. Kumulovaný cashflow je súčet všetkých mesačných plusov a mínusov od kúpy, záporný znamená, že si dopláčal z vlastného.{yr > 0 && yr < 5 ? " Pozor: pri predaji do 5 rokov od nadobudnutia platíš daň zo zisku (19/25 %) a odvody." : yr >= 5 ? " Po 5 rokoch vlastníctva je zisk z predaja oslobodený od dane." : ""}</li>
                    <li>{sim.etfCrossYear ? <>Byt prekoná rovnaký kapitál v ETF pri 10 % p. a. <b>v roku +{sim.etfCrossYear}</b>. Dovtedy je páka drahá, potom pracuje za teba.</> : <>Pri týchto číslach byt <b>neprekoná</b> rovnaký kapitál v ETF pri 10 % p. a. ani na konci horizontu.</>}</li>
                  </ul>
                </div>
              )}

              {tab === "roe" && (
                <div className="vb-view">
                  <div className="vb-view-head"><span className="vb-view-title">Čo zarobia tvoje vlastné peniaze</span><span className="vb-view-sub">za {roky} rokov</span></div>
                  <div className="calc-statbar vb-cells">
                    <div><p className="calc-stat-label">Vložený kapitál</p><p className="calc-stat-value">{fmt(sim.kapital)}</p></div>
                    <div><p className="calc-stat-label">Znásobenie</p><p className="calc-stat-value">{f1(sim.nasobenie)}×</p></div>
                    <div><p className="calc-stat-label">Ročný výnos (CAGR)</p><p className="calc-stat-value vb-pos">{f1(sim.cagr)} %</p></div>
                  </div>
                  <ul className="vb-insights">
                    <li className="is-good"><b>Páka hypotéky:</b> pracuje celý byt za {fmt(S.cena)}, hoci si vložil {fmt(sim.kapital)}. Preto výnos na vlastný kapitál ({f1(sim.cagr)} %) prekonáva samotný rast ceny ({S.gC} %).</li>
                    <li className="is-warn"><b>Páka funguje aj opačne.</b> Pokles cien či výpadok nájmu straty násobí. Minimálna rezerva: 6 mesiacov splátok a nákladov = <b>{fmt(sim.rezerva)}</b>.</li>
                    <li>Ten istý kapitál {fmt(sim.kapital)} v ETF pri 10 % p. a. = <b>{fmt(sim.etf)}</b> o {roky} rokov. Bez nájomníkov, ale aj bez páky. Správna odpoveď býva kombinácia.</li>
                  </ul>
                </div>
              )}

              {tab === "stress" && (
                <div className="vb-view">
                  <div className="vb-view-head"><span className="vb-view-title">Čo sa stane, keď sa niečo pokazí</span><span className="vb-view-sub">zapni scenár a všetko sa prepočíta</span></div>
                  <ul className="vb-stress-list">
                    {STRESS.map((t2) => {
                      const r = res.find((x) => x.id === t2.id);
                      const on = stress.includes(t2.id);
                      return (
                        <li key={t2.id} className={r?.ok ? "is-ok" : "is-fail"}>
                          <div className="vb-stress-main">
                            <span className="vb-stress-badge">{r?.ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}{r?.ok ? "prežije" : "neprežije"}</span>
                            <strong>{t2.label}</strong>
                            <small>{t2.desc} Najhorší cashflow {fmtS(r?.minCf ?? 0)} / mes., výnos {f1(r?.cagr ?? 0)} % p. a.</small>
                          </div>
                          <button type="button" className={`vb-chip${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => setStress((s) => (on ? s.filter((x) => x !== t2.id) : [...s, t2.id]))}>{on ? "Zapnuté" : "Zapnúť"}</button>
                        </li>
                      );
                    })}
                  </ul>
                  <ul className="vb-insights">
                    <li className={survived === res.length ? "is-good" : survived === 0 ? "is-warn" : ""}>{survived === res.length ? <><b>Odolný deal.</b> Prežije všetky tri scenáre. Rezerva 6 mesiacov ({fmt(sim.rezerva)}) je aj tak povinná.</> : survived === 0 ? <><b>Krehký deal.</b> Neprežije ani jeden scenár. Buď vyjednaj cenu, alebo zvýš vlastné zdroje a zníž splátku.</> : <><b>Prežije {survived} z {res.length}.</b> Sleduj najmä ten, ktorý neprežije, a drž rezervu {fmt(sim.rezerva)}.</>}</li>
                  </ul>
                </div>
              )}

              {/* Rozpis po rokoch */}
              <div className="vb-table-block">
                <button type="button" className="vb-collapse vb-collapse--table" aria-expanded={openTable} onClick={() => setOpenTable(!openTable)}>
                  <span>Rozpis po rokoch</span>
                  <span className="vb-collapse-action">{openTable ? "Skryť" : "Zobraziť"} <ChevronDown className="h-3.5 w-3.5" style={{ transform: openTable ? "rotate(180deg)" : undefined }} aria-hidden /></span>
                </button>
                {openTable ? (
                  <div className="vb-table-wrap">
                    <table className="vb-table">
                      <thead><tr><th>Rok</th><th>Hodnota bytu</th><th>Hypotéka</th><th>Nájom / mes.</th><th>Splátka + náklady</th><th>Cashflow / mes.</th><th>Kumul. cashflow</th><th>Vložené spolu</th><th>Čistý majetok</th></tr></thead>
                      <tbody>
                        {sim.rows.map((r) => (
                          <tr key={r.y} className={r.y === yr ? "is-current" : ""}>
                            <td>{r.y === 0 ? "dnes" : `+${r.y}`}</td><td>{fmt(r.hodnota)}</td><td>{fmt(r.dlh)}</td><td>{fmt(r.najomM)}</td><td>{fmt(r.spl + r.naklM)}</td><td className={r.cfM < 0 ? "vb-neg" : "vb-pos"}>{fmtS(r.cfM)}</td><td>{fmtS(r.kum)}</td><td>{fmt(r.vlozene)}</td><td><strong>{fmt(r.cisty)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <p className="calc-note calc-note--center mt-5 md:mt-6">
            Ilustračný prepočet: konštantný rast nájmu a ceny, daň z príjmu len ako paušálna položka v nákladoch. Deal skóre je orientačné zhrnutie výnosu, cashflow a rizika, nie je investičným odporúčaním. Vstupy sa ukladajú iba v tvojom prehliadači.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VynosnostBytuCalculator;
