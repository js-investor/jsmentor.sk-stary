import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode, RefObject } from "react";
import { dayOf, firstOnOrAfter, niceStep, sampleIndexes, ymdOf, type Dataset, type Result, type Weights } from "./investicnaStrategiaModel";
import { MONTHS_SHORT, compact, dateLong, money, num, pct, signedPct } from "./investicnaStrategiaFormat";

/**
 * Investičná stratégia – grafy (ručne kreslené SVG v skutočných pixeloch, šírku určuje kontajner).
 * Farby: výsledok stratégie zelená (jediný akcent), porovnania atramentom. Zložky portfólia tvoria hnedú škálu:
 * akcie atrament, dlhopisy taupe, peňažný fond béžová. Inflácia červená (jediný „náklad“ v grafoch).
 */

export const GREEN = "#2a6647";
export const GREEN_DARK = "#0b3d2e";
export const INK = "#292420";
export const TAUPE = "#a99d7e";
export const BEIGE = "#e3d5bd";
export const RED = "#ab4132";
export const RED_DARK = "#7a2e22";
const IVORY = "#fffcf7";
const STONE_LINE = "rgba(41,36,32,0.42)";

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

/** výška kresliacej plochy podľa šírky kontajnera: veľký graf na počítači, kompaktný na mobile */
const plotHeight = (W: number, kind: "main" | "side"): number => (W >= 900 ? (kind === "main" ? 400 : 320) : W >= 560 ? (kind === "main" ? 320 : 260) : kind === "main" ? 240 : 200);

/** geometria časovej osi grafu pre obdobie výsledku (čistá funkcia, používa sa vnútri useMemo) */
const timeAxis = (ds: Dataset, r: Result, W: number, small: boolean) => {
  const PL = small ? 46 : 64;
  const PR = W - (small ? 8 : 16);
  const span = Math.max(1, r.endDay - r.startDay);
  const xDay = (day: number) => PL + ((day - r.startDay) / span) * (PR - PL);
  const x = (j: number) => xDay(ds.day[r.i0 + j]);
  const indexAt = (px: number): number => {
    const day = r.startDay + ((px - PL) / (PR - PL)) * (r.endDay - r.startDay);
    return Math.max(r.i0, Math.min(r.i1, firstOnOrAfter(ds.day, Math.round(day)))) - r.i0;
  };
  return { PL, PR, xDay, x, indexAt, ticks: timeTicks(r.startDay, r.endDay, xDay, PL, PR, small ? 50 : 64) };
};

/* ------------------------------------------------------------------ vývoj hodnoty + zloženie */

export type ValueChartProps = {
  ds: Dataset;
  r: Result;
  /** pripnutý deň (index v období) */
  pinned: number | null;
  onPin: (j: number | null) => void;
};

export const ValueChart = ({ ds, r, pinned, onPin }: ValueChartProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const W = useWidth(hostRef);
  const [hov, setHov] = useState<number | null>(null);
  const small = W < 560;
  const S = r.strategy;

  const G = useMemo(() => {
    if (!W) return null;
    const T = timeAxis(ds, r, W, small);
    const PT = 18;
    const plotH = plotHeight(W, "main");
    const PB = PT + plotH;
    const ST = PB + 16;
    const SH = small ? 30 : 40;
    const SB = ST + SH;
    const H = SB + 30;
    const n = r.n;
    let top = 0;
    for (let j = 0; j < n; j++) if (S.value[j] > top) top = S.value[j];
    if (!(top > 0)) top = 1;
    /* na mobile o niečo redšie popisy osi, ale bez zbytočného prázdneho miesta nad čiarou */
    const step = niceStep(top / (small ? 4.5 : 5));
    const max = Math.ceil((top * 1.02) / step) * step;
    const buckets = Math.max(120, Math.min(480, Math.round((T.PR - T.PL) / 2)));
    const profit = new Float64Array(n);
    let lowProfit = 0;
    for (let j = 0; j < n; j++) {
      profit[j] = S.value[j] - S.paid[j];
      if (profit[j] < lowProfit) lowProfit = profit[j];
    }
    /* strata pod nulou: os siaha kúsok do mínusu (jemnejší krok), aby bola červená časť čiary zisku vidieť */
    const sub = step / 5;
    const bottomV = lowProfit < 0 ? -Math.ceil(-lowProfit / sub) * sub : 0;
    const y = (v: number) => PB - ((v - bottomV) / (max - bottomV)) * plotH;
    const path = (s: Float64Array) =>
      sampleIndexes(s, buckets)
        .map((j, k) => `${k ? "L" : "M"}${T.x(j).toFixed(1)} ${y(s[j]).toFixed(1)}`)
        .join("");
    const area = (s: Float64Array) => `${path(s)}L${T.x(n - 1).toFixed(1)} ${y(0).toFixed(1)}L${T.x(0).toFixed(1)} ${y(0).toFixed(1)}Z`;
    const grid: number[] = [];
    for (let v = 0; v <= max + step / 2; v += step) grid.push(v);
    if (bottomV < 0) grid.unshift(bottomV);
    /* zloženie portfólia: tri vrstvy nad sebou */
    const pick = uniform(n, Math.max(60, Math.min(360, Math.round((T.PR - T.PL) / 2))));
    const sy = (share: number) => SB - share * SH;
    const edge = (f: (j: number) => number) => pick.map((j) => `${T.x(j).toFixed(1)} ${sy(f(j)).toFixed(1)}`);
    const band = (upper: string[], lower: string[]) => `M${upper.join("L")}L${[...lower].reverse().join("L")}Z`;
    const zero = edge(() => 0);
    const eStock = edge((j) => r.shareStock[j]);
    const eBond = edge((j) => Math.min(1, r.shareStock[j] + r.shareBond[j]));
    const one = edge(() => 1);
    return {
      ...T, PT, PB, ST, SH, SB, H, y, grid, profit, zeroY: y(0), lowProfit,
      value: path(S.value),
      valueArea: area(S.value),
      paid: path(S.paid),
      paidArea: area(S.paid),
      profitLine: path(profit),
      bandStock: band(eStock, zero),
      bandBond: band(eBond, eStock),
      bandCash: band(one, eBond),
    };
  }, [W, small, r, ds, S]);

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
  const cur = r.currency;

  return (
    <div
      className={`ist-chart-host${small ? " is-small" : ""}`}
      ref={hostRef}
      tabIndex={0}
      role="slider"
      aria-label="Vývoj hodnoty investície. Šípkami prechádzaš po obchodných dňoch, so Shiftom po mesiacoch."
      aria-valuemin={0}
      aria-valuemax={r.n - 1}
      aria-valuenow={j ?? r.n - 1}
      aria-valuetext={`${dateLong(ds.day[r.i0 + (j ?? r.n - 1)])}, hodnota ${money(S.value[j ?? r.n - 1], cur)}`}
      onKeyDown={onKey}
      onPointerMove={(e) => G && setHov(G.indexAt(pointerX(e, hostRef.current)))}
      onPointerLeave={() => setHov(null)}
      onPointerUp={(e) => {
        if (!G) return;
        const at = G.indexAt(pointerX(e, hostRef.current));
        if (e.pointerType === "mouse") onPin(pinned !== null && Math.abs(G.x(pinned) - G.x(at)) < 4 ? null : at);
        else onPin(at);
      }}
      style={{ minHeight: !W ? 340 : plotHeight(W, "main") + (W < 560 ? 94 : 104) }}
    >
      {G ? (
        <svg width={W} height={G.H} viewBox={`0 0 ${W} ${G.H}`} className="ist-chart" aria-hidden>
          <defs>
            <linearGradient id="ist-gVal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={GREEN} stopOpacity="0.18" />
              <stop offset="1" stopColor={GREEN} stopOpacity="0" />
            </linearGradient>
            <clipPath id="ist-clip-up"><rect x={G.PL} y={G.PT - 6} width={G.PR - G.PL} height={Math.max(0, G.zeroY - G.PT + 6)} /></clipPath>
            <clipPath id="ist-clip-down"><rect x={G.PL} y={G.zeroY} width={G.PR - G.PL} height={Math.max(0, G.PB - G.zeroY + 6)} /></clipPath>
          </defs>
          {G.grid.map((v) => (
            <g key={v}>
              <line className={v === 0 && G.lowProfit < 0 ? "ist-grid ist-grid--zero" : "ist-grid"} x1={G.PL} x2={G.PR} y1={G.y(v)} y2={G.y(v)} />
              {/* popis záporného kroku len vtedy, keď sa nezrazí s nulou */}
              {v >= 0 || G.y(v) - G.zeroY >= 16 ? <text className="ist-ax" x={G.PL - 8} y={G.y(v) + 4} textAnchor="end">{compact(v)}</text> : null}
            </g>
          ))}
          <path d={G.paidArea} fill="rgba(41,36,32,0.06)" />
          <path d={G.paid} fill="none" stroke={STONE_LINE} strokeWidth={1} />
          <path d={G.valueArea} fill="url(#ist-gVal)" />
          {/* zisk: nad nulou zelený, pod nulou červený */}
          <path d={G.profitLine} fill="none" stroke={GREEN} strokeWidth={1.5} strokeLinejoin="round" opacity={0.55} clipPath="url(#ist-clip-up)" />
          {G.lowProfit < 0 ? <path d={G.profitLine} fill="none" stroke={RED} strokeWidth={1.5} strokeLinejoin="round" opacity={0.8} clipPath="url(#ist-clip-down)" /> : null}
          <path d={G.value} fill="none" stroke={GREEN} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={G.x(r.n - 1)} cy={G.y(S.value[r.n - 1])} r={5} fill={GREEN} stroke={IVORY} strokeWidth={2} />

          {/* zloženie portfólia */}
          <path d={G.bandCash} fill={BEIGE} />
          <path d={G.bandBond} fill={TAUPE} />
          <path d={G.bandStock} fill={INK} />
          {G.ticks.map((t) => (
            <text key={t.label} className="ist-ax" x={t.x} y={G.SB + 20} textAnchor="middle">{t.label}</text>
          ))}
          {j !== null ? (
            <g>
              <line x1={G.x(j)} x2={G.x(j)} y1={G.PT} y2={G.SB} stroke={pinned !== null && hov === null ? INK : "rgba(41,36,32,0.38)"} strokeWidth={1} />
              <circle cx={G.x(j)} cy={G.y(S.paid[j])} r={3.5} fill="#8a8178" stroke={IVORY} strokeWidth={1.5} />
              <circle cx={G.x(j)} cy={G.y(G.profit[j])} r={3.5} fill={G.profit[j] < 0 ? RED : GREEN} fillOpacity={0.75} stroke={IVORY} strokeWidth={1.5} />
              <circle cx={G.x(j)} cy={G.y(S.value[j])} r={5} fill={GREEN} stroke={IVORY} strokeWidth={2} />
            </g>
          ) : null}
        </svg>
      ) : null}
      {G && j !== null ? (
        <Tip x={G.x(j)} width={W} top={G.PT}>
          <div className="ist-tip-d">{dateLong(ds.day[r.i0 + j])}</div>
          <div className="ist-tip-row"><i style={{ background: "#8a8178" }} />Vložené celkom <b>{money(S.paid[j], cur)}</b></div>
          <div className={`ist-tip-row${G.profit[j] < 0 ? " is-loss" : ""}`}><i style={{ background: G.profit[j] < 0 ? RED : GREEN, opacity: 0.8 }} />{G.profit[j] >= 0 ? "Zisk" : "Strata"} <b>{money(Math.abs(G.profit[j]), cur)}</b></div>
          <div className="ist-tip-row"><i style={{ background: GREEN }} />Hodnota <b>{money(S.value[j], cur)}</b></div>
          <div className="ist-tip-mix">
            Zloženie {Math.round(r.shareStock[j] * 100)} / {Math.round(r.shareBond[j] * 100)} / {Math.max(0, 100 - Math.round(r.shareStock[j] * 100) - Math.round(r.shareBond[j] * 100))}
          </div>
        </Tip>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ trhy: z 1 vloženého na začiatku */

const MARKET_SERIES = [
  { key: "stock", label: "Akcie", color: INK, dash: "" },
  { key: "bond", label: "Dlhopisy", color: TAUPE, dash: "" },
  { key: "cash", label: "Peňažný fond", color: "#c8b48c", dash: "" },
  { key: "inflation", label: "Inflácia", color: RED, dash: "5 4" },
] as const;

export const MarketChart = ({ ds, r }: { ds: Dataset; r: Result }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const W = useWidth(hostRef);
  const [hov, setHov] = useState<number | null>(null);
  const small = W < 560;

  const G = useMemo(() => {
    if (!W) return null;
    const T = timeAxis(ds, r, W, small);
    const PT = 14;
    const plotH = plotHeight(W, "side");
    const PB = PT + plotH;
    const H = PB + 30;
    let lo = 1;
    let hi = 1;
    for (const s of MARKET_SERIES)
      for (let j = 0; j < r.n; j++) {
        const v = r.markets[s.key][j];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    /* logaritmická mierka: každé zdvojnásobenie má rovnakú výšku */
    const lLo = Math.log(lo * 0.97);
    const lHi = Math.log(hi * 1.03);
    const y = (v: number) => PB - ((Math.log(Math.max(v, 1e-6)) - lLo) / (lHi - lLo)) * plotH;
    const grid: number[] = [];
    for (const v of [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]) if (v >= lo * 0.97 && v <= hi * 1.03) grid.push(v);
    const buckets = Math.max(120, Math.min(420, Math.round((T.PR - T.PL) / 2)));
    const path = (s: Float64Array) =>
      sampleIndexes(s, buckets)
        .map((j, k) => `${k ? "L" : "M"}${T.x(j).toFixed(1)} ${y(s[j]).toFixed(1)}`)
        .join("");
    return { ...T, PT, PB, H, y, grid, paths: MARKET_SERIES.map((s) => path(r.markets[s.key])) };
  }, [W, small, r, ds]);

  return (
    <div
      className={`ist-chart-host${small ? " is-small" : ""}`}
      ref={hostRef}
      role="img"
      aria-label={`Vývoj trhov v období: z 1 investovaného narástli akcie na ${num(r.markets.stock[r.n - 1], 2)}, dlhopisy na ${num(r.markets.bond[r.n - 1], 2)}, peňažný fond na ${num(r.markets.cash[r.n - 1], 2)}, ceny na ${num(r.markets.inflation[r.n - 1], 2)}.`}
      onPointerMove={(e) => G && setHov(G.indexAt(pointerX(e, hostRef.current)))}
      onPointerLeave={() => setHov(null)}
      style={{ minHeight: !W ? 300 : plotHeight(W, "side") + 44 }}
    >
      {G ? (
        <svg width={W} height={G.H} viewBox={`0 0 ${W} ${G.H}`} className="ist-chart" aria-hidden>
          {G.grid.map((v) => (
            <g key={v}>
              <line className={v === 1 ? "ist-grid ist-grid--zero" : "ist-grid"} x1={G.PL} x2={G.PR} y1={G.y(v)} y2={G.y(v)} />
              <text className="ist-ax" x={G.PL - 8} y={G.y(v) + 4} textAnchor="end">{`${num(v, 2)}×`}</text>
            </g>
          ))}
          {MARKET_SERIES.map((s, k) => (
            <path key={s.key} d={G.paths[k]} fill="none" stroke={s.color} strokeWidth={s.key === "stock" ? 2.25 : 1.75} strokeDasharray={s.dash || undefined} strokeLinejoin="round" />
          ))}
          {G.ticks.map((t) => (
            <text key={t.label} className="ist-ax" x={t.x} y={G.PB + 20} textAnchor="middle">{t.label}</text>
          ))}
          {hov !== null ? (
            <g>
              <line x1={G.x(hov)} x2={G.x(hov)} y1={G.PT} y2={G.PB} stroke="rgba(41,36,32,0.38)" strokeWidth={1} />
              {MARKET_SERIES.map((s) => (
                <circle key={s.key} cx={G.x(hov)} cy={G.y(r.markets[s.key][hov])} r={4} fill={s.color} stroke={IVORY} strokeWidth={1.5} />
              ))}
            </g>
          ) : null}
        </svg>
      ) : null}
      {G && hov !== null ? (
        <Tip x={G.x(hov)} width={W} top={G.PT}>
          <div className="ist-tip-d">{dateLong(ds.day[r.i0 + hov])}</div>
          {MARKET_SERIES.map((s) => (
            <div key={s.key} className="ist-tip-row"><i style={{ background: s.color }} />{s.label} <b>{num(r.markets[s.key][hov], 2)}× ({signedPct(r.markets[s.key][hov] - 1, 0)})</b></div>
          ))}
        </Tip>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ zisk po rokoch */

export const ProfitBars = ({ r, mode }: { r: Result; mode: "money" | "pct" }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const W = useWidth(hostRef);
  const [hov, setHov] = useState<number | null>(null);
  const small = W < 560;
  const rows = r.yearly;
  const cur = r.currency;
  const nom = (y: (typeof rows)[number]) => (mode === "money" ? y.profitNominal : y.returnNominal);
  const rea = (y: (typeof rows)[number]) => (mode === "money" ? y.profitReal : y.returnReal);

  const G = useMemo(() => {
    if (!W || !rows.length) return null;
    const PL = small ? 46 : 64;
    const PR = W - (small ? 8 : 16);
    const PT = 18;
    const plotH = plotHeight(W, "side");
    const PB = PT + plotH;
    const H = PB + 30;
    let lo = 0;
    let hi = 0;
    for (const y of rows) {
      const a = mode === "money" ? y.profitNominal : y.returnNominal;
      const b = mode === "money" ? y.profitReal : y.returnReal;
      lo = Math.min(lo, a, b);
      hi = Math.max(hi, a, b);
    }
    if (hi - lo <= 0) hi = lo + 1;
    const step = niceStep((hi - lo) / (small ? 4 : 5));
    const top = Math.ceil(hi / step - 1e-9) * step;
    const bottom = -Math.ceil(-lo / step - 1e-9) * step;
    const y = (v: number) => PT + ((top - v) / (top - bottom)) * plotH;
    const grid: number[] = [];
    for (let v = bottom; v <= top + step / 2; v += step) grid.push(Math.abs(v) < step / 1e6 ? 0 : v);
    const band = (PR - PL) / rows.length;
    const bar = Math.max(1.5, Math.min(14, band * 0.33));
    const cx = (k: number) => PL + band * (k + 0.5);
    const every = [1, 2, 5, 10, 20].find((s) => band * s >= (small ? 36 : 44)) ?? 20;
    return { PL, PR, PT, PB, H, y, grid, band, bar, cx, every };
  }, [W, small, rows, mode]);

  const row = hov === null ? null : rows[hov];
  const fmt = (v: number) => (mode === "money" ? money(v, cur) : signedPct(v));

  return (
    <div
      className={`ist-chart-host${small ? " is-small" : ""}`}
      ref={hostRef}
      role="img"
      aria-label={mode === "money" ? "Zisk stratégie v jednotlivých rokoch, nominálne a reálne." : "Výnos stratégie v jednotlivých rokoch, nominálne a reálne."}
      onPointerMove={(e) => {
        if (!G) return;
        const k = Math.floor((pointerX(e, hostRef.current) - G.PL) / G.band);
        setHov(k >= 0 && k < rows.length ? k : null);
      }}
      onPointerLeave={() => setHov(null)}
      style={{ minHeight: !W ? 300 : plotHeight(W, "side") + 48 }}
    >
      {G ? (
        <svg width={W} height={G.H} viewBox={`0 0 ${W} ${G.H}`} className="ist-chart" aria-hidden>
          {G.grid.map((v) => (
            <g key={v}>
              <line className={v === 0 ? "ist-grid ist-grid--zero" : "ist-grid"} x1={G.PL} x2={G.PR} y1={G.y(v)} y2={G.y(v)} />
              <text className="ist-ax" x={G.PL - 8} y={G.y(v) + 4} textAnchor="end">{mode === "money" ? compact(v) : pct(v, 0)}</text>
            </g>
          ))}
          {hov !== null ? <rect x={G.PL + G.band * hov} y={G.PT} width={G.band} height={G.PB - G.PT} fill="rgba(41,36,32,0.05)" /> : null}
          {rows.map((it, k) => {
            const y0 = G.y(0);
            const a = G.y(nom(it));
            const b = G.y(rea(it));
            return (
              <g key={it.year} opacity={it.partial ? 0.5 : 1}>
                <rect x={G.cx(k) - G.bar - 1} y={Math.min(y0, a)} width={G.bar} height={Math.max(1, Math.abs(a - y0))} rx={Math.min(2, G.bar / 2)} fill={nom(it) < 0 ? RED : GREEN} />
                <rect x={G.cx(k) + 1} y={Math.min(y0, b)} width={G.bar} height={Math.max(1, Math.abs(b - y0))} rx={Math.min(2, G.bar / 2)} fill={rea(it) < 0 ? RED_DARK : GREEN_DARK} />
              </g>
            );
          })}
          {rows.map((it, k) =>
            it.year % G.every === 0 || rows.length <= 3 ? (
              <text key={it.year} className="ist-ax" x={G.cx(k)} y={G.PB + 20} textAnchor="middle">{it.year}</text>
            ) : null,
          )}
        </svg>
      ) : null}
      {G && row && hov !== null ? (
        <Tip x={G.cx(hov)} width={W} top={G.PT + 4}>
          <div className="ist-tip-d">{row.year}{row.partial ? " · neúplný rok" : ""}</div>
          <div className="ist-tip-row"><i style={{ background: nom(row) < 0 ? RED : GREEN }} />Nominálne <b>{fmt(nom(row))}</b></div>
          <div className="ist-tip-row"><i style={{ background: rea(row) < 0 ? RED_DARK : GREEN_DARK }} />Reálne <b>{fmt(rea(row))}</b></div>
          <div className="ist-tip-mix">{mode === "money" ? `Výnos stratégie ${signedPct(row.returnNominal)}` : `Zisk ${money(row.profitNominal, cur)}`} · na konci roka {money(row.value, cur)}</div>
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
    const T = timeAxis(ds, r, W, small);
    const PT = 18;
    const plotH = plotHeight(W, "side");
    const PB = PT + plotH;
    const H = PB + 30;
    const deepest = Math.min(r.strategy.drawdown.depth, withStocks ? r.stocks.drawdown.depth : 0, -0.02);
    const step = niceStep(Math.abs(deepest) / (small ? 3 : 4));
    const bottom = -Math.ceil(Math.abs(deepest) / step - 1e-9) * step;
    const y = (v: number) => PT + (v / bottom) * plotH;
    const grid: number[] = [];
    for (let v = 0; v >= bottom - step / 2; v -= step) grid.push(v);
    const buckets = Math.max(120, Math.min(420, Math.round((T.PR - T.PL) / 2)));
    const path = (s: Float64Array) =>
      sampleIndexes(s, buckets)
        .map((j, k) => `${k ? "L" : "M"}${T.x(j).toFixed(1)} ${y(s[j]).toFixed(1)}`)
        .join("");
    return { ...T, PT, PB, H, y, grid, s: path(dd.s), sArea: `${path(dd.s)}L${T.x(r.n - 1).toFixed(1)} ${PT}L${T.x(0).toFixed(1)} ${PT}Z`, k: withStocks ? path(dd.k) : "" };
  }, [W, small, r, ds, dd, withStocks]);

  const low = r.strategy.drawdown;

  return (
    <div
      className={`ist-chart-host${small ? " is-small" : ""}`}
      ref={hostRef}
      role="img"
      aria-label={`Prepady stratégie pod predchádzajúce maximum. Najhlbší prepad ${pct(low.depth)}.`}
      onPointerMove={(e) => G && setHov(G.indexAt(pointerX(e, hostRef.current)))}
      onPointerLeave={() => setHov(null)}
      style={{ minHeight: !W ? 300 : plotHeight(W, "side") + 48 }}
    >
      {G ? (
        <svg width={W} height={G.H} viewBox={`0 0 ${W} ${G.H}`} className="ist-chart" aria-hidden>
          {G.grid.map((v) => (
            <g key={v}>
              <line className={v === 0 ? "ist-grid ist-grid--zero" : "ist-grid"} x1={G.PL} x2={G.PR} y1={G.y(v)} y2={G.y(v)} />
              <text className="ist-ax" x={G.PL - 8} y={G.y(v) + 4} textAnchor="end">{pct(v, 0)}</text>
            </g>
          ))}
          <path d={G.sArea} fill={RED} opacity={0.1} />
          {withStocks ? <path d={G.k} fill="none" stroke={INK} strokeWidth={1.25} strokeDasharray="4 4" strokeLinejoin="round" opacity={0.6} /> : null}
          <path d={G.s} fill="none" stroke={RED} strokeWidth={2} strokeLinejoin="round" />
          {low.depth < 0 ? <circle cx={G.x(low.trough)} cy={G.y(low.depth)} r={4.5} fill={RED} stroke={IVORY} strokeWidth={2} /> : null}
          {G.ticks.map((t) => (
            <text key={t.label} className="ist-ax" x={t.x} y={G.PB + 20} textAnchor="middle">{t.label}</text>
          ))}
          {hov !== null ? (
            <g>
              <line x1={G.x(hov)} x2={G.x(hov)} y1={G.PT} y2={G.PB} stroke="rgba(41,36,32,0.38)" strokeWidth={1} />
              {withStocks ? <circle cx={G.x(hov)} cy={G.y(dd.k[hov])} r={4} fill={INK} stroke={IVORY} strokeWidth={2} /> : null}
              <circle cx={G.x(hov)} cy={G.y(dd.s[hov])} r={4.5} fill={RED} stroke={IVORY} strokeWidth={2} />
            </g>
          ) : null}
        </svg>
      ) : null}
      {G && hov !== null ? (
        <Tip x={G.x(hov)} width={W} top={G.PT + 8}>
          <div className="ist-tip-d">{dateLong(ds.day[r.i0 + hov])}</div>
          <div className="ist-tip-row"><i style={{ background: RED }} />Tvoja stratégia <b>{pct(dd.s[hov])}</b></div>
          {withStocks ? <div className="ist-tip-row"><i style={{ background: INK }} />Len akcie <b>{pct(dd.k[hov])}</b></div> : null}
          <div className="ist-tip-mix">{dd.s[hov] < -0.0005 ? "pod predchádzajúcim maximom" : "na novom maxime"}</div>
        </Tip>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ malé grafy vo formulári */

/** prstenec so zložením portfólia a textom v strede */
export const Donut = ({ w, title, sub }: { w: Weights; title: string; sub: string }) => {
  const R = 44;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = [
    { v: w[0], color: INK },
    { v: w[1], color: TAUPE },
    { v: w[2], color: BEIGE },
  ].map((a) => {
    const len = (a.v / 100) * C;
    const el = { ...a, dash: `${len} ${C - len}`, offset: -offset };
    offset += len;
    return el;
  });
  return (
    <div className="ist-donut" role="img" aria-label={`Zloženie: akcie ${w[0]} %, dlhopisy ${w[1]} %, peňažný fond ${w[2]} %`}>
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r={R} fill="none" stroke="#e9e4dc" strokeWidth="14" />
        {arcs.map((a, k) =>
          a.v > 0 ? <circle key={k} cx="60" cy="60" r={R} fill="none" stroke={a.color} strokeWidth="14" strokeDasharray={a.dash} strokeDashoffset={a.offset} transform="rotate(-90 60 60)" /> : null,
        )}
      </svg>
      <div className="ist-donut-text">
        <b>{title}</b>
        <span>{sub}</span>
      </div>
    </div>
  );
};

/** stĺpce zloženia pre každý rok investovania */
export const BrakeBars = ({ rows }: { rows: Weights[] }) => {
  const n = rows.length;
  const W = 300;
  const H = 96;
  const gap = n > 40 ? 0.6 : 1.5;
  const bw = (W - gap * (n - 1)) / n;
  const labels = n <= 6 ? rows.map((_, k) => k + 1) : [1, Math.ceil(n / 2), n];
  return (
    <div className="ist-brake-bars" role="img" aria-label={`Zloženie portfólia v jednotlivých rokoch, ${n} rokov`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        {rows.map((w, k) => {
          const x = k * (bw + gap);
          const hs = (w[0] / 100) * H;
          const hb = (w[1] / 100) * H;
          return (
            <g key={k}>
              <rect x={x} y={0} width={bw} height={H} fill={BEIGE} />
              <rect x={x} y={H - hs - hb} width={bw} height={hb} fill={TAUPE} />
              <rect x={x} y={H - hs} width={bw} height={hs} fill={INK} />
            </g>
          );
        })}
      </svg>
      <div className="ist-brake-axis" aria-hidden>
        {labels.map((l) => (
          <span key={l} style={{ left: `${((l - 0.5) / n) * 100}%` }}>{l}.</span>
        ))}
      </div>
    </div>
  );
};
