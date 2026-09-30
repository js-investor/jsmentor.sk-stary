import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode, RefObject } from "react";
import { dayOf, firstOnOrAfter, niceStep, sampleIndexes, ymdOf, type Dataset, type Result, type Rolling } from "./investicnaStrategiaModel";
import { MONTHS_SHORT, compact, dateLong, money, monthYear, pct, signedPct } from "./investicnaStrategiaFormat";

/**
 * Investičná stratégia – grafy (ručne kreslené SVG v skutočných pixeloch, šírku určuje kontajner).
 * Farby: výsledok stratégie zelená (jediný akcent), porovnania atramentom. Zložky portfólia tvoria hnedú škálu:
 * akcie atrament, dlhopisy taupe, peňažný fond béžová.
 */

const GREEN = "#2a6647";
const INK = "#292420";
const TAUPE = "#a99d7e";
const BEIGE = "#e3d5bd";
const IVORY = "#fffcf7";

/* ------------------------------------------------------------------ spoločné */

const useWidth = (ref: RefObject<HTMLDivElement>): number => {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setW(Math.round(el.getBoundingClientRect().width));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
};

type Tick = { x: number; label: string };

/** popisky časovej osi: roky, pri krátkom období mesiace; vždy s rozostupom aspoň `gap` px */
const timeTicks = (startDay: number, endDay: number, x: (day: number) => number, left: number, right: number, gap: number): Tick[] => {
  const total = Math.max(1, endDay - startDay);
  const width = right - left;
  const out: Tick[] = [];
  const push = (day: number, label: string) => {
    const px = x(day);
    if (px >= left + 2 && px <= right - 6) out.push({ x: px, label });
  };
  if (total / 365.25 >= 2.5) {
    const step = [1, 2, 5, 10, 20, 25].find((s) => (width * s * 365.25) / total >= gap) ?? 50;
    for (let y = Math.ceil(ymdOf(startDay).y / step) * step; y <= ymdOf(endDay).y; y += step) push(dayOf(`${y}-01-01`), String(y));
    return out;
  }
  const step = [1, 2, 3, 6].find((s) => (width * s * 30.44) / total >= gap) ?? 12;
  const a = ymdOf(startDay);
  const b = ymdOf(endDay);
  for (let k = Math.ceil((a.y * 12 + a.m - 1) / step) * step; k <= b.y * 12 + b.m - 1; k += step) {
    const y = Math.floor(k / 12);
    const m = k - y * 12;
    push(dayOf(`${y}-${String(m + 1).padStart(2, "0")}-01`), `${MONTHS_SHORT[m]} ${String(y).slice(2)}`);
  }
  return out;
};

const uniform = (n: number, count: number): number[] => {
  if (n <= count) return Array.from({ length: n }, (_, i) => i);
  const out: number[] = [];
  for (let k = 0; k < count; k++) out.push(Math.round((k * (n - 1)) / (count - 1)));
  return out;
};

const Tip = ({ x, width, top, children }: { x: number; width: number; top: number; children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(200);
  /* šírka bubliny závisí od obsahu, preto sa meria po každej zmene obsahu */
  useLayoutEffect(() => {
    if (ref.current) setW(ref.current.offsetWidth);
  }, [children]);
  const left = x + 14 + w <= width ? x + 14 : Math.max(0, x - 14 - w);
  return (
    <div ref={ref} className="ist-tip" style={{ left, top }} role="status">
      {children}
    </div>
  );
};

const pointerX = (e: PointerEvent<HTMLDivElement>, host: HTMLDivElement | null): number => (host ? e.clientX - host.getBoundingClientRect().left : 0);

/* ------------------------------------------------------------------ hodnota účtu + zloženie */

export type ValueChartProps = {
  ds: Dataset;
  r: Result;
  scale: "lin" | "log";
  show: { stocks: boolean; flat: boolean; paid: boolean };
  /** pripnutý deň (index v období) */
  pinned: number | null;
  onPin: (j: number | null) => void;
};

export const ValueChart = ({ ds, r, scale, show, pinned, onPin }: ValueChartProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const W = useWidth(hostRef);
  const [hov, setHov] = useState<number | null>(null);
  const small = W < 560;
  const flat = show.flat ? r.flat : null;
  const stocks = show.stocks ? r.stocks : null;

  const G = useMemo(() => {
    if (!W) return null;
    const PL = small ? 46 : 64;
    const PR = W - (small ? 8 : 16);
    const PT = 14;
    const plotH = small ? 230 : 320;
    const PB = PT + plotH;
    const ST = PB + 16;
    const SH = small ? 30 : 36;
    const SB = ST + SH;
    const H = SB + 30;
    const n = r.n;
    const span = Math.max(1, r.endDay - r.startDay);
    const xDay = (day: number) => PL + ((day - r.startDay) / span) * (PR - PL);
    const x = (j: number) => xDay(ds.day[r.i0 + j]);

    const lines = [r.strategy.value, ...(stocks ? [stocks.value] : []), ...(flat ? [flat.value] : []), ...(show.paid ? [r.paid] : [])];
    let top = 0;
    let low = Infinity;
    for (const s of lines)
      for (let j = 0; j < n; j++) {
        if (s[j] > top) top = s[j];
        if (s[j] > 0 && s[j] < low) low = s[j];
      }
    if (!(top > 0)) top = 1;
    if (!Number.isFinite(low)) low = 1;

    let y: (v: number) => number;
    const grid: number[] = [];
    if (scale === "log") {
      const lo = Math.floor(Math.log10(low));
      const hi = Math.max(lo + 1, Math.ceil(Math.log10(top)));
      y = (v) => PB - ((Math.log10(Math.max(v, Math.pow(10, lo))) - lo) / (hi - lo)) * plotH;
      for (let e = lo; e <= hi; e++) {
        grid.push(Math.pow(10, e));
        if (hi - lo <= 2 && e < hi) grid.push(2 * Math.pow(10, e), 5 * Math.pow(10, e));
      }
    } else {
      const step = niceStep(top / (small ? 3.4 : 4.6));
      const max = Math.ceil((top * 1.02) / step) * step;
      y = (v) => PB - (v / max) * plotH;
      for (let v = 0; v <= max + step / 2; v += step) grid.push(v);
    }

    const buckets = Math.max(120, Math.min(420, Math.round((PR - PL) / 2)));
    const path = (s: Float64Array) =>
      sampleIndexes(s, buckets)
        .map((j, k) => `${k ? "L" : "M"}${x(j).toFixed(1)} ${y(s[j]).toFixed(1)}`)
        .join("");
    const area = (s: Float64Array) => `${path(s)}L${x(n - 1).toFixed(1)} ${PB}L${x(0).toFixed(1)} ${PB}Z`;

    /* zloženie portfólia: tri vrstvy nad sebou */
    const pick = uniform(n, Math.max(60, Math.min(360, Math.round((PR - PL) / 2))));
    const sy = (share: number) => SB - share * SH;
    const edge = (f: (j: number) => number) => pick.map((j) => `${x(j).toFixed(1)} ${sy(f(j)).toFixed(1)}`);
    const band = (upper: string[], lower: string[]) => `M${upper.join("L")}L${[...lower].reverse().join("L")}Z`;
    const zero = edge(() => 0);
    const eStock = edge((j) => r.shareStock[j]);
    const eBond = edge((j) => Math.min(1, r.shareStock[j] + r.shareBond[j]));
    const one = edge(() => 1);

    return {
      PL, PR, PT, PB, ST, SH, SB, H, x, y, xDay, grid,
      strategy: path(r.strategy.value),
      strategyArea: area(r.strategy.value),
      stocks: stocks ? path(stocks.value) : "",
      flat: flat ? path(flat.value) : "",
      paid: show.paid ? path(r.paid) : "",
      paidArea: show.paid ? area(r.paid) : "",
      bandStock: band(eStock, zero),
      bandBond: band(eBond, eStock),
      bandCash: band(one, eBond),
      ticks: timeTicks(r.startDay, r.endDay, xDay, PL, PR, small ? 50 : 64),
    };
  }, [W, small, r, ds, scale, stocks, flat, show.paid]);

  const indexAt = (px: number): number => {
    if (!G) return 0;
    const day = r.startDay + ((px - G.PL) / (G.PR - G.PL)) * (r.endDay - r.startDay);
    const i = Math.max(r.i0, Math.min(r.i1, firstOnOrAfter(ds.day, Math.round(day))));
    return i - r.i0;
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const jump: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageDown: -252, PageUp: 252 };
    let next: number | null = null;
    if (e.key in jump) next = (pinned ?? r.n - 1) + jump[e.key] * (e.shiftKey && Math.abs(jump[e.key]) === 1 ? 21 : 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = r.n - 1;
    else if (e.key === "Escape") {
      onPin(null);
      return;
    } else return;
    e.preventDefault();
    onPin(Math.max(0, Math.min(r.n - 1, next)));
  };

  const active = hov ?? pinned;
  const j = active === null ? null : Math.max(0, Math.min(r.n - 1, active));
  const crisis = j === null ? null : r.crises.find((c) => j >= c.peak && j <= c.trough) ?? null;
  const gain = j === null ? 0 : r.strategy.value[j] - r.paid[j];

  return (
    <div
      className={`ist-chart-host${small ? " is-small" : ""}`}
      ref={hostRef}
      tabIndex={0}
      role="slider"
      aria-label="Vývoj hodnoty účtu. Šípkami prechádzaš po obchodných dňoch, so Shiftom po mesiacoch."
      aria-valuemin={0}
      aria-valuemax={r.n - 1}
      aria-valuenow={j ?? r.n - 1}
      aria-valuetext={`${dateLong(ds.day[r.i0 + (j ?? r.n - 1)])}, hodnota účtu ${money(r.strategy.value[j ?? r.n - 1], r.currency)}`}
      onKeyDown={onKey}
      onPointerMove={(e) => setHov(indexAt(pointerX(e, hostRef.current)))}
      onPointerLeave={() => setHov(null)}
      onPointerUp={(e) => {
        const at = indexAt(pointerX(e, hostRef.current));
        if (e.pointerType === "mouse") onPin(pinned !== null && G && Math.abs(G.x(pinned) - G.x(at)) < 4 ? null : at);
        else onPin(at);
      }}
      style={{ minHeight: small || !W ? 336 : 432 }}
    >
      {G ? (
        <svg width={W} height={G.H} viewBox={`0 0 ${W} ${G.H}`} className="ist-chart" aria-hidden>
          <defs>
            <linearGradient id="ist-gVal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={GREEN} stopOpacity="0.16" />
              <stop offset="1" stopColor={GREEN} stopOpacity="0" />
            </linearGradient>
          </defs>
          {G.grid.map((v) => (
            <g key={v}>
              <line className="ist-grid" x1={G.PL} x2={G.PR} y1={G.y(v)} y2={G.y(v)} />
              <text className="ist-ax" x={G.PL - 8} y={G.y(v) + 4} textAnchor="end">{compact(v)}</text>
            </g>
          ))}
          {r.crises.map((c) => (
            <rect key={c.id} x={G.x(c.peak)} y={G.PT} width={Math.max(2, G.x(c.trough) - G.x(c.peak))} height={G.PB - G.PT} fill="rgba(41,36,32,0.055)" />
          ))}
          {show.paid ? <path d={G.paidArea} fill="rgba(41,36,32,0.05)" /> : null}
          {show.paid ? <path d={G.paid} fill="none" stroke="rgba(41,36,32,0.42)" strokeWidth={1} /> : null}
          <path d={G.strategyArea} fill="url(#ist-gVal)" />
          {flat ? <path d={G.flat} fill="none" stroke={INK} strokeWidth={1.25} strokeLinejoin="round" opacity={0.5} /> : null}
          {stocks ? <path d={G.stocks} fill="none" stroke={INK} strokeWidth={1.5} strokeDasharray="5 4" strokeLinejoin="round" opacity={0.72} /> : null}
          <path d={G.strategy} fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={G.x(r.n - 1)} cy={G.y(r.strategy.value[r.n - 1])} r={4.5} fill={GREEN} stroke={IVORY} strokeWidth={2} />

          {/* zloženie portfólia */}
          <path d={G.bandCash} fill={BEIGE} />
          <path d={G.bandBond} fill={TAUPE} />
          <path d={G.bandStock} fill={INK} />
          {r.phaseStarts.map((s, k) =>
            k > 0 && s !== null ? <line key={k} x1={G.x(s)} x2={G.x(s)} y1={G.PT} y2={G.SB} stroke={INK} strokeWidth={1} strokeDasharray="2 4" opacity={0.5} /> : null,
          )}
          {G.ticks.map((t) => (
            <text key={t.label} className="ist-ax" x={t.x} y={G.SB + 20} textAnchor="middle">{t.label}</text>
          ))}
          {j !== null ? (
            <g>
              <line x1={G.x(j)} x2={G.x(j)} y1={G.PT} y2={G.SB} stroke={pinned !== null && hov === null ? INK : "rgba(41,36,32,0.38)"} strokeWidth={1} />
              {show.paid ? <circle cx={G.x(j)} cy={G.y(r.paid[j])} r={3.5} fill="#8a8178" stroke={IVORY} strokeWidth={1.5} /> : null}
              {flat ? <circle cx={G.x(j)} cy={G.y(flat.value[j])} r={3.5} fill="#8f8a84" stroke={IVORY} strokeWidth={2} /> : null}
              {stocks ? <circle cx={G.x(j)} cy={G.y(stocks.value[j])} r={4} fill={INK} stroke={IVORY} strokeWidth={2} /> : null}
              <circle cx={G.x(j)} cy={G.y(r.strategy.value[j])} r={5} fill={GREEN} stroke={IVORY} strokeWidth={2} />
            </g>
          ) : null}
        </svg>
      ) : null}
      {G && j !== null ? (
        <Tip x={G.x(j)} width={W} top={G.PT}>
          <div className="ist-tip-d">{dateLong(ds.day[r.i0 + j])}</div>
          <div className="ist-tip-row"><i style={{ background: GREEN }} />Hodnota účtu <b>{money(r.strategy.value[j], r.currency)}</b></div>
          <div className="ist-tip-row"><i style={{ background: "#8a8178" }} />Vklady <b>{money(r.paid[j], r.currency)}</b></div>
          <div className="ist-tip-row ist-tip-row--plain">{gain >= 0 ? "Zisk" : "Strata"} <b>{money(Math.abs(gain), r.currency)}</b></div>
          {stocks ? <div className="ist-tip-row"><i style={{ background: INK }} />Len akcie <b>{money(stocks.value[j], r.currency)}</b></div> : null}
          {flat ? <div className="ist-tip-row"><i style={{ background: "#8f8a84" }} />Bez zmeny <b>{money(flat.value[j], r.currency)}</b></div> : null}
          <div className="ist-tip-mix">
            Zloženie {Math.round(r.shareStock[j] * 100)} / {Math.round(r.shareBond[j] * 100)} / {Math.max(0, 100 - Math.round(r.shareStock[j] * 100) - Math.round(r.shareBond[j] * 100))}
          </div>
          {crisis ? <div className="ist-tip-note">{crisis.name}</div> : null}
        </Tip>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ prepady */

const underwater = (unit: Float64Array): Float64Array => {
  const out = new Float64Array(unit.length);
  let peak = unit[0];
  for (let j = 0; j < unit.length; j++) {
    if (unit[j] > peak) peak = unit[j];
    out[j] = unit[j] / peak - 1;
  }
  return out;
};

export const DrawdownChart = ({ ds, r, withStocks }: { ds: Dataset; r: Result; withStocks: boolean }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const W = useWidth(hostRef);
  const [hov, setHov] = useState<number | null>(null);
  const small = W < 560;
  const dd = useMemo(() => ({ s: underwater(r.strategy.unit), k: underwater(r.stocks.unit) }), [r]);

  const G = useMemo(() => {
    if (!W) return null;
    const PL = small ? 46 : 64;
    const PR = W - (small ? 8 : 16);
    const PT = 18;
    const plotH = small ? 170 : 210;
    const PB = PT + plotH;
    const H = PB + 30;
    const span = Math.max(1, r.endDay - r.startDay);
    const xDay = (day: number) => PL + ((day - r.startDay) / span) * (PR - PL);
    const x = (j: number) => xDay(ds.day[r.i0 + j]);
    const deepest = Math.min(r.strategy.drawdown.depth, withStocks ? r.stocks.drawdown.depth : 0, -0.02);
    const step = niceStep(Math.abs(deepest) / (small ? 3 : 4));
    const bottom = -Math.ceil(Math.abs(deepest) / step - 1e-9) * step;
    const y = (v: number) => PT + (v / bottom) * plotH;
    const grid: number[] = [];
    for (let v = 0; v >= bottom - step / 2; v -= step) grid.push(v);
    const buckets = Math.max(120, Math.min(420, Math.round((PR - PL) / 2)));
    const path = (s: Float64Array) =>
      sampleIndexes(s, buckets)
        .map((j, k) => `${k ? "L" : "M"}${x(j).toFixed(1)} ${y(s[j]).toFixed(1)}`)
        .join("");
    return {
      PL, PR, PT, PB, H, x, y, grid,
      s: path(dd.s),
      sArea: `${path(dd.s)}L${x(r.n - 1).toFixed(1)} ${PT}L${x(0).toFixed(1)} ${PT}Z`,
      k: withStocks ? path(dd.k) : "",
      ticks: timeTicks(r.startDay, r.endDay, xDay, PL, PR, small ? 50 : 64),
    };
  }, [W, small, r, ds, dd, withStocks]);

  const indexAt = (px: number): number => {
    if (!G) return 0;
    const day = r.startDay + ((px - G.PL) / (G.PR - G.PL)) * (r.endDay - r.startDay);
    return Math.max(r.i0, Math.min(r.i1, firstOnOrAfter(ds.day, Math.round(day)))) - r.i0;
  };
  const low = r.strategy.drawdown;

  return (
    <div
      className={`ist-chart-host${small ? " is-small" : ""}`}
      ref={hostRef}
      role="img"
      aria-label={`Prepady stratégie pod predchádzajúce maximum. Najhlbší prepad ${pct(low.depth)}.`}
      onPointerMove={(e) => setHov(indexAt(pointerX(e, hostRef.current)))}
      onPointerLeave={() => setHov(null)}
      style={{ minHeight: small || !W ? 218 : 258 }}
    >
      {G ? (
        <svg width={W} height={G.H} viewBox={`0 0 ${W} ${G.H}`} className="ist-chart" aria-hidden>
          {G.grid.map((v) => (
            <g key={v}>
              <line className={v === 0 ? "ist-grid ist-grid--zero" : "ist-grid"} x1={G.PL} x2={G.PR} y1={G.y(v)} y2={G.y(v)} />
              <text className="ist-ax" x={G.PL - 8} y={G.y(v) + 4} textAnchor="end">{pct(v, 0)}</text>
            </g>
          ))}
          <path d={G.sArea} fill={GREEN} opacity={0.14} />
          {withStocks ? <path d={G.k} fill="none" stroke={INK} strokeWidth={1.25} strokeDasharray="4 4" strokeLinejoin="round" opacity={0.6} /> : null}
          <path d={G.s} fill="none" stroke={GREEN} strokeWidth={2} strokeLinejoin="round" />
          {low.depth < 0 ? <circle cx={G.x(low.trough)} cy={G.y(low.depth)} r={4.5} fill={GREEN} stroke={IVORY} strokeWidth={2} /> : null}
          {G.ticks.map((t) => (
            <text key={t.label} className="ist-ax" x={t.x} y={G.PB + 20} textAnchor="middle">{t.label}</text>
          ))}
          {hov !== null ? (
            <g>
              <line x1={G.x(hov)} x2={G.x(hov)} y1={G.PT} y2={G.PB} stroke="rgba(41,36,32,0.38)" strokeWidth={1} />
              {withStocks ? <circle cx={G.x(hov)} cy={G.y(dd.k[hov])} r={4} fill={INK} stroke={IVORY} strokeWidth={2} /> : null}
              <circle cx={G.x(hov)} cy={G.y(dd.s[hov])} r={4.5} fill={GREEN} stroke={IVORY} strokeWidth={2} />
            </g>
          ) : null}
        </svg>
      ) : null}
      {G && hov !== null ? (
        <Tip x={G.x(hov)} width={W} top={G.PT + 8}>
          <div className="ist-tip-d">{dateLong(ds.day[r.i0 + hov])}</div>
          <div className="ist-tip-row"><i style={{ background: GREEN }} />Tvoja stratégia <b>{pct(dd.s[hov])}</b></div>
          {withStocks ? <div className="ist-tip-row"><i style={{ background: INK }} />Len akcie <b>{pct(dd.k[hov])}</b></div> : null}
          <div className="ist-tip-mix">{dd.s[hov] < -0.0005 ? "pod predchádzajúcim maximom" : "na novom maxime"}</div>
        </Tip>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ roky */

export const YearBars = ({ r, withStocks }: { r: Result; withStocks: boolean }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const W = useWidth(hostRef);
  const [hov, setHov] = useState<number | null>(null);
  const small = W < 560;
  const rows = r.yearly;

  const G = useMemo(() => {
    if (!W || !rows.length) return null;
    const PL = small ? 46 : 64;
    const PR = W - (small ? 8 : 16);
    const PT = 18;
    const plotH = small ? 190 : 230;
    const PB = PT + plotH;
    const H = PB + 30;
    let lo = 0;
    let hi = 0;
    for (const row of rows) {
      lo = Math.min(lo, row.strategy, withStocks ? row.stock : 0);
      hi = Math.max(hi, row.strategy, withStocks ? row.stock : 0);
    }
    if (hi - lo < 0.04) hi = lo + 0.04;
    const step = niceStep((hi - lo) / (small ? 4 : 5));
    const top = Math.ceil(hi / step - 1e-9) * step;
    const bottom = -Math.ceil(-lo / step - 1e-9) * step;
    const y = (v: number) => PT + ((top - v) / (top - bottom)) * plotH;
    const grid: number[] = [];
    for (let v = bottom; v <= top + step / 2; v += step) grid.push(Math.abs(v) < step / 1e6 ? 0 : v);
    const band = (PR - PL) / rows.length;
    const bar = Math.max(2, Math.min(34, band * 0.68));
    const cx = (k: number) => PL + band * (k + 0.5);
    const every = [1, 2, 5, 10, 20].find((s) => band * s >= (small ? 36 : 44)) ?? 20;
    return { PL, PR, PT, PB, H, y, grid, band, bar, cx, every };
  }, [W, small, rows, withStocks]);

  const row = hov === null ? null : rows[hov];

  return (
    <div
      className={`ist-chart-host${small ? " is-small" : ""}`}
      ref={hostRef}
      role="img"
      aria-label="Výnos stratégie v jednotlivých kalendárnych rokoch."
      onPointerMove={(e) => {
        if (!G) return;
        const k = Math.floor((pointerX(e, hostRef.current) - G.PL) / G.band);
        setHov(k >= 0 && k < rows.length ? k : null);
      }}
      onPointerLeave={() => setHov(null)}
      style={{ minHeight: small || !W ? 238 : 278 }}
    >
      {G ? (
        <svg width={W} height={G.H} viewBox={`0 0 ${W} ${G.H}`} className="ist-chart" aria-hidden>
          {G.grid.map((v) => (
            <g key={v}>
              <line className={v === 0 ? "ist-grid ist-grid--zero" : "ist-grid"} x1={G.PL} x2={G.PR} y1={G.y(v)} y2={G.y(v)} />
              <text className="ist-ax" x={G.PL - 8} y={G.y(v) + 4} textAnchor="end">{pct(v, 0)}</text>
            </g>
          ))}
          {hov !== null ? <rect x={G.PL + G.band * hov} y={G.PT} width={G.band} height={G.PB - G.PT} fill="rgba(41,36,32,0.05)" /> : null}
          {rows.map((it, k) => {
            const y0 = G.y(0);
            const y1 = G.y(it.strategy);
            const h = Math.max(1, Math.abs(y1 - y0));
            return (
              <g key={it.year} opacity={it.partial ? 0.45 : 1}>
                <rect x={G.cx(k) - G.bar / 2} y={Math.min(y0, y1)} width={G.bar} height={h} rx={Math.min(3, G.bar / 2, h / 2)} fill={it.strategy >= 0 ? GREEN : INK} />
                {withStocks ? <circle cx={G.cx(k)} cy={G.y(it.stock)} r={Math.max(1.75, Math.min(3, G.bar / 3))} fill={IVORY} stroke={INK} strokeWidth={1.25} /> : null}
              </g>
            );
          })}
          {rows.map((it, k) =>
            it.year % G.every === 0 || (rows.length <= 3) ? (
              <text key={it.year} className="ist-ax" x={G.cx(k)} y={G.PB + 20} textAnchor="middle">{it.year}</text>
            ) : null,
          )}
        </svg>
      ) : null}
      {G && row && hov !== null ? (
        <Tip x={G.cx(hov)} width={W} top={G.PT + 4}>
          <div className="ist-tip-d">{row.year}{row.partial ? " · neúplný rok" : ""}</div>
          <div className="ist-tip-row"><i style={{ background: row.strategy >= 0 ? GREEN : INK }} />Tvoja stratégia <b>{signedPct(row.strategy)}</b></div>
          <div className="ist-tip-row ist-tip-row--plain">Akcie <b>{signedPct(row.stock)}</b></div>
          <div className="ist-tip-row ist-tip-row--plain">Dlhopisy <b>{signedPct(row.bond)}</b></div>
          <div className="ist-tip-row ist-tip-row--plain">Peňažný fond <b>{signedPct(row.cash)}</b></div>
          <div className="ist-tip-mix">Na konci roka {money(row.value, r.currency)}</div>
        </Tip>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ všetky možné začiatky */

export const RollingChart = ({ roll, currency }: { roll: Rolling; currency: string }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const W = useWidth(hostRef);
  const [hov, setHov] = useState<number | null>(null);
  const small = W < 560;
  const rows = roll.rows;

  const G = useMemo(() => {
    if (!W || !rows.length) return null;
    const PL = small ? 46 : 64;
    const PR = W - (small ? 8 : 16);
    const PT = 18;
    const plotH = small ? 190 : 230;
    const PB = PT + plotH;
    const H = PB + 30;
    const first = rows[0].start;
    const last = rows[rows.length - 1].start;
    const span = Math.max(1, last - first);
    const xDay = (day: number) => (rows.length === 1 ? (PL + PR) / 2 : PL + ((day - first) / span) * (PR - PL));
    let lo = Math.min(0, roll.annMin);
    let hi = Math.max(0, roll.annMax);
    if (hi - lo < 0.02) hi = lo + 0.02;
    const step = niceStep((hi - lo) / (small ? 4 : 5));
    hi = Math.ceil(hi / step - 1e-9) * step;
    lo = -Math.ceil(-lo / step - 1e-9) * step;
    const y = (v: number) => PT + ((hi - v) / (hi - lo)) * plotH;
    const grid: number[] = [];
    for (let v = lo; v <= hi + step / 2; v += step) grid.push(Math.abs(v) < step / 1e6 ? 0 : v);
    const line = rows.map((it, k) => `${k ? "L" : "M"}${xDay(it.start).toFixed(1)} ${y(it.ann).toFixed(1)}`).join("");
    const area = `${line}L${xDay(last).toFixed(1)} ${y(0).toFixed(1)}L${xDay(first).toFixed(1)} ${y(0).toFixed(1)}Z`;
    return { PL, PR, PT, PB, H, xDay, y, grid, line, area, first, last, ticks: timeTicks(first, last, xDay, PL, PR, small ? 50 : 64) };
  }, [W, small, rows, roll.annMin, roll.annMax]);

  const indexAt = (px: number): number => {
    if (!G) return 0;
    const day = G.first + ((px - G.PL) / (G.PR - G.PL)) * (G.last - G.first);
    let best = 0;
    let lo = 0;
    let hi = rows.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (rows[mid].start <= day) {
        best = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return best + 1 < rows.length && rows[best + 1].start - day < day - rows[best].start ? best + 1 : best;
  };
  const row = hov === null ? null : rows[hov];

  return (
    <div
      className={`ist-chart-host${small ? " is-small" : ""}`}
      ref={hostRef}
      role="img"
      aria-label={`Ročný výnos stratégie pre každý možný začiatok na ${roll.horizon} rokov: od ${pct(roll.annMin)} do ${pct(roll.annMax)}.`}
      onPointerMove={(e) => setHov(indexAt(pointerX(e, hostRef.current)))}
      onPointerLeave={() => setHov(null)}
      style={{ minHeight: small || !W ? 238 : 278 }}
    >
      {G ? (
        <svg width={W} height={G.H} viewBox={`0 0 ${W} ${G.H}`} className="ist-chart" aria-hidden>
          <defs>
            <clipPath id="ist-roll-up"><rect x={G.PL} y={G.PT} width={G.PR - G.PL} height={Math.max(0, G.y(0) - G.PT)} /></clipPath>
            <clipPath id="ist-roll-down"><rect x={G.PL} y={G.y(0)} width={G.PR - G.PL} height={Math.max(0, G.PB - G.y(0))} /></clipPath>
          </defs>
          {G.grid.map((v) => (
            <g key={v}>
              <line className={v === 0 ? "ist-grid ist-grid--zero" : "ist-grid"} x1={G.PL} x2={G.PR} y1={G.y(v)} y2={G.y(v)} />
              <text className="ist-ax" x={G.PL - 8} y={G.y(v) + 4} textAnchor="end">{pct(v, 0)}</text>
            </g>
          ))}
          <path d={G.area} fill={GREEN} opacity={0.14} clipPath="url(#ist-roll-up)" />
          <path d={G.area} fill={INK} opacity={0.16} clipPath="url(#ist-roll-down)" />
          <path d={G.line} fill="none" stroke={GREEN} strokeWidth={2} strokeLinejoin="round" clipPath="url(#ist-roll-up)" />
          <path d={G.line} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" clipPath="url(#ist-roll-down)" />
          <circle cx={G.xDay(roll.worst.start)} cy={G.y(roll.worst.ann)} r={4.5} fill={INK} stroke={IVORY} strokeWidth={2} />
          <circle cx={G.xDay(roll.best.start)} cy={G.y(roll.best.ann)} r={4.5} fill={GREEN} stroke={IVORY} strokeWidth={2} />
          {G.ticks.map((t) => (
            <text key={t.label} className="ist-ax" x={t.x} y={G.PB + 20} textAnchor="middle">{t.label}</text>
          ))}
          {row ? (
            <g>
              <line x1={G.xDay(row.start)} x2={G.xDay(row.start)} y1={G.PT} y2={G.PB} stroke="rgba(41,36,32,0.38)" strokeWidth={1} />
              <circle cx={G.xDay(row.start)} cy={G.y(row.ann)} r={4.5} fill={row.ann >= 0 ? GREEN : INK} stroke={IVORY} strokeWidth={2} />
            </g>
          ) : null}
        </svg>
      ) : null}
      {G && row ? (
        <Tip x={G.xDay(row.start)} width={W} top={G.PT + 4}>
          <div className="ist-tip-d">začiatok {monthYear(row.start)}</div>
          <div className="ist-tip-row ist-tip-row--plain">Výnos stratégie <b>{pct(row.ann, 2)} ročne</b></div>
          <div className="ist-tip-row ist-tip-row--plain">Na konci <b>{money(row.final, currency)}</b></div>
          <div className="ist-tip-row ist-tip-row--plain">Vklady <b>{money(row.deposits, currency)}</b></div>
        </Tip>
      ) : null}
    </div>
  );
};
