import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, Check, ChevronDown, Download, Link2, Plus, X } from "lucide-react";
import "../shared/calc-ui.css";
import "./investicna-strategia.css";
import {
  DEFAULT_INPUTS,
  LIMITS,
  MAX_PHASES,
  addMonths,
  adjustWeights,
  compute,
  dayOf,
  decodeScenario,
  decodeSet,
  encodeScenario,
  firstOnOrAfter,
  isoOf,
  presetsFor,
  resolveRange,
  rolling,
  samePhases,
  sanitize,
  weightsAt,
  ymdOf,
  type Dataset,
  type Inputs,
  type Phase,
  type Result,
  type SetId,
  type Weights,
  yearsBetween,
} from "./investicnaStrategiaModel";
import { dateLong, dateShort, mix, money, monthYear, pct, rokov, signedPct, span, spanShort, vkladov } from "./investicnaStrategiaFormat";
import { DrawdownChart, RollingChart, ValueChart, YearBars } from "./InvesticnaStrategiaCharts";
import { BONUSY_CTA_LABEL, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";

/**
 * Investičná stratégia – pomer akcií, dlhopisov a peňažného fondu na skutočných denných dátach, so zmenou stratégie v čase.
 * Rozloženie a jazyk drží Úverová 3.0: formulár vľavo (sticky), jeden pokojný výsledok vpravo, ivory karty s hairline, jedna zelená.
 * Referencie (Refero): Wealthsimple kalkulačky (vstupy vľavo, graf vpravo, samostatný blok predpokladov a upozornenie),
 * Wealthsimple advanced chart (skratky obdobia pri grafe), Glassnode Studio (lišta grafu s mierkou, rozsah dátumov, opis dát a export).
 */

const STORAGE_KEY = "jsm_investicna_strategia_v1";
const st = (i: number) => ({ "--i": i }) as CSSProperties;

const ASSETS = ["Akcie", "Dlhopisy", "Peňažný fond"] as const;
const ASSET_KEYS = ["stock", "bond", "cash"] as const;

const SETS: Record<SetId, { label: string; note: string; stock: string; bond: string; cash: string; inflation: string }> = {
  eur: {
    label: "Svet v eurách",
    note: "Svetové akcie, nemecké štátne dlhopisy a eurový peňažný trh.",
    stock: "všetky akcie rozvinutých trhov sveta vrátane menších firiem, prepočítané na eurá",
    bond: "nemecké štátne dlhopisy so splatnosťou 7 až 10 rokov",
    cash: "eurový peňažný trh (sadzba EONIA, od októbra 2019 €STR)",
    inflation: "HICP eurozóny",
  },
  usd: {
    label: "USA v dolároch",
    note: "Americké akcie, štátne dlhopisy USA a pokladničné poukážky.",
    stock: "celý americký akciový trh vrátane menších firiem",
    bond: "štátne dlhopisy USA so splatnosťou 10 rokov",
    cash: "americké pokladničné poukážky so splatnosťou 1 mesiac",
    inflation: "CPI-U Spojených štátov (október 2025 úrad nezverejnil, je dopočítaný zo susedných mesiacov)",
  },
};

type Tab = "prepady" | "roky" | "krizy" | "zaciatky";
const TABS: { id: Tab; label: string }[] = [
  { id: "prepady", label: "Prepady" },
  { id: "roky", label: "Rok po roku" },
  { id: "krizy", label: "Krízy" },
  { id: "zaciatky", label: "Každý začiatok" },
];
const HORIZONS = [1, 5, 10, 15, 20, 30];
/** poradie predvoľby „Životný cyklus“ v presetsFor() */
const LIFE = 3;
const copyPhases = (phases: Phase[]): Phase[] => phases.map((p) => ({ from: p.from, w: [...p.w] as Weights }));

type Sets = Record<SetId, Dataset>;
let setsCache: Promise<Sets> | null = null;
const loadSets = (): Promise<Sets> => {
  if (!setsCache) {
    setsCache = import("./investicnaStrategiaData").then((m) => ({ eur: decodeSet("eur", m.RAW.eur, m.UNIT), usd: decodeSet("usd", m.RAW.usd, m.UNIT) }));
    setsCache.catch(() => {
      setsCache = null;
    });
  }
  return setsCache;
};

const loadInitial = (): Inputs => {
  try {
    const shared = decodeScenario(window.location.search);
    if (shared) return shared;
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize({ ...DEFAULT_INPUTS, ...(JSON.parse(raw) as Partial<Inputs>) }) : DEFAULT_INPUTS;
  } catch {
    return DEFAULT_INPUTS;
  }
};

/** dĺžka obdobia v rokoch pre dané vstupy */
const yearsOf = (sets: Sets, a: Inputs): number => {
  const ds = sets[a.set];
  const clean = sanitize(a);
  const range = resolveRange(ds, clean.start, clean.end);
  return yearsBetween(ds.day[range.i0], ds.day[range.i1]);
};

/**
 * Zmena obdobia alebo súboru dát: ak je nastavený životný cyklus, jeho zmeny sa posunú tak, aby ostali
 * v rovnakej časti obdobia. Ručne upravená stratégia sa nemení.
 */
const withPeriod = (sets: Sets | null, s: Inputs, patch: Partial<Inputs>): Inputs => {
  const next = { ...s, ...patch };
  if (!sets || !samePhases(s.phases, presetsFor(yearsOf(sets, s))[LIFE].phases)) return next;
  return { ...next, phases: copyPhases(presetsFor(yearsOf(sets, next))[LIFE].phases) };
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
  /** horná hranica posuvníka, ak má byť nižšia ako najvyššia povolená hodnota */
  sliderMax?: number;
  slider?: boolean;
  compact?: boolean;
  onChange: (v: number) => void;
};

const Field = ({ id, label, hint, unit, value, min, max, step, sliderMax, slider = true, compact = false, onChange }: FieldProps) => {
  const [text, setText] = useState<string | null>(null);
  const decimals = Math.max(0, (String(step).split(".")[1] ?? "").length);
  const clamp = (v: number) => Number(Math.max(min, Math.min(max, Number.isFinite(v) ? v : min)).toFixed(decimals));
  const shown = text ?? value.toLocaleString("sk-SK", { maximumFractionDigits: decimals });
  const top = sliderMax ?? max;
  const p = `${Math.max(0, Math.min(1, (value - min) / (top - min))) * 100}%`;
  return (
    <div className={`ist-field${compact ? " is-compact" : ""}`}>
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
            if (e.target.value.trim() !== "" && Number.isFinite(v)) onChange(clamp(v));
          }}
          onBlur={() => setText(null)}
        />
        <span className="calc-input-unit" aria-hidden>{unit}</span>
      </div>
      {slider ? (
        <input
          type="range"
          className="calc-slider ist-slider"
          style={{ "--p": p } as CSSProperties}
          min={min}
          max={top}
          step={step}
          value={Math.min(top, value)}
          aria-label={`${label} (posuvník)`}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
        />
      ) : null}
    </div>
  );
};

const Collapse = ({ title, meta, open, onToggle, className = "", children }: { title: string; meta: string; open: boolean; onToggle: () => void; className?: string; children: ReactNode }) => (
  <>
    <button type="button" className={`ist-collapse ${className}`} aria-expanded={open} onClick={onToggle}>
      <span>{title}</span>
      <span className="ist-collapse-meta">{meta}</span>
      <ChevronDown className={`h-4 w-4 ist-chev${open ? " is-open" : ""}`} aria-hidden />
    </button>
    {open ? <div className="ist-advanced">{children}</div> : null}
  </>
);

const MixBar = ({ w }: { w: readonly number[] }) => (
  <span className="ist-mixbar" aria-hidden>
    <i className="ist-mix-stock" style={{ width: `${w[0]}%` }} />
    <i className="ist-mix-bond" style={{ width: `${w[1]}%` }} />
    <i className="ist-mix-cash" style={{ width: `${w[2]}%` }} />
  </span>
);

/** Cieľové zloženie v čase: tri vrstvy nad sebou cez celé zvolené obdobie. */
const GlidePreview = ({ phases, transition, years, startDay, endDay }: { phases: Phase[]; transition: number; years: number; startDay: number; endDay: number }) => {
  const steps = 96;
  const pts = Array.from({ length: steps + 1 }, (_, k) => {
    const t = (years * k) / steps;
    const w = weightsAt(phases, transition, Math.floor(t * 12) / 12);
    return { x: (k / steps) * 100, s: w[0], b: w[0] + w[1] };
  });
  const edge = (f: (p: (typeof pts)[number]) => number) => pts.map((p) => `${p.x.toFixed(2)} ${(40 - f(p) * 40).toFixed(2)}`);
  const band = (upper: string[], lower: string[]) => `M${upper.join("L")}L${[...lower].reverse().join("L")}Z`;
  const zero = edge(() => 0);
  const stock = edge((p) => p.s);
  const bond = edge((p) => Math.min(1, p.b));
  const one = edge(() => 1);
  const marks = phases
    .slice(1)
    .filter((p) => p.from < years)
    .map((p) => ({ left: (p.from / years) * 100, year: ymdOf(addMonths(startDay, p.from * 12)).y }));
  return (
    <div className="ist-glide" role="img" aria-label="Cieľové zloženie portfólia počas zvoleného obdobia">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
        <path d={band(one, bond)} className="ist-fill-cash" />
        <path d={band(bond, stock)} className="ist-fill-bond" />
        <path d={band(stock, zero)} className="ist-fill-stock" />
      </svg>
      {marks.map((m) => (
        <i key={m.left} className="ist-glide-mark" style={{ left: `${m.left}%` }} aria-hidden />
      ))}
      <div className="ist-glide-axis" aria-hidden>
        <span>{ymdOf(startDay).y}</span>
        {marks
          .filter((m) => m.left > 12 && m.left < 86)
          .map((m) => (
            <span key={m.left} className="ist-glide-year" style={{ left: `${m.left}%` }}>{m.year}</span>
          ))}
        <span>{ymdOf(endDay).y}</span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ komponent */

const InvesticnaStrategiaCalculator = () => {
  const [A, setA] = useState<Inputs>(loadInitial);
  const [sets, setSets] = useState<Sets | null>(null);
  const [failed, setFailed] = useState(false);
  const [openPhase, setOpenPhase] = useState(0);
  const [advOpen, setAdvOpen] = useState(() => A.cost > 0 || A.real || A.rebalance === "monthly");
  const [tab, setTab] = useState<Tab>("prepady");
  const [horizon, setHorizon] = useState(10);
  const [scale, setScale] = useState<"lin" | "log">("lin");
  const [show, setShow] = useState({ stocks: true, flat: true, paid: true });
  const [pinned, setPinned] = useState<number | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const orderRef = useRef<number[][]>([]);

  const fresh = useRef(A === DEFAULT_INPUTS);

  useEffect(() => {
    let alive = true;
    loadSets()
      .then((loaded) => {
        if (!alive) return;
        setSets(loaded);
        /* prvé otvorenie: životný cyklus podľa skutočnej dĺžky dát */
        if (fresh.current) setA((s) => ({ ...s, phases: copyPhases(presetsFor(yearsOf(loaded, s))[LIFE].phases) }));
        fresh.current = false;
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(A));
    } catch {
      /* súkromný režim */
    }
  }, [A]);

  /* výpočet beží nad odloženou kópiou vstupov, aby posuvníky ostali plynulé */
  const D = useDeferredValue(A);
  const ds = sets ? sets[D.set] : null;
  const r: Result | null = useMemo(() => (ds ? compute(ds, D) : null), [ds, D]);
  const dsYears = ds ? (ds.day[ds.n - 1] - ds.day[0]) / 365.25 : 0;
  const horizons = useMemo(() => HORIZONS.filter((h) => dsYears - h >= 1), [dsYears]);
  const span10 = horizons.includes(horizon) ? horizon : horizons[horizons.length - 1] ?? 0;
  const roll = useMemo(() => (tab === "zaciatky" && ds && span10 > 0 ? rolling(ds, D, span10) : null), [tab, ds, D, span10]);

  /* pripnutý deň platí len pre obdobie, v ktorom vznikol */
  const rangeKey = r ? `${D.set}-${r.i0}-${r.i1}` : "";
  useEffect(() => setPinned(null), [rangeKey]);

  const shownFinal = useCountUp(r ? r.strategy.final : 0);
  const cur = r?.currency ?? (A.set === "usd" ? "$" : "€");
  const years = r ? r.years : 27;
  const presets = useMemo(() => presetsFor(years), [years]);
  const multi = A.phases.length > 1;
  const startsInStocks = A.phases[0].w[0] === 100;
  /* stratégia je po celé obdobie 100 % v akciách: porovnanie s čistými akciami nemá zmysel */
  const onlyStocks = startsInStocks && (!multi || (!!r && !r.afterChange));
  /* „bez zmeny stratégie“ je to isté ako „len akcie“, stačí jedna čiara */
  const stocksLine = !onlyStocks && !(multi && startsInStocks);

  const set = (patch: Partial<Inputs>) => setA((s) => ({ ...s, ...patch }));
  const setPeriod = (patch: Partial<Inputs>) => setA((s) => withPeriod(sets, s, patch));
  const setPhases = (f: (phases: Phase[]) => Phase[]) => setA((s) => ({ ...s, phases: f(s.phases) }));
  const setWeight = (i: number, asset: number, value: number) => {
    const order = orderRef.current[i] ?? [2, 1, 0];
    orderRef.current[i] = [...order.filter((x) => x !== asset), asset];
    setPhases((phases) => phases.map((p, k) => (k === i ? { ...p, w: adjustWeights(p.w, asset, value, order) } : p)));
  };
  const addPhase = () => {
    const last = A.phases[A.phases.length - 1];
    const from = Math.min(LIMITS.from.max, A.phases.length === 1 ? Math.max(1, Math.round(years * 0.6)) : last.from + 5);
    if (from <= last.from) return;
    /* každá ďalšia fáza je o krok opatrnejšia: 30 bodov z akcií ide do dlhopisov a peňažného fondu */
    const s = Math.max(0, last.w[0] - 30);
    const b = Math.min(100 - s, last.w[1] + Math.round(((last.w[0] - s) * 2) / 3));
    setOpenPhase(A.phases.length);
    set({ phases: [...A.phases, { from, w: [s, b, 100 - s - b] }] });
  };
  const removePhase = (i: number) => {
    orderRef.current.splice(i, 1);
    setOpenPhase((o) => (o === i ? i - 1 : o > i ? o - 1 : o));
    setPhases((phases) => phases.filter((_, k) => k !== i));
  };
  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    orderRef.current = [];
    setOpenPhase(0);
    set({ phases: p.phases.map((ph) => ({ from: ph.from, w: [...ph.w] as Weights })), transition: p.phases.length > 1 ? p.transition : A.transition });
  };
  const reset = () => {
    orderRef.current = [];
    setOpenPhase(0);
    setAdvOpen(false);
    setPinned(null);
    setA(sets ? { ...DEFAULT_INPUTS, phases: copyPhases(presetsFor(yearsOf(sets, DEFAULT_INPUTS))[LIFE].phases) } : DEFAULT_INPUTS);
  };
  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?${encodeScenario(A)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Skopíruj si odkaz na tento scenár:", url);
    }
  };

  /* obdobie */
  const firstIso = ds ? isoOf(ds.day[0]) : "";
  const lastIso = ds ? isoOf(ds.day[ds.n - 1]) : "";
  const periodPills = useMemo(() => {
    if (!ds) return [];
    const last = ds.day[ds.n - 1];
    const out = [{ id: "all", label: "Celé obdobie", start: "", i0: 0 }];
    for (const y of [30, 20, 10, 5]) {
      const s = addMonths(last, -12 * y);
      if (s > ds.day[0]) out.push({ id: `y${y}`, label: `${y} rokov`, start: isoOf(s), i0: resolveRange(ds, isoOf(s), "").i0 });
    }
    return out;
  }, [ds]);
  /* po opustení poľa nahradí dátum mimo dát (alebo koniec pred začiatkom) dňom, s ktorým sa naozaj počíta */
  const tidyDates = () => {
    const data = sets ? sets[A.set] : null;
    if (!data) return;
    const clean = sanitize(A);
    const range = resolveRange(data, clean.start, clean.end);
    const first = data.day[0];
    const last = data.day[data.n - 1];
    const startDay = data.day[range.i0];
    const endDay = data.day[range.i1];
    const s = dayOf(A.start);
    const e = dayOf(A.end);
    const patch: Partial<Inputs> = {};
    if (A.start && !(s >= first && s <= last && startDay >= s && startDay - s <= 10)) patch.start = range.i0 === 0 ? "" : isoOf(startDay);
    if (A.end && !(e >= first && e < last && endDay <= e && e - endDay <= 10)) patch.end = range.i1 === data.n - 1 ? "" : isoOf(endDay);
    if (Object.keys(patch).length) setPeriod(patch);
  };

  const downloadCsv = () => {
    if (!ds || !r) return;
    const n2 = (v: number) => v.toFixed(2).replace(".", ",");
    const rows = ["datum;hodnota_uctu;vklady;akcie_%;dlhopisy_%;penazny_fond_%;len_akcie"];
    for (let j = 0; j < r.n; j++) {
      const s = r.shareStock[j] * 100;
      const b = r.shareBond[j] * 100;
      rows.push([isoOf(ds.day[r.i0 + j]), n2(r.strategy.value[j]), n2(r.paid[j]), n2(s), n2(b), n2(Math.max(0, 100 - s - b)), n2(r.stocks.value[j])].join(";"));
    }
    const blob = new Blob(["\ufeff" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `investicna-strategia-${r.inputs.start}-${r.inputs.end}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const dayAt = (j: number) => (ds && r ? ds.day[r.i0 + j] : 0);
  const low = r?.strategy.drawdown ?? null;
  const positiveYears = r ? r.yearly.filter((y) => y.strategy > 0).length : 0;

  return (
    <div id="ist-root" className="calc-ui ist w-full font-sans">
      <div className="calc-body-shell">
        <div className="calc-page">
          <header className="calc-header calc-reveal" style={st(0)}>
            <span className="calc-eyebrow">Investičná stratégia</span>
            <h1 className="calc-title">
              Čo by tvoja stratégia urobila <em>naozaj</em>?
            </h1>
            <p className="calc-subtitle">
              Poskladaj pomer akcií, dlhopisov a peňažného fondu, vyber deň začiatku aj konca a pozri, čo by sa stalo s tvojimi peniazmi
              podľa skutočných denných dát. Stratégiu môžeš v čase meniť, presne ako v živote.
            </p>
          </header>

          <div className="ist-layout">
            {/* ---------------------------------------------------------------- Formulár */}
            <aside className="ist-form calc-reveal" aria-label="Nastavenie stratégie" style={st(1)}>
              <div className="ist-group">
                <p className="ist-group-title">Dáta</p>
                <div className="calc-segment ist-segment" role="group" aria-label="Súbor dát">
                  {(Object.keys(SETS) as SetId[]).map((id) => (
                    <button key={id} type="button" aria-pressed={A.set === id} onClick={() => setPeriod({ set: id })}>
                      {SETS[id].label}
                    </button>
                  ))}
                </div>
                <p className="ist-hint">
                  {SETS[A.set].note}
                  {ds ? ` Denné dáta od ${dateShort(ds.day[0])} do ${dateShort(ds.day[ds.n - 1])}.` : ""}
                </p>
              </div>

              <div className="ist-group">
                <p className="ist-group-title">Obdobie</p>
                <div className="ist-row">
                  <div className="ist-field is-compact">
                    <label className="calc-label" htmlFor="ist-start">Od</label>
                    <input id="ist-start" type="date" className="calc-input ist-date" value={A.start || firstIso} min={firstIso} max={lastIso} onChange={(e) => setPeriod({ start: e.target.value })} onBlur={tidyDates} />
                  </div>
                  <div className="ist-field is-compact">
                    <label className="calc-label" htmlFor="ist-end">Do</label>
                    <input id="ist-end" type="date" className="calc-input ist-date" value={A.end || lastIso} min={firstIso} max={lastIso} onChange={(e) => setPeriod({ end: e.target.value })} onBlur={tidyDates} />
                  </div>
                </div>
                <div className="calc-pills ist-pills" role="group" aria-label="Rýchla voľba obdobia">
                  {periodPills.map((p) => (
                    <button key={p.id} type="button" className="calc-pill" aria-pressed={!!r && !!ds && r.i0 === p.i0 && r.i1 === ds.n - 1} onClick={() => setPeriod({ start: p.start, end: "" })}>
                      {p.label}
                    </button>
                  ))}
                </div>
                {r && (r.startMoved || r.endMoved) ? (
                  <p className="ist-hint">
                    Počítam od {dateShort(r.startDay)} do {dateShort(r.endDay)}, to sú najbližšie dni, keď sa obchodovalo.
                  </p>
                ) : null}
              </div>

              <div className="ist-group">
                <p className="ist-group-title">Vklady</p>
                <Field id="ist-initial" label="Jednorazový vklad" hint="na začiatku" unit={cur} value={A.initial} {...LIMITS.initial} sliderMax={100000} onChange={(v) => set({ initial: v })} />
                <Field id="ist-monthly" label="Mesačný vklad" unit={cur} value={A.monthly} {...LIMITS.monthly} sliderMax={2000} onChange={(v) => set({ monthly: v })} />
              </div>

              <div className="ist-group">
                <p className="ist-group-title">Stratégia</p>
                <div className="calc-pills ist-pills" role="group" aria-label="Predvolené stratégie">
                  {presets.map((p) => (
                    <button key={p.id} type="button" className="calc-pill" aria-pressed={samePhases(p.phases, A.phases)} onClick={() => applyPreset(p.id)}>
                      {p.label}
                    </button>
                  ))}
                </div>

                {r ? <GlidePreview phases={A.phases} transition={A.transition} years={r.years} startDay={r.startDay} endDay={r.endDay} /> : null}
                <div className="ist-keys" aria-hidden>
                  {ASSETS.map((a, k) => (
                    <span key={a}><i className={`ist-dot ist-dot--${ASSET_KEYS[k]}`} />{a}</span>
                  ))}
                </div>

                <div className="ist-phases">
                  {A.phases.map((p, i) => {
                    const open = openPhase === i;
                    const prev = i > 0 ? A.phases[i - 1].from : 0;
                    const next = i + 1 < A.phases.length ? A.phases[i + 1].from : LIMITS.from.max + 1;
                    const late = i > 0 && p.from >= years;
                    return (
                      <div key={i} className={`ist-phase${open ? " is-open" : ""}`}>
                        <button type="button" className="ist-phase-head" aria-expanded={open} onClick={() => setOpenPhase(open ? -1 : i)}>
                          <span className="ist-phase-title">
                            {i === 0 ? "Od začiatku" : `Po ${p.from} ${p.from === 1 ? "roku" : "rokoch"}`}
                            {late ? <small>až po konci obdobia</small> : null}
                          </span>
                          <span className="ist-phase-mix">{mix(p.w)}</span>
                          <ChevronDown className={`h-4 w-4 ist-chev${open ? " is-open" : ""}`} aria-hidden />
                          <MixBar w={p.w} />
                        </button>
                        {open ? (
                          <div className="ist-phase-body">
                            {i > 0 ? (
                              <Field id={`ist-from-${i}`} label="Zmena príde po" unit={p.from === 1 ? "roku" : "rokoch"} value={p.from} min={prev + 1} max={next - 1} step={1} slider={false} compact onChange={(v) => setPhases((phases) => phases.map((x, k) => (k === i ? { ...x, from: Math.round(v) } : x)))} />
                            ) : null}
                            {ASSETS.map((a, k) => (
                              <div key={a} className="ist-asset">
                                <label htmlFor={`ist-w-${i}-${k}`}><i className={`ist-dot ist-dot--${ASSET_KEYS[k]}`} aria-hidden />{a}</label>
                                <span className="ist-asset-value">
                                  <input
                                    id={`ist-w-${i}-${k}`}
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={p.w[k]}
                                    onChange={(e) => setWeight(i, k, Number(e.target.value))}
                                  />
                                  %
                                </span>
                                <input
                                  type="range"
                                  className={`calc-slider ist-slider ist-slider--${ASSET_KEYS[k]}`}
                                  style={{ "--p": `${p.w[k]}%` } as CSSProperties}
                                  min={0}
                                  max={100}
                                  step={5}
                                  value={p.w[k]}
                                  aria-label={`${a}, podiel v percentách`}
                                  onChange={(e) => setWeight(i, k, Number(e.target.value))}
                                />
                              </div>
                            ))}
                            {i > 0 ? (
                              <button type="button" className="ist-remove" onClick={() => removePhase(i)}>
                                <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> Odstrániť túto zmenu
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {A.phases.length < MAX_PHASES ? (
                  <button type="button" className="ist-add" onClick={addPhase}>
                    <Plus className="h-4 w-4" strokeWidth={2} aria-hidden /> Pridať zmenu stratégie
                  </button>
                ) : null}

                {multi ? (
                  <div className="ist-transition">
                    <p className="calc-label">Ako sa má portfólio preklopiť</p>
                    <div className="calc-segment ist-segment" role="group" aria-label="Spôsob zmeny stratégie">
                      <button type="button" aria-pressed={A.transition === 0} onClick={() => set({ transition: 0 })}>Naraz</button>
                      <button type="button" aria-pressed={A.transition > 0} onClick={() => set({ transition: A.transition > 0 ? A.transition : 3 })}>Postupne</button>
                    </div>
                    {A.transition > 0 ? (
                      <Field id="ist-transition" label="Prechod trvá" unit={rokov(A.transition)} value={A.transition} min={1} max={LIMITS.transition.max} step={1} compact onChange={(v) => set({ transition: Math.round(v) })} />
                    ) : null}
                  </div>
                ) : null}
              </div>

              <Collapse
                title="Podrobnejšie nastavenie"
                meta={[A.rebalance === "monthly" ? "mesačné vyvažovanie" : "", A.cost > 0 ? `náklady ${A.cost.toLocaleString("sk-SK")} %` : "", A.real ? "po inflácii" : ""].filter(Boolean).join(", ") || "voliteľné"}
                open={advOpen}
                onToggle={() => setAdvOpen((o) => !o)}
              >
                <p className="calc-label">Vyvažovanie na cieľový pomer</p>
                <div className="calc-segment ist-segment" role="group" aria-label="Vyvažovanie portfólia">
                  <button type="button" aria-pressed={A.rebalance === "yearly"} onClick={() => set({ rebalance: "yearly" })}>Raz ročne</button>
                  <button type="button" aria-pressed={A.rebalance === "monthly"} onClick={() => set({ rebalance: "monthly" })}>Každý mesiac</button>
                </div>
                <Field id="ist-cost" label="Ročné náklady" hint="fondy a správa" unit="%" value={A.cost} {...LIMITS.cost} slider={false} compact onChange={(v) => set({ cost: v })} />
                <label className="ist-switch">
                  <input type="checkbox" checked={A.real} onChange={(e) => set({ real: e.target.checked })} />
                  <span className="ist-switch-ui" aria-hidden />
                  <span className="ist-switch-text">
                    Očistiť o infláciu
                    <small>sumy v cenách z konca obdobia</small>
                  </span>
                </label>
              </Collapse>

              <div className="ist-form-foot">
                <button type="button" className="ist-link" onClick={copyLink}>
                  {copied ? <Check className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden /> : <Link2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
                  {copied ? "Odkaz je skopírovaný" : "Kopírovať odkaz na scenár"}
                </button>
                <button type="button" className="ist-reset" onClick={reset}>Začať odznova</button>
              </div>
            </aside>

            {/* ---------------------------------------------------------------- Výsledok */}
            <section className="ist-result calc-reveal" aria-label="Výsledok" style={st(2)} aria-busy={!r}>
              {failed ? (
                <div className="ist-state">
                  <p>Historické dáta sa nepodarilo načítať. Skontroluj pripojenie a skús to znova.</p>
                  <button type="button" className="btn-primary ist-cta-btn" onClick={() => window.location.reload()}>Skúsiť znova</button>
                </div>
              ) : !r || !ds ? (
                <div className="ist-state" role="status">
                  <span className="ist-spinner" aria-hidden />
                  <p>Načítavam historické dáta…</p>
                </div>
              ) : (
                <>
                  <p className="ist-kicker">
                    Hodnota účtu k {dateShort(r.endDay)}
                    {A.real ? (r.i1 === ds.n - 1 ? ", v dnešných cenách" : ", v cenách z konca obdobia") : ""}
                  </p>
                  {r.strategy.deposits > 0 ? (
                    <p className="ist-hero">
                      <span className="ist-hero-value" style={{ "--n": money(r.strategy.final, cur).length } as CSSProperties}>{money(shownFinal, cur)}</span>
                      <span className="ist-hero-unit">z vkladov {money(r.strategy.deposits, cur)}</span>
                    </p>
                  ) : (
                    <p className="ist-hero ist-hero--empty">Zadaj jednorazový alebo mesačný vklad a uvidíš, na koľko by narástol.</p>
                  )}
                  <p className="ist-hero-sub">
                    {[
                      `${dateShort(r.startDay)} – ${dateShort(r.endDay)}`,
                      span(r.startDay, r.endDay),
                      r.depositCount > 0 ? `${r.depositCount} ${vkladov(r.depositCount)}` : "",
                      r.strategy.deposits > 0 ? `${r.strategy.gain >= 0 ? "zisk" : "strata"} ${money(Math.abs(r.strategy.gain), cur)}` : "",
                    ]
                      .filter(Boolean)
                      .map((part) => (
                        <span key={part}>{part}</span>
                      ))}
                  </p>

                  <Verdict r={r} cur={cur} multi={multi} onlyStocks={onlyStocks} dayAt={dayAt} />

                  <dl className="ist-facts">
                    <div>
                      <dt>Ročný výnos stratégie</dt>
                      <dd>{pct(r.strategy.twr, 2)}</dd>
                      <small>{A.real ? "nad infláciu, zložený priemer" : A.cost > 0 ? "po nákladoch, zložený priemer" : "zložený priemer za rok"}</small>
                    </div>
                    {A.monthly > 0 && r.strategy.irr !== null ? (
                      <div>
                        <dt>Výnos tvojich vkladov</dt>
                        <dd>{pct(r.strategy.irr, 2)}</dd>
                        <small>ročne, podľa toho, kedy si vkladal</small>
                      </div>
                    ) : (
                      <div>
                        <dt>Zhodnotenie vkladu</dt>
                        <dd>{r.strategy.deposits > 0 ? signedPct(r.strategy.final / r.strategy.deposits - 1, 0) : "–"}</dd>
                        <small>za celé obdobie</small>
                      </div>
                    )}
                    <div>
                      <dt>Najhlbší prepad</dt>
                      <dd>{low && low.depth < 0 ? pct(low.depth) : "žiadny"}</dd>
                      <small>{low && low.depth < 0 ? `${dateShort(dayAt(low.peak))} – ${dateShort(dayAt(low.trough))}` : "stratégia len rástla"}</small>
                    </div>
                    <div>
                      <dt>Návrat na maximum</dt>
                      <dd>{low && low.depth < 0 ? (low.recovery !== null ? spanShort(dayAt(low.peak), dayAt(low.recovery)) : "zatiaľ nie") : "–"}</dd>
                      <small>{low && low.depth < 0 ? (low.recovery !== null ? `od vrcholu, späť ${dateShort(dayAt(low.recovery))}` : "do konca obdobia sa nevrátila") : "nebolo sa odkiaľ vracať"}</small>
                    </div>
                  </dl>

                  {/* graf hodnoty */}
                  <div className="ist-chart-block">
                    <div className="ist-chart-head">
                      <h3>Vývoj hodnoty účtu</h3>
                      <div className="ist-legend" role="group" aria-label="Čiary v grafe">
                        <span className="ist-legend-item"><i className="ist-legend-line ist-legend-accent" />Tvoja stratégia</span>
                        {stocksLine ? (
                          <button type="button" className="ist-legend-item" aria-pressed={show.stocks} onClick={() => setShow((s) => ({ ...s, stocks: !s.stocks }))}>
                            <i className="ist-legend-line ist-legend-dash" />Len akcie
                          </button>
                        ) : null}
                        {r.flat ? (
                          <button type="button" className="ist-legend-item" aria-pressed={show.flat} onClick={() => setShow((s) => ({ ...s, flat: !s.flat }))}>
                            <i className="ist-legend-line ist-legend-flat" />Bez zmeny stratégie
                          </button>
                        ) : null}
                        <button type="button" className="ist-legend-item" aria-pressed={show.paid} onClick={() => setShow((s) => ({ ...s, paid: !s.paid }))}>
                          <i className="ist-legend-line ist-legend-paid" />Vklady
                        </button>
                      </div>
                    </div>
                    <div className="ist-toolbar">
                      <div className="calc-segment ist-segment ist-segment--small" role="group" aria-label="Mierka zvislej osi">
                        <button type="button" aria-pressed={scale === "lin"} onClick={() => setScale("lin")}>Lineárna</button>
                        <button type="button" aria-pressed={scale === "log"} onClick={() => setScale("log")}>Logaritmická</button>
                      </div>
                      <div className="ist-day">
                        <label htmlFor="ist-day">Stav ku dňu</label>
                        <input
                          id="ist-day"
                          type="date"
                          className="calc-input ist-date"
                          value={pinned !== null ? isoOf(dayAt(pinned)) : ""}
                          min={r.inputs.start}
                          max={r.inputs.end}
                          onChange={(e) => {
                            const d = dayOf(e.target.value);
                            if (!Number.isFinite(d)) return setPinned(null);
                            setPinned(Math.max(r.i0, Math.min(r.i1, firstOnOrAfter(ds.day, d))) - r.i0);
                          }}
                        />
                        {pinned !== null ? (
                          <button type="button" className="ist-day-x" aria-label="Zrušiť vybraný deň" onClick={() => setPinned(null)}>
                            <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <ValueChart ds={ds} r={r} scale={scale} show={{ stocks: show.stocks && stocksLine, flat: show.flat, paid: show.paid }} pinned={pinned} onPin={setPinned} />
                    <div className="ist-keys ist-keys--chart">
                      <b>Zloženie portfólia</b>
                      {ASSETS.map((a, k) => (
                        <span key={a}><i className={`ist-dot ist-dot--${ASSET_KEYS[k]}`} aria-hidden />{a}</span>
                      ))}
                    </div>
                  </div>

                  {/* zložky v období */}
                  <div className="ist-blocks">
                    <p className="ist-blocks-title">Čo robili jednotlivé zložky v tomto období{A.real ? " (nad infláciu)" : ""}</p>
                    <dl>
                      {ASSET_KEYS.map((k, i) => (
                        <div key={k}>
                          <dt><i className={`ist-dot ist-dot--${k}`} aria-hidden />{ASSETS[i]}</dt>
                          <dd>{signedPct(r.assets[k], 2)} <span>ročne</span></dd>
                        </div>
                      ))}
                      <div>
                        <dt>Inflácia</dt>
                        <dd>{pct(r.assets.inflation, 2)} <span>ročne</span></dd>
                      </div>
                    </dl>
                  </div>

                  {/* detail */}
                  <div className="ist-detail">
                    <div
                      className="calc-pills ist-tabs"
                      role="tablist"
                      aria-label="Pohľad do detailu"
                      onKeyDown={(e) => {
                        const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                        if (!step) return;
                        e.preventDefault();
                        const next = TABS[(TABS.findIndex((t) => t.id === tab) + step + TABS.length) % TABS.length];
                        setTab(next.id);
                        document.getElementById(`ist-tab-${next.id}`)?.focus();
                      }}
                    >
                      {TABS.map((t) => (
                        <button key={t.id} type="button" role="tab" id={`ist-tab-${t.id}`} aria-controls={`ist-panel-${t.id}`} className="calc-pill" aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1} onClick={() => setTab(t.id)}>
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {tab === "prepady" ? (
                      <div role="tabpanel" id="ist-panel-prepady" aria-labelledby="ist-tab-prepady" className="ist-panel">
                        <p className="ist-lede">
                          O koľko bola stratégia v daný deň pod svojím dovtedajším maximom. Nové vklady do toho nerátam, ide o samotnú stratégiu.
                        </p>
                        <ValueLegend strategy stocks={!onlyStocks} />
                        <DrawdownChart ds={ds} r={r} withStocks={!onlyStocks} />
                        {low && low.depth < 0 ? (
                          <p className="ist-summary">
                            Najhlbšie bola stratégia <strong>{pct(low.depth)}</strong> pod maximom, dňa {dateLong(dayAt(low.trough))}. Pokles z vrcholu trval {span(dayAt(low.peak), dayAt(low.trough))}
                            {low.recovery !== null ? ` a na pôvodnú hodnotu sa vrátila ${dateLong(dayAt(low.recovery))}.` : " a do konca obdobia sa na pôvodnú hodnotu nevrátila."}
                            {!onlyStocks ? ` Čisté akcie mali v tom istom období najhlbší prepad ${pct(r.stocks.drawdown.depth)}.` : ""}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {tab === "roky" ? (
                      <div role="tabpanel" id="ist-panel-roky" aria-labelledby="ist-tab-roky" className="ist-panel">
                        <p className="ist-lede">Výnos stratégie v každom kalendárnom roku. Neúplné roky na okrajoch obdobia sú vyblednuté.</p>
                        <div className="ist-legend ist-legend--static">
                          <span className="ist-legend-item"><i className="ist-legend-box ist-legend-accent" />Rok v pluse</span>
                          <span className="ist-legend-item"><i className="ist-legend-box ist-legend-ink" />Rok v mínuse</span>
                          {!onlyStocks ? <span className="ist-legend-item"><i className="ist-legend-point" />Len akcie</span> : null}
                        </div>
                        <YearBars r={r} withStocks={!onlyStocks} />
                        <p className="ist-summary">
                          V pluse skončilo <strong>{positiveYears} z {r.yearly.length}</strong> {r.yearly.length === 1 ? "roka" : "rokov"}.
                          {r.bestYear && r.worstYear && r.yearly.length > 1
                            ? ` Najlepší bol rok ${r.bestYear.year} (${signedPct(r.bestYear.strategy)}), najhorší rok ${r.worstYear.year} (${signedPct(r.worstYear.strategy)}).`
                            : ""}
                        </p>
                      </div>
                    ) : null}

                    {tab === "krizy" ? (
                      <div role="tabpanel" id="ist-panel-krizy" aria-labelledby="ist-tab-krizy" className="ist-panel">
                        <p className="ist-lede">Veľké pády akciového trhu, merané od vrcholu po dno. Vedľa vidíš, čo v tých istých dňoch urobila tvoja stratégia.</p>
                        {r.crises.length ? (
                          <ul className="ist-crises">
                            {r.crises.map((c) => {
                              const worst = Math.min(c.stocks, c.strategy, -0.01);
                              return (
                                <li key={c.id}>
                                  <div className="ist-crisis-head">
                                    <b>{c.name}</b>
                                    <span>{dateShort(dayAt(c.peak))} – {dateShort(dayAt(c.trough))}</span>
                                  </div>
                                  <div className="ist-crisis-bars">
                                    <span>Akcie</span>
                                    <i className="ist-bar ist-bar--ink" style={{ "--w": `${Math.max(0, (c.stocks / worst) * 100)}%` } as CSSProperties} />
                                    <b>{signedPct(c.stocks)}</b>
                                    <span>Tvoja stratégia</span>
                                    <i className="ist-bar ist-bar--accent" style={{ "--w": `${Math.max(0, (c.strategy / worst) * 100)}%` } as CSSProperties} />
                                    <b>{signedPct(c.strategy)}</b>
                                  </div>
                                  <button type="button" className="ist-add" onClick={() => setPeriod({ start: isoOf(dayAt(c.peak)) })}>
                                    Čo keby som začal práve na vrchole <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="ist-empty">V zvolenom období nie je celá ani jedna z veľkých kríz. Skús dlhšie obdobie.</p>
                        )}
                      </div>
                    ) : null}

                    {tab === "zaciatky" ? (
                      <div role="tabpanel" id="ist-panel-zaciatky" aria-labelledby="ist-tab-zaciatky" className="ist-panel">
                        <p className="ist-lede">
                          Tá istá stratégia a tie isté vklady, spustené od prvého obchodného dňa každého mesiaca v histórii. Ukazuje, ako veľmi záleží na tom, kedy začneš.
                        </p>
                        <div className="ist-horizon">
                          <span>Dĺžka investovania</span>
                          <div className="calc-pills" role="group" aria-label="Dĺžka investovania">
                            {horizons.map((h) => (
                              <button key={h} type="button" className="calc-pill" aria-pressed={span10 === h} onClick={() => setHorizon(h)}>
                                {h} {rokov(h)}
                              </button>
                            ))}
                          </div>
                        </div>
                        {roll ? (
                          <>
                            <RollingChart roll={roll} currency={cur} />
                            <dl className="ist-facts ist-facts--three">
                              <div>
                                <dt>Najhorší začiatok</dt>
                                <dd>{pct(roll.annMin)}</dd>
                                <small>ročne, {monthYear(roll.worst.start)}</small>
                              </div>
                              <div>
                                <dt>Typický výsledok</dt>
                                <dd>{pct(roll.annMedian)}</dd>
                                <small>ročne, polovica začiatkov dopadla lepšie</small>
                              </div>
                              <div>
                                <dt>Najlepší začiatok</dt>
                                <dd>{pct(roll.annMax)}</dd>
                                <small>ročne, {monthYear(roll.best.start)}</small>
                              </div>
                            </dl>
                            <p className="ist-summary">
                              Z {roll.rows.length} možných začiatkov skončilo <strong>{pct(roll.positive, 0)}</strong> nad tým, čo si vložil.
                              {roll.depositsMedian > 0
                                ? ` Po ${roll.horizon} ${roll.horizon === 1 ? "roku" : "rokoch"} by si mal od ${money(roll.finalMin, cur)} do ${money(roll.finalMax, cur)}, typicky ${money(roll.finalMedian, cur)} z vložených ${money(roll.depositsMedian, cur)}.`
                                : ""}
                            </p>
                          </>
                        ) : (
                          <p className="ist-empty">Počítam všetky začiatky…</p>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* tabuľka */}
                  <button type="button" className="ist-collapse ist-collapse--table" aria-expanded={tableOpen} onClick={() => setTableOpen((o) => !o)}>
                    <span>Tabuľka rok po roku</span>
                    <span className="ist-collapse-meta">{tableOpen ? "skryť" : "zobraziť"}</span>
                    <ChevronDown className={`h-4 w-4 ist-chev${tableOpen ? " is-open" : ""}`} aria-hidden />
                  </button>
                  {tableOpen ? (
                    <>
                      <div className="ist-table-wrap" tabIndex={0} role="region" aria-label="Tabuľka rok po roku">
                        <table className="ist-table">
                          <thead>
                            <tr>
                              <th>Rok</th>
                              <th>Stratégia</th>
                              <th>Akcie</th>
                              <th>Dlhopisy</th>
                              <th>Peňažný fond</th>
                              <th>Zloženie</th>
                              <th>Vklady</th>
                              <th>Hodnota</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.yearly.map((y) => (
                              <tr key={y.year} className={y.partial ? "is-partial" : undefined}>
                                <td>{y.year}{y.partial ? <small> neúplný</small> : null}</td>
                                <td><strong className={y.strategy >= 0 ? "is-accent" : undefined}>{signedPct(y.strategy)}</strong></td>
                                <td>{signedPct(y.stock)}</td>
                                <td>{signedPct(y.bond)}</td>
                                <td>{signedPct(y.cash)}</td>
                                <td>{mix(y.share.map((x) => x * 100))}</td>
                                <td>{money(y.paid, cur)}</td>
                                <td><strong>{money(y.value, cur)}</strong></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button type="button" className="ist-add ist-download" onClick={downloadCsv}>
                        <Download className="h-4 w-4" strokeWidth={2} aria-hidden /> Stiahnuť denný priebeh (CSV)
                      </button>
                    </>
                  ) : null}

                  {/* zdroje */}
                  <button type="button" className="ist-collapse ist-collapse--table" aria-expanded={sourcesOpen} onClick={() => setSourcesOpen((o) => !o)}>
                    <span>Odkiaľ sú dáta a ako počítam</span>
                    <span className="ist-collapse-meta">{sourcesOpen ? "skryť" : "zobraziť"}</span>
                    <ChevronDown className={`h-4 w-4 ist-chev${sourcesOpen ? " is-open" : ""}`} aria-hidden />
                  </button>
                  {sourcesOpen ? (
                    <div className="ist-sources">
                      <h4>Dáta v súbore „{SETS[A.set].label}“</h4>
                      <ul>
                        <li><b>Akcie:</b> {SETS[A.set].stock}. Denný celkový výnos vrátane dividend. Zdroj: Kenneth R. French Data Library (Dartmouth College){A.set === "eur" ? ", kurz dolára k euru podľa Európskej centrálnej banky" : ""}.</li>
                        <li>
                          <b>Dlhopisy:</b> {SETS[A.set].bond}. Denný výnos vrátane kupónov je dopočítaný z úradných výnosov do splatnosti. Zdroj:{" "}
                          {A.set === "eur" ? "Deutsche Bundesbank, výnosová krivka štátnych dlhopisov" : "Federal Reserve, tabuľka H.15"}.
                        </li>
                        <li><b>Peňažný fond:</b> {SETS[A.set].cash}. Zdroj: {A.set === "eur" ? "Európska centrálna banka" : "Kenneth R. French Data Library"}.</li>
                        <li><b>Inflácia:</b> {SETS[A.set].inflation}. Zdroj: {A.set === "eur" ? "Eurostat cez Európsku centrálnu banku" : "U.S. Bureau of Labor Statistics"}.</li>
                      </ul>
                      <h4>Ako počítam</h4>
                      <ul>
                        <li>Prvý vklad investujem v deň začiatku, mesačné vklady v rovnaký deň každého mesiaca. Ak sa v ten deň neobchodovalo, v najbližší obchodný deň.</li>
                        <li>Nový vklad rozdelím podľa cieľového pomeru. Celé portfólio vraciam na cieľový pomer {A.rebalance === "monthly" ? "každý mesiac" : "raz ročne, vždy na výročie začiatku"}.</li>
                        <li>Zmena stratégie príde v roku, ktorý zvolíš, naraz alebo postupne počas zvoleného počtu rokov.</li>
                        <li><b>Ročný výnos stratégie</b> meria samotnú stratégiu bez vplyvu vkladov. <b>Výnos tvojich vkladov</b> zohľadňuje, kedy ktoré peniaze prišli.</li>
                        <li>Ročné náklady strhávam denne z hodnoty účtu. Po očistení o infláciu sú sumy v cenách z posledného dňa obdobia.</li>
                      </ul>
                      <h4>Na čo si dať pozor</h4>
                      <ul>
                        <li>Dáta opisujú celé trhy, nie konkrétny fond. Fond na užší index (napríklad len veľké firmy) alebo iný dlhopisový fond sa môže v jednotlivom roku líšiť o niekoľko percentuálnych bodov.</li>
                        <li>Výnosy sú pred poplatkami fondov a pred zdanením dividend. Výsledok po nákladoch uvidíš, keď v podrobnejšom nastavení zadáš ročné náklady.</li>
                        <li>Výpočet neráta s daňou zo zisku ani s poplatkami za nákup a predaj.</li>
                        <li>Posledný deň dát je {dateLong(ds.day[ds.n - 1])}.</li>
                      </ul>
                    </div>
                  ) : null}

                  <div className="ist-cta">
                    <p>Chceš stratégiu postavenú na tvojich cieľoch, príjme a čase, ktorý máš? Prejdeme ju spolu na tvojich číslach.</p>
                    <a className="btn-primary ist-cta-btn" href={KONZULTACIA_URL} target="_blank" rel="noopener noreferrer" data-umami-event="click_konzultacia" data-umami-event-section="investicna-strategia" data-umami-event-slug="investicna-strategia">
                      {BONUSY_CTA_LABEL} <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    </a>
                  </div>
                </>
              )}
            </section>
          </div>

          <p className="calc-note calc-note--center ist-foot">
            Nástroj ukazuje, čo sa stalo v minulosti. Minulé výnosy nie sú spoľahlivým ukazovateľom budúcich výsledkov a hodnota investície môže aj
            klesnúť. Výnosy sú pred poplatkami a daňami, kým nezadáš ročné náklady. Nejde o investičné odporúčanie. Nastavenie sa ukladá iba
            v tvojom prehliadači.
          </p>
        </div>
      </div>
    </div>
  );
};

const ValueLegend = ({ strategy, stocks }: { strategy: boolean; stocks: boolean }) => (
  <div className="ist-legend ist-legend--static">
    {strategy ? <span className="ist-legend-item"><i className="ist-legend-line ist-legend-accent" />Tvoja stratégia</span> : null}
    {stocks ? <span className="ist-legend-item"><i className="ist-legend-line ist-legend-dash" />Len akcie</span> : null}
  </div>
);

/** Jedna veta o tom, čo stratégia priniesla oproti čistým akciám alebo oproti stratégii bez zmeny. */
const Verdict = ({ r, cur, multi, onlyStocks, dayAt }: { r: Result; cur: string; multi: boolean; onlyStocks: boolean; dayAt: (j: number) => number }) => {
  const s = r.strategy;
  if (multi && r.flat && r.afterChange) {
    const a = r.afterChange.strategy.depth;
    const b = r.afterChange.flat.depth;
    const diff = r.flat.final - s.final;
    return (
      <div className="ist-verdict">
        <b>
          {a > b + 0.0005
            ? `Po zmene stratégie bol najhlbší prepad ${pct(a)} namiesto ${pct(b)}.`
            : `Po zmene stratégie bol najhlbší prepad ${pct(a)}, bez zmeny by bol ${pct(b)}.`}
        </b>
        <span>
          Stratégiu si prvýkrát zmenil {dateLong(dayAt(r.afterChange.from))}. Bez zmeny by si mal na konci {money(r.flat.final, cur)}, teda o{" "}
          <strong>{money(Math.abs(diff), cur)} {diff >= 0 ? "viac" : "menej"}</strong>.
        </span>
        <em>Pokojnejší priebeh a vyšší výsledok idú zvyčajne proti sebe. Tu vidíš, koľko jedno aj druhé stálo v skutočnosti.</em>
      </div>
    );
  }
  if (!onlyStocks) {
    const diff = r.stocks.final - s.final;
    return (
      <div className="ist-verdict">
        <b>
          {s.drawdown.depth > r.stocks.drawdown.depth + 0.0005
            ? `Najhlbší prepad bol ${pct(s.drawdown.depth)}, pri čistých akciách by bol ${pct(r.stocks.drawdown.depth)}.`
            : `Najhlbší prepad bol ${pct(s.drawdown.depth)}, podobne ako pri čistých akciách (${pct(r.stocks.drawdown.depth)}).`}
        </b>
        {s.deposits > 0 ? (
          <span>
            Čisté akcie by pri rovnakých vkladoch skončili na {money(r.stocks.final, cur)}, teda o <strong>{money(Math.abs(diff), cur)} {diff >= 0 ? "viac" : "menej"}</strong>.
          </span>
        ) : null}
        {multi ? <em>Zmena stratégie príde až po konci zvoleného obdobia, preto sa vo výsledku neprejavila.</em> : null}
      </div>
    );
  }
  return (
    <div className="ist-verdict">
      <b>
        {s.drawdown.depth < 0
          ? `Čisté akcie: najhlbší prepad ${pct(s.drawdown.depth)}${s.drawdown.recovery !== null ? `, návrat na maximum trval ${span(dayAt(s.drawdown.peak), dayAt(s.drawdown.recovery))}` : ", do konca obdobia sa na maximum nevrátili"}.`
          : "Čisté akcie v tomto období len rástli."}
      </b>
      <span>Pridaj dlhopisy alebo peňažný fond a pozri, ako sa zmení prepad aj výsledok.</span>
      {multi ? <em>Zmena stratégie príde až po konci zvoleného obdobia, preto sa vo výsledku neprejavila.</em> : null}
    </div>
  );
};

export default InvesticnaStrategiaCalculator;
