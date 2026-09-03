import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import "../shared/calculator-toolbar.css";
import "../shared/calc-ui.css";
import "./investicny-byt.css";
import { BONUSY_CTA_LABEL, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";
import { MAP_LABELS, MAP_PATHS } from "../shared/slovakiaMap";

// ===== TYPES & DATA =====
interface KrajData { name: string; m2: number; hist: number; rent2i: number; }
interface TypData  { name: string; short: string; m: number; pk: number; rk: number; cm: number; }

const KRAJE: Record<string, KrajData> = {
  BA: { name: "Bratislava",      m2: 4500, hist: 8.5, rent2i: 870 },
  TT: { name: "Trnava",          m2: 2900, hist: 8.5, rent2i: 680 },
  TN: { name: "Trenčín",         m2: 2600, hist: 8.0, rent2i: 551 },
  NR: { name: "Nitra",           m2: 2700, hist: 8.0, rent2i: 640 },
  ZA: { name: "Žilina",          m2: 3400, hist: 9.0, rent2i: 640 },
  BB: { name: "Banská Bystrica", m2: 2800, hist: 8.5, rent2i: 620 },
  PO: { name: "Prešov",          m2: 2700, hist: 9.5, rent2i: 590 },
  KE: { name: "Košice",          m2: 3500, hist: 9.5, rent2i: 720 },
};

const TYPY: Record<string, TypData> = {
  G:    { name: "Garsónka",      short: "Garsónka",  m: 26, pk: 1.18, rk: 0.65, cm: 110 },
  "1i": { name: "1-izbový byt",  short: "1-izbový",  m: 36, pk: 1.12, rk: 0.80, cm: 130 },
  "2i": { name: "2-izbový byt",  short: "2-izbový",  m: 56, pk: 1.00, rk: 1.00, cm: 160 },
  "3i": { name: "3-izbový byt",  short: "3-izbový",  m: 72, pk: 0.95, rk: 1.30, cm: 190 },
  "4i": { name: "4-izbový byt",  short: "4-izbový",  m: 90, pk: 0.92, rk: 1.60, cm: 220 },
};



const OBSADENOST = 12;
const RENT_G = 0.03;
const COST_G = 0.02;

// Grow rate formula matching original: Math.min(12, Math.round((hist-1)*2)/2)
function defaultGrow(hist: number): number {
  return Math.min(12, Math.round((hist - 1) * 2) / 2);
}

// ===== HELPERS =====
function fmt(n: number): string {
  return new Intl.NumberFormat("sk-SK", { maximumFractionDigits: 0 }).format(Math.round(n)) + " €";
}
function pctFmt(n: number, decimals = 1): string {
  return n.toLocaleString("sk-SK", { maximumFractionDigits: decimals }) + " %";
}
function autoPrice(k: string, t: string): number {
  const K = KRAJE[k], T = TYPY[t];
  return Math.round(K.m2 * T.pk * T.m / 1000) * 1000;
}
function autoRent(k: string, t: string): number {
  const K = KRAJE[k], T = TYPY[t];
  return Math.round(K.rent2i * T.rk / 10) * 10;
}
function mortgageFn(V0: number, eqPct: number, rate: number, termY: number, t: number) {
  const loan = V0 * (1 - eqPct / 100);
  if (loan <= 0) return { balance: 0, payment: 0 };
  const r = rate / 100 / 12, n = termY * 12;
  const m = Math.min(t * 12, n);
  const pay = loan * r / (1 - Math.pow(1 + r, -n));
  const bal = m >= n ? 0 : loan * Math.pow(1 + r, m) - pay * (Math.pow(1 + r, m) - 1) / r;
  return { balance: Math.max(0, bal), payment: pay };
}
function cumCF(R0: number, CM: number, CY: number, Y: number, useM: boolean, payment: number, termY: number) {
  let najmy = 0, naklady = 0, splatky = 0;
  for (let t = 0; t < Y; t++) {
    najmy += R0 * Math.pow(1 + RENT_G, t) * OBSADENOST;
    naklady += (CM * 12 + CY) * Math.pow(1 + COST_G, t);
    if (useM && t < termY) splatky += payment * 12;
  }
  return { najmy, naklady, splatky, net: najmy - naklady - splatky };
}
// Matches original: a=[38,53,43] to b=[91,199,138]
/** Choropleth mapy na svetlom plátne: krém (lacnejší m²) → lesná zelená (drahší m²). */


const fmtS = (n: number) => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`;

// ===== RANGE FIELD =====
const RangeField = ({ label, value, min, max, step, unit = "", onChange, extra }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void; extra?: React.ReactNode }) => (
  <div className="iby-field">
    <div className="calc-label"><span>{label}</span><span className="calc-label-value">{value.toLocaleString("sk-SK")}{unit}</span></div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} className="calc-slider" style={{ "--p": `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties} />
    {extra}
  </div>
);

// ===== KPI =====
const Kpi = ({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: "neutral" | "good" | "bad" | "accent" }) => (
  <div className={`iby-kpi iby-kpi--${tone}`}>
    <span className="calc-stat-label">{label}</span>
    <span className="calc-stat-value">{value}</span>
    {sub ? <span className="calc-stat-sub">{sub}</span> : null}
  </div>
);

// ===== MAIN COMPONENT =====
const InvesticnyBytCalculator = () => {
  const [kraj, setKraj] = useState("ZA");
  const [typ, setTyp] = useState("2i"); // G | 1i | 2i | 3i | 4i | X
  const [costM, setCostM] = useState(160);
  const [costY, setCostY] = useState(300);
  const [customPrice, setCustomPrice] = useState(225000);
  const [customRent, setCustomRent] = useState(700);
  const [grow, setGrow] = useState(() => defaultGrow(KRAJE["ZA"].hist));
  const [years, setYears] = useState(20);
  const [useMort, setUseMort] = useState(true);
  const [equity, setEquity] = useState(20);
  const [mortRate, setMortRate] = useState(3.8);
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0, flip: false, containerW: 0 });
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const [resultVisible, setResultVisible] = useState(false);
  useEffect(() => {
    const el = resultRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setResultVisible(e.isIntersecting), { rootMargin: "0px 0px -20% 0px", threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const K = KRAJE[kraj];
  const price = typ === "X" ? customPrice : autoPrice(kraj, typ);
  const rent  = typ === "X" ? customRent  : autoRent(kraj, typ);
  const g = grow / 100;
  const Y = years;

  const mort0 = useMemo(() => useMort ? mortgageFn(price, equity, mortRate, 30, 0) : { balance: 0, payment: 0 }, [price, equity, mortRate, useMort]);
  const mortY = useMemo(() => useMort ? mortgageFn(price, equity, mortRate, 30, Y) : { balance: 0, payment: 0 }, [price, equity, mortRate, Y, useMort]);
  const VT = price * Math.pow(1 + g, Y);
  const CF = useMemo(() => cumCF(rent, costM, costY, Y, useMort, mort0.payment, 30), [rent, costM, costY, Y, useMort, mort0.payment]);
  const wealth = VT - mortY.balance + CF.net;
  const vklad = useMort ? price * equity / 100 : price;
  const cfNow = rent * OBSADENOST / 12 - (costM + costY / 12) - (useMort ? mort0.payment : 0);
  const yieldPct = price > 0 ? (rent * OBSADENOST - costM * 12 - costY) / price * 100 : 0;
  const multiple = vklad > 0 ? wealth / vklad : 0;

  // Chart
  const W = 1100, HC = 400;
  const P = { l: 130, r: 130, t: 18, b: 60 };
  const chartData = useMemo(() =>
    Array.from({ length: Y + 1 }, (_, t) => ({
      t,
      V: price * Math.pow(1 + g, t),
      H: useMort ? mortgageFn(price, equity, mortRate, 30, t).balance : 0,
      R: rent * Math.pow(1 + RENT_G, t) * 12,
      C: (costM * 12 + costY) * Math.pow(1 + COST_G, t),
    })), [price, g, Y, rent, costM, costY, useMort, equity, mortRate]);
  const maxV = useMemo(() => Math.max(...chartData.map(d => d.V)) * 1.06, [chartData]);
  const maxR = useMemo(() => Math.max(...chartData.map(d => Math.max(d.R, d.C))) * 1.15, [chartData]);
  const xFn  = useCallback((t: number) => P.l + (W - P.l - P.r) * t / Y, [Y, P.l, P.r]);
  const yLFn = useCallback((v: number) => HC - P.b - (HC - P.t - P.b) * Math.max(0, v) / maxV, [maxV, P.b, P.t]);
  const yRFn = useCallback((v: number) => HC - P.b - (HC - P.t - P.b) * Math.max(0, v) / maxR, [maxR, P.b, P.t]);
  const makePath = (pts: Array<[number, number]>) => pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const vPath = makePath(chartData.map(d => [xFn(d.t), yLFn(d.V)] as [number, number]));
  const hPath = useMort ? makePath(chartData.map(d => [xFn(d.t), yLFn(d.H)] as [number, number])) : "";
  const rPath = makePath(chartData.map(d => [xFn(d.t), yRFn(d.R)] as [number, number]));
  const cPath = makePath(chartData.map(d => [xFn(d.t), yRFn(d.C)] as [number, number]));
  const areaPath = `${vPath} L${xFn(Y).toFixed(1)},${(HC - P.b).toFixed(1)} L${xFn(0).toFixed(1)},${(HC - P.b).toFixed(1)} Z`;

  const handleChartMove = useCallback((clientX: number, clientY: number) => {
    const wrap = chartWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const svgEl = wrap.querySelector("svg");
    if (!svgEl) return;
    const svgRect = svgEl.getBoundingClientRect();
    const sx = (clientX - svgRect.left) / svgRect.width * W;
    let t = Math.round((sx - P.l) / (W - P.l - P.r) * Y);
    t = Math.max(0, Math.min(Y, t));
    setHoverYear(t);
    setTooltipPos({ x: clientX - rect.left, y: clientY - rect.top, flip: (clientX - rect.left) > rect.width * 0.55, containerW: rect.width });
  }, [Y, P.l, P.r]);

  const handleKrajClick = (k: string) => {
    setKraj(k);
    setGrow(defaultGrow(KRAJE[k].hist));
    if (typ !== "X") setCostM(TYPY[typ].cm);
  };
  const handleTypClick = (t: string) => {
    setTyp(t);
    if (t !== "X") setCostM(TYPY[t].cm);
  };

  const gridLines = Array.from({ length: 5 }, (_, i) => ({ vl: maxV * i / 4, vr: maxR * i / 4, yy: yLFn(maxV * i / 4) }));
  const xTicks: number[] = [];
  const step = Y <= 12 ? 2 : 5;
  for (let t = 0; t <= Y; t += step) xTicks.push(t);
  const hd = hoverYear !== null ? chartData[hoverYear] : null;

  const tblTyp = typ === "X" ? "2i" : typ;
  const tableRows = Object.entries(KRAJE).sort((a, b) => b[1].m2 - a[1].m2).map(([k, kd]) => {
    const p = autoPrice(k, tblTyp), r = autoRent(k, tblTyp);
    const proj = p * Math.pow(1 + kd.hist / 100, Y);
    const yld = (r * OBSADENOST - costM * 12 - costY) / p * 100;
    return { k, kd, p, r, proj, yld };
  });
  const bestYield = Math.max(...tableRows.map(r => r.yld));
  const bestProj = Math.max(...tableRows.map(r => r.proj));

  return (
    <div id="iby-root" className="calc-ui iby w-full font-sans text-foreground">
      <div className="calc-body-shell">
        <div className="calc-page">
          <header className="calc-header calc-reveal" style={{ "--i": 0 } as React.CSSProperties}>
            <span className="calc-eyebrow">Investičný byt · interaktívna mapa</span>
          </header>

          {/* ===== Hero ===== */}
          <section className="iby-hero calc-reveal" style={{ "--i": 1 } as React.CSSProperties}>
            <h2 className="iby-hero-title">Koľko ti zarobí byt<br />za <em>{Y} rokov</em>?</h2>
            <p className="iby-hero-lede">Vyber krajské mesto a typ bytu. Ceny kalibrované na aktuálne ponuky (nehnutelnosti.sk), nájmy z Deloitte Rent Index. Žiadne realitkárske rozprávky.</p>
            <ul className="iby-sources" aria-label="Zdroje">
              {[{ l: "NBS + trh", s: "ceny · Q1 2026" }, { l: "Deloitte", s: "nájmy · Q4 2025" }, { l: "8 miest", s: "celé Slovensko" }].map(b => (
                <li key={b.l}><strong>{b.l}</strong><span>{b.s}</span></li>
              ))}
            </ul>
          </section>

          {/* ===== Krok 1: mapa ===== */}
          <section className="iby-section iby-section--map calc-reveal" style={{ "--i": 2 } as React.CSSProperties} aria-label="Krok 1">
            <div className="iby-section-head">
              <span className="iby-stepbadge">Krok 1</span>
              <h3 className="iby-section-title">Klikni na <em>svoj kraj</em></h3>
              <p className="iby-section-sub">Klikni na kraj. Cenu za m², nájom aj rast krajského mesta doplníme za teba.</p>
            </div>
            <div className="iby-map-wrap">
              <svg viewBox="0 0 1000 498" className="iby-map" role="img" aria-label="Mapa krajov Slovenska">
                {Object.entries(MAP_PATHS).map(([k, d]) => (
                  <path key={k} d={d} className={`iby-kraj${k === kraj ? " active" : ""}`} fill={k === kraj ? "#f7efe2" : "#e3d5bd"} onClick={() => handleKrajClick(k)} />
                ))}
                {Object.entries(MAP_LABELS).map(([k, pos]) => (
                  <text key={k} pointerEvents="none" fontFamily="Matter, Gilroy, sans-serif" fontSize="30" fontWeight="700" fill="#292420" textAnchor="middle" x={pos.x} y={pos.y + 12}>{k}</text>
                ))}
              </svg>
            </div>
            <div className="iby-city">
              <div><span className="calc-stat-label">Zvolené mesto</span><strong>{K.name}</strong></div>
              <div><span className="calc-stat-label">Cena za m²</span><strong>{K.m2.toLocaleString("sk-SK")} €</strong></div>
              <div><span className="calc-stat-label">Nájom 2-izb.</span><strong>{fmt(K.rent2i)} / mes.</strong></div>
              <div><span className="calc-stat-label">Rast za 10 rokov</span><strong>{pctFmt(K.hist)} ročne</strong></div>
            </div>
          </section>

          {/* ===== Krok 2: byt ===== */}
          <section className="iby-section calc-reveal" style={{ "--i": 3 } as React.CSSProperties} aria-label="Krok 2">
            <div className="iby-section-head">
              <span className="iby-stepbadge">Krok 2</span>
              <h3 className="iby-section-title">Aký byt riešiš?</h3>
              <p className="iby-section-sub">Cenu, nájom aj typické náklady doplníme automaticky pre <strong>{K.name}</strong>. Všetko si vieš prepísať.</p>
            </div>
            <div className="iby-seg" role="group" aria-label="Typ bytu">
              {(["G", "1i", "2i", "3i", "4i"] as const).map(t => (
                <button key={t} type="button" aria-pressed={typ === t} onClick={() => handleTypClick(t)}>{TYPY[t].short}</button>
              ))}
              <button type="button" aria-pressed={typ === "X"} className="is-dashed" onClick={() => handleTypClick("X")}>Vlastné čísla</button>
            </div>
            {typ !== "X" ? (
              <div className="iby-auto">
                <div><span className="calc-stat-label">Cena bytu</span><strong>{fmt(price)}</strong><small>~{TYPY[typ].m} m² × {Math.round(K.m2 * TYPY[typ].pk).toLocaleString("sk-SK")} €/m² · {K.name}</small></div>
                <div><span className="calc-stat-label">Priemerný nájom s energiami</span><strong>{fmt(rent)} <em>/ mes.</em></strong><small>priemer {K.name}, nájom rastie ~3 % ročne</small></div>
              </div>
            ) : (
              <div className="iby-fields-2">
                <div className="iby-field"><label className="calc-label"><span>Cena bytu</span></label><div className="calc-input-wrap"><input type="number" className="calc-input calc-input--unit" value={customPrice} min={10000} step={1000} onChange={e => setCustomPrice(+e.target.value)} /><span className="calc-input-unit">€</span></div></div>
                <div className="iby-field"><label className="calc-label"><span>Nájom mesačne</span><span className="calc-label-hint">koľko reálne vyberieš</span></label><div className="calc-input-wrap"><input type="number" className="calc-input calc-input--unit" value={customRent} min={0} step={10} onChange={e => setCustomRent(+e.target.value)} /><span className="calc-input-unit">€</span></div></div>
              </div>
            )}
            <div className="iby-fields-2">
              <div className="iby-field"><label className="calc-label"><span>Mesačné náklady z nájmu</span><span className="calc-label-hint">správa, fond opráv · +2 % ročne</span></label><div className="calc-input-wrap"><input type="number" className="calc-input calc-input--unit" value={costM} min={0} step={10} onChange={e => setCostM(+e.target.value)} /><span className="calc-input-unit">€</span></div></div>
              <div className="iby-field"><label className="calc-label"><span>Ročné náklady</span><span className="calc-label-hint">poistenie, daň · +2 % ročne</span></label><div className="calc-input-wrap"><input type="number" className="calc-input calc-input--unit" value={costY} min={0} step={50} onChange={e => setCostY(+e.target.value)} /><span className="calc-input-unit">€</span></div></div>
            </div>
          </section>

          {/* ===== Krok 3: predpoklady ===== */}
          <section className="iby-section calc-reveal" style={{ "--i": 4 } as React.CSSProperties} aria-label="Krok 3">
            <div className="iby-section-head">
              <span className="iby-stepbadge">Krok 3</span>
              <h3 className="iby-section-title">Nastav si <em>predpoklady</em></h3>
              <p className="iby-section-sub">Rast hodnoty, horizont a hypotéka. Výsledok dole sa prepočíta hneď.</p>
            </div>
            <div className="iby-fields-2 iby-fields-2--wide">
              <RangeField label="Rast hodnoty bytu ročne" value={grow} min={0} max={12} step={0.5} unit=" %" onChange={setGrow}
                extra={<p className="iby-hint">Historické tempo kraja za 10 rokov je {pctFmt(K.hist)}. <button type="button" onClick={() => setGrow(K.hist)}>Použiť</button></p>} />
              <RangeField label="Horizont" value={years} min={5} max={30} step={1} unit=" rokov" onChange={setYears} />
            </div>
            <label className="iby-check">
              <input type="checkbox" checked={useMort} onChange={e => setUseMort(e.target.checked)} />
              <span><strong>Kúpa s hypotékou</strong><small>efekt páky: pracuje celý byt, vkladáš len časť</small></span>
            </label>
            {useMort ? (
              <div className="iby-fields-2 iby-fields-2--wide">
                <RangeField label="Vlastné zdroje" value={equity} min={0} max={50} step={5} unit={` % (${fmt(price * equity / 100)})`} onChange={setEquity} />
                <RangeField label="Úrok hypotéky (30 r.)" value={mortRate} min={1} max={7} step={0.1} unit=" %" onChange={setMortRate} />
              </div>
            ) : null}
          </section>

          {/* ===== Výsledok ===== */}
          <section ref={resultRef} className="iby-section iby-section--result" aria-label="Výsledok">
            <div className="iby-summary">
              <div className="iby-summary-main">
                <p className="iby-kicker">Tvoj majetok o {Y} rokov</p>
                <p className="iby-summary-label">
                  {typ === "X" ? "Vlastné zadanie" : TYPY[typ].name} v meste <strong>{K.name}</strong>{useMort ? <> z vlastných <strong>{fmt(vklad)}</strong></> : null}
                </p>
                <p className="iby-summary-value"><span>{fmt(wealth)}</span><em>majetku</em></p>
                <p className="iby-summary-sub">
                  {useMort ? <>znásobenie vkladu <strong>{multiple.toLocaleString("sk-SK", { maximumFractionDigits: 1 })}×</strong> · </> : null}
                  hodnota bytu <strong>{fmt(VT)}</strong> · čistý výnos dnes <strong>{pctFmt(yieldPct)}</strong>
                  {useMort ? <> · cashflow dnes <strong className={cfNow < 0 ? "is-neg" : "is-pos"}>{fmtS(cfNow)} / mes.</strong></> : null}
                </p>
              </div>
            </div>

            <div className="iby-kpis">
              <Kpi label={`Hodnota bytu o ${Y} r.`} value={fmt(VT)} sub={`${pctFmt(grow)} ročne`} tone="accent" />
              <Kpi label={`Nájmy spolu za ${Y} r.`} value={fmt(CF.najmy)} sub="11 mesiacov v roku, +3 % ročne" tone="good" />
              <Kpi label={`Náklady spolu za ${Y} r.`} value={`−${fmt(CF.naklady)}`} sub="správa, fond, poistenie, daň" tone="bad" />
              {useMort ? <Kpi label={`Splátky spolu za ${Y} r.`} value={`−${fmt(CF.splatky)}`} sub={`${fmt(mort0.payment)} / mes. · zostatok ${fmt(mortY.balance)}`} tone="bad" /> : <Kpi label="Hypotéka" value="bez hypotéky" sub="celá cena z vlastných zdrojov" />}
              <Kpi label="Čistý výnos z nájmu dnes" value={`${pctFmt(yieldPct)} p. a.`} sub={yieldPct < 3 ? "pod 3 %, cena je voči nájmu vysoká" : yieldPct > 5 ? "nad 5 %, nadpriemer" : "bežné pásmo SR"} tone={yieldPct < 3 ? "bad" : yieldPct > 5 ? "good" : "neutral"} />
              <Kpi label="Cashflow dnes" value={`${fmtS(cfNow)} / mes.`} sub={cfNow < 0 ? "mesačne dopláčaš" : "byt sa platí sám"} tone={cfNow < 0 ? "bad" : "good"} />
            </div>

            <div className="iby-chart-head">
              <span className="iby-chart-title">Vývoj v čase</span>
              <div className="calc-legend">
                <span className="calc-legend-item"><span className="calc-legend-dot" style={{ background: "#2a6647" }} />Hodnota bytu</span>
                {useMort ? <span className="calc-legend-item"><span className="calc-legend-dot" style={{ background: "#292420" }} />Zostatok hypotéky</span> : null}
                <span className="calc-legend-item"><span className="calc-legend-dot" style={{ background: "#A99D7E" }} />Nájom za rok</span>
                <span className="calc-legend-item"><span className="calc-legend-dot" style={{ background: "#ab4132" }} />Náklady za rok</span>
              </div>
            </div>
            <div className="iby-chart" ref={chartWrapRef} onMouseLeave={() => setHoverYear(null)}>
              <svg viewBox={`0 0 ${W} ${HC}`} className="w-full block" style={{ minHeight: "260px", touchAction: "none" }}
                onMouseMove={e => handleChartMove(e.clientX, e.clientY)}
                onTouchMove={e => { e.preventDefault(); handleChartMove(e.touches[0].clientX, e.touches[0].clientY); }}>
                {gridLines.map(({ vl, vr, yy }, i) => (
                  <g key={i}>
                    <line x1={P.l} x2={W - P.r} y1={yy} y2={yy} stroke="rgba(0,0,0,0.12)" strokeWidth={1} strokeDasharray="2 5" />
                    <text x={P.l - 14} y={yy + 6} textAnchor="end" fontSize={28} fontWeight={600} fill="rgba(0,0,0,0.45)" fontFamily="Gilroy, sans-serif">{Math.round(vl / 1000)}k €</text>
                    <text x={W - P.r + 14} y={yy + 6} textAnchor="start" fontSize={28} fontWeight={600} fill="#8a7d5e" fontFamily="Gilroy, sans-serif">{(vr / 1000).toLocaleString("sk-SK", { maximumFractionDigits: 1 })}k €/r</text>
                  </g>
                ))}
                {xTicks.map(t => (
                  <text key={t} x={xFn(t)} y={HC - 10} textAnchor="middle" fontSize={28} fontWeight={600} fill="rgba(0,0,0,0.45)" fontFamily="Gilroy, sans-serif">{2026 + t}</text>
                ))}
                <path d={areaPath} fill="rgba(41,97,74,0.10)" />
                <path d={vPath} fill="none" stroke="#2a6647" strokeWidth={4} strokeLinejoin="round" />
                {useMort && <path d={hPath} fill="none" stroke="#292420" strokeWidth={3} strokeLinejoin="round" strokeDasharray="8 7" opacity={0.6} />}
                <path d={rPath} fill="none" stroke="#A99D7E" strokeWidth={3.5} strokeLinejoin="round" />
                <path d={cPath} fill="none" stroke="#ab4132" strokeWidth={3} strokeLinejoin="round" strokeDasharray="3 6" />
                {hd && (
                  <>
                    <line x1={xFn(hd.t)} x2={xFn(hd.t)} y1={P.t} y2={HC - P.b} stroke="rgba(41,36,32,0.55)" strokeWidth={2} strokeDasharray="6 5" />
                    <circle cx={xFn(hd.t)} cy={yLFn(hd.V)} r={7} fill="#2a6647" stroke="#fff" strokeWidth={3} />
                    {useMort && <circle cx={xFn(hd.t)} cy={yLFn(hd.H)} r={6} fill="#292420" stroke="#fff" strokeWidth={3} />}
                    <circle cx={xFn(hd.t)} cy={yRFn(hd.R)} r={6} fill="#A99D7E" stroke="#fff" strokeWidth={3} />
                    <circle cx={xFn(hd.t)} cy={yRFn(hd.C)} r={6} fill="#ab4132" stroke="#fff" strokeWidth={3} />
                  </>
                )}
              </svg>
              {hd && (
                <div className="iby-tooltip" style={{ left: Math.min(Math.max(4, tooltipPos.flip ? tooltipPos.x - 234 : tooltipPos.x + 16), tooltipPos.containerW > 0 ? tooltipPos.containerW - 238 : tooltipPos.x + 16), top: Math.max(6, tooltipPos.y - 30) }}>
                  <div className="iby-tooltip-title">Rok {2026 + hd.t} · +{hd.t} r.</div>
                  {([
                    { c: "#f3e9dd", l: "Hodnota bytu", v: fmt(hd.V) },
                    ...(useMort ? [{ c: "#fdf8f2", l: "Zostatok hypotéky", v: fmt(hd.H) }] : []),
                    { c: "#A99D7E", l: "Nájom za rok", v: fmt(hd.R) },
                    { c: "#e9a27e", l: "Náklady za rok", v: fmt(hd.C) },
                  ] as Array<{ c: string; l: string; v: string }>).map(r => (
                    <div key={r.l} className="iby-tooltip-row"><span className="iby-tooltip-dot" style={{ background: r.c }} /><span>{r.l}</span><strong>{r.v}</strong></div>
                  ))}
                </div>
              )}
            </div>
            <p className="iby-formula">Majetok o {Y} rokov = hodnota bytu {fmt(VT)} + nájmy {fmt(CF.najmy)} − náklady {fmt(CF.naklady)}{useMort ? ` − splátky ${fmt(CF.splatky)} − zostatok hypotéky ${fmt(mortY.balance)}` : ""} = <strong>{fmt(wealth)}</strong></p>
          </section>

          {/* ===== Porovnanie ===== */}
          <section className="iby-section" aria-label="Porovnanie">
            <div className="iby-section-head">
              <span className="iby-stepbadge">Porovnanie</span>
              <h3 className="iby-section-title">Ten istý byt v <em>každom krajskom meste</em></h3>
              <p className="iby-section-sub">{typ === "X" ? "Vlastné zadanie" : TYPY[typ].name} · horizont {Y} rokov · historické tempo každého mesta · klikni na riadok a mesto sa prepne</p>
            </div>
            <div className="iby-table-wrap">
              <table className="iby-table">
                <thead><tr><th>Mesto</th><th>Cena bytu</th><th>Nájom / mes.</th><th>Hrubý výnos</th><th>Hist. rast</th><th>Hodnota o {Y} r.</th></tr></thead>
                <tbody>
                  {tableRows.map(row => (
                    <tr key={row.k} onClick={() => handleKrajClick(row.k)} className={row.k === kraj ? "is-active" : ""}>
                      <td><strong>{row.kd.name}</strong></td>
                      <td>{fmt(row.p)}</td>
                      <td>{fmt(row.r)}</td>
                      <td className={row.yld === bestYield ? "is-best" : ""}>{pctFmt(row.yld)}</td>
                      <td>{pctFmt(row.kd.hist)}</td>
                      <td className={row.proj === bestProj ? "is-best" : ""}><strong>{fmt(row.proj)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="iby-cta" aria-label="Ďalší krok">
            <div>
              <h2 className="iby-cta-title">Chceš tento byt prepočítať naostro?</h2>
              <p className="iby-cta-text">Na konzultácii prejdeme reálny inzerát, hypotéku a cashflow. 45 minút, zadarmo, online.</p>
            </div>
            <a href={KONZULTACIA_URL} target="_blank" rel="noopener noreferrer" className="btn-primary iby-btn" data-umami-event="click_konzultacia" data-umami-event-section="investicny-byt">{BONUSY_CTA_LABEL}</a>
          </section>

          <p className="calc-note calc-note--center mt-5 md:mt-6">
            Zdroje a metodika: ceny bytov = priemer krajského mesta kalibrovaný na ponukové ceny (nehnutelnosti.sk, topreality.sk, Q1 2026) a dáta NBS/Bencont. Nájmy: Deloitte Rent Index Q4 2025, orientačná suma vrátane bežných energií. Model: nájom rastie 3 % ročne, náklady 2 % ročne, obsadenosť 11 mesiacov v roku, historické miery rastu sú približné 10-ročné CAGR. Nezohľadňuje daň z príjmu z prenájmu ani rekonštrukcie. Modelový prepočet, nie investičné odporúčanie.
          </p>
        </div>
      </div>

      {/* Plávajúci výsledok — sprevádza pri scrollovaní, skryje sa pri sekcii Výsledok */}
      <button type="button" className={`iby-float${resultVisible ? " is-hidden" : ""}`} onClick={() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} aria-label="Prejsť na výsledok">
        <span className="iby-float-label">Majetok o {Y} r. · {K.name}</span>
        <strong>{fmt(wealth)}</strong>
        <span className="iby-float-sub">{useMort ? `z vlastných ${fmt(vklad)} · ` : ""}{fmtS(cfNow)} / mes. ↓</span>
      </button>
    </div>
  );
};

export default InvesticnyBytCalculator;
